/* Settings Page */
Pages.settings = async function(container) {
  container.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-tab="org">Organization</button>
      <button class="tab" data-tab="rules">Salary Rules</button>
    </div>

    <!-- Organization Tab -->
    <div id="tab-org">
      <div class="grid grid-3">
        <!-- Companies -->
        <div class="card">
          <div class="card-header">
            <h3><i class="fas fa-building" style="margin-right:0.5rem;color:var(--primary-light)"></i>Companies</h3>
            <button class="btn btn-primary btn-sm" onclick="addOrgItem('company')"><i class="fas fa-plus"></i></button>
          </div>
          <div id="companyList"><p class="text-muted">Loading...</p></div>
        </div>
        <!-- Branches -->
        <div class="card">
          <div class="card-header">
            <h3><i class="fas fa-code-branch" style="margin-right:0.5rem;color:var(--accent)"></i>Branches</h3>
            <button class="btn btn-primary btn-sm" onclick="addOrgItem('branch')"><i class="fas fa-plus"></i></button>
          </div>
          <div id="branchList"><p class="text-muted">Loading...</p></div>
        </div>
        <!-- Departments -->
        <div class="card">
          <div class="card-header">
            <h3><i class="fas fa-sitemap" style="margin-right:0.5rem;color:var(--warning)"></i>Departments</h3>
            <button class="btn btn-primary btn-sm" onclick="addOrgItem('department')"><i class="fas fa-plus"></i></button>
          </div>
          <div id="deptList"><p class="text-muted">Loading...</p></div>
        </div>
      </div>
    </div>

    <!-- Salary Rules Tab -->
    <div id="tab-rules" class="hidden">
      <div class="section-header">
        <h2>Salary Rules</h2>
        <button class="btn btn-primary" id="addRuleBtn"><i class="fas fa-plus"></i> Add Rule</button>
      </div>
      <div id="rulesList"><p class="text-muted">Loading...</p></div>
    </div>
  `;

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-org').classList.toggle('hidden', tab.dataset.tab !== 'org');
      document.getElementById('tab-rules').classList.toggle('hidden', tab.dataset.tab !== 'rules');
    });
  });

  // ===== Organization Management =====
  async function loadOrg() {
    App.clearCache();
    const companies = await App.getCompanies();
    const branches = await App.getBranches();
    const depts = await App.getDepartments();

    document.getElementById('companyList').innerHTML = companies.length === 0
      ? '<p class="text-muted" style="padding:0.5rem">No companies yet. Click + to add.</p>'
      : companies.map(c => `
        <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
          <span>${c.name}</span>
          <div class="btn-group">
            <button class="btn btn-ghost btn-sm" onclick="editOrgItem('company', ${c.id}, '${c.name.replace(/'/g, "\\'")}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-ghost btn-sm text-danger" onclick="deleteOrgItem('company', ${c.id}, '${c.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('');

    document.getElementById('branchList').innerHTML = branches.length === 0
      ? '<p class="text-muted" style="padding:0.5rem">No branches yet.</p>'
      : branches.map(b => `
        <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
          <div><span>${b.name}</span><br><small class="text-muted">${b.company_name || '—'}</small></div>
          <div class="btn-group">
            <button class="btn btn-ghost btn-sm" onclick="editOrgItem('branch', ${b.id}, '${b.name.replace(/'/g, "\\'")}', ${b.company_id})"><i class="fas fa-edit"></i></button>
            <button class="btn btn-ghost btn-sm text-danger" onclick="deleteOrgItem('branch', ${b.id}, '${b.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('');

    document.getElementById('deptList').innerHTML = depts.length === 0
      ? '<p class="text-muted" style="padding:0.5rem">No departments yet.</p>'
      : depts.map(d => `
        <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
          <div><span>${d.name}</span><br><small class="text-muted">${d.company_name || '—'}</small></div>
          <div class="btn-group">
            <button class="btn btn-ghost btn-sm" onclick="editOrgItem('department', ${d.id}, '${d.name.replace(/'/g, "\\'")}', ${d.company_id})"><i class="fas fa-edit"></i></button>
            <button class="btn btn-ghost btn-sm text-danger" onclick="deleteOrgItem('department', ${d.id}, '${d.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('');
  }

  window.addOrgItem = async function(type) {
    const companies = await App.getCompanies();
    const needsCompany = type !== 'company';
    App.showModal(`Add ${type.charAt(0).toUpperCase() + type.slice(1)}`, `
      <div class="form-group">
        <label class="form-label">Name *</label>
        <input type="text" class="form-control" id="orgItemName" placeholder="Enter name">
      </div>
      ${needsCompany ? `<div class="form-group">
        <label class="form-label">Company *</label>
        <select class="form-control" id="orgItemCompany">
          <option value="">Select Company</option>
          ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>` : ''}
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveOrgBtn">Add</button>
    `);

    document.getElementById('saveOrgBtn').addEventListener('click', async () => {
      const name = document.getElementById('orgItemName').value.trim();
      if (!name) { App.toast('Name is required', 'error'); return; }
      const body = { name };
      if (needsCompany) {
        body.company_id = document.getElementById('orgItemCompany').value;
        if (!body.company_id) { App.toast('Company is required', 'error'); return; }
      }
      const endpoint = type === 'company' ? '/companies' : type === 'branch' ? '/companies/branches' : '/companies/departments';
      await App.api(endpoint, { method: 'POST', body });
      App.toast(`${type} added`, 'success');
      App.closeModal();
      App.clearCache();
      loadOrg();
    });
  };

  window.editOrgItem = async function(type, id, name, companyId) {
    const companies = await App.getCompanies();
    const needsCompany = type !== 'company';
    App.showModal(`Edit ${type.charAt(0).toUpperCase() + type.slice(1)}`, `
      <div class="form-group">
        <label class="form-label">Name *</label>
        <input type="text" class="form-control" id="orgItemName" value="${name}">
      </div>
      ${needsCompany ? `<div class="form-group">
        <label class="form-label">Company *</label>
        <select class="form-control" id="orgItemCompany">
          ${companies.map(c => `<option value="${c.id}" ${companyId == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>` : ''}
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveOrgBtn">Update</button>
    `);

    document.getElementById('saveOrgBtn').addEventListener('click', async () => {
      const newName = document.getElementById('orgItemName').value.trim();
      if (!newName) { App.toast('Name is required', 'error'); return; }
      const body = { name: newName };
      if (needsCompany) body.company_id = document.getElementById('orgItemCompany').value;
      const endpoint = type === 'company' ? `/companies/${id}` : type === 'branch' ? `/companies/branches/${id}` : `/companies/departments/${id}`;
      await App.api(endpoint, { method: 'PUT', body });
      App.toast(`${type} updated`, 'success');
      App.closeModal();
      App.clearCache();
      loadOrg();
    });
  };

  window.deleteOrgItem = async function(type, id, name) {
    if (!confirm(`Delete ${type} "${name}"? This may affect related data.`)) return;
    const endpoint = type === 'company' ? `/companies/${id}` : type === 'branch' ? `/companies/branches/${id}` : `/companies/departments/${id}`;
    await App.api(endpoint, { method: 'DELETE' });
    App.toast(`${type} deleted`, 'success');
    App.clearCache();
    loadOrg();
  };

  // ===== Salary Rules =====
  document.getElementById('addRuleBtn').addEventListener('click', () => showRuleForm());

  async function loadRules() {
    const rules = await App.api('/salary/rules');
    const div = document.getElementById('rulesList');
    if (!rules || rules.length === 0) {
      div.innerHTML = '<div class="empty-state"><i class="fas fa-cog"></i><h3>No Salary Rules</h3></div>';
      return;
    }

    div.innerHTML = rules.map(r => `
      <div class="card mb-2">
        <div class="card-header">
          <h3>${r.name} ${r.is_default ? '<span class="status status-active">Default</span>' : ''} ${r.company_name ? `<small class="text-muted"> — ${r.company_name}</small>` : ''}</h3>
          <div class="btn-group">
            <button class="btn btn-ghost btn-sm" onclick="showRuleForm(${r.id})"><i class="fas fa-edit"></i> Edit</button>
            ${!r.is_default ? `<button class="btn btn-ghost btn-sm text-danger" onclick="deleteRule(${r.id})"><i class="fas fa-trash"></i></button>` : ''}
          </div>
        </div>
        <div class="grid grid-4" style="gap:0.75rem">
          <div><small class="text-muted">Hours/Day</small><div style="font-weight:600">${r.working_hours_per_day}h</div></div>
          <div><small class="text-muted">Days/Month</small><div style="font-weight:600">${r.working_days_per_month}</div></div>
          <div><small class="text-muted">OT Rate</small><div style="font-weight:600">${r.overtime_rate}x</div></div>
          <div><small class="text-muted">OT After</small><div style="font-weight:600">${r.overtime_after_hours}h</div></div>
          <div><small class="text-muted">Late After</small><div style="font-weight:600">${r.late_arrival_time}</div></div>
          <div><small class="text-muted">Half-Day Late</small><div style="font-weight:600">${r.half_day_late_after_minutes}min</div></div>
          <div><small class="text-muted">Early Leave</small><div style="font-weight:600">${r.early_leave_time}</div></div>
          <div><small class="text-muted">Half-Day Early</small><div style="font-weight:600">${r.half_day_early_leave_minutes}min</div></div>
        </div>
        ${r.items && r.items.length > 0 ? `
          <div class="mt-1" style="border-top:1px solid var(--border);padding-top:0.75rem">
            <small class="text-muted" style="font-weight:600">Allowances & Deductions:</small>
            ${r.items.map(i => `<div class="flex items-center justify-between" style="padding:0.25rem 0">
              <span>${i.name}</span>
              <span class="${i.type === 'deduction' ? 'text-danger' : 'text-success'}">${i.type === 'deduction' ? '-' : '+'}${i.is_percentage ? i.amount + '%' : App.currency(i.amount)}</span>
            </div>`).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  window.showRuleForm = async function(id) {
    let rule = {};
    if (id) {
      const rules = await App.api('/salary/rules');
      rule = rules.find(r => r.id === id) || {};
    }
    const companies = await App.getCompanies();

    App.showModal(id ? 'Edit Salary Rule' : 'Add Salary Rule', `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Rule Name *</label><input type="text" class="form-control" id="ruleName" value="${rule.name || ''}"></div>
        <div class="form-group"><label class="form-label">Company</label>
          <select class="form-control" id="ruleCompany"><option value="">All (Global)</option>${companies.map(c => `<option value="${c.id}" ${rule.company_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Working Hours/Day</label><input type="number" class="form-control" id="ruleHours" value="${rule.working_hours_per_day || 8}" step="0.5"></div>
        <div class="form-group"><label class="form-label">Working Days/Month</label><input type="number" class="form-control" id="ruleDays" value="${rule.working_days_per_month || 26}"></div>
        <div class="form-group"><label class="form-label">Overtime Rate (x)</label><input type="number" class="form-control" id="ruleOTRate" value="${rule.overtime_rate || 1.5}" step="0.1"></div>
        <div class="form-group"><label class="form-label">OT After Hours</label><input type="number" class="form-control" id="ruleOTAfter" value="${rule.overtime_after_hours || 8}" step="0.5"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Late Arrival Time</label><input type="time" class="form-control" id="ruleLateTime" value="${rule.late_arrival_time || '09:30'}"></div>
        <div class="form-group"><label class="form-label">Half-Day if Late (min)</label><input type="number" class="form-control" id="ruleHDLate" value="${rule.half_day_late_after_minutes || 30}"></div>
        <div class="form-group"><label class="form-label">Early Leave Time</label><input type="time" class="form-control" id="ruleEarlyTime" value="${rule.early_leave_time || '17:00'}"></div>
        <div class="form-group"><label class="form-label">Half-Day if Early (min)</label><input type="number" class="form-control" id="ruleHDEarly" value="${rule.half_day_early_leave_minutes || 60}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Casual Leaves/Month</label><input type="number" class="form-control" id="ruleCL" value="${rule.casual_leaves || 1}"></div>
        <div class="form-group"><label class="form-label">Sick Leaves/Month</label><input type="number" class="form-control" id="ruleSL" value="${rule.sick_leaves || 1}"></div>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:1rem;margin-top:0.5rem">
        <div class="flex items-center justify-between mb-1">
          <h4>Allowances & Deductions</h4>
          <button class="btn btn-ghost btn-sm" onclick="addRuleItem()"><i class="fas fa-plus"></i> Add</button>
        </div>
        <div id="ruleItems">
          ${(rule.items || []).map((item, i) => ruleItemRow(i, item)).join('')}
        </div>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveRuleBtn">Save Rule</button>
    `);

    window.ruleItemCounter = rule.items ? rule.items.length : 0;

    window.addRuleItem = function() {
      const div = document.getElementById('ruleItems');
      div.insertAdjacentHTML('beforeend', ruleItemRow(window.ruleItemCounter++, {}));
    };

    document.getElementById('saveRuleBtn').addEventListener('click', async () => {
      const name = document.getElementById('ruleName').value.trim();
      if (!name) { App.toast('Rule name is required', 'error'); return; }

      const items = [];
      document.querySelectorAll('.rule-item-row').forEach(row => {
        const itemName = row.querySelector('.ri-name').value.trim();
        if (itemName) {
          items.push({
            name: itemName,
            type: row.querySelector('.ri-type').value,
            amount: parseFloat(row.querySelector('.ri-amount').value) || 0,
            is_percentage: row.querySelector('.ri-pct').checked
          });
        }
      });

      const body = {
        name,
        company_id: document.getElementById('ruleCompany').value || null,
        working_hours_per_day: parseFloat(document.getElementById('ruleHours').value),
        working_days_per_month: parseInt(document.getElementById('ruleDays').value),
        overtime_rate: parseFloat(document.getElementById('ruleOTRate').value),
        overtime_after_hours: parseFloat(document.getElementById('ruleOTAfter').value),
        half_day_late_after_minutes: parseInt(document.getElementById('ruleHDLate').value),
        half_day_early_leave_minutes: parseInt(document.getElementById('ruleHDEarly').value),
        late_arrival_time: document.getElementById('ruleLateTime').value,
        early_leave_time: document.getElementById('ruleEarlyTime').value,
        casual_leaves: parseInt(document.getElementById('ruleCL').value),
        sick_leaves: parseInt(document.getElementById('ruleSL').value),
        items
      };

      if (id) {
        await App.api(`/salary/rules/${id}`, { method: 'PUT', body });
        App.toast('Rule updated', 'success');
      } else {
        await App.api('/salary/rules', { method: 'POST', body });
        App.toast('Rule added', 'success');
      }
      App.closeModal();
      loadRules();
    });
  };

  function ruleItemRow(index, item) {
    return `<div class="rule-item-row form-row" style="align-items:end">
      <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-control ri-name" value="${item.name || ''}" placeholder="e.g. HRA"></div>
      <div class="form-group"><label class="form-label">Type</label><select class="form-control ri-type"><option value="allowance" ${item.type === 'allowance' ? 'selected' : ''}>Allowance</option><option value="deduction" ${item.type === 'deduction' ? 'selected' : ''}>Deduction</option></select></div>
      <div class="form-group"><label class="form-label">Amount</label><input type="number" class="form-control ri-amount" value="${item.amount || ''}" step="0.01"></div>
      <div class="form-group"><label class="form-label" style="display:flex;align-items:center;gap:0.5rem"><input type="checkbox" class="ri-pct" ${item.is_percentage ? 'checked' : ''}> Is %</label></div>
      <div class="form-group"><button class="btn btn-ghost btn-sm text-danger" onclick="this.closest('.rule-item-row').remove()"><i class="fas fa-times"></i></button></div>
    </div>`;
  }

  window.deleteRule = async function(id) {
    if (!confirm('Delete this salary rule?')) return;
    await App.api(`/salary/rules/${id}`, { method: 'DELETE' });
    App.toast('Rule deleted', 'success');
    loadRules();
  };

  loadOrg();
  loadRules();
};
