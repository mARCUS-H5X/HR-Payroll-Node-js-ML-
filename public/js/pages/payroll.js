/* Payroll Page */
Pages.payroll = async function(container) {
  const today = new Date();
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${lastDay}`;

  container.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-tab="calculate">Calculate Payroll</button>
      <button class="tab" data-tab="records">Payroll Records</button>
      <button class="tab" data-tab="payments">Payments</button>
    </div>

    <!-- Calculate Tab -->
    <div id="tab-calculate">
      <div class="card mb-2">
        <div class="card-header"><h3><i class="fas fa-calculator" style="margin-right:0.5rem;color:var(--primary-light)"></i>Run Payroll Calculation</h3></div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Period Start *</label>
            <input type="date" class="form-control" id="payPeriodStart" value="${monthStart}">
          </div>
          <div class="form-group">
            <label class="form-label">Period End *</label>
            <input type="date" class="form-control" id="payPeriodEnd" value="${monthEnd}">
          </div>
          <div class="form-group">
            <label class="form-label">Company</label>
            <select class="form-control" id="payCompany"><option value="">All Companies</option></select>
          </div>
        </div>
        <button class="btn btn-primary btn-lg" id="calcPayrollBtn"><i class="fas fa-play"></i> Calculate Payroll</button>
      </div>
      <div id="payrollResults"></div>
    </div>

    <!-- Records Tab -->
    <div id="tab-records" class="hidden">
      <div class="filter-bar">
        <label>Period Start</label>
        <input type="date" class="form-control" id="recStart" value="${monthStart}">
        <label>Period End</label>
        <input type="date" class="form-control" id="recEnd" value="${monthEnd}">
        <label>Status</label>
        <select class="form-control" id="recStatus">
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="loadRecordsBtn"><i class="fas fa-search"></i> Search</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr><th>Employee</th><th>Period</th><th>Present</th><th>Absent</th><th>OT Hours</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Advances</th><th>Payable</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody id="recordsBody"><tr><td colspan="12" class="text-center text-muted" style="padding:2rem">Click Search to load records</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Payments Tab -->
    <div id="tab-payments" class="hidden">
      <div class="section-header">
        <h2>Payment Records</h2>
        <button class="btn btn-primary" id="addPaymentBtn"><i class="fas fa-plus"></i> Record Payment</button>
      </div>
      <div class="filter-bar">
        <label>Type</label>
        <select class="form-control" id="payTypeFilter">
          <option value="">All</option>
          <option value="advance">Advance</option>
          <option value="salary">Salary</option>
        </select>
        <label>From</label>
        <input type="date" class="form-control" id="payStartFilter" value="${monthStart}">
        <label>To</label>
        <input type="date" class="form-control" id="payEndFilter" value="${monthEnd}">
        <button class="btn btn-secondary btn-sm" id="loadPaymentsBtn"><i class="fas fa-search"></i> Search</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Date</th><th>Employee</th><th>Type</th><th>Amount</th><th>Method</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody id="paymentsBody"><tr><td colspan="7" class="text-center text-muted" style="padding:2rem">Click Search to load</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  // Load companies for filter
  const companies = await App.getCompanies();
  const payCompany = document.getElementById('payCompany');
  companies.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; payCompany.appendChild(o); });

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-calculate').classList.toggle('hidden', tab.dataset.tab !== 'calculate');
      document.getElementById('tab-records').classList.toggle('hidden', tab.dataset.tab !== 'records');
      document.getElementById('tab-payments').classList.toggle('hidden', tab.dataset.tab !== 'payments');
    });
  });

  // Calculate payroll
  document.getElementById('calcPayrollBtn').addEventListener('click', async () => {
    const body = {
      period_start: document.getElementById('payPeriodStart').value,
      period_end: document.getElementById('payPeriodEnd').value,
      company_id: document.getElementById('payCompany').value || undefined
    };
    if (!body.period_start || !body.period_end) { App.toast('Please select period dates', 'error'); return; }

    const btn = document.getElementById('calcPayrollBtn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating...';

    try {
      const results = await App.api('/salary/calculate', { method: 'POST', body });
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> Calculate Payroll';

      if (results.length === 0) {
        document.getElementById('payrollResults').innerHTML = '<div class="empty-state mt-2"><i class="fas fa-calculator"></i><h3>No Employees</h3><p>No active employees found for this period/filter.</p></div>';
        return;
      }

      document.getElementById('payrollResults').innerHTML = `
        <div class="card mt-2">
          <div class="card-header"><h3>Payroll Results — ${results.length} employees</h3></div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>Employee</th><th>Working</th><th>Present</th><th>Absent</th><th>OT</th><th>Base</th><th>OT Pay</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Advances</th><th>Payable</th></tr></thead>
              <tbody>
                ${results.map(r => `<tr>
                  <td><strong>${r.employee_name}</strong><br><small class="text-muted">${r.emp_code || ''}</small></td>
                  <td>${r.working_days}d</td><td>${r.present_days}d</td><td>${r.absent_days}d</td><td>${r.overtime_hours}h</td>
                  <td>${App.currency(r.base_salary)}</td><td>${App.currency(r.overtime_pay)}</td>
                  <td><strong>${App.currency(r.gross_salary)}</strong></td><td class="text-danger">${App.currency(r.total_deductions)}</td>
                  <td>${App.currency(r.net_salary)}</td><td class="text-warning">${App.currency(r.advances_paid)}</td>
                  <td><strong class="text-success">${App.currency(r.final_payable)}</strong></td>
                </tr>`).join('')}
              </tbody>
              <tfoot>
                <tr style="font-weight:700;background:var(--bg-tertiary)">
                  <td>TOTAL</td><td></td><td></td><td></td><td></td><td></td><td></td>
                  <td>${App.currency(results.reduce((s, r) => s + r.gross_salary, 0))}</td>
                  <td class="text-danger">${App.currency(results.reduce((s, r) => s + r.total_deductions, 0))}</td>
                  <td>${App.currency(results.reduce((s, r) => s + r.net_salary, 0))}</td>
                  <td class="text-warning">${App.currency(results.reduce((s, r) => s + r.advances_paid, 0))}</td>
                  <td class="text-success">${App.currency(results.reduce((s, r) => s + r.final_payable, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;
      App.toast(`Payroll calculated for ${results.length} employees`, 'success');
    } catch (e) {
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> Calculate Payroll';
    }
  });

  // Load payroll records
  document.getElementById('loadRecordsBtn').addEventListener('click', async () => {
    const start = document.getElementById('recStart').value;
    const end = document.getElementById('recEnd').value;
    const status = document.getElementById('recStatus').value;
    let url = `/salary/payroll?period_start=${start}&period_end=${end}`;
    if (status) url += `&status=${status}`;
    const records = await App.api(url);
    const tbody = document.getElementById('recordsBody');

    if (!records || records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12"><div class="empty-state"><i class="fas fa-receipt"></i><h3>No Records</h3></div></td></tr>';
      return;
    }

    tbody.innerHTML = records.map(r => `<tr>
      <td><strong>${r.employee_name}</strong></td>
      <td>${App.formatDate(r.period_start)} — ${App.formatDate(r.period_end)}</td>
      <td>${r.present_days}</td><td>${r.absent_days}</td><td>${r.overtime_hours}h</td>
      <td>${App.currency(r.gross_salary)}</td><td class="text-danger">${App.currency(r.total_deductions + r.advances_paid)}</td>
      <td>${App.currency(r.net_salary)}</td><td class="text-warning">${App.currency(r.advances_paid)}</td>
      <td><strong>${App.currency(r.final_payable)}</strong></td>
      <td>${App.statusBadge(r.status)}</td>
      <td>
        <div class="btn-group">
          ${r.status !== 'paid' ? `<button class="btn btn-success btn-sm" onclick="markPaid(${r.id}, ${r.final_payable})"><i class="fas fa-check"></i> Pay</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="downloadSlip(${r.id})" title="Download Slip"><i class="fas fa-file-pdf"></i></button>
        </div>
      </td>
    </tr>`).join('');
  });

  // Mark as paid
  window.markPaid = async function(id, amount) {
    App.showModal('Mark as Paid', `
      <div class="form-group">
        <label class="form-label">Payment Amount (₹)</label>
        <input type="number" class="form-control" id="payAmount" value="${amount}" step="0.01">
        <p class="form-hint">Full amount: ₹${amount}. Enter a lower amount for partial payment.</p>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-success" id="confirmPayBtn"><i class="fas fa-check"></i> Confirm Payment</button>
    `);

    document.getElementById('confirmPayBtn').addEventListener('click', async () => {
      const paidAmount = parseFloat(document.getElementById('payAmount').value);
      await App.api(`/salary/payroll/${id}/pay`, { method: 'PUT', body: { paid_amount: paidAmount } });
      App.toast('Payment recorded', 'success');
      App.closeModal();
      document.getElementById('loadRecordsBtn').click();
    });
  };

  // Download salary slip
  window.downloadSlip = function(id) {
    window.open(`/api/reports/salary-slip/${id}`, '_blank');
  };

  // Payments
  document.getElementById('addPaymentBtn').addEventListener('click', async () => {
    const employees = await App.api('/employees?status=active');

    App.showModal('Record Payment', `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Employee *</label>
          <select class="form-control" id="payEmployee">
            <option value="">Select Employee</option>
            ${employees.map(e => `<option value="${e.id}">${e.name} (${e.emp_code || 'No code'})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Type *</label>
          <select class="form-control" id="payType">
            <option value="advance">Advance</option>
            <option value="salary">Salary (Early Payment)</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Amount (₹) *</label>
          <input type="number" class="form-control" id="payAmountNew" placeholder="Enter amount" step="0.01">
        </div>
        <div class="form-group">
          <label class="form-label">Payment Date *</label>
          <input type="date" class="form-control" id="payDate" value="${today.toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label class="form-label">Method</label>
          <select class="form-control" id="payMethod">
            <option value="cash">Cash</option>
            <option value="bank">Bank Transfer</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input type="text" class="form-control" id="payNotes" placeholder="Optional notes">
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="savePaymentBtn"><i class="fas fa-save"></i> Save Payment</button>
    `);

    document.getElementById('savePaymentBtn').addEventListener('click', async () => {
      const empId = document.getElementById('payEmployee').value;
      const amount = parseFloat(document.getElementById('payAmountNew').value);
      const type = document.getElementById('payType').value;
      const date = document.getElementById('payDate').value;
      if (!empId || !amount || !date) { App.toast('Please fill all required fields', 'error'); return; }

      await App.api('/salary/payments', {
        method: 'POST',
        body: {
          employee_id: parseInt(empId), amount, type, payment_date: date,
          payment_method: document.getElementById('payMethod').value,
          notes: document.getElementById('payNotes').value.trim()
        }
      });
      App.toast('Payment recorded', 'success');
      App.closeModal();
      document.getElementById('loadPaymentsBtn').click();
    });
  });

  // Load payments
  document.getElementById('loadPaymentsBtn').addEventListener('click', async () => {
    const type = document.getElementById('payTypeFilter').value;
    const start = document.getElementById('payStartFilter').value;
    const end = document.getElementById('payEndFilter').value;
    let url = `/salary/payments?start_date=${start}&end_date=${end}`;
    if (type) url += `&type=${type}`;
    const payments = await App.api(url);
    const tbody = document.getElementById('paymentsBody');

    if (!payments || payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-money-bill"></i><h3>No Payments</h3></div></td></tr>';
      return;
    }

    tbody.innerHTML = payments.map(p => `<tr>
      <td>${App.formatDate(p.payment_date)}</td>
      <td>${p.employee_name}</td>
      <td>${App.statusBadge(p.type)}</td>
      <td><strong>${App.currency(p.amount)}</strong></td>
      <td>${p.payment_method || '—'}</td>
      <td>${p.notes || '—'}</td>
      <td><button class="btn btn-ghost btn-sm text-danger" onclick="deletePayment(${p.id})"><i class="fas fa-trash"></i></button></td>
    </tr>`).join('');
  });

  window.deletePayment = async function(id) {
    if (!confirm('Delete this payment record?')) return;
    await App.api(`/salary/payments/${id}`, { method: 'DELETE' });
    App.toast('Payment deleted', 'success');
    document.getElementById('loadPaymentsBtn').click();
  };
};
