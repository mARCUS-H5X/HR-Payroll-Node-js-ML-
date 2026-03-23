/* Dashboard Page */
Pages.dashboard = async function(container) {
  const orgFilters = await App.buildOrgFilters('dash');

  container.innerHTML = `
    <div class="filter-bar">
      <label>Period</label>
      <select class="form-control" id="dashPeriod">
        <option value="month" selected>This Month</option>
        <option value="week">This Week</option>
        <option value="day">Today</option>
        <option value="year">This Year</option>
        <option value="custom">Custom Range</option>
      </select>
      <input type="date" class="form-control hidden" id="dashStartDate">
      <input type="date" class="form-control hidden" id="dashEndDate">
      ${orgFilters}
      <button class="btn btn-primary btn-sm" id="dashApply"><i class="fas fa-filter"></i> Apply</button>
    </div>

    <div class="grid grid-6" id="statCards">
      <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-users"></i></div><div class="stat-value" id="sTotalEmp">—</div><div class="stat-label">Total Employees</div></div>
      <div class="stat-card"><div class="stat-icon green"><i class="fas fa-indian-rupee-sign"></i></div><div class="stat-value" id="sSalary">—</div><div class="stat-label">Salary Expenses</div></div>
      <div class="stat-card"><div class="stat-icon yellow"><i class="fas fa-clock"></i></div><div class="stat-value" id="sHours">—</div><div class="stat-label">Working Hours</div></div>
      <div class="stat-card"><div class="stat-icon purple"><i class="fas fa-hourglass-half"></i></div><div class="stat-value" id="sOvertime">—</div><div class="stat-label">Overtime Hours</div></div>
      <div class="stat-card"><div class="stat-icon red"><i class="fas fa-hand-holding-dollar"></i></div><div class="stat-value" id="sAdvances">—</div><div class="stat-label">Total Advances</div></div>
      <div class="stat-card"><div class="stat-icon teal"><i class="fas fa-receipt"></i></div><div class="stat-value" id="sPending">—</div><div class="stat-label">Pending Salary</div></div>
    </div>

    <div class="grid grid-2 mt-2">
      <div class="card">
        <div class="card-header"><h3>Salary Trend (6 Months)</h3></div>
        <div class="chart-container"><canvas id="salaryChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Attendance Distribution</h3></div>
        <div class="chart-container"><canvas id="attendanceChart"></canvas></div>
      </div>
    </div>

    <div class="grid grid-2 mt-2">
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-trophy" style="color:var(--warning);margin-right:0.5rem"></i>Employee Performance</h3></div>
        <ul class="perf-list" id="perfList">
          <li class="text-muted text-center" style="padding:2rem">No data available</li>
        </ul>
      </div>
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-history" style="color:var(--info);margin-right:0.5rem"></i>Recent Activity</h3></div>
        <div id="recentActivity">
          <p class="text-muted text-center" style="padding:2rem">No activity yet</p>
        </div>
      </div>
    </div>
  `;

  // Custom date toggle
  document.getElementById('dashPeriod').addEventListener('change', (e) => {
    const isCustom = e.target.value === 'custom';
    document.getElementById('dashStartDate').classList.toggle('hidden', !isCustom);
    document.getElementById('dashEndDate').classList.toggle('hidden', !isCustom);
  });

  App.bindOrgFilters('dash', loadDashboard);
  document.getElementById('dashApply').addEventListener('click', loadDashboard);

  let salaryChartInstance = null;
  let attendanceChartInstance = null;

  async function loadDashboard() {
    const period = document.getElementById('dashPeriod').value;
    const org = App.getOrgFilterValues('dash');
    let url = `/dashboard?period=${period}`;
    if (period === 'custom') {
      const s = document.getElementById('dashStartDate').value;
      const e = document.getElementById('dashEndDate').value;
      if (s) url += `&start_date=${s}`;
      if (e) url += `&end_date=${e}`;
    }
    if (org.company_id) url += `&company_id=${org.company_id}`;
    if (org.branch_id) url += `&branch_id=${org.branch_id}`;
    if (org.department_id) url += `&department_id=${org.department_id}`;

    try {
      const data = await App.api(url);

      document.getElementById('sTotalEmp').textContent = data.totalEmployees;
      document.getElementById('sSalary').textContent = App.currency(data.salaryExpenses);
      document.getElementById('sHours').textContent = data.totalHours + ' hrs';
      document.getElementById('sOvertime').textContent = data.overtimeHours + ' hrs';
      document.getElementById('sAdvances').textContent = App.currency(data.totalAdvances);
      document.getElementById('sPending').textContent = App.currency(data.pendingSalary);

      // Salary trend chart
      if (salaryChartInstance) salaryChartInstance.destroy();
      const ctx1 = document.getElementById('salaryChart').getContext('2d');
      salaryChartInstance = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: data.salaryTrend.map(t => t.month),
          datasets: [{
            label: 'Salary Expenses',
            data: data.salaryTrend.map(t => t.total),
            backgroundColor: 'rgba(79, 70, 229, 0.6)',
            borderColor: '#4F46E5',
            borderWidth: 1, borderRadius: 6,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(51,65,85,0.5)' }, ticks: { color: '#94A3B8' } },
            x: { grid: { display: false }, ticks: { color: '#94A3B8' } }
          }
        }
      });

      // Attendance chart
      if (attendanceChartInstance) attendanceChartInstance.destroy();
      const ctx2 = document.getElementById('attendanceChart').getContext('2d');
      const attData = data.attendanceDist || [];
      const attColors = { present: '#10B981', absent: '#EF4444', leave: '#8B5CF6', holiday: '#14B8A6', halfday: '#F59E0B' };
      attendanceChartInstance = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: attData.map(a => a.status.charAt(0).toUpperCase() + a.status.slice(1)),
          datasets: [{
            data: attData.map(a => a.count),
            backgroundColor: attData.map(a => attColors[a.status] || '#64748B'),
            borderWidth: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '65%',
          plugins: {
            legend: { position: 'right', labels: { color: '#94A3B8', usePointStyle: true, pointStyle: 'circle', padding: 15 } }
          }
        }
      });

      // Performance list
      const perfList = document.getElementById('perfList');
      if (data.performance && data.performance.length > 0) {
        perfList.innerHTML = data.performance.map((p, i) => `
          <li class="perf-item">
            <span class="perf-rank ${i < 3 ? 'top' : ''}">${i + 1}</span>
            <span class="perf-name">${p.name}</span>
            <span class="perf-score">${p.attendance_pct || 0}%</span>
          </li>
        `).join('');
      }

      // Recent activity
      const actDiv = document.getElementById('recentActivity');
      if (data.recentActivity && data.recentActivity.length > 0) {
        actDiv.innerHTML = data.recentActivity.map(a => `
          <div class="audit-item">
            <span class="audit-dot ${a.action}"></span>
            <span class="audit-desc">${a.description || a.action}</span>
            <span class="audit-time">${App.formatDateTime(a.created_at)}</span>
          </div>
        `).join('');
      }
    } catch (e) {
      // Error shown in toast
    }
  }

  loadDashboard();
};
