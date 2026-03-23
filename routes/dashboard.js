const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const { period, start_date, end_date, company_id, branch_id, department_id } = req.query;

  // Calculate date range based on period
  let startDate, endDate;
  const now = new Date();
  if (start_date && end_date) {
    startDate = start_date;
    endDate = end_date;
  } else {
    switch (period) {
      case 'day':
        startDate = endDate = now.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        startDate = weekStart.toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
        break;
      case 'year':
        startDate = `${now.getFullYear()}-01-01`;
        endDate = now.toISOString().split('T')[0];
        break;
      default: // month
        startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        endDate = now.toISOString().split('T')[0];
    }
  }

  let empFilter = '';
  const empParams = [];
  if (company_id) { empFilter += ' AND e.company_id = ?'; empParams.push(company_id); }
  if (branch_id) { empFilter += ' AND e.branch_id = ?'; empParams.push(branch_id); }
  if (department_id) { empFilter += ' AND e.department_id = ?'; empParams.push(department_id); }

  // Total employees
  const totalEmployees = db.prepare(`SELECT COUNT(*) as count FROM employees e WHERE e.status = 'active' ${empFilter}`).get(...empParams).count;

  // Total salary expenses (from payroll)
  const salaryExpenses = db.prepare(`SELECT COALESCE(SUM(p.net_salary), 0) as total FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.period_start >= ? AND p.period_end <= ? ${empFilter}`)
    .get(startDate, endDate, ...empParams).total;

  // Total working hours
  const workingStats = db.prepare(`SELECT COALESCE(SUM(a.total_hours), 0) as total_hours, COUNT(DISTINCT a.date) as total_days FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE a.date >= ? AND a.date <= ? AND a.status = 'present' ${empFilter}`)
    .get(startDate, endDate, ...empParams);

  // Overtime hours
  const rule = db.prepare('SELECT overtime_after_hours FROM salary_rules WHERE is_default = 1 LIMIT 1').get();
  const overtimeThreshold = rule ? rule.overtime_after_hours : 8;
  const overtimeStats = db.prepare(`SELECT COALESCE(SUM(CASE WHEN a.total_hours > ? THEN a.total_hours - ? ELSE 0 END), 0) as overtime_hours FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE a.date >= ? AND a.date <= ? ${empFilter}`)
    .get(overtimeThreshold, overtimeThreshold, startDate, endDate, ...empParams);

  // Total advances
  const advances = db.prepare(`SELECT COALESCE(SUM(pm.amount), 0) as total FROM payments pm JOIN employees e ON pm.employee_id = e.id WHERE pm.type = 'advance' AND pm.payment_date >= ? AND pm.payment_date <= ? ${empFilter}`)
    .get(startDate, endDate, ...empParams).total;

  // Pending salary
  const pendingSalary = db.prepare(`SELECT COALESCE(SUM(p.final_payable), 0) as total FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.status = 'pending' AND p.period_start >= ? AND p.period_end <= ? ${empFilter}`)
    .get(startDate, endDate, ...empParams).total;

  // Paid salary
  const paidSalary = db.prepare(`SELECT COALESCE(SUM(p.paid_amount), 0) as total FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.status IN ('paid', 'partial') AND p.period_start >= ? AND p.period_end <= ? ${empFilter}`)
    .get(startDate, endDate, ...empParams).total;

  // Employee performance ranking (by attendance percentage)
  const performance = db.prepare(`SELECT e.id, e.name, e.emp_code,
    COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
    COUNT(a.id) as total_records,
    COALESCE(SUM(a.total_hours), 0) as total_hours,
    ROUND(COUNT(CASE WHEN a.status = 'present' THEN 1 END) * 100.0 / NULLIF(COUNT(a.id), 0), 1) as attendance_pct
    FROM employees e
    LEFT JOIN attendance a ON e.id = a.employee_id AND a.date >= ? AND a.date <= ?
    WHERE e.status = 'active' ${empFilter}
    GROUP BY e.id
    ORDER BY attendance_pct DESC, total_hours DESC
    LIMIT 10`)
    .all(startDate, endDate, ...empParams);

  // Monthly salary trend (last 6 months)
  const salaryTrend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const monthEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
    const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const total = db.prepare(`SELECT COALESCE(SUM(p.net_salary), 0) as total FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.period_start >= ? AND p.period_end <= ? ${empFilter}`)
      .get(monthStart, monthEnd, ...empParams).total;
    salaryTrend.push({ month: monthLabel, total });
  }

  // Attendance distribution
  const attendanceDist = db.prepare(`SELECT a.status, COUNT(*) as count FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE a.date >= ? AND a.date <= ? ${empFilter} GROUP BY a.status`)
    .all(startDate, endDate, ...empParams);

  // Alerts count
  const alertsCount = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE is_read = 0').get().count;

  // Recent activity
  const recentActivity = db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10').all();

  res.json({
    period: { start: startDate, end: endDate },
    totalEmployees,
    salaryExpenses: Math.round(salaryExpenses * 100) / 100,
    totalHours: Math.round(workingStats.total_hours * 100) / 100,
    totalWorkingDays: workingStats.total_days,
    overtimeHours: Math.round(overtimeStats.overtime_hours * 100) / 100,
    totalAdvances: Math.round(advances * 100) / 100,
    pendingSalary: Math.round(pendingSalary * 100) / 100,
    paidSalary: Math.round(paidSalary * 100) / 100,
    performance,
    salaryTrend,
    attendanceDist,
    alertsCount,
    recentActivity
  });
});

// Generate alerts
router.post('/alerts', (req, res) => {
  const db = req.app.locals.db;
  const alerts = [];
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  // Pending salary alerts
  const pendingPayrolls = db.prepare('SELECT p.*, e.name FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.status = "pending"').all();
  for (const p of pendingPayrolls) {
    const alert = { type: 'salary_pending', message: `Salary pending for ${p.name} (${p.period_start} to ${p.period_end}): ₹${p.final_payable}`, entity_type: 'payroll', entity_id: p.id };
    alerts.push(alert);
  }

  // Missing attendance
  const activeEmployees = db.prepare('SELECT * FROM employees WHERE status = "active"').all();
  for (const emp of activeEmployees) {
    const todayAttendance = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(emp.id, today);
    if (!todayAttendance) {
      alerts.push({ type: 'missing_attendance', message: `No attendance recorded today for ${emp.name}`, entity_type: 'employee', entity_id: emp.id });
    }
  }

  // Employees without salary set
  const noSalary = db.prepare('SELECT * FROM employees WHERE status = "active" AND (base_salary IS NULL OR base_salary = 0)').all();
  for (const emp of noSalary) {
    alerts.push({ type: 'incomplete_data', message: `No base salary set for ${emp.name}`, entity_type: 'employee', entity_id: emp.id });
  }

  // Store alerts
  db.prepare('DELETE FROM alerts WHERE is_read = 0').run();
  const insertAlert = db.prepare('INSERT INTO alerts (type, message, entity_type, entity_id) VALUES (?, ?, ?, ?)');
  for (const a of alerts) {
    insertAlert.run(a.type, a.message, a.entity_type, a.entity_id);
  }

  res.json(alerts);
});

router.get('/alerts', (req, res) => {
  const db = req.app.locals.db;
  const alerts = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50').all();
  res.json(alerts);
});

router.put('/alerts/:id/read', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.put('/alerts/read-all', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('UPDATE alerts SET is_read = 1').run();
  res.json({ success: true });
});

router.delete('/alerts', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM alerts').run();
  res.json({ success: true });
});

module.exports = router;
