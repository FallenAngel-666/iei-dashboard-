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
      connectSrc: ["'self'", "https://*.vercel.app", "https://*.mgriei.org"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Hardened CORS policy: Supports Localhost (all ports), Local Network, Vercel deployments, and Institutional domains
app.use(cors({
  origin: (origin, callback) => {
    // 1. Allow direct/same-origin/mobile requests with no origin header
    if (!origin) return callback(null, true);

    // 2. Allow localhost and 127.0.0.1 on any port (3000, 5000, etc.)
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    // 3. Allow local network IP addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    // 4. Allow all Vercel deployments (*.vercel.app)
    if (/^https:\/\/.*\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    // 5. Allow official institutional domains (*.mgriei.org)
    if (/^https?:\/\/(.*\.)?mgriei\.org$/.test(origin)) {
      return callback(null, true);
    }

    // 6. In non-production environments, allow origin
    if (config.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // 7. Custom allowed origin via environment variable
    if (process.env.ALLOWED_ORIGIN && origin === process.env.ALLOWED_ORIGIN) {
      return callback(null, true);
    }

    // Decline gracefully without crashing or throwing an error
    return callback(null, false);
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
    if (err.code === 'EADDRINUSE') {
      console.error(`\n⚠️  PORT ${PORT} IS ALREADY IN USE.`);
      console.error(`Another Node process is already running and occupying port ${PORT}.`);
      console.error(`To free port ${PORT}, run in PowerShell:`);
      console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force`);
      console.error(`Or run on a different port:`);
      console.error(`   $env:PORT=3001; npm start\n`);
    } else {
      console.error('[Server Listen Error]:', err);
    }
  });
}

module.exports = app;
