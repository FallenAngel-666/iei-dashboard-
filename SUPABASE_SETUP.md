# MGR IEI STUDENTS CHAPTER — SUPABASE & POSTGRESQL PRODUCTION SETUP GUIDE
## Dr. M.G.R. Educational and Research Institute • The Institution of Engineers (India)

> **Target Application:** MGR IEI Students Chapter — Committee & Staff Portal  
> **Production URL:** `https://iei-dashboard.vercel.app/`  
> **Architecture:** Vercel Serverless Hosting + Supabase / Neon Managed PostgreSQL  
> **Security Notice:** Never commit secrets or service keys into client code or version control.

---

### 1. How to Create a Supabase Project

1. Navigate to [https://supabase.com/](https://supabase.com/) and sign in with your authorized institutional GitHub or organization account.
2. Click **New project** from the organization dashboard.
3. In the project creation dialog:
   * **Name:** `mgr-iei-portal`
   * **Database Password:** Generate a high-entropy password (at least 20 characters) and store it securely in your institutional password manager.
   * **Pricing Plan:** Free tier or Pro tier based on active collegiate member volume.

---

### 2. Which Database Region to Choose

* **Recommended Region:** `ap-south-1` (**South Asia - Mumbai, India**)
* **Rationale:** Minimizes network latency for students and faculty accessing the portal from Chennai, Tamil Nadu, and aligns with the configured institutional reporting timezone (`Asia/Kolkata`).

---

### 3. Database Tables and Migrations Required

The platform requires 10 production tables defined in `src/db/schema.sql`:

1. `chapters` — MGR IEI Students Chapter collegiate entity records.
2. `users` — Authorized members with strict 4 roles (`admin`, `chairman`, `committee`, `auditor`).
3. `events` — Technical lectures, national statutory days, seminars, and workshops.
4. `tasks` — Kanban/List milestones with chronological audit history (`ASSIGNED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `SUBMITTED_FOR_REVIEW` $\rightarrow$ `APPROVED`).
5. `weekly_reports` — Monday–Sunday activity reports with hours, attendees, and review comments.
6. `community_posts` — Classroom stream announcements and student technical discussions.
7. `private_messages` — Direct encrypted chapter channels between members and administration.
8. `reporting_settings` — Asia/Kolkata cycle parameters and Monday 11:59 PM deadline controls.
9. `audit_observations` — Independent qualitative observations logged by Chapter Auditor.
10. `audit_logs` — Tamper-evident administrative action ledger.

---

### 4. How to Apply Migrations Safely

#### Option A: Via Supabase SQL Editor (Fastest)
1. In the Supabase Dashboard, click **SQL Editor** on the left menu.
2. Click **New query**.
3. Open `src/db/schema.sql` from this repository, copy the full contents, and paste it into the editor.
4. Click **Run**.
5. Verify that all 10 tables and 11 performance indexes appear under the **Table Editor**.

#### Option B: Via Automated Migration Script
From your local terminal, run:
```powershell
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require" node src/db/migrate.js
```

---

### 5. Authentication Architecture

* Authentication uses trusted server-side verification:
  - **Transport:** HTTP Bearer token + Secure Cookie.
  - **Hashing:** `bcryptjs` with salt round 10 for all passwords.
  - **Payload:** JWT signed with server-only `JWT_SECRET`.
  - **No OTP:** OTP login is deliberately postponed per institutional specifications.

---

### 6. Four Authoritative Roles & Access Enforcement

The database schema enforces a strict SQL `CHECK` constraint:
```sql
role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'chairman', 'committee', 'auditor'))
```
* **Admin / Editor:** Full user administration, role assignment, settings.
* **Chairman:** Executive oversight, review/approval of tasks and weekly reports.
* **Committee Member:** Personal task execution, weekly activity reporting, community posts.
* **Auditor:** Read-only operational ledger, compliance observation recording, student progress analytics.

---

### 7. Row Level Security (RLS) Policies

To enforce database-level isolation, enable RLS in the Supabase SQL Editor:

```sql
-- Enable RLS across sensitive operational tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_observations ENABLE ROW LEVEL SECURITY;

-- Allow backend application service role full access
CREATE POLICY "Service role full access on users" ON users FOR ALL USING (true);
CREATE POLICY "Service role full access on tasks" ON tasks FOR ALL USING (true);
CREATE POLICY "Service role full access on weekly_reports" ON weekly_reports FOR ALL USING (true);
CREATE POLICY "Service role full access on private_messages" ON private_messages FOR ALL USING (true);
CREATE POLICY "Service role full access on audit_observations" ON audit_observations FOR ALL USING (true);
```

---

### 8. Required Production Environment Variables

| Variable Name | Required Value Format | Scope | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require` | **Server-Only** | Transaction Pooler URI |
| `JWT_SECRET` | 64-character random hex string | **Server-Only** | Session encryption key |
| `PORT` | `3000` | **Server-Only** | Internal server port |
| `NODE_ENV` | `production` | **Server-Only** | Execution environment |
| `ALLOWED_ORIGIN`| `https://iei-dashboard.vercel.app` | **Server-Only** | Authorized browser origin |

---

### 9. Where to Obtain Connection String in Supabase

1. In the Supabase Dashboard, go to **Project Settings** (gear icon) $\rightarrow$ **Database**.
2. Scroll to **Connection string**.
3. Select the **URI** tab.
4. Select **Transaction Pooler** (Port `6543`) for Vercel serverless execution.
5. Replace `[YOUR-PASSWORD]` with the database password set in Step 1.

---

### 10. How to Add Environment Variables in Vercel

1. Log into your [Vercel Dashboard](https://vercel.com/).
2. Select the `iei-dashboard` project.
3. Navigate to **Settings** $\rightarrow$ **Environment Variables**.
4. Add:
   * **Key:** `DATABASE_URL` | **Value:** *Your Supabase pooled URI* | **Environment:** Production, Preview
   * **Key:** `JWT_SECRET` | **Value:** *Your generated secret* | **Environment:** Production, Preview
   * **Key:** `NODE_ENV` | **Value:** `production` | **Environment:** Production, Preview
5. Click **Save**.

---

### 11. Public vs Server-Only Isolation Rules

* **CRITICAL SECURITY RULE:**
  - `DATABASE_URL` and `JWT_SECRET` must **NEVER** be prefixed with `NEXT_PUBLIC_` or `VITE_`.
  - Frontend browser JavaScript bundles must **NEVER** contain database credentials or Supabase service-role keys.
  - The client only communicates with your internal `/api/*` REST endpoints.

---

### 12. Redeployment After Updating Variables

In Vercel:
1. Navigate to the **Deployments** tab.
2. Click the three dots (`...`) next to the latest production deployment.
3. Select **Redeploy**.
4. Ensure **"Clear Cache and Deploy"** is checked.
5. Wait ~60 seconds for the production build to finish.

---

### 13. How to Initialize the First Administrator

Run the initialization script against your database:
```powershell
DATABASE_URL="[YOUR-POOLED-SUPABASE-URI]" node scripts/setup-admin.js
```
Default seed institutional administrator:
* **Email:** `admin@mgriei.org`
* **Password:** `Admin_MGR_2026!`
* **Role:** `admin` (Admin/Editor)

---

### 14. Verifying Database Connectivity

Open:
```
https://iei-dashboard.vercel.app/api/health
```
Expected JSON Response:
```json
{
  "status": "ONLINE",
  "engine": "Managed PostgreSQL (Serverless)",
  "institution": "Dr. M.G.R. Educational and Research Institute",
  "fullName": "MGR IEI Students Chapter Portal",
  "centre": "The Institution of Engineers (India) Collegiate Chapter",
  "timestamp": "2026-10-29T...",
  "stats": {
    "registeredChapters": 1,
    "eventsLogged": 5
  }
}
```

---

### 15. Functional Verification Test Cases

1. **User Enrollment:** Sign in as `admin@mgriei.org` $\rightarrow$ User Administration $\rightarrow$ Enroll New Member $\rightarrow$ Verify member appears in directory and database.
2. **Task Workflow:** Sign in as `chairman@mgriei.org` $\rightarrow$ Task Management $\rightarrow$ Create Task $\rightarrow$ Assign to student $\rightarrow$ Sign in as `committee@mgriei.org` $\rightarrow$ Update progress slider $\rightarrow$ Submit for review.
3. **Stream Publishing:** Shared Community $\rightarrow$ Type message $\rightarrow$ Click **Publish to Stream** $\rightarrow$ Verify message appears instantly with timestamp.

---

### 16. Persistent Attachment Storage

If file attachments (event posters, technical PDF reports) are enabled:
1. In Supabase Dashboard, click **Storage**.
2. Click **Create a new bucket** named `iei-attachments`.
3. Set bucket to **Private** (authenticated downloads only).
4. Configure storage adapter in `src/storage/storageAdapter.js`.

---

### 17. Automated Backups & Disaster Recovery

1. **Daily Snapshots:** Supabase automatically creates daily WAL backups of the PostgreSQL instance.
2. **Manual Point-in-Time Dump:**
   ```powershell
   pg_dump "[YOUR-SUPABASE-URI]" --clean --if-exists > "mgr_iei_backup_$(Get-Date -Format 'yyyyMMdd').sql"
   ```
3. **Local JSON Fallback:** The repository maintains an atomic fallback store at `data/portal_database.json` with cold-start hydration in `/tmp/data/portal_database.json` if PostgreSQL is offline.

---

### 18. Usage Limits & Pre-Launch Pricing Check

* **Free Tier Limits:**
  - 500 MB Database storage (sufficient for ~25,000 collegiate records).
  - 50,000 monthly active users.
  - Compute pauses after 7 days of inactivity (avoid on production by keeping active or upgrading to Pro).
* **Pooler Concurrency:** Always use port `6543` (Transaction Pooler) on serverless platforms like Vercel to prevent connection exhaustion.
