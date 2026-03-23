const express = require('express');
const router = express.Router();

// Get audit log
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const { entity_type, action, limit } = req.query;
  let query = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];
  if (entity_type) { query += ' AND entity_type = ?'; params.push(entity_type); }
  if (action) { query += ' AND action = ?'; params.push(action); }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit) || 100);
  res.json(db.prepare(query).all(...params));
});

module.exports = router;
