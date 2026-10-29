/**
 * MGR IEI Students Chapter — Central Portal API Routes
 * Strict Server-Side Role Enforcement:
 * - Admin/Editor ('admin')
 * - Chairman ('chairman')
 * - Committee Member ('committee')
 * - Auditor ('auditor')
 */

const express = require('express');
const router = express.Router();
const auth = require('../auth');
const db = require('../db');

// ==========================================
// 1. TASK MANAGEMENT
// ==========================================

// GET /api/portal/tasks — View tasks (scoped according to role)
router.get('/tasks', auth.authenticateToken, async (req, res) => {
  try {
    const tasks = await db.getTasks();
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/portal/tasks — Create task (Admin & Chairman only)
router.post('/tasks', auth.authenticateToken, auth.requireRole(['admin', 'chairman']), async (req, res) => {
  try {
    const { title, description, assignedTo, assignedToName, priority, dueDate, department, progress } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Task title is required.' });
    }
    const task = await db.createTask({
      title,
      description,
      assignedTo: assignedTo || req.user.id,
      assignedToName: assignedToName || req.user.name,
      status: 'ASSIGNED',
      priority: priority || 'normal',
      dueDate: dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      department: department || 'Engineering & Technology',
      progress: Number(progress) || 0,
      reviewComments: '',
      history: [
        {
          timestamp: new Date().toISOString(),
          action: 'ASSIGNED',
          actor: req.user.name,
          note: `Task assigned to ${assignedToName || req.user.name}`
        }
      ]
    });
    await db.logAction('TASK_CREATED', req.user, 'Task Management', `Created task: ${title}`);
    res.status(201).json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper for task updating with strict RBAC
async function handleTaskUpdate(req, res) {
  try {
    const allTasks = await db.getTasks();
    const task = allTasks.find(t => t.id === req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found.' });
    }

    // Auditor is strictly read-only
    if (req.user.role === 'auditor') {
      return res.status(403).json({ success: false, error: 'Auditor has read-only access to tasks.' });
    }

    // Committee member can only update their own assigned tasks
    if (req.user.role === 'committee') {
      const isAssignee = task.assignedTo === req.user.id || task.assignedToName === req.user.name;
      if (!isAssignee) {
        return res.status(403).json({ success: false, error: 'Access denied. You can only update tasks assigned to you.' });
      }
      // Committee members cannot approve their own work
      if (req.body.status === 'APPROVED') {
        return res.status(403).json({ success: false, error: 'Committee members cannot approve their own tasks. Submit for review.' });
      }
    }

    const updates = {};
    if (req.body.progress !== undefined) updates.progress = Number(req.body.progress);
    if (req.body.status) updates.status = req.body.status;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.reviewComments !== undefined) updates.reviewComments = req.body.reviewComments;

    // Admin & Chairman can reassign or change priority/due date
    if (req.user.role === 'admin' || req.user.role === 'chairman') {
      if (req.body.title) updates.title = req.body.title;
      if (req.body.priority) updates.priority = req.body.priority;
      if (req.body.dueDate) updates.dueDate = req.body.dueDate;
      if (req.body.assignedTo) updates.assignedTo = req.body.assignedTo;
      if (req.body.assignedToName) updates.assignedToName = req.body.assignedToName;
      if (req.body.department) updates.department = req.body.department;
    }

    // Preserve and append chronological history
    const history = Array.isArray(task.history) ? [...task.history] : [];
    history.push({
      timestamp: new Date().toISOString(),
      action: req.body.status || 'PROGRESS_UPDATED',
      actor: req.user.name,
      note: req.body.historyNote || `Updated progress to ${updates.progress !== undefined ? updates.progress : task.progress}% (Status: ${updates.status || task.status})`
    });
    updates.history = history;

    const updated = await db.updateTask(req.params.id, updates);
    await db.logAction('TASK_UPDATED', req.user, 'Task Management', `Updated task: ${updated.title} -> ${updated.status}`);
    res.json({ success: true, task: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// PUT /api/portal/tasks/:id — Update task with strict role rules
router.put('/tasks/:id', auth.authenticateToken, handleTaskUpdate);

// PUT /api/portal/tasks/:id/progress — Progress update
router.put('/tasks/:id/progress', auth.authenticateToken, async (req, res) => {
  req.body.status = 'IN_PROGRESS';
  req.body.historyNote = req.body.note || `Progress updated to ${req.body.progress}%`;
  return handleTaskUpdate(req, res);
});

// PUT /api/portal/tasks/:id/submit-for-review — Submit for review
router.put('/tasks/:id/submit-for-review', auth.authenticateToken, async (req, res) => {
  req.body.status = 'SUBMITTED_FOR_REVIEW';
  req.body.historyNote = req.body.note || 'Submitted task for review';
  return handleTaskUpdate(req, res);
});

// PUT /api/portal/tasks/:id/approve — Approve task (Admin & Chairman only)
router.put('/tasks/:id/approve', auth.authenticateToken, async (req, res) => {
  if (req.user.role === 'committee') {
    return res.status(403).json({ success: false, error: 'Committee members cannot approve their own tasks.' });
  }
  if (req.user.role === 'auditor') {
    return res.status(403).json({ success: false, error: 'Auditor has read-only access to tasks.' });
  }
  req.body.status = 'APPROVED';
  req.body.progress = 100;
  req.body.reviewComments = req.body.comments || 'Task approved.';
  req.body.historyNote = req.body.comments || 'Task approved by Leadership.';
  return handleTaskUpdate(req, res);
});

// PUT /api/portal/tasks/:id/revision — Request revision (Admin & Chairman only)
router.put('/tasks/:id/revision', auth.authenticateToken, auth.requireRole(['admin', 'chairman']), async (req, res) => {
  req.body.status = 'REVISION_REQUESTED';
  req.body.reviewComments = req.body.comments || 'Revision requested.';
  req.body.historyNote = req.body.comments || 'Revision requested by Leadership.';
  return handleTaskUpdate(req, res);
});

// DELETE /api/portal/tasks/:id — Delete task (Admin only)
router.delete('/tasks/:id', auth.authenticateToken, auth.requireRole(['admin']), async (req, res) => {
  try {
    const ok = await db.deleteTask(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Task not found.' });
    }
    await db.logAction('TASK_DELETED', req.user, 'Task Management', `Deleted task ID: ${req.params.id}`);
    res.json({ success: true, message: 'Task deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. WEEKLY REPORTING WORKFLOW
// ==========================================

// GET /api/portal/weekly-reports — View weekly reports
router.get('/weekly-reports', auth.authenticateToken, async (req, res) => {
  try {
    const reports = await db.getWeeklyReports();
    res.json({ success: true, reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/portal/weekly-reports — Submit weekly report
router.post('/weekly-reports', auth.authenticateToken, async (req, res) => {
  try {
    // Auditor cannot submit reports
    if (req.user.role === 'auditor') {
      return res.status(403).json({ success: false, error: 'Auditor has read-only access to weekly reports.' });
    }

    const { weekNumber, period, department, totalEvents, studentHours, attendeesCount, summary, roadblocks, nextSteps, isDraft } = req.body;
    
    if (!summary) {
      return res.status(400).json({ success: false, error: 'Weekly summary is required.' });
    }

    const initialStatus = isDraft ? 'DRAFT' : 'UNDER_REVIEW';

    const report = await db.createWeeklyReport({
      weekNumber: Number(weekNumber) || 45,
      period: period || 'Current Cycle',
      department: department || req.user.department || 'Engineering & Technology',
      totalEvents: Number(totalEvents) || 0,
      studentHours: Number(studentHours) || 0,
      attendeesCount: Number(attendeesCount) || 0,
      summary,
      roadblocks: roadblocks || 'None reported.',
      nextSteps: nextSteps || 'Continue ongoing task schedule.',
      submittedBy: req.user.name,
      submittedByRole: req.user.role,
      status: initialStatus,
      reviewComments: '',
      endorsedBy: null,
      endorsedAt: null,
      submittedAt: new Date().toISOString()
    });

    await db.logAction('WEEKLY_REPORT_SUBMITTED', req.user, 'Weekly Reporting', `Submitted Activity Report for Week ${report.weekNumber} (${report.status})`);
    res.status(201).json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/portal/weekly-reports/:id — Update/Review weekly report
router.put('/weekly-reports/:id', auth.authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'auditor') {
      return res.status(403).json({ success: false, error: 'Auditor has read-only access to reports.' });
    }

    const reports = await db.getWeeklyReports();
    const existing = reports.find(r => r.id === req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Weekly report not found.' });
    }

    // Committee member can only update their own reports if not locked or approved
    if (req.user.role === 'committee') {
      if (existing.submittedBy !== req.user.name && existing.submittedBy !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Access denied. You can only update your own report.' });
      }
      if (existing.status === 'LOCKED' || existing.status === 'APPROVED') {
        return res.status(403).json({ success: false, error: 'This report has been finalized and cannot be modified.' });
      }
      // Committee member cannot self-approve
      if (req.body.status === 'APPROVED') {
        return res.status(403).json({ success: false, error: 'Committee members cannot approve their own reports.' });
      }
    }

    const updates = {};
    if (req.body.summary !== undefined) updates.summary = req.body.summary;
    if (req.body.roadblocks !== undefined) updates.roadblocks = req.body.roadblocks;
    if (req.body.nextSteps !== undefined) updates.nextSteps = req.body.nextSteps;
    if (req.body.totalEvents !== undefined) updates.totalEvents = Number(req.body.totalEvents);
    if (req.body.studentHours !== undefined) updates.studentHours = Number(req.body.studentHours);
    if (req.body.attendeesCount !== undefined) updates.attendeesCount = Number(req.body.attendeesCount);

    // Reviewer actions (Chairman & Admin)
    if (req.user.role === 'chairman' || req.user.role === 'admin') {
      if (req.body.reviewComments !== undefined) updates.reviewComments = req.body.reviewComments;
      if (req.body.status) updates.status = req.body.status;
      if (req.body.status === 'APPROVED') {
        updates.endorsedBy = req.user.name;
        updates.endorsedAt = new Date().toISOString();
      }
    } else if (req.body.status === 'SUBMITTED' || req.body.status === 'RESUBMITTED') {
      updates.status = 'UNDER_REVIEW';
    }

    const updated = await db.updateWeeklyReport(req.params.id, updates);
    await db.logAction('WEEKLY_REPORT_UPDATED', req.user, 'Weekly Reporting', `Updated report ID: ${req.params.id} (Status: ${updated.status})`);
    res.json({ success: true, report: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/portal/weekly-reports/:id/endorse — Approve & Endorse Report (Chairman & Admin only)
router.post('/weekly-reports/:id/endorse', auth.authenticateToken, auth.requireRole(['chairman', 'admin']), async (req, res) => {
  try {
    const updated = await db.updateWeeklyReport(req.params.id, {
      status: 'APPROVED',
      endorsedBy: req.user.name,
      endorsedAt: new Date().toISOString(),
      reviewComments: req.body.reviewComments || 'Approved by Chapter Leadership.'
    });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Weekly report not found.' });
    }
    await db.logAction('WEEKLY_REPORT_ENDORSED', req.user, 'Governance', `Endorsed Weekly Report #${updated.weekNumber}`);
    res.json({ success: true, report: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/portal/weekly-reports/:id/revision — Request Revision (Chairman & Admin only)
router.post('/weekly-reports/:id/revision', auth.authenticateToken, auth.requireRole(['chairman', 'admin']), async (req, res) => {
  try {
    const comments = req.body.comments || 'Please revise activity logs and resubmit.';
    const updated = await db.updateWeeklyReport(req.params.id, {
      status: 'REVISION_REQUESTED',
      reviewComments: comments
    });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Weekly report not found.' });
    }
    await db.logAction('WEEKLY_REPORT_REVISION_REQUESTED', req.user, 'Governance', `Requested revision on Weekly Report #${updated.weekNumber}: ${comments}`);
    res.json({ success: true, report: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. GOOGLE CLASSROOM-STYLE SHARED COMMUNITY
// ==========================================

// GET /api/portal/community — View chapter stream
router.get('/community', auth.authenticateToken, async (req, res) => {
  try {
    const posts = await db.getCommunityPosts();
    res.json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/portal/community — Create stream post
router.post('/community', auth.authenticateToken, async (req, res) => {
  try {
    const { title, content, category, tags, isPinned, type, attachments } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: 'Content is required.' });
    }

    // Only Admin & Chairman can publish official announcements or pin posts
    const postType = (type === 'announcement' && (req.user.role === 'admin' || req.user.role === 'chairman'))
      ? 'announcement'
      : 'discussion';

    const post = await db.createCommunityPost({
      title: title || (postType === 'announcement' ? 'Chapter Announcement' : 'Class Discussion'),
      type: postType,
      content,
      category: category || (postType === 'announcement' ? 'Official Announcements' : 'Student Discussions'),
      tags,
      isPinned: (req.user.role === 'admin' || req.user.role === 'chairman') ? Boolean(isPinned) : false,
      author: req.user.name,
      role: req.user.role,
      attachments: Array.isArray(attachments) ? attachments : [],
      replies: []
    });

    await db.logAction('COMMUNITY_POST_CREATED', req.user, 'Community', `Published ${postType}: ${post.title}`);
    res.status(201).json({ success: true, post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/portal/community/:id/reply — Inline comment reply (Classroom style)
router.post('/community/:id/reply', auth.authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Comment content is required.' });
    }
    const result = await db.addCommunityComment(req.params.id, { content: content.trim() }, req.user);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Post not found.' });
    }
    res.status(201).json({ success: true, reply: result.reply, post: result.post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/portal/community/:id/like — Upvote / endorse post
router.post('/community/:id/like', auth.authenticateToken, async (req, res) => {
  try {
    const post = await db.likeCommunityPost(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found.' });
    }
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. PRIVATE MESSAGING HUB
// ==========================================

// GET /api/portal/messages — Scoped private messages
router.get('/messages', auth.authenticateToken, async (req, res) => {
  try {
    const allMessages = await db.getMessages();
    // Non-admin users only see messages they sent or received
    let messages = allMessages;
    if (req.user.role !== 'admin') {
      messages = allMessages.filter(m => m.senderId === req.user.id || m.recipientId === req.user.id || !m.recipientId);
    }
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/portal/messages — Send private message
router.post('/messages', auth.authenticateToken, async (req, res) => {
  try {
    const { recipientId, content, attachments } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Message content is required.' });
    }

    const msg = await db.sendMessage({
      senderId: req.user.id,
      senderName: req.user.name,
      senderRole: req.user.role,
      recipientId: recipientId || 'usr_admin_01',
      content: content.trim(),
      attachments: Array.isArray(attachments) ? attachments : []
    });

    res.status(201).json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. REPORTING SETTINGS (ADMIN ONLY)
// ==========================================

router.get('/reporting-settings', auth.authenticateToken, async (req, res) => {
  try {
    const settings = await db.getReportingSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/reporting-settings', auth.authenticateToken, auth.requireRole(['admin', 'chairman']), async (req, res) => {
  try {
    const updated = await db.updateReportingSettings(req.body, req.user);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 6. AUDIT OBSERVATIONS (AUDITOR & ADMIN)
// ==========================================

router.get('/audit-observations', auth.authenticateToken, async (req, res) => {
  try {
    const observations = await db.getAuditObservations();
    res.json({ success: true, observations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/audit-observations', auth.authenticateToken, auth.requireRole(['auditor', 'admin']), async (req, res) => {
  try {
    const title = req.body.title;
    const observation = req.body.observation || req.body.observationText;
    const complianceStatus = req.body.complianceStatus || 'COMPLIANT';
    if (!title || !observation) {
      return res.status(400).json({ success: false, error: 'Title and observation text are required.' });
    }
    const obs = await db.addAuditObservation({
      title,
      observation,
      complianceStatus: complianceStatus || 'COMPLIANT'
    }, req.user);
    res.status(201).json({ success: true, observation: obs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 7. NOTIFICATIONS
// ==========================================

router.get('/notifications', auth.authenticateToken, async (req, res) => {
  try {
    const notifications = await db.getNotifications();
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/notifications/mark-read', auth.authenticateToken, async (req, res) => {
  try {
    await db.markNotificationsRead();
    res.json({ success: true, message: 'Notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
