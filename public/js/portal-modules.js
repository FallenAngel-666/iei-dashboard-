/**
 * ============================================================================
 * MGR IEI STUDENTS CHAPTER — CORE FUNCTIONAL MODULES
 * ============================================================================
 * 
 * Implements:
 * 1. Universal Dashboard Intelligence & Executive Welcome Hero
 * 2. Persistent Task Management (ASSIGNED -> IN_PROGRESS -> SUBMITTED_FOR_REVIEW -> APPROVED)
 * 3. Weekly Reporting Workflow with Asia/Kolkata Cycle Deadlines
 * 4. Google Classroom-Style Shared Community Stream with Inline Replies & Attachments
 * 5. Secure Private Messaging between Members and Admin/Editor
 * 6. User Account Administration (Admin only)
 * 7. Announcements & Chapter Events
 * 8. Reporting Settings Configuration (Admin only)
 * 9. Audit Logs & Compliance Observations (Admin & Auditor)
 * 10. Instant 4-Role Perspective Switcher
 */

const PortalModules = {

  // ==========================================
  // 1. DASHBOARD OVERVIEW
  // ==========================================
  dashboard: {
    async load() {
      const user = API.getCurrentUser() || { name: 'Member', role: 'committee' };
      const nameEl = document.getElementById('dash-greeting-name');
      if (nameEl) nameEl.textContent = user.name;

      try {
        const [tasksRes, repRes, commRes, notifRes] = await Promise.all([
          API.request('/api/tasks').catch(() => ({ tasks: [] })),
          API.request('/api/weekly-reports').catch(() => ({ reports: [] })),
          API.request('/api/community').catch(() => ({ posts: [] })),
          API.request('/api/notifications').catch(() => ({ notifications: [] }))
        ]);

        const tasks = tasksRes.tasks || [];
        const reports = repRes.reports || [];
        const posts = commRes.posts || [];

        // KPI 1: Active Tasks
        const activeTasks = tasks.filter(t => t.status !== 'APPROVED');
        const kpiTasks = document.getElementById('dash-kpi-tasks');
        if (kpiTasks) kpiTasks.textContent = activeTasks.length;

        // KPI 2: Completed / Approved Tasks
        const approvedTasks = tasks.filter(t => t.status === 'APPROVED');
        const kpiApproved = document.getElementById('dash-kpi-completed');
        if (kpiApproved) kpiApproved.textContent = approvedTasks.length;

        // KPI 3: Current Weekly Report Status
        const kpiReport = document.getElementById('dash-kpi-report-status');
        const currentReport = reports.find(r => r.weekNumber === 45) || reports[0];
        if (kpiReport) {
          kpiReport.textContent = currentReport ? currentReport.status : 'PENDING';
          kpiReport.className = `kpi-value ${currentReport && currentReport.status === 'APPROVED' ? 'text-success' : 'text-gold'}`;
        }

        // KPI 4: Community Discussions
        const kpiComm = document.getElementById('dash-kpi-discussions');
        if (kpiComm) kpiComm.textContent = posts.length;

        // Assigned Tasks Spotlight
        const taskSpotlight = document.getElementById('dash-task-spotlight');
        if (taskSpotlight) {
          const myTasks = (user.role === 'committee') 
            ? tasks.filter(t => t.assignedTo === user.id || t.assignedToName === user.name)
            : tasks;
          
          if (myTasks.length === 0) {
            taskSpotlight.innerHTML = `
              <div class="empty-state-card">
                <p>No active tasks assigned to you. All chapter assignments are up to date.</p>
              </div>
            `;
          } else {
            taskSpotlight.innerHTML = myTasks.slice(0, 3).map(t => `
              <div class="spotlight-task-card" onclick="App.navigate('tasks')">
                <div class="st-header">
                  <span class="badge ${t.priority === 'urgent' ? 'badge-danger' : (t.priority === 'high' ? 'badge-gold' : 'badge-info')}">
                    ${t.priority.toUpperCase()}
                  </span>
                  <span class="st-status badge ${t.status === 'APPROVED' ? 'badge-success' : (t.status === 'REVISION_REQUESTED' ? 'badge-danger' : 'badge-gold')}">
                    ${t.status}
                  </span>
                </div>
                <h4 class="st-title">${App.escapeHtml(t.title)}</h4>
                <div class="st-meta">
                  <span>📅 Due: ${t.dueDate}</span>
                  <span>⚡ Progress: ${t.progress || 0}%</span>
                </div>
                <div class="st-progress-bar">
                  <div class="st-progress-fill" style="width: ${t.progress || 0}%;"></div>
                </div>
              </div>
            `).join('');
          }
        }

        // Pinned Announcements Spotlight
        const announcementsContainer = document.getElementById('dash-announcements-container');
        if (announcementsContainer) {
          const announcements = posts.filter(p => p.type === 'announcement' || p.isPinned);
          if (announcements.length === 0) {
            announcementsContainer.innerHTML = `<p class="text-muted" style="padding: 16px;">No announcements posted for this cycle.</p>`;
          } else {
            announcementsContainer.innerHTML = announcements.slice(0, 2).map(a => `
              <div class="dash-announcement-card" onclick="App.navigate('community')">
                <div class="da-badge">📢 CHAPTER ANNOUNCEMENT</div>
                <h4 class="da-title">${App.escapeHtml(a.title)}</h4>
                <p class="da-content">${App.escapeHtml(a.content.substring(0, 140))}...</p>
                <div class="da-footer">
                  <span>Posted by <strong>${App.escapeHtml(a.author)}</strong></span>
                  <span>${new Date(a.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            `).join('');
          }
        }

      } catch (err) {
        console.warn('Dashboard data fetch note:', err);
      }
    }
  },

  // ==========================================
  // 2. PERSISTENT TASK MANAGEMENT
  // ==========================================
  tasks: {
    currentTasks: [],
    viewMode: 'kanban',
    searchTerm: '',
    quickFilter: 'all',
    priorityFilter: 'all',
    deptFilter: 'all',

    async init() {
      await this.loadTasks();
      this.bindEvents();
    },

    setQuickFilter(filterKey) {
      this.quickFilter = filterKey;
      const pills = ['all', 'my', 'overdue', 'review', 'corrections', 'completed'];
      pills.forEach(p => {
        const el = document.getElementById(`filter-pill-${p}`);
        if (el) {
          if (p === filterKey) el.classList.add('active');
          else el.classList.remove('active');
        }
      });
      if (this.viewMode === 'list') {
        this.renderListView();
      } else {
        this.renderKanban();
      }
    },

    getFilteredTasks() {
      const user = API.getCurrentUser() || {};
      const now = new Date();
      return this.currentTasks.filter(t => {
        // Quick filter
        if (this.quickFilter === 'my') {
          const isMy = t.assignedTo === user.id || t.assignedToName === user.name;
          if (!isMy) return false;
        } else if (this.quickFilter === 'overdue') {
          const isOverdue = new Date(t.dueDate) < now && t.status !== 'APPROVED';
          if (!isOverdue) return false;
        } else if (this.quickFilter === 'review') {
          if (t.status !== 'SUBMITTED_FOR_REVIEW') return false;
        } else if (this.quickFilter === 'corrections') {
          if (t.status !== 'REVISION_REQUESTED') return false;
        } else if (this.quickFilter === 'completed') {
          if (t.status !== 'APPROVED') return false;
        }

        // Priority filter
        if (this.priorityFilter && this.priorityFilter !== 'all') {
          if ((t.priority || '').toLowerCase() !== this.priorityFilter.toLowerCase()) return false;
        }

        // Department filter
        if (this.deptFilter && this.deptFilter !== 'all') {
          if (t.department !== this.deptFilter) return false;
        }

        // Search filter
        if (this.searchTerm) {
          const q = this.searchTerm.toLowerCase();
          const matches = (t.title && t.title.toLowerCase().includes(q)) ||
            (t.assignedToName && t.assignedToName.toLowerCase().includes(q)) ||
            (t.department && t.department.toLowerCase().includes(q)) ||
            (t.description && t.description.toLowerCase().includes(q));
          if (!matches) return false;
        }

        return true;
      });
    },

    setViewMode(mode) {
      this.viewMode = mode;
      const kanbanEl = document.getElementById('tasks-kanban-board');
      const listEl = document.getElementById('tasks-list-container');
      const btnKanban = document.getElementById('btn-tasks-kanban-toggle');
      const btnList = document.getElementById('btn-tasks-list-toggle');

      if (mode === 'list') {
        if (kanbanEl) kanbanEl.style.display = 'none';
        if (listEl) listEl.style.display = 'block';
        if (btnKanban) btnKanban.classList.remove('active');
        if (btnList) btnList.classList.add('active');
        this.renderListView();
      } else {
        if (kanbanEl) kanbanEl.style.display = 'grid';
        if (listEl) listEl.style.display = 'none';
        if (btnKanban) btnKanban.classList.add('active');
        if (btnList) btnList.classList.remove('active');
        this.renderKanban();
      }
    },

    async loadTasks() {
      try {
        const res = await API.request('/api/tasks');
        this.currentTasks = res.tasks || [];
        if (this.viewMode === 'list') {
          this.renderListView();
        } else {
          this.renderKanban();
        }
      } catch (err) {
        console.error('Failed to load tasks:', err);
      }
    },

    renderKanban() {
      const columns = {
        ASSIGNED: document.getElementById('kanban-col-assigned'),
        IN_PROGRESS: document.getElementById('kanban-col-inprogress'),
        SUBMITTED_FOR_REVIEW: document.getElementById('kanban-col-review'),
        APPROVED: document.getElementById('kanban-col-approved')
      };

      const counts = {
        ASSIGNED: document.getElementById('kanban-count-assigned'),
        IN_PROGRESS: document.getElementById('kanban-count-inprogress'),
        SUBMITTED_FOR_REVIEW: document.getElementById('kanban-count-review'),
        APPROVED: document.getElementById('kanban-count-approved')
      };

      Object.keys(columns).forEach(k => {
        if (columns[k]) columns[k].innerHTML = '';
      });

      const filtered = this.getFilteredTasks();
      const grouped = { ASSIGNED: [], IN_PROGRESS: [], SUBMITTED_FOR_REVIEW: [], APPROVED: [] };
      filtered.forEach(t => {
        let statusKey = t.status || 'ASSIGNED';
        if (statusKey === 'REVISION_REQUESTED') statusKey = 'SUBMITTED_FOR_REVIEW';
        if (!grouped[statusKey]) statusKey = 'ASSIGNED';
        grouped[statusKey].push(t);
      });

      Object.keys(grouped).forEach(k => {
        if (counts[k]) counts[k].textContent = grouped[k].length;
        if (!columns[k]) return;

        if (grouped[k].length === 0) {
          columns[k].innerHTML = `<div class="kanban-empty">No tasks in this lane</div>`;
          return;
        }

        columns[k].innerHTML = grouped[k].map(task => `
          <div class="kanban-card" data-id="${task.id}" onclick="PortalModules.tasks.openDetailModal('${task.id}')">
            <div class="kanban-card-header">
              <span class="badge ${task.priority === 'urgent' ? 'badge-danger' : (task.priority === 'high' ? 'badge-gold' : 'badge-info')}">
                ${task.priority.toUpperCase()}
              </span>
              ${task.status === 'REVISION_REQUESTED' ? `<span class="badge badge-danger">REVISION REQUESTED</span>` : ''}
              <span class="kanban-dept">${App.escapeHtml(task.department)}</span>
            </div>
            <h4 class="kanban-task-title">${App.escapeHtml(task.title)}</h4>
            ${task.description ? `<p class="kanban-task-desc">${App.escapeHtml(task.description)}</p>` : ''}
            
            <div class="kanban-progress-container">
              <div class="kanban-progress-fill" style="width: ${task.progress || 0}%;"></div>
            </div>

            <div class="kanban-card-meta">
              <span class="kanban-due">📅 ${task.dueDate}</span>
              <span class="kanban-assignee">👤 ${App.escapeHtml(task.assignedToName || 'Member')}</span>
            </div>
          </div>
        `).join('');
      });
    },

    renderListView() {
      const tbody = document.getElementById('tasks-list-table-body');
      if (!tbody) return;

      const tasks = this.getFilteredTasks();

      if (tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No chapter tasks match the current filter criteria.</td></tr>`;
        return;
      }

      tbody.innerHTML = tasks.map(t => `
        <tr onclick="PortalModules.tasks.openDetailModal('${t.id}')" style="cursor: pointer;">
          <td>
            <div style="font-weight: 700; color: var(--iei-navy-blue);">
              ${App.escapeHtml(t.title)}
            </div>
            <div style="font-size: 13px; color: var(--iei-steel-blue);">${App.escapeHtml(t.department)}</div>
          </td>
          <td>
            <span class="badge ${t.priority === 'urgent' ? 'badge-danger' : (t.priority === 'high' ? 'badge-gold' : 'badge-info')}">
              ${t.priority.toUpperCase()}
            </span>
          </td>
          <td>
            <span class="badge ${t.status === 'APPROVED' ? 'badge-success' : (t.status === 'REVISION_REQUESTED' ? 'badge-danger' : 'badge-gold')}">
              ${t.status}
            </span>
          </td>
          <td style="min-width: 130px;">
            <div style="font-size: 13px; font-weight: 700; margin-bottom: 4px;">${t.progress || 0}%</div>
            <div style="height: 6px; background: var(--iei-silver-grey); border-radius: 3px; overflow: hidden;">
              <div style="height: 100%; width: ${t.progress || 0}%; background: var(--iei-royal-blue);"></div>
            </div>
          </td>
          <td style="font-size: 14px; font-weight: 600;">${t.dueDate}</td>
          <td>${App.escapeHtml(t.assignedToName || 'Member')}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); PortalModules.tasks.openDetailModal('${t.id}')">Inspect</button>
          </td>
        </tr>
      `).join('');
    },

    openDetailModal(taskId) {
      const task = this.currentTasks.find(t => t.id === taskId);
      if (!task) return;

      const modal = document.getElementById('modal-task-detail');
      if (!modal) return;

      const user = API.getCurrentUser() || { role: 'committee' };

      document.getElementById('td-id').textContent = task.id;
      document.getElementById('td-title').textContent = task.title;
      document.getElementById('td-description').textContent = task.description || 'No additional specifications provided for this task milestone.';
      document.getElementById('td-department').textContent = task.department;
      document.getElementById('td-assignee').textContent = task.assignedToName || 'Member';
      document.getElementById('td-due').textContent = task.dueDate;
      document.getElementById('td-status').textContent = task.status;
      document.getElementById('td-progress-text').textContent = (task.progress || 0) + '%';
      document.getElementById('td-progress-bar').style.width = (task.progress || 0) + '%';

      // Reviewer comments display
      const reviewBox = document.getElementById('td-review-comments-box');
      const reviewText = document.getElementById('td-review-comments');
      if (reviewBox && reviewText) {
        if (task.reviewComments) {
          reviewBox.style.display = 'block';
          reviewText.textContent = task.reviewComments;
        } else {
          reviewBox.style.display = 'none';
        }
      }

      // History Timeline
      const timelineEl = document.getElementById('td-activity-timeline');
      if (timelineEl) {
        const history = Array.isArray(task.history) ? task.history : [];
        if (history.length === 0) {
          timelineEl.innerHTML = `<p class="text-muted" style="font-size: 13.5px;">Milestone created under Chapter Annual Plan.</p>`;
        } else {
          timelineEl.innerHTML = history.map(h => `
            <div class="timeline-node">
              <div class="node-time">${new Date(h.timestamp).toLocaleString()} • <strong>${App.escapeHtml(h.actor)}</strong></div>
              <div style="font-size: 14px; color: var(--text-primary); margin-top: 2px;">${App.escapeHtml(h.note || h.action)}</div>
            </div>
          `).join('');
        }
      }

      // Controls setup based on User Role & Assignee
      const progressSlider = document.getElementById('td-progress-slider');
      const sliderVal = document.getElementById('td-slider-val');
      if (progressSlider) {
        progressSlider.value = task.progress || 0;
        if (sliderVal) sliderVal.textContent = (task.progress || 0) + '%';
        progressSlider.oninput = (e) => {
          if (sliderVal) sliderVal.textContent = e.target.value + '%';
        };
      }

      // Assignee Actions (Committee Member & Chairman)
      const isAssignee = task.assignedTo === user.id || task.assignedToName === user.name;
      const canUpdateProgress = isAssignee || user.role === 'admin' || user.role === 'chairman';
      const progressSection = document.getElementById('td-progress-update-section');
      if (progressSection) {
        progressSection.style.display = (canUpdateProgress && user.role !== 'auditor') ? 'block' : 'none';
      }

      // Review Actions (Chairman & Admin only)
      const reviewActions = document.getElementById('td-reviewer-actions');
      if (reviewActions) {
        reviewActions.style.display = (user.role === 'chairman' || user.role === 'admin') ? 'flex' : 'none';
      }

      // Save references on modal
      modal.setAttribute('data-active-task-id', task.id);
      modal.style.display = 'flex';
    },

    closeDetailModal() {
      const modal = document.getElementById('modal-task-detail');
      if (modal) modal.style.display = 'none';
    },

    async saveTaskProgress() {
      const modal = document.getElementById('modal-task-detail');
      const taskId = modal.getAttribute('data-active-task-id');
      const slider = document.getElementById('td-progress-slider');
      const progress = slider ? Number(slider.value) : 0;
      const noteInput = document.getElementById('td-progress-note');
      const note = noteInput ? noteInput.value.trim() : '';

      try {
        const nextStatus = progress === 100 ? 'SUBMITTED_FOR_REVIEW' : 'IN_PROGRESS';
        await API.request(`/api/tasks/${taskId}`, {
          method: 'PUT',
          body: JSON.stringify({
            progress,
            status: nextStatus,
            historyNote: note || `Updated progress to ${progress}% completion.`
          })
        });
        App.showToast('Task progress successfully updated.', 'success');
        this.closeDetailModal();
        await this.loadTasks();
      } catch (err) {
        App.showToast('Failed to update progress: ' + err.message, 'danger');
      }
    },

    async submitForReview() {
      const modal = document.getElementById('modal-task-detail');
      const taskId = modal.getAttribute('data-active-task-id');
      try {
        await API.request(`/api/tasks/${taskId}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: 'SUBMITTED_FOR_REVIEW',
            historyNote: 'Submitted completed work for Chapter Leadership review.'
          })
        });
        App.showToast('Task submitted for review.', 'success');
        this.closeDetailModal();
        await this.loadTasks();
      } catch (err) {
        App.showToast('Submission error: ' + err.message, 'danger');
      }
    },

    async approveTask() {
      const modal = document.getElementById('modal-task-detail');
      const taskId = modal.getAttribute('data-active-task-id');
      try {
        await API.request(`/api/tasks/${taskId}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: 'APPROVED',
            progress: 100,
            reviewComments: 'Task work verified and approved.',
            historyNote: 'Task milestone approved by Chapter Leadership.'
          })
        });
        App.showToast('Task approved successfully.', 'success');
        this.closeDetailModal();
        await this.loadTasks();
      } catch (err) {
        App.showToast('Approval error: ' + err.message, 'danger');
      }
    },

    async requestCorrection() {
      const comments = prompt('Enter correction instructions or feedback for the committee member:');
      if (!comments) return;

      const modal = document.getElementById('modal-task-detail');
      const taskId = modal.getAttribute('data-active-task-id');
      try {
        await API.request(`/api/tasks/${taskId}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: 'REVISION_REQUESTED',
            reviewComments: comments,
            historyNote: `Revisions requested: ${comments}`
          })
        });
        App.showToast('Correction request dispatched to assignee.', 'warning');
        this.closeDetailModal();
        await this.loadTasks();
      } catch (err) {
        App.showToast('Error requesting correction: ' + err.message, 'danger');
      }
    },

    openCreateModal() {
      const modal = document.getElementById('modal-create-task');
      if (modal) modal.style.display = 'flex';
    },

    closeCreateModal() {
      const modal = document.getElementById('modal-create-task');
      if (modal) modal.style.display = 'none';
    },

    bindEvents() {
      const searchInput = document.getElementById('task-search-input');
      if (searchInput) {
        searchInput.oninput = (e) => {
          this.searchTerm = e.target.value.trim();
          this.viewMode === 'list' ? this.renderListView() : this.renderKanban();
        };
      }
      const prioritySelect = document.getElementById('task-filter-priority');
      if (prioritySelect) {
        prioritySelect.onchange = (e) => {
          this.priorityFilter = e.target.value;
          this.viewMode === 'list' ? this.renderListView() : this.renderKanban();
        };
      }
      const deptSelect = document.getElementById('task-filter-category');
      if (deptSelect) {
        deptSelect.onchange = (e) => {
          this.deptFilter = e.target.value;
          this.viewMode === 'list' ? this.renderListView() : this.renderKanban();
        };
      }

      const form = document.getElementById('form-create-task');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const title = document.getElementById('task-input-title').value;
          const description = document.getElementById('task-input-desc').value;
          const priority = document.getElementById('task-input-priority').value;
          const dueDate = document.getElementById('task-input-due').value;
          const department = document.getElementById('task-input-dept').value;
          const assignedToName = document.getElementById('task-input-assignee').value;

          try {
            await API.request('/api/tasks', {
              method: 'POST',
              body: JSON.stringify({
                title,
                description,
                priority,
                dueDate,
                department,
                assignedToName
              })
            });
            App.showToast('New chapter task successfully scheduled.', 'success');
            form.reset();
            this.closeCreateModal();
            await this.loadTasks();
          } catch (err) {
            App.showToast('Failed to create task: ' + err.message, 'danger');
          }
        };
      }
    }
  },

  // ==========================================
  // 3. WEEKLY REPORTING WORKFLOW
  // ==========================================
  weeklyReports: {
    currentReports: [],

    async init() {
      await this.loadReports();
      this.bindEvents();
    },

    async loadReports() {
      try {
        const res = await API.request('/api/weekly-reports');
        this.currentReports = res.reports || [];
        const tbody = document.getElementById('weekly-reports-table-body');
        if (tbody) {
          if (this.currentReports.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No weekly reports on file.</td></tr>`;
          } else {
            tbody.innerHTML = this.currentReports.map(r => `
              <tr>
                <td><strong>Week ${r.weekNumber}</strong></td>
                <td>${App.escapeHtml(r.period)}</td>
                <td>${App.escapeHtml(r.department)}</td>
                <td><span class="font-bold">${r.totalEvents}</span> activities (${r.studentHours} hrs)</td>
                <td>
                  <span class="badge ${r.status === 'APPROVED' ? 'badge-success' : (r.status === 'REVISION_REQUESTED' ? 'badge-danger' : 'badge-gold')}">
                    ${r.status}
                  </span>
                </td>
                <td>
                  <div><strong>${App.escapeHtml(r.submittedBy)}</strong></div>
                  ${r.endorsedBy ? `<div style="font-size: 12px; color: var(--iei-champagne-gold);">Endorsed by: ${App.escapeHtml(r.endorsedBy)}</div>` : ''}
                </td>
                <td>
                  <button class="btn btn-outline btn-sm" onclick="PortalModules.weeklyReports.viewReportModal('${r.id}')">Inspect</button>
                </td>
              </tr>
            `).join('');
          }
        }
      } catch (err) {
        console.error('Failed to load weekly reports:', err);
      }
    },

    viewReportModal(reportId) {
      const report = this.currentReports.find(r => r.id === reportId);
      if (!report) return;

      const modal = document.getElementById('modal-view-weekly-report');
      if (!modal) return;

      const user = API.getCurrentUser() || { role: 'committee' };

      document.getElementById('rep-modal-badge').textContent = `Week ${report.weekNumber} Documentation`;
      document.getElementById('rep-modal-title').textContent = `${report.department} Activity Record`;
      document.getElementById('rep-modal-period').textContent = report.period;
      document.getElementById('rep-modal-dept').textContent = report.department;

      const statusEl = document.getElementById('rep-modal-status');
      if (statusEl) {
        statusEl.textContent = report.status;
        statusEl.className = `badge ${report.status === 'APPROVED' ? 'badge-success' : (report.status === 'REVISION_REQUESTED' ? 'badge-danger' : 'badge-gold')}`;
      }

      document.getElementById('rep-modal-events').textContent = report.totalEvents;
      document.getElementById('rep-modal-hours').textContent = `${report.studentHours} hrs`;
      document.getElementById('rep-modal-attendees').textContent = report.attendeesCount;
      document.getElementById('rep-modal-summary').textContent = report.summary;
      document.getElementById('rep-modal-roadblocks').textContent = report.roadblocks || 'None reported.';
      document.getElementById('rep-modal-nextsteps').textContent = report.nextSteps || 'Continue planned activities.';

      // Endorsement / comments display
      const commentsBox = document.getElementById('rep-modal-comments-box');
      if (commentsBox) {
        if (report.reviewComments) {
          commentsBox.style.display = 'block';
          document.getElementById('rep-modal-comments').textContent = report.reviewComments;
        } else {
          commentsBox.style.display = 'none';
        }
      }

      // Review actions (Chairman & Admin only)
      const reviewActions = document.getElementById('rep-reviewer-actions');
      if (reviewActions) {
        reviewActions.style.display = (user.role === 'chairman' || user.role === 'admin') ? 'flex' : 'none';
      }

      modal.setAttribute('data-active-report-id', report.id);
      modal.style.display = 'flex';
    },

    openSubmitModal() {
      const modal = document.getElementById('modal-submit-weekly-report');
      if (modal) modal.style.display = 'flex';
    },

    closeSubmitModal() {
      const modal = document.getElementById('modal-submit-weekly-report');
      if (modal) modal.style.display = 'none';
    },

    closeReportModal() {
      const modal = document.getElementById('modal-view-weekly-report');
      if (modal) modal.style.display = 'none';
    },

    closeViewModal() {
      this.closeReportModal();
    },

    async approveReport() {
      return this.endorseReport();
    },

    async requestRevision() {
      return this.requestReportRevision();
    },

    async endorseReport() {
      const modal = document.getElementById('modal-view-weekly-report');
      const reportId = modal.getAttribute('data-active-report-id');
      try {
        await API.request(`/api/portal/weekly-reports/${reportId}/endorse`, { method: 'POST' });
        App.showToast('Weekly report approved and digitally endorsed.', 'success');
        this.closeReportModal();
        await this.loadReports();
      } catch (err) {
        App.showToast('Approval error: ' + err.message, 'danger');
      }
    },

    async requestReportRevision() {
      const comments = prompt('Enter correction instructions for this weekly report:');
      if (!comments) return;

      const modal = document.getElementById('modal-view-weekly-report');
      const reportId = modal.getAttribute('data-active-report-id');
      try {
        await API.request(`/api/portal/weekly-reports/${reportId}/revision`, {
          method: 'POST',
          body: JSON.stringify({ comments })
        });
        App.showToast('Revision request logged and sent back to submitter.', 'warning');
        this.closeReportModal();
        await this.loadReports();
      } catch (err) {
        App.showToast('Revision request failed: ' + err.message, 'danger');
      }
    },

    bindEvents() {
      const form = document.getElementById('form-submit-weekly-report');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const weekNumber = document.getElementById('wr-input-week').value;
          const period = document.getElementById('wr-input-period').value;
          const department = document.getElementById('wr-input-dept').value;
          const totalEvents = document.getElementById('wr-input-events').value;
          const studentHours = document.getElementById('wr-input-hours').value;
          const attendeesCount = document.getElementById('wr-input-attendees').value;
          const summary = document.getElementById('wr-input-summary').value;
          const roadblocks = document.getElementById('wr-input-roadblocks').value;
          const nextSteps = document.getElementById('wr-input-nextsteps').value;

          try {
            await API.request('/api/weekly-reports', {
              method: 'POST',
              body: JSON.stringify({
                weekNumber,
                period,
                department,
                totalEvents,
                studentHours,
                attendeesCount,
                summary,
                roadblocks,
                nextSteps
              })
            });
            App.showToast(`Weekly Report #${weekNumber} successfully submitted for review.`, 'success');
            form.reset();
            await this.loadReports();
          } catch (err) {
            App.showToast('Failed to submit weekly report: ' + err.message, 'danger');
          }
        };
      }
    }
  },

  // ==========================================
  // 4. GOOGLE CLASSROOM-STYLE SHARED COMMUNITY
  // ==========================================
  community: {
    currentPosts: [],
    activeFilter: 'All',

    async init() {
      await this.loadPosts();
      this.bindEvents();
    },

    async loadPosts() {
      try {
        const res = await API.request('/api/community');
        this.currentPosts = res.posts || [];
        this.renderStream();
      } catch (err) {
        console.error('Failed to load community stream:', err);
      }
    },

    setFilter(filter) {
      this.activeFilter = filter;
      document.querySelectorAll('.community-filter-pill').forEach(pill => {
        if (pill.getAttribute('data-filter') === filter) {
          pill.classList.add('active');
        } else {
          pill.classList.remove('active');
        }
      });
      this.renderStream();
    },

    renderStream() {
      const container = document.getElementById('community-stream-container');
      if (!container) return;

      let posts = this.currentPosts;
      if (this.activeFilter === 'announcements') {
        posts = posts.filter(p => p.type === 'announcement' || p.isPinned);
      } else if (this.activeFilter === 'discussions') {
        posts = posts.filter(p => p.type !== 'announcement');
      }

      if (posts.length === 0) {
        container.innerHTML = `
          <div class="empty-state-luxury">
            <p>No community posts found in this stream. Use the composer above to share with the chapter.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = posts.map(post => {
        const isAnnouncement = post.type === 'announcement';
        const replies = Array.isArray(post.replies) ? post.replies : [];
        const attachments = Array.isArray(post.attachments) ? post.attachments : [];

        return `
          <div class="community-post-card ${post.isPinned ? 'pinned-post' : ''}">
            <div class="post-header">
              <div class="post-author-block">
                <div class="post-avatar ${post.role === 'chairman' ? 'avatar-gold' : (post.role === 'admin' ? 'avatar-blue' : '')}">
                  ${post.author.charAt(0)}
                </div>
                <div>
                  <div class="post-author-name">
                    ${App.escapeHtml(post.author)} 
                    <span class="badge ${isAnnouncement ? 'badge-gold' : 'badge-info'}" style="margin-left: 6px;">
                      ${isAnnouncement ? '📢 ANNOUNCEMENT' : '💬 DISCUSSION'}
                    </span>
                  </div>
                  <div class="post-meta-line">
                    ${new Date(post.timestamp).toLocaleDateString()} at ${new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${App.escapeHtml(post.category)}
                  </div>
                </div>
              </div>
              ${post.isPinned ? `<span class="badge badge-gold">PINNED</span>` : ''}
            </div>

            <h3 class="post-title">${App.escapeHtml(post.title)}</h3>
            <div class="post-content">${App.escapeHtml(post.content)}</div>

            ${attachments.length > 0 ? `
              <div class="post-attachments-list">
                ${attachments.map(att => `
                  <a href="${att.url || '#'}" target="_blank" class="attachment-chip">
                    <span class="att-icon">📎</span>
                    <span class="att-name">${App.escapeHtml(att.name)}</span>
                    <span class="att-size">(${att.size || 'PDF Document'})</span>
                  </a>
                `).join('')}
              </div>
            ` : ''}

            <!-- Post Action Bar -->
            <div class="post-footer">
              <button class="post-action-btn" onclick="PortalModules.community.likePost('${post.id}')">
                <span>❤️</span> <span>${post.likes || 0} Endorsements</span>
              </button>
              <span class="post-comments-count">💬 ${replies.length} class comments</span>
            </div>

            <!-- Inline Classroom Reply Thread -->
            <div class="classroom-replies-thread">
              ${replies.map(r => `
                <div class="classroom-reply-item">
                  <div class="reply-avatar">${r.author.charAt(0)}</div>
                  <div class="reply-body">
                    <div class="reply-header">
                      <span class="reply-author">${App.escapeHtml(r.author)}</span>
                      <span class="reply-time">${new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="reply-text">${App.escapeHtml(r.content)}</div>
                  </div>
                </div>
              `).join('')}

              <!-- Quick Inline Reply Input -->
              <div class="classroom-reply-composer">
                <input type="text" id="reply-input-${post.id}" class="reply-input" placeholder="Add class comment or reply..." onkeydown="if(event.key==='Enter') PortalModules.community.submitReply('${post.id}')">
                <button class="btn btn-primary btn-sm" onclick="PortalModules.community.submitReply('${post.id}')">Send</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    },

    async submitReply(postId) {
      const input = document.getElementById(`reply-input-${postId}`);
      const content = input ? input.value.trim() : '';
      if (!content) return;

      try {
        await API.request(`/api/portal/community/${postId}/reply`, {
          method: 'POST',
          body: JSON.stringify({ content })
        });
        if (input) input.value = '';
        await this.loadPosts();
      } catch (err) {
        App.showToast('Failed to post reply: ' + err.message, 'danger');
      }
    },

    async likePost(postId) {
      try {
        await API.request(`/api/portal/community/${postId}/like`, { method: 'POST' });
        await this.loadPosts();
      } catch (err) {
        App.showToast('Endorsement error: ' + err.message, 'danger');
      }
    },

    bindEvents() {
      // Stream Composer Submit
      const btnPublish = document.getElementById('btn-stream-publish');
      if (btnPublish) {
        btnPublish.onclick = async () => {
          const content = document.getElementById('stream-post-content')?.value.trim();
          const title = document.getElementById('stream-post-title')?.value.trim();
          const typeSelect = document.getElementById('stream-post-type');
          const type = typeSelect ? typeSelect.value : 'discussion';
          const isPinned = document.getElementById('stream-post-pinned')?.checked || false;

          if (!content) {
            App.showToast('Please type your post content before publishing.', 'warning');
            return;
          }

          try {
            await API.request('/api/community', {
              method: 'POST',
              body: JSON.stringify({
                title: title || (type === 'announcement' ? 'Chapter Announcement' : 'Class Discussion'),
                content,
                type,
                isPinned,
                category: type === 'announcement' ? 'Official Announcements' : 'Student Discussions'
              })
            });
            App.showToast('Shared to community stream.', 'success');
            document.getElementById('stream-post-content').value = '';
            if (document.getElementById('stream-post-title')) document.getElementById('stream-post-title').value = '';
            await this.loadPosts();
          } catch (err) {
            App.showToast('Failed to publish post: ' + err.message, 'danger');
          }
        };
      }
    }
  },

  // ==========================================
  // 5. PRIVATE MESSAGING HUB
  // ==========================================
  messages: {
    contacts: [
      { id: 'usr_admin_01', name: 'Chapter Administrator', role: 'Admin/Editor', status: 'online' },
      { id: 'usr_chair_01', name: 'Chapter Chairman', role: 'Chairman', status: 'online' },
      { id: 'usr_comm_01', name: 'Committee Member', role: 'Committee Member', status: 'online' },
      { id: 'usr_auditor_01', name: 'Chapter Auditor', role: 'Auditor', status: 'online' }
    ],
    selectedContactId: 'usr_admin_01',

    async init() {
      this.renderContacts();
      await this.loadMessages();
      this.bindEvents();
    },

    renderContacts() {
      const container = document.getElementById('msg-contacts-list');
      if (!container) return;

      container.innerHTML = this.contacts.map(c => `
        <div class="msg-contact-item ${c.id === this.selectedContactId ? 'active' : ''}" onclick="PortalModules.messages.selectContact('${c.id}')">
          <div class="msg-avatar ${c.role === 'Chairman' ? 'avatar-gold' : 'avatar-blue'}">
            ${c.name.charAt(0)}
            <span class="status-indicator ${c.status}"></span>
          </div>
          <div class="msg-contact-info">
            <div class="msg-contact-name">${App.escapeHtml(c.name)}</div>
            <div class="msg-contact-role">${c.role}</div>
          </div>
        </div>
      `).join('');
    },

    selectContact(contactId) {
      this.selectedContactId = contactId;
      this.renderContacts();
      const contact = this.contacts.find(c => c.id === contactId);
      const nameEl = document.getElementById('msg-active-chat-name');
      const roleEl = document.getElementById('msg-active-chat-role');
      if (nameEl && contact) nameEl.textContent = contact.name;
      if (roleEl && contact) roleEl.textContent = `${contact.role} • Direct Chapter Channel`;
      this.loadMessages();
    },

    async loadMessages() {
      try {
        const res = await API.request('/api/messages');
        const allMessages = res.messages || [];
        const threadEl = document.getElementById('msg-thread-stream');
        if (!threadEl) return;

        const user = API.getCurrentUser() || { id: 'usr_comm_01' };

        const relevant = allMessages.filter(m => 
          (m.senderId === this.selectedContactId || m.recipientId === this.selectedContactId) ||
          (m.senderId === user.id && m.recipientId === this.selectedContactId)
        );

        if (relevant.length === 0) {
          threadEl.innerHTML = `
            <div class="empty-state-luxury">
              <p>Direct communication channel open with ${App.escapeHtml(this.contacts.find(c => c.id === this.selectedContactId)?.name || 'Member')}. Type a message below.</p>
            </div>
          `;
          return;
        }

        threadEl.innerHTML = relevant.map(m => {
          const isMe = m.senderId === user.id;
          return `
            <div class="msg-bubble-wrap ${isMe ? 'msg-outgoing' : 'msg-incoming'}">
              <div class="msg-bubble">
                <div class="msg-sender">${App.escapeHtml(m.senderName)} (${m.senderRole})</div>
                <div class="msg-text">${App.escapeHtml(m.content)}</div>
                <div class="msg-time">${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          `;
        }).join('');

        threadEl.scrollTop = threadEl.scrollHeight;
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    },

    async sendMessage() {
      const input = document.getElementById('msg-compose-input');
      const content = input ? input.value.trim() : '';
      if (!content) return;

      try {
        await API.request('/api/messages', {
          method: 'POST',
          body: JSON.stringify({
            recipientId: this.selectedContactId,
            content
          })
        });
        if (input) input.value = '';
        await this.loadMessages();
      } catch (err) {
        App.showToast('Failed to send message: ' + err.message, 'danger');
      }
    },

    bindEvents() {
      const btnSend = document.getElementById('btn-msg-send');
      if (btnSend) btnSend.onclick = () => this.sendMessage();

      const input = document.getElementById('msg-compose-input');
      if (input) {
        input.onkeydown = (e) => {
          if (e.key === 'Enter') this.sendMessage();
        };
      }
    }
  },

  // ==========================================
  // 6. USER MANAGEMENT (ADMIN ONLY)
  // ==========================================
  users: {
    async init() {
      await this.loadUsers();
      this.bindEvents();
    },

    async loadUsers() {
      const tbody = document.getElementById('users-table-body');
      if (!tbody) return;

      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4">
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--iei-steel-blue); font-weight: 500;">
              <span class="spinner-border spinner-border-sm" role="status" style="width: 18px; height: 18px; border: 2px solid var(--iei-royal-blue); border-right-color: transparent; border-radius: 50%; display: inline-block; animation: spin 0.8s linear infinite;"></span>
              <span>Loading chapter personnel directory...</span>
            </div>
          </td>
        </tr>
      `;

      try {
        const res = await API.request('/api/admin/users');
        const users = res.users || [];

        if (users.length === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="7" class="text-center py-5">
                <div class="empty-state-luxury">
                  <div style="font-size: 32px; margin-bottom: 12px;">👥</div>
                  <h4 style="margin-bottom: 6px; font-weight: 600; color: var(--iei-navy);">No Chapter Members Enrolled Yet</h4>
                  <p class="text-muted" style="margin-bottom: 16px; font-size: 14px;">Enroll authorized committee leads, chairman, or faculty members to begin.</p>
                  <button class="btn btn-primary btn-sm" onclick="PortalModules.users.openEnrollModal()">+ Enroll First Member</button>
                </div>
              </td>
            </tr>
          `;
          return;
        }

        const currentUser = API.getCurrentUser() || {};
        const isAdmin = currentUser.role === 'admin';

        tbody.innerHTML = users.map(u => `
          <tr>
            <!-- Column 1: Member -->
            <td>
              <div class="user-cell">
                <div class="user-avatar-small ${u.role === 'chairman' ? 'avatar-gold' : 'avatar-blue'}">
                  ${(u.name || 'M').charAt(0).toUpperCase()}
                </div>
                <div>
                  <strong style="color: var(--iei-navy); font-weight: 700; font-size: 14.5px;">${App.escapeHtml(u.name)}</strong>
                  <div style="font-family: monospace; font-size: 12.5px; color: var(--iei-royal-blue); font-weight: 600;">${App.escapeHtml(u.credentialId || u.id)}</div>
                </div>
              </div>
            </td>
            <!-- Column 2: Email Address -->
            <td>
              <span style="font-family: monospace; font-size: 13.5px; color: var(--iei-steel-blue); font-weight: 500;">
                ${App.escapeHtml(u.email)}
              </span>
            </td>
            <!-- Column 3: Assigned Role -->
            <td>
              ${isAdmin ? `
                <select class="select-control" style="padding: 6px 10px; font-size: 13.5px; font-weight: 600; width: auto; min-width: 165px;" onchange="PortalModules.users.changeRole('${u.id}', this.value)">
                  <option value="committee" ${u.role === 'committee' ? 'selected' : ''}>🎓 Committee Member</option>
                  <option value="chairman" ${u.role === 'chairman' ? 'selected' : ''}>👑 Chairman</option>
                  <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>🛡️ Admin / Editor</option>
                  <option value="auditor" ${u.role === 'auditor' ? 'selected' : ''}>📋 Auditor</option>
                </select>
              ` : `
                <span class="badge ${u.role === 'admin' ? 'badge-primary' : (u.role === 'chairman' ? 'badge-gold' : 'badge-info')}">
                  ${u.role.toUpperCase()}
                </span>
              `}
            </td>
            <!-- Column 4: Department -->
            <td>
              <span style="font-size: 14px; color: var(--iei-navy); font-weight: 500;">
                ${App.escapeHtml(u.department || 'Dr. MGR E&RI')}
              </span>
            </td>
            <!-- Column 5: Designation -->
            <td>
              <span style="font-size: 14px; color: var(--iei-steel-blue);">
                ${App.escapeHtml(u.designation || 'Member')}
              </span>
            </td>
            <!-- Column 6: Status -->
            <td>
              <span class="badge ${u.isActive ? 'badge-success' : 'badge-danger'}">
                ${u.isActive ? 'Active' : 'Deactivated'}
              </span>
            </td>
            <!-- Column 7: Actions -->
            <td>
              ${isAdmin ? `
                <div class="table-actions-row" style="display: flex; gap: 8px; align-items: center;">
                  <button class="btn btn-outline btn-sm" onclick="PortalModules.users.toggleStatus('${u.id}', ${!u.isActive})" title="${u.isActive ? 'Deactivate member account' : 'Reactivate member account'}">
                    ${u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button class="btn btn-outline btn-sm" onclick="PortalModules.users.resetPassword('${u.id}')" title="Reset password for this member">
                    Reset Password
                  </button>
                </div>
              ` : `
                <span class="text-muted" style="font-size: 13px;">View Only</span>
              `}
            </td>
          </tr>
        `).join('');
      } catch (err) {
        console.error('Failed to load user directory:', err);
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-5">
              <div class="empty-state-luxury" style="border: 1px solid rgba(220, 38, 38, 0.25); background: rgba(220, 38, 38, 0.03);">
                <div style="font-size: 28px; margin-bottom: 8px;">⚠️</div>
                <h4 style="margin-bottom: 6px; font-weight: 600; color: var(--color-danger);">Unable to Load Personnel Directory</h4>
                <p class="text-muted" style="margin-bottom: 16px; font-size: 14px;">${App.escapeHtml(err.message || 'Access restricted to Chapter Admin / Editor.')}</p>
                <button class="btn btn-outline btn-sm" onclick="PortalModules.users.loadUsers()">↻ Retry</button>
              </div>
            </td>
          </tr>
        `;
      }
    },

    async changeRole(userId, newRole) {
      try {
        await API.request(`/api/admin/users/${userId}/role`, {
          method: 'PUT',
          body: JSON.stringify({ role: newRole })
        });
        App.showToast(`User role updated to ${newRole.toUpperCase()}.`, 'success');
      } catch (err) {
        App.showToast('Failed to change role: ' + err.message, 'danger');
        await this.loadUsers();
      }
    },

    async toggleStatus(userId, isActive) {
      try {
        await API.request(`/api/admin/users/${userId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ isActive })
        });
        App.showToast(`Account ${isActive ? 'activated' : 'deactivated'}.`, 'info');
        await this.loadUsers();
      } catch (err) {
        App.showToast('Status toggle error: ' + err.message, 'danger');
      }
    },

    async resetPassword(userId) {
      if (!confirm('Initiate secure password reset for this user?')) return;
      try {
        await API.request(`/api/admin/users/${userId}/reset-password`, { method: 'POST' });
        App.showToast('Temporary password has been reset securely.', 'success');
      } catch (err) {
        App.showToast('Password reset failed: ' + err.message, 'danger');
      }
    },

    openEnrollModal() {
      const modal = document.getElementById('modal-enroll-user');
      const errBox = document.getElementById('enroll-error-alert');
      const successBox = document.getElementById('enroll-success-alert');
      if (errBox) errBox.style.display = 'none';
      if (successBox) successBox.style.display = 'none';
      if (modal) modal.style.display = 'flex';
    },

    closeEnrollModal() {
      const modal = document.getElementById('modal-enroll-user');
      if (modal) modal.style.display = 'none';
      const form = document.getElementById('form-enroll-user');
      if (form) form.reset();
      const errBox = document.getElementById('enroll-error-alert');
      if (errBox) errBox.style.display = 'none';
      const credsCard = document.getElementById('enroll-credentials-card');
      if (credsCard) credsCard.style.display = 'none';
      const submitBtn = document.getElementById('btn-submit-enroll');
      if (submitBtn) {
        submitBtn.style.display = 'inline-block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enroll Member';
      }
    },

    copyCreatedCredentials() {
      const credId = document.getElementById('created-cred-id')?.textContent || '';
      const email = document.getElementById('created-cred-email')?.textContent || '';
      const pass = document.getElementById('created-cred-password')?.textContent || '';
      const text = `MGR IEI Students Chapter Portal Credentials:\nCredential ID: ${credId}\nInstitutional Email: ${email}\nInitial Password: ${pass}\nPortal Gateway: ${window.location.origin}`;
      navigator.clipboard.writeText(text).then(() => {
        App.showToast('Credentials copied to clipboard.', 'success');
      }).catch(() => {
        App.showToast('Select and copy credentials above.', 'info');
      });
    },

    bindEvents() {
      const form = document.getElementById('form-enroll-user');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const errBox = document.getElementById('enroll-error-alert');
          const submitBtn = document.getElementById('btn-submit-enroll');
          if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }

          const name = document.getElementById('enroll-name').value.trim();
          const email = document.getElementById('enroll-email').value.trim();
          const role = document.getElementById('enroll-role').value;
          const designation = document.getElementById('enroll-designation').value.trim();
          const department = document.getElementById('enroll-dept').value.trim();
          const passwordInput = document.getElementById('enroll-password');
          const password = passwordInput && passwordInput.value.trim() ? passwordInput.value.trim() : '';

          if (!name || !email) {
            if (errBox) {
              errBox.textContent = 'Full Name and Institutional Email are required.';
              errBox.style.display = 'block';
            }
            return;
          }

          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enrolling Member...';
          }

          try {
            const res = await API.request('/api/admin/users', {
              method: 'POST',
              body: JSON.stringify({ name, email, role, designation, department, password })
            });
            App.showToast(`Account for ${name} created successfully.`, 'success');

            // Reveal generated temporary credentials once to Administrator
            const credsCard = document.getElementById('enroll-credentials-card');
            if (credsCard) {
              const credIdEl = document.getElementById('created-cred-id');
              const credEmailEl = document.getElementById('created-cred-email');
              const credPassEl = document.getElementById('created-cred-password');
              if (credIdEl) credIdEl.textContent = res.user?.credentialId || res.user?.id || 'MGR.IEI...';
              if (credEmailEl) credEmailEl.textContent = res.user?.email || email;
              if (credPassEl) credPassEl.textContent = res.temporaryPassword || password;
              credsCard.style.display = 'block';
            }
            form.reset();
            if (submitBtn) submitBtn.style.display = 'none';
            await this.loadUsers();
          } catch (err) {
            if (errBox) {
              errBox.textContent = err.message || 'Failed to enroll member. Please try again.';
              errBox.style.display = 'block';
            }
            App.showToast('Failed to enroll user: ' + err.message, 'danger');
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Enroll Member';
            }
          }
        };
      }
    }
  },

  // ==========================================
  // 7. ANNOUNCEMENTS & CHAPTER EVENTS
  // ==========================================
  events: {
    async init() {
      await this.loadEvents();
      this.bindEvents();
    },

    async loadEvents() {
      try {
        const res = await API.request('/api/events');
        const events = res.events || [];
        const container = document.getElementById('events-grid-container');
        if (!container) return;

        if (events.length === 0) {
          container.innerHTML = `<p class="text-muted" style="padding: 24px;">No chapter events scheduled currently.</p>`;
          return;
        }

        container.innerHTML = events.map(e => `
          <div class="card event-card-luxury">
            <div class="card-header">
              <span class="badge badge-primary">${App.escapeHtml(e.category)}</span>
              <span class="badge ${e.status === 'Completed' ? 'badge-success' : 'badge-gold'}">${e.status}</span>
            </div>
            <div class="card-body">
              <h3 style="font-size: 18px; color: var(--iei-navy-blue); margin-bottom: 8px;">${App.escapeHtml(e.title)}</h3>
              <p style="font-size: 14.5px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 14px;">${App.escapeHtml(e.description)}</p>
              <div style="font-size: 13.5px; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px;">
                <span>📅 <strong>Date:</strong> ${e.date || e.eventDate}</span>
                <span>📍 <strong>Venue:</strong> ${App.escapeHtml(e.venue || 'University Auditorium')}</span>
                <span>👥 <strong>Attendees:</strong> ${e.attendeesCount || 0} participants</span>
                ${e.speakerName ? `<span>🎙️ <strong>Speaker:</strong> ${App.escapeHtml(e.speakerName)}</span>` : ''}
              </div>
            </div>
          </div>
        `).join('');
      } catch (err) {
        console.error('Failed to load events:', err);
      }
    },

    openAddModal() {
      const modal = document.getElementById('modal-add-event');
      if (modal) modal.style.display = 'flex';
    },

    openCreateModal() {
      this.openAddModal();
    },

    closeAddModal() {
      const modal = document.getElementById('modal-add-event');
      if (modal) modal.style.display = 'none';
    },

    closeCreateModal() {
      this.closeAddModal();
    },

    bindEvents() {
      const form = document.getElementById('form-add-event');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const title = document.getElementById('event-form-title').value;
          const category = document.getElementById('event-form-category').value;
          const eventDate = document.getElementById('event-form-date').value;
          const venue = document.getElementById('event-form-venue').value;
          const attendeesCount = document.getElementById('event-form-attendees').value;
          const description = document.getElementById('event-form-desc').value;
          const speakerName = document.getElementById('event-form-speaker').value;

          try {
            await API.request('/api/events', {
              method: 'POST',
              body: JSON.stringify({
                title,
                category,
                eventDate,
                venue,
                attendeesCount,
                description,
                speakerName
              })
            });
            App.showToast('Event / Announcement successfully scheduled.', 'success');
            form.reset();
            this.closeAddModal();
            await this.loadEvents();
          } catch (err) {
            App.showToast('Failed to schedule event: ' + err.message, 'danger');
          }
        };
      }
    }
  },

  // ==========================================
  // 8. REPORTING SETTINGS (ADMIN ONLY)
  // ==========================================
  reportingSettings: {
    async init() {
      await this.loadSettings();
      this.bindEvents();
    },

    async loadSettings() {
      try {
        const res = await API.request('/api/portal/reporting-settings');
        const s = res.settings || {};
        if (document.getElementById('rs-active-week')) document.getElementById('rs-active-week').value = s.activeWeek || 45;
        if (document.getElementById('rs-period')) document.getElementById('rs-period').value = s.period || 'Oct 27 - Nov 02, 2026';
        if (document.getElementById('rs-deadline-day')) document.getElementById('rs-deadline-day').value = s.deadlineDay || 'Monday';
        if (document.getElementById('rs-deadline-time')) document.getElementById('rs-deadline-time').value = s.deadlineTime || '23:59:59';
        if (document.getElementById('rs-timezone')) document.getElementById('rs-timezone').value = s.timezone || 'Asia/Kolkata';
      } catch (err) {
        console.error('Failed to load reporting settings:', err);
      }
    },

    bindEvents() {
      const form = document.getElementById('form-reporting-settings');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const activeWeek = Number(document.getElementById('rs-active-week').value);
          const period = document.getElementById('rs-period').value;
          const deadlineDay = document.getElementById('rs-deadline-day').value;
          const deadlineTime = document.getElementById('rs-deadline-time').value;
          const timezone = document.getElementById('rs-timezone').value;

          try {
            await API.request('/api/portal/reporting-settings', {
              method: 'PUT',
              body: JSON.stringify({ activeWeek, period, deadlineDay, deadlineTime, timezone })
            });
            App.showToast('Weekly reporting configuration updated successfully.', 'success');
          } catch (err) {
            App.showToast('Failed to save settings: ' + err.message, 'danger');
          }
        };
      }
    }
  },

  // ==========================================
  // 9. AUDIT LOGS & COMPLIANCE OBSERVATIONS
  // ==========================================
  auditLogs: {
    async init() {
      await Promise.all([this.loadLogs(), this.loadObservations()]);
      this.bindEvents();
    },

    async loadLogs() {
      try {
        const res = await API.request('/api/admin/audit-logs');
        const logs = res.logs || [];
        const tbody = document.getElementById('audit-logs-table-body');
        if (!tbody) return;

        tbody.innerHTML = logs.map(l => `
          <tr>
            <td><strong style="color: var(--iei-navy-blue);">${App.escapeHtml(l.action)}</strong></td>
            <td>${App.escapeHtml(l.performedBy || 'System')}</td>
            <td>${App.escapeHtml(l.target || 'General')}</td>
            <td style="font-size: 13.5px;">${App.escapeHtml(l.details || '')}</td>
            <td style="font-size: 13px; color: var(--text-muted);">${new Date(l.timestamp).toLocaleString()}</td>
          </tr>
        `).join('');
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      }
    },

    async loadObservations() {
      try {
        const res = await API.request('/api/portal/audit-observations');
        const observations = res.observations || [];
        const container = document.getElementById('audit-observations-list');
        if (!container) return;

        if (observations.length === 0) {
          container.innerHTML = `<p class="text-muted" style="padding: 16px;">No audit observations logged on record.</p>`;
          return;
        }

        container.innerHTML = observations.map(o => `
          <div class="card" style="padding: 18px; margin-bottom: 12px; border-left: 4px solid var(--iei-institutional-gold);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <h4 style="font-size: 16px; color: var(--iei-navy-blue);">${App.escapeHtml(o.title)}</h4>
              <span class="badge badge-success">${App.escapeHtml(o.complianceStatus || 'COMPLIANT')}</span>
            </div>
            <p style="font-size: 14.5px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 8px;">${App.escapeHtml(o.observation)}</p>
            <div style="font-size: 13px; color: var(--text-muted);">
              Auditor: <strong>${App.escapeHtml(o.auditorName)}</strong> • ${new Date(o.timestamp).toLocaleString()}
            </div>
          </div>
        `).join('');
      } catch (err) {
        console.error('Failed to load audit observations:', err);
      }
    },

    openObservationModal() {
      const modal = document.getElementById('modal-add-observation');
      if (modal) modal.style.display = 'flex';
    },

    closeObservationModal() {
      const modal = document.getElementById('modal-add-observation');
      if (modal) modal.style.display = 'none';
    },

    bindEvents() {
      const form = document.getElementById('form-add-observation');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const title = document.getElementById('obs-title').value;
          const observation = document.getElementById('obs-text').value;
          const complianceStatus = document.getElementById('obs-status').value;

          try {
            await API.request('/api/portal/audit-observations', {
              method: 'POST',
              body: JSON.stringify({ title, observation, complianceStatus })
            });
            App.showToast('Audit observation logged into chapter ledger.', 'success');
            form.reset();
            this.closeObservationModal();
            await this.loadObservations();
          } catch (err) {
            App.showToast('Failed to record observation: ' + err.message, 'danger');
          }
        };
      }
    }
  },

  // ==========================================
  // 10. INSTANT 4-ROLE PERSPECTIVE SWITCHER
  // ==========================================
  roleSwitcher: {
    async switchRole(roleKey) {
      try {
        const res = await API.quickAccess(roleKey);
        API.setAuth(res.token, res.user);
        App.updateUserUI();
        App.applyRolePermissions(res.user);
        App.navigate('dashboard');
        App.showToast(`Perspective switched to: ${res.user.name} (${res.user.role.toUpperCase()})`, 'success');
      } catch (err) {
        App.showToast('Perspective switch restricted: ' + err.message, 'warning');
      }
    }
  },

  // Notifications Drawer
  notifications: {
    isOpen: false,
    toggleDrawer() {
      const drawer = document.getElementById('notifications-drawer');
      const backdrop = document.getElementById('notif-drawer-backdrop');
      this.isOpen = !this.isOpen;
      if (drawer) drawer.classList.toggle('open', this.isOpen);
      if (backdrop) backdrop.classList.toggle('active', this.isOpen);
      if (this.isOpen) {
        API.request('/api/notifications/mark-read').catch(() => {});
        const badge = document.getElementById('header-notif-badge');
        if (badge) badge.style.display = 'none';
      }
    },
    closeDrawer() {
      this.isOpen = false;
      const drawer = document.getElementById('notifications-drawer');
      const backdrop = document.getElementById('notif-drawer-backdrop');
      if (drawer) drawer.classList.remove('open');
      if (backdrop) backdrop.classList.remove('active');
    }
  },

  // Account Modal
  account: {
    openModal() {
      const user = API.getCurrentUser() || {};
      const modal = document.getElementById('modal-account-profile');
      if (!modal) return;
      document.getElementById('acc-name').textContent = user.name || 'Member';
      document.getElementById('acc-email').textContent = user.email || '';
      document.getElementById('acc-role').textContent = (user.role || 'committee').toUpperCase();
      document.getElementById('acc-designation').textContent = user.designation || 'Student Committee Member';
      document.getElementById('acc-department').textContent = user.department || 'Dr. MGR Educational and Research Institute';
      modal.style.display = 'flex';
    },
    closeModal() {
      const modal = document.getElementById('modal-account-profile');
      if (modal) modal.style.display = 'none';
    }
  }
};
