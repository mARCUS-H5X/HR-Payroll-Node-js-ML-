/* Reports Page */
Pages.reports = async function(container) {
  const today = new Date();
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = today.toISOString().split('T')[0];

  container.innerHTML = `
    <div class="section-header"><h2>Reports & Export</h2></div>
    <div class="grid grid-3">
      <div class="card" style="cursor:pointer" id="attendanceReportCard">
        <div style="text-align:center;padding:1.5rem 0">
          <div class="stat-icon green" style="margin:0 auto 1rem;width:56px;height:56px;font-size:1.4rem"><i class="fas fa-calendar-check"></i></div>
          <h3>Attendance Report</h3>
          <p class="text-muted" style="font-size:0.85rem;margin-top:0.5rem">Download attendance data as Excel</p>
        </div>
      </div>
      <div class="card" style="cursor:pointer" id="payrollReportCard">
        <div style="text-align:center;padding:1.5rem 0">
          <div class="stat-icon blue" style="margin:0 auto 1rem;width:56px;height:56px;font-size:1.4rem"><i class="fas fa-money-bill-wave"></i></div>
          <h3>Payroll Report</h3>
          <p class="text-muted" style="font-size:0.85rem;margin-top:0.5rem">Download payroll summary as Excel</p>
        </div>
      </div>
      <div class="card" style="cursor:pointer" id="backupCard">
        <div style="text-align:center;padding:1.5rem 0">
          <div class="stat-icon purple" style="margin:0 auto 1rem;width:56px;height:56px;font-size:1.4rem"><i class="fas fa-database"></i></div>
          <h3>Full Backup</h3>
          <p class="text-muted" style="font-size:0.85rem;margin-top:0.5rem">Download all data as JSON backup</p>
        </div>
      </div>
    </div>

    <div class="card mt-2">
      <div class="card-header"><h3>Download Options</h3></div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Start Date</label>
          <input type="date" class="form-control" id="reportStart" value="${monthStart}">
        </div>
        <div class="form-group">
          <label class="form-label">End Date</label>
          <input type="date" class="form-control" id="reportEnd" value="${monthEnd}">
        </div>
        <div class="form-group">
          <label class="form-label">Company</label>
          <select class="form-control" id="reportCompany"><option value="">All Companies</option></select>
        </div>
      </div>
      <div class="btn-group mt-1">
        <button class="btn btn-success" id="dlAttendance"><i class="fas fa-file-excel"></i> Download Attendance</button>
        <button class="btn btn-primary" id="dlPayroll"><i class="fas fa-file-excel"></i> Download Payroll</button>
        <button class="btn btn-warning" id="dlBackup"><i class="fas fa-download"></i> Download Backup</button>
      </div>
    </div>

    <div class="card mt-2">
      <div class="card-header"><h3><i class="fas fa-upload" style="margin-right:0.5rem;color:var(--accent)"></i>Restore from Backup</h3></div>
      <div class="file-drop" id="restoreDrop">
        <i class="fas fa-cloud-upload-alt"></i>
        <h4>Upload Backup File</h4>
        <p>Select a SAI Payroll backup JSON file to restore all data</p>
        <input type="file" id="restoreInput" accept=".json" style="display:none">
      </div>
    </div>

    <div class="card mt-2">
      <div class="card-header"><h3><i class="fas fa-history" style="margin-right:0.5rem;color:var(--info)"></i>Audit Log</h3></div>
      <div class="filter-bar" style="background:transparent;border:none;padding:0;margin-bottom:0.75rem">
        <label>Type</label>
        <select class="form-control" id="auditType">
          <option value="">All</option>
          <option value="employee">Employee</option>
          <option value="attendance">Attendance</option>
          <option value="payment">Payment</option>
          <option value="payroll">Payroll</option>
          <option value="salary_rule">Salary Rule</option>
          <option value="company">Company</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="loadAuditBtn"><i class="fas fa-search"></i> Load</button>
      </div>
      <div id="auditLogContent"><p class="text-muted">Click Load to view audit log</p></div>
    </div>
  `;

  // Load companies
  const companies = await App.getCompanies();
  const sel = document.getElementById('reportCompany');
  companies.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });

  // Download handlers
  document.getElementById('attendanceReportCard').addEventListener('click', () => downloadAttendance());
  document.getElementById('dlAttendance').addEventListener('click', () => downloadAttendance());

  document.getElementById('payrollReportCard').addEventListener('click', () => downloadPayroll());
  document.getElementById('dlPayroll').addEventListener('click', () => downloadPayroll());

  document.getElementById('backupCard').addEventListener('click', () => downloadBackup());
  document.getElementById('dlBackup').addEventListener('click', () => downloadBackup());

  function downloadAttendance() {
    const s = document.getElementById('reportStart').value;
    const e = document.getElementById('reportEnd').value;
    const c = document.getElementById('reportCompany').value;
    let url = `/api/reports/attendance?start_date=${s}&end_date=${e}`;
    if (c) url += `&company_id=${c}`;
    window.open(url, '_blank');
    App.toast('Attendance report downloading...', 'info');
  }

  function downloadPayroll() {
    const s = document.getElementById('reportStart').value;
    const e = document.getElementById('reportEnd').value;
    let url = `/api/reports/payroll?period_start=${s}&period_end=${e}`;
    window.open(url, '_blank');
    App.toast('Payroll report downloading...', 'info');
  }

  function downloadBackup() {
    window.open('/api/backup/download', '_blank');
    App.toast('Backup downloading...', 'info');
  }

  // Restore
  const restoreDrop = document.getElementById('restoreDrop');
  const restoreInput = document.getElementById('restoreInput');
  restoreDrop.addEventListener('click', () => restoreInput.click());
  restoreDrop.addEventListener('dragover', (e) => { e.preventDefault(); restoreDrop.classList.add('dragover'); });
  restoreDrop.addEventListener('dragleave', () => restoreDrop.classList.remove('dragover'));
  restoreDrop.addEventListener('drop', (e) => { e.preventDefault(); restoreDrop.classList.remove('dragover'); if (e.dataTransfer.files.length) restoreBackup(e.dataTransfer.files[0]); });
  restoreInput.addEventListener('change', () => { if (restoreInput.files.length) restoreBackup(restoreInput.files[0]); });

  async function restoreBackup(file) {
    if (!confirm('⚠️ This will REPLACE ALL existing data with the backup. Are you sure?')) return;
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      await App.api('/backup/restore', { method: 'POST', body: backup });
      App.toast('Backup restored successfully!', 'success');
      App.clearCache();
    } catch (e) {
      App.toast('Failed to restore: ' + e.message, 'error');
    }
  }

  // Audit log
  document.getElementById('loadAuditBtn').addEventListener('click', async () => {
    const type = document.getElementById('auditType').value;
    let url = '/audit?limit=50';
    if (type) url += `&entity_type=${type}`;
    const logs = await App.api(url);
    const div = document.getElementById('auditLogContent');
    if (!logs || logs.length === 0) {
      div.innerHTML = '<p class="text-muted">No audit records found</p>';
      return;
    }
    div.innerHTML = logs.map(l => `
      <div class="audit-item">
        <span class="audit-dot ${l.action}"></span>
        <span class="audit-desc">${l.description || `${l.action} ${l.entity_type} #${l.entity_id}`}</span>
        <span class="audit-time">${App.formatDateTime(l.created_at)}</span>
      </div>
    `).join('');
  });
};
