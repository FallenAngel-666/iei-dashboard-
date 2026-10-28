/**
 * MGR IEI Chapter Event Management Routes
 * Handles Technical Lectures, Statutory Days, Seminars, and Competitions.
 * Supports secure, validated object storage for posters and private technical reports.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../auth');
const db = require('../db');
const storageAdapter = require('../storage/storageAdapter');

// Multer memory storage engine (compatible with Vercel serverless memory execution)
const storage = multer.memoryStorage();

// File filter for safety with strict extension and MIME verification
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Anti-Double Extension Protection (e.g. payload.php.png)
  const baseName = path.basename(file.originalname, ext);
  if (baseName.includes('.')) {
    const subExt = path.extname(baseName).toLowerCase();
    const dangerousExts = ['.php', '.phtml', '.php5', '.py', '.js', '.sh', '.exe', '.bat', '.cmd', '.jsp', '.asp', '.aspx', '.cgi'];
    if (dangerousExts.includes(subExt)) {
      return cb(new Error('Double extension detected. Upload rejected for institutional security.'), false);
    }
  }

  if (file.fieldname === 'poster') {
    const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const allowedImageExts = ['.jpg', '.jpeg', '.png', '.webp'];

    if (allowedImageMimes.includes(file.mimetype) && allowedImageExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid poster format. Only verified JPEG, PNG, and WebP images are permitted.'), false);
    }
  } else if (file.fieldname === 'report') {
    const allowedDocMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    const allowedDocExts = ['.pdf', '.docx', '.doc'];

    if (allowedDocMimes.includes(file.mimetype) && allowedDocExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid report format. Only verified PDF and Word documents are permitted.'), false);
    }
  } else {
    cb(new Error('Unsupported upload field.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024 // Max 15MB
  }
}).fields([
  { name: 'poster', maxCount: 1 },
  { name: 'report', maxCount: 1 }
]);

// Wrapper for upload error handling
function handleUpload(req, res, next) {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
}

// GET all events with filters (Requires Authentication)
router.get('/', auth.authenticateToken, async (req, res) => {
  try {
    const { search, category, status, year, month, chapterId } = req.query;
    const events = await db.getEvents({ search, category, status, year, month, chapterId });

    res.json({
      success: true,
      total: events.length,
      events
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list events: ' + err.message });
  }
});

// GET single event by ID (Requires Authentication)
router.get('/:id', auth.authenticateToken, async (req, res) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: `Event with ID '${req.params.id}' was not found.`
      });
    }

    res.json({
      success: true,
      event
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve event: ' + err.message });
  }
});

// Download private event report (Authorized users only)
router.get('/:id/report-download', auth.authenticateToken, async (req, res) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found.' });
    }
    if (!event.reportUrl) {
      return res.status(404).json({ success: false, error: 'No report has been attached to this event.' });
    }

    const downloadTarget = await storageAdapter.getReportDownloadTarget(event.reportUrl);
    if (downloadTarget.type === 'redirect') {
      return res.redirect(downloadTarget.url);
    } else {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.download(downloadTarget.filePath, path.basename(downloadTarget.filePath));
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Report download failed: ' + err.message });
  }
});

// CREATE new event / announcement (Admin & Chairman)
router.post('/', auth.authenticateToken, auth.requireRole(['admin', 'chairman']), handleUpload, async (req, res) => {
  const { title, category, eventDate } = req.body;

  if (!title || !category || !eventDate) {
    return res.status(400).json({
      success: false,
      error: 'Event Title, Category, and Event Date are required.'
    });
  }

  const payload = { ...req.body };

  try {
    if (req.files && req.files['poster']) {
      const pFile = req.files['poster'][0];
      payload.posterUrl = await storageAdapter.saveUploadedFile(pFile, 'poster');
    }

    if (req.files && req.files['report']) {
      const rFile = req.files['report'][0];
      payload.reportUrl = await storageAdapter.saveUploadedFile(rFile, 'report');
    }

    const created = await db.createEvent(payload, req.user);
    res.status(201).json({
      success: true,
      message: `Event '${created.title}' created successfully.`,
      event: created
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to create event: ' + err.message
    });
  }
});

// UPDATE event (Admin & Chairman)
router.put('/:id', auth.authenticateToken, auth.requireRole(['admin', 'chairman']), handleUpload, async (req, res) => {
  try {
    const existing = await db.getEventById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Event with ID '${req.params.id}' not found.`
      });
    }

    const payload = { ...req.body };

    if (req.files && req.files['poster']) {
      const pFile = req.files['poster'][0];
      payload.posterUrl = await storageAdapter.saveUploadedFile(pFile, 'poster');
    }

    if (req.files && req.files['report']) {
      const rFile = req.files['report'][0];
      payload.reportUrl = await storageAdapter.saveUploadedFile(rFile, 'report');
    }

    const updated = await db.updateEvent(req.params.id, payload, req.user);
    res.json({
      success: true,
      message: `Event '${updated.title}' updated successfully.`,
      event: updated
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to update event: ' + err.message
    });
  }
});

// DELETE event (Super Admin only)
router.delete('/:id', auth.authenticateToken, auth.requireRole(['admin']), async (req, res) => {
  try {
    const existing = await db.getEventById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Event with ID '${req.params.id}' not found.`
      });
    }

    const success = await db.deleteEvent(req.params.id, req.user);
    if (success) {
      res.json({
        success: true,
        message: `Event '${existing.title}' deleted successfully.`
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete event.'
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Delete event error: ' + err.message });
  }
});

module.exports = router;
