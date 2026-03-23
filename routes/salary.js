const express = require('express');
const router = express.Router();

function logAudit(db, entityType, entityId, action, oldValue, newValue, description) {
  try {
    db.prepare('INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, description) VALUES (?, ?, ?, ?, ?, ?)').run(entityType, entityId, action, oldValue, newValue, description);
  } catch (e) { /* silent */ }
}

// ==================== SALARY RULES ====================

router.get('/rules', (req, res) => {
  const db = req.app.locals.db;
  const { company_id } = req.query;
  let query = 'SELECT sr.*, c.name as company_name FROM salary_rules sr LEFT JOIN companies c ON sr.company_id = c.id';
  const params = [];
  if (company_id) { query += ' WHERE sr.company_id = ?'; params.push(company_id); }
  query += ' ORDER BY sr.is_default DESC, sr.name';
  const rules = db.prepare(query).all(...params);
  // Attach allowances/deductions
  for (const rule of rules) {
    rule.items = db.prepare('SELECT * FROM salary_rule_allowances WHERE rule_id = ?').all(rule.id);
  }
  res.json(rules);
});

router.post('/rules', (req, res) => {
  const db = req.app.locals.db;
  const { company_id, name, working_hours_per_day, working_days_per_month, overtime_rate, overtime_after_hours, half_day_late_after_minutes, half_day_early_leave_minutes, late_arrival_time, early_leave_time, casual_leaves, sick_leaves, items } = req.body;
  if (!name) return res.status(400).json({ error: 'Rule name is required' });
  const result = db.prepare(`INSERT INTO salary_rules (company_id, name, working_hours_per_day, working_days_per_month, overtime_rate, overtime_after_hours, half_day_late_after_minutes, half_day_early_leave_minutes, late_arrival_time, early_leave_time, casual_leaves, sick_leaves)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    company_id || null, name, working_hours_per_day || 8, working_days_per_month || 26,
    overtime_rate || 1.5, overtime_after_hours || 8, half_day_late_after_minutes || 30,
    half_day_early_leave_minutes || 60, late_arrival_time || '09:30', early_leave_time || '17:00',
    casual_leaves || 1, sick_leaves || 1
  );
  if (items && items.length > 0) {
    const insertItem = db.prepare('INSERT INTO salary_rule_allowances (rule_id, name, type, amount, is_percentage) VALUES (?, ?, ?, ?, ?)');
    for (const item of items) {
      insertItem.run(result.lastInsertRowid, item.name, item.type || 'allowance', item.amount || 0, item.is_percentage ? 1 : 0);
    }
  }
  const rule = db.prepare('SELECT * FROM salary_rules WHERE id = ?').get(result.lastInsertRowid);
  rule.items = db.prepare('SELECT * FROM salary_rule_allowances WHERE rule_id = ?').all(rule.id);
  logAudit(db, 'salary_rule', rule.id, 'create', null, JSON.stringify(rule), `Created salary rule: ${name}`);
  res.status(201).json(rule);
});

router.put('/rules/:id', (req, res) => {
  const db = req.app.locals.db;
  const old = db.prepare('SELECT * FROM salary_rules WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Rule not found' });
  const { company_id, name, working_hours_per_day, working_days_per_month, overtime_rate, overtime_after_hours, half_day_late_after_minutes, half_day_early_leave_minutes, late_arrival_time, early_leave_time, casual_leaves, sick_leaves, items } = req.body;
  db.prepare(`UPDATE salary_rules SET company_id=?, name=?, working_hours_per_day=?, working_days_per_month=?, overtime_rate=?, overtime_after_hours=?, half_day_late_after_minutes=?, half_day_early_leave_minutes=?, late_arrival_time=?, early_leave_time=?, casual_leaves=?, sick_leaves=?, updated_at=datetime('now') WHERE id=?`).run(
    company_id !== undefined ? company_id : old.company_id, name || old.name,
    working_hours_per_day || old.working_hours_per_day, working_days_per_month || old.working_days_per_month,
    overtime_rate || old.overtime_rate, overtime_after_hours || old.overtime_after_hours,
    half_day_late_after_minutes || old.half_day_late_after_minutes, half_day_early_leave_minutes || old.half_day_early_leave_minutes,
    late_arrival_time || old.late_arrival_time, early_leave_time || old.early_leave_time,
    casual_leaves !== undefined ? casual_leaves : old.casual_leaves, sick_leaves !== undefined ? sick_leaves : old.sick_leaves,
    req.params.id
  );
  if (items) {
    db.prepare('DELETE FROM salary_rule_allowances WHERE rule_id = ?').run(req.params.id);
    const insertItem = db.prepare('INSERT INTO salary_rule_allowances (rule_id, name, type, amount, is_percentage) VALUES (?, ?, ?, ?, ?)');
    for (const item of items) {
      insertItem.run(req.params.id, item.name, item.type || 'allowance', item.amount || 0, item.is_percentage ? 1 : 0);
    }
  }
  const updated = db.prepare('SELECT * FROM salary_rules WHERE id = ?').get(req.params.id);
  updated.items = db.prepare('SELECT * FROM salary_rule_allowances WHERE rule_id = ?').all(updated.id);
  logAudit(db, 'salary_rule', updated.id, 'update', JSON.stringify(old), JSON.stringify(updated), `Updated salary rule: ${updated.name}`);
  res.json(updated);
});

router.delete('/rules/:id', (req, res) => {
  const db = req.app.locals.db;
  const old = db.prepare('SELECT * FROM salary_rules WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Rule not found' });
  if (old.is_default) return res.status(400).json({ error: 'Cannot delete default rule' });
  db.prepare('DELETE FROM salary_rules WHERE id = ?').run(req.params.id);
  logAudit(db, 'salary_rule', old.id, 'delete', JSON.stringify(old), null, `Deleted salary rule: ${old.name}`);
  res.json({ success: true });
});

// ==================== PAYMENTS ====================

router.get('/payments', (req, res) => {
  const db = req.app.locals.db;
  const { employee_id, type, start_date, end_date } = req.query;
  let query = `SELECT p.*, e.name as employee_name, e.emp_code FROM payments p JOIN employees e ON p.employee_id = e.id WHERE 1=1`;
  const params = [];
  if (employee_id) { query += ' AND p.employee_id = ?'; params.push(employee_id); }
  if (type) { query += ' AND p.type = ?'; params.push(type); }
  if (start_date) { query += ' AND p.payment_date >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND p.payment_date <= ?'; params.push(end_date); }
  query += ' ORDER BY p.payment_date DESC';
  res.json(db.prepare(query).all(...params));
});

router.post('/payments', (req, res) => {
  const db = req.app.locals.db;
  const { employee_id, amount, type, payment_date, payment_method, period_start, period_end, notes } = req.body;
  if (!employee_id || !amount || !type || !payment_date) return res.status(400).json({ error: 'Employee, amount, type, and date are required' });
  const result = db.prepare('INSERT INTO payments (employee_id, amount, type, payment_date, payment_method, period_start, period_end, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(employee_id, amount, type, payment_date, payment_method || 'cash', period_start || null, period_end || null, notes || null);
  const payment = db.prepare('SELECT p.*, e.name as employee_name FROM payments p JOIN employees e ON p.employee_id = e.id WHERE p.id = ?').get(result.lastInsertRowid);
  logAudit(db, 'payment', payment.id, 'create', null, JSON.stringify(payment), `Recorded ${type} payment of ₹${amount} for employee ${payment.employee_name}`);
  res.status(201).json(payment);
});

router.delete('/payments/:id', (req, res) => {
  const db = req.app.locals.db;
  const old = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Payment not found' });
  db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
  logAudit(db, 'payment', old.id, 'delete', JSON.stringify(old), null, `Deleted payment record`);
  res.json({ success: true });
});

// ==================== PAYROLL CALCULATION ====================

router.post('/calculate', (req, res) => {
  const db = req.app.locals.db;
  const { period_start, period_end, company_id, branch_id, department_id, employee_id } = req.body;
  if (!period_start || !period_end) return res.status(400).json({ error: 'Period start and end dates are required' });

  // Get employees
  let empQuery = 'SELECT * FROM employees WHERE status = "active"';
  const empParams = [];
  if (employee_id) { empQuery += ' AND id = ?'; empParams.push(employee_id); }
  else {
    if (company_id) { empQuery += ' AND company_id = ?'; empParams.push(company_id); }
    if (branch_id) { empQuery += ' AND branch_id = ?'; empParams.push(branch_id); }
    if (department_id) { empQuery += ' AND department_id = ?'; empParams.push(department_id); }
  }
  const employees = db.prepare(empQuery).all(...empParams);

  // Get applicable salary rule
  const getRule = (companyId) => {
    let rule = null;
    if (companyId) {
      rule = db.prepare('SELECT * FROM salary_rules WHERE company_id = ? LIMIT 1').get(companyId);
    }
    if (!rule) {
      rule = db.prepare('SELECT * FROM salary_rules WHERE is_default = 1 LIMIT 1').get();
    }
    if (!rule) {
      rule = db.prepare('SELECT * FROM salary_rules LIMIT 1').get();
    }
    if (rule) {
      rule.items = db.prepare('SELECT * FROM salary_rule_allowances WHERE rule_id = ?').all(rule.id);
    }
    return rule;
  };

  const results = [];
  const upsertPayroll = db.prepare(`INSERT OR REPLACE INTO payroll (employee_id, period_start, period_end, working_days, present_days, absent_days, half_days, overtime_hours, base_salary, overtime_pay, total_allowances, total_deductions, gross_salary, net_salary, advances_paid, salary_already_paid, final_payable, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const transaction = db.transaction(() => {
    for (const emp of employees) {
      const rule = getRule(emp.company_id);
      if (!rule) continue;

      // Get attendance for the period
      const attendance = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date >= ? AND date <= ? ORDER BY date')
        .all(emp.id, period_start, period_end);

      // Calculate working days in period
      const start = new Date(period_start);
      const end = new Date(period_end);
      const totalCalendarDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const workingDays = Math.min(totalCalendarDays, rule.working_days_per_month);

      let presentDays = 0;
      let absentDays = 0;
      let halfDays = 0;
      let totalOvertimeHours = 0;

      for (const att of attendance) {
        if (att.status === 'absent') {
          absentDays++;
          continue;
        }
        if (att.status === 'leave' || att.status === 'holiday') {
          presentDays++;
          continue;
        }

        // Check for half day
        let isHalfDay = false;
        if (att.check_in && rule.late_arrival_time) {
          const [ch, cm] = att.check_in.split(':').map(Number);
          const [lh, lm] = rule.late_arrival_time.split(':').map(Number);
          const lateMinutes = (ch * 60 + cm) - (lh * 60 + lm);
          if (lateMinutes > rule.half_day_late_after_minutes) {
            isHalfDay = true;
          }
        }
        if (!isHalfDay && att.check_out && rule.early_leave_time) {
          const [ch, cm] = att.check_out.split(':').map(Number);
          const [eh, em] = rule.early_leave_time.split(':').map(Number);
          const earlyMinutes = (eh * 60 + em) - (ch * 60 + cm);
          if (earlyMinutes > rule.half_day_early_leave_minutes) {
            isHalfDay = true;
          }
        }

        if (isHalfDay) {
          halfDays++;
          presentDays += 0.5;
        } else {
          presentDays++;
        }

        // Overtime
        if (att.total_hours > rule.overtime_after_hours) {
          totalOvertimeHours += att.total_hours - rule.overtime_after_hours;
        }
      }

      // Days not in attendance records = absent (if within working days)
      const recordedDays = attendance.length;
      const unrecordedDays = Math.max(0, workingDays - recordedDays);
      absentDays += unrecordedDays;

      // Salary calculations
      const dailySalary = emp.base_salary / rule.working_days_per_month;
      const hourlySalary = dailySalary / rule.working_hours_per_day;

      const basePay = dailySalary * presentDays;
      const overtimePay = hourlySalary * rule.overtime_rate * totalOvertimeHours;

      // Allowances & deductions from rule items
      let totalAllowances = 0;
      let totalDeductions = 0;
      if (rule.items) {
        for (const item of rule.items) {
          const amount = item.is_percentage ? (emp.base_salary * item.amount / 100) : item.amount;
          if (item.type === 'allowance') totalAllowances += amount;
          else if (item.type === 'deduction') totalDeductions += amount;
        }
      }

      const grossSalary = basePay + overtimePay + totalAllowances;
      const netSalary = grossSalary - totalDeductions;

      // Get advances and early salary payments
      const advancesPaid = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE employee_id = ? AND type = "advance" AND payment_date >= ? AND payment_date <= ?')
        .get(emp.id, period_start, period_end).total;
      const salaryAlreadyPaid = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE employee_id = ? AND type = "salary" AND payment_date >= ? AND payment_date <= ?')
        .get(emp.id, period_start, period_end).total;

      const finalPayable = Math.max(0, netSalary - advancesPaid - salaryAlreadyPaid);

      upsertPayroll.run(emp.id, period_start, period_end, workingDays, presentDays, absentDays, halfDays,
        Math.round(totalOvertimeHours * 100) / 100, Math.round(basePay * 100) / 100,
        Math.round(overtimePay * 100) / 100, Math.round(totalAllowances * 100) / 100,
        Math.round(totalDeductions * 100) / 100, Math.round(grossSalary * 100) / 100,
        Math.round(netSalary * 100) / 100, Math.round(advancesPaid * 100) / 100,
        Math.round(salaryAlreadyPaid * 100) / 100, Math.round(finalPayable * 100) / 100, 'pending');

      results.push({
        employee_id: emp.id, employee_name: emp.name, emp_code: emp.emp_code,
        working_days: workingDays, present_days: presentDays, absent_days: absentDays, half_days: halfDays,
        overtime_hours: Math.round(totalOvertimeHours * 100) / 100,
        base_salary: Math.round(basePay * 100) / 100, overtime_pay: Math.round(overtimePay * 100) / 100,
        total_allowances: Math.round(totalAllowances * 100) / 100, total_deductions: Math.round(totalDeductions * 100) / 100,
        gross_salary: Math.round(grossSalary * 100) / 100, net_salary: Math.round(netSalary * 100) / 100,
        advances_paid: Math.round(advancesPaid * 100) / 100, salary_already_paid: Math.round(salaryAlreadyPaid * 100) / 100,
        final_payable: Math.round(finalPayable * 100) / 100, status: 'pending'
      });
    }
  });

  transaction();
  logAudit(db, 'payroll', null, 'calculate', null, JSON.stringify({ period: `${period_start} to ${period_end}`, employees: results.length }), `Calculated payroll for ${results.length} employees`);
  res.json(results);
});

// Get payroll records
router.get('/payroll', (req, res) => {
  const db = req.app.locals.db;
  const { period_start, period_end, status } = req.query;
  let query = `SELECT p.*, e.name as employee_name, e.emp_code, c.name as company_name, b.name as branch_name, d.name as department_name
    FROM payroll p
    JOIN employees e ON p.employee_id = e.id
    LEFT JOIN companies c ON e.company_id = c.id
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN departments d ON e.department_id = d.id WHERE 1=1`;
  const params = [];
  if (period_start) { query += ' AND p.period_start >= ?'; params.push(period_start); }
  if (period_end) { query += ' AND p.period_end <= ?'; params.push(period_end); }
  if (status) { query += ' AND p.status = ?'; params.push(status); }
  query += ' ORDER BY e.name';
  res.json(db.prepare(query).all(...params));
});

// Mark payroll as paid
router.put('/payroll/:id/pay', (req, res) => {
  const db = req.app.locals.db;
  const payroll = db.prepare('SELECT * FROM payroll WHERE id = ?').get(req.params.id);
  if (!payroll) return res.status(404).json({ error: 'Payroll record not found' });
  const { paid_amount } = req.body;
  const amount = paid_amount || payroll.final_payable;
  const status = amount >= payroll.final_payable ? 'paid' : 'partial';
  db.prepare('UPDATE payroll SET status = ?, paid_amount = ?, paid_date = date("now"), updated_at = datetime("now") WHERE id = ?')
    .run(status, amount, req.params.id);
  // Record as payment
  db.prepare('INSERT INTO payments (employee_id, amount, type, payment_date, period_start, period_end, notes) VALUES (?, ?, "salary", date("now"), ?, ?, ?)')
    .run(payroll.employee_id, amount, payroll.period_start, payroll.period_end, `Payroll payment - ${status}`);
  const updated = db.prepare('SELECT * FROM payroll WHERE id = ?').get(req.params.id);
  logAudit(db, 'payroll', updated.id, 'pay', JSON.stringify(payroll), JSON.stringify(updated), `Marked payroll as ${status}: ₹${amount}`);
  res.json(updated);
});

module.exports = router;
