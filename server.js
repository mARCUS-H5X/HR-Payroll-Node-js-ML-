const express = require('express');
const path = require('path');
const { initializeDatabase } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

async function start() {
  // Initialize database
  const db = await initializeDatabase();
  app.locals.db = db;

  // Post-mutation save middleware
  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        try { db.save(); } catch(e) { /* ignore */ }
      }
      return originalJson(data);
    };
    next();
  });

  // API Routes
  app.use('/api/companies', require('./routes/companies'));
  app.use('/api/employees', require('./routes/employees'));
  app.use('/api/attendance', require('./routes/attendance'));
  app.use('/api/salary', require('./routes/salary'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/analytics', require('./routes/analytics'));
  app.use('/api/reports', require('./routes/reports'));
  app.use('/api/backup', require('./routes/backup'));
  app.use('/api/audit', require('./routes/audit'));

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    db.close();
    process.exit(0);
  });

  app.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════════╗
  ║         SAI Payroll                      ║
  ║    http://localhost:${PORT}                  ║
  ║    Press Ctrl+C to stop                  ║
  ╚══════════════════════════════════════════╝
    `);
  });
}

start().catch(e => {
  console.error('Failed to start:', e);
  process.exit(1);
});
