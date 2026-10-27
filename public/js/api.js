/**
 * IEI TVLC API Client
 * Centralized REST client with dual-transport authentication (Bearer Header + Secure Cookie).
 */

const API = {
  tokenKey: 'iei_tvlc_token',
  userKey: 'iei_tvlc_user_profile',

  getToken() {
    return localStorage.getItem(this.tokenKey) || '';
  },

  setAuth(token, user) {
    if (token) {
      localStorage.setItem(this.tokenKey, token);
    }
    if (user) {
      localStorage.setItem(this.userKey, JSON.stringify(user));
    }
  },

  clearAuth() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  },

  getCurrentUser() {
    try {
      const u = localStorage.getItem(this.userKey);
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  },

  isAuthenticated() {
    return Boolean(this.getToken() && this.getCurrentUser());
  },

  async request(endpoint, options = {}) {
    const headers = options.headers || {};
    const token = this.getToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers,
      credentials: 'include'
    };

    try {
      const res = await fetch(endpoint, config);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401 && endpoint !== '/api/auth/login') {
          this.clearAuth();
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
        throw new Error(data.error || `Server returned error (${res.status})`);
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  },

  // Auth endpoints
  async login(email, password) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.token && res.user) {
      this.setAuth(res.token, res.user);
    }
    return res;
  },

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    this.clearAuth();
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  // Chapters endpoints
  async getChapters(filters = {}) {
    const q = new URLSearchParams(filters).toString();
    return this.request(`/api/chapters${q ? '?' + q : ''}`);
  },

  async getChapterById(id) {
    return this.request(`/api/chapters/${id}`);
  },

  async createChapter(data) {
    return this.request('/api/chapters', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateChapter(id, data) {
    return this.request(`/api/chapters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteChapter(id) {
    return this.request(`/api/chapters/${id}`, {
      method: 'DELETE'
    });
  },

  async recordChapterSnapshot(id, snapshotData) {
    return this.request(`/api/chapters/${id}/snapshot`, {
      method: 'POST',
      body: JSON.stringify(snapshotData)
    });
  },

  async recordMembershipIntake(data) {
    return this.request('/api/chapters/intake/record', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getIntakeRecords(filters = {}) {
    const q = new URLSearchParams(filters).toString();
    return this.request(`/api/chapters/intake/records${q ? '?' + q : ''}`);
  },

  // Events endpoints
  async getEvents(filters = {}) {
    const q = new URLSearchParams(filters).toString();
    return this.request(`/api/events${q ? '?' + q : ''}`);
  },

  async getEventById(id) {
    return this.request(`/api/events/${id}`);
  },

  async createEvent(formData) {
    return this.request('/api/events', {
      method: 'POST',
      body: formData
    });
  },

  async updateEvent(id, formData) {
    return this.request(`/api/events/${id}`, {
      method: 'PUT',
      body: formData
    });
  },

  async deleteEvent(id) {
    return this.request(`/api/events/${id}`, {
      method: 'DELETE'
    });
  },

  // Analytics endpoints
  async getAnalyticsOverview(year) {
    const q = year ? `?year=${year}` : '';
    return this.request(`/api/analytics/overview${q}`);
  },

  async getMembershipAnalytics(year) {
    const q = year ? `?year=${year}` : '';
    return this.request(`/api/analytics/membership${q}`);
  },

  async getEventAnalytics(year) {
    const q = year ? `?year=${year}` : '';
    return this.request(`/api/analytics/events${q}`);
  },

  // Administration endpoints
  async getUsers() {
    return this.request('/api/admin/users');
  },

  async getAuditLogs(limit = 100) {
    return this.request(`/api/admin/audit-logs?limit=${limit}`);
  }
};
