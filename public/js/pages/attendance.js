/* Attendance Page */
Pages.attendance = async function(container) {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.substring(0, 8) + '01';

  container.innerHTML = `
    <div class="section-header">
      <h2>Attendance Management</h2>
      <div class="btn-group">
        <button class="btn btn-primary" id="importAttBtn"><i class="fas fa-file-import"></i> Import Excel</button>
        <button class="btn btn-success" id="addAttBtn"><i class="fas fa-plus"></i> Add Entry</button>
      </div>
    </div>

    <div class="filter-bar">
      <label>From</label>
      <input type="date" class="form-control" id="attStartDate" value="${monthStart}">
      <label>To</label>
      <input type="date" class="form-control" id="attEndDate" value="${today}">
      ${await App.buildOrgFilters('att')}
      <button class="btn btn-secondary btn-sm" id="attFilterBtn"><i class="fas fa-filter"></i> Filter</button>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Employee</th><th>Code</th><th>Check In</th><th>Check Out</th>
            <th>Hours</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="attTableBody">
          <tr><td colspan="8" class="text-center text-muted" style="padding:2rem">Loading...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('importAttBtn').addEventListener('click', showImportModal);
  document.getElementById('addAttBtn').addEventListener('click', () => showAttendanceForm());
  document.getElementById('attFilterBtn').addEventListener('click', loadAttendance);
  App.bindOrgFilters('att');

  async function loadAttendance() {
    const startDate = document.getElementById('attStartDate').value;
    const endDate = document.getElementById('attEndDate').value;
    const org = App.getOrgFilterValues('att');
    let url = `/attendance?start_date=${startDate}&end_date=${endDate}`;
    if (org.company_id) url += `&company_id=${org.company_id}`;
    if (org.branch_id) url += `&branch_id=${org.branch_id}`;
    if (org.department_id) url += `&department_id=${org.department_id}`;

    const records = await App.api(url);
    const tbody = document.getElementById('attTableBody');

    if (!records || records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-calendar-check"></i><h3>No Attendance Records</h3><p>Import an Excel file or add entries manually.</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = records.map(r => `
      <tr>
        <td>${App.formatDate(r.date)}</td>
        <td>${r.employee_name}</td>
        <td>${r.emp_code || '—'}</td>
        <td>${r.check_in || '—'}</td>
        <td>${r.check_out || '—'}</td>
        <td>${r.total_hours ? r.total_hours.toFixed(1) + 'h' : '—'}</td>
        <td>${App.statusBadge(r.status)}</td>
        <td>
          <div class="btn-group">
            <button class="btn btn-ghost btn-sm" onclick="showAttendanceForm(${r.employee_id}, '${r.date}', ${r.id})" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="btn btn-ghost btn-sm text-danger" onclick="deleteAttendance(${r.id})" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function showImportModal() {
    App.showModal('Import Attendance from Excel', `
      <div class="file-drop" id="fileDrop">
        <i class="fas fa-cloud-upload-alt"></i>
        <h4>Drag & Drop or Click to Upload</h4>
        <p>Supports Excel files (.xlsx, .xls) — Hikvision and similar formats</p>
        <input type="file" id="fileInput" accept=".xlsx,.xls,.csv" style="display:none">
      </div>
      <div class="mt-2 hidden" id="importProgress">
        <div class="spinner" style="margin:0 auto"></div>
        <p class="text-center mt-1">Processing file...</p>
      </div>
      <div class="mt-2 hidden" id="importResults"></div>
    `, `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>`);

    const fileDrop = document.getElementById('fileDrop');
    const fileInput = document.getElementById('fileInput');

    fileDrop.addEventListener('click', () => fileInput.click());
    fileDrop.addEventListener('dragover', (e) => { e.preventDefault(); fileDrop.classList.add('dragover'); });
    fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
    fileDrop.addEventListener('drop', (e) => {
      e.preventDefault(); fileDrop.classList.remove('dragover');
      if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => { if (fileInput.files.length) uploadFile(fileInput.files[0]); });
  }

  async function uploadFile(file) {
    document.getElementById('fileDrop').classList.add('hidden');
    document.getElementById('importProgress').classList.remove('hidden');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/attendance/import', { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      document.getElementById('importProgress').classList.add('hidden');
      document.getElementById('importResults').classList.remove('hidden');
      document.getElementById('importResults').innerHTML = `
        <div style="text-align:center">
          <i class="fas fa-check-circle text-success" style="font-size:2.5rem;margin-bottom:0.75rem"></i>
          <h3>Import Successful!</h3>
          <p><strong>${result.imported}</strong> attendance records imported</p>
          ${result.newEmployees && result.newEmployees.length > 0 ? `
            <p class="text-warning"><strong>${result.newEmployees.length}</strong> new employees auto-added:</p>
            <ul style="text-align:left;list-style:none;padding:0">
              ${result.newEmployees.map(e => `<li style="padding:0.25rem 0">• ${e.name} (${e.emp_code || 'No code'})</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `;
      App.clearCache();
      loadAttendance();
    } catch (e) {
      document.getElementById('importProgress').classList.add('hidden');
      document.getElementById('importResults').classList.remove('hidden');
      document.getElementById('importResults').innerHTML = `<div class="text-center"><i class="fas fa-exclamation-circle text-danger" style="font-size:2.5rem"></i><h3>Import Failed</h3><p>${e.message}</p></div>`;
    }
  }

  window.showAttendanceForm = async function(employeeId, date, recordId) {
    const employees = await App.api('/employees?status=active');
    let record = {};
    if (recordId) {
      const records = await App.api(`/attendance?employee_id=${employeeId}&date=${date}`);
      record = records.find(r => r.id === recordId) || {};
    }

    App.showModal(recordId ? 'Edit Attendance' : 'Add Attendance', `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Employee *</label>
          <select class="form-control" id="attEmployee" ${recordId ? 'disabled' : ''}>
            <option value="">Select Employee</option>
            ${employees.map(e => `<option value="${e.id}" ${employeeId == e.id ? 'selected' : ''}>${e.name} (${e.emp_code || 'No code'})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Date *</label>
          <input type="date" class="form-control" id="attDate" value="${date || today}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Check In</label>
          <input type="time" class="form-control" id="attCheckIn" value="${record.check_in || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Check Out</label>
          <input type="time" class="form-control" id="attCheckOut" value="${record.check_out || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="attStatus">
            <option value="present" ${record.status === 'present' ? 'selected' : ''}>Present</option>
            <option value="absent" ${record.status === 'absent' ? 'selected' : ''}>Absent</option>
            <option value="leave" ${record.status === 'leave' ? 'selected' : ''}>Leave</option>
            <option value="holiday" ${record.status === 'holiday' ? 'selected' : ''}>Holiday</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input type="text" class="form-control" id="attNotes" value="${record.notes || ''}" placeholder="Optional notes">
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveAttBtn">Save</button>
    `);

    document.getElementById('saveAttBtn').addEventListener('click', async () => {
      const empId = document.getElementById('attEmployee').value;
      const attDate = document.getElementById('attDate').value;
      if (!empId || !attDate) { App.toast('Employee and date are required', 'error'); return; }

      await App.api('/attendance', {
        method: 'POST',
        body: {
          employee_id: parseInt(empId),
          date: attDate,
          check_in: document.getElementById('attCheckIn').value || null,
          check_out: document.getElementById('attCheckOut').value || null,
          status: document.getElementById('attStatus').value,
          notes: document.getElementById('attNotes').value.trim()
        }
      });
      App.toast('Attendance saved', 'success');
      App.closeModal();
      loadAttendance();
    });
  };

  window.deleteAttendance = async function(id) {
    if (!confirm('Delete this attendance record?')) return;
    await App.api(`/attendance/${id}`, { method: 'DELETE' });
    App.toast('Record deleted', 'success');
    loadAttendance();
  };

  loadAttendance();
};
