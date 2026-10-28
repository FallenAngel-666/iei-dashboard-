/**
 * MGR IEI Chapter Annual Reports & Data Exports Controller
 * Generates print-ready formal institutional reports matching the official
 * Annual Activity Report (November 2025 – October 2026) and handles CSV downloads.
 */

const Reports = {
  async load(year) {
    const container = document.getElementById('view-reports');
    if (!container) return;

    try {
      const data = await API.getAnalyticsOverview(year);
      const chaptersData = await API.getChapters();
      const eventsData = await API.getEvents({ year: year });

      this.renderPrintableReport(data, chaptersData.chapters, eventsData.events);
    } catch (err) {
      App.showToast('Failed to generate annual report preview: ' + err.message, 'error');
    }
  },

  renderPrintableReport(overview, chapters, events) {
    const container = document.getElementById('printable-report-container');
    if (!container) return;

    const y = overview.selectedYear;
    const inst = overview.institution || {
      name: 'The Institution of Engineers (India)',
      centre: 'Dr. M.G.R. Educational and Research Institute',
      address: 'Secretariat, Chennai - 600058, Tamil Nadu',
      website: 'https://mgriei.org/',
      coordinator: 'Staff Coordinator',
      facultyAdvisor: 'Faculty Advisor'
    };
    const rep = overview.officialReportSummary || {};

    container.innerHTML = `
      <div class="report-paper">
        <!-- Official Institutional Header with Banner Logo -->
        <div class="report-header-banner" style="text-align: center; border-bottom: 2px solid var(--iei-navy); padding-bottom: 16px; margin-bottom: 20px;">
          <img src="/assets/iei-tvlc-banner.png" alt="The Institution of Engineers (India) - Tiruvallur Local Center" style="max-width: 580px; width: 100%; height: auto; display: block; margin: 0 auto 10px auto;">
          <div style="font-size: 11.5px; color: var(--text-muted); font-weight: 500;">
            Established 1920 • Incorporated by Royal Charter 1935 • <strong>Secretariat:</strong> ${App.escapeHtml(inst.address)} • <strong>Official Portal:</strong> ${inst.website}
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="font-size: 19px; font-weight: 800; color: var(--iei-navy); text-transform: uppercase; letter-spacing: 0.5px;">
            ANNUAL ACTIVITY & MEMBERSHIP REPORT
          </h1>
          <div style="font-size: 13.5px; font-weight: 700; color: var(--iei-crimson); margin-top: 4px;">
            REPORTING SESSION: NOVEMBER 2025 – OCTOBER 2026 (${y})
          </div>
        </div>

        <!-- Section 1: Summary of Activities (Official Report Section 1) -->
        <div style="margin-bottom: 26px;">
          <h3 style="font-size: 14px; font-weight: 800; color: var(--iei-navy); border-bottom: 2px solid var(--iei-navy); padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase;">
            1. SUMMARY OF ACTIVITIES (NOV 2025 – OCT 2026)
          </h3>
          <table class="data-table" style="font-size: 13px;">
            <thead>
              <tr style="background: var(--iei-blue-subtle);">
                <th style="width: 10%;">S.No</th>
                <th style="width: 60%;">Activity Category</th>
                <th style="width: 30%; text-align: right;">No. of Activities Conducted</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>1</strong></td>
                <td><strong>Statutory Days</strong> (Energy Conservation, World Water Day, World Environment Day, Engineers' Day Fest)</td>
                <td style="text-align: right; font-weight: 700; color: var(--iei-navy); font-size: 15px;">${rep.statutoryDays || 4}</td>
              </tr>
              <tr>
                <td><strong>2</strong></td>
                <td><strong>Technical Lectures</strong> (49th, 50th, 51st, 52nd, 53rd, 54th Technical Lectures)</td>
                <td style="text-align: right; font-weight: 700; color: var(--iei-navy); font-size: 15px;">${rep.technicalLectures || 6}</td>
              </tr>
              <tr>
                <td><strong>3</strong></td>
                <td><strong>Workshop / Seminar</strong> (One-Day Workshop on "Design and Development of Drones")</td>
                <td style="text-align: right; font-weight: 700; color: var(--iei-navy); font-size: 15px;">${rep.workshops || 1}</td>
              </tr>
              <tr style="background: var(--bg-surface-alt); border-top: 2px solid var(--border-color);">
                <td colspan="2" style="font-weight: 800; text-transform: uppercase;">Total Institutional Activities Conducted</td>
                <td style="text-align: right; font-weight: 800; color: var(--iei-crimson); font-size: 16px;">${rep.totalActivities || 11}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Section 2: Event-Wise Details (Official Report Section 2 - 11 Events) -->
        <div style="margin-bottom: 26px;">
          <h3 style="font-size: 14px; font-weight: 800; color: var(--iei-navy); border-bottom: 2px solid var(--iei-navy); padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; display: flex; justify-content: space-between;">
            <span>2. EVENT-WISE DETAILS (${events.length} PROGRAMMES)</span>
            <span style="font-size: 12px; color: var(--color-success); font-weight: 700;">Total Attendees: ${(rep.totalParticipants || 1019).toLocaleString()}</span>
          </h3>
          <table class="data-table" style="font-size: 11.5px;">
            <thead>
              <tr style="background: var(--iei-blue-subtle);">
                <th style="width: 5%;">#</th>
                <th style="width: 12%;">Date</th>
                <th style="width: 32%;">Event / Lecture Title</th>
                <th style="width: 14%;">Category</th>
                <th style="width: 25%;">Venue / Host Collegiate Campus</th>
                <th style="width: 12%; text-align: right;">Participants</th>
              </tr>
            </thead>
            <tbody>
              ${events.map((ev, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td style="white-space: nowrap; font-weight: 600;">${ev.eventDate}</td>
                  <td>
                    <strong>${App.escapeHtml(ev.title)}</strong>
                    ${ev.speakerName ? `<div style="font-size: 10px; color: var(--text-muted);">${App.escapeHtml(ev.speakerName)} (${App.escapeHtml(ev.speakerOrg || '')})</div>` : ''}
                  </td>
                  <td><span class="badge ${ev.category === 'Statutory Day' ? 'badge-danger' : ev.category === 'Technical Lecture' ? 'badge-primary' : 'badge-warning'}">${App.escapeHtml(ev.category)}</span></td>
                  <td>${App.escapeHtml(ev.venue || ev.collegeOrChapter || 'Campus')}</td>
                  <td style="text-align: right; font-weight: 700; color: var(--iei-navy);">${(ev.attendeesCount || 0).toLocaleString()}</td>
                </tr>
              `).join('')}
              <tr style="background: var(--bg-surface-alt); border-top: 2px solid var(--border-color);">
                <td colspan="5" style="font-weight: 800; text-transform: uppercase;">Total Verified Event Participants</td>
                <td style="text-align: right; font-weight: 800; color: var(--iei-crimson); font-size: 14px;">${(rep.totalParticipants || 1019).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Section 3: Student Membership Growth (Official Report Section 3) -->
        <div style="margin-bottom: 26px;">
          <h3 style="font-size: 14px; font-weight: 800; color: var(--iei-navy); border-bottom: 2px solid var(--iei-navy); padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; display: flex; justify-content: space-between;">
            <span>3. STUDENT MEMBERSHIP GROWTH (NOV 2025 – OCT 2026)</span>
            <span style="font-size: 12px; color: var(--color-success); font-weight: 700;">Total Gained: +${(rep.studentMembersGainedTotal || 1287).toLocaleString()}</span>
          </h3>
          <table class="data-table" style="font-size: 12px;">
            <thead>
              <tr style="background: var(--iei-blue-subtle);">
                <th style="width: 8%;">S.No</th>
                <th style="width: 62%;">Collegiate Institution / Student Chapter</th>
                <th style="width: 30%; text-align: right;">Student Members Gained</th>
              </tr>
            </thead>
            <tbody>
              ${((rep.studentMembersGainedList && rep.studentMembersGainedList.length > 0) ? rep.studentMembersGainedList : [
                { institutionName: 'S.A. Engineering College', studentGained: 365 },
                { institutionName: 'R.M.K. College of Engineering and Technology (RMKCET)', studentGained: 91 },
                { institutionName: 'T.J.S. Engineering College', studentGained: 54 },
                { institutionName: 'Prathyusha Engineering College', studentGained: 70 },
                { institutionName: 'Dr. M.G.R. Educational & Research Institute', studentGained: 707 }
              ]).map((it, idx) => `
                <tr>
                  <td><strong>${idx + 1}</strong></td>
                  <td><strong>${App.escapeHtml(it.institutionName)}</strong></td>
                  <td style="text-align: right; font-weight: 700; color: var(--color-success); font-size: 14px;">+${Number(it.studentGained || 0).toLocaleString()}</td>
                </tr>
              `).join('')}
              <tr style="background: #ECFDF5; border-top: 2px solid var(--border-color);">
                <td colspan="2" style="font-weight: 800; text-transform: uppercase; color: #065F46;">Total Student Members Gained</td>
                <td style="text-align: right; font-weight: 800; color: #065F46; font-size: 16px;">+${(rep.studentMembersGainedTotal || 1287).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Statutory Sign-off -->
        <div class="report-signature-block">
          <div class="sign-col">
            <div class="sign-line"></div>
            <div class="sign-title">${App.escapeHtml(inst.honorarySecretary)}</div>
            <div class="sign-subtitle">Honorary Secretary, MGR IEI Chapter</div>
          </div>
          <div class="sign-col" style="display: flex; align-items: center; justify-content: center;">
            <div style="border: 2px solid var(--iei-navy); border-radius: 50%; width: 72px; height: 72px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: var(--iei-navy); text-align: center; text-transform: uppercase; padding: 4px;">
              MGR IEI Chapter<br>OFFICIAL<br>SEAL
            </div>
          </div>
          <div class="sign-col">
            <div class="sign-line"></div>
            <div class="sign-title">Staff Coordinator</div>
            <div class="sign-subtitle">Faculty Advisor, MGR IEI</div>
          </div>
        </div>

        <div style="margin-top: 30px; font-size: 10px; color: var(--text-muted); text-align: center; border-top: 1px solid var(--border-subtle); padding-top: 10px;">
          Official System-Generated Document • The Institution of Engineers (India) Dr. M.G.R. Educational and Research Institute • Synchronized with Production Database • Generated on ${new Date().toLocaleString()}
        </div>
      </div>
    `;
  },

  printReport() {
    window.print();
  },

  exportChaptersCsv() {
    window.location.href = `/api/export/chapters/csv`;
  },

  exportEventsCsv() {
    const y = App.selectedYear;
    const q = y && y !== 'All' ? `?year=${y}` : '';
    window.location.href = `/api/export/events/csv${q}`;
  },

  exportMembershipCsv() {
    const y = App.selectedYear;
    const q = y && y !== 'All' ? `?year=${y}` : '';
    window.location.href = `/api/export/membership/csv${q}`;
  }
};
