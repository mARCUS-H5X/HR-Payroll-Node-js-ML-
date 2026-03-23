const express = require('express');
const router = express.Router();

function logAudit(db, entityType, entityId, action, oldValue, newValue, description) {
  try {
    db.prepare('INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, description) VALUES (?, ?, ?, ?, ?, ?)').run(entityType, entityId, action, oldValue, newValue, description);
  } catch (e) { /* silent */ }
}

// Get all employees
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const { company_id, branch_id, department_id, status } = req.query;
  let query = `SELECT e.*, c.name as company_name, b.name as branch_name, d.name as department_name
    FROM employees e
    LEFT JOIN companies c ON e.company_id = c.id
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN departments d ON e.department_id = d.id WHERE 1=1`;
  const params = [];
  if (company_id) { query += ' AND e.company_id = ?'; params.push(company_id); }
  if (branch_id) { query += ' AND e.branch_id = ?'; params.push(branch_id); }
  if (department_id) { query += ' AND e.department_id = ?'; params.push(department_id); }
  if (status) { query += ' AND e.status = ?'; params.push(status); }
  query += ' ORDER BY e.name';
  res.json(db.prepare(query).all(...params));
});

// Get single employee
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const emp = db.prepare(`SELECT e.*, c.name as company_name, b.name as branch_name, d.name as department_name
    FROM employees e
    LEFT JOIN companies c ON e.company_id = c.id
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE e.id = ?`).get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  res.json(emp);
});

// Create employee
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { emp_code, name, company_id, branch_id, department_id, designation, phone, email, base_salary, salary_type, join_date } = req.body;
  if (!name) return res.status(400).json({ error: 'Employee name is required' });
  try {
    const result = db.prepare(`INSERT INTO employees (emp_code, name, company_id, branch_id, department_id, designation, phone, email, base_salary, salary_type, join_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      emp_code || null, name.trim(), company_id || null, branch_id || null, department_id || null,
      designation || null, phone || null, email || null, base_salary || 0, salary_type || 'monthly', join_date || null
    );
    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
    logAudit(db, 'employee', emp.id, 'create', null, JSON.stringify(emp), `Added employee: ${name}`);
    res.status(201).json(emp);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Employee code already exists' });
    res.status(500).json({ error: e.message });
  }
});

// Update employee
router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const old = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Employee not found' });
  const { emp_code, name, company_id, branch_id, department_id, designation, phone, email, base_salary, salary_type, join_date, status } = req.body;
  db.prepare(`UPDATE employees SET emp_code=?, name=?, company_id=?, branch_id=?, department_id=?, designation=?, phone=?, email=?, base_salary=?, salary_type=?, join_date=?, status=?, updated_at=datetime('now') WHERE id=?`).run(
    emp_code || old.emp_code, name || old.name, company_id !== undefined ? company_id : old.company_id,
    branch_id !== undefined ? branch_id : old.branch_id, department_id !== undefined ? department_id : old.department_id,
    designation || old.designation, phone || old.phone, email || old.email,
    base_salary !== undefined ? base_salary : old.base_salary, salary_type || old.salary_type,
    join_date || old.join_date, status || old.status, req.params.id
  );
  const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  logAudit(db, 'employee', updated.id, 'update', JSON.stringify(old), JSON.stringify(updated), `Updated employee: ${updated.name}`);
  res.json(updated);
});

// Delete employee
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  const old = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Employee not found' });
  db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  logAudit(db, 'employee', old.id, 'delete', JSON.stringify(old), null, `Deleted employee: ${old.name}`);
  res.json({ success: true });
});

module.exports = router;
