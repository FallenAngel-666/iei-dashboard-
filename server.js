/**
 * MGR IEI Students Chapter — Student Committee & Staff Portal
 * Dr. M.G.R. Educational and Research Institute
 * The Institution of Engineers (India)
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const config = require('./src/config');
const db = require('./src/db');

// Route modules
const authRoutes = require('./src/routes/authRoutes');
const chapterRoutes = require('./src/routes/chapterRoutes');
const eventRoutes = require('./src/routes/eventRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const exportRoutes = require('./src/routes/exportRoutes');
const userRoutes = require('./src/routes/userRoutes');
const portalRoutes = require('./src/routes/portalRoutes');

// Initialize Database
db.initDatabase();

const app = express();

// Security Headers (Hardened Helmet Policy)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https://*"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Hardened CORS policy: Whitelists authorized institutional origins
const allowedOrigins = [
  'https://mgriei.org',
  'https://www.mgriei.org',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || config.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('Cross-Origin Request Blocked: Origin not authorized by MGR IEI security policy.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body & Cookie Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Robust Query Parameter Parsing (supports standalone, proxy, and test harnesses)
app.use((req, res, next) => {
  if (!req.query || Object.keys(req.query).length === 0) {
    const rawUrl = req.originalUrl || req.url;
    if (rawUrl && rawUrl.includes('?')) {
      const qs = rawUrl.split('?')[1];
      const params = new URLSearchParams(qs);
      req.query = req.query || {};
      for (const [k, v] of params.entries()) {
        req.query[k] = v;
      }
    }
  }
  next();
});

// Static file servers with anti-execution and nosniff headers
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads/posters', express.static(config.POSTERS_DIR, {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));
app.use('/uploads/reports', express.static(config.REPORTS_DIR, {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'attachment'); // Force download to prevent in-browser execution
  }
}));

// API Health Check
app.get('/api/health', async (req, res) => {
  try {
    const chapters = await db.getChapters();
    const events = await db.getEvents();
    let dbStatus = 'ONLINE';
    let dbEngine = 'Local JSON Storage';

    if (process.env.DATABASE_URL) {
      dbEngine = 'Managed PostgreSQL (Serverless)';
      const { testConnection } = require('./src/db/pgClient');
      const conn = await testConnection();
      if (!conn.connected) {
        dbStatus = 'DEGRADED';
      }
    }

    res.json({
      status: dbStatus,
      engine: dbEngine,
      institution: config.INSTITUTION.shortName,
      fullName: config.INSTITUTION.name,
      centre: config.INSTITUTION.centre,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      stats: {
        registeredChapters: chapters.length,
        eventsLogged: events.length
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});

// Mount API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/admin', userRoutes);
app.use('/api/portal', portalRoutes);

// Direct endpoint aliases for portal modules
app.use('/api/tasks', (req, res, next) => {
  req.url = '/tasks' + (req.url === '/' ? '' : req.url);
  portalRoutes(req, res, next);
});
app.use('/api/weekly-reports', (req, res, next) => {
  req.url = '/weekly-reports' + (req.url === '/' ? '' : req.url);
  portalRoutes(req, res, next);
});
app.use('/api/community', (req, res, next) => {
  req.url = '/community' + (req.url === '/' ? '' : req.url);
  portalRoutes(req, res, next);
});
app.use('/api/messages', (req, res, next) => {
  req.url = '/messages' + (req.url === '/' ? '' : req.url);
  portalRoutes(req, res, next);
});
app.use('/api/notifications', (req, res, next) => {
  req.url = '/notifications' + (req.url === '/' ? '' : req.url);
  portalRoutes(req, res, next);
});
app.use('/api/reporting-settings', (req, res, next) => {
  req.url = '/reporting-settings' + (req.url === '/' ? '' : req.url);
  portalRoutes(req, res, next);
});
app.use('/api/audit-observations', (req, res, next) => {
  req.url = '/audit-observations' + (req.url === '/' ? '' : req.url);
  portalRoutes(req, res, next);
});

// SPA fallback
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error occurred.'
  });
});

// Start Server if not imported by test runner
if (require.main === module) {
  const PORT = config.PORT;
  const server = app.listen(PORT, config.HOST, () => {
    console.log(`=======================================================`);
    console.log(` MGR IEI Students Chapter — Management Portal`);
    console.log(` Official Institution: ${config.INSTITUTION.name}`);
    console.log(` Chapter Code:         ${config.INSTITUTION.chapterCode}`);
    console.log(` Server Listening on:  http://localhost:${PORT}`);
    console.log(` Environment:          ${config.NODE_ENV}`);
    console.log(`=======================================================`);
  });

  server.on('error', (err) => {
    console.error('[Server Listen Error]:', err);
  });
}

module.exports = app;
