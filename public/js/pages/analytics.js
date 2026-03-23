Pages.analytics = async function(container) {
  container.innerHTML = `
    <div class="analytics-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
      <div>
        <h2 style="margin:0;">Analytics & Insights</h2>
        <p class="text-muted" style="margin:0.2rem 0 0 0;">ML-powered performance tracking and predictive insights.</p>
      </div>
      <div>
        <button class="btn btn-primary" id="btnSettingsML"><i class="fas fa-sliders-h"></i> ML Scoring Settings</button>
      </div>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom:1.5rem;">
      <div class="filter-bar" style="display:flex; gap:1rem; align-items:flex-end; flex-wrap:wrap;">
        <div id="analyticsOrgFilters" style="display:flex; gap:1rem; flex-wrap:wrap;"></div>
        <div>
          <label>Month</label>
          <input type="month" id="filterAnalyticsMonth" class="form-control" value="${new Date().toISOString().slice(0, 7)}">
        </div>
        <button class="btn btn-primary" id="btnRefreshAnalytics"><i class="fas fa-sync-alt"></i> Generate Insights</button>
      </div>
    </div>

    <!-- Smart Suggestions -->
    <div id="smartSuggestionsContainer" style="margin-bottom:1.5rem; display:flex; flex-direction:column; gap:0.75rem;"></div>

    <!-- Stats Row -->
    <div class="stats-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1.5rem; margin-bottom:1.5rem;">
      <div class="stat-card">
        <div class="stat-icon"><i class="fas fa-users"></i></div>
        <div class="stat-details">
          <h3>Total Analyzed</h3>
          <p class="stat-value" id="statAnalyzed">0</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(16, 185, 129, 0.1); color:var(--success)"><i class="fas fa-wallet"></i></div>
        <div class="stat-details">
          <h3>Est. Salary Expense</h3>
          <p class="stat-value" id="statExpense">₹0</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(239, 68, 68, 0.1); color:var(--danger)"><i class="fas fa-clock"></i></div>
        <div class="stat-details">
          <h3>Total Overtime (Hrs)</h3>
          <p class="stat-value" id="statOvertime">0</p>
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:2fr 1fr; gap:1.5rem; margin-bottom:1.5rem;" class="responsive-grid">
      <!-- Cost Trends Chart -->
      <div class="card">
        <div class="card-header">
          <h3>Cost & Expense Trends</h3>
        </div>
        <div class="card-body">
          <canvas id="costTrendsChart" height="250"></canvas>
        </div>
      </div>

      <!-- Performance Rankings -->
      <div class="card" style="display:flex; flex-direction:column;">
        <div class="card-header" style="border-bottom:1px solid var(--border-color); padding-bottom:1rem;">
          <h3 style="margin:0;">Top Performers (ML Score)</h3>
        </div>
        <div class="card-body" id="topPerformersList" style="flex:1; overflow-y:auto; max-height:300px; padding:0;">
          <!-- List populated by JS -->
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Employees Needing Attention</h3>
      </div>
      <div class="card-body">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Score</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Overtime (Hrs)</th>
                <th>Indicator</th>
              </tr>
            </thead>
            <tbody id="lowPerformersTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Provide initial scoped chart instance
  let currentChart = null;

  // Render filter selects
  document.getElementById('analyticsOrgFilters').innerHTML = await App.buildOrgFilters('analytics');
  App.bindOrgFilters('analytics', () => {}); // Do not auto-refresh on every single dropdown change to save calls, user presses 'Generate'

  const loadDashboard = async () => {
    try {
      const monthVal = document.getElementById('filterAnalyticsMonth').value; // YYYY-MM
      let m = '', y = '';
      if (monthVal) {
        [y, m] = monthVal.split('-');
      }
      
      const f = App.getOrgFilterValues('analytics');
      const q = new URLSearchParams({
        company_id: f.company_id,
        branch_id: f.branch_id,
        department_id: f.department_id,
        month: m,
        year: y
      }).toString();

      const data = await App.api(`/analytics/dashboard?${q}`);

      // 1. Stats
      document.getElementById('statAnalyzed').textContent = data.stats.totalEmployees;
      document.getElementById('statExpense').textContent = App.currency(data.stats.totalSalary);
      document.getElementById('statOvertime').textContent = data.stats.totalOvertimeHours;

      // 2. Suggestions
      const suggestionsHtml = data.suggestions.map(s => {
        let icon = 'fa-info-circle';
        let bgStyle = 'var(--surface-color)';
        let borderStyle = '1px solid var(--border-color)';
        
        if (s.type === 'success') { icon = 'fa-star'; bgStyle = 'rgba(16, 185, 129, 0.1)'; borderStyle = '1px solid var(--success)'; }
        if (s.type === 'warning') { icon = 'fa-exclamation-triangle'; bgStyle = 'rgba(245, 158, 11, 0.1)'; borderStyle = '1px solid var(--warning)'; }
        if (s.type === 'danger') { icon = 'fa-engine-warning'; bgStyle = 'rgba(239, 68, 68, 0.1)'; borderStyle = '1px solid var(--danger)'; }
        if (s.type === 'info') { icon = 'fa-lightbulb'; bgStyle = 'rgba(59, 130, 246, 0.1)'; borderStyle = '1px solid var(--primary)'; }

        return `
          <div style="padding:1rem; border-radius:8px; background:${bgStyle}; border:${borderStyle}; display:flex; align-items:center; gap:1rem;">
            <i class="fas ${icon}" style="font-size:1.5rem; color:var(--${s.type === 'info' ? 'primary' : s.type});"></i>
            <div style="font-weight:500; color:var(--text-color);">${s.text}</div>
          </div>
        `;
      }).join('');
      document.getElementById('smartSuggestionsContainer').innerHTML = suggestionsHtml || `<p class="text-muted">No smart insights generated for this period.</p>`;

      // 3. Chart
      const ctx = document.getElementById('costTrendsChart');
      if (currentChart) currentChart.destroy();
      
      currentChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.costTrends.labels,
          datasets: [
            {
              label: 'Total Salary Expense',
              data: data.costTrends.salary,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: true,
              tension: 0.4
            },
            {
              label: 'Overtime Expense',
              data: data.costTrends.overtime,
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              fill: true,
              tension: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { tooltip: { callbacks: { label: function(c) { return '₹' + c.formattedValue; } } } },
          scales: { y: { beginAtZero: true } }
        }
      });

      // 4. Rankings
      const topPerformers = data.performanceScores.slice(0, 5);
      document.getElementById('topPerformersList').innerHTML = topPerformers.length ? topPerformers.map(p => `
        <div style="padding:1rem; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:600;">${p.name}</div>
            <div style="font-size:0.8rem;" class="text-muted">${p.designation || 'Employee'}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1.2rem; font-weight:700; color:var(--success);">${p.score} <small style="font-size:0.7rem; font-weight:400; color:var(--text-muted)">/100</small></div>
            <div style="font-size:0.75rem;" class="text-muted"><i class="fas fa-check-circle" style="color:var(--success)"></i> ${p.present} days</div>
          </div>
        </div>
      `).join('') : '<div style="padding:1rem;" class="text-muted">No data available</div>';

      const lowPerformers = data.performanceScores.filter(p => p.score < 50);
      document.getElementById('lowPerformersTableBody').innerHTML = lowPerformers.length ? lowPerformers.map(p => `
        <tr>
          <td>
            <div style="font-weight:600;">${p.name}</div>
            <div style="font-size:0.8rem;" class="text-muted">${p.designation || 'Employee'}</div>
          </td>
          <td><span style="font-weight:700; color:var(--danger)">${p.score}</span>/100</td>
          <td>${p.present}</td>
          <td>${p.absent}</td>
          <td>${p.overtime}</td>
          <td><span class="status status-danger"><i class="fas fa-arrow-down"></i> Review</span></td>
        </tr>
      `).join('') : '<tr><td colspan="6" class="text-center text-muted">No employees falling behind.</td></tr>';

    } catch (e) {
      // Handled by App.api toast
    }
  };

  document.getElementById('btnRefreshAnalytics').addEventListener('click', loadDashboard);

  // Settings Modal
  document.getElementById('btnSettingsML').addEventListener('click', async () => {
    try {
      const settings = await App.api('/analytics/settings');
      
      const body = `
        <form id="mlSettingsForm">
          <div class="alert alert-info" style="margin-bottom:1rem; padding:1rem; background:rgba(59, 130, 246, 0.1); border-radius:6px; color:var(--primary); font-size:0.9rem;">
            <i class="fas fa-robot"></i> Adjust the weights used by the predictive scoring system to rank employees. Score out of 100.
          </div>
          <div class="form-group">
            <label>Attendance Weight (Perfect attendance bonus)</label>
            <input type="number" name="attendance_weight" class="form-control" value="${settings.attendance_weight}" required>
          </div>
          <div class="form-group">
            <label>Late Arrival Penalty (Per instance)</label>
            <input type="number" name="late_penalty" class="form-control" value="${settings.late_penalty}" required>
          </div>
          <div class="form-group">
            <label>Half-Day Penalty (Per instance)</label>
            <input type="number" name="half_day_penalty" class="form-control" value="${settings.half_day_penalty}" required>
          </div>
          <div class="form-group">
            <label>Absent Penalty (Per instance)</label>
            <input type="number" name="absent_penalty" class="form-control" value="${settings.absent_penalty}" required>
          </div>
          <div class="form-group">
            <label>Overtime Bonus (Per hour)</label>
            <input type="number" name="overtime_bonus" class="form-control" value="${settings.overtime_bonus}" required>
          </div>
        </form>
      `;
      
      const footer = `
        <button class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btnSaveMLSettings">Save Analysis Weights</button>
      `;
      
      App.showModal('ML Scoring Configuration', body, footer);
      
      document.getElementById('btnSaveMLSettings').addEventListener('click', async () => {
        const formData = new FormData(document.getElementById('mlSettingsForm'));
        const payload = Object.fromEntries(formData.entries());
        try {
          await App.api('/analytics/settings', { method: 'PUT', body: payload });
          App.toast('ML Scoring weights updated successfully', 'success');
          App.closeModal();
          loadDashboard(); // Refresh UI with new logic
        } catch (e) { }
      });
    } catch (e) {}
  });

  // Initial load
  loadDashboard();
};
