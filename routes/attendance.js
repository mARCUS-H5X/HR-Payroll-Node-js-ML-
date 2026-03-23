const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

function logAudit(db, entityType, entityId, action, oldValue, newValue, description) {
  try {
    db.prepare('INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, description) VALUES (?, ?, ?, ?, ?, ?)').run(entityType, entityId, action, oldValue, newValue, description);
  } catch (e) { /* silent */ }
}

// Get attendance records
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const { employee_id, date, start_date, end_date, company_id, branch_id, department_id } = req.query;
  let query = `SELECT a.*, e.name as employee_name, e.emp_code, c.name as company_name, b.name as branch_name, d.name as department_name
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    LEFT JOIN companies c ON e.company_id = c.id
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN departments d ON e.department_id = d.id WHERE 1=1`;
  const params = [];
  if (employee_id) { query += ' AND a.employee_id = ?'; params.push(employee_id); }
  if (date) { query += ' AND a.date = ?'; params.push(date); }
  if (start_date) { query += ' AND a.date >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND a.date <= ?'; params.push(end_date); }
  if (company_id) { query += ' AND e.company_id = ?'; params.push(company_id); }
  if (branch_id) { query += ' AND e.branch_id = ?'; params.push(branch_id); }
  if (department_id) { query += ' AND e.department_id = ?'; params.push(department_id); }
  query += ' ORDER BY a.date DESC, e.name';
  res.json(db.prepare(query).all(...params));
});

// Upload & import attendance Excel
router.post('/import', upload.single('file'), (req, res) => {
  const db = req.app.locals.db;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rawData.length < 2) return res.status(400).json({ error: 'File appears to be empty' });

    const headers = rawData[0].map(h => String(h).trim().toLowerCase());
    const results = { imported: 0, errors: [], newEmployees: [] };

    // Try to detect format: look for ID/No, Name columns, and date columns
    let idCol = headers.findIndex(h => h === 'id' || h === 'no' || h === 'no.' || h === 'emp id' || h === 'employee id' || h === 'emp_code' || h === 'empid');
    let nameCol = headers.findIndex(h => h === 'name' || h === 'employee name' || h === 'emp name' || h === 'employee');

    if (idCol === -1) idCol = 0;
    if (nameCol === -1) nameCol = 1;

    // Find date columns (everything after name is a date or punch column)
    const dateColumns = [];
    for (let i = 0; i < headers.length; i++) {
      if (i === idCol || i === nameCol) continue;
      const h = headers[i];
      // Check if it looks like a date
      if (h && (h.match(/\d{1,2}[\/-]\d{1,2}/) || h.match(/\d{4}/) || h.match(/^\d+$/) || h.match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i))) {
        dateColumns.push({ index: i, header: headers[i] });
      } else if (i > nameCol) {
        dateColumns.push({ index: i, header: headers[i] || `col_${i}` });
      }
    }

    const insertAttendance = db.prepare(`INSERT OR REPLACE INTO attendance (employee_id, date, check_in, check_out, total_hours, status, punch_records) VALUES (?, ?, ?, ?, ?, ?, ?)`);

    const transaction = db.transaction(() => {
      for (let r = 1; r < rawData.length; r++) {
        const row = rawData[r];
        const empCode = String(row[idCol] || '').trim();
        const empName = String(row[nameCol] || '').trim();

        if (!empName && !empCode) continue;

        // Find or create employee
        let employee = null;
        if (empCode) {
          employee = db.prepare('SELECT * FROM employees WHERE emp_code = ?').get(empCode);
        }
        if (!employee && empName) {
          employee = db.prepare('SELECT * FROM employees WHERE name = ?').get(empName);
        }
        if (!employee) {
          const insertResult = db.prepare('INSERT INTO employees (emp_code, name) VALUES (?, ?)').run(empCode || null, empName);
          employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(insertResult.lastInsertRowid);
          results.newEmployees.push({ id: employee.id, name: empName, emp_code: empCode });
        }

        // Process each date column
        for (const dc of dateColumns) {
          const cellValue = String(row[dc.index] || '').trim();
          if (!cellValue) continue;

          // Try to parse the date from column header
          let dateStr = parseDate(dc.header);
          if (!dateStr) {
            // Try to extract date from the header
            const match = dc.header.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{2,4})?/);
            if (match) {
              const day = match[1].padStart(2, '0');
              const month = match[2].padStart(2, '0');
              const year = match[3] || new Date().getFullYear();
              dateStr = `${year.length === 2 ? '20' + year : year}-${month}-${day}`;
            }
          }
          if (!dateStr) {
            // Use column index as day number if all else fails, with current month
            const dayNum = parseInt(dc.header);
            if (dayNum >= 1 && dayNum <= 31) {
              const now = new Date();
              dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            }
          }
          if (!dateStr) continue;

          // Parse punch times from cell value
          const punches = cellValue.split(/[,;\n\r]+/).map(p => p.trim()).filter(p => p && p.match(/\d{1,2}:\d{2}/));

          if (punches.length === 0) {
            // Check for status keywords
            const lower = cellValue.toLowerCase();
            if (lower.includes('absent') || lower === 'a' || lower === 'ab') {
              insertAttendance.run(employee.id, dateStr, null, null, 0, 'absent', cellValue);
            } else if (lower.includes('leave') || lower === 'l') {
              insertAttendance.run(employee.id, dateStr, null, null, 0, 'leave', cellValue);
            } else if (lower.includes('holiday') || lower === 'h') {
              insertAttendance.run(employee.id, dateStr, null, null, 0, 'holiday', cellValue);
            }
            results.imported++;
            continue;
          }

          // Sort punches and take first as check-in, last as check-out
          punches.sort();
          const checkIn = punches[0];
          const checkOut = punches.length > 1 ? punches[punches.length - 1] : null;

          let totalHours = 0;
          if (checkIn && checkOut) {
            const [h1, m1] = checkIn.split(':').map(Number);
            const [h2, m2] = checkOut.split(':').map(Number);
            totalHours = Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60);
          }

          const status = totalHours > 0 ? 'present' : 'absent';
          insertAttendance.run(employee.id, dateStr, checkIn, checkOut, Math.round(totalHours * 100) / 100, status, JSON.stringify(punches));
          results.imported++;
        }
      }
    });

    transaction();

    // Clean up uploaded file
    try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }

    logAudit(db, 'attendance', null, 'import', null, JSON.stringify({ imported: results.imported, newEmployees: results.newEmployees.length }), `Imported ${results.imported} attendance records`);
    res.json(results);
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch (e2) { /* ignore */ }
    res.status(500).json({ error: 'Failed to process file: ' + e.message });
  }
});

// Add/update single attendance record
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { employee_id, date, check_in, check_out, status, notes } = req.body;
  if (!employee_id || !date) return res.status(400).json({ error: 'Employee and date are required' });

  let totalHours = 0;
  if (check_in && check_out) {
    const [h1, m1] = check_in.split(':').map(Number);
    const [h2, m2] = check_out.split(':').map(Number);
    totalHours = Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60);
  }

  const existing = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(employee_id, date);
  if (existing) {
    const old = JSON.stringify(existing);
    db.prepare('UPDATE attendance SET check_in=?, check_out=?, total_hours=?, status=?, notes=?, updated_at=datetime("now") WHERE id=?')
      .run(check_in || null, check_out || null, Math.round(totalHours * 100) / 100, status || 'present', notes || null, existing.id);
    const updated = db.prepare('SELECT * FROM attendance WHERE id = ?').get(existing.id);
    logAudit(db, 'attendance', existing.id, 'update', old, JSON.stringify(updated), `Edited attendance for employee ${employee_id} on ${date}`);
    res.json(updated);
  } else {
    const result = db.prepare('INSERT INTO attendance (employee_id, date, check_in, check_out, total_hours, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(employee_id, date, check_in || null, check_out || null, Math.round(totalHours * 100) / 100, status || 'present', notes || null);
    const record = db.prepare('SELECT * FROM attendance WHERE id = ?').get(result.lastInsertRowid);
    logAudit(db, 'attendance', record.id, 'create', null, JSON.stringify(record), `Added attendance for employee ${employee_id} on ${date}`);
    res.status(201).json(record);
  }
});

// Delete attendance
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  const old = db.prepare('SELECT * FROM attendance WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Record not found' });
  db.prepare('DELETE FROM attendance WHERE id = ?').run(req.params.id);
  logAudit(db, 'attendance', old.id, 'delete', JSON.stringify(old), null, 'Deleted attendance record');
  res.json({ success: true });
});

function parseDate(str) {
  if (!str) return null;
  str = String(str).trim();
  // Try ISO format
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
  // Try DD/MM/YYYY
  const m1 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
  // Try MM/DD/YYYY
  const m2 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (m2) return `20${m2[3]}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`;
  return null;
}

module.exports = router;
