# IEI TVLC Portal — Vercel & Managed Cloud Production Deployment Guide

This guide provides end-to-end instructions for deploying the **Institution of Engineers (India), Tiruvallur Local Centre (IEI TVLC) Staff Administration and Analytics Portal** to **Vercel** backed by a **Managed PostgreSQL Database** (Neon or Supabase) and **Cloud Object Storage** (Supabase Storage).

---

## 🏛️ Architecture Overview

In a serverless platform like Vercel, server processes are stateless and ephemeral, and the local filesystem is read-only (except `/tmp`). To run seamlessly in production while keeping local development friction-free, the portal uses a **dual-engine architecture**:

```
                         ┌────────────────────────────────────────┐
                         │   Vercel Serverless Function           │
                         │   api/index.js (Express Application)   │
                         └──────────────────┬─────────────────────┘
                                            │
                   ┌────────────────────────┴────────────────────────┐
                   │                                                 │
          DATABASE_URL present?                             SUPABASE_URL present?
         ┌─────────┴─────────┐                             ┌─────────┴─────────┐
        YES                  NO                           YES                  NO
         │                   │                             │                   │
         ▼                   ▼                             ▼                   ▼
┌──────────────────┐ ┌───────────────┐           ┌──────────────────┐ ┌───────────────┐
│ Managed Postgres │ │  Local JSON   │           │ Supabase Storage │ │  Local Disk   │
│ (Neon/Supabase)  │ │   Database    │           │ (Public Posters/ │ │   Uploads     │
│ Production Pool  │ │ (Local Dev)   │           │ Private Reports) │ │  (Local Dev)  │
└──────────────────┘ └───────────────┘           └──────────────────┘ └───────────────┘
```

1. **Serverless Routing (`vercel.json` + `api/index.js`):** All incoming API traffic (`/api/*`), uploads (`/uploads/*`), and direct page refreshes (`/*`) route into the Express serverless handler without 404s.
2. **Managed PostgreSQL (`src/db/`):** Persistent storage using `pg` with connection pooling, parameterized queries, and automatic SSL detection.
3. **Cloud Object Storage (`src/storage/`):** File uploads (event posters and post-event technical reports) are validated using **magic-byte inspection** and stored in cloud buckets. Technical reports are stored in a private bucket and served via authenticated, short-lived signed URLs.
4. **Offline Local Dev Fallback:** When `DATABASE_URL` is not set, the application automatically falls back to `data/portal_database.json` and local disk uploads, ensuring 100% test compatibility offline.

---

## 🚀 Step-by-Step Deployment Instructions

### Step 1: Provision a Managed PostgreSQL Database

You can use any PostgreSQL provider. Two recommended free/low-cost options:

#### Option A: Neon Serverless Postgres (Recommended)
1. Visit [neon.tech](https://neon.tech/) and create a free account.
2. Create a new project: `iei-tvlc-portal`.
3. In the Neon Dashboard, copy the connection string under **Connection Details**:
   ```
   postgresql://[user]:[password]@[endpoint].neon.tech/neondb?sslmode=require
   ```

#### Option B: Supabase PostgreSQL
1. Visit [supabase.com](https://supabase.com/) and create a project.
2. Navigate to **Project Settings > Database > Connection String > URI**.
3. Copy the pooled connection string (Port 6543 or 5432 with SSL).

---

### Step 2: Run Database Migrations & Initial Data Seeding

The repository includes an automated migration runner (`src/db/migrate.js`) that creates the schema, tables, foreign keys, and seeds the official baseline data (18 collegiate chapters, 11 official 2025-2026 activities, membership snapshots, and baseline accounts).

Run the migration against your managed database:

```bash
# In Windows PowerShell:
$env:DATABASE_URL="postgresql://username:password@your-db-host.neon.tech/neondb?sslmode=require"
npm run db:migrate

# In Linux/macOS Bash:
DATABASE_URL="postgresql://username:password@your-db-host.neon.tech/neondb?sslmode=require" npm run db:migrate
```

**Expected output:**
```
=======================================================
 IEI TVLC Database Migration & Seeding Runner
=======================================================
✓ Connected to PostgreSQL server.
✓ Database schema applied successfully.
✓ 18 collegiate chapters synchronized.
✓ 11 institutional activities recorded.
✓ 4 historical membership snapshots verified.
✓ 5 membership intake records logged.
✓ System users synchronized.
Migration complete! System is ready for production.
```

---

### Step 3: Configure Super Administrator Credentials

To eliminate hardcoded demonstration passwords in production, run the admin setup script:

```bash
# In Windows PowerShell:
$env:DATABASE_URL="postgresql://username:password@your-db-host.neon.tech/neondb?sslmode=require"
node scripts/setup-admin.js --email "admin@ieitvlc.org" --password "YourStrongUniquePassword123!"

# In Linux/macOS Bash:
DATABASE_URL="..." node scripts/setup-admin.js --email "admin@ieitvlc.org" --password "YourStrongUniquePassword123!"
```

This updates the administrative password hash in PostgreSQL securely with bcrypt (10 rounds).

---

### Step 4: Set Up Cloud Object Storage (Supabase Storage)

1. Open your **Supabase Dashboard** and navigate to **Storage**.
2. **Create Poster Bucket:**
   * Name: `iei-tvlc-posters`
   * Public bucket: **ON** (Event posters are publicly visible)
   * Allowed MIME types: `image/jpeg, image/png, image/webp`
   * Max file size: `5MB`
3. **Create Report Bucket:**
   * Name: `iei-tvlc-reports`
   * Public bucket: **OFF (Private)** (Confidential event reports require authenticated access)
   * Allowed MIME types: `application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/msword`
   * Max file size: `15MB`
4. Copy your **Supabase URL** and **Service Role API Key** from **Project Settings > API**.

---

### Step 5: Push Repository to GitHub / GitLab

1. In the project directory, check that `.gitignore` is present:
   ```bash
   git status
   ```
2. Initialize and commit:
   ```bash
   git init
   git add .
   git commit -m "feat: configure IEI TVLC portal for Vercel deployment with PostgreSQL and cloud storage"
   ```
3. Create a private repository on GitHub (`iei-tvlc-admin-portal`) and push:
   ```bash
   git remote add origin https://github.com/your-org/iei-tvlc-admin-portal.git
   git branch -M main
   git push -u origin main
   ```

---

### Step 6: Deploy to Vercel

1. Log into [vercel.com](https://vercel.com/) and click **Add New > Project**.
2. Select your `iei-tvlc-admin-portal` repository.
3. Configure the project:
   * **Framework Preset:** `Other` (or auto-detected Node.js).
   * **Root Directory:** `./`
   * **Build Command:** Leave blank or default.
   * **Output Directory:** Leave blank or default.
4. Add the following **Environment Variables** in the Vercel deployment wizard:

| Variable Name | Example Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables strict production guards |
| `JWT_SECRET` | `a_64_char_random_hex_string_here` | Cryptographic secret for signing tokens |
| `SESSION_SECRET` | `a_32_char_random_session_secret` | Session secret |
| `DATABASE_URL` | `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` | Managed PostgreSQL connection string |
| `SUPABASE_URL` | `https://xyzcompany.supabase.co` | Supabase project endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Supabase service role key (backend only) |
| `SUPABASE_POSTERS_BUCKET` | `iei-tvlc-posters` | Public poster bucket name |
| `SUPABASE_REPORTS_BUCKET` | `iei-tvlc-reports` | Private report bucket name |
| `ADMIN_EMAIL` | `admin@ieitvlc.org` | Initial administrator email |
| `ADMIN_PASSWORD` | `YourStrongAdminPassword!` | Initial administrator password |

5. Click **Deploy**.

---

### Step 7: Verify Production Deployment

Once the Vercel build succeeds:

1. **Verify Health Endpoint:**
   Visit: `https://<your-project>.vercel.app/api/health`
   Ensure the response returns:
   ```json
   {
     "status": "ONLINE",
     "engine": "Managed PostgreSQL",
     "institution": "IEI TVLC",
     "stats": {
       "registeredChapters": 18,
       "eventsLogged": 11
     }
   }
   ```
2. **Verify Security Gate:**
   Open `https://<your-project>.vercel.app/`. Ensure that unauthenticated visitors see only the Login Gateway.
3. **Verify Staff Login:**
   Log in with `example@gmail.com` or `staff@ieitvlc.org`. The Staff Data Entry Terminal loads immediately with standardized drop boxes.
4. **Verify Admin Login:**
   Log in with `admin@ieitvlc.org` and your configured password. The Executive Dashboard loads with 6 KPI cards, Chart.js visualizations, and full CRUD capabilities.
5. **Verify Direct SPA Navigation:**
   Refresh the browser while on any tab or modal. Verify no 404 error is returned.
6. **Verify Report Download Security:**
   Navigate to an event with a report attached. Verify that clicking the report generates an authenticated download link, and that accessing `/api/events/:id/report-download` without a token returns HTTP 401.

---

## 🔒 Production Security Measures

- **No Hardcoded Passwords in Production:** In `NODE_ENV=production`, demonstration passwords are fully disabled; all authentication checks pass through bcrypt password hash verification in PostgreSQL.
- **Magic-Byte Binary Inspection:** File uploads are checked for binary file signatures (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF...WEBP`, PDF `%PDF`, DOCX `PK\x03\x04`, DOC `D0 CF 11 E0`) to prevent extension spoofing and webshell execution.
- **Short-Lived Signed URLs:** Confidential technical reports stored in Supabase Storage are private. Access is mediated through `GET /api/events/:id/report-download`, which generates a time-limited signed URL (default 15 minutes) only for authenticated users.
- **Role-Based Access Control (RBAC):** Every API endpoint is guarded on the server by `authenticateToken` and `requireRole(...)`. JavaScript UI hiding is never used as an authorization gate.
- **IDOR Protections:** Chapter Coordinators can only modify data and submit records for their assigned collegiate chapter. Cross-chapter access is blocked with HTTP 403.
- **Rate Limiting:** Authentication routes are guarded with sliding-window rate limiting (10 attempts / 15 minutes) with `X-RateLimit-*` response headers.
- **Security Headers:** Global headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection`) are applied in both `vercel.json` and Express middleware.

---

## 🛠️ Local Development & Testing

Local development remains 100% functional without cloud credentials:

```bash
# 1. Install dependencies
npm install

# 2. Run the 88-point automated test suite (runs in-memory, no external network needed)
npm test

# 3. Start local development server
npm start
# Portal is accessible at: http://localhost:3000
```
