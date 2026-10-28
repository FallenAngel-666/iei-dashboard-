-- ====================================================================
-- MGR IEI Students Chapter — Management & Governance Platform
-- Production PostgreSQL Database Schema (Neon / Supabase Compatible)
-- Dr. M.G.R. Educational and Research Institute
-- ====================================================================

-- 1. Student Chapters Table
CREATE TABLE IF NOT EXISTS chapters (
    id VARCHAR(64) PRIMARY KEY,
    chapter_name VARCHAR(255) NOT NULL,
    college_name VARCHAR(255) NOT NULL,
    college_code VARCHAR(50),
    departments JSONB DEFAULT '[]'::jsonb,
    student_members_count INTEGER NULL,
    corporate_members_count INTEGER NULL,
    faculty_advisors JSONB DEFAULT '[]'::jsonb,
    established_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    status VARCHAR(50) DEFAULT 'Active',
    contact_email VARCHAR(255),
    phone VARCHAR(50),
    location VARCHAR(255),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Users Table (Strict 4 Roles: admin, chairman, committee, auditor)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'chairman', 'committee', 'auditor')),
    assigned_chapter_id VARCHAR(64) NULL REFERENCES chapters(id) ON DELETE SET NULL,
    designation VARCHAR(255),
    department VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Events Registry Table
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(64) PRIMARY KEY,
    event_number INTEGER NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    event_date DATE NOT NULL,
    event_time VARCHAR(50) DEFAULT '10:00 AM',
    chapter_id VARCHAR(64) NULL REFERENCES chapters(id) ON DELETE SET NULL,
    college_or_chapter VARCHAR(255),
    speaker_name VARCHAR(255),
    speaker_designation VARCHAR(255),
    speaker_org VARCHAR(255),
    venue VARCHAR(255),
    attendees_count INTEGER NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Completed',
    reporting_year INTEGER NOT NULL,
    poster_url TEXT DEFAULT '',
    report_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Persistent Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to VARCHAR(64) NOT NULL,
    assigned_to_name VARCHAR(255) NOT NULL,
    creator_id VARCHAR(64) NULL,
    creator_name VARCHAR(255) NULL,
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(50) DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED_FOR_REVIEW', 'APPROVED', 'REVISION_REQUESTED', 'CANCELLED')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    due_date DATE NOT NULL,
    department VARCHAR(255) DEFAULT 'Technical',
    review_comments TEXT DEFAULT '',
    history JSONB DEFAULT '[]'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Weekly Activity Reports Table (Asia/Kolkata Cycle)
CREATE TABLE IF NOT EXISTS weekly_reports (
    id VARCHAR(64) PRIMARY KEY,
    week_number INTEGER NOT NULL,
    period VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    total_events INTEGER DEFAULT 0,
    student_hours NUMERIC(6, 2) DEFAULT 0,
    attendees_count INTEGER DEFAULT 0,
    summary TEXT NOT NULL,
    roadblocks TEXT DEFAULT '',
    next_steps TEXT NOT NULL,
    submitted_by VARCHAR(255) NOT NULL,
    submitted_by_role VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'UNDER_REVIEW' CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'RESUBMITTED', 'APPROVED', 'LOCKED', 'LATE')),
    review_comments TEXT DEFAULT '',
    endorsed_by VARCHAR(255) NULL,
    endorsed_at TIMESTAMPTZ NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Google Classroom-Style Shared Community Posts Table
CREATE TABLE IF NOT EXISTS community_posts (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'discussion' CHECK (type IN ('announcement', 'discussion', 'resource')),
    category VARCHAR(100) DEFAULT 'General Discussion',
    tags JSONB DEFAULT '[]'::jsonb,
    is_pinned BOOLEAN DEFAULT FALSE,
    author VARCHAR(255) NOT NULL,
    author_id VARCHAR(64) NULL,
    role VARCHAR(50) NOT NULL,
    likes INTEGER DEFAULT 0,
    replies JSONB DEFAULT '[]'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Secure Private Messaging Table
CREATE TABLE IF NOT EXISTS private_messages (
    id VARCHAR(64) PRIMARY KEY,
    sender_id VARCHAR(64) NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    sender_role VARCHAR(50) NOT NULL,
    recipient_id VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Reporting Cycle Settings Table (Admin Only)
CREATE TABLE IF NOT EXISTS reporting_settings (
    id VARCHAR(64) PRIMARY KEY,
    active_week INTEGER DEFAULT 45,
    period VARCHAR(255) DEFAULT 'Cycle 45',
    deadline_day VARCHAR(50) DEFAULT 'Monday',
    deadline_time VARCHAR(50) DEFAULT '23:59:59',
    timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
    last_updated_by VARCHAR(255),
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Audit Observations Table (Auditor & Admin)
CREATE TABLE IF NOT EXISTS audit_observations (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    observation TEXT NOT NULL,
    compliance_status VARCHAR(50) DEFAULT 'COMPLIANT' CHECK (compliance_status IN ('COMPLIANT', 'OBSERVATION', 'CRITICAL')),
    auditor_name VARCHAR(255) NOT NULL,
    author_role VARCHAR(50) DEFAULT 'auditor',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Audit Logs Table (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    target VARCHAR(255),
    details TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week ON weekly_reports(week_number);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_status ON weekly_reports(status);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_pinned ON community_posts(is_pinned DESC);
CREATE INDEX IF NOT EXISTS idx_private_messages_participants ON private_messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
