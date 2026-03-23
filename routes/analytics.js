const express = require('express');
const router = express.Router();

function getDB(req) {
  return req.app.locals.db;
}

// 1. Get Analytics Settings
router.get('/settings', (req, res) => {
  const db = getDB(req);
  let settings = db.prepare('SELECT * FROM analytics_settings ORDER BY id DESC LIMIT 1').get();
  
  if (!settings) {
    db.prepare(`INSERT INTO analytics_settings (attendance_weight, late_penalty, overtime_bonus, half_day_penalty, absent_penalty) VALUES (50, -15, 20, -5, -20)`).run();
    settings = db.prepare('SELECT * FROM analytics_settings ORDER BY id DESC LIMIT 1').get();
  }
  
  res.json(settings);
});

// 2. Update Analytics Settings
router.put('/settings', (req, res) => {
  const db = getDB(req);
  const { attendance_weight, late_penalty, overtime_bonus, half_day_penalty, absent_penalty } = req.body;
  
  db.prepare(`
    UPDATE analytics_settings 
    SET attendance_weight = ?, late_penalty = ?, overtime_bonus = ?, half_day_penalty = ?, absent_penalty = ?, updated_at = datetime('now')
    WHERE id = (SELECT id FROM analytics_settings ORDER BY id DESC LIMIT 1)
  `).run(
    Number(attendance_weight) || 50,
    Number(late_penalty) || -15,
    Number(overtime_bonus) || 20,
    Number(half_day_penalty) || -5,
    Number(absent_penalty) || -20
  );
  
  res.json({ success: true, message: 'Settings updated' });
});

// 3. Generate Dashboard Analytics
router.get('/dashboard', (req, res) => {
  const db = getDB(req);
  const { company_id, branch_id, department_id, month, year } = req.query;
  
  // Construct conditions
  let empWhere = ['1=1'];
  let empParams = [];
  if (company_id) { empWhere.push('company_id = ?'); empParams.push(company_id); }
  if (branch_id) { empWhere.push('branch_id = ?'); empParams.push(branch_id); }
  if (department_id) { empWhere.push('department_id = ?'); empParams.push(department_id); }
  const empConditionClause = empWhere.join(' AND ');

  const targetDate = new Date();
  const currentMonth = month ? String(month).padStart(2, '0') : String(targetDate.getMonth() + 1).padStart(2, '0');
  const currentYear = year || targetDate.getFullYear();
  const periodPrefix = `${currentYear}-${currentMonth}`;

  // Get Settings for ML Algo
  let settings = db.prepare('SELECT * FROM analytics_settings ORDER BY id DESC LIMIT 1').get();
  if (!settings) {
    settings = { attendance_weight: 50, late_penalty: -15, overtime_bonus: 20, half_day_penalty: -5, absent_penalty: -20 };
  }

  // Fetch Base Data
  const employees = db.prepare(`SELECT * FROM employees WHERE ${empConditionClause}`).all(...empParams);
  const employeeIds = employees.map(e => e.id);
  
  if (employeeIds.length === 0) {
    return res.json({
      performanceScores: [],
      costTrends: [],
      suggestions: [],
      stats: { totalEmployees: 0, totalSalary: 0, totalOvertimeHours: 0 }
    });
  }

  const inClause = employeeIds.join(',');

  // Fetch Attendance for this month
  const attendances = db.prepare(`
    SELECT * FROM attendance 
    WHERE employee_id IN (${inClause}) 
    AND date LIKE ?
  `).all(`${periodPrefix}-%`);

  // Fetch Payroll Data for cost trend
  const payrolls = db.prepare(`
    SELECT * FROM payroll
    WHERE employee_id IN (${inClause})
  `).all(); // Take all to chart historical trends

  // Compile individual employee stats
  let performanceList = [];
  let totalOvertimeHours = 0;

  for (let emp of employees) {
    let empAtt = attendances.filter(a => a.employee_id === emp.id);
    let presentCount = empAtt.filter(a => a.status === 'present').length;
    let halfDayCount = empAtt.filter(a => a.status === 'half_day').length;
    let lateCount = 0; // Simulate late count for now based on dummy check_in if '09:30' rule breached, but we don't have full rules per employee easily accessible here, so let's extract it from notes or leave as 0 and extrapolate halfdays. We'll rely on absent and half_day for basic penalty.
    let absentCount = empAtt.filter(a => a.status === 'absent').length;
    let overtimeHours = 0;
    
    // We'll get overtime from payroll of THIS month if generated, else estimate
    const currentPayroll = payrolls.find(p => p.employee_id === emp.id && p.period_start.startsWith(periodPrefix));
    if (currentPayroll) {
      overtimeHours = currentPayroll.overtime_hours || 0;
      absentCount += currentPayroll.absent_days || 0; // Use payroll finalized numbers if present
      halfDayCount += currentPayroll.half_days || 0;
      presentCount += currentPayroll.present_days || 0;
    }

    totalOvertimeHours += overtimeHours;

    // ML Performance Score Calculation
    let score = 100 
      + (presentCount * (settings.attendance_weight / 26)) // 26 is avg working days
      + (lateCount * settings.late_penalty)
      + (halfDayCount * settings.half_day_penalty)
      + (absentCount * settings.absent_penalty)
      + (overtimeHours * settings.overtime_bonus);

    // Normalize between 0 and 100
    score = Math.max(0, Math.min(100, score));

    performanceList.push({
      id: emp.id,
      name: emp.name,
      designation: emp.designation,
      score: Math.round(score),
      present: presentCount,
      absent: absentCount,
      overtime: overtimeHours
    });
  }

  // Sort Top / Bottom Performers
  performanceList.sort((a, b) => b.score - a.score);

  // Cost Trends Calculation (last 6 months moving avg)
  let costTrends = { labels: [], salary: [], overtime: [] };
  let currentM = new Date().getMonth();
  for (let i = 5; i >= 0; i--) {
    let d = new Date();
    d.setMonth(currentM - i);
    let l_year = d.getFullYear();
    let l_month = String(d.getMonth() + 1).padStart(2, '0');
    let prefix = `${l_year}-${l_month}`;
    
    costTrends.labels.push(d.toLocaleString('default', { month: 'short' }));
    
    let monthPayrolls = payrolls.filter(p => p.period_start.startsWith(prefix));
    let totalSal = monthPayrolls.reduce((sum, p) => sum + (p.net_salary || 0), 0);
    let totalOt = monthPayrolls.reduce((sum, p) => sum + (p.overtime_pay || 0), 0);
    
    costTrends.salary.push(totalSal);
    costTrends.overtime.push(totalOt);
  }

  // Smart Suggestions Engine
  let suggestions = [];
  
  if (totalOvertimeHours > (employees.length * 5)) {
    suggestions.push({ type: 'warning', text: `High overtime detected (${totalOvertimeHours} hrs). Consider hiring more staff to offset overtime expenses.` });
  }
  
  let topPerformers = performanceList.filter(p => p.score >= 90);
  if (topPerformers.length > 0) {
    suggestions.push({ type: 'success', text: `${topPerformers.length} employees are eligible for performance bonuses.` });
  }

  let lowPerformers = performanceList.filter(p => p.score <= 40);
  if (lowPerformers.length > 0) {
    suggestions.push({ type: 'danger', text: `${lowPerformers.length} employees have poor attendance/scores. Review required.` });
  }
  
  if (costTrends.salary.length >= 2) {
    let lastM = costTrends.salary[costTrends.salary.length - 1];
    let prevM = costTrends.salary[costTrends.salary.length - 2];
    if (lastM > prevM * 1.1) {
      suggestions.push({ type: 'info', text: `Salary expense increased by >10% this month.` });
    }
  }

  // Send Response
  res.json({
    performanceScores: performanceList,
    costTrends,
    suggestions,
    stats: {
       totalEmployees: employees.length,
       totalSalary: costTrends.salary[costTrends.salary.length - 1],
       totalOvertimeHours: totalOvertimeHours
    }
  });

});

module.exports = router;
