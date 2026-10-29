/**
 * MGR IEI Chapter Analytics Aggregator Routes
 * Serves real database-driven statistics and time-series trends.
 * Adheres strictly to institutional data integrity requirements.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../auth');

// Main Analytics Overview endpoint (Admin, Chairman & Auditor)
router.get('/overview', auth.authenticateToken, auth.requireRole(['admin', 'chairman', 'auditor']), async (req, res) => {
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

// Detailed Membership Analytics (Admin, Chairman & Auditor)
router.get('/membership', auth.authenticateToken, auth.requireRole(['admin', 'chairman', 'auditor']), async (req, res) => {
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

// Detailed Event Analytics (Admin, Chairman & Auditor)
router.get('/events', auth.authenticateToken, auth.requireRole(['admin', 'chairman', 'auditor']), async (req, res) => {
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

// Student Committee Work Progress & Performance Analytics (Admin, Chairman & Auditor)
router.get('/student-progress', auth.authenticateToken, auth.requireRole(['admin', 'chairman', 'auditor']), async (req, res) => {
  try {
    const [tasks, users, reports] = await Promise.all([
      db.getTasks(),
      db.getUsers(),
      db.getWeeklyReports()
    ]);

    // Student Committee Members & Leads
    const students = users.filter(u => u.role === 'committee' || u.role === 'chairman');

    const studentBreakdown = students.map(s => {
      const userTasks = tasks.filter(t => t.assignedTo === s.id || t.assignedToName === s.name);
      const completedTasks = userTasks.filter(t => t.status === 'APPROVED');
      const inProgressTasks = userTasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'SUBMITTED_FOR_REVIEW');
      const avgProgress = userTasks.length 
        ? Math.round(userTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / userTasks.length) 
        : 0;
      const userReport = reports.find(r => r.submittedBy === s.name || r.userId === s.id);

      return {
        id: s.credentialId || s.id,
        name: s.name,
        role: s.role,
        department: s.department || 'Engineering & Technology',
        totalTasks: userTasks.length,
        completedTasks: completedTasks.length,
        inProgressTasks: inProgressTasks.length,
        avgProgress,
        reportStatus: userReport ? userReport.status : 'PENDING'
      };
    });

    // Task Status Distribution
    const statusDistribution = {
      APPROVED: tasks.filter(t => t.status === 'APPROVED').length,
      SUBMITTED_FOR_REVIEW: tasks.filter(t => t.status === 'SUBMITTED_FOR_REVIEW').length,
      IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      ASSIGNED: tasks.filter(t => t.status === 'ASSIGNED' || t.status === 'REVISION_REQUESTED').length
    };

    // Departmental Progress Breakdown
    const departments = {};
    tasks.forEach(t => {
      const dept = t.department || 'General Engineering';
      if (!departments[dept]) {
        departments[dept] = { total: 0, completed: 0, sumProgress: 0 };
      }
      departments[dept].total += 1;
      if (t.status === 'APPROVED') departments[dept].completed += 1;
      departments[dept].sumProgress += (t.progress || 0);
    });

    const deptProgress = Object.keys(departments).map(d => ({
      department: d,
      totalTasks: departments[d].total,
      completedTasks: departments[d].completed,
      avgProgress: Math.round(departments[d].sumProgress / departments[d].total)
    }));

    res.json({
      success: true,
      totalStudents: students.length,
      totalTasks: tasks.length,
      overallCompletionRate: tasks.length ? Math.round((statusDistribution.APPROVED / tasks.length) * 100) : 0,
      statusDistribution,
      deptProgress,
      studentBreakdown
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to aggregate student progress analytics: ' + err.message });
  }
});

module.exports = router;
