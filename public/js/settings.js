/**
 * MGR IEI Chapter Administration & Security Settings Controller
 * Handles user management, security logs, and institutional integration settings.
 */

const Settings = {
  async load() {
    const container = document.getElementById('view-settings');
    if (!container) return;

    try {
      const user = API.getCurrentUser();
      this.renderProfileCard(user);

      if (user && user.role === 'admin') {
        const usersData = await API.getUsers();
        this.renderUsersList(usersData.users || []);
      }

      if (user && (user.role === 'admin' || user.role === 'auditor')) {
        const logsData = await API.getAuditLogs(50);
        this.renderAuditLogs(logsData.logs || []);
      }
    } catch (err) {
      console.warn('Settings load notice:', err.message);
    }
  },

  renderProfileCard(user) {
    const box = document.getElementById('settings-profile-box');
    if (!box) return;

    if (!user) {
      box.innerHTML = `
        <div style="padding: 16px; background: var(--bg-surface-alt); border-radius: var(--radius-md);">
          <p style="color: var(--text-muted); font-size: 13px;">You are currently browsing in read-only mode.</p>
          <button class="btn btn-primary btn-sm" onclick="App.openModal('modal-login')" style="margin-top: 10px;">Sign In with Staff Account</button>
        </div>
      `;
      return;
    }

    box.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px;">
        <div class="avatar-circle" style="width: 50px; height: 50px; font-size: 18px;">
          ${user.name.charAt(0)}
        </div>
        <div>
          <h3 style="font-size: 16px; color: var(--iei-navy);">${App.escapeHtml(user.name)}</h3>
          <div style="font-size: 12.5px; color: var(--text-muted);">${App.escapeHtml(user.email)} • <span class="badge badge-category">${user.role.toUpperCase()}</span></div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
            ${App.escapeHtml(user.designation || 'Staff')} (${App.escapeHtml(user.department || 'Centre')})
          </div>
        </div>
      </div>
    `;
  },

  renderUsersList(users) {
    const tbody = document.getElementById('settings-users-body');
    if (!tbody) return;

    tbody.innerHTML = users.map(u => `
      <tr>
        <td><strong>${App.escapeHtml(u.name)}</strong></td>
        <td>${App.escapeHtml(u.email)}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-danger' : (u.role === 'staff' ? 'badge-info' : 'badge-warning')}">${u.role.toUpperCase()}</span></td>
        <td>${App.escapeHtml(u.designation || '')}</td>
        <td><span class="badge badge-success">Active</span></td>
      </tr>
    `).join('');
  },

  renderAuditLogs(logs) {
    const tbody = document.getElementById('settings-audit-body');
    if (!tbody) return;

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No audit logs recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td style="font-size: 11px; white-space: nowrap; color: var(--text-muted);">${new Date(l.timestamp).toLocaleString()}</td>
        <td><span class="badge badge-category" style="font-size: 10.5px;">${App.escapeHtml(l.action)}</span></td>
        <td><strong>${App.escapeHtml(l.performedBy)}</strong> <span style="font-size: 10px; color: var(--text-muted);">(${l.role})</span></td>
        <td>${App.escapeHtml(l.target)}</td>
        <td style="font-size: 12px; color: var(--text-secondary);">${App.escapeHtml(l.details)}</td>
      </tr>
    `).join('');
  }
};
