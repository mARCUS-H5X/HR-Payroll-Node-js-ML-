/* ============================================
   SAI Desigine — Core Application
   SPA Router, API Helper, UI Utilities
   ============================================ */

const App = {
  currentPage: 'dashboard',
  cache: {},

  // API Helper
  async api(url, options = {}) {
    try {
      const opts = {
        headers: { 'Content-Type': 'application/json' },
        ...options
      };
      if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
        opts.body = JSON.stringify(opts.body);
      }
      if (opts.body instanceof FormData) {
        delete opts.headers['Content-Type'];
      }
      const res = await fetch(`/api${url}`, opts);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Request failed');
      }
      const contentType = res.headers.get('Content-Type');
      if (contentType && contentType.includes('application/json')) {
        return await res.json();
      }
      return res;
    } catch (e) {
      App.toast(e.message, 'error');
      throw e;
    }
  },

  // Toast notifications
  toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
  },

  // Modal
  showModal(title, bodyHtml, footerHtml = '') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml;
    document.getElementById('modal').classList.add('active');
    document.getElementById('modalBackdrop').classList.add('active');
  },

  closeModal() {
    document.getElementById('modal').classList.remove('active');
    document.getElementById('modalBackdrop').classList.remove('active');
  },

  // Router
  navigate(page) {
    this.currentPage = page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`[data-page="${page}"]`);
    if (navItem) navItem.classList.add('active');

    const titles = {
      dashboard: 'Dashboard', employees: 'Employees', attendance: 'Attendance',
      payroll: 'Payroll', reports: 'Reports', settings: 'Settings', help: 'Help & Guide'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;

    const container = document.getElementById('pageContainer');
    container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>';

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('mobile-open');

    setTimeout(() => {
      if (typeof Pages[page] === 'function') {
        Pages[page](container);
      } else {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-tools"></i><h3>Page Not Found</h3><p>This page is under construction.</p></div>';
      }
    }, 100);
  },

  // Format currency
  currency(amount) {
    return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  },

  // Format date
  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  // Format datetime
  formatDateTime(dtStr) {
    if (!dtStr) return '—';
    const d = new Date(dtStr);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  },

  // Get org data (cached)
  async getCompanies() {
    if (!this.cache.companies) this.cache.companies = await this.api('/companies');
    return this.cache.companies;
  },
  async getBranches(companyId) {
    const key = 'branches' + (companyId || '');
    if (!this.cache[key]) this.cache[key] = await this.api('/companies/branches' + (companyId ? `?company_id=${companyId}` : ''));
    return this.cache[key];
  },
  async getDepartments(companyId) {
    const key = 'depts' + (companyId || '');
    if (!this.cache[key]) this.cache[key] = await this.api('/companies/departments' + (companyId ? `?company_id=${companyId}` : ''));
    return this.cache[key];
  },

  clearCache() { this.cache = {}; },

  // Build company/branch/dept filter HTML
  async buildOrgFilters(prefix = '') {
    const companies = await this.getCompanies();
    return `
      <label>${prefix}Company</label>
      <select class="form-control" id="${prefix}filterCompany">
        <option value="">All Companies</option>
        ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
      <label>${prefix}Branch</label>
      <select class="form-control" id="${prefix}filterBranch">
        <option value="">All Branches</option>
      </select>
      <label>${prefix}Department</label>
      <select class="form-control" id="${prefix}filterDept">
        <option value="">All Departments</option>
      </select>
    `;
  },

  // Bind company change to load branches/depts
  bindOrgFilters(prefix = '', onChange) {
    const companyEl = document.getElementById(prefix + 'filterCompany');
    const branchEl = document.getElementById(prefix + 'filterBranch');
    const deptEl = document.getElementById(prefix + 'filterDept');

    if (companyEl) {
      companyEl.addEventListener('change', async () => {
        const cid = companyEl.value;
        this.cache = {}; // Clear cache for fresh data
        if (cid) {
          const branches = await this.getBranches(cid);
          branchEl.innerHTML = '<option value="">All Branches</option>' + branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
          const depts = await this.getDepartments(cid);
          deptEl.innerHTML = '<option value="">All Departments</option>' + depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        } else {
          branchEl.innerHTML = '<option value="">All Branches</option>';
          deptEl.innerHTML = '<option value="">All Departments</option>';
        }
        if (onChange) onChange();
      });
    }
    if (branchEl) branchEl.addEventListener('change', () => { if (onChange) onChange(); });
    if (deptEl) deptEl.addEventListener('change', () => { if (onChange) onChange(); });
  },

  getOrgFilterValues(prefix = '') {
    return {
      company_id: document.getElementById(prefix + 'filterCompany')?.value || '',
      branch_id: document.getElementById(prefix + 'filterBranch')?.value || '',
      department_id: document.getElementById(prefix + 'filterDept')?.value || ''
    };
  },

  // Status badge
  statusBadge(status) {
    const s = (status || '').toLowerCase();
    return `<span class="status status-${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</span>`;
  }
};

// Page registry
const Pages = {};

// ============ Init ============
document.addEventListener('DOMContentLoaded', () => {
  // Sidebar toggle
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  // Mobile menu
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  });

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      App.navigate(item.dataset.page);
    });
  });

  // Modal close
  document.getElementById('modalClose').addEventListener('click', App.closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', App.closeModal);

  // Refresh
  document.getElementById('refreshBtn').addEventListener('click', () => {
    App.clearCache();
    App.navigate(App.currentPage);
    App.toast('Page refreshed', 'success');
  });

  // Alerts
  document.getElementById('alertsBtn').addEventListener('click', () => {
    document.getElementById('alertsPanel').classList.toggle('active');
    loadAlerts();
  });
  document.getElementById('alertsBadge').addEventListener('click', () => {
    document.getElementById('alertsPanel').classList.toggle('active');
    loadAlerts();
  });
  document.getElementById('closeAlerts').addEventListener('click', () => {
    document.getElementById('alertsPanel').classList.remove('active');
  });

  document.getElementById('markAllReadAlerts').addEventListener('click', async () => {
    await App.api('/dashboard/alerts/read-all', { method: 'PUT' });
    document.querySelectorAll('.alert-item').forEach(el => el.style.opacity = '0.5');
    document.getElementById('alertCount').style.display = 'none';
    document.getElementById('alertDot').style.display = 'none';
    App.toast('All alerts marked as read', 'success');
  });

  document.getElementById('clearAllAlerts').addEventListener('click', async () => {
    if (!confirm('Clear all alerts?')) return;
    await App.api('/dashboard/alerts', { method: 'DELETE' });
    document.getElementById('alertsBody').innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><h3>All Clear!</h3><p>No pending alerts.</p></div>';
    document.getElementById('alertCount').style.display = 'none';
    document.getElementById('alertDot').style.display = 'none';
    App.toast('Alerts cleared', 'success');
  });

  // Hash routing
  const hash = window.location.hash.slice(1);
  App.navigate(hash || 'dashboard');

  window.addEventListener('hashchange', () => {
    const h = window.location.hash.slice(1);
    if (h && h !== App.currentPage) App.navigate(h);
  });

  // Generate alerts on load
  App.api('/dashboard/alerts', { method: 'POST' }).then(alerts => {
    if (alerts && alerts.length > 0) {
      document.getElementById('alertCount').textContent = alerts.length;
      document.getElementById('alertCount').style.display = '';
      document.getElementById('alertDot').style.display = '';
    }
  }).catch(() => {});
});

async function loadAlerts() {
  try {
    const alerts = await App.api('/dashboard/alerts');
    const body = document.getElementById('alertsBody');
    if (!alerts || alerts.length === 0) {
      body.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><h3>All Clear!</h3><p>No pending alerts.</p></div>';
      return;
    }

    const typeIcons = {
      salary_pending: '<i class="fas fa-wallet" style="color:var(--warning)"></i>',
      missing_attendance: '<i class="fas fa-calendar-times" style="color:var(--danger)"></i>',
      incomplete_data: '<i class="fas fa-exclamation-circle" style="color:var(--info)"></i>'
    };

    body.innerHTML = alerts.map(a => `
      <div class="alert-item ${a.type}" onclick="markAlertRead(${a.id}, this)" style="opacity: ${a.is_read ? '0.5' : '1'};">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="alert-type" style="display:flex; gap:0.4rem; align-items:center;">
            ${typeIcons[a.type] || '<i class="fas fa-bell"></i>'}
            ${a.type.replace(/_/g, ' ')}
          </div>
          <small class="text-muted" style="font-size:0.65rem">${App.formatDateTime(a.created_at)}</small>
        </div>
        <div style="margin-top:0.35rem; font-size:0.85rem; line-height:1.4;">${a.message}</div>
      </div>
    `).join('');
  } catch (e) {
    // Silent
  }
}

async function markAlertRead(id, el) {
  await App.api(`/dashboard/alerts/${id}/read`, { method: 'PUT' });
  el.style.opacity = '0.4';
}
