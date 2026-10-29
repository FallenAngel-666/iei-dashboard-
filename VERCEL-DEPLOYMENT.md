# MGR IEI Students Chapter — Vercel & Managed Cloud Production Deployment Guide
## Dr. M.G.R. Educational and Research Institute • The Institution of Engineers (India)

This comprehensive guide details the exact procedures for deploying the **MGR IEI Students Chapter — Student Committee & Staff Portal** to production on Vercel with persistent managed PostgreSQL (Neon / Supabase) and persistent object storage.

---

## 1. Production Architecture Overview

The portal uses a hardened, serverless-ready Node.js/Express architecture:

```
                      ┌───────────────────────────────────────────────┐
                      │              Vercel Edge Network              │
                      │   HTTPS / CDN Caching / DDoS Mitigation       │
                      └──────────────────────┬────────────────────────┘
                                             │
                                             ▼
                      ┌───────────────────────────────────────────────┐
                      │             Vercel Serverless Function        │
                      │         (Express 5.x / api/index.js)          │
                      │    - Helmet Security Headers & Strict CSP     │
                      │    - Rate Limiting (authLimiter)              │
                      │    - Authoritative 4-Role RBAC Middleware     │
                      │    - Dual-Transport JWT (Cookie + Bearer)     │
                      └──────────────┬─────────────────┬──────────────┘
                                     │                 │
                   PostgreSQL / SSL  │                 │ REST API / S3
                                     ▼                 ▼
             ┌───────────────────────────────┐  ┌───────────────────────────────┐
             │    Managed PostgreSQL DB      │  │     Cloud Object Storage      │
             │   (Neon / Supabase / AWS)     │  │   (Supabase Storage / S3)     │
             │  - Strict 4-Role Constraints  │  │  - Posters & Reports          │
             │  - Asia/Kolkata Cycle Ledger  │  │  - Task / Stream Attachments  │
             │  - Tamper-Evident Audit Trail │  │  - Anti-Execution Download    │
             └───────────────────────────────┘  └───────────────────────────────┘
```

---

## 2. Prerequisites & Required Accounts

Before deploying, ensure you have:
1. **GitHub / GitLab account:** For hosting the private repository.
2. **Vercel account:** [vercel.com](https://vercel.com) (Hobby or Pro plan; standard serverless functions fully supported).
3. **Managed PostgreSQL Database:** [Neon](https://neon.tech) or [Supabase](https://supabase.com) (Free or Paid tier; connection pooling enabled).
4. **Cloud Storage Bucket:** Supabase Storage or AWS S3 bucket for task/report attachments.

---

## 3. Environment Variables Configuration

Configure the following environment variables in your **Vercel Project Settings → Environment Variables**:

| Variable Name | Required? | Example / Default Value | Purpose |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Enforces production security, disables debug endpoints |
| `JWT_SECRET` | **Yes** | `[Generate 64+ char random string]` | Signs and verifies session tokens |
| `DATABASE_URL` | **Yes** | `postgresql://user:pwd@ep-xy.neon.tech/mgr_iei?sslmode=require` | Managed PostgreSQL connection string |
| `PORT` | No | `3000` (Defaults to Vercel internal port) | Express server port |
| `SUPABASE_URL` | Optional | `https://your-proj.supabase.co` | Cloud storage integration |
| `SUPABASE_SERVICE_KEY` | Optional | `eyJh...` | Cloud storage private access key |
| `ADMIN_EMAIL` | Optional | `admin@mgriei.org` | Initial administrator account email |
| `ADMIN_PASSWORD` | Optional | `[StrongUniquePassword123!]` | Initial administrator account password |

> [!IMPORTANT]
> Never commit actual values for `JWT_SECRET`, `DATABASE_URL`, or `SUPABASE_SERVICE_KEY` to Git. Keep them strictly in Vercel environment variables or local `.env` (which is excluded by `.gitignore`).

---

## 4. Step-by-Step Deployment Instructions

### Step 4.1: Prepare Managed PostgreSQL Database
1. Create a new PostgreSQL database on Neon or Supabase named `mgr_iei_portal`.
2. Copy the pooled connection string (`postgresql://...`).
3. Run the automated database schema migration from your local machine:
   ```bash
   DATABASE_URL="your-connection-string" node src/db/migrate.js
   ```
4. Seed or create your initial Administrator account:
   ```bash
   DATABASE_URL="your-connection-string" node scripts/setup-admin.js --email "admin@mgriei.org" --password "YourStrongUniquePassword123!"
   ```

### Step 4.2: Connect Git Repository to Vercel
1. Push your project to a private Git repository:
   ```bash
   git remote add origin https://github.com/your-org/mgr-iei-student-chapter.git
   git branch -M main
   git push -u origin main
   ```
2. In the Vercel Dashboard, click **Add New... → Project**.
3. Import the `mgr-iei-student-chapter` repository.
4. Set Framework Preset: **Other**.
5. Keep Build Command empty (standard Node.js application).
6. Under **Environment Variables**, paste the production values documented in Section 3.
7. Click **Deploy**.

### Step 4.3: Verify Deployment Health
Once the deployment finishes:
1. Navigate to `https://your-deployment.vercel.app/api/health`.
   Verify the response:
   ```json
   {
     "status": "ONLINE",
     "engine": "Managed PostgreSQL (Serverless)",
     "institution": "MGR IEI Students Chapter",
     "fullName": "The Institution of Engineers (India) — Dr. M.G.R. Educational and Research Institute Students Chapter"
   }
   ```
2. Navigate to `https://your-deployment.vercel.app/`.
   - The login gateway displays the official IEI Royal Charter Emblem and Dr. MGR University Chapter Logo.
   - Test sign-in using your configured Admin credentials.
   - Verify that all 9 views load smoothly and access control blocks unauthorized operations.

---

## 5. Security Checklist Before Going Live

- [x] Strict 4-Role RBAC enforced on server and database.
- [x] Zero TVLC/TWC organizational remnants or external affiliations.
- [x] Mandatory authentication before dashboard access.
- [x] Passwords securely hashed with bcrypt (salt rounds = 10).
- [x] Rate limiting active on authentication endpoints.
- [x] Helmet security headers and strict Content Security Policy active.
- [x] Anti-MIME sniffing (`X-Content-Type-Options: nosniff`) enabled on static files.
- [x] Direct download (`Content-Disposition: attachment`) enforced on reports to prevent browser execution.
- [x] Zero plain-text passwords or service keys exposed in browser code.
- [x] Audit log captures all governance and administrative actions.
- [x] Automated test suites passing 100%.
