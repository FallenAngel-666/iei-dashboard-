/**
 * ============================================================================
 * MGR IEI STUDENTS CHAPTER — CENTRAL APPLICATION CONTROLLER
 * ============================================================================
 * 
 * Strict Four-Role System:
 * 1. Admin/Editor  ('admin')
 * 2. Chairman      ('chairman')
 * 3. Committee Member ('committee')
 * 4. Auditor       ('auditor')
 * 
 * Enforces mandatory login before dashboard access, responsive drawer navigation,
 * strict server-side authorization, and role-specific workspace views.
 */

const App = {
  activeFace: 'login',
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

    // Initialize Branding
    if (window.Branding) {
      Branding.init();
    }
  },

  /**
   * Mandatory Authentication Gatekeeper
   * The dashboard will NEVER open for an unauthenticated visitor.
   */
  async checkAuthAndRoute() {
    const screenLogin = document.getElementById('screen-login');
    const screenPortal = document.getElementById('screen-portal');

    if (!API.isAuthenticated()) {
      this.routeToLogin();
      return;
    }

    try {
      const res = await API.getProfile();
      if (!res.user) {
        this.routeToLogin();
        return;
      }

      // Update cached user with authoritative server role
      API.setAuth(API.getToken(), res.user);

      // Reveal portal, hide login screen
      if (screenLogin) screenLogin.style.display = 'none';
      if (screenPortal) screenPortal.style.display = 'flex';

      this.updateUserUI();
      this.applyRolePermissions(res.user);
      this.navigate(this.activeView || 'dashboard');

      // Pre-warm module records in background for instant view switching
      if (window.PortalModules) {
        if (PortalModules.tasks) PortalModules.tasks.loadTasks().catch(() => {});
        if (PortalModules.weeklyReports) PortalModules.weeklyReports.loadReports().catch(() => {});
        if (PortalModules.community) PortalModules.community.loadPosts().catch(() => {});
        if (PortalModules.events) PortalModules.events.loadEvents().catch(() => {});
      }
    } catch (err) {
      console.warn('Session verification failed:', err.message);
      this.routeToLogin();
    }
  },

  routeToLogin() {
    this.activeFace = 'login';
    const screenLogin = document.getElementById('screen-login');
    const screenPortal = document.getElementById('screen-portal');
    if (screenLogin) screenLogin.style.display = 'flex';
    if (screenPortal) screenPortal.style.display = 'none';

    // Hide fixed header logout button
    const logoutBtn = document.getElementById('btn-header-logout');
    if (logoutBtn) logoutBtn.style.display = 'none';

    // Reset login form fields
    const emailField = document.getElementById('login-gateway-email');
    const passField = document.getElementById('login-gateway-password');
    if (emailField) emailField.value = '';
    if (passField) passField.value = '';

    // Close any open modals
    document.querySelectorAll('.modal').forEach(m => {
      m.style.display = 'none';
      m.classList.remove('open');
    });
  },

  /**
   * Role-based UI filtering
   * Admin section only visible to Admin/Editor
   */
  applyRolePermissions(user) {
    const adminNavSection = document.getElementById('nav-section-admin');
    if (adminNavSection) {
      adminNavSection.style.display = (user.role === 'admin') ? 'block' : 'none';
    }
  },

  bindEvents() {
    // Form Gateway Login
    const formLogin = document.getElementById('form-gateway-login');
    if (formLogin) {
      formLogin.onsubmit = (e) => {
        e.preventDefault();
        this.handleLogin();
      };
    }

    // Sidebar Navigation Links
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-view');
        if (view) {
          this.navigate(view);
          this.closeMobileNav();
        }
      });
    });

    // Mobile Hamburger Toggle Button
    const mobileToggle = document.getElementById('mobile-nav-toggle');
    if (mobileToggle) {
      mobileToggle.onclick = () => this.toggleMobileNav();
    }

    // Mobile Nav Backdrop Overlay
    const backdrop = document.getElementById('mobile-nav-backdrop');
    if (backdrop) {
      backdrop.onclick = () => this.closeMobileNav();
    }

    // Fixed Header Logout Button
    const logoutBtn = document.getElementById('btn-header-logout');
    if (logoutBtn) {
      logoutBtn.onclick = (e) => {
        e.preventDefault();
        this.handleLogout();
      };
    }
  },

  toggleMobileNav() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('mobile-nav-backdrop');
    if (sidebar) sidebar.classList.toggle('mobile-open');
    if (backdrop) backdrop.classList.toggle('active');
  },

  closeMobileNav() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('mobile-nav-backdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
  },

  async handleLogin() {
    const email = document.getElementById('login-gateway-email')?.value.trim();
    const pass = document.getElementById('login-gateway-password')?.value;
    const errBox = document.getElementById('login-error-alert');
    const submitBtn = document.getElementById('btn-gateway-submit');

    if (!email || !pass) {
      if (errBox) {
        errBox.textContent = 'Please enter both institutional email and password.';
        errBox.style.display = 'block';
      }
      return;
    }

    if (errBox) errBox.style.display = 'none';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying Credentials...';
    }

    try {
      const res = await API.login(email, pass);
      this.showToast(`Welcome back, ${res.user.name} (${res.user.role.toUpperCase()})`, 'success');

      const screenLogin = document.getElementById('screen-login');
      const screenPortal = document.getElementById('screen-portal');
      if (screenLogin) screenLogin.style.display = 'none';
      if (screenPortal) screenPortal.style.display = 'flex';

      this.updateUserUI();
      this.applyRolePermissions(res.user);
      this.navigate('dashboard');

      // Pre-warm module records in background for instant view switching
      if (window.PortalModules) {
        if (PortalModules.tasks) PortalModules.tasks.loadTasks().catch(() => {});
        if (PortalModules.weeklyReports) PortalModules.weeklyReports.loadReports().catch(() => {});
        if (PortalModules.community) PortalModules.community.loadPosts().catch(() => {});
        if (PortalModules.events) PortalModules.events.loadEvents().catch(() => {});
      }
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message || 'Authentication failed. Please check credentials.';
        errBox.style.display = 'block';
      }
      this.showToast(err.message, 'danger');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Chapter Portal';
      }
    }
  },

  /**
   * 1-Click Quick Access for the Four Authorized Roles
   */
  async quickLogin(role) {
    const validRoles = ['admin', 'chairman', 'committee', 'auditor'];
    if (!validRoles.includes(role)) return;

    const errBox = document.getElementById('login-error-alert');
    if (errBox) errBox.style.display = 'none';

    try {
      const res = await API.quickAccess(role);
      this.showToast(`Signed in as ${res.user.name} [${res.user.role.toUpperCase()}]`, 'success');

      const screenLogin = document.getElementById('screen-login');
      const screenPortal = document.getElementById('screen-portal');
      if (screenLogin) screenLogin.style.display = 'none';
      if (screenPortal) screenPortal.style.display = 'flex';

      this.updateUserUI();
      this.applyRolePermissions(res.user);
      this.navigate('dashboard');

      // Pre-warm module records in background for instant view switching
      if (window.PortalModules) {
        if (PortalModules.tasks) PortalModules.tasks.loadTasks().catch(() => {});
        if (PortalModules.weeklyReports) PortalModules.weeklyReports.loadReports().catch(() => {});
        if (PortalModules.community) PortalModules.community.loadPosts().catch(() => {});
        if (PortalModules.events) PortalModules.events.loadEvents().catch(() => {});
      }
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message || 'Quick access is disabled or unavailable.';
        errBox.style.display = 'block';
      }
      this.showToast(err.message, 'danger');
    }
  },

  async handleLogout() {
    try {
      await API.logout();
    } catch (err) {
      console.warn('Logout API notice:', err);
    }
    API.clearAuth();
    this.showToast('You have been logged out securely.', 'info');
    this.routeToLogin();
  },

  navigate(viewId) {
    const user = API.getCurrentUser() || { role: 'committee' };

    // Prevent non-admin users from accessing administration-only views
    const adminOnlyViews = ['users', 'events', 'reporting-settings', 'audit-logs'];
    if (adminOnlyViews.includes(viewId) && user.role !== 'admin' && !(user.role === 'auditor' && viewId === 'audit-logs')) {
      this.showToast('Access restricted to Admin/Editor.', 'warning');
      viewId = 'dashboard';
    }

    this.activeView = viewId;

    // Update active state in sidebar
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      if (item.getAttribute('data-view') === viewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Hide all view panes, show selected view
    document.querySelectorAll('.view-pane').forEach(pane => {
      pane.style.display = 'none';
    });
    const targetPane = document.getElementById(`view-${viewId}`);
    if (targetPane) {
      targetPane.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Update top header breadcrumb
    const breadcrumb = document.getElementById('breadcrumb-current');
    const viewLabels = {
      dashboard: 'Dashboard Overview',
      tasks: 'Task Management',
      'weekly-reports': 'Weekly Reporting',
      community: 'Shared Community',
      messages: 'Private Messaging',
      users: 'User Management',
      events: 'Announcements & Events',
      'reporting-settings': 'Reporting Settings',
      'audit-logs': 'Audit Logs & Security'
    };
    if (breadcrumb) {
      breadcrumb.textContent = viewLabels[viewId] || 'Workspace';
    }

    // Trigger module loaders
    switch (viewId) {
      case 'dashboard':
        if (window.PortalModules && PortalModules.dashboard) PortalModules.dashboard.load();
        break;
      case 'tasks':
        if (window.PortalModules && PortalModules.tasks) PortalModules.tasks.init();
        break;
      case 'weekly-reports':
        if (window.PortalModules && PortalModules.weeklyReports) PortalModules.weeklyReports.init();
        break;
      case 'community':
        if (window.PortalModules && PortalModules.community) PortalModules.community.init();
        break;
      case 'messages':
        if (window.PortalModules && PortalModules.messages) PortalModules.messages.init();
        break;
      case 'users':
        if (window.PortalModules && PortalModules.users) PortalModules.users.init();
        break;
      case 'events':
        if (window.PortalModules && PortalModules.events) PortalModules.events.init();
        break;
      case 'reporting-settings':
        if (window.PortalModules && PortalModules.reportingSettings) PortalModules.reportingSettings.init();
        break;
      case 'audit-logs':
        if (window.PortalModules && PortalModules.auditLogs) PortalModules.auditLogs.init();
        break;
    }
  },

  updateUserUI() {
    const user = API.getCurrentUser();
    const userContainer = document.getElementById('header-user-container');
    if (!user || !API.isAuthenticated()) return;

    const roleBadges = {
      admin: { label: '🛡️ Admin / Editor', class: 'badge-primary' },
      chairman: { label: '👑 Chairman', class: 'badge-gold' },
      committee: { label: '🎓 Committee Member', class: 'badge-info' },
      auditor: { label: '📋 Auditor', class: 'badge-warning' }
    };
    const badgeInfo = roleBadges[user.role] || { label: user.role.toUpperCase(), class: 'badge-info' };

    if (userContainer) {
      userContainer.innerHTML = `
        <!-- Notifications Bell -->
        <button class="header-icon-btn" id="btn-header-notifs" title="Chapter Notifications" onclick="PortalModules.notifications.toggleDrawer()">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          <span class="notif-badge-pill" id="header-notif-badge" style="display: none;">0</span>
        </button>

        <!-- User Profile Badge -->
        <div class="user-profile-badge" onclick="PortalModules.account.openModal()" title="View Account Profile">
          <div class="avatar-circle ${user.role === 'chairman' ? 'avatar-gold' : (user.role === 'admin' ? 'avatar-blue' : '')}">
            ${user.name.charAt(0)}
          </div>
          <div class="user-info-text">
            <span class="user-name">${this.escapeHtml(user.name)}</span>
            <span class="user-role-tag">${badgeInfo.label}</span>
          </div>
        </div>
      `;
    }

    // Reveal fixed header logout button
    const logoutBtn = document.getElementById('btn-header-logout');
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';

    // Greet user in dashboard hero
    const greetingEl = document.getElementById('dash-greeting-name');
    if (greetingEl) greetingEl.textContent = user.name;
    const greetingRoleEl = document.getElementById('dash-greeting-role');
    if (greetingRoleEl) greetingRoleEl.textContent = badgeInfo.label;
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('open');
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('open');
    }
  },

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.textContent = message;

    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

// Global bootstrap
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
