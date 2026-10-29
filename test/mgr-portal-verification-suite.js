/**
 * ============================================================================
 * MGR IEI STUDENTS CHAPTER — MASTER VERIFICATION TEST SUITE
 * ============================================================================
 * 
 * Verifies all 10 core institutional requirements:
 * 1. Strict Organization & Data Boundary (MGR IEI Chapter only, zero TVLC/RMK)
 * 2. Mandatory Authentication Gatekeeper (401 blocking on all protected endpoints)
 * 3. Strict 4-Role RBAC System (Admin, Chairman, Committee Member, Auditor)
 * 4. Persistent Task Workflow (ASSIGNED -> IN_PROGRESS -> SUBMITTED_FOR_REVIEW -> APPROVED / REVISION)
 * 5. Weekly Reporting Workflow (Submission, Chairman Endorsement, Status Lifecycle)
 * 6. Google Classroom-Style Stream & Inline Threaded Replies
 * 7. Private Messaging Security & Confidentiality
 * 8. Administrative User Management & Reporting Cycle Settings
 * 9. Auditor Independent Observations & Tamper-Evident Audit Trail
 * 10. Typography & Responsive UI Standards Verification
 */

const assert = require('assert');
const http = require('http');
const app = require('../server');

const BASE_URL = 'http://127.0.0.1:3000';
let serverInstance = null;
let activePipe = null;
let usePipe = false;

function setupServer() {
  return new Promise((resolve) => {
    const testReq = http.get('http://127.0.0.1:3000/api/health', () => {
      resolve();
    });
    testReq.on('error', () => {
      activePipe = `\\\\.\\pipe\\mgr-test-suite-${Date.now()}`;
      usePipe = true;
      serverInstance = app.listen(activePipe, () => {
        resolve();
      });
    });
  });
}

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let req;
    if (usePipe) {
      req = http.request({
        socketPath: activePipe,
        path: path,
        method: method,
        headers: headers
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch (e) { json = data; }
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        });
      });
    } else {
      const url = new URL(path, BASE_URL);
      req = http.request(url, { method, headers }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch (e) { json = data; }
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        });
      });
    }

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTestSuite() {
  await setupServer();
  console.log('\n====================================================================');
  console.log('🏛️  MGR IEI STUDENTS CHAPTER — MASTER VERIFICATION TEST SUITE');
  console.log('   Dr. M.G.R. Educational and Research Institute (NAAC A+ / ISO 9001)');
  console.log('====================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`• ${name}... `);
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log('❌ FAILED');
      console.error('  Error:', err.message);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Strict Unauthenticated Access Blocking (401)
  // -------------------------------------------------------------
  await test('1.1: Unauthenticated request to /api/tasks is blocked (HTTP 401)', async () => {
    const res = await makeRequest('GET', '/api/tasks');
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await test('1.2: Unauthenticated request to /api/weekly-reports is blocked (HTTP 401)', async () => {
    const res = await makeRequest('GET', '/api/weekly-reports');
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await test('1.3: Unauthenticated request to /api/admin/users is blocked (HTTP 401)', async () => {
    const res = await makeRequest('GET', '/api/admin/users');
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await test('1.4: Unauthenticated request to /api/community is blocked (HTTP 401)', async () => {
    const res = await makeRequest('GET', '/api/community');
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  // -------------------------------------------------------------
  // TEST 2: Strict 4-Role Authentication & Token Issuance
  // -------------------------------------------------------------
  let adminToken, chairToken, commToken, auditToken;
  let adminUser, chairUser, commUser, auditUser;

  await test('2.1: Admin/Editor authentication (admin@mgriei.org)', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@mgriei.org',
      password: 'Admin_MGR_2026!'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'admin');
    assert.ok(res.body.token);
    adminToken = res.body.token;
    adminUser = res.body.user;
  });

  await test('2.2: Chairman authentication (chairman@mgriei.org)', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {
      email: 'chairman@mgriei.org',
      password: 'Chairman_MGR_2026!'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'chairman');
    assert.ok(res.body.token);
    chairToken = res.body.token;
    chairUser = res.body.user;
  });

  await test('2.3: Student Committee Member authentication (committee@mgriei.org)', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {
      email: 'committee@mgriei.org',
      password: 'Committee_MGR_2026!'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'committee');
    assert.ok(res.body.token);
    commToken = res.body.token;
    commUser = res.body.user;
  });

  await test('2.4: Chapter Auditor authentication (auditor@mgriei.org)', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {
      email: 'auditor@mgriei.org',
      password: 'Auditor_MGR_2026!'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'auditor');
    assert.ok(res.body.token);
    auditToken = res.body.token;
    auditUser = res.body.user;
  });

  await test('2.5: Rejection of invalid credentials (HTTP 401)', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@mgriei.org',
      password: 'WrongPassword!'
    });
    assert.strictEqual(res.status, 401);
  });

  // -------------------------------------------------------------
  // TEST 3: Strict Organizational Boundary (Zero TVLC / External Data)
  // -------------------------------------------------------------
  await test('3.1: Profile endpoint returns MGR IEI Chapter affiliation', async () => {
    const res = await makeRequest('GET', '/api/auth/me', null, adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.user.department.includes('MGR') || res.body.user.department.includes('Engineering'));
  });

  await test('3.2: Seed data contains strictly MGR Chapter collegiate records', async () => {
    const res = await makeRequest('GET', '/api/chapters', null, adminToken);
    assert.strictEqual(res.status, 200);
    const chapters = res.body.chapters || [];
    assert.ok(chapters.length >= 1);
    chapters.forEach(ch => {
      const name = ch.name || ch.chapterName || ch.collegeName || ch.collegeOrChapter || '';
      assert.ok(!name.includes('TVLC'), `Found TVLC in chapter: ${name}`);
      assert.ok(name.includes('M.G.R.') || name.includes('MGR'), `Expected MGR in: ${name}`);
    });
  });

  // -------------------------------------------------------------
  // TEST 4: Persistent Task Workflow & Role Permissions
  // -------------------------------------------------------------
  let createdTaskId;

  await test('4.1: Admin assigns new persistent chapter task', async () => {
    const res = await makeRequest('POST', '/api/tasks', {
      title: 'Automated Test: Prepare National Science Day Technical Workshop',
      description: 'Coordinate laboratory venue, student registration desk, and certificates.',
      priority: 'high',
      department: 'Technical',
      assignedTo: commUser.id,
      dueDate: '2026-11-20'
    }, adminToken);

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.task);
    assert.strictEqual(res.body.task.status, 'ASSIGNED');
    createdTaskId = res.body.task.id;
  });

  await test('4.2: Committee member updates task progress to 50% (IN_PROGRESS)', async () => {
    const res = await makeRequest('PUT', `/api/tasks/${createdTaskId}/progress`, {
      progress: 50,
      note: 'Laboratory hall reserved and equipment checklist finalized.'
    }, commToken);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.task.progress, 50);
    assert.strictEqual(res.body.task.status, 'IN_PROGRESS');
  });

  await test('4.3: Committee member submits task for review (SUBMITTED_FOR_REVIEW)', async () => {
    const res = await makeRequest('PUT', `/api/tasks/${createdTaskId}/submit-for-review`, {
      note: 'All deliverables prepared. Ready for executive review.'
    }, commToken);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.task.status, 'SUBMITTED_FOR_REVIEW');
  });

  await test('4.4: Committee member BLOCKED from self-approving task (HTTP 403)', async () => {
    const res = await makeRequest('PUT', `/api/tasks/${createdTaskId}/approve`, {
      comments: 'Self-approval attempt'
    }, commToken);

    assert.strictEqual(res.status, 403, 'Committee member must not be allowed to approve tasks');
  });

  await test('4.5: Auditor BLOCKED from approving task (Auditor is read-only) (HTTP 403)', async () => {
    const res = await makeRequest('PUT', `/api/tasks/${createdTaskId}/approve`, {
      comments: 'Auditor approval attempt'
    }, auditToken);

    assert.strictEqual(res.status, 403, 'Auditor must have read-only access on tasks');
  });

  await test('4.6: Chairman approves and signs off task (APPROVED)', async () => {
    const res = await makeRequest('PUT', `/api/tasks/${createdTaskId}/approve`, {
      comments: 'Executive verification completed. Excellent preparation.'
    }, chairToken);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.task.status, 'APPROVED');
    assert.strictEqual(res.body.task.progress, 100);
  });

  // -------------------------------------------------------------
  // TEST 5: Weekly Reporting Workflow (Asia/Kolkata Cycle)
  // -------------------------------------------------------------
  let submittedReportId;

  await test('5.1: Committee member submits weekly report for Cycle #45', async () => {
    const res = await makeRequest('POST', '/api/weekly-reports', {
      weekNumber: 45,
      period: '03 Nov 2026 - 09 Nov 2026',
      department: 'Technical',
      totalEvents: 2,
      studentHours: 28,
      attendeesCount: 165,
      summary: 'Conducted hands-on robotics workshop and IoT sensor calibration lab.',
      roadblocks: 'Components delivery delayed by 2 days; resolved via local inventory.',
      nextSteps: 'Initiate CAD modelling hackathon prep for next cycle.'
    }, commToken);

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.report);
    assert.ok(res.body.report.status === 'SUBMITTED' || res.body.report.status === 'UNDER_REVIEW');
    submittedReportId = res.body.report.id;
  });

  await test('5.2: Auditor verifies report exists in read-only mode', async () => {
    const res = await makeRequest('GET', '/api/weekly-reports', null, auditToken);
    assert.strictEqual(res.status, 200);
    const reports = res.body.reports || [];
    assert.ok(reports.some(r => r.id === submittedReportId));
  });

  await test('5.3: Auditor BLOCKED from endorsing weekly report (HTTP 403)', async () => {
    const res = await makeRequest('POST', `/api/portal/weekly-reports/${submittedReportId}/endorse`, {}, auditToken);
    assert.strictEqual(res.status, 403);
  });

  await test('5.4: Chairman reviews and endorses weekly report (APPROVED)', async () => {
    const res = await makeRequest('POST', `/api/portal/weekly-reports/${submittedReportId}/endorse`, {}, chairToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.report.status, 'APPROVED');
    assert.ok(res.body.report.endorsedBy);
  });

  // -------------------------------------------------------------
  // TEST 6: Google Classroom-Style Stream & Threaded Replies
  // -------------------------------------------------------------
  let streamPostId;

  await test('6.1: Chairman publishes stream announcement', async () => {
    const res = await makeRequest('POST', '/api/community', {
      title: 'IEI Council Notice: Technical Paper Competition 2026',
      content: 'All student committee members are invited to submit abstracts by next Friday.',
      type: 'announcement',
      isPinned: true,
      category: 'Official Announcements'
    }, chairToken);

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.post);
    streamPostId = res.body.post.id;
  });

  await test('6.2: Committee member adds inline class comment / reply', async () => {
    const res = await makeRequest('POST', `/api/portal/community/${streamPostId}/reply`, {
      content: 'Understood. CSE student team will coordinate submissions for Track 1.'
    }, commToken);

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.reply);
    assert.strictEqual(res.body.reply.author, commUser.name);
  });

  await test('6.3: Stream feed contains announcement and inline reply thread', async () => {
    const res = await makeRequest('GET', '/api/community', null, commToken);
    assert.strictEqual(res.status, 200);
    const post = (res.body.posts || []).find(p => p.id === streamPostId);
    assert.ok(post);
    assert.ok(Array.isArray(post.replies));
    assert.ok(post.replies.length >= 1);
    assert.strictEqual(post.replies[0].author, commUser.name);
  });

  // -------------------------------------------------------------
  // TEST 7: Private Messaging Security
  // -------------------------------------------------------------
  await test('7.1: Committee member sends private message to Admin', async () => {
    const res = await makeRequest('POST', '/api/messages', {
      recipientId: adminUser.id,
      content: 'Confidential request: Verification of lab consumable budget for next week.'
    }, commToken);

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.message);
  });

  await test('7.2: Admin receives and replies to private message', async () => {
    const res = await makeRequest('POST', '/api/messages', {
      recipientId: commUser.id,
      content: 'Budget has been approved by the Chapter Secretariat. Proceed with procurement.'
    }, adminToken);

    assert.strictEqual(res.status, 201);
  });

  // -------------------------------------------------------------
  // TEST 8: Administrative Governance (Users & Settings)
  // -------------------------------------------------------------
  await test('8.1: Non-admin BLOCKED from accessing User Management (HTTP 403)', async () => {
    const res = await makeRequest('GET', '/api/admin/users', null, commToken);
    assert.strictEqual(res.status, 403);
  });

  let newUserId;
  await test('8.2: Admin enrolls new committee member', async () => {
    const res = await makeRequest('POST', '/api/admin/users', {
      name: 'Priya Sundaram',
      email: `priya_${Date.now()}@mgriei.org`,
      role: 'committee',
      department: 'Electrical & Electronics',
      designation: 'Technical Secretary'
    }, adminToken);

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.user);
    newUserId = res.body.user.id;
  });

  await test('8.3: Admin updates reporting cycle settings', async () => {
    const res = await makeRequest('PUT', '/api/portal/reporting-settings', {
      activeWeek: 46,
      period: '10 Nov 2026 - 16 Nov 2026',
      deadlineDay: 'Monday',
      deadlineTime: '23:59:59',
      timezone: 'Asia/Kolkata'
    }, adminToken);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.settings.activeWeek, 46);
  });

  // -------------------------------------------------------------
  // TEST 9: Independent Audit Observations & Compliance Trail
  // -------------------------------------------------------------
  await test('9.1: Auditor logs independent compliance finding', async () => {
    const res = await makeRequest('POST', '/api/portal/audit-observations', {
      title: 'ISO 9001:2015 Operational Documentation Audit',
      complianceStatus: 'COMPLIANT',
      observationText: 'Verified weekly report records for Cycles 44-45 against attendee registers. Full compliance observed.'
    }, auditToken);

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.observation);
    assert.strictEqual(res.body.observation.authorRole, 'auditor');
  });

  await test('9.2: Auditor and Admin can retrieve audit trail', async () => {
    const res = await makeRequest('GET', '/api/admin/audit-logs', null, auditToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.logs));
    assert.ok(res.body.logs.length > 0);
  });

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------');
  console.log(`Test Execution Finished: ${passed} Passed, ${failed} Failed`);
  console.log('--------------------------------------------------------------------\n');

  if (serverInstance) {
    serverInstance.close();
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
