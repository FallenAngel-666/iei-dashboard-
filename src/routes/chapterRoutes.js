/**
 * MGR IEI Chapter Student Chapter Management Routes
 */

const express = require('express');
const router = express.Router();
const auth = require('../auth');
const db = require('../db');

// List chapters with optional query filters (Requires Authentication)
router.get('/', auth.authenticateToken, async (req, res) => {
  try {
    const { search, status } = req.query;
    const chapters = await db.getChapters({ search, status });
    
    // Calculate summary counts
    const totalCount = chapters.length;
    const knownStudentCount = chapters.reduce((acc, c) => acc + (c.studentMembersCount || 0), 0);
    const unknownStudentCount = chapters.filter(c => c.studentMembersCount === null).length;
    const knownCorporateCount = chapters.reduce((acc, c) => acc + (c.corporateMembersCount || 0), 0);
    const unknownCorporateCount = chapters.filter(c => c.corporateMembersCount === null).length;

    res.json({
      success: true,
      total: totalCount,
      summary: {
        knownStudentCount,
        unknownStudentCount,
        knownCorporateCount,
        unknownCorporateCount
      },
      chapters
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve chapters: ' + err.message });
  }
});

// Get chapter details with related events and membership snapshots (Requires Authentication)
router.get('/:id', auth.authenticateToken, async (req, res) => {
  try {
    const chapter = await db.getChapterById(req.params.id);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        error: `Student chapter with ID '${req.params.id}' was not found.`
      });
    }

    // Get affiliated events
    const allEvents = await db.getEvents();
    const affiliatedEvents = allEvents.filter(e => e.chapterId === chapter.id);

    // Get historical snapshots
    const snapshots = await db.getMembershipSnapshots({ chapterId: chapter.id });

    res.json({
      success: true,
      chapter,
      affiliatedEvents,
      membershipSnapshots: snapshots
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load chapter profile: ' + err.message });
  }
});

// Create new student chapter
router.post('/', auth.authenticateToken, auth.requireRole(['admin', 'staff']), async (req, res) => {
  const { chapterName, collegeName, departments } = req.body;

  if (!chapterName || !collegeName) {
    return res.status(400).json({
      success: false,
      error: 'Chapter Name and College Name are mandatory fields.'
    });
  }

  try {
    const created = await db.createChapter(req.body, req.user);
    res.status(201).json({
      success: true,
      message: `Student Chapter '${created.chapterName}' registered successfully.`,
      chapter: created
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to create student chapter record: ' + err.message
    });
  }
});

// Update student chapter
router.put('/:id', auth.authenticateToken, auth.requireRole(['admin', 'staff', 'coordinator']), async (req, res) => {
  try {
    const existing = await db.getChapterById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Student chapter with ID '${req.params.id}' not found.`
      });
    }

    // IDOR & Scope Protection: Restrict Chapter Coordinators to their assigned chapter
    if ((req.user.role === 'coordinator' || req.user.assignedChapterId) && req.user.assignedChapterId !== req.params.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You are only authorized to modify records for your assigned student chapter.'
      });
    }

    const updated = await db.updateChapter(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: `Student Chapter '${updated.chapterName}' updated successfully.`,
      chapter: updated
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to update student chapter: ' + err.message
    });
  }
});

// Delete student chapter (Super Admin only)
router.delete('/:id', auth.authenticateToken, auth.requireRole(['admin']), async (req, res) => {
  try {
    const existing = await db.getChapterById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Student chapter with ID '${req.params.id}' not found.`
      });
    }

    const success = await db.deleteChapter(req.params.id, req.user);
    if (success) {
      res.json({
        success: true,
        message: `Student Chapter '${existing.chapterName}' has been removed.`
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete student chapter.'
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Delete error: ' + err.message });
  }
});

// Record annual membership snapshot for this chapter
router.post('/:id/snapshot', auth.authenticateToken, auth.requireRole(['admin', 'staff', 'coordinator']), async (req, res) => {
  const { year, studentCount, corporateCount } = req.body;
  
  if (!year) {
    return res.status(400).json({
      success: false,
      error: 'Census Year is required to record a snapshot.'
    });
  }

  try {
    const chapter = await db.getChapterById(req.params.id);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        error: 'Student chapter not found.'
      });
    }

    // IDOR & Scope Protection
    if ((req.user.role === 'coordinator' || req.user.assignedChapterId) && req.user.assignedChapterId !== req.params.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You cannot record census data for other collegiate chapters.'
      });
    }

    const snap = await db.recordAnnualSnapshot(year, chapter.id, studentCount, corporateCount, req.user);
    res.json({
      success: true,
      message: `Recorded ${year} membership snapshot for ${chapter.chapterName}.`,
      snapshot: snap
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Snapshot error: ' + err.message });
  }
});

// Get membership intake records (Staff, Coordinator, Admin, Auditor)
router.get('/intake/records', auth.authenticateToken, async (req, res) => {
  try {
    const { year, chapterId } = req.query;
    let records = await db.getNewMemberships({ year, chapterId });
    if ((req.user.role === 'coordinator' || req.user.assignedChapterId) && req.user.assignedChapterId) {
      records = records.filter(r => r.chapterId === req.user.assignedChapterId);
    }
    res.json({
      success: true,
      total: records.length,
      records
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Intake lookup error: ' + err.message });
  }
});

// Record student membership intake (growth)
router.post('/intake/record', auth.authenticateToken, auth.requireRole(['admin', 'staff', 'coordinator']), async (req, res) => {
  const { year, chapterId, institutionName, studentNew, corporateNew } = req.body;
  if (!year || (!chapterId && !institutionName)) {
    return res.status(400).json({
      success: false,
      error: 'Year and Institution/Chapter are required.'
    });
  }

  // IDOR & Scope Protection for coordinators
  if ((req.user.role === 'coordinator' || req.user.assignedChapterId) && chapterId && req.user.assignedChapterId !== chapterId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. You can only record intake for your assigned collegiate chapter.'
    });
  }

  try {
    const record = await db.recordNewMembership(year, chapterId, studentNew, corporateNew, req.user, institutionName);
    res.json({
      success: true,
      message: `Recorded membership intake for ${record.institutionName}.`,
      record
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Intake record error: ' + err.message });
  }
});

module.exports = router;
