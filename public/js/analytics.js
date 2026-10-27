/**
 * IEI TVLC Analytics Views Controller
 * Manages detailed Membership Analytics and Event Analytics tabs.
 */

const Analytics = {
  charts: {},

  destroyCharts() {
    Object.keys(this.charts).forEach(key => {
      if (this.charts[key]) {
        this.charts[key].destroy();
        this.charts[key] = null;
      }
    });
  },

  async loadMembership(year) {
    const container = document.getElementById('view-membership-analytics');
    if (!container) return;

    try {
      const data = await API.getMembershipAnalytics(year);
      this.renderMembershipView(data);
    } catch (err) {
      App.showToast('Failed to load membership analytics: ' + err.message, 'error');
    }
  },

  renderMembershipView(data) {
    // 1. Populate summary cards
    const totalStudent = document.getElementById('ma-total-students');
    if (totalStudent) totalStudent.textContent = data.kpis.totalStudentMembers.toLocaleString();

    const unknownStudent = document.getElementById('ma-unknown-students');
    if (unknownStudent) unknownStudent.textContent = `${data.kpis.unknownStudentChaptersCount} chapters pending census`;

    const totalCorp = document.getElementById('ma-total-corporate');
    if (totalCorp) totalCorp.textContent = data.kpis.totalCorporateMembers.toLocaleString();

    const newMembers = document.getElementById('ma-new-intake');
    if (newMembers) newMembers.textContent = data.kpis.newMembersInSelectedYear.toLocaleString();

    // 2. Render Historical Growth & Percentage Table (Strict Data Integrity)
    const tbody = document.getElementById('ma-growth-table-body');
    if (tbody) {
      tbody.innerHTML = data.annualMembershipTrends.map(t => {
        let studentGrowthBadge = `<span style="color: var(--text-muted); font-size: 11.5px;">Establishment Year</span>`;
        if (t.studentGrowthRate !== null) {
          const isPos = t.studentGrowthRate >= 0;
          studentGrowthBadge = `<span class="badge ${isPos ? 'badge-success' : 'badge-danger'}">${isPos ? '+' : ''}${t.studentGrowthRate}%</span>`;
        }

        let corpGrowthBadge = `<span style="color: var(--text-muted); font-size: 11.5px;">Establishment Year</span>`;
        if (t.corporateGrowthRate !== null) {
          const isPos = t.corporateGrowthRate >= 0;
          corpGrowthBadge = `<span class="badge ${isPos ? 'badge-success' : 'badge-danger'}">${isPos ? '+' : ''}${t.corporateGrowthRate}%</span>`;
        }

        return `
          <tr>
            <td><strong>Academic Year ${t.year}</strong></td>
            <td><span class="badge badge-info">${t.reportingChaptersCount} Chapters Reported</span></td>
            <td><strong style="color: var(--iei-navy);">${t.studentMembers.toLocaleString()}</strong></td>
            <td>${studentGrowthBadge}</td>
            <td><strong style="color: var(--iei-crimson);">${t.corporateMembers.toLocaleString()}</strong></td>
            <td>${corpGrowthBadge}</td>
            <td><strong>${t.totalKnownMembers.toLocaleString()}</strong></td>
            <td style="font-size: 11px; color: var(--text-muted);">${t.note || 'Verified census audit complete'}</td>
          </tr>
        `;
      }).join('');
    }

    // 3. Render New Memberships by Chapter Table
    const nmBody = document.getElementById('ma-new-members-body');
    if (nmBody) {
      const yearIntake = (data.newMemberships || []).filter(nm => nm.year === data.selectedYear);
      if (yearIntake.length === 0) {
        nmBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">No new intake records logged for year ${data.selectedYear}.</td></tr>`;
      } else {
        nmBody.innerHTML = yearIntake.map(nm => {
          const ch = data.chapterWiseMembership.find(c => c.id === nm.chapterId);
          return `
            <tr>
              <td><strong>${ch ? ch.chapterName : nm.chapterId}</strong></td>
              <td>+${nm.studentNew || 0}</td>
              <td>+${nm.corporateNew || 0}</td>
              <td>${nm.recordedDate || 'N/A'}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // 4. Render Deep Dive Membership Chart
    const ctx = document.getElementById('chart-ma-comparison')?.getContext('2d');
    if (ctx) {
      if (this.charts.maComparison) this.charts.maComparison.destroy();

      const chaptersWithData = data.chapterWiseMembership.filter(c => c.studentMembers !== null);
      this.charts.maComparison = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: chaptersWithData.map(c => c.collegeCode || c.chapterName.substring(0, 15)),
          datasets: [
            {
              label: 'Student Members',
              data: chaptersWithData.map(c => c.studentMembers),
              backgroundColor: '#002B49',
              borderRadius: 4
            },
            {
              label: 'Corporate Members',
              data: chaptersWithData.map(c => c.corporateMembers || 0),
              backgroundColor: '#C2185B',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                title: (context) => chaptersWithData[context[0].dataIndex].chapterName
              }
            }
          },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, grid: { color: '#F1F5F9' } }
          }
        }
      });
    }
  },

  async loadEvents(year) {
    const container = document.getElementById('view-event-analytics');
    if (!container) return;

    try {
      const data = await API.getEventAnalytics(year);
      this.renderEventsView(data);
    } catch (err) {
      App.showToast('Failed to load event analytics: ' + err.message, 'error');
    }
  },

  renderEventsView(data) {
    // 1. Category Distribution Donut Chart
    const ctxCat = document.getElementById('chart-ea-categories')?.getContext('2d');
    if (ctxCat) {
      if (this.charts.eaCat) this.charts.eaCat.destroy();

      this.charts.eaCat = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
          labels: ['Technical Lectures', 'Statutory Days', 'Workshops/Seminars', 'Competitions'],
          datasets: [{
            data: [
              data.categoryCounts.technicalLecture || 0,
              data.categoryCounts.statutoryDay || 0,
              data.categoryCounts.workshop || 0,
              data.categoryCounts.competition || 0
            ],
            backgroundColor: ['#002B49', '#C2185B', '#F59E0B', '#10B981'],
            borderWidth: 2,
            borderColor: '#FFFFFF'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          },
          cutout: '65%'
        }
      });
    }

    // 2. Status Breakdown Chart
    const ctxStatus = document.getElementById('chart-ea-status')?.getContext('2d');
    if (ctxStatus) {
      if (this.charts.eaStatus) this.charts.eaStatus.destroy();

      this.charts.eaStatus = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
          labels: ['Completed', 'Upcoming', 'In Progress', 'Cancelled'],
          datasets: [{
            data: [
              data.statusCounts.completed || 0,
              data.statusCounts.upcoming || 0,
              data.statusCounts.inProgress || 0,
              data.statusCounts.cancelled || 0
            ],
            backgroundColor: ['#10B981', '#F59E0B', '#0284C7', '#EF4444'],
            borderWidth: 2,
            borderColor: '#FFFFFF'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          },
          cutout: '65%'
        }
      });
    }

    // 3. Chapter-wise Events Contribution Bar Chart
    const ctxChapter = document.getElementById('chart-ea-chapters')?.getContext('2d');
    if (ctxChapter) {
      if (this.charts.eaChapters) this.charts.eaChapters.destroy();

      const items = data.chapterEventCounts || [];
      this.charts.eaChapters = new Chart(ctxChapter, {
        type: 'bar',
        data: {
          labels: items.map(c => c.collegeCode || c.chapterName.substring(0, 15)),
          datasets: [{
            label: 'Events Hosted',
            data: items.map(c => c.eventCount),
            backgroundColor: '#0E568F',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#F1F5F9' } }
          }
        }
      });
    }
  }
};
