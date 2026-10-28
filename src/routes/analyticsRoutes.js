/**
 * MGR IEI Chapter Analytics Aggregator Routes
 * Serves real database-driven statistics and time-series trends.
 * Adheres strictly to institutional data integrity requirements.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../auth');

// Main Analytics Overview endpoint (Admin & Auditor only)
router.get('/overview', auth.authenticateToken, auth.requireRole(['admin', 'auditor']), async (req, res) => {
  const { year } = req.query;
  try {
    const data = await db.getAnalyticsOverview(year);
    res.json({
      success: true,
      ...data
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to aggregate analytics: ' + err.message
    });
  }
});

// Detailed Membership Analytics (Admin & Auditor only)
router.get('/membership', auth.authenticateToken, auth.requireRole(['admin', 'auditor']), async (req, res) => {
  try {
    const { year } = req.query;
    const [overview, snapshots, newMemberships] = await Promise.all([
      db.getAnalyticsOverview(year),
      db.getMembershipSnapshots(),
      db.getNewMemberships()
    ]);

    res.json({
      success: true,
      selectedYear: overview.selectedYear,
      kpis: {
        totalStudentMembers: overview.kpis.totalStudentMembers,
        unknownStudentChaptersCount: overview.kpis.unknownStudentChaptersCount,
        totalCorporateMembers: overview.kpis.totalCorporateMembers,
        unknownCorporateChaptersCount: overview.kpis.unknownCorporateChaptersCount,
        newMembersInSelectedYear: overview.kpis.newMembersInSelectedYear,
        totalRegisteredChapters: overview.kpis.totalRegisteredChapters
      },
      annualMembershipTrends: overview.annualMembershipTrends,
      chapterWiseMembership: overview.chapterWiseMembership,
      snapshots,
      newMemberships
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Membership analytics error: ' + err.message });
  }
});

// Detailed Event Analytics (Admin & Auditor only)
router.get('/events', auth.authenticateToken, auth.requireRole(['admin', 'auditor']), async (req, res) => {
  try {
    const { year } = req.query;
    const overview = await db.getAnalyticsOverview(year);

    res.json({
      success: true,
      selectedYear: overview.selectedYear,
      kpis: {
        totalEventsConducted: overview.kpis.totalEventsConducted,
        eventsInSelectedYear: overview.kpis.eventsInSelectedYear
      },
      monthlyEventTrends: overview.monthlyEventTrends,
      annualEventComparisons: overview.annualEventComparisons,
      categoryCounts: overview.categoryCounts,
      statusCounts: overview.statusCounts,
      chapterEventCounts: overview.chapterEventCounts
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Event analytics error: ' + err.message });
  }
});

module.exports = router;
