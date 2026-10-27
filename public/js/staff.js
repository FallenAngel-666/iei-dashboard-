/**
 * IEI TVLC Staff Face Interface Controller
 * Provides focused data entry with standardized drop boxes for staff officers.
 */

const StaffFace = {
  chaptersList: [],

  async init() {
    this.bindEvents();
    await this.loadChaptersDropdowns();
  },

  bindEvents() {
    const eventForm = document.getElementById('form-staff-event');
    if (eventForm) {
      eventForm.addEventListener('submit', (e) => this.submitEvent(e));
    }

    const intakeForm = document.getElementById('form-staff-intake');
    if (intakeForm) {
      intakeForm.addEventListener('submit', (e) => this.submitIntake(e));
    }
  },

  async loadChaptersDropdowns() {
    try {
      const user = API.getCurrentUser();
      const isCoordinator = user && user.role === 'coordinator' && user.assignedChapterId;

      const res = await API.getChapters();
      this.chaptersList = res.chapters || [];

      // 1. Host Chapter Dropdown in Event Form
      const eventChapterSelect = document.getElementById('staff-event-chapter');
      if (eventChapterSelect) {
        let html = '';
        if (isCoordinator) {
          const myChapter = this.chaptersList.find(c => c.id === user.assignedChapterId);
          const chName = myChapter ? `${myChapter.collegeName} (${myChapter.collegeCode || myChapter.chapterName})` : 'Authorized Chapter';
          html += `<option value="${user.assignedChapterId}">${App.escapeHtml(chName)} [Assigned Chapter]</option>`;
          eventChapterSelect.innerHTML = html;
          eventChapterSelect.disabled = true;
        } else {
          html = '<option value="">-- Select Host Collegiate Chapter / Centre --</option>';
          html += '<option value="central_tvlc">Central TVLC (Tiruvallur Local Centre)</option>';
          this.chaptersList.forEach(ch => {
            html += `<option value="${ch.id}">${App.escapeHtml(ch.collegeName)} (${App.escapeHtml(ch.collegeCode || ch.chapterName)})</option>`;
          });
          eventChapterSelect.innerHTML = html;
          eventChapterSelect.disabled = false;
        }
      }

      // 2. Institution Dropdown in Membership Intake Form
      const intakeInstSelect = document.getElementById('staff-intake-institution');
      if (intakeInstSelect) {
        let html = '';
        if (isCoordinator) {
          const myChapter = this.chaptersList.find(c => c.id === user.assignedChapterId);
          const instTitle = myChapter ? myChapter.collegeName : 'Authorized Chapter';
          html += `<option value="${user.assignedChapterId}" data-name="${App.escapeHtml(instTitle)}">${App.escapeHtml(instTitle)} [Assigned Chapter]</option>`;
          intakeInstSelect.innerHTML = html;
          intakeInstSelect.disabled = true;
        } else {
          html = '<option value="">-- Select Institution / College --</option>';
          this.chaptersList.forEach(ch => {
            html += `<option value="${ch.id}" data-name="${App.escapeHtml(ch.collegeName)}">${App.escapeHtml(ch.collegeName)}</option>`;
          });
          // Also add non-chapter institutions from report if any
          html += '<option value="custom_tjs" data-name="T.J.S. Engineering College">T.J.S. Engineering College</option>';
          intakeInstSelect.innerHTML = html;
          intakeInstSelect.disabled = false;
        }
      }
    } catch (err) {
      console.error('[StaffFace] Error loading chapters:', err);
    }
  },

  async load() {
    await this.loadChaptersDropdowns();
    await this.loadRecentActivities();
    await this.loadRecentIntakes();
  },

  async loadRecentActivities() {
    const container = document.getElementById('staff-recent-activities-body');
    if (!container) return;

    try {
      const user = API.getCurrentUser();
      const filters = { limit: 15 };
      if (user && (user.role === 'coordinator' || user.assignedChapterId) && user.assignedChapterId) {
        filters.chapterId = user.assignedChapterId;
      }
      const res = await API.getEvents(filters);
      const events = res.events || [];

      if (events.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 24px; color: var(--text-muted);">No recorded activities yet.</td></tr>';
        return;
      }

      container.innerHTML = events.map((ev, index) => {
        let catBadge = 'badge-primary';
        if (ev.category === 'Statutory Day') catBadge = 'badge-danger';
        else if (ev.category === 'Workshop' || ev.category === 'Workshop/Seminar') catBadge = 'badge-warning';

        return `
          <tr>
            <td><strong>#${index + 1}</strong></td>
            <td>
              <div style="font-weight: 600; color: var(--iei-navy);">${App.escapeHtml(ev.title)}</div>
              <div style="font-size: 12px; color: var(--text-muted);">${ev.speakerName ? App.escapeHtml(ev.speakerName) : 'Centre Programme'}</div>
            </td>
            <td><span class="badge ${catBadge}">${App.escapeHtml(ev.category)}</span></td>
            <td>${App.formatDate(ev.eventDate)}</td>
            <td><span class="location-tag">${App.escapeHtml(ev.venue || ev.collegeOrChapter || 'Campus')}</span></td>
            <td style="text-align: right; font-weight: 700; color: var(--iei-navy);">${(ev.attendeesCount || 0).toLocaleString()}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('[StaffFace] Error loading activities:', err);
      container.innerHTML = `<tr><td colspan="6" style="color: var(--color-danger); padding: 16px;">Failed to load activities: ${App.escapeHtml(err.message)}</td></tr>`;
    }
  },

  async loadRecentIntakes() {
    const container = document.getElementById('staff-recent-intake-body');
    if (!container) return;

    try {
      const user = API.getCurrentUser();
      const filters = { year: '2026' };
      if (user && (user.role === 'coordinator' || user.assignedChapterId) && user.assignedChapterId) {
        filters.chapterId = user.assignedChapterId;
      }
      const res = await API.getIntakeRecords(filters);
      const intakeList = res.records || [];

      if (intakeList.length === 0) {
        container.innerHTML = '<tr><td colspan="4" class="text-center" style="padding: 24px; color: var(--text-muted);">No intake records logged.</td></tr>';
        return;
      }

      container.innerHTML = intakeList.map((item, idx) => `
        <tr>
          <td><strong>#${idx + 1}</strong></td>
          <td><strong>${App.escapeHtml(item.institutionName)}</strong></td>
          <td style="text-align: right; font-weight: 700; color: var(--color-success); font-size: 15px;">+${Number(item.studentNew || 0).toLocaleString()}</td>
          <td style="text-align: right; color: var(--text-secondary);">${Number(item.corporateNew || 0).toLocaleString()}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('[StaffFace] Error loading intakes:', err);
    }
  },

  async submitEvent(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving Record...';
    }

    try {
      const user = API.getCurrentUser();
      const isCoordinator = user && (user.role === 'coordinator' || user.assignedChapterId) && user.assignedChapterId;

      const formData = new FormData(form);
      
      // Auto assign reportingYear from date if not present
      const dateVal = formData.get('eventDate');
      if (dateVal) {
        formData.append('reportingYear', new Date(dateVal).getFullYear());
      }

      if (isCoordinator) {
        formData.set('chapterId', user.assignedChapterId);
        const myChapter = this.chaptersList.find(c => c.id === user.assignedChapterId);
        if (myChapter) {
          formData.set('collegeOrChapter', myChapter.collegeName);
        }
      } else {
        // Auto resolve chapter name if chapter selected
        const chapterId = formData.get('chapterId');
        if (chapterId && chapterId !== 'central_tvlc') {
          const found = this.chaptersList.find(c => c.id === chapterId);
          if (found && !formData.get('collegeOrChapter')) {
            formData.append('collegeOrChapter', found.collegeName);
          }
        } else if (chapterId === 'central_tvlc') {
          formData.append('collegeOrChapter', 'IEI Tiruvallur Local Centre');
        }
      }

      const res = await API.createEvent(formData);
      App.showToast(`Activity "${res.event.title}" saved successfully!`, 'success');
      form.reset();

      // Refresh recent table
      await this.loadRecentActivities();
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Activity Record';
      }
    }
  },

  async submitIntake(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving Intake...';
    }

    try {
      const user = API.getCurrentUser();
      const isCoordinator = user && (user.role === 'coordinator' || user.assignedChapterId) && user.assignedChapterId;

      let instName = 'Institution';
      let chapterId = null;

      if (isCoordinator) {
        chapterId = user.assignedChapterId;
        const myChapter = this.chaptersList.find(c => c.id === user.assignedChapterId);
        instName = myChapter ? myChapter.collegeName : 'Assigned Collegiate Chapter';
      } else {
        const instSelect = document.getElementById('staff-intake-institution');
        const selectedOpt = instSelect.options[instSelect.selectedIndex];
        instName = selectedOpt ? selectedOpt.getAttribute('data-name') || selectedOpt.text : 'Institution';
        chapterId = instSelect.value.startsWith('ch_') ? instSelect.value : null;

        if (!instSelect.value) {
          throw new Error('Please select an institution from the drop box.');
        }
      }

      const year = document.getElementById('staff-intake-year').value;
      const studentNew = document.getElementById('staff-intake-students').value;
      const corporateNew = document.getElementById('staff-intake-corporate').value;

      if (!studentNew && !corporateNew) {
        throw new Error('Please enter at least student or corporate membership intake count.');
      }

      await API.recordMembershipIntake({
        year,
        chapterId,
        institutionName: instName,
        studentNew: Number(studentNew) || 0,
        corporateNew: Number(corporateNew) || 0
      });

      App.showToast(`Membership intake for "${instName}" recorded successfully!`, 'success');
      form.reset();

      // Refresh recent intake table
      await this.loadRecentIntakes();
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Membership Intake Record';
      }
    }
  }
};
