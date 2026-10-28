/**
 * MGR IEI Chapter Event Management Controller
 * Handles Technical Lectures, Statutory Days, file uploads (posters & reports),
 * filtering, search, and CRUD workflows.
 */

const Events = {
  currentList: [],
  activeFilters: {
    search: '',
    category: 'All',
    status: 'All',
    year: 'All',
    month: 'All',
    chapterId: 'All'
  },

  async load() {
    try {
      const data = await API.getEvents(this.activeFilters);
      this.currentList = data.events || [];
      this.renderTable(this.currentList);
    } catch (err) {
      App.showToast('Failed to load events: ' + err.message, 'error');
    }
  },

  renderTable(events) {
    const tbody = document.getElementById('events-table-body');
    if (!tbody) return;

    const countBadge = document.getElementById('events-total-badge');
    if (countBadge) {
      countBadge.textContent = `${events.length} Events`;
    }

    if (events.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
            No events found matching the specified criteria.
          </td>
        </tr>
      `;
      return;
    }

    const user = API.getCurrentUser();
    const canEdit = user && (user.role === 'admin' || user.role === 'staff');
    const canDelete = user && user.role === 'admin';

    tbody.innerHTML = events.map((ev, idx) => {
      let statusBadge = `<span class="badge badge-info">${ev.status}</span>`;
      if (ev.status === 'Completed') {
        statusBadge = `<span class="badge badge-success">Completed</span>`;
      } else if (ev.status === 'Upcoming') {
        statusBadge = `<span class="badge badge-warning">Upcoming</span>`;
      } else if (ev.status === 'Cancelled') {
        statusBadge = `<span class="badge badge-danger">Cancelled</span>`;
      }

      let categoryBadge = `<span class="badge badge-category">${ev.category}</span>`;
      if (ev.category === 'Statutory Day') {
        categoryBadge = `<span class="badge" style="background: var(--iei-crimson-subtle); color: var(--iei-crimson);">Statutory Day</span>`;
      }

      const filesIndicator = [];
      if (ev.posterUrl) {
        filesIndicator.push(`<span title="Poster uploaded" style="color: var(--iei-royal-blue); font-size: 11px;">🖼️ Poster</span>`);
      }
      if (ev.reportUrl) {
        filesIndicator.push(`<span title="Report uploaded" style="color: var(--color-success); font-size: 11px;">📄 Report</span>`);
      }

      return `
        <tr>
          <td style="color: var(--text-muted); font-size: 11.5px; width: 40px;">${idx + 1}</td>
          <td>
            <a href="javascript:void(0)" onclick="Events.viewDetails('${ev.id}')" style="font-weight: 600; color: var(--iei-navy); text-decoration: none;">
              ${App.escapeHtml(ev.title)}
            </a>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
              ${App.escapeHtml(ev.collegeOrChapter)}
            </div>
            ${filesIndicator.length > 0 ? `<div style="margin-top: 4px; display: flex; gap: 8px;">${filesIndicator.join('')}</div>` : ''}
          </td>
          <td>${categoryBadge}</td>
          <td style="white-space: nowrap;">
            <strong>${ev.eventDate}</strong>
            <div style="font-size: 11px; color: var(--text-muted);">${ev.eventTime || '10:00 AM'}</div>
          </td>
          <td>
            <div style="font-weight: 500; font-size: 12.5px;">${App.escapeHtml(ev.speakerName || 'To be announced')}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${App.escapeHtml(ev.speakerOrg || '')}</div>
          </td>
          <td style="text-align: center;">${statusBadge}</td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="btn btn-outline btn-sm" onclick="Events.viewDetails('${ev.id}')" title="View Event Summary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            ${canEdit ? `
              <button class="btn btn-outline btn-sm" onclick="Events.openEditModal('${ev.id}')" title="Edit Event">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
            ` : ''}
            ${canDelete ? `
              <button class="btn btn-danger btn-sm" onclick="Events.deleteEvent('${ev.id}')" title="Delete Event">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  handleFilterChange(key, value) {
    this.activeFilters[key] = value;
    this.load();
  },

  async viewDetails(id) {
    try {
      const data = await API.getEventById(id);
      const ev = data.event;

      const modalContent = document.getElementById('event-details-content');
      if (!modalContent) return;

      modalContent.innerHTML = `
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 16px;">
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <span class="badge badge-category">${ev.category}</span>
            <span class="badge ${ev.status === 'Completed' ? 'badge-success' : 'badge-warning'}">${ev.status}</span>
          </div>
          <h2 style="font-size: 19px; color: var(--iei-navy);">${App.escapeHtml(ev.title)}</h2>
          <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
            📅 ${ev.eventDate} at ${ev.eventTime || '10:00 AM'} • Reporting Year ${ev.reportingYear}
          </div>
          <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">
            🏛️ <strong>Organizing Unit:</strong> ${App.escapeHtml(ev.collegeOrChapter)}
          </div>
        </div>

        <div style="background: var(--bg-surface-alt); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; margin-bottom: 16px;">
          <h4 style="font-size: 12.5px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin-bottom: 6px;">
            Distinguished Speaker & Venue
          </h4>
          <div style="font-size: 14px; font-weight: 700; color: var(--iei-navy);">
            ${App.escapeHtml(ev.speakerName || 'Speaker details pending')}
          </div>
          <div style="font-size: 12.5px; color: var(--text-secondary);">
            ${App.escapeHtml(ev.speakerDesignation || '')} ${ev.speakerOrg ? `• ${App.escapeHtml(ev.speakerOrg)}` : ''}
          </div>
          <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 6px;">
            📍 <strong>Venue:</strong> ${App.escapeHtml(ev.venue || 'MGR IEI Chapter Auditorium / Virtual Webinar')}
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="font-size: 13px; color: var(--iei-navy); margin-bottom: 6px;">Programme Description & Objectives</h4>
          <p style="font-size: 13px; color: var(--text-primary); line-height: 1.6;">
            ${App.escapeHtml(ev.description || 'No description provided.')}
          </p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div style="border: 1px dashed var(--border-dark); padding: 14px; border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 11.5px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;">Event Poster Graphic</div>
            ${ev.posterUrl ? `
              <img src="${ev.posterUrl}" alt="Poster" style="max-height: 140px; max-width: 100%; border-radius: var(--radius-sm); object-fit: contain; box-shadow: var(--shadow-sm); margin-bottom: 8px;">
              <div>
                <a href="${ev.posterUrl}" target="_blank" class="btn btn-outline btn-sm">View Full Image</a>
              </div>
            ` : '<div style="font-size: 12px; color: var(--text-muted); padding: 20px 0;">No poster graphic uploaded.</div>'}
          </div>

          <div style="border: 1px dashed var(--border-dark); padding: 14px; border-radius: var(--radius-md); text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <div style="font-size: 11.5px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;">Technical Event Report</div>
            ${ev.reportUrl ? `
              <div style="font-size: 32px; margin-bottom: 8px;">📄</div>
              <a href="${ev.reportUrl}" target="_blank" class="btn btn-primary btn-sm">Download Event Report</a>
            ` : '<div style="font-size: 12px; color: var(--text-muted); padding: 20px 0;">No official report document attached yet.</div>'}
          </div>
        </div>

        <div style="font-size: 12px; color: var(--text-muted); border-top: 1px solid var(--border-color); padding-top: 12px;">
          Verified Attendees: <strong>${ev.attendeesCount !== null ? ev.attendeesCount.toLocaleString() : 'Pending tally'}</strong> delegates
        </div>
      `;

      App.openModal('modal-event-details');
    } catch (err) {
      App.showToast('Failed to load event details: ' + err.message, 'error');
    }
  },

  async openAddModal() {
    if (!API.isAuthenticated()) {
      App.openModal('modal-login');
      return;
    }

    const form = document.getElementById('form-event');
    if (form) form.reset();
    document.getElementById('event-form-id').value = '';
    document.getElementById('event-modal-title').textContent = 'Create New Centre Programme / Lecture';

    // Populate chapters dropdown
    await this.populateChapterSelect();

    App.openModal('modal-event-form');
  },

  async openEditModal(id) {
    try {
      const data = await API.getEventById(id);
      const ev = data.event;

      await this.populateChapterSelect();

      document.getElementById('event-form-id').value = ev.id;
      document.getElementById('event-form-title').value = ev.title || '';
      document.getElementById('event-form-category').value = ev.category || 'Technical Lecture';
      document.getElementById('event-form-date').value = ev.eventDate || '';
      document.getElementById('event-form-time').value = ev.eventTime || '10:00 AM';
      document.getElementById('event-form-chapter').value = ev.chapterId || '';
      document.getElementById('event-form-college').value = ev.collegeOrChapter || '';
      document.getElementById('event-form-speaker').value = ev.speakerName || '';
      document.getElementById('event-form-designation').value = ev.speakerDesignation || '';
      document.getElementById('event-form-org').value = ev.speakerOrg || '';
      document.getElementById('event-form-venue').value = ev.venue || '';
      document.getElementById('event-form-status').value = ev.status || 'Upcoming';
      document.getElementById('event-form-attendees').value = ev.attendeesCount !== null ? ev.attendeesCount : '';
      document.getElementById('event-form-desc').value = ev.description || '';

      document.getElementById('event-modal-title').textContent = 'Edit Event Record';
      App.openModal('modal-event-form');
    } catch (err) {
      App.showToast('Failed to load event for editing: ' + err.message, 'error');
    }
  },

  async populateChapterSelect() {
    const sel = document.getElementById('event-form-chapter');
    if (!sel) return;

    try {
      const data = await API.getChapters();
      sel.innerHTML = `
        <option value="">MGR IEI Chapter Central Headquarters</option>
        ${data.chapters.map(ch => `
          <option value="${ch.id}">${App.escapeHtml(ch.chapterName)} (${App.escapeHtml(ch.collegeCode || ch.collegeName)})</option>
        `).join('')}
      `;
    } catch (e) {}
  },

  handleChapterSelectChange(selectElem) {
    const selectedText = selectElem.options[selectElem.selectedIndex].text;
    const collegeInput = document.getElementById('event-form-college');
    if (collegeInput && selectElem.value) {
      collegeInput.value = selectedText;
    }
  },

  async saveEvent(event) {
    event.preventDefault();
    const id = document.getElementById('event-form-id').value;
    const form = document.getElementById('form-event');
    const formData = new FormData(form);

    try {
      if (id) {
        await API.updateEvent(id, formData);
        App.showToast('Event updated successfully.', 'success');
      } else {
        await API.createEvent(formData);
        App.showToast('Event scheduled successfully.', 'success');
      }

      App.closeModal('modal-event-form');
      this.load();
      Dashboard.load(App.selectedYear);
    } catch (err) {
      App.showToast('Failed to save event: ' + err.message, 'error');
    }
  },

  async deleteEvent(id) {
    const ev = this.currentList.find(e => e.id === id);
    const title = ev ? ev.title : 'this event';

    if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await API.deleteEvent(id);
      App.showToast('Event record deleted.', 'info');
      this.load();
      Dashboard.load(App.selectedYear);
    } catch (err) {
      App.showToast('Failed to delete event: ' + err.message, 'error');
    }
  }
};
