const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');

// Generate salary slip PDF
router.get('/salary-slip/:payrollId', (req, res) => {
  const db = req.app.locals.db;
  const payroll = db.prepare(`SELECT p.*, e.name as employee_name, e.emp_code, e.designation, e.phone, e.email,
    c.name as company_name, b.name as branch_name, d.name as department_name
    FROM payroll p
    JOIN employees e ON p.employee_id = e.id
    LEFT JOIN companies c ON e.company_id = c.id
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE p.id = ?`).get(req.params.payrollId);

  if (!payroll) return res.status(404).json({ error: 'Payroll record not found' });

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=salary_slip_${payroll.employee_name.replace(/\s+/g, '_')}_${payroll.period_start}.pdf`);
  doc.pipe(res);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('SAI Payroll', { align: 'center' });
  doc.fontSize(10).font('Helvetica').text('Payroll Management System', { align: 'center' });
  doc.moveDown();
  doc.fontSize(14).font('Helvetica-Bold').text('SALARY SLIP', { align: 'center' });
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  // Employee info
  doc.fontSize(10).font('Helvetica');
  const infoY = doc.y;
  doc.text(`Employee: ${payroll.employee_name}`, 50);
  doc.text(`Code: ${payroll.emp_code || 'N/A'}`, 50);
  doc.text(`Designation: ${payroll.designation || 'N/A'}`, 50);
  doc.text(`Company: ${payroll.company_name || 'N/A'}`, 300, infoY);
  doc.text(`Branch: ${payroll.branch_name || 'N/A'}`, 300);
  doc.text(`Department: ${payroll.department_name || 'N/A'}`, 300);
  doc.moveDown();
  doc.text(`Period: ${payroll.period_start} to ${payroll.period_end}`, 50);
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  // Attendance summary
  doc.fontSize(12).font('Helvetica-Bold').text('Attendance Summary');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Working Days: ${payroll.working_days}`, 50);
  doc.text(`Present Days: ${payroll.present_days}`, 50);
  doc.text(`Absent Days: ${payroll.absent_days}`, 300, doc.y - 14);
  doc.text(`Half Days: ${payroll.half_days}`, 50);
  doc.text(`Overtime Hours: ${payroll.overtime_hours}`, 300, doc.y - 14);
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  // Earnings
  doc.fontSize(12).font('Helvetica-Bold').text('Earnings');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text('Base Salary:', 50); doc.text(`₹ ${payroll.base_salary.toFixed(2)}`, 400, doc.y - 14, { align: 'right', width: 145 });
  doc.text('Overtime Pay:', 50); doc.text(`₹ ${payroll.overtime_pay.toFixed(2)}`, 400, doc.y - 14, { align: 'right', width: 145 });
  doc.text('Allowances:', 50); doc.text(`₹ ${payroll.total_allowances.toFixed(2)}`, 400, doc.y - 14, { align: 'right', width: 145 });
  doc.font('Helvetica-Bold').text('Gross Salary:', 50); doc.text(`₹ ${payroll.gross_salary.toFixed(2)}`, 400, doc.y - 14, { align: 'right', width: 145 });
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  // Deductions
  doc.fontSize(12).font('Helvetica-Bold').text('Deductions');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text('Total Deductions:', 50); doc.text(`₹ ${payroll.total_deductions.toFixed(2)}`, 400, doc.y - 14, { align: 'right', width: 145 });
  doc.text('Advances Paid:', 50); doc.text(`₹ ${payroll.advances_paid.toFixed(2)}`, 400, doc.y - 14, { align: 'right', width: 145 });
  doc.text('Salary Already Paid:', 50); doc.text(`₹ ${payroll.salary_already_paid.toFixed(2)}`, 400, doc.y - 14, { align: 'right', width: 145 });
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  // Net payable
  doc.fontSize(14).font('Helvetica-Bold').text('Net Payable:', 50);
  doc.text(`₹ ${payroll.final_payable.toFixed(2)}`, 400, doc.y - 18, { align: 'right', width: 145 });
  doc.moveDown(2);

  doc.fontSize(8).font('Helvetica').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.text('This is a computer-generated document.', { align: 'center' });

  doc.end();
});

// Export attendance report (Excel)
router.get('/attendance', (req, res) => {
  const db = req.app.locals.db;
  const { start_date, end_date, company_id } = req.query;
  let query = `SELECT a.date, e.emp_code, e.name as employee, a.check_in, a.check_out, a.total_hours, a.status, c.name as company, b.name as branch, d.name as department
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    LEFT JOIN companies c ON e.company_id = c.id
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN departments d ON e.department_id = d.id WHERE 1=1`;
  const params = [];
  if (start_date) { query += ' AND a.date >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND a.date <= ?'; params.push(end_date); }
  if (company_id) { query += ' AND e.company_id = ?'; params.push(company_id); }
  query += ' ORDER BY a.date, e.name';
  const data = db.prepare(query).all(...params);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.xlsx');
  res.send(buffer);
});

// Export payroll report (Excel)
router.get('/payroll', (req, res) => {
  const db = req.app.locals.db;
  const { period_start, period_end } = req.query;
  let query = `SELECT e.emp_code, e.name as employee, c.name as company, b.name as branch, d.name as department,
    p.period_start, p.period_end, p.working_days, p.present_days, p.absent_days, p.half_days,
    p.overtime_hours, p.base_salary, p.overtime_pay, p.total_allowances, p.total_deductions,
    p.gross_salary, p.net_salary, p.advances_paid, p.salary_already_paid, p.final_payable, p.status, p.paid_amount
    FROM payroll p
    JOIN employees e ON p.employee_id = e.id
    LEFT JOIN companies c ON e.company_id = c.id
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN departments d ON e.department_id = d.id WHERE 1=1`;
  const params = [];
  if (period_start) { query += ' AND p.period_start >= ?'; params.push(period_start); }
  if (period_end) { query += ' AND p.period_end <= ?'; params.push(period_end); }
  query += ' ORDER BY e.name';
  const data = db.prepare(query).all(...params);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Payroll Report');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=payroll_report.xlsx');
  res.send(buffer);
});

module.exports = router;
