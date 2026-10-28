/**
 * MGR IEI Student Chapter Comprehensive Verification Test Suite
 * Directly executes Express app in-memory without requiring TCP network binding.
 */

const app = require('../server');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

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

function makeRequest(method, url, options = {}) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    
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
      cookie() {},
      clearCookie() {}
    };

    app.handle(req, res);
  });
}

async function run() {
  console.log('========================================================');
  console.log(' Starting MGR IEI Student Chapter Verification Test Suite');
  console.log('========================================================\n');

  // Suite 1: Branding Assets on Disk
  console.log('[Suite 1: Official Institutional Logo Files]');
  const p1 = path.join(__dirname, '..', 'public', 'assets', 'iei-official-logo.png');
  const p2 = path.join(__dirname, '..', 'public', 'assets', 'mgr-iei-official-logo.png');
  assert(fs.existsSync(p1), 'Official IEI Logo exists in public/assets');
  assert(fs.statSync(p1).size > 100000, 'IEI Logo file integrity verified (size > 100KB)');
  assert(fs.existsSync(p2), 'Official Dr. MGR Educational & Research Institute Logo exists in public/assets');
  assert(fs.statSync(p2).size > 100000, 'MGR Logo file integrity verified (size > 100KB)');

  // Suite 2: Multi-Role Authentication
  console.log('\n[Suite 2: Multi-Role Authentication & Access]');
  const chairLogin = await makeRequest('POST', '/api/auth/login', {
    json: { email: 'chairman@mgriei.org', password: 'Chairman_2026!' }
  });
  assert(chairLogin.status === 200, 'Leadership login HTTP 200');
  assert(chairLogin.body.user.role === 'chairman', 'Role is verified');
  const chairToken = chairLogin.body.token;

  const commLogin = await makeRequest('POST', '/api/auth/login', {
    json: { email: 'committee@mgriei.org', password: 'Committee_2026!' }
  });
  assert(commLogin.status === 200, 'Committee Lead login HTTP 200');
  assert(commLogin.body.user.role === 'committee', 'Role is committee');
  const commToken = commLogin.body.token;

  const mgrAdminLogin = await makeRequest('POST', '/api/auth/login', {
    json: { email: 'admin@mgriei.org', password: 'MGR_Admin_2026!' }
  });
  assert(mgrAdminLogin.status === 200, 'MGR Chapter Admin login HTTP 200');
  assert(mgrAdminLogin.body.user.role === 'admin', 'Role is admin');

  // Suite 3: Task Management
  console.log('\n[Suite 3: Task Management]');
  const getTasks = await makeRequest('GET', '/api/tasks', { token: commToken });
  assert(getTasks.status === 200, 'GET /api/tasks returned HTTP 200');
  assert(Array.isArray(getTasks.body.tasks) && getTasks.body.tasks.length > 0, 'Active tasks returned');

  const newTask = await makeRequest('POST', '/api/tasks', {
    token: commToken,
    json: {
      title: 'Lab Kit Verification for Industry 4.0 Symposium',
      description: 'Microcontroller boards and sensors received',
      priority: 'high',
      department: 'Mechanical Engineering',
      dueDate: '2026-11-20',
      assignedToName: 'Committee Lead'
    }
  });
  assert(newTask.status === 201, 'POST /api/tasks created new task');
  const taskId = newTask.body.task.id;

  const moveTask = await makeRequest('PUT', `/api/tasks/${taskId}`, {
    token: commToken,
    json: { status: 'review', progress: 85 }
  });
  assert(moveTask.status === 200, 'PUT /api/tasks/:id updated task');
  assert(moveTask.body.task.status === 'review', 'Task status changed to review');

  // Suite 4: Weekly Reporting & Chairman Endorsement
  console.log('\n[Suite 4: Weekly Reporting & Endorsement]');
  const getReports = await makeRequest('GET', '/api/weekly-reports', { token: commToken });
  assert(getReports.status === 200, 'GET /api/weekly-reports returned HTTP 200');
  assert(Array.isArray(getReports.body.reports), 'Reports is array');

  const newReport = await makeRequest('POST', '/api/weekly-reports', {
    token: commToken,
    json: {
      weekNumber: 47,
      period: 'Nov 10 - Nov 16, 2026',
      department: 'CSE & Robotics',
      totalEvents: 2,
      studentHours: 180,
      attendeesCount: 155,
      summary: 'Advanced AI and Robotics Hands-on Lab',
      highlights: '100% attendance from 3rd year engineering students'
    }
  });
  assert(newReport.status === 201, 'POST /api/weekly-reports created weekly report');
  const reportId = newReport.body.report.id;
  assert(newReport.body.report.status === 'Under Review', 'Status is Under Review');

  const endorse = await makeRequest('POST', `/api/portal/weekly-reports/${reportId}/endorse`, {
    token: chairToken
  });
  assert(endorse.status === 200, 'Staff endorsed report');
  assert(endorse.body.report.status === 'Approved', 'Report status is Approved');
  assert(endorse.body.report.endorsedBy === 'Staff Coordinator', 'Endorsed by Staff Coordinator');

  // Suite 5: Shared Community
  console.log('\n[Suite 5: Shared Community]');
  const getCommunity = await makeRequest('GET', '/api/community', { token: commToken });
  assert(getCommunity.status === 200, 'GET /api/community returned HTTP 200');
  assert(Array.isArray(getCommunity.body.posts), 'Community posts returned');

  const newPost = await makeRequest('POST', '/api/community', {
    token: chairToken,
    json: {
      title: 'Official Executive Circular: National Symposium 2026',
      content: 'Abstract submissions deadline extended to November 15, 2026.',
      category: 'General IEI Circulars',
      isPinned: true
    }
  });
  assert(newPost.status === 201, 'POST /api/community created post');
  const postId = newPost.body.post.id;

  const likePost = await makeRequest('POST', `/api/community/${postId}/like`, { token: commToken });
  assert(likePost.status === 200, 'POST /api/community/:id/like upvoted post');

  // Suite 6: Private Messaging
  console.log('\n[Suite 6: Private Messaging]');
  const getMsgs = await makeRequest('GET', '/api/messages', { token: chairToken });
  assert(getMsgs.status === 200, 'GET /api/messages returned HTTP 200');

  const sendMsg = await makeRequest('POST', '/api/messages', {
    token: commToken,
    json: {
      recipientId: 'usr_chair_01',
      content: 'Staff Coordinator, Week 47 report has been reviewed and endorsed.'
    }
  });
  assert(sendMsg.status === 201, 'POST /api/messages sent direct communication');

  // Suite 7: Notifications
  console.log('\n[Suite 7: System Notifications]');
  const getNotifs = await makeRequest('GET', '/api/notifications', { token: chairToken });
  assert(getNotifs.status === 200, 'GET /api/notifications returned HTTP 200');

  const markAll = await makeRequest('POST', '/api/notifications/mark-read', { token: chairToken });
  assert(markAll.status === 200, 'POST /api/notifications/mark-read executed');

  // Suite 8: Profile Credentials
  console.log('\n[Suite 8: User Profile & Security]');
  const updateProf = await makeRequest('PUT', '/api/auth/profile', {
    token: commToken,
    json: {
      name: 'Student Committee Lead',
      designation: 'Senior Faculty Advisor & Committee Lead',
      department: 'Mechanical Engineering, Dr. M.G.R. E&RI'
    }
  });
  assert(updateProf.status === 200, 'PUT /api/auth/profile updated profile');
  assert(updateProf.body.user.designation === 'Senior Faculty Advisor & Committee Lead', 'Designation verified');

  console.log('\n========================================================');
  console.log(` MGR IEI Suite Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================');

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test Suite Exception:', err);
  process.exit(1);
});
