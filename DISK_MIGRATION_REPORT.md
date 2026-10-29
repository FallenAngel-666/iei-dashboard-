# MGR IEI STUDENTS CHAPTER PORTAL — DISK SPACE OPTIMIZATION & PROJECT MIGRATION REPORT
## Dr. M.G.R. Educational and Research Institute • The Institution of Engineers (India)

> **Migration Date:** 2026-10-29  
> **Target Production URL:** https://iei-dashboard.vercel.app/  
> **Source Directory (Drive C:):** `C:\Users\Sripriyan\.gemini\antigravity\scratch\iei-tvlc-admin-portal`  
> **Destination Directory (Drive F:):** `F:\MGR_IEI_Portal`  
> **Migration Verification Status:** 100% SUCCESS (71 / 71 Automated Tests Passing on Disk F)  

---

## 1. Disk Drive Analysis & Capacity Comparison

Prior to migration, system drive capacity was audited:
* **Drive C:\ (System Drive):** **0.72 GB Free** out of 222 GB (Critical low storage condition).
* **Drive F:\ (Target Drive):** **78.17 GB Free** out of 141.57 GB (Ample storage capacity).
* **Target Directory Availability:** `F:\MGR_IEI_Portal` was inspected; no conflicting folder or files existed.

---

## 2. Directory Architecture on Disk F: (`F:\MGR_IEI_Portal\`)

```
F:\MGR_IEI_Portal\
├── api/                           # Vercel serverless entry point (api/index.js)
├── backups/                       # Local Git bundles & full source archives (excluded from Git)
│   ├── iei-tvlc-admin-portal-all-branches.bundle
│   ├── iei-tvlc-admin-portal-source-backup.tar.gz
│   └── pre-migration-recovery-point.bundle
├── data/                          # Local atomic JSON persistent store
│   └── portal_database.json       # Clean seed database (4 official roles, verified accounts)
├── node_modules/                  # Cleanly regenerated dependencies on Disk F (117 packages)
├── public/                        # Institutional frontend Single-Page Application
│   ├── assets/                    # Royal Charter and MGR IEI crest logos
│   ├── css/                       # Rolls-Royce-inspired white-and-blue theme
│   ├── js/                        # Core controllers (app.js, api.js, portal-modules.js)
│   └── index.html                 # 9 verified workspace views
├── scripts/                       # Development & administrative setup scripts
├── src/                           # Backend application logic
│   ├── db/                        # PostgreSQL schema migrations (schema.sql, migrate.js, pgClient.js)
│   ├── middleware/                # Rate limiter and security middleware
│   ├── routes/                    # API endpoints for all 9 modules
│   ├── storage/                   # File storage adapter (local / cloud)
│   ├── auth.js                    # JWT and bcrypt security
│   ├── config.js                  # Dynamic configuration with DATA_DIR & UPLOADS_DIR overrides
│   ├── db.js                      # Dual-mode database interface with auto-init & cold-start hydration
│   └── seedData.js                # Official MGR IEI collegiate seed dataset
├── test/                          # Comprehensive test suites (71 tests across 3 suites)
│   ├── final-production-suite.js  # 24-point specification verification suite
│   ├── mgr-portal-verification-suite.js # 31-test master integration suite
│   └── verify-user-management.js  # 16-test deep user management suite
├── uploads/                       # Local media storage directory
│   ├── attachments/               # Private document attachments
│   ├── posters/                   # Event posters
│   └── reports/                   # Technical report PDFs
├── .env.example                   # Environment variable template
├── .gitignore                     # Configured to ignore node_modules, .env, and backups/
├── FUNCTIONAL_AUDIT_REPORT.md     # Full 24-point functional audit report
├── package.json                   # Dependencies, test scripts, and project metadata
├── package-lock.json              # Deterministic dependency lockfile
├── PROJECT_STATUS.md              # Master project continuity and RBAC ledger
├── README.md                      # Developer documentation
├── server.js                      # Express application server with regex CORS matching
├── SUPABASE_SETUP.md              # 18-step Supabase PostgreSQL setup guide
└── vercel.json                    # Serverless routing and security headers
```

---

## 3. Configuration & Code Updates Applied

1. **Dynamic Path Resolution (`src/config.js`):**
   * Configured `DATA_DIR` and `UPLOADS_DIR` to support environment variable overrides:
     ```javascript
     const baseDataDir = isVercel ? '/tmp/data' : (process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
     const baseUploadsDir = isVercel ? '/tmp/uploads' : (process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads'));
     ```
   * Automatically resolves to `F:\MGR_IEI_Portal\data` and `F:\MGR_IEI_Portal\uploads` without any hardcoded drive letters.
2. **Git Ignore Hardening (`.gitignore`):**
   * Added `backups/`, `*.bundle`, and `*.tar.gz` to prevent local archival bundles from being tracked or pushed to remote repositories.
3. **Clean Dependencies Reinstallation:**
   * Executed `npm install` on `F:\MGR_IEI_Portal`, restoring all 117 packages with 0 vulnerabilities directly onto Disk F.

---

## 4. Distinction Between Local Storage vs. Cloud Production Storage

* **Vercel Serverless Hosting:**
  - The live website hosted at `https://iei-dashboard.vercel.app/` runs on Vercel's global edge infrastructure.
  - Vercel does **NOT** access your local personal computer's `F:\` drive.
  - On Vercel, the application uses `/tmp/data` with cold-start hydration, or connects to the managed PostgreSQL database (`DATABASE_URL`).
* **Local Development Environment:**
  - Local development runs from `F:\MGR_IEI_Portal` using `F:\MGR_IEI_Portal\data\portal_database.json` and `F:\MGR_IEI_Portal\uploads\`.
  - Pushing changes from Disk F via `git push origin main` deploys code updates to Vercel without altering the production database architecture.

---

## 5. Verification & Test Execution on Disk F: (`F:\MGR_IEI_Portal`)

All 3 automated test suites were executed directly from `F:\MGR_IEI_Portal` via `npm run test:all`:

| Test Suite | File | Tests Run | Passed | Failed |
| :--- | :--- | :---: | :---: | :---: |
| **Suite 1: Master Integration** | `test/mgr-portal-verification-suite.js` | 31 | 31 | 0 |
| **Suite 2: User Administration** | `test/verify-user-management.js` | 16 | 16 | 0 |
| **Suite 3: 24-Point Production Matrix** | `test/final-production-suite.js` | 24 | 24 | 0 |
| **Total Across All Suites** | **All 3 Suites** | **71** | **71** | **0** |

### Verified Working Capabilities on Disk F:
* ✅ Authentication, token issuance, and fixed header logout
* ✅ Role-based permissions (Admin, Chairman, Committee Member, Auditor)
* ✅ Account enrollment and single-view credential card
* ✅ Task creation, assignee datalist, progress updates, and revision requests
* ✅ Weekly report submission, Asian/Kolkata cycle enforcement, and Chairman endorsement
* ✅ Shared community stream publishing and threaded replies
* ✅ Confidential private messaging with participant-only filtering
* ✅ Event scheduling and reporting settings persistence
* ✅ Auditor compliance observation logging

---

## 6. Migration Status of Old Drive Files (Drive C:)

* **Original Project Status:** The original project at `C:\Users\Sripriyan\.gemini\antigravity\scratch\iei-tvlc-admin-portal` was preserved completely intact. Nothing was deleted or modified during the migration.
* **Pre-Migration Recovery Point:** A full Git bundle was preserved at `C:\Users\Sripriyan\.gemini\antigravity\scratch\backups\pre-migration-recovery-point.bundle` and copied to `F:\MGR_IEI_Portal\backups\`.
* **Recommended Next Step to Free Drive C: Space:**
  Once you confirm that `F:\MGR_IEI_Portal` is working to your satisfaction, you can safely delete `C:\Users\Sripriyan\.gemini\antigravity\scratch\iei-tvlc-admin-portal` to reclaim disk space on C:.

---

## 7. Quick Start Commands for Disk F:

### Open the Project Folder
```powershell
cd "F:\MGR_IEI_Portal"
```

### Run Locally on Port 3000
```powershell
npm start
```
Then visit [http://localhost:3000](http://localhost:3000).

### Run All 71 Verification Tests
```powershell
npm run test:all
```

### Push Updates to GitHub & Deploy to Vercel
```powershell
git push origin main
```
