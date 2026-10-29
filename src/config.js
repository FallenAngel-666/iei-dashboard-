/**
 * MGR IEI Students Chapter — Student Committee & Staff Portal
 * Central System Configuration
 */

const path = require('path');

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const baseDataDir = isVercel ? '/tmp/data' : (process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const baseUploadsDir = isVercel ? '/tmp/uploads' : (process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads'));

module.exports = {
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_VERCEL: isVercel,
  
  // JWT & Session Security
  JWT_SECRET: process.env.JWT_SECRET || 'mgr_iei_students_chapter_secret_key_2026_secure_hash',
  JWT_EXPIRES_IN: '8h',
  COOKIE_NAME: 'mgr_iei_token',
  
  // File Storage Paths
  DATA_DIR: baseDataDir,
  DB_FILE: path.join(baseDataDir, 'portal_database.json'),
  ORIGINAL_DB_FILE: path.join(__dirname, '..', 'data', 'portal_database.json'),
  POSTERS_DIR: path.join(baseUploadsDir, 'posters'),
  REPORTS_DIR: path.join(baseUploadsDir, 'reports'),
  ATTACHMENTS_DIR: path.join(baseUploadsDir, 'attachments'),
  
  // Upload limits
  MAX_POSTER_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_REPORT_SIZE: 15 * 1024 * 1024, // 15MB
  MAX_ATTACHMENT_SIZE: 10 * 1024 * 1024, // 10MB
  
  // Institutional Identity — MGR IEI Students Chapter Only
  INSTITUTION: {
    name: 'The Institution of Engineers (India) — Dr. M.G.R. Educational and Research Institute Students Chapter',
    shortName: 'MGR IEI Students Chapter',
    college: 'Dr. M.G.R. Educational and Research Institute (Deemed to be University)',
    chapterCode: 'MGR-IEI-SC',
    address: 'EVR Periyar Salai (NH4), Maduravoyal, Chennai - 600095, Tamil Nadu, India',
    timezone: 'Asia/Kolkata',
    reportingCycle: {
      activeWeek: 45,
      deadlineDay: 'Monday',
      deadlineTime: '23:59:59',
      timezone: 'Asia/Kolkata'
    }
  }
};
