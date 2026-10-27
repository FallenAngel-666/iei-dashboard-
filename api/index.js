/**
 * Vercel Serverless Function Entry Point for IEI TVLC Portal
 * Routes incoming HTTP requests through the hardened Express application instance.
 */

const app = require('../server');

module.exports = app;
