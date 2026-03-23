const initSQL = `
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      UNIQUE(name, company_id)
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      UNIQUE(name, company_id)
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_code TEXT UNIQUE,
      name TEXT NOT NULL,
      company_id INTEGER,
      branch_id INTEGER,
      department_id INTEGER,
      designation TEXT,
      phone TEXT,
      email TEXT,
      base_salary REAL DEFAULT 0,
      salary_type TEXT DEFAULT 'monthly',
      join_date TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
      FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      total_hours REAL DEFAULT 0,
      status TEXT DEFAULT 'present',
      punch_records TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS salary_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      name TEXT NOT NULL,
      working_hours_per_day REAL DEFAULT 8,
      working_days_per_month INTEGER DEFAULT 26,
      overtime_rate REAL DEFAULT 1.5,
      overtime_after_hours REAL DEFAULT 8,
      half_day_late_after_minutes INTEGER DEFAULT 30,
      half_day_early_leave_minutes INTEGER DEFAULT 60,
      late_arrival_time TEXT DEFAULT '09:30',
      early_leave_time TEXT DEFAULT '17:00',
      casual_leaves INTEGER DEFAULT 1,
      sick_leaves INTEGER DEFAULT 1,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS salary_rule_allowances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'allowance',
      amount REAL DEFAULT 0,
      is_percentage INTEGER DEFAULT 0,
      FOREIGN KEY (rule_id) REFERENCES salary_rules(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL DEFAULT 'salary',
      payment_date TEXT NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      period_start TEXT,
      period_end TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      working_days INTEGER DEFAULT 0,
      present_days REAL DEFAULT 0,
      absent_days REAL DEFAULT 0,
      half_days INTEGER DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      base_salary REAL DEFAULT 0,
      overtime_pay REAL DEFAULT 0,
      total_allowances REAL DEFAULT 0,
      total_deductions REAL DEFAULT 0,
      gross_salary REAL DEFAULT 0,
      net_salary REAL DEFAULT 0,
      advances_paid REAL DEFAULT 0,
      salary_already_paid REAL DEFAULT 0,
      final_payable REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      paid_amount REAL DEFAULT 0,
      paid_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analytics_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attendance_weight REAL DEFAULT 50,
      late_penalty REAL DEFAULT -15,
      overtime_bonus REAL DEFAULT 20,
      half_day_penalty REAL DEFAULT -5,
      absent_penalty REAL DEFAULT -20,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
`;

const seedSQL = `
  INSERT INTO salary_rules (name, working_hours_per_day, working_days_per_month, overtime_rate, overtime_after_hours, half_day_late_after_minutes, half_day_early_leave_minutes, late_arrival_time, early_leave_time, casual_leaves, sick_leaves, is_default)
  VALUES ('Default Rules', 8, 26, 1.5, 8, 30, 60, '09:30', '17:00', 1, 1, 1);

  INSERT INTO analytics_settings (attendance_weight, late_penalty, overtime_bonus, half_day_penalty, absent_penalty)
  VALUES (50, -15, 20, -5, -20);
`;

module.exports = { initSQL, seedSQL };
