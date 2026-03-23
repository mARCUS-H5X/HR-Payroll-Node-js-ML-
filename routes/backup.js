const express = require('express');
const router = express.Router();

// Download full backup
router.get('/download', (req, res) => {
  const db = req.app.locals.db;
  const backup = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    data: {
      companies: db.prepare('SELECT * FROM companies').all(),
      branches: db.prepare('SELECT * FROM branches').all(),
      departments: db.prepare('SELECT * FROM departments').all(),
      employees: db.prepare('SELECT * FROM employees').all(),
      attendance: db.prepare('SELECT * FROM attendance').all(),
      salary_rules: db.prepare('SELECT * FROM salary_rules').all(),
      salary_rule_allowances: db.prepare('SELECT * FROM salary_rule_allowances').all(),
      payments: db.prepare('SELECT * FROM payments').all(),
      payroll: db.prepare('SELECT * FROM payroll').all(),
      audit_log: db.prepare('SELECT * FROM audit_log').all(),
      alerts: db.prepare('SELECT * FROM alerts').all()
    }
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=sai_desigine_backup_${new Date().toISOString().split('T')[0]}.json`);
  res.json(backup);
});

// Restore from backup
router.post('/restore', (req, res) => {
  const db = req.app.locals.db;
  const backup = req.body;
  if (!backup || !backup.data) return res.status(400).json({ error: 'Invalid backup file' });

  try {
    const transaction = db.transaction(() => {
      // Clear existing data
      db.prepare('DELETE FROM alerts').run();
      db.prepare('DELETE FROM audit_log').run();
      db.prepare('DELETE FROM payroll').run();
      db.prepare('DELETE FROM payments').run();
      db.prepare('DELETE FROM attendance').run();
      db.prepare('DELETE FROM salary_rule_allowances').run();
      db.prepare('DELETE FROM salary_rules').run();
      db.prepare('DELETE FROM employees').run();
      db.prepare('DELETE FROM departments').run();
      db.prepare('DELETE FROM branches').run();
      db.prepare('DELETE FROM companies').run();

      // Restore data
      const tables = ['companies', 'branches', 'departments', 'employees', 'attendance', 'salary_rules', 'salary_rule_allowances', 'payments', 'payroll', 'audit_log', 'alerts'];
      for (const table of tables) {
        if (backup.data[table] && backup.data[table].length > 0) {
          const cols = Object.keys(backup.data[table][0]);
          const placeholders = cols.map(() => '?').join(', ');
          const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`);
          for (const row of backup.data[table]) {
            stmt.run(...cols.map(c => row[c]));
          }
        }
      }
    });
    transaction();
    res.json({ success: true, message: 'Backup restored successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to restore backup: ' + e.message });
  }
});

module.exports = router;
