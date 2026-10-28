/**
 * MGR IEI Students Chapter Security & Authentication Module
 * Implements role-based access control (RBAC), password hashing with bcrypt,
 * and signed JWT session token validation.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('./config');
const db = require('./db');

function generateToken(user) {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    assignedChapterId: user.assignedChapterId || null,
    designation: user.designation,
    department: user.department
  };

  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN
  });
}

function verifyPassword(candidatePassword, passwordHash) {
  return bcrypt.compareSync(candidatePassword, passwordHash);
}

function hashPassword(plaintext) {
  return bcrypt.hashSync(plaintext, 10);
}

function authenticateToken(req, res, next) {
  let token = null;

  // 1. Check Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. Check cookies
  if (!token && req.cookies && req.cookies[config.COOKIE_NAME]) {
    token = req.cookies[config.COOKIE_NAME];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in with institutional credentials.'
    });
  }

  jwt.verify(token, config.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired session token. Please sign in again.'
      });
    }

    try {
      // Verify user is still active in database
      const user = await db.getUserById(decoded.id);
      if (!user || user.isActive === false) {
        return res.status(403).json({
          success: false,
          error: 'User account has been deactivated or removed.'
        });
      }

      req.user = decoded;
      if (user.assignedChapterId) {
        req.user.assignedChapterId = user.assignedChapterId;
      }
      next();
    } catch (dbErr) {
      return res.status(500).json({
        success: false,
        error: 'Authentication lookup failed: ' + dbErr.message
      });
    }
  });
}

function optionalToken(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies[config.COOKIE_NAME]) {
    token = req.cookies[config.COOKIE_NAME];
  }

  if (token) {
    jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
      if (!err && decoded) {
        req.user = decoded;
      }
      next();
    });
  } else {
    next();
  }
}

/**
 * Role-Based Access Control (RBAC) middleware
 * @param {Array<string>} roles - e.g. ['admin'], ['admin', 'staff']
 */
function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Permission denied. This administrative action requires one of the following roles: ${roles.join(', ')}. Current role: ${req.user.role}.`
      });
    }

    next();
  };
}

module.exports = {
  generateToken,
  verifyPassword,
  hashPassword,
  authenticateToken,
  optionalToken,
  requireRole
};
