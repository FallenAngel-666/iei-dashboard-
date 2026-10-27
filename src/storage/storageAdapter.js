/**
 * IEI TVLC Secure Object Storage Adapter
 * Supports Supabase Storage (cloud serverless) with fallback to verified local storage.
 * Implements magic-byte verification, anti-double-extension protection, and private signed URLs.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

let supabaseClient = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (url && key) {
    const { createClient } = require('@supabase/supabase-js');
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false }
    });
    return supabaseClient;
  }
  return null;
}

/**
 * Validates actual binary content (magic numbers) of the uploaded file
 * @param {Buffer} buffer - File buffer
 * @param {string} fieldname - 'poster' or 'report'
 * @returns {boolean}
 */
function validateMagicBytes(buffer, fieldname) {
  if (!buffer || buffer.length < 4) return false;

  if (fieldname === 'poster') {
    // JPEG: FF D8 FF
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    // PNG: 89 50 4E 47
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    // WebP: RIFF .... WEBP
    const isWebp = buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    return isJpeg || isPng || isWebp;
  } else if (fieldname === 'report') {
    // PDF: %PDF (25 50 44 46)
    const isPdf = buffer.subarray(0, 4).toString('ascii') === '%PDF';
    // DOCX / ZIP: PK\x03\x04 (50 4B 03 04)
    const isDocx = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
    // DOC / OLE CFB: D0 CF 11 E0
    const isDoc = buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;

    return isPdf || isDocx || isDoc;
  }

  return false;
}

/**
 * Saves an uploaded file buffer to persistent storage (Supabase Storage or local disk)
 * @param {Object} file - Multer memory file object
 * @param {string} fieldname - 'poster' or 'report'
 * @returns {Promise<string>} - Public or accessible URL/path
 */
async function saveUploadedFile(file, fieldname) {
  const ext = path.extname(file.originalname).toLowerCase();
  const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const uniqueKey = `${fieldname}_${safeBase}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;

  // 1. Check Magic Bytes
  if (!validateMagicBytes(file.buffer, fieldname)) {
    throw new Error(`File content verification failed for ${fieldname}. Actual binary headers do not match allowed formats.`);
  }

  const supabase = getSupabase();
  const posterBucket = process.env.SUPABASE_POSTERS_BUCKET || 'iei-tvlc-posters';
  const reportBucket = process.env.SUPABASE_REPORTS_BUCKET || 'iei-tvlc-reports';

  if (supabase) {
    const bucket = fieldname === 'poster' ? posterBucket : reportBucket;
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(uniqueKey, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error(`[Supabase Storage Error]: Upload failed for ${uniqueKey}:`, error.message);
      throw new Error(`Cloud storage upload failed: ${error.message}`);
    }

    if (fieldname === 'poster') {
      const { data: pubUrl } = supabase.storage.from(bucket).getPublicUrl(uniqueKey);
      return pubUrl.publicUrl;
    } else {
      // Private reports store relative storage key; served via signed URL
      return `storage://${bucket}/${uniqueKey}`;
    }
  }

  // Fallback to local storage (for local development)
  const targetDir = fieldname === 'poster' ? config.POSTERS_DIR : config.REPORTS_DIR;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filePath = path.join(targetDir, uniqueKey);
  fs.writeFileSync(filePath, file.buffer);

  return fieldname === 'poster' ? `/uploads/posters/${uniqueKey}` : `/uploads/reports/${uniqueKey}`;
}

/**
 * Generates an authorized download URL or stream for confidential reports
 * @param {string} reportUrl - Stored report reference (storage://... or /uploads/reports/...)
 * @param {number} expiresInSeconds - Expiration time for signed link (default 900s / 15 mins)
 * @returns {Promise<{ type: 'redirect' | 'local_path', url?: string, filePath?: string }>}
 */
async function getReportDownloadTarget(reportUrl, expiresInSeconds = 900) {
  if (!reportUrl) {
    throw new Error('No report file is attached to this event record.');
  }

  if (reportUrl.startsWith('storage://')) {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Cloud storage credentials unavailable to resolve signed link.');
    }

    const withoutPrefix = reportUrl.replace('storage://', '');
    const firstSlash = withoutPrefix.indexOf('/');
    const bucket = withoutPrefix.substring(0, firstSlash);
    const key = withoutPrefix.substring(firstSlash + 1);

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(key, expiresInSeconds);

    if (error || !data) {
      throw new Error(`Failed to generate signed download link: ${error ? error.message : 'Unknown error'}`);
    }

    return { type: 'redirect', url: data.signedUrl };
  }

  // Local file path
  const localFileName = path.basename(reportUrl);
  const localPath = path.join(config.REPORTS_DIR, localFileName);
  if (!fs.existsSync(localPath)) {
    throw new Error('Report file could not be found on server disk.');
  }

  return { type: 'local_path', filePath: localPath };
}

module.exports = {
  validateMagicBytes,
  saveUploadedFile,
  getReportDownloadTarget,
  getSupabase
};
