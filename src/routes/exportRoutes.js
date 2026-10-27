/**
 * IEI TVLC Data Export Routes
 * Generates CSV / Excel-compatible institutional records for chapters, events, and memberships.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../auth');

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// Export Student Chapters CSV (Admin & Auditor only)
router.get('/chapters/csv', auth.authenticateToken, auth.requireRole(['admin', 'auditor']), async (req, res) => {
  try {
    const { status, search } = req.query;
    const chapters = await db.getChapters({ status, search });

    const headers = [
      'S.No.',
      'Chapter ID',
      'Student Chapter Name',
      'College Name',
      'College Code',
      'Affiliated Departments',
      'Student Members (Count)',
      'Corporate Members (Count)',
      'Faculty Advisors',
      'Established Year',
      'Status',
      'Contact Email',
      'Phone',
      'Location',
      'Last Census Update'
    ];

    const rows = chapters.map((ch, idx) => [
      idx + 1,
      ch.id,
      ch.chapterName,
      ch.collegeName,
      ch.collegeCode,
      (ch.departments || []).join('; '),
      ch.studentMembersCount !== null ? ch.studentMembersCount : 'Unknown (Census Pending)',
      ch.corporateMembersCount !== null ? ch.corporateMembersCount : 'Unknown (Census Pending)',
      (ch.facultyAdvisors || []).join('; '),
      ch.establishedYear,
      ch.status,
      ch.contactEmail,
      ch.phone,
      ch.location,
      ch.updatedAt
    ]);

    const csvContent = [
      headers.map(escapeCsvField).join(','),
      ...rows.map(r => r.map(escapeCsvField).join(','))
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="IEI_TVLC_Student_Chapters_${Date.now()}.csv"`);
    res.status(200).send('\uFEFF' + csvContent); // Add UTF-8 BOM for Excel compatibility
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to export chapters CSV: ' + err.message });
  }
});

// Export Events Registry CSV (Admin & Auditor only)
router.get('/events/csv', auth.authenticateToken, auth.requireRole(['admin', 'auditor']), async (req, res) => {
  try {
    const { category, status, year, month, chapterId, search } = req.query;
    const events = await db.getEvents({ category, status, year, month, chapterId, search });

    const headers = [
      'S.No.',
      'Event ID',
      'Event Title',
      'Category',
      'Event Date',
      'Event Time',
      'Reporting Year',
      'College / Chapter Name',
      'Speaker Name',
      'Speaker Designation',
      'Speaker Organization',
      'Venue / Platform',
      'Status',
      'Attendees Count',
      'Description',
      'Poster Attached',
      'Report Attached',
      'Created At'
    ];

    const rows = events.map((ev, idx) => [
      idx + 1,
      ev.id,
      ev.title,
      ev.category,
      ev.eventDate,
      ev.eventTime,
      ev.reportingYear,
      ev.collegeOrChapter,
      ev.speakerName,
      ev.speakerDesignation,
      ev.speakerOrg,
      ev.venue,
      ev.status,
      ev.attendeesCount !== null ? ev.attendeesCount : 'N/A',
      ev.description,
      ev.posterUrl ? 'Yes' : 'No',
      ev.reportUrl ? 'Yes' : 'No',
      ev.createdAt
    ]);

    const csvContent = [
      headers.map(escapeCsvField).join(','),
      ...rows.map(r => r.map(escapeCsvField).join(','))
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="IEI_TVLC_Events_Registry_${Date.now()}.csv"`);
    res.status(200).send('\uFEFF' + csvContent);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to export events CSV: ' + err.message });
  }
});

// Export Annual Membership Trends & Snapshots CSV (Admin & Auditor only)
router.get('/membership/csv', auth.authenticateToken, auth.requireRole(['admin', 'auditor']), async (req, res) => {
  try {
    const { year } = req.query;
    const overview = await db.getAnalyticsOverview(year);

    const headers = [
      'Reporting Year',
      'Active Reporting Chapters',
      'Verified Student Members',
      'Student Growth Rate (%)',
      'Verified Corporate Members',
      'Corporate Growth Rate (%)',
      'Total Verified Members',
      'Notes / Growth Audit Status'
    ];

    const rows = overview.annualMembershipTrends.map(t => [
      t.year,
      t.reportingChaptersCount,
      t.studentMembers,
      t.studentGrowthRate !== null ? `${t.studentGrowthRate}%` : 'N/A (Baseline/Unavailable)',
      t.corporateMembers,
      t.corporateGrowthRate !== null ? `${t.corporateGrowthRate}%` : 'N/A (Baseline/Unavailable)',
      t.totalKnownMembers,
      t.note || (t.studentGrowthRate !== null ? 'Computed from verified records' : 'Insufficient historical baseline')
    ]);

    const csvContent = [
      headers.map(escapeCsvField).join(','),
      ...rows.map(r => r.map(escapeCsvField).join(','))
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="IEI_TVLC_Membership_Trends_${Date.now()}.csv"`);
    res.status(200).send('\uFEFF' + csvContent);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to export membership CSV: ' + err.message });
  }
});

module.exports = router;
