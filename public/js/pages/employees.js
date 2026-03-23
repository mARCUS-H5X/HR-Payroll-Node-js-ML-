/* Employees Page */
Pages.employees = async function(container) {
  container.innerHTML = `
    <div class="section-header">
      <h2>Employee Management</h2>
      <button class="btn btn-primary" id="addEmployeeBtn"><i class="fas fa-plus"></i> Add Employee</button>
    </div>
    <div class="filter-bar">
      <label>Status</label>
      <select class="form-control" id="empStatusFilter">
        <option value="">All</option>
        <option value="active" selected>Active</option>
        <option value="inactive">Inactive</option>
      </select>
      ${await App.buildOrgFilters('emp')}
      <button class="btn btn-secondary btn-sm" id="empFilterBtn"><i class="fas fa-filter"></i> Filter</button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Code</th><th>Name</th><th>Company</th><th>Branch</th><th>Department</th>
            <th>Designation</th><th>Base Salary</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="empTableBody">
          <tr><td colspan="9" class="text-center text-muted" style="padding:2rem">Loading...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('addEmployeeBtn').addEventListener('click', () => showEmployeeForm());
  document.getElementById('empFilterBtn').addEventListener('click', loadEmployees);
  App.bindOrgFilters('emp');

  async function loadEmployees() {
    const status = document.getElementById('empStatusFilter').value;
    const org = App.getOrgFilterValues('emp');
    let url = '/employees?';
    if (status) url += `status=${status}&`;
    if (org.company_id) url += `company_id=${org.company_id}&`;
    if (org.branch_id) url += `branch_id=${org.branch_id}&`;
    if (org.department_id) url += `department_id=${org.department_id}&`;

    const employees = await App.api(url);
    const tbody = document.getElementById('empTableBody');

    if (!employees || employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><i class="fas fa-users"></i><h3>No Employees Found</h3><p>Add your first employee or adjust filters.</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = employees.map(e => `
      <tr>
        <td><strong>${e.emp_code || '—'}</strong></td>
        <td>${e.name}</td>
        <td>${e.company_name || '—'}</td>
        <td>${e.branch_name || '—'}</td>
        <td>${e.department_name || '—'}</td>
        <td>${e.designation || '—'}</td>
        <td>${App.currency(e.base_salary)}</td>
        <td>${App.statusBadge(e.status)}</td>
        <td>
          <div class="btn-group">
            <button class="btn btn-ghost btn-sm" onclick="showEmployeeForm(${e.id})" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="btn btn-ghost btn-sm text-danger" onclick="deleteEmployee(${e.id}, '${e.name}')" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  window.showEmployeeForm = async function(id) {
    let emp = {};
    if (id) {
      emp = await App.api(`/employees/${id}`);
    }
    const companies = await App.getCompanies();
    const branches = await App.getBranches();
    const depts = await App.getDepartments();

    App.showModal(id ? 'Edit Employee' : 'Add Employee', `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Employee Code</label>
          <input type="text" class="form-control" id="empCode" value="${emp.emp_code || ''}" placeholder="e.g. EMP001">
        </div>
        <div class="form-group">
          <label class="form-label">Full Name *</label>
          <input type="text" class="form-control" id="empName" value="${emp.name || ''}" placeholder="Enter full name" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Company</label>
          <select class="form-control" id="empCompany">
            <option value="">Select Company</option>
            ${companies.map(c => `<option value="${c.id}" ${emp.company_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Branch</label>
          <select class="form-control" id="empBranch">
            <option value="">Select Branch</option>
            ${branches.map(b => `<option value="${b.id}" ${emp.branch_id == b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Department</label>
          <select class="form-control" id="empDept">
            <option value="">Select Department</option>
            ${depts.map(d => `<option value="${d.id}" ${emp.department_id == d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Designation</label>
          <input type="text" class="form-control" id="empDesignation" value="${emp.designation || ''}" placeholder="e.g. Manager">
        </div>
        <div class="form-group">
          <label class="form-label">Base Salary (₹)</label>
          <input type="number" class="form-control" id="empSalary" value="${emp.base_salary || ''}" placeholder="Monthly salary">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input type="text" class="form-control" id="empPhone" value="${emp.phone || ''}" placeholder="Phone number">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-control" id="empEmail" value="${emp.email || ''}" placeholder="Email address">
        </div>
        <div class="form-group">
          <label class="form-label">Join Date</label>
          <input type="date" class="form-control" id="empJoinDate" value="${emp.join_date || ''}">
        </div>
      </div>
      ${id ? `
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-control" id="empStatus">
          <option value="active" ${emp.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="inactive" ${emp.status === 'inactive' ? 'selected' : ''}>Inactive</option>
        </select>
      </div>` : ''}
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveEmpBtn">${id ? 'Update' : 'Add'} Employee</button>
    `);

    document.getElementById('saveEmpBtn').addEventListener('click', async () => {
      const name = document.getElementById('empName').value.trim();
      if (!name) { App.toast('Employee name is required', 'error'); return; }

      const body = {
        emp_code: document.getElementById('empCode').value.trim(),
        name,
        company_id: document.getElementById('empCompany').value || null,
        branch_id: document.getElementById('empBranch').value || null,
        department_id: document.getElementById('empDept').value || null,
        designation: document.getElementById('empDesignation').value.trim(),
        base_salary: parseFloat(document.getElementById('empSalary').value) || 0,
        phone: document.getElementById('empPhone').value.trim(),
        email: document.getElementById('empEmail').value.trim(),
        join_date: document.getElementById('empJoinDate').value || null,
        status: document.getElementById('empStatus')?.value || 'active'
      };

      if (id) {
        await App.api(`/employees/${id}`, { method: 'PUT', body });
        App.toast('Employee updated', 'success');
      } else {
        await App.api('/employees', { method: 'POST', body });
        App.toast('Employee added', 'success');
      }
      App.closeModal();
      App.clearCache();
      loadEmployees();
    });
  };

  window.deleteEmployee = async function(id, name) {
    if (!confirm(`Delete employee "${name}"? This cannot be undone.`)) return;
    await App.api(`/employees/${id}`, { method: 'DELETE' });
    App.toast('Employee deleted', 'success');
    loadEmployees();
  };

  loadEmployees();
};
