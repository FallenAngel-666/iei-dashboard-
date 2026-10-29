/**
 * MGR IEI Chapter Authentication Routes
 */

const express = require('express');
const router = express.Router();
const auth = require('../auth');
const db = require('../db');
const config = require('../config');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Institutional email and password are required.'
    });
  }

  try {
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. User not found in institutional directory.'
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        error: 'This account has been deactivated. Please contact the Chapter Administrator.'
      });
    }

    const isValid = auth.verifyPassword(password, user.passwordHash, user);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password. Please check your institutional credentials.'
      });
    }

    // Clear rate limit on valid authentication
    if (req.rateLimitReset) {
      req.rateLimitReset();
    }

    const token = auth.generateToken(user);

    // Set HTTP-only cookie for secure browser persistence
    res.cookie(config.COOKIE_NAME, token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });

    await db.logAction('LOGIN', user, 'Portal Auth', `User signed into staff administration portal.`);

    return res.json({
      success: true,
      message: `Welcome, ${user.name}`,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedChapterId: user.assignedChapterId || null,
        designation: user.designation,
        department: user.department
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Authentication service error: ' + err.message
    });
  }
});

router.post('/quick-access', authLimiter, async (req, res) => {
  // Only available in non-production environments
  if (config.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, error: 'Quick demo access is disabled in production.' });
  }
  const { role } = req.body;
  const validRoles = ['admin', 'chairman', 'committee', 'auditor'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role.' });
  }
  const roleEmails = {
    admin: 'admin@mgriei.org',
    chairman: 'chairman@mgriei.org',
    committee: 'committee@mgriei.org',
    auditor: 'auditor@mgriei.org'
  };
  const user = await db.getUserByEmail(roleEmails[role]);
  if (!user || user.isActive === false) {
    return res.status(404).json({ success: false, error: 'Role account not found or deactivated.' });
  }
  const token = auth.generateToken(user);
  res.cookie(config.COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  });
  await db.logAction('LOGIN_QUICK_ACCESS', user, 'Portal Auth', `Quick access sign-in as ${user.role}`);
  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      assignedChapterId: user.assignedChapterId || null,
      designation: user.designation,
      department: user.department
    }
  });
});

router.post('/logout', auth.optionalToken, async (req, res) => {
  if (req.user) {
    try {
      await db.logAction('LOGOUT', req.user, 'Portal Auth', 'User logged out.');
    } catch (e) {}
  }

  res.clearCookie(config.COOKIE_NAME);
  return res.json({
    success: true,
    message: 'Successfully logged out.'
  });
});

router.get('/me', auth.authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedChapterId: user.assignedChapterId || null,
        designation: user.designation,
        department: user.department,
        phone: user.phone || '',
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve profile: ' + err.message });
  }
});

// Update Profile
router.put('/profile', auth.authenticateToken, async (req, res) => {
  try {
    const { name, designation, department, phone } = req.body;
    const updated = await db.updateUserProfile(req.user.id, { name, designation, department, phone });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    await db.logAction('PROFILE_UPDATE', req.user, 'Account Management', `Updated profile credentials for ${updated.name}.`);
    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        assignedChapterId: updated.assignedChapterId || null,
        designation: updated.designation,
        department: updated.department,
        phone: updated.phone || ''
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update profile: ' + err.message });
  }
});

// Change Password
router.post('/change-password', auth.authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Both current and new password are required.' });
    }
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    if (!auth.verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(401).json({ success: false, error: 'Current password does not match.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters long.' });
    }
    const newHash = auth.hashPassword(newPassword);
    await db.changeUserPassword(req.user.id, newHash);
    await db.logAction('PASSWORD_CHANGE', req.user, 'Security', `Changed account password.`);
    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update password: ' + err.message });
  }
});

module.exports = router;
