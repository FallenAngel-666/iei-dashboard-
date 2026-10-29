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
      activePipe = `\\\\.\\pipe\\mgr-member-verify-${Date.now()}`;
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
    const options = {
      method,
      headers
    };

    if (usePipe) {
      options.socketPath = activePipe;
      options.path = path;
    } else {
      const url = new URL(path, BASE_URL);
      options.hostname = url.hostname;
      options.port = url.port;
      options.path = url.pathname + url.search;
    }

    req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  await setupServer();

  console.log('====================================================');
  console.log('🧪 VERIFYING ENROLLED 20 CHAPTER MEMBERS & RBAC');
  console.log('====================================================\n');

  // 1. Login with Primary Email for SRIPRIYAN S (Chairman role)
  console.log('1. Testing login for SRIPRIYAN S via primary email...');
  const res1 = await request('POST', '/api/auth/login', { email: 'sri.priyan.s.2607@gmail.com', password: 'MGR_IEI_2026!' });
  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.body.user.role, 'chairman');
  assert.strictEqual(res1.body.user.name, 'SRIPRIYAN S');
  const sripriyanToken = res1.body.token;
  console.log('   ✅ PASSED: Logged in successfully. Role: chairman, Token generated.');

  // 2. Testing login for SRIPRIYAN S via Phone Number
  console.log('2. Testing login for SRIPRIYAN S via phone number as identifier & password...');
  const res2 = await request('POST', '/api/auth/login', { email: '8778991626', password: '8778991626' });
  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.body.user.name, 'SRIPRIYAN S');
  console.log('   ✅ PASSED: Phone number accepted as both identifier and password.');

  // 3. Testing login for SRIPRIYAN S via Credential ID
  console.log('3. Testing login for SRIPRIYAN S via Credential ID...');
  const res3 = await request('POST', '/api/auth/login', { email: 'MGR.IEI.CHAIRMAN.04', password: 'MGR_IEI_2026!' });
  assert.strictEqual(res3.status, 200);
  assert.strictEqual(res3.body.user.name, 'SRIPRIYAN S');
  console.log('   ✅ PASSED: Credential ID accepted.');

  // 4. Testing login for MARIYA MERLINA I E (Secretary -> Committee role)
  console.log('4. Testing login for Secretary MARIYA MERLINA I E...');
  const res4 = await request('POST', '/api/auth/login', { email: 'mariyamerlina02@gmail.com', password: 'MGR_IEI_2026!' });
  assert.strictEqual(res4.status, 200);
  assert.strictEqual(res4.body.user.role, 'committee');
  const mariyaToken = res4.body.token;
  console.log('   ✅ PASSED: Secretary has committee member role as requested.');

  // 5. Testing login for SRIMAN NARAYANA MOORTHY S (Chairman Elect -> Chairman role)
  console.log('5. Testing login for Chairman Elect SRIMAN NARAYANA MOORTHY S...');
  const res5 = await request('POST', '/api/auth/login', { email: 'srimannarayanamoorthysridhar@gmail.com', password: 'MGR_IEI_2026!' });
  assert.strictEqual(res5.status, 200);
  assert.strictEqual(res5.body.user.role, 'chairman');
  console.log('   ✅ PASSED: Chairman Elect has chairman role.');

  // 6. Testing login via secondary altEmail (Aakanish Ananthika)
  console.log('6. Testing login via secondary altEmail (ananthikaedwin07@gmail.com)...');
  const res6 = await request('POST', '/api/auth/login', { email: 'ananthikaedwin07@gmail.com', password: 'MGR_IEI_2026!' });
  assert.strictEqual(res6.status, 200);
  assert.strictEqual(res6.body.user.name, 'AAKANISH ANANTHIKA E');
  assert.strictEqual(res6.body.user.role, 'committee');
  console.log('   ✅ PASSED: Logged in with secondary email.');

  // 7. Testing Chairman / Joint Secretary accessing User Management (/api/admin/users)
  console.log('7. Testing SRIPRIYAN S (Chairman/Joint Secretary) accessing User Management...');
  const res7 = await request('GET', '/api/admin/users', null, sripriyanToken);
  assert.strictEqual(res7.status, 200);
  assert.strictEqual(res7.body.success, true);
  assert.ok(res7.body.total >= 20, `Expected at least 20 enrolled members, got ${res7.body.total}`);
  console.log(`   ✅ PASSED: Chairman/Joint Secretary can list all ${res7.body.total} users.`);

  // 8. Testing Committee Member BLOCKED from User Management
  console.log('8. Testing Committee Member (Mariya) blocked from User Management...');
  const res8 = await request('GET', '/api/admin/users', null, mariyaToken);
  assert.strictEqual(res8.status, 403);
  console.log('   ✅ PASSED: Committee member correctly blocked with HTTP 403.');

  // 9. Unenrolled outsider blocked from login
  console.log('9. Testing non-enrolled user blocked from logging in...');
  const res9 = await request('POST', '/api/auth/login', { email: 'outsider@gmail.com', password: 'Password123!' });
  assert.strictEqual(res9.status, 401);
  console.log('   ✅ PASSED: Non-enrolled user blocked with HTTP 401.');

  console.log('\n----------------------------------------------------');
  console.log('🎉 ALL 9 MEMBER ENROLLMENT & RBAC TESTS PASSED!');
  console.log('----------------------------------------------------');

  if (serverInstance) serverInstance.close();
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
