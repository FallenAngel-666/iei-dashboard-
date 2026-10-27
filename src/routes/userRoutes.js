/**
 * IEI TVLC User Administration & Audit Log Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../auth');

// List institutional users
router.get('/users', auth.authenticateToken, auth.requireRole(['admin']), async (req, res) => {
  try {
    const users = await db.getUsers();
    res.json({
      success: true,
      total: users.length,
      users
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list users: ' + err.message });
  }
});

// View activity audit trail
router.get('/audit-logs', auth.authenticateToken, auth.requireRole(['admin', 'auditor']), async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const logs = await db.getAuditLogs(limit);
    res.json({
      success: true,
      total: logs.length,
      logs
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs: ' + err.message });
  }
});

module.exports = router;
