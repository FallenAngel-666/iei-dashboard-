/**
 * MGR IEI Chapter Dashboard View & Charts Controller
 * Manages KPI summary cards and interactive Chart.js visualizations.
 */

const Dashboard = {
  charts: {},

  destroyCharts() {
    Object.keys(this.charts).forEach(key => {
      if (this.charts[key]) {
        this.charts[key].destroy();
        this.charts[key] = null;
      }
    });
  },

  async load(selectedYear = null) {
    const container = document.getElementById('view-dashboard');
    if (!container) return;

    try {
      const data = await API.getAnalyticsOverview(selectedYear);
      this.renderKPIs(data.kpis, data.selectedYear);
      this.renderCharts(data);
    } catch (err) {
      App.showToast('Failed to load dashboard data: ' + err.message, 'error');
    }
  },

  renderKPIs(kpis, year) {
    // 1. Total Student Members
    const elStudent = document.getElementById('kpi-student-members');
    if (elStudent) {
      elStudent.textContent = kpis.totalStudentMembers.toLocaleString();
    }
    const elStudentSub = document.getElementById('kpi-student-sub');
    if (elStudentSub) {
      elStudentSub.innerHTML = `<span class="unknown-badge">${kpis.unknownStudentChaptersCount} chapters census pending</span>`;
    }

    // 2. Total Corporate Members
    const elCorp = document.getElementById('kpi-corporate-members');
    if (elCorp) {
      elCorp.textContent = kpis.totalCorporateMembers.toLocaleString();
    }
    const elCorpSub = document.getElementById('kpi-corporate-sub');
    if (elCorpSub) {
      elCorpSub.innerHTML = `<span class="unknown-badge">${kpis.unknownCorporateChaptersCount} pending</span> across institutions`;
    }

    // 3. Total Events Conducted
    const elEventsTotal = document.getElementById('kpi-events-total');
    if (elEventsTotal) {
      elEventsTotal.textContent = kpis.totalEventsConducted.toLocaleString();
    }

    // 4. Events in Selected Year
    const elEventsYear = document.getElementById('kpi-events-year');
    if (elEventsYear) {
      elEventsYear.textContent = kpis.eventsInSelectedYear.toLocaleString();
    }
    const elEventsYearSub = document.getElementById('kpi-events-year-sub');
    if (elEventsYearSub) {
      elEventsYearSub.textContent = `Recorded during calendar year ${year}`;
    }

    // 5. New Memberships in Selected Year
    const elNewMembers = document.getElementById('kpi-new-members');
    if (elNewMembers) {
      elNewMembers.textContent = kpis.newMembersInSelectedYear.toLocaleString();
    }
    const elNewMembersSub = document.getElementById('kpi-new-members-sub');
    if (elNewMembersSub) {
      elNewMembersSub.textContent = `${kpis.newStudentMembersInSelectedYear} students + ${kpis.newCorporateMembersInSelectedYear} corporate`;
    }

    // 6. Registered Student Chapters
    const elChapters = document.getElementById('kpi-total-chapters');
    if (elChapters) {
      elChapters.textContent = kpis.totalRegisteredChapters;
    }
    const elChaptersSub = document.getElementById('kpi-total-chapters-sub');
    if (elChaptersSub) {
      elChaptersSub.textContent = `${kpis.activeChaptersCount} active chapters under TVLC`;
    }
  },

  renderCharts(data) {
    this.destroyCharts();

    // Chart Design Tokens — Rolls-Royce White & Institutional Blue System
    const colorNavy = '#102A43'; // Deep Institutional Navy
    const colorRoyal = '#2457A7'; // Royal Blue
    const colorGold = '#B99A5B'; // Champagne Gold Accent
    const colorSteel = '#627D98'; // Steel Blue
    const colorCrimson = '#B91C1C'; // Restrained Crimson

    // 1. Annual Membership Trends Line Chart
    const ctxTrends = document.getElementById('chart-membership-trends')?.getContext('2d');
    if (ctxTrends) {
      const labels = data.annualMembershipTrends.map(t => String(t.year));
      const studentData = data.annualMembershipTrends.map(t => t.studentMembers);
      const corporateData = data.annualMembershipTrends.map(t => t.corporateMembers);

      this.charts.membershipTrends = new Chart(ctxTrends, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Student Members',
              data: studentData,
              borderColor: colorNavy,
              backgroundColor: 'rgba(16, 42, 67, 0.06)',
              borderWidth: 2.5,
              tension: 0.3,
              fill: true,
              pointBackgroundColor: colorNavy,
              pointRadius: 4.5,
              pointHoverRadius: 6.5
            },
            {
              label: 'Corporate Members',
              data: corporateData,
              borderColor: colorGold,
              backgroundColor: 'rgba(185, 154, 91, 0.05)',
              borderWidth: 2.5,
              tension: 0.3,
              fill: true,
              pointBackgroundColor: colorGold,
              pointRadius: 4.5,
              pointHoverRadius: 6.5,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 12 } } },
            tooltip: {
              padding: 10,
              callbacks: {
                afterBody: (context) => {
                  const idx = context[0].dataIndex;
                  const item = data.annualMembershipTrends[idx];
                  if (item.studentGrowthRate !== null) {
                    return `Student Growth: ${item.studentGrowthRate}% YoY\nCorporate Growth: ${item.corporateGrowthRate || 0}% YoY`;
                  }
                  return 'Growth: Historical baseline establishment year';
                }
              }
            }
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: { display: true, text: 'Student Count', font: { size: 11 } },
              grid: { color: '#F1F5F9' }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              title: { display: true, text: 'Corporate Count', font: { size: 11 } },
              grid: { drawOnChartArea: false }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });
    }

    // 2. Monthly Event Trends Chart (Selected Year)
    const ctxMonthly = document.getElementById('chart-monthly-events')?.getContext('2d');
    if (ctxMonthly) {
      const labels = data.monthlyEventTrends.map(m => m.month);
      const techCounts = data.monthlyEventTrends.map(m => m.technicalLectures);
      const statCounts = data.monthlyEventTrends.map(m => m.statutoryDays);
      const otherCounts = data.monthlyEventTrends.map(m => m.otherEvents);

      this.charts.monthlyEvents = new Chart(ctxMonthly, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Technical Lectures',
              data: techCounts,
              backgroundColor: colorNavy,
              borderRadius: 4
            },
            {
              label: 'Statutory Days',
              data: statCounts,
              backgroundColor: colorCrimson,
              borderRadius: 4
            },
            {
              label: 'Workshops & Other',
              data: otherCounts,
              backgroundColor: colorSteel,
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 12 } } }
          },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#F1F5F9' } }
          }
        }
      });
    }

    // 3. Annual Event Comparisons Chart (YoY)
    const ctxAnnual = document.getElementById('chart-annual-events')?.getContext('2d');
    if (ctxAnnual) {
      const labels = data.annualEventComparisons.map(a => String(a.year));
      const totalEvents = data.annualEventComparisons.map(a => a.totalEvents);
      const techLectures = data.annualEventComparisons.map(a => a.technicalLectures);
      const statutoryDays = data.annualEventComparisons.map(a => a.statutoryDays);

      this.charts.annualEvents = new Chart(ctxAnnual, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Total Events',
              data: totalEvents,
              backgroundColor: colorRoyal,
              borderRadius: 4
            },
            {
              label: 'Technical Lectures',
              data: techLectures,
              backgroundColor: colorNavy,
              borderRadius: 4
            },
            {
              label: 'Statutory Days',
              data: statutoryDays,
              backgroundColor: colorCrimson,
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 12 } } }
          },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#F1F5F9' } }
          }
        }
      });
    }

    // 4. Chapter-wise Membership Bar Chart
    const ctxChapters = document.getElementById('chart-chapter-membership')?.getContext('2d');
    if (ctxChapters) {
      // Filter chapters with known counts for clean visualization, and report unknown count
      const knownChapters = data.chapterWiseMembership.filter(c => c.studentMembers !== null);
      const labels = knownChapters.map(c => c.collegeCode || c.chapterName.replace('MGR IEI Chapter ', '').replace(' Student Chapter', ''));
      const values = knownChapters.map(c => c.studentMembers);

      this.charts.chapterMembership = new Chart(ctxChapters, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Verified Student Members',
              data: values,
              backgroundColor: knownChapters.map((_, i) => i % 2 === 0 ? colorNavy : colorRoyal),
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (context) => {
                  const idx = context[0].dataIndex;
                  return knownChapters[idx].collegeName;
                },
                label: (context) => {
                  const idx = context.dataIndex;
                  const item = knownChapters[idx];
                  return `Students: ${item.studentMembers.toLocaleString()} | Corporate: ${item.corporateMembers !== null ? item.corporateMembers : 'Unknown'}`;
                }
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { beginAtZero: true, grid: { color: '#F1F5F9' } }
          }
        }
      });
    }
  }
};
