const express = require('express');
const router = express.Router();

// ==================== COMPANIES ====================

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const companies = db.prepare('SELECT * FROM companies ORDER BY name').all();
  res.json(companies);
});

router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Company name is required' });
  try {
    const result = db.prepare('INSERT INTO companies (name) VALUES (?)').run(name.trim());
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid);
    logAudit(db, 'company', company.id, 'create', null, JSON.stringify(company), `Created company: ${name}`);
    res.status(201).json(company);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Company already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { name } = req.body;
  const old = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Company not found' });
  db.prepare('UPDATE companies SET name = ?, updated_at = datetime("now") WHERE id = ?').run(name.trim(), req.params.id);
  const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  logAudit(db, 'company', updated.id, 'update', JSON.stringify(old), JSON.stringify(updated), `Updated company: ${old.name} → ${name}`);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  const old = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Company not found' });
  db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
  logAudit(db, 'company', old.id, 'delete', JSON.stringify(old), null, `Deleted company: ${old.name}`);
  res.json({ success: true });
});

// ==================== BRANCHES ====================

router.get('/branches', (req, res) => {
  const db = req.app.locals.db;
  const { company_id } = req.query;
  let query = 'SELECT b.*, c.name as company_name FROM branches b LEFT JOIN companies c ON b.company_id = c.id';
  const params = [];
  if (company_id) { query += ' WHERE b.company_id = ?'; params.push(company_id); }
  query += ' ORDER BY b.name';
  res.json(db.prepare(query).all(...params));
});

router.post('/branches', (req, res) => {
  const db = req.app.locals.db;
  const { name, company_id } = req.body;
  if (!name || !company_id) return res.status(400).json({ error: 'Branch name and company are required' });
  try {
    const result = db.prepare('INSERT INTO branches (name, company_id) VALUES (?, ?)').run(name.trim(), company_id);
    const branch = db.prepare('SELECT b.*, c.name as company_name FROM branches b LEFT JOIN companies c ON b.company_id = c.id WHERE b.id = ?').get(result.lastInsertRowid);
    logAudit(db, 'branch', branch.id, 'create', null, JSON.stringify(branch), `Created branch: ${name}`);
    res.status(201).json(branch);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Branch already exists for this company' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/branches/:id', (req, res) => {
  const db = req.app.locals.db;
  const { name, company_id } = req.body;
  const old = db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Branch not found' });
  db.prepare('UPDATE branches SET name = ?, company_id = ?, updated_at = datetime("now") WHERE id = ?').run(name.trim(), company_id, req.params.id);
  const updated = db.prepare('SELECT b.*, c.name as company_name FROM branches b LEFT JOIN companies c ON b.company_id = c.id WHERE b.id = ?').get(req.params.id);
  logAudit(db, 'branch', updated.id, 'update', JSON.stringify(old), JSON.stringify(updated), `Updated branch: ${old.name} → ${name}`);
  res.json(updated);
});

router.delete('/branches/:id', (req, res) => {
  const db = req.app.locals.db;
  const old = db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Branch not found' });
  db.prepare('DELETE FROM branches WHERE id = ?').run(req.params.id);
  logAudit(db, 'branch', old.id, 'delete', JSON.stringify(old), null, `Deleted branch: ${old.name}`);
  res.json({ success: true });
});

// ==================== DEPARTMENTS ====================

router.get('/departments', (req, res) => {
  const db = req.app.locals.db;
  const { company_id } = req.query;
  let query = 'SELECT d.*, c.name as company_name FROM departments d LEFT JOIN companies c ON d.company_id = c.id';
  const params = [];
  if (company_id) { query += ' WHERE d.company_id = ?'; params.push(company_id); }
  query += ' ORDER BY d.name';
  res.json(db.prepare(query).all(...params));
});

router.post('/departments', (req, res) => {
  const db = req.app.locals.db;
  const { name, company_id } = req.body;
  if (!name || !company_id) return res.status(400).json({ error: 'Department name and company are required' });
  try {
    const result = db.prepare('INSERT INTO departments (name, company_id) VALUES (?, ?)').run(name.trim(), company_id);
    const dept = db.prepare('SELECT d.*, c.name as company_name FROM departments d LEFT JOIN companies c ON d.company_id = c.id WHERE d.id = ?').get(result.lastInsertRowid);
    logAudit(db, 'department', dept.id, 'create', null, JSON.stringify(dept), `Created department: ${name}`);
    res.status(201).json(dept);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Department already exists for this company' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/departments/:id', (req, res) => {
  const db = req.app.locals.db;
  const { name, company_id } = req.body;
  const old = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Department not found' });
  db.prepare('UPDATE departments SET name = ?, company_id = ?, updated_at = datetime("now") WHERE id = ?').run(name.trim(), company_id, req.params.id);
  const updated = db.prepare('SELECT d.*, c.name as company_name FROM departments d LEFT JOIN companies c ON d.company_id = c.id WHERE d.id = ?').get(req.params.id);
  logAudit(db, 'department', updated.id, 'update', JSON.stringify(old), JSON.stringify(updated), `Updated department: ${old.name} → ${name}`);
  res.json(updated);
});

router.delete('/departments/:id', (req, res) => {
  const db = req.app.locals.db;
  const old = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Department not found' });
  db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
  logAudit(db, 'department', old.id, 'delete', JSON.stringify(old), null, `Deleted department: ${old.name}`);
  res.json({ success: true });
});

function logAudit(db, entityType, entityId, action, oldValue, newValue, description) {
  try {
    db.prepare('INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, description) VALUES (?, ?, ?, ?, ?, ?)').run(entityType, entityId, action, oldValue, newValue, description);
  } catch (e) { /* silent */ }
}

module.exports = router;
