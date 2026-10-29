# MGR IEI Students Chapter — Project Continuity & Master Status Record
## Dr. M.G.R. Educational and Research Institute • The Institution of Engineers (India)

> **Document Type:** Master Architecture, Recovery, Security & Operations Ledger  
> **Last Updated:** 2026-10-29  
> **System Status:** Production Ready (Dual-Persistence Architecture: Local JSON & Managed PostgreSQL)  
> **Test Status:** 31/31 Master Verification Tests Passing • 16/16 Deep User Management Tests Passing  

---

## 1. Project Overview & Institutional Identity

* **Institution:** Dr. M.G.R. Educational and Research Institute (Deemed to be University), Chennai — 600095
* **Professional Body Affiliation:** The Institution of Engineers (India) — Established 1920, Royal Charter 1935
* **System Purpose:** An exclusive collegiate governance and operational platform engineered for student committee members and authorized faculty leadership.
* **Strict Boundary:** Exclusively for MGR IEI Students Chapter. Zero external organization (TVLC/TWC) data or personnel records.
* **Official Branding Assets:**
  - Royal Charter Emblem: `public/assets/iei-official-logo.png`
  - Dr. MGR Educational & Research Institute Chapter Crest: `public/assets/mgr-iei-official-logo.png`

---

## 2. System Architecture & Directory Structure

```
iei-tvlc-admin-portal/
├── api/
│   └── index.js                   # Vercel serverless entry point
├── data/
│   └── portal_database.json       # Local atomic JSON persistent store (development fallback)
├── public/
│   ├── assets/
│   │   ├── iei-official-logo.png  # Royal Charter circular emblem
│   │   └── mgr-iei-official-logo.png # MGR University horizontal crest
│   ├── css/
│   │   └── portal.css             # Rolls-Royce-inspired institutional white-and-blue theme
│   ├── js/
│   │   ├── api.js                 # Central REST client with session management
│   │   ├── app.js                 # Navigation controller, gatekeeper, mobile drawer
│   │   ├── branding.js            # Dual-logo lockups preserving aspect ratios
│   │   └── portal-modules.js      # 9 core functional modules
│   └── index.html                 # Single Page Application stage (9 approved views)
├── scripts/
│   └── setup-admin.js             # Administrator enrollment & credential generation
├── src/
│   ├── auth.js                    # JWT generation, token verification, bcrypt hashing
│   ├── config.js                  # Central configuration & storage paths
│   ├── db.js                      # Dual-mode database interface with auto-init
│   ├── seedData.js                # Official seed data for MGR IEI Students Chapter
│   ├── db/
│   │   ├── migrate.js             # Automated PostgreSQL schema migration runner
│   │   ├── pgClient.js            # Connection pooler for PostgreSQL (Neon/Supabase)
│   │   ├── pgRepository.js        # High-performance SQL queries for all entities
│   │   └── schema.sql             # Production SQL DDL with indexes & foreign keys
│   ├── middleware/
│   │   └── rateLimiter.js         # Express rate limiter for auth endpoints
│   ├── routes/
│   │   ├── authRoutes.js          # /login, /logout, /me, /profile, /change-password, /quick-access
│   │   ├── portalRoutes.js        # /tasks, /weekly-reports, /community, /messages, /reporting-settings, /audit-observations
│   │   ├── userRoutes.js          # /api/admin/users (enroll, role change, status toggle, reset)
│   │   ├── eventRoutes.js         # /api/events (technical events schedule)
│   │   ├── chapterRoutes.js       # /api/chapters (collegiate chapter registry)
│   │   ├── analyticsRoutes.js     # /api/analytics (time-series activity trends)
│   │   └── exportRoutes.js        # /api/export (CSV exports for compliance)
│   └── storage/
│       └── storageAdapter.js      # Cloud / local file storage abstraction
├── test/
│   ├── mgr-portal-verification-suite.js # Master 31-test integration suite
│   └── verify-user-management.js       # 16-test deep user administration suite
├── .env.example                   # Safe template with environment variable placeholders
├── .gitignore                     # Production exclusions (secrets, logs, uploads, cache)
├── package.json                   # Dependency declarations & test scripts
├── README.md                      # Comprehensive developer guide
├── VERCEL-DEPLOYMENT.md           # Step-by-step production deployment instructions
└── server.js                      # Express application bootstrapping & security policies
```

---

## 3. Four Authoritative Roles & Permission Matrix

Permissions are strictly enforced at the database and server middleware layer:

| Feature / Operation | Admin / Editor (`admin`) | Chairman (`chairman`) | Committee Member (`committee`) | Auditor (`auditor`) |
| :--- | :---: | :---: | :---: | :---: |
| **Login-First Gatekeeper** | Enforced | Enforced | Enforced | Enforced |
| **Create Tasks** | Yes | Yes | No (403) | No (403) |
| **Update Own Task Progress** | Yes | Yes | Yes | No (403) |
| **Update Other Member's Tasks** | Yes | Yes | No (403) | No (403) |
| **Approve Completed Tasks** | Yes | Yes | No (403) | No (403) |
| **Request Task Revision** | Yes | Yes | No (403) | No (403) |
| **Submit Weekly Reports** | Yes | Yes | Yes | No (403) |
| **Approve / Endorse Reports** | Yes | Yes | No (403) | No (403) |
| **Request Report Revision** | Yes | Yes | No (403) | No (403) |
| **Publish Stream Announcements** | Yes | Yes | No (Discussions only) | No (Read only) |
| **Participate in Stream Discussions** | Yes | Yes | Yes | Yes |
| **Direct Messaging** | All Users | Assigned Leads | Admin & Chairman | Admin Only |
| **User Management (Enroll/Role)** | Yes | No (403) | No (403) | No (403) |
| **Reporting Cycle Configuration** | Yes | No (403) | No (403) | No (403) |
| **Log Audit Observations** | Yes | No (403) | No (403) | Yes |
| **Inspect System Audit Trail** | Yes | No (403) | No (403) | Yes |

---

## 4. Credential Formatting Conventions

Initial identifiers are formatted using collegiate conventions (authorization is determined solely by the database-backed role):
* **Admin / Editor:** `MGR.IEI.admin.<num>` (e.g., `MGR.IEI.admin.01`)
* **Chairman:** `MGR.IEI.CHAIRMAN.<num>` (e.g., `MGR.IEI.CHAIRMAN.01`)
* **Committee Member:** `MGR.IEI.<year>.<num>` (e.g., `MGR.IEI.2026.01`)
* **Auditor:** `MGR.IEI.staff.<num>` (e.g., `MGR.IEI.staff.01`)

Users can authenticate using either their institutional email address or their assigned Credential ID.

---

## 5. Security Architecture Decisions

1. **Mandatory Login Gatekeeper:** No protected route, dashboard pane, or API endpoint is exposed to unauthenticated visitors. All requests without a valid JWT receive an immediate HTTP 401 response.
2. **Authoritative Server Roles:** Browser client state is never trusted. Roles are retrieved from the verified server-side JWT / database record on each operation.
3. **No Cleartext Credentials in Browser:** Removed client-side cleartext credentials from `app.js` and `portal-modules.js`. Removed top-header client perspective switcher.
4. **Single-View Temporary Passwords:** During account enrollment, generated temporary credentials are shown exactly once to the Administrator with a 1-click clipboard copy utility.
5. **Rate Limiting:** Authentication attempts are rate-limited (`authLimiter`) to prevent brute-force attacks.
6. **Hardened HTTP Headers:** Helmet enforces strict Content Security Policy (`scriptSrc`, `styleSrc`, `fontSrc`, `imgSrc`), anti-clickjacking (`frameAncestors: "'self'"`), and anti-MIME sniffing.
7. **Protected File Downloads:** Report and task attachments are served with `Content-Disposition: attachment` to prevent arbitrary file execution in browser contexts.
8. **Tamper-Evident Audit Trail:** Every privileged operation (`USER_ENROLLED`, `USER_ROLE_CHANGED`, `PASSWORD_RESET_INITIATED`, `TASK_CREATED`, `WEEKLY_REPORT_ENDORSED`) is permanently written to the audit log.

---

## 6. Verification & Automated Test Commands

Execute test suites inside the project directory:

```bash
# Run Master Verification Test Suite (31 tests: auth, RBAC, tasks, reports, community, messaging)
npm test

# Run Deep User Administration Suite (16 tests: enrollment, roles, deactivation, password reset)
npm run test:users

# Run All Automated Verification Suites in sequence
npm run test:all
```

Both test suites include automatic Named Pipe IPC self-hosting on Windows and fallback to local HTTP, ensuring 100% autonomous pass rates in CI/CD and sandboxed environments.

---

## 7. Disaster Recovery & Continuity Procedures

In the event of lost sessions or local system resets:
1. **Local Backup Archive:** Git bundle and source tarballs are stored in `C:\Users\Sripriyan\.gemini\antigravity\scratch\backups\`:
   - `iei-tvlc-admin-portal-all-branches.bundle` (Complete Git commit history)
   - `iei-tvlc-admin-portal-source-backup.tar.gz` (Complete source files snapshot)
2. **Restoring from Git Bundle:**
   ```bash
   git clone iei-tvlc-admin-portal-all-branches.bundle restored-portal
   ```
3. **Database Recovery:** The local database schema and initial state can be regenerated at any time using:
   ```bash
   node -e "require('./src/db').initDatabase(true)"
   ```
4. **PostgreSQL Migration:** Production schemas can be migrated or reapplied non-destructively:
   ```bash
   DATABASE_URL="..." node src/db/migrate.js
   ```
