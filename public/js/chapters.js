/**
 * MGR IEI Chapter Student Chapter Management Controller
 * Handles table view, search, filters, CRUD modals, and census snapshot updates.
 */

const Chapters = {
  currentList: [],
  activeFilters: {
    search: '',
    status: 'All'
  },

  async load() {
    try {
      const data = await API.getChapters(this.activeFilters);
      this.currentList = data.chapters || [];
      this.renderTable(this.currentList, data.summary);
    } catch (err) {
      App.showToast('Failed to load student chapters: ' + err.message, 'error');
    }
  },

  renderTable(chapters, summary) {
    const tbody = document.getElementById('chapters-table-body');
    if (!tbody) return;

    // Update count labels
    const countBadge = document.getElementById('chapters-total-badge');
    if (countBadge) {
      countBadge.textContent = `${chapters.length} Chapters`;
    }

    if (chapters.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
            No student chapters matched your search or filters.
          </td>
        </tr>
      `;
      return;
    }

    const user = API.getCurrentUser();
    const canEdit = user && (user.role === 'admin' || user.role === 'staff');
    const canDelete = user && user.role === 'admin';

    tbody.innerHTML = chapters.map((ch, idx) => {
      const studentBadge = ch.studentMembersCount !== null
        ? `<strong style="color: var(--iei-navy); font-size: 13.5px;">${ch.studentMembersCount.toLocaleString()}</strong>`
        : `<span class="badge badge-unknown" title="Census pending for current academic cycle">Unknown</span>`;

      const corpBadge = ch.corporateMembersCount !== null
        ? `<strong>${ch.corporateMembersCount}</strong>`
        : `<span class="badge badge-unknown">Unknown</span>`;

      const depts = (ch.departments || []).map(d => `<span class="department-tag">${App.escapeHtml(d)}</span>`).join(' ');
      const advisors = (ch.facultyAdvisors || []).length > 0 
        ? ch.facultyAdvisors.join(', ') 
        : '<span style="color: var(--text-muted); font-style: italic;">To be appointed</span>';

      return `
        <tr>
          <td style="color: var(--text-muted); font-size: 11.5px; width: 40px;">${idx + 1}</td>
          <td>
            <a href="javascript:void(0)" onclick="Chapters.viewDetails('${ch.id}')" style="font-weight: 600; color: var(--iei-navy); text-decoration: none;">
              ${App.escapeHtml(ch.chapterName)}
            </a>
            <div style="font-size: 11px; color: var(--text-muted);">${App.escapeHtml(ch.collegeName)}</div>
          </td>
          <td style="max-width: 280px;">${depts}</td>
          <td style="text-align: center;">${studentBadge}</td>
          <td style="text-align: center;">${corpBadge}</td>
          <td>${App.escapeHtml(advisors)}</td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="btn btn-outline btn-sm" onclick="Chapters.viewDetails('${ch.id}')" title="View Full Profile">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            ${canEdit ? `
              <button class="btn btn-outline btn-sm" onclick="Chapters.openEditModal('${ch.id}')" title="Edit Chapter">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="btn btn-outline btn-sm" onclick="Chapters.openCensusModal('${ch.id}')" title="Record Annual Census">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              </button>
            ` : ''}
            ${canDelete ? `
              <button class="btn btn-danger btn-sm" onclick="Chapters.deleteChapter('${ch.id}')" title="Delete Chapter">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  handleSearch(query) {
    this.activeFilters.search = query;
    this.load();
  },

  handleStatusFilter(status) {
    this.activeFilters.status = status;
    this.load();
  },

  async viewDetails(id) {
    try {
      const data = await API.getChapterById(id);
      const ch = data.chapter;
      const events = data.affiliatedEvents || [];
      const snaps = data.membershipSnapshots || [];

      const modalContent = document.getElementById('chapter-details-content');
      if (!modalContent) return;

      modalContent.innerHTML = `
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 16px;">
          <h2 style="font-size: 19px; color: var(--iei-navy);">${App.escapeHtml(ch.chapterName)}</h2>
          <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
            ${App.escapeHtml(ch.collegeName)} (${ch.collegeCode || 'N/A'}) • Established ${ch.establishedYear} • Status: <span class="badge badge-success">${ch.status}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">
            📍 ${App.escapeHtml(ch.location || 'Tiruvallur Jurisdiction')} | ✉️ ${App.escapeHtml(ch.contactEmail || 'N/A')} | 📞 ${App.escapeHtml(ch.phone || 'N/A')}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div style="background: var(--bg-surface-alt); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Student Members</div>
            <div style="font-size: 24px; font-weight: 800; color: var(--iei-navy); margin-top: 4px;">
              ${ch.studentMembersCount !== null ? ch.studentMembersCount.toLocaleString() : '<span class="badge badge-unknown">Unknown (Census Pending)</span>'}
            </div>
          </div>
          <div style="background: var(--bg-surface-alt); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Corporate Members</div>
            <div style="font-size: 24px; font-weight: 800; color: var(--iei-crimson); margin-top: 4px;">
              ${ch.corporateMembersCount !== null ? ch.corporateMembersCount.toLocaleString() : '<span class="badge badge-unknown">Unknown</span>'}
            </div>
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <h4 style="font-size: 13px; color: var(--iei-navy); margin-bottom: 6px;">Affiliated Engineering Departments</h4>
          <div>${(ch.departments || []).map(d => `<span class="department-tag" style="font-size: 12px; padding: 3px 8px;">${App.escapeHtml(d)}</span>`).join(' ')}</div>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="font-size: 13px; color: var(--iei-navy); margin-bottom: 6px;">Faculty Advisors / Institutional Mentors</h4>
          <p style="font-size: 13px; color: var(--text-primary);">${(ch.facultyAdvisors || []).join(', ') || 'To be nominated by institutional head'}</p>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="font-size: 13px; color: var(--iei-navy); margin-bottom: 6px;">Historical Membership Census Snapshots</h4>
          ${snaps.length > 0 ? `
            <table class="data-table" style="font-size: 12px;">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Student Members</th>
                  <th>Corporate Members</th>
                  <th>Audit Timestamp</th>
                </tr>
              </thead>
              <tbody>
                ${snaps.map(s => `
                  <tr>
                    <td><strong>${s.year}</strong></td>
                    <td>${s.studentCount !== null ? s.studentCount.toLocaleString() : 'Pending'}</td>
                    <td>${s.corporateCount !== null ? s.corporateCount : 'Pending'}</td>
                    <td>${new Date(s.recordedAt).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="font-size: 12px; color: var(--text-muted);">No separate historical snapshots recorded yet.</p>'}
        </div>

        <div>
          <h4 style="font-size: 13px; color: var(--iei-navy); margin-bottom: 6px;">Affiliated Centre Events (${events.length})</h4>
          ${events.length > 0 ? `
            <ul style="font-size: 12.5px; padding-left: 20px; color: var(--text-secondary);">
              ${events.map(e => `
                <li style="margin-bottom: 6px;">
                  <strong>${App.escapeHtml(e.title)}</strong> (${e.eventDate}) • <span class="badge badge-category">${e.category}</span>
                </li>
              `).join('')}
            </ul>
          ` : '<p style="font-size: 12px; color: var(--text-muted);">No events specifically registered under this chapter yet.</p>'}
        </div>
      `;

      App.openModal('modal-chapter-details');
    } catch (err) {
      App.showToast('Failed to fetch chapter profile: ' + err.message, 'error');
    }
  },

  openAddModal() {
    if (!API.isAuthenticated()) {
      App.openModal('modal-login');
      return;
    }

    const form = document.getElementById('form-chapter');
    if (form) form.reset();
    document.getElementById('chapter-form-id').value = '';
    document.getElementById('chapter-modal-title').textContent = 'Register New Student Chapter';
    App.openModal('modal-chapter-form');
  },

  async openEditModal(id) {
    try {
      const data = await API.getChapterById(id);
      const ch = data.chapter;

      document.getElementById('chapter-form-id').value = ch.id;
      document.getElementById('chapter-form-name').value = ch.chapterName || '';
      document.getElementById('chapter-form-college').value = ch.collegeName || '';
      document.getElementById('chapter-form-code').value = ch.collegeCode || '';
      document.getElementById('chapter-form-depts').value = (ch.departments || []).join(', ');
      document.getElementById('chapter-form-students').value = ch.studentMembersCount !== null ? ch.studentMembersCount : '';
      document.getElementById('chapter-form-corporate').value = ch.corporateMembersCount !== null ? ch.corporateMembersCount : '';
      document.getElementById('chapter-form-advisors').value = (ch.facultyAdvisors || []).join(', ');
      document.getElementById('chapter-form-year').value = ch.establishedYear || new Date().getFullYear();
      document.getElementById('chapter-form-status').value = ch.status || 'Active';
      document.getElementById('chapter-form-email').value = ch.contactEmail || '';
      document.getElementById('chapter-form-phone').value = ch.phone || '';
      document.getElementById('chapter-form-location').value = ch.location || '';

      document.getElementById('chapter-modal-title').textContent = 'Edit Student Chapter Record';
      App.openModal('modal-chapter-form');
    } catch (err) {
      App.showToast('Failed to load chapter for editing: ' + err.message, 'error');
    }
  },

  async saveChapter(event) {
    event.preventDefault();
    const id = document.getElementById('chapter-form-id').value;

    const payload = {
      chapterName: document.getElementById('chapter-form-name').value,
      collegeName: document.getElementById('chapter-form-college').value,
      collegeCode: document.getElementById('chapter-form-code').value,
      departments: document.getElementById('chapter-form-depts').value,
      studentMembersCount: document.getElementById('chapter-form-students').value || null,
      corporateMembersCount: document.getElementById('chapter-form-corporate').value || null,
      facultyAdvisors: document.getElementById('chapter-form-advisors').value,
      establishedYear: document.getElementById('chapter-form-year').value,
      status: document.getElementById('chapter-form-status').value,
      contactEmail: document.getElementById('chapter-form-email').value,
      phone: document.getElementById('chapter-form-phone').value,
      location: document.getElementById('chapter-form-location').value
    };

    try {
      if (id) {
        await API.updateChapter(id, payload);
        App.showToast('Student chapter updated successfully.', 'success');
      } else {
        await API.createChapter(payload);
        App.showToast('New student chapter registered successfully.', 'success');
      }

      App.closeModal('modal-chapter-form');
      this.load();
      Dashboard.load(App.selectedYear);
    } catch (err) {
      App.showToast('Failed to save chapter: ' + err.message, 'error');
    }
  },

  async deleteChapter(id) {
    const ch = this.currentList.find(c => c.id === id);
    const name = ch ? ch.chapterName : 'this chapter';

    if (!confirm(`Are you sure you want to delete "${name}" from institutional records? This action is audited.`)) {
      return;
    }

    try {
      await API.deleteChapter(id);
      App.showToast(`Chapter removed successfully.`, 'info');
      this.load();
      Dashboard.load(App.selectedYear);
    } catch (err) {
      App.showToast('Failed to delete chapter: ' + err.message, 'error');
    }
  },

  openCensusModal(id) {
    const ch = this.currentList.find(c => c.id === id);
    if (!ch) return;

    document.getElementById('census-chapter-id').value = ch.id;
    document.getElementById('census-chapter-name').textContent = ch.chapterName;
    document.getElementById('census-year').value = new Date().getFullYear();
    document.getElementById('census-students').value = ch.studentMembersCount !== null ? ch.studentMembersCount : '';
    document.getElementById('census-corporate').value = ch.corporateMembersCount !== null ? ch.corporateMembersCount : '';

    App.openModal('modal-census-form');
  },

  async submitCensus(event) {
    event.preventDefault();
    const id = document.getElementById('census-chapter-id').value;
    const year = document.getElementById('census-year').value;
    const studentCount = document.getElementById('census-students').value || null;
    const corporateCount = document.getElementById('census-corporate').value || null;

    try {
      await API.recordChapterSnapshot(id, { year, studentCount, corporateCount });
      App.showToast(`Recorded census snapshot for ${year}.`, 'success');
      App.closeModal('modal-census-form');
      this.load();
      Dashboard.load(App.selectedYear);
    } catch (err) {
      App.showToast('Failed to record census: ' + err.message, 'error');
    }
  }
};
