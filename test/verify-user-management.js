/**
 * User Management Deep Verification Suite
 * Tests Phase 2 fixes: Listing, enrollment, duplicate handling, role modification,
 * status toggling, password reset, and access control.
 */

const http = require('http');
const app = require('../server');

const BASE_URL = 'http://localhost:3000';
let serverInstance = null;
let activePipe = null;
let usePipe = false;

function setupServer() {
  return new Promise((resolve) => {
    const testReq = http.get('http://127.0.0.1:3000/api/health', () => {
      resolve();
    });
    testReq.on('error', () => {
      activePipe = `\\\\.\\pipe\\mgr-user-verify-${Date.now()}`;
      usePipe = true;
      serverInstance = app.listen(activePipe, () => {
        resolve();
      });
    });
  });
}

function request(method, path, data = null, token = null) {
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
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      });
    } else {
      const url = new URL(path, BASE_URL);
      req = http.request(url, { method, headers }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      });
    }

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  await setupServer();
  console.log('====================================================');
  console.log('🧪 MGR IEI USER MANAGEMENT DEEP AUDIT & TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? '(' + detail + ')' : ''}`);
      failed++;
    }
  }

  // 1. Authenticate as Admin
  const adminLogin = await request('POST', '/api/auth/login', {
    email: 'admin@mgriei.org',
    password: 'Admin_MGR_2026!'
  });
  assert(adminLogin.status === 200 && adminLogin.body.token, 'Admin authentication successful');
  const adminToken = adminLogin.body.token;

  // 2. Authenticate as Committee Member
  const commLogin = await request('POST', '/api/auth/login', {
    email: 'committee@mgriei.org',
    password: 'Committee_MGR_2026!'
  });
  assert(commLogin.status === 200 && commLogin.body.token, 'Committee Member authentication successful');
  const commToken = commLogin.body.token;

  // 3. Verify Non-Admin Access is Denied (HTTP 403)
  const forbiddenUsers = await request('GET', '/api/admin/users', null, commToken);
  assert(forbiddenUsers.status === 403, 'Non-admin user blocked from GET /api/admin/users (HTTP 403)');

  // 4. Admin can list all users
  const listUsers = await request('GET', '/api/admin/users', null, adminToken);
  assert(listUsers.status === 200 && Array.isArray(listUsers.body.users), 'Admin can list users', `Count: ${listUsers.body.users?.length}`);
  const initialCount = listUsers.body.users.length;

  // 5. Enroll New Member
  const testEmail = `coordinator_${Date.now()}@mgriei.org`;
  const enrollRes = await request('POST', '/api/admin/users', {
    name: 'Student Technical Coordinator',
    email: testEmail,
    role: 'committee',
    designation: 'Web & Systems Lead',
    department: 'Computer Science & Engineering',
    password: 'Custom_Member_Password_2026!'
  }, adminToken);
  assert(enrollRes.status === 201 && enrollRes.body.user?.email === testEmail, 'Admin can enroll new committee member', `ID: ${enrollRes.body.user?.id}`);
  const newUserId = enrollRes.body.user?.id;

  // 6. Test New Member Login with custom password
  const newMemberLogin = await request('POST', '/api/auth/login', {
    email: testEmail,
    password: 'Custom_Member_Password_2026!'
  });
  assert(newMemberLogin.status === 200 && newMemberLogin.body.token, 'Newly enrolled member can immediately authenticate with custom password');

  // 7. Duplicate Email Rejection
  const duplicateRes = await request('POST', '/api/admin/users', {
    name: 'Duplicate Coordinator',
    email: testEmail,
    role: 'committee',
    designation: 'Assistant Lead',
    department: 'ECE'
  }, adminToken);
  assert(duplicateRes.status === 400 && duplicateRes.body.error?.includes('already exists'), 'Duplicate email correctly rejected with 400 Bad Request');

  // 8. Missing Required Fields Rejection
  const missingFieldRes = await request('POST', '/api/admin/users', {
    role: 'committee'
  }, adminToken);
  assert(missingFieldRes.status === 400, 'Missing name and email rejected with 400 Bad Request');

  // 9. Update User Role
  const roleUpdateRes = await request('PUT', `/api/admin/users/${newUserId}/role`, {
    role: 'auditor'
  }, adminToken);
  assert(roleUpdateRes.status === 200 && roleUpdateRes.body.user?.role === 'auditor', 'Admin can update user role to auditor');

  // 10. Reject Invalid Role
  const invalidRoleRes = await request('PUT', `/api/admin/users/${newUserId}/role`, {
    role: 'super_coordinator' // Not one of the 4 strict roles
  }, adminToken);
  assert(invalidRoleRes.status === 400, 'Invalid role rejected with 400 Bad Request');

  // 11. Deactivate Account
  const deactRes = await request('PUT', `/api/admin/users/${newUserId}/status`, {
    isActive: false
  }, adminToken);
  assert(deactRes.status === 200 && deactRes.body.user?.isActive === false, 'Admin can deactivate user account');

  // 12. Deactivated Account Cannot Login
  const deactLogin = await request('POST', '/api/auth/login', {
    email: testEmail,
    password: 'Custom_Member_Password_2026!'
  });
  assert((deactLogin.status === 403 || deactLogin.status === 401) && deactLogin.body.error?.toLowerCase().includes('deactivated'), 'Deactivated member blocked from login (HTTP 403/401)');

  // 13. Reactivate Account
  const reactRes = await request('PUT', `/api/admin/users/${newUserId}/status`, {
    isActive: true
  }, adminToken);
  assert(reactRes.status === 200 && reactRes.body.user?.isActive === true, 'Admin can reactivate user account');

  // 14. Reset Password
  const resetRes = await request('POST', `/api/admin/users/${newUserId}/reset-password`, {
    newPassword: 'BrandNewResetPassword_2026!'
  }, adminToken);
  assert(resetRes.status === 200 && resetRes.body.success, 'Admin can securely reset user password');

  // 15. Login with New Reset Password
  const resetLogin = await request('POST', '/api/auth/login', {
    email: testEmail,
    password: 'BrandNewResetPassword_2026!'
  });
  assert(resetLogin.status === 200 && resetLogin.body.token, 'User can log in with newly reset password');

  // 16. Verify Audit Logs Recorded All Administrative Actions
  const auditLogs = await request('GET', '/api/admin/audit-logs', null, adminToken);
  const enrolledLog = auditLogs.body.logs?.some(l => l.action === 'USER_ENROLLED' && l.details?.includes(testEmail));
  const roleLog = auditLogs.body.logs?.some(l => l.action === 'USER_ROLE_CHANGED');
  const statusLog = auditLogs.body.logs?.some(l => l.action === 'USER_STATUS_TOGGLED');
  const pwResetLog = auditLogs.body.logs?.some(l => l.action === 'PASSWORD_RESET_INITIATED');
  assert(enrolledLog && roleLog && statusLog && pwResetLog, 'Audit log accurately captured USER_ENROLLED, USER_ROLE_CHANGED, USER_STATUS_TOGGLED, and PASSWORD_RESET_INITIATED');

  console.log('\n----------------------------------------------------');
  console.log(`Deep User Management Audit Finished: ${passed} Passed, ${failed} Failed`);
  console.log('----------------------------------------------------');

  if (serverInstance) {
    serverInstance.close();
  }

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
