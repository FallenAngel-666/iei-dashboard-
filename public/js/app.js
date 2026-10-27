/**
 * IEI TVLC Main Application Controller
 * Manages dual-face routing (Staff Input Face vs Admin Analytics Face),
 * strict authentication gating, modal dialogs, and toast messages.
 */

const App = {
  activeFace: 'login', // 'login' | 'staff' | 'admin'
  activeView: 'dashboard',
  selectedYear: '2026',

  init() {
    this.bindEvents();
    this.checkAuthAndRoute();

    // Handle token expiration
    window.addEventListener('auth:expired', () => {
      this.showToast('Your session has expired. Please sign in again.', 'warning');
      this.routeToLogin();
    });
  },

  checkAuthAndRoute() {
    if (!API.isAuthenticated()) {
      this.routeToLogin();
      return;
    }

    const user = API.getCurrentUser();
    if (!user) {
      this.routeToLogin();
      return;
    }

    // Role-based routing
    if (user.role === 'staff' || user.role === 'coordinator') {
      this.showStaffFace();
    } else {
      // admin, auditor, etc.
      this.showAdminFace();
    }
  },

  routeToLogin() {
    this.activeFace = 'login';
    const screenLogin = document.getElementById('screen-login');
    const screenPortal = document.getElementById('screen-portal');
    if (screenLogin) screenLogin.style.display = 'flex';
    if (screenPortal) screenPortal.style.display = 'none';

    // Reset login form fields
    const emailField = document.getElementById('login-gateway-email');
    const passField = document.getElementById('login-gateway-password');
    if (emailField) emailField.value = '';
    if (passField) passField.value = '';

    const errBox = document.getElementById('login-error-alert');
    if (errBox) {
      errBox.style.display = 'none';
      errBox.textContent = '';
    }
  },

  showStaffFace() {
    this.activeFace = 'staff';
    const screenLogin = document.getElementById('screen-login');
    const screenPortal = document.getElementById('screen-portal');
    const faceStaff = document.getElementById('face-staff');
    const faceAdmin = document.getElementById('face-admin');

    if (screenLogin) screenLogin.style.display = 'none';
    if (screenPortal) screenPortal.style.display = 'block';
    if (faceStaff) faceStaff.style.display = 'block';
    if (faceAdmin) faceAdmin.style.display = 'none';

    // Update staff header user pill
    const user = API.getCurrentUser();
    const staffUserPill = document.getElementById('staff-user-pill');
    if (staffUserPill && user) {
      const isCoordinator = user.role === 'coordinator';
      staffUserPill.innerHTML = `
        <div style="text-align: right; margin-right: 8px;">
          <div style="font-weight: 700; font-size: 13px; color: #FFFFFF;">${App.escapeHtml(user.name)}</div>
          <div style="font-size: 11px; color: #93C5FD;">${isCoordinator ? 'Collegiate Chapter Coordinator' : 'Staff Data Entry Officer'}</div>
        </div>
        <div class="avatar-circle" style="background: var(--iei-crimson);">${user.name.charAt(0)}</div>
      `;
    }

    // Notice banner text
    const noticeBanner = document.querySelector('.staff-notice-banner');
    if (noticeBanner && user) {
      if (user.role === 'coordinator') {
        noticeBanner.innerHTML = `
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          <div>
            <strong>Collegiate Chapter Coordinator Mode:</strong> Data entry and activity logging are restricted to your authorized collegiate chapter. Select options from the standardized drop boxes below. All entries are validated against institutional records and reflected immediately.
          </div>
        `;
      } else {
        noticeBanner.innerHTML = `
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          <div>
            <strong>Staff Data Entry Terminal:</strong> Select options from the standardized drop boxes below to record events and collegiate student membership intakes. All entries are validated against institutional records and reflected immediately across official reports.
          </div>
        `;
      }
    }

    // Admin switch button visibility in staff view
    const adminBackBtn = document.getElementById('btn-staff-back-to-admin');
    if (adminBackBtn) {
      adminBackBtn.style.display = (user && user.role === 'admin') ? 'inline-flex' : 'none';
    }

    if (window.StaffFace) {
      StaffFace.load();
    }
  },

  showAdminFace() {
    this.activeFace = 'admin';
    const screenLogin = document.getElementById('screen-login');
    const screenPortal = document.getElementById('screen-portal');
    const faceStaff = document.getElementById('face-staff');
    const faceAdmin = document.getElementById('face-admin');

    if (screenLogin) screenLogin.style.display = 'none';
    if (screenPortal) screenPortal.style.display = 'block';
    if (faceStaff) faceStaff.style.display = 'none';
    if (faceAdmin) faceAdmin.style.display = 'flex';

    this.updateUserUI();
    this.navigate(this.activeView || 'dashboard');
  },

  switchFace(targetFace) {
    if (targetFace === 'staff') {
      this.showStaffFace();
    } else {
      this.showAdminFace();
    }
  },

  bindEvents() {
    // 1. Gateway Login Form submit
    const loginForm = document.getElementById('form-gateway-login');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleGatewayLogin(e));
    }

    // 2. Admin Sidebar Navigation click
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-view');
        this.navigate(view);

        // Close mobile drawer if open
        const sidebar = document.getElementById('app-sidebar');
        if (sidebar) sidebar.classList.remove('mobile-open');
      });
    });

    // 3. Mobile nav toggle
    const toggle = document.getElementById('mobile-nav-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const sidebar = document.getElementById('app-sidebar');
        if (sidebar) sidebar.classList.toggle('mobile-open');
      });
    }

    // 4. Global Year Selector change
    const yearSelect = document.getElementById('global-year-select');
    if (yearSelect) {
      yearSelect.addEventListener('change', (e) => {
        this.selectedYear = e.target.value;
        this.refreshActiveView();
      });
    }

    // 5. Close modal on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('open');
        }
      });
    });
  },

  async handleGatewayLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-gateway-email').value;
    const pass = document.getElementById('login-gateway-password').value;
    const errBox = document.getElementById('login-error-alert');
    const submitBtn = document.getElementById('btn-gateway-submit');

    if (errBox) {
      errBox.style.display = 'none';
      errBox.textContent = '';
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating...';
    }

    try {
      const res = await API.login(email, pass);
      this.showToast(`Welcome, ${res.user.name}`, 'success');

      if (res.user.role === 'staff' || res.user.role === 'coordinator') {
        this.showStaffFace();
      } else {
        this.showAdminFace();
      }
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message || 'Authentication failed. Please verify institutional credentials.';
        errBox.style.display = 'block';
      }
      this.showToast(err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Institutional Portal';
      }
    }
  },

  async quickLogin(role) {
    const creds = {
      admin: { email: 'admin@ieitvlc.org', pass: 'IEI_Admin_2026!' },
      staff: { email: 'staff@ieitvlc.org', pass: 'TVLC_Staff_2026!' },
      auditor: { email: 'auditor@ieitvlc.org', pass: 'Audit_View_2026!' }
    };

    if (!creds[role]) return;

    const emailField = document.getElementById('login-gateway-email');
    const passField = document.getElementById('login-gateway-password');
    if (emailField) emailField.value = creds[role].email;
    if (passField) passField.value = creds[role].pass;

    // Direct submit
    const errBox = document.getElementById('login-error-alert');
    if (errBox) errBox.style.display = 'none';

    try {
      const res = await API.login(creds[role].email, creds[role].pass);
      this.showToast(`Signed in successfully as ${res.user.name}.`, 'success');

      if (res.user.role === 'staff' || res.user.role === 'coordinator') {
        this.showStaffFace();
      } else {
        this.showAdminFace();
      }
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
      this.showToast(err.message, 'error');
    }
  },

  async handleLogout() {
    await API.logout();
    this.showToast('You have been signed out from the portal.', 'info');
    this.routeToLogin();
  },

  navigate(viewName) {
    this.activeView = viewName;

    // Update nav links active class
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Hide all view containers and show the target view
    document.querySelectorAll('.view-pane').forEach(pane => {
      pane.style.display = 'none';
    });

    const targetPane = document.getElementById(`view-${viewName}`);
    if (targetPane) {
      targetPane.style.display = 'block';
    }

    // Show auditor notice banner if in auditor role
    const user = API.getCurrentUser();
    let auditBanner = document.getElementById('auditor-notice-banner');
    if (user && user.role === 'auditor') {
      if (!auditBanner) {
        auditBanner = document.createElement('div');
        auditBanner.id = 'auditor-notice-banner';
        auditBanner.style.cssText = 'background: #EFF6FF; border: 1px solid #BFDBFE; color: #1E40AF; padding: 10px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; display: flex; align-items: center; gap: 8px; font-weight: 500;';
        auditBanner.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          <div><strong>Council Auditor Mode:</strong> You are viewing institutional analytics, records, and reports in read-only governance review mode.</div>
        `;
        const canvas = document.querySelector('.content-canvas');
        if (canvas) canvas.insertBefore(auditBanner, canvas.firstChild);
      } else {
        auditBanner.style.display = 'flex';
      }
    } else if (auditBanner) {
      auditBanner.style.display = 'none';
    }

    // Update breadcrumb
    const bcCurrent = document.getElementById('breadcrumb-current');
    if (bcCurrent) {
      const titles = {
        'dashboard': 'Executive Dashboard',
        'chapters': 'Student Chapter Management',
        'events': 'Event Management',
        'membership-analytics': 'Membership Analytics',
        'event-analytics': 'Event Analytics',
        'reports': 'Annual Reports & Exports',
        'settings': 'Administration & Audit Trail'
      };
      bcCurrent.textContent = titles[viewName] || viewName;
    }

    // Load data for specific view
    this.refreshActiveView();
  },

  refreshActiveView() {
    if (this.activeFace !== 'admin') return;

    switch (this.activeView) {
      case 'dashboard':
        Dashboard.load(this.selectedYear);
        break;
      case 'chapters':
        Chapters.load();
        break;
      case 'events':
        Events.activeFilters.year = this.selectedYear;
        Events.load();
        break;
      case 'membership-analytics':
        Analytics.loadMembership(this.selectedYear);
        break;
      case 'event-analytics':
        Analytics.loadEvents(this.selectedYear);
        break;
      case 'reports':
        Reports.load(this.selectedYear);
        break;
      case 'settings':
        Settings.load();
        break;
    }
  },

  updateUserUI() {
    const user = API.getCurrentUser();
    const userContainer = document.getElementById('header-user-container');
    const authActions = document.querySelectorAll('.auth-required');
    const adminActions = document.querySelectorAll('.admin-required');

    if (user && API.isAuthenticated()) {
      const isAuditor = user.role === 'auditor';

      if (userContainer) {
        userContainer.innerHTML = `
          <!-- Staff Mode Switcher for Admins -->
          ${user.role === 'admin' ? `
            <button class="btn btn-outline btn-sm" onclick="App.switchFace('staff')" title="Open Staff Input Face" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              Staff Entry Face
            </button>
          ` : ''}
          <div class="user-profile-badge" onclick="App.navigate('settings')">
            <div class="avatar-circle">${user.name.charAt(0)}</div>
            <div class="user-info-text">
              <span class="user-name">${App.escapeHtml(user.name.split(' ')[0])}</span>
              <span class="user-role-tag" style="${isAuditor ? 'background:#DBEAFE; color:#1E40AF; font-weight:700;' : ''}">${isAuditor ? 'Auditor (Read-Only)' : user.role}</span>
            </div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="App.handleLogout()" title="Sign Out">Sign Out</button>
        `;
      }

      // Hide mutation controls for auditor (Read-Only mode)
      authActions.forEach(el => {
        el.style.display = isAuditor ? 'none' : '';
      });
      if (user.role === 'admin') {
        adminActions.forEach(el => el.style.display = '');
      } else {
        adminActions.forEach(el => el.style.display = 'none');
      }
    }
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div style="flex: 1;">${this.escapeHtml(message)}</div>
      <button style="background: none; border: none; color: white; cursor: pointer;" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 4500);
  },

  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
