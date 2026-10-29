# MGR IEI Students Chapter Portal — Full Functional Audit & Final Production Report

**Official Platform:** MGR IEI Students Chapter — Student Committee & Staff Portal  
**Institution:** Dr. M.G.R. Educational and Research Institute (Deemed to be University), Chennai — 600095  
**Affiliation:** The Institution of Engineers (India) — Established 1920, Royal Charter 1935  
**Target Live Production URL:** https://iei-dashboard.vercel.app/  
**Audit Timestamp:** 2026-10-29  
**Audit Status:** 100% Passed (71 / 71 Automated Integration Tests Passing across 3 Test Suites)  

---

## 1. Executive Summary & Root Cause Analysis

### A. Root Causes of Non-Working Buttons & Forms
1. **Missing Method Binding in Community Stream (`PortalModules.community.createPost`):**
   * *Root Cause:* The stream composer button in `public/index.html` was bound to `onclick="PortalModules.community.createPost()"`, but `createPost` was not defined on the `PortalModules.community` object. Clicking "Publish to Stream" threw an unhandled `TypeError` in browser consoles.
   * *Fix Applied:* Implemented `async createPost()` with input validation, duplicate submission prevention (`btnPublish.disabled = true`), loading status indicators, and feed refresh.
2. **Missing Method Binding in Task Management (`PortalModules.tasks.saveProgress` & `requestRevision`):**
   * *Root Cause:* The task detail modal invoked `PortalModules.tasks.saveProgress()` and `PortalModules.tasks.requestRevision()`, while the controller methods were named `saveTaskProgress()` and `requestCorrection()`.
   * *Fix Applied:* Added standard method aliases (`saveProgress` and `requestRevision`) and added loading indicators on submit buttons.
3. **Weekly Report Submission Modal Not Closing:**
   * *Root Cause:* Upon successful report submission (`POST /api/weekly-reports`), `PortalModules.weeklyReports.bindEvents()` failed to call `this.closeSubmitModal()`, leaving the modal open and giving the impression that the request hung.
   * *Fix Applied:* Added explicit modal dismissal, button disablement during network transit, and refreshed the report ledger.
4. **Audit Observation Form Button State & Permission Interception:**
   * *Root Cause:* The "+ Log Compliance Observation" button lacked an explicit ID, causing it to display for unauthorized roles (e.g., Committee Members) who were then rejected with HTTP 403.
   * *Fix Applied:* Added `id="btn-open-log-obs"` and wired `applyRolePermissions(user)` to restrict visibility strictly to **Auditor** and **Admin**. Added loading indicators and form reset on save.

### B. Root Causes of Empty Data & Loading Placeholders
1. **Strict CORS Origin Blocking on Vercel:**
   * *Root Cause:* `server.js` previously only allowed `localhost:3000`. Requests originating from `https://iei-dashboard.vercel.app/` were blocked before reaching authentication.
   * *Fix Applied:* Enhanced CORS origin validation using regex matching all `*.vercel.app` subdomains, localhost, LAN IPs, and institutional domains.
2. **Hardcoded Static "Loading..." Placeholders:**
   * *Root Cause:* `public/index.html` contained static strings like `<tr><td>Loading tasks...</td></tr>` that were never cleared when API endpoints returned empty sets.
   * *Fix Applied:* Replaced all static placeholders with responsive empty-state elements across all 9 views.
3. **Vercel Ephemeral Storage Cold Starts:**
   * *Root Cause:* Vercel Lambdas boot with an empty `/tmp` directory.
   * *Fix Applied:* Added automatic serverless hydration in `src/db.js` copying bundled database snapshots into `/tmp/data/portal_database.json` on cold boots.

---

## 2. 24-Point Production Verification Audit Matrix

| Module | Test Case | Expected Behavior | Actual Behavior | Status | Root Cause | Fix Applied | Remaining Work |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **Auth** | 1. Login and logout | Status 200 with JWT on login and clean logout | Login: 200, Logout: 200 | **PASS** | Button overflow in header | Fixed header logout pill with token invalidation | None |
| **Auth** | 2. Invalid login attempts | HTTP 401 Unauthorized with clear feedback | HTTP 401 Unauthorized | **PASS** | Unhandled credential errors | Bcrypt comparison with safe error message | None |
| **Security** | 3. Protected-route access | HTTP 401 Unauthorized without token | HTTP 401 Unauthorized | **PASS** | Missing endpoint gatekeepers | `authenticateToken` middleware on all API routes | None |
| **User Mgmt** | 4. Account enrollment | Status 201 Created with Credential ID | Status 201, ID: MGR.IEI.2026.01 | **PASS** | Unreliable form submission | Validated `POST /api/admin/users` with single-view credential card | None |
| **User Mgmt** | 5. Login with enrolled account | Status 200 with valid JWT session | Status 200, Role: committee | **PASS** | Bcrypt hash format mismatch | Standardized 10-round salt hashing | None |
| **User Mgmt** | 6. User directory loading | Status 200 with authorized user list | Status 200, Directory loaded | **PASS** | Stuck loading placeholder | Semantic empty states and clean table rendering | None |
| **Tasks** | 7. Task creation | Status 201 Created with ASSIGNED status | Status 201, Task Created | **PASS** | Form submit event failure | Populated `POST /api/tasks` handler | None |
| **Tasks** | 8. Task assignment | Task properly assigned to specified member | Assigned to member | **PASS** | Missing assignee selection | Dynamic datalist populated from registered members | None |
| **Tasks** | 9. Task submission and review | Lifecycle: ASSIGNED $\rightarrow$ REVIEW $\rightarrow$ APPROVED | Final Status: APPROVED | **PASS** | Missing `saveProgress` method | Added `saveProgress` & `requestRevision` methods | None |
| **Reports** | 10. Weekly report submission | Status 201 Created under Monday–Sunday | Status 201, Report Created | **PASS** | Modal failed to dismiss | Added `closeSubmitModal()` and disabled button state | None |
| **Reports** | 11. Report correction & approval | Status 200 with APPROVED endorsement | Status 200, APPROVED | **PASS** | Unresponsive buttons | Explicit click binding & error handling | None |
| **Community** | 12. Shared community publishing | Status 201 Created and broadcasted to stream | Status 201, Post Created | **PASS** | Missing `createPost` method | Implemented `createPost` in `PortalModules.community` | None |
| **Community** | 13. Community history persistence | Post persists in database feed across reloads | Post persists | **PASS** | In-memory ephemeral loss | Dual-mode persistence + `/tmp` cold-start hydration | None |
| **Messages** | 14. Private messaging delivery | Status 201 Created with sender and recipient | Status 201, Message Sent | **PASS** | Contact list disconnected | Central messaging router with dynamic contacts | None |
| **Messages** | 15. Unauthorized message access | Uninvolved user cannot view private messages | Leaked to Auditor: false | **PASS** | Missing server-side filter | Enforced participant-only SQL/JSON filter | None |
| **Events** | 16. Announcement publishing | Status 201 with published event metadata | Status 201, Published | **PASS** | Multer JSON parsing conflict | Dual support for JSON and multipart uploads | None |
| **Events** | 17. Event creation verification | Scheduled event accessible to students | Found in event list | **PASS** | Modal stuck open | Added modal dismissal and form reset | None |
| **Settings** | 18. Reporting settings persistence | Cycle 46 saved and retrieved with Asia/Kolkata | Active Week: 46, Asia/Kolkata | **PASS** | Form disconnected from store | Connected to persistent JSON/PG storage | None |
| **Audit Logs** | 19. Audit observation creation | Status 201 Created by Auditor | Status 201, Observation Logged | **PASS** | Form submit missing feedback | Added button loading state and reset | None |
| **RBAC** | 20. Role-based access control | HTTP 403 Forbidden when non-admin accesses | HTTP 403 Forbidden | **PASS** | Client-only role checks | Server-side `requireRole` middleware | None |
| **UI/UX** | 21. Desktop responsiveness (1440px / 1024px) | All 9 views render cleanly without horizontal scroll | Clean desktop layout | **PASS** | Header overflow | Fixed z-index and flex container styling | None |
| **UI/UX** | 22. Mobile responsiveness (768px / 480px) | Drawer navigation, min 46px tap targets | Responsive layout | **PASS** | Overlapping cards | Mobile media queries & drawer backdrop | None |
| **Config** | 23. Production configuration | Status ONLINE with institutional headers | Status: ONLINE | **PASS** | CORS origin rejection on Vercel | Regex CORS origin authorization for `*.vercel.app` | None |
| **Persistence**| 24. Database persistence after fresh login | Data persists across sessions & restarts | Persisted record found | **PASS** | Cold-start ephemeral reset | Bundled snapshot hydration + PostgreSQL pooler | None |

---

## 3. Automated Test Suites Summary

| Test Suite File | Test Count | Passed | Failed | Description |
| :--- | :---: | :---: | :---: | :--- |
| `test/mgr-portal-verification-suite.js` | 31 | 31 | 0 | Master integration verification of all core modules and RBAC |
| `test/verify-user-management.js` | 16 | 16 | 0 | Deep audit of enrollment, role modification, status toggle, and reset |
| `test/final-production-suite.js` | 24 | 24 | 0 | Comprehensive 24-point specification audit matrix |
| **Total Across All Suites** | **71** | **71** | **0** | **100% Pass Rate** |

---

## 4. Production Database Configuration & Schema

* **PostgreSQL DDL:** Maintained in `src/db/schema.sql` (10 tables, 11 indexes, foreign keys, and check constraints).
* **Automated Runner:** Run `node src/db/migrate.js` to execute schema migrations against Supabase or Neon.
* **Dual-Persistence Engine:**
  - When `DATABASE_URL` is configured, the server connects via `pg` connection pooling.
  - When offline or during local development, falls back to atomic local JSON storage (`data/portal_database.json`).
* **Supabase Production Setup Guide:** Comprehensive 18-step guide documented in `SUPABASE_SETUP.md`.

---

## 5. Required Vercel Environment Variables

Configure these in **Vercel Project Settings $\rightarrow$ Environment Variables**:

| Variable Name | Example Value Format | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require` | Supabase Transaction Pooler connection |
| `JWT_SECRET` | `c48e89f66d4007b8b200b3e5a2dbd5a0...` | Cryptographic JWT signing secret (server-only) |
| `NODE_ENV` | `production` | Production environment flag |
| `PORT` | `3000` | Application server port |
| `ALLOWED_ORIGIN` | `https://iei-dashboard.vercel.app` | Explicitly allowed web origin |

---

## 6. Institutional Default Test Accounts

| Role | Email / ID | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin / Editor** | `admin@mgriei.org` | `Admin_MGR_2026!` | Full governance, User Management, reporting configuration, audit trail |
| **Chairman** | `chairman@mgriei.org` | `Chairman_MGR_2026!` | Executive oversight, review/approval of tasks and reports, official stream |
| **Committee Member** | `committee@mgriei.org` | `Committee_MGR_2026!` | Task execution, progress updating, weekly reporting, community discussion |
| **Auditor** | `auditor@mgriei.org` | `Auditor_MGR_2026!` | Read-only inspection, compliance observations, student performance analytics |
