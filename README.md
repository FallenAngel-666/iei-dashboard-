# MGR IEI Students Chapter — Student Committee & Staff Portal
## Official Institutional Management Platform

> **Collegiate Institution:** Dr. M.G.R. Educational and Research Institute (Deemed to be University), Maduravoyal, Chennai – 600095  
> **Affiliated Professional Body:** The Institution of Engineers (India) — Established 1920 • Incorporated by Royal Charter 1935  
> **Chapter Entity:** MGR IEI Students Chapter (Engineering & Technology)  
> **System Architecture:** Modern Node.js/Express Web Application with Dual-Mode Persistence (Local JSON / Managed PostgreSQL) & Vercel Serverless Ready  

---

## 🏛️ Executive System Overview

The **MGR IEI Students Chapter Portal** is an exclusive, private collegiate governance and operational platform engineered for student committee members and authorized faculty leadership of Dr. M.G.R. Educational and Research Institute.

The platform provides a centralized, authenticated environment for:
1. **Chapter Task Lifecycle Execution:** Multi-stage task tracking (`ASSIGNED` → `IN_PROGRESS` → `SUBMITTED_FOR_REVIEW` → `APPROVED` / `REVISION_REQUESTED`) persisting across weekly reporting cycles.
2. **Weekly Academic Reporting Engine:** Standardized Monday–Sunday reporting cycles adhering to strict Asia/Kolkata deadlines (Monday 11:59 PM IST), featuring faculty Chairman endorsement workflows.
3. **Google Classroom-Style Community Stream:** Real-time collaborative stream for chapter announcements, academic discussions, file attachments, endorsements (likes), and nested inline class comments.
4. **Confidential Direct Messaging:** Direct institutional communication channels between committee coordinators and staff leadership with privacy enforcement.
5. **Collegiate User Administration:** Role-based account enrollment, instant privilege modification, credential recovery, and deactivation controls.
6. **Audit & Compliance Verification:** NAAC A+ and ISO 9001:2015 compliant digital audit trail recording all governance actions.

---

## 🎨 Official Institutional Branding & Visual Identity

The portal adheres to a bespoke Rolls-Royce-inspired design system derived directly from the official institutional seals:
* **The Institution of Engineers (India) Royal Charter Emblem** (`/assets/iei-official-logo.png`)
* **Dr. M.G.R. Educational and Research Institute Chapter Crest** (`/assets/mgr-iei-official-logo.png`)

### Colour Architecture
* **Institutional Navy Blue (`#101B63` / `#102A43`):** Primary brand authority, navigation headings, and drawer surfaces.
* **Royal Blue (`#211E8A` / `#2457A7`):** Primary action buttons, active navigation states, and progress bars.
* **Pure White (`#FFFFFF`):** High-elevation surface cards, modals, and container stages.
* **Pearl White (`#F8FAFC`):** Background canvas and section foundations.
* **Light Blue (`#EAF0FF` / `#EAF2FB`):** Active badge pills, highlighted cards, and soft fills.
* **Steel Blue (`#64748B` / `#627D98`):** Secondary metadata, timestamps, and typography.
* **Silver Grey (`#E2E8F0` / `#D9E2EC`):** Fine borders and dividers.
* **Champagne Gold (`#C5A45D` / `#B99A5B`):** Restrained luxury accents, Chairman endorsement seals, and pinned announcements.
* **Restrained Crimson Red (`#B91C1C`):** High-priority alerts, revision badges, and security notices.

### Typography & Ergonomics Standard
* **Zero Sub-13px Text:** Fully enforced across all interfaces; secondary metadata and badges use 13–14px, general text uses 15–16px, and view titles use 26–32px.
* **Touch Target Compliance:** All interactive buttons, tabs, inputs, and toggles have a minimum touch target height of 44px.
* **Responsive Breakpoints:** Fully optimized for mobile screens (360px, 390px, 480px), tablets (768px), and high-resolution desktop monitors (1024px, 1440px) with an off-canvas drawer navigation.

---

## 👥 The 4 Approved Institutional Roles

Access control is enforced at both the client interface and server-side middleware:

| Role Identifier | Role Title | Core Responsibilities & Privileges |
| :--- | :--- | :--- |
| `admin` | **Admin / Editor** | Full chapter governance: enroll users, modify roles, reset passwords, manage reporting cycle deadlines, audit logs, and chapter settings. |
| `chairman` | **Chairman** | Executive oversight: review submitted weekly reports, endorse reports, approve completed tasks, request task revisions, and publish official announcements. |
| `committee` | **Student Committee Member** | Operational execution: update assigned task progress, submit completed work for review, file weekly reports, participate in community discussions, and direct message leads. |
| `auditor` | **Council Auditor** | Compliance review: inspect activity audit trails, record formal compliance observations, evaluate ISO/NAAC criteria, and verify attendance logs. |

---

## 📂 Core Portal Views & Modules

The application is structured into 9 dedicated views:

1. **Executive Dashboard (`#view-dashboard`):** High-level summary of active tasks, upcoming deadlines, community activity, and event KPIs.
2. **Task Board (`#view-tasks`):** Kanban and list view tracking task milestones through progressive completion stages.
3. **Weekly Reports (`#view-weekly-reports`):** Submissions table, reporting cycle countdown timer, and modal endorsement workflow.
4. **Chapter Community (`#view-community`):** Google Classroom-style feed featuring announcement cards, discussion threads, and inline reply comments.
5. **Private Messaging (`#view-messages`):** Real-time two-pane direct messaging between authenticated collegiate members.
6. **User Administration (`#view-users`):** Admin directory for member enrollment, role assignment, status toggling, and password resets.
7. **Technical Events (`#view-events`):** Scheduling and logging of technical lectures, seminars, industrial visits, and statutory days.
8. **Reporting Settings (`#view-reporting-settings`):** Chairman/Admin configuration panel for cycle deadlines, grace periods, and submission requirements.
9. **Audit Trail (`#view-audit-logs`):** Immutable log ledger tracking all system operations with audit observation recording tools.

---

## 🚀 Local Setup & Development

### Prerequisites
* **Node.js** v18.x or later installed
* **npm** v9.x or later

### Installation Steps

1. Clone or navigate to the project directory:
   ```bash
   cd iei-tvlc-admin-portal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (optional for local testing; default configuration works out-of-the-box):
   ```bash
   cp .env.example .env
   ```

4. Start the local server:
   ```bash
   npm start
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

### Default Seed Credentials

| Role | Email Address | Default Password |
| :--- | :--- | :--- |
| **Admin / Editor** | `admin@mgriei.org` | `MGR_Admin_2026!` |
| **Chairman** | `chairman@mgriei.org` | `MGR_Chairman_2026!` |
| **Committee Member** | `committee@mgriei.org` | `MGR_Committee_2026!` |
| **Auditor** | `auditor@mgriei.org` | `MGR_Auditor_2026!` |

---

## ☁️ Vercel Deployment Guide

The application is architected for zero-configuration serverless deployment on [Vercel](https://vercel.com/) with a managed PostgreSQL database (such as **Neon**, **Supabase**, or **AWS RDS**).

### Architecture Highlights on Vercel
* **Express Serverless Entry Point:** `api/index.js` wraps the full Express application.
* **Dual Storage Strategy:** When `DATABASE_URL` is configured, all data queries use `src/db/pgRepository.js` and PostgreSQL. In offline/ephemeral environments, writable temporary data redirects to `/tmp` to prevent read-only filesystem errors (`EROFS`).
* **Static Assets:** Bundled seamlessly via `vercel.json` (`{public/**,data/**}`).

### Deployment Steps

#### Step 1: Provision a Managed PostgreSQL Database
1. Create a free PostgreSQL instance at [Neon](https://neon.tech/) or [Supabase](https://supabase.com/).
2. Copy the connection string (e.g., `postgresql://username:password@ep-sample-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require`).
3. Run the database migration script to create all relational tables:
   ```bash
   DATABASE_URL="your-connection-string" node src/db/migrate.js
   ```

#### Step 2: Push to GitHub / Git Repository
```bash
git add .
git commit -m "Deploy MGR IEI Students Chapter Portal"
git push origin master
```

#### Step 3: Deploy to Vercel
1. Log into your [Vercel Dashboard](https://vercel.com/) and click **Add New Project**.
2. Import the Git repository.
3. In **Environment Variables**, configure the following keys:
   * `NODE_ENV`: `production`
   * `JWT_SECRET`: `[generate a secure 64-character random string]`
   * `SESSION_SECRET`: `[generate a secure 32-character random string]`
   * `DATABASE_URL`: `[your managed PostgreSQL connection string]`
   * `ADMIN_EMAIL`: `admin@mgriei.org`
   * `ADMIN_PASSWORD`: `[your production super admin password]`
4. Click **Deploy**. Vercel will build and publish your serverless application.

---

## 🧪 Automated Verification Test Suite

The repository includes a comprehensive automated verification test suite covering authentication gates, the 4 strict roles, task progression, weekly reports, community discussions, direct messages, user enrollment, duplicate rejection, and audit trails.

To run the verification suite:
```bash
node test/mgr-portal-verification-suite.js
```

**Expected Result:**
```
============================================================
TOTAL VERIFICATION TESTS: 31
PASSED: 31
FAILED: 0
SUCCESS RATE: 100.0%
============================================================
```

---

## 🔒 Security Best Practices

* **Password Hashing:** All user passwords are encrypted using `bcryptjs` with 10 salt rounds.
* **Authentication Gate:** The application renders a strict gatekeeper before exposing any dashboard views. Non-authenticated API calls receive `401 Unauthorized`.
* **Privilege Guard:** Role alteration and member enrollment are restricted exclusively to `admin` sessions (`auth.requireRole(['admin'])`).
* **Security Headers:** All responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, and strict CORS policies.
* **Data Sanitization:** All incoming text is sanitized to prevent stored XSS attacks in classroom stream comments and message threads.
#   i e i - d a s h b o a r d -  
 #   i e i - d a s h b o a r d -  
 #   i e i - d a s h b o a r d -  
 #   i e i - d a s h b o a r d -  
 