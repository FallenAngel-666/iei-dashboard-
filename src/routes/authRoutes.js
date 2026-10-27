/**
 * IEI TVLC Authentication Routes
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
        error: 'This account has been deactivated. Please contact the Centre Administrator.'
      });
    }

    let isValid = auth.verifyPassword(password, user.passwordHash);
    // Development-only fallback: only enabled when explicitly permitted outside production
    if (!isValid && config.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_BYPASS === 'true') {
      if (user.email === 'example@gmail.com' && (password === 'password' || password === 'TVLC_Staff_2026!')) {
        isValid = true;
      }
    }

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
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve profile: ' + err.message });
  }
});

module.exports = router;
