/**
 * IEI TVLC Staff Administration and Analytics Portal
 * Server Configuration
 */

const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // JWT & Session Security
  JWT_SECRET: process.env.JWT_SECRET || 'iei_tvlc_institution_secret_key_2026_secure_hash',
  JWT_EXPIRES_IN: '8h',
  COOKIE_NAME: 'iei_tvlc_token',
  
  // File Storage Paths
  DATA_DIR: path.join(__dirname, '..', 'data'),
  DB_FILE: path.join(__dirname, '..', 'data', 'portal_database.json'),
  POSTERS_DIR: path.join(__dirname, '..', 'uploads', 'posters'),
  REPORTS_DIR: path.join(__dirname, '..', 'uploads', 'reports'),
  
  // Upload limits
  MAX_POSTER_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_REPORT_SIZE: 15 * 1024 * 1024, // 15MB
  
  // Institutional Details
  INSTITUTION: {
    name: 'The Institution of Engineers (India)',
    centre: 'Tiruvallur Local Centre (TVLC)',
    shortName: 'IEI TVLC',
    website: 'https://ieitvlc.org/',
    chairman: 'Dr. G. Saravanan, FIE',
    honorarySecretary: 'Dr. G.P. Ramesh, FIE',
    address: 'Dr. M.G.R. Educational and Research Institute, EVR Periyar Salai (NH4), Maduravoyal, Chennai - 600095'
  }
};
