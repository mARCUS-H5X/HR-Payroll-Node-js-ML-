/* Help Page */
Pages.help = function(container) {
  container.innerHTML = `
    <div class="card mb-2">
      <div style="text-align:center;padding:1.5rem 0">
        <div class="logo-icon" style="width:64px;height:64px;font-size:1.8rem;margin:0 auto 1rem;border-radius:16px">
          <i class="fas fa-cube"></i>
        </div>
        <h1 style="font-size:1.8rem;font-weight:800">
          <span style="background:linear-gradient(135deg,var(--primary-light),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">SAI Payroll</span>
        </h1>
        <p class="text-muted" style="font-size:1rem;margin-top:0.25rem">Professional Payroll Management System</p>
        <p class="text-muted" style="font-size:0.85rem">Version 1.0.0</p>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="help-section">
          <h3><i class="fas fa-rocket" style="margin-right:0.5rem"></i>Getting Started</h3>
          <ol class="help-steps">
            <li><strong>Set Up Your Organization</strong> — Go to <strong>Settings</strong> and create your companies, branches, and departments. These are fully customizable — add as many as you need.</li>
            <li><strong>Add Employees</strong> — Go to <strong>Employees</strong> and add your workforce. Assign them to companies, branches, and departments. Set their base salary.</li>
            <li><strong>Configure Salary Rules</strong> — Go to <strong>Settings → Salary Rules</strong> and set working hours, overtime rates, half-day rules, and any custom allowances or deductions.</li>
            <li><strong>Import Attendance</strong> — Go to <strong>Attendance</strong> and click <strong>Import Excel</strong>. Upload your Hikvision punch data. The system will auto-detect punch times and create attendance records.</li>
            <li><strong>Run Payroll</strong> — Go to <strong>Payroll</strong>, select the pay period, and click <strong>Calculate Payroll</strong>. View the full breakdown, then mark each employee as paid.</li>
          </ol>
        </div>
      </div>

      <div class="card">
        <div class="help-section">
          <h3><i class="fas fa-file-excel" style="margin-right:0.5rem"></i>How to Upload Attendance</h3>
          <ol class="help-steps">
            <li>Export your attendance data from the Hikvision system (or any biometric device) as an Excel file (.xlsx or .xls).</li>
            <li>The file should have columns like: <strong>ID/No</strong> (employee code), <strong>Name</strong>, and then date columns with punch times.</li>
            <li>Each date column can have multiple punch times separated by commas (e.g., "09:05, 13:30, 14:00, 18:15").</li>
            <li>The system will automatically pick the <strong>first punch as check-in</strong> and the <strong>last punch as check-out</strong>.</li>
            <li>If an employee in the file doesn't exist in the system, they will be <strong>auto-added</strong> as a new employee.</li>
            <li>Go to <strong>Attendance</strong> → click <strong>Import Excel</strong> → drag and drop your file or click to browse.</li>
          </ol>
        </div>

        <div class="help-section">
          <h3><i class="fas fa-calculator" style="margin-right:0.5rem"></i>How Salary is Calculated</h3>
          <ol class="help-steps">
            <li><strong>Daily Rate</strong> = Base Monthly Salary ÷ Working Days per Month</li>
            <li><strong>Base Pay</strong> = Daily Rate × Present Days (half-days count as 0.5)</li>
            <li><strong>Overtime Pay</strong> = Hourly Rate × OT Rate × Overtime Hours</li>
            <li><strong>Gross Salary</strong> = Base Pay + Overtime Pay + Allowances</li>
            <li><strong>Net Salary</strong> = Gross Salary - Deductions</li>
            <li><strong>Final Payable</strong> = Net Salary - Advances Already Paid - Early Salary Paid</li>
          </ol>
        </div>
      </div>
    </div>

    <div class="grid grid-2 mt-2">
      <div class="card">
        <div class="help-section">
          <h3><i class="fas fa-money-bill-wave" style="margin-right:0.5rem"></i>Payments Guide</h3>
          <ol class="help-steps">
            <li><strong>Advance</strong> — Extra money given to an employee outside of their regular salary. This is automatically deducted from the final payroll calculation.</li>
            <li><strong>Early Salary</strong> — Paying part or all of the salary before the regular payday. Also automatically adjusted in payroll.</li>
            <li>Go to <strong>Payroll → Payments</strong> tab to record any advance or early salary payment.</li>
            <li>When you run payroll, all advances and early payments are automatically deducted to give the correct <strong>Final Payable</strong> amount.</li>
          </ol>
        </div>
      </div>

      <div class="card">
        <div class="help-section">
          <h3><i class="fas fa-cog" style="margin-right:0.5rem"></i>Salary Rules Explained</h3>
          <ol class="help-steps">
            <li><strong>Working Hours/Day</strong> — Standard work hours (e.g., 8). Any hours above this count as overtime.</li>
            <li><strong>Working Days/Month</strong> — Number of paid working days in a month (e.g., 26).</li>
            <li><strong>Late Arrival Time</strong> — The latest time an employee can arrive without penalty (e.g., 09:30).</li>
            <li><strong>Half-Day Rule</strong> — If an employee is late by more than X minutes past the late time, they're marked as half-day.</li>
            <li><strong>Overtime Rate</strong> — Multiplier for overtime pay (e.g., 1.5x means 150% of normal hourly rate).</li>
            <li><strong>Custom Allowances/Deductions</strong> — Add HRA, TA, PF, ESI, or any custom item. Can be a fixed amount or a percentage of base salary.</li>
          </ol>
        </div>
      </div>
    </div>

    <div class="card mt-2">
      <div class="help-section">
        <h3><i class="fas fa-shield-alt" style="margin-right:0.5rem"></i>Backup & Data Safety</h3>
        <ol class="help-steps">
          <li>Go to <strong>Reports</strong> page to download a full backup of all your data as a JSON file.</li>
          <li>Store this backup file in a safe location (USB drive, cloud storage, etc.).</li>
          <li>To restore, upload the backup file on the Reports page. <strong>Warning:</strong> This replaces all current data.</li>
          <li>We recommend taking backups regularly — especially before running monthly payroll.</li>
        </ol>
      </div>
    </div>

    <div class="card mt-2" style="text-align:center;padding:2rem">
      <p class="text-muted">Built with ❤️ by SAI Payroll Team</p>
      <p class="text-muted" style="font-size:0.8rem;margin-top:0.5rem">For support or feedback, reach out to your system administrator.</p>
    </div>
  `;
};
