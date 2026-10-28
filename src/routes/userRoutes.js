/**
 * MGR IEI Students Chapter — User Administration & Audit Log Routes
 * Exclusively for Admin/Editor and Auditor roles
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../auth');

// GET /api/admin/users — List institutional accounts (Admin only)
router.get('/users', auth.authenticateToken, auth.requireRole(['admin']), async (req, res) => {
  try {
    const rawUsers = await db.getUsers();
    // Protect passwords: never expose passwordHash to client
    const users = rawUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      designation: u.designation,
      department: u.department,
      isActive: u.isActive !== false,
      createdAt: u.createdAt
    }));
    res.json({
      success: true,
      total: users.length,
      users
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list users: ' + err.message });
  }
});

// POST /api/admin/users — Create new student/staff account (Admin only)
router.post('/users', auth.authenticateToken, auth.requireRole(['admin']), async (req, res) => {
  try {
    const { name, email, role, designation, department, password } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'Name and email are required.' });
    }

    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email address already exists.' });
    }

    // Role validation: exactly one of the 4 approved roles
    const validRoles = ['admin', 'chairman', 'committee', 'auditor'];
    const assignedRole = validRoles.includes(role) ? role : 'committee';

    const newUser = await db.createUser({
      name,
      email,
      role: assignedRole,
      designation: designation || 'Student Committee Member',
      department: department || 'Dr. M.G.R. Educational and Research Institute',
      password: password || 'MGR_Member_2026!'
    }, req.user);

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        designation: newUser.designation,
        department: newUser.department,
        isActive: newUser.isActive
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create user: ' + err.message });
  }
});

// PUT /api/admin/users/:id/role — Assign authorized role (Admin only)
router.put('/users/:id/role', auth.authenticateToken, auth.requireRole(['admin']), async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'chairman', 'committee', 'auditor'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role. Must be admin, chairman, committee, or auditor.' });
    }

    const updated = await db.updateUserRole(req.params.id, role, req.user);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    res.json({ success: true, user: { id: updated.id, name: updated.name, role: updated.role } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update role: ' + err.message });
  }
});

// PUT /api/admin/users/:id/status — Activate/Deactivate account (Admin only)
router.put('/users/:id/status', auth.authenticateToken, auth.requireRole(['admin']), async (req, res) => {
  try {
    const { isActive } = req.body;
    const updated = await db.toggleUserActive(req.params.id, isActive, req.user);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    res.json({ success: true, user: { id: updated.id, name: updated.name, isActive: updated.isActive } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to toggle status: ' + err.message });
  }
});

// POST /api/admin/users/:id/reset-password — Initiate secure password reset (Admin only)
router.post('/users/:id/reset-password', auth.authenticateToken, auth.requireRole(['admin']), async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const newPassword = req.body.newPassword || 'MGR_Reset_2026!';
    const newHash = bcrypt.hashSync(newPassword, 10);
    const ok = await db.changeUserPassword(req.params.id, newHash);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    await db.logAction('PASSWORD_RESET_INITIATED', req.user, 'Security', `Password reset performed for user ID: ${req.params.id}`);
    res.json({ success: true, message: 'Password has been reset securely.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Password reset failed: ' + err.message });
  }
});

// GET /api/admin/audit-logs — View activity audit trail (Admin & Auditor)
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
