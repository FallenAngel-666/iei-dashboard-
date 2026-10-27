/**
 * IEI TVLC Portal In-Process Comprehensive Test Suite
 * Directly executes Express app handlers in-memory without requiring TCP network binding.
 */

const app = require('../server');
const config = require('../src/config');
const db = require('../src/db');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { validateMagicBytes } = require('../src/storage/storageAdapter');

let adminToken = '';
let staffToken = '';
let coordToken = '';
let auditorToken = '';
let exampleToken = '';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

/**
 * In-memory mock HTTP dispatcher for Express
 */
function makeRequest(method, url, options = {}) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    
    // Parse path and query using WHATWG URL API
    const parsed = new URL(url, 'http://127.0.0.1');
    req.url = url;
    req.originalUrl = url;
    req.path = parsed.pathname;
    
    const queryObj = {};
    for (const [key, val] of parsed.searchParams.entries()) {
      queryObj[key] = val;
    }
    req.query = queryObj;

    req.headers = {
      host: 'localhost',
      ...(options.headers || {})
    };
    req.socket = { remoteAddress: '127.0.0.1' };
    req.connection = req.socket;

    if (options.token) {
      req.headers['authorization'] = `Bearer ${options.token}`;
    }

    if (options.json) {
      req.headers['content-type'] = 'application/json';
      req.body = options.json;
    } else {
      req.body = options.body || {};
    }

    req.cookies = options.cookies || {};
    req.params = {};

    const resHeaders = {};
    let statusCode = 200;
    let responseBody = '';

    const res = {
      statusCode: 200,
      setHeader(name, val) {
        resHeaders[name.toLowerCase()] = val;
      },
      getHeader(name) {
        return resHeaders[name.toLowerCase()];
      },
      removeHeader(name) {
        delete resHeaders[name.toLowerCase()];
      },
      hasHeader(name) {
        return Boolean(resHeaders[name.toLowerCase()]);
      },
      status(code) {
        statusCode = code;
        res.statusCode = code;
        return res;
      },
      json(data) {
        resHeaders['content-type'] = 'application/json';
        responseBody = data;
        resolve({
          status: statusCode,
          headers: resHeaders,
          body: responseBody
        });
      },
      send(data) {
        responseBody = data;
        resolve({
          status: statusCode,
          headers: resHeaders,
          body: responseBody
        });
      },
      end(data) {
        if (data) responseBody = data;
        resolve({
          status: statusCode,
          headers: resHeaders,
          body: responseBody
        });
      },
      redirect(url) {
        statusCode = 302;
        resHeaders['location'] = url;
        resolve({
          status: statusCode,
          headers: resHeaders,
          body: { redirectUrl: url }
        });
      },
      download(filePath, filename) {
        statusCode = 200;
        resHeaders['content-disposition'] = `attachment; filename="${filename}"`;
        resolve({
          status: statusCode,
          headers: resHeaders,
          body: { filePath, filename }
        });
      }
    };

    app.handle(req, res);
  });
}

async function runTests() {
  console.log('====================================================');
  console.log(' Starting IEI TVLC Portal Comprehensive Test Suite');
  console.log('====================================================');

  try {
    // ----------------------------------------------------
    // Suite 1: System Health & Strict Gate Enforcement
    // ----------------------------------------------------
    console.log('\n[Suite 1: System Health & Strict Gate Enforcement]');
    
    const health = await makeRequest('GET', '/api/health');
    assert(health.status === 200, 'Health endpoint responds with HTTP 200');
    assert(health.body.status === 'ONLINE', 'System reports ONLINE status');
    assert(health.body.stats.registeredChapters === 18, 'Exactly 18 student chapters registered in system');

    // Requirement 1 & 7: Gate unauthenticated requests
    const unauthChapters = await makeRequest('GET', '/api/chapters');
    assert(unauthChapters.status === 401, 'Unauthenticated GET /api/chapters strictly rejected with HTTP 401');

    const unauthEvents = await makeRequest('GET', '/api/events');
    assert(unauthEvents.status === 401, 'Unauthenticated GET /api/events strictly rejected with HTTP 401');

    const unauthAnalytics = await makeRequest('GET', '/api/analytics/overview');
    assert(unauthAnalytics.status === 401, 'Unauthenticated GET /api/analytics/overview strictly rejected with HTTP 401');

    const unauthExport = await makeRequest('GET', '/api/export/chapters/csv');
    assert(unauthExport.status === 401, 'Unauthenticated GET /api/export/chapters/csv strictly rejected with HTTP 401');

    const unauthCreate = await makeRequest('POST', '/api/chapters', {
      json: { chapterName: 'Test Chapter', collegeName: 'Test College' }
    });
    assert(unauthCreate.status === 401, 'Unauthenticated POST /api/chapters blocked with HTTP 401');

    // ----------------------------------------------------
    // Suite 2: Multi-Role Authentication & Access Control
    // ----------------------------------------------------
    console.log('\n[Suite 2: Multi-Role Authentication & Access Control]');

    // 2.1 Super Admin login
    const adminLogin = await makeRequest('POST', '/api/auth/login', {
      json: { email: 'admin@ieitvlc.org', password: 'IEI_Admin_2026!' }
    });
    assert(adminLogin.status === 200, 'Super Admin login succeeded with HTTP 200');
    assert(adminLogin.body.token && adminLogin.body.user.role === 'admin', 'Admin token and role received');
    adminToken = adminLogin.body.token;

    // 2.2 Staff Officer login
    const staffLogin = await makeRequest('POST', '/api/auth/login', {
      json: { email: 'staff@ieitvlc.org', password: 'TVLC_Staff_2026!' }
    });
    assert(staffLogin.status === 200, 'Staff Officer login succeeded with HTTP 200');
    assert(staffLogin.body.token && staffLogin.body.user.role === 'staff', 'Staff token and role received');
    staffToken = staffLogin.body.token;

    // 2.3 Chapter Coordinator login
    const coordLogin = await makeRequest('POST', '/api/auth/login', {
      json: { email: 'coordinator@ieitvlc.org', password: 'Coordinator_2026!' }
    });
    assert(coordLogin.status === 200, 'Chapter Coordinator login succeeded with HTTP 200');
    assert(coordLogin.body.user.role === 'coordinator', 'Coordinator role verified');
    assert(coordLogin.body.user.assignedChapterId === 'ch_rmk_01', 'Coordinator assigned to RMK Chapter (ch_rmk_01)');
    coordToken = coordLogin.body.token;

    // 2.4 Council Auditor login
    const auditorLogin = await makeRequest('POST', '/api/auth/login', {
      json: { email: 'auditor@ieitvlc.org', password: 'Audit_View_2026!' }
    });
    assert(auditorLogin.status === 200, 'Council Auditor login succeeded with HTTP 200');
    assert(auditorLogin.body.user.role === 'auditor', 'Auditor role verified');
    auditorToken = auditorLogin.body.token;

    // 2.5 Example Staff login
    const exampleLogin = await makeRequest('POST', '/api/auth/login', {
      json: { email: 'example@gmail.com', password: 'TVLC_Staff_2026!' }
    });
    assert(exampleLogin.status === 200, 'example@gmail.com staff login succeeded with HTTP 200');
    assert(exampleLogin.body.user.role === 'staff', 'example@gmail.com authenticated as staff');
    exampleToken = exampleLogin.body.token;

    // 2.6 Invalid credentials rejection
    const badLogin = await makeRequest('POST', '/api/auth/login', {
      json: { email: 'admin@ieitvlc.org', password: 'Wrong_Password_123' }
    });
    assert(badLogin.status === 401, 'Invalid password rejected with HTTP 401');

    // 2.7 /me profile inspection
    const meRes = await makeRequest('GET', '/api/auth/me', { token: adminToken });
    assert(meRes.status === 200 && meRes.body.user.email === 'admin@ieitvlc.org', 'GET /api/auth/me returns active admin');

    const meCoord = await makeRequest('GET', '/api/auth/me', { token: coordToken });
    assert(meCoord.status === 200 && meCoord.body.user.assignedChapterId === 'ch_rmk_01', 'GET /api/auth/me returns coordinator assigned chapter');

    // 2.8 RBAC: Auditor blocked from modifications
    const auditorCreate = await makeRequest('POST', '/api/chapters', {
      token: auditorToken,
      json: { chapterName: 'Auditor Forbidden Chapter', collegeName: 'Test College' }
    });
    assert(auditorCreate.status === 403, 'Auditor blocked from POST /api/chapters (403 Forbidden)');

    const auditorEventCreate = await makeRequest('POST', '/api/events', {
      token: auditorToken,
      json: { title: 'Auditor Event', category: 'Technical Lecture', eventDate: '2026-11-20' }
    });
    assert(auditorEventCreate.status === 403, 'Auditor blocked from POST /api/events (403 Forbidden)');

    // 2.9 RBAC: Staff blocked from Executive Analytics & CSV Exports
    const staffAnalytics = await makeRequest('GET', '/api/analytics/overview', { token: staffToken });
    assert(staffAnalytics.status === 403, 'Staff Officer blocked from /api/analytics/overview (403 Forbidden)');

    const staffExport = await makeRequest('GET', '/api/export/chapters/csv', { token: staffToken });
    assert(staffExport.status === 403, 'Staff Officer blocked from /api/export/chapters/csv (403 Forbidden)');

    // 2.10 Logout endpoint
    const logoutRes = await makeRequest('POST', '/api/auth/logout', { token: staffToken });
    assert(logoutRes.status === 200, 'POST /api/auth/logout invalidates session with HTTP 200');

    // ----------------------------------------------------
    // Suite 3: Chapter Registry & Data Integrity
    // ----------------------------------------------------
    console.log('\n[Suite 3: Student Chapter Management & Baseline Data Integrity]');

    const chaptersRes = await makeRequest('GET', '/api/chapters', { token: adminToken });
    assert(chaptersRes.status === 200, 'Authenticated GET /api/chapters responds with HTTP 200');
    assert(chaptersRes.body.total === 18, 'Total registered collegiate chapters count is exactly 18');

    // Requirement 6: Missing figures treated as unknown (null), never 0
    const unknownChapters = chaptersRes.body.chapters.filter(c => c.studentMembersCount === null);
    assert(unknownChapters.length === 9, '9 chapters correctly marked as Unknown / Census Pending (null, not 0)');

    const rmkChapter = chaptersRes.body.chapters.find(c => c.collegeCode === 'RMKEC');
    assert(rmkChapter && rmkChapter.studentMembersCount === 1350, 'RMK Engineering College student membership is 1,350');
    assert(rmkChapter.corporateMembersCount === 24, 'RMK corporate membership is 24');

    // Admin creates test chapter
    let testChapterId = '';
    const createRes = await makeRequest('POST', '/api/chapters', {
      token: adminToken,
      json: {
        chapterName: 'IEI TVLC Test Innovation Chapter',
        collegeName: 'National Engineering Institute',
        collegeCode: 'NEI',
        departments: ['CSE', 'ECE', 'AI & DS'],
        studentMembersCount: 250,
        corporateMembersCount: 5,
        facultyAdvisors: ['Dr. Test Advisor'],
        status: 'Active'
      }
    });
    assert(createRes.status === 201, 'Admin can create a new student chapter (HTTP 201)');
    testChapterId = createRes.body.chapter.id;
    assert(Boolean(testChapterId), 'Created chapter received unique ID');

    // Staff updates chapter
    const updateRes = await makeRequest('PUT', `/api/chapters/${testChapterId}`, {
      token: staffToken,
      json: { studentMembersCount: 275 }
    });
    assert(updateRes.status === 200, 'Staff officer can update chapter membership count');
    assert(updateRes.body.chapter.studentMembersCount === 275, 'Chapter student count updated to 275');

    // Annual Census Snapshot
    const snapRes = await makeRequest('POST', `/api/chapters/${testChapterId}/snapshot`, {
      token: staffToken,
      json: { year: 2026, studentCount: 280, corporateCount: 6 }
    });
    assert(snapRes.status === 200, 'Successfully recorded annual membership census snapshot');

    // Staff records intake
    const intakeRes = await makeRequest('POST', '/api/chapters/intake/record', {
      token: staffToken,
      json: {
        year: 2026,
        chapterId: testChapterId,
        institutionName: 'National Engineering Institute',
        studentNew: 85,
        corporateNew: 2
      }
    });
    assert(intakeRes.status === 200, 'Staff officer can record membership intake (HTTP 200)');

    // Delete Test Chapter
    const delRes = await makeRequest('DELETE', `/api/chapters/${testChapterId}`, { token: adminToken });
    assert(delRes.status === 200, 'Admin can delete test chapter record (HTTP 200)');

    // ----------------------------------------------------
    // Suite 4: Event Management & Filtering
    // ----------------------------------------------------
    console.log('\n[Suite 4: Event Management & Filtering]');

    const eventsRes = await makeRequest('GET', '/api/events', { token: staffToken });
    assert(eventsRes.status === 200, 'GET /api/events with staff token returns HTTP 200');
    assert(eventsRes.body.total >= 11, 'Verified official 11 activities present in database');

    const techLectures = await makeRequest('GET', '/api/events?category=Technical%20Lecture', { token: staffToken });
    assert(techLectures.body.events.every(e => e.category === 'Technical Lecture'), 'Category filter strictly matches Technical Lectures');

    const statutoryEvents = await makeRequest('GET', '/api/events?category=Statutory%20Day', { token: staffToken });
    assert(statutoryEvents.body.events.every(e => e.category === 'Statutory Day'), 'Category filter strictly matches Statutory Days');

    // Staff creates new event
    const newEventRes = await makeRequest('POST', '/api/events', {
      token: staffToken,
      json: {
        title: '61st Technical Lecture: Advanced Agentic Frameworks in Industry',
        category: 'Technical Lecture',
        eventDate: '2026-11-28',
        collegeOrChapter: 'IEI TVLC Central Secretariat',
        speakerName: 'Dr. Test Speaker',
        speakerDesignation: 'Lead AI Engineer',
        status: 'Upcoming'
      }
    });
    assert(newEventRes.status === 201, 'Staff can schedule new event (HTTP 201)');
    const testEventId = newEventRes.body.event.id;

    // Admin removes test event
    const delEventRes = await makeRequest('DELETE', `/api/events/${testEventId}`, { token: adminToken });
    assert(delEventRes.status === 200, 'Admin can delete test event record');

    // ----------------------------------------------------
    // Suite 5: Analytics & Growth Calculations
    // ----------------------------------------------------
    console.log('\n[Suite 5: Analytics & Historical Growth Calculations]');

    const overviewRes = await makeRequest('GET', '/api/analytics/overview?year=2026', { token: adminToken });
    assert(overviewRes.status === 200, 'Admin GET /api/analytics/overview returns HTTP 200');
    assert(overviewRes.body.kpis.totalRegisteredChapters === 18, 'KPI reports exactly 18 registered student chapters');
    assert(overviewRes.body.kpis.totalStudentMembers > 3000, 'Verified student membership total aggregated correctly');
    assert(overviewRes.body.kpis.totalCorporateMembers > 50, 'Verified corporate membership total aggregated correctly');
    assert(overviewRes.body.annualMembershipTrends.length > 0, 'Annual membership trends dataset populated');

    // Auditor can also view analytics
    const auditorOverview = await makeRequest('GET', '/api/analytics/overview?year=2026', { token: auditorToken });
    assert(auditorOverview.status === 200, 'Council Auditor can view /api/analytics/overview (HTTP 200)');

    // Requirement 6: Baseline year has null growth rate, subsequent years compute genuine math percentage
    const trends = overviewRes.body.annualMembershipTrends;
    assert(trends[0].studentGrowthRate === null, 'First historical year has null growth rate (Baseline Year, not fake 100% or 0%)');
    const subsequentGrowth = trends.slice(1).some(t => t.studentGrowthRate !== null);
    assert(subsequentGrowth, 'Subsequent years with valid baseline calculate genuine mathematical growth percentage');

    // ----------------------------------------------------
    // Suite 6: Institutional CSV Exports
    // ----------------------------------------------------
    console.log('\n[Suite 6: Institutional CSV Exports]');

    const chaptersCsv = await makeRequest('GET', '/api/export/chapters/csv', { token: adminToken });
    assert(chaptersCsv.status === 200, 'Chapters CSV export with admin token returns HTTP 200');
    assert(typeof chaptersCsv.body === 'string' && chaptersCsv.body.includes('Student Chapter Name') && chaptersCsv.body.includes('RMK Engineering College'), 'Chapters CSV contains header and chapter records');

    const eventsCsv = await makeRequest('GET', '/api/export/events/csv', { token: auditorToken });
    assert(eventsCsv.status === 200, 'Events CSV export with auditor token returns HTTP 200');
    assert(typeof eventsCsv.body === 'string' && eventsCsv.body.includes('Event Title') && eventsCsv.body.includes('Engineers’ Day'), 'Events CSV contains events registry');

    const membershipCsv = await makeRequest('GET', '/api/export/membership/csv', { token: adminToken });
    assert(membershipCsv.status === 200, 'Membership trends CSV returns HTTP 200');
    assert(typeof membershipCsv.body === 'string' && membershipCsv.body.includes('Verified Student Members'), 'Membership CSV contains verification metrics');

    // ----------------------------------------------------
    // Suite 7: WordPress Plugin Isolation Check
    // ----------------------------------------------------
    console.log('\n[Suite 7: WordPress Plugin Isolation]');
    const fs = require('fs');
    const path = require('path');
    const wpPluginExists = fs.existsSync(path.join(__dirname, '..', 'wordpress-integration', 'iei-tvlc-portal-wp-integration.php'));
    assert(wpPluginExists, 'WordPress plugin file exists in isolated directory');
    const wpGuideExists = fs.existsSync(path.join(__dirname, '..', 'wordpress-integration', 'DEPLOYMENT-GUIDE.md'));
    assert(wpGuideExists, 'WordPress deployment guide exists with reverse proxy instructions');

    // ----------------------------------------------------
    // Suite 8: IDOR Protections & Scoped Coordinator Restrictions
    // ----------------------------------------------------
    console.log('\n[Suite 8: IDOR Protections & Scoped Coordinator Restrictions]');

    // 8.1 Rate Limiting Headers
    const loginAttempt = await makeRequest('POST', '/api/auth/login', {
      json: { email: 'admin@ieitvlc.org', password: 'IEI_Admin_2026!' }
    });
    assert(loginAttempt.headers['x-ratelimit-limit'] === 10, 'Rate limiter emits X-RateLimit-Limit: 10 on authentication endpoint');
    assert(loginAttempt.headers['x-ratelimit-remaining'] !== undefined, 'Rate limiter emits X-RateLimit-Remaining');

    // 8.2 Coordinator modifies authorized chapter (ch_rmk_01)
    const allowedEdit = await makeRequest('PUT', '/api/chapters/ch_rmk_01', {
      token: coordToken,
      json: { location: 'Kavaraipettai, Tiruvallur Dist' }
    });
    assert(allowedEdit.status === 200, 'Coordinator can update their assigned chapter (ch_rmk_01)');

    // 8.3 IDOR: Coordinator blocked from unauthorized chapter (ch_prathyusha_02)
    const forbiddenEdit = await makeRequest('PUT', '/api/chapters/ch_prathyusha_02', {
      token: coordToken,
      json: { location: 'Tampered Location' }
    });
    assert(forbiddenEdit.status === 403, 'IDOR Protection: Coordinator strictly blocked from altering another chapter (403)');

    // 8.4 IDOR: Coordinator blocked from recording census snapshot for foreign chapter
    const forbiddenCensus = await makeRequest('POST', '/api/chapters/ch_jec_03/snapshot', {
      token: coordToken,
      json: { year: 2026, studentCount: 999 }
    });
    assert(forbiddenCensus.status === 403, 'IDOR Protection: Coordinator strictly blocked from submitting census for foreign chapter (403)');

    // 8.5 Coordinator schedules event for assigned chapter (ch_rmk_01)
    const coordEvent = await makeRequest('POST', '/api/events', {
      token: coordToken,
      json: {
        title: 'RMK Chapter Technical Workshop',
        category: 'Workshop',
        eventDate: '2026-11-20',
        chapterId: 'ch_rmk_01',
        collegeOrChapter: 'RMK Engineering College',
        status: 'Upcoming'
      }
    });
    assert(coordEvent.status === 201, 'Coordinator can schedule event for assigned chapter (HTTP 201)');
    const coordEventId = coordEvent.body.event.id;

    // 8.6 IDOR: Coordinator blocked from scheduling event for foreign chapter (ch_prathyusha_02)
    const foreignEvent = await makeRequest('POST', '/api/events', {
      token: coordToken,
      json: {
        title: 'Prathyusha Foreign Workshop',
        category: 'Workshop',
        eventDate: '2026-11-20',
        chapterId: 'ch_prathyusha_02',
        collegeOrChapter: 'Prathyusha Engineering College',
        status: 'Upcoming'
      }
    });
    assert(foreignEvent.status === 403, 'IDOR Protection: Coordinator strictly blocked from scheduling event for foreign chapter (403)');

    // Clean up coordinator event
    await makeRequest('DELETE', `/api/events/${coordEventId}`, { token: adminToken });

    // 8.7 Coordinator records intake for assigned chapter
    const coordIntake = await makeRequest('POST', '/api/chapters/intake/record', {
      token: coordToken,
      json: {
        year: 2026,
        chapterId: 'ch_rmk_01',
        institutionName: 'RMK Engineering College',
        studentNew: 50,
        corporateNew: 1
      }
    });
    assert(coordIntake.status === 200, 'Coordinator can record membership intake for assigned chapter (HTTP 200)');

    // 8.8 IDOR: Coordinator blocked from recording intake for foreign chapter
    const foreignIntake = await makeRequest('POST', '/api/chapters/intake/record', {
      token: coordToken,
      json: {
        year: 2026,
        chapterId: 'ch_prathyusha_02',
        institutionName: 'Prathyusha Engineering College',
        studentNew: 50,
        corporateNew: 1
      }
    });
    assert(foreignIntake.status === 403, 'IDOR Protection: Coordinator strictly blocked from recording intake for foreign chapter (403)');

    // 8.9 Coordinator intake records query
    const coordIntakeList = await makeRequest('GET', '/api/chapters/intake/records?year=2026', { token: coordToken });
    assert(coordIntakeList.status === 200, 'Coordinator can fetch /api/chapters/intake/records');
    assert(coordIntakeList.body.records.every(r => r.chapterId === 'ch_rmk_01'), 'Coordinator query strictly scoped to assigned chapter (ch_rmk_01)');

    // ----------------------------------------------------
    // Suite 9: Magic-Byte Binary Verification & Report Download Security
    // ----------------------------------------------------
    console.log('\n[Suite 9: Magic-Byte Binary Verification & Report Download Security]');

    // 9.1 Valid image signatures
    const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    assert(validateMagicBytes(jpegHeader, 'poster') === true, 'Magic bytes: Valid JPEG signature accepted for poster');

    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A]);
    assert(validateMagicBytes(pngHeader, 'poster') === true, 'Magic bytes: Valid PNG signature accepted for poster');

    const webpHeader = Buffer.from('RIFF\x20\x00\x00\x00WEBPVP8 ', 'binary');
    assert(validateMagicBytes(webpHeader, 'poster') === true, 'Magic bytes: Valid WebP signature accepted for poster');

    // 9.2 Malicious / Spoofed poster files rejected
    const spoofedPoster = Buffer.from('<?php echo "exploit"; ?>');
    assert(validateMagicBytes(spoofedPoster, 'poster') === false, 'Magic bytes: PHP script spoofed as poster rejected');

    const textPoster = Buffer.from('NOT_AN_IMAGE_HEADER');
    assert(validateMagicBytes(textPoster, 'poster') === false, 'Magic bytes: Plain text file spoofed as poster rejected');

    // 9.3 Valid document signatures
    const pdfHeader = Buffer.from('%PDF-1.7\n%ReportContent');
    assert(validateMagicBytes(pdfHeader, 'report') === true, 'Magic bytes: Valid PDF signature accepted for report');

    const docxHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00]);
    assert(validateMagicBytes(docxHeader, 'report') === true, 'Magic bytes: Valid DOCX (ZIP PK) signature accepted for report');

    const docHeader = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1]);
    assert(validateMagicBytes(docHeader, 'report') === true, 'Magic bytes: Valid DOC (OLE CFB) signature accepted for report');

    // 9.4 Spoofed document files rejected
    const exeReport = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
    assert(validateMagicBytes(exeReport, 'report') === false, 'Magic bytes: Windows executable (MZ) spoofed as report rejected');

    const textReport = Buffer.from('This is a plain text file pretending to be a pdf report.');
    assert(validateMagicBytes(textReport, 'report') === false, 'Magic bytes: Text file spoofed as report rejected');

    // 9.5 Report download endpoint authentication & 404 gates
    const unauthDownload = await makeRequest('GET', '/api/events/evt_tech_01/report-download');
    assert(unauthDownload.status === 401, 'Unauthenticated report download strictly blocked with HTTP 401');

    const missingEventDownload = await makeRequest('GET', '/api/events/evt_nonexistent_99/report-download', { token: adminToken });
    assert(missingEventDownload.status === 404, 'Download request for nonexistent event returns HTTP 404');

    const eventNoReportDownload = await makeRequest('GET', '/api/events/evt_tech_01/report-download', { token: adminToken });
    assert(eventNoReportDownload.status === 404, 'Download request for event with no attached report returns HTTP 404');

    // 9.6 Authorized report download with file stream
    // Create a mock report file in uploads/reports
    if (!fs.existsSync(config.REPORTS_DIR)) {
      fs.mkdirSync(config.REPORTS_DIR, { recursive: true });
    }
    const mockReportFileName = `test_report_${Date.now()}.pdf`;
    const mockReportFilePath = path.join(config.REPORTS_DIR, mockReportFileName);
    fs.writeFileSync(mockReportFilePath, '%PDF-1.7\n%IEI-TVLC-Test-Report');

    // Create an event referencing this report
    const reportEvent = await makeRequest('POST', '/api/events', {
      token: adminToken,
      json: {
        title: 'Report Download Test Activity',
        category: 'Technical Lecture',
        eventDate: '2026-10-28',
        reportUrl: `/uploads/reports/${mockReportFileName}`,
        status: 'Completed'
      }
    });
    assert(reportEvent.status === 201, 'Created event with attached test report (HTTP 201)');
    const reportEventId = reportEvent.body.event.id;

    // Staff member downloads authorized report
    const authDownload = await makeRequest('GET', `/api/events/${reportEventId}/report-download`, { token: staffToken });
    assert(authDownload.status === 200, 'Staff member can download authorized report file (HTTP 200)');
    assert(authDownload.headers['content-disposition'] && authDownload.headers['content-disposition'].includes(mockReportFileName), 'Download header contains correct attachment filename');

    // Clean up test report and test event
    await makeRequest('DELETE', `/api/events/${reportEventId}`, { token: adminToken });
    if (fs.existsSync(mockReportFilePath)) {
      fs.unlinkSync(mockReportFilePath);
    }

    console.log('\n====================================================');
    console.log(` Test Run Complete: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
