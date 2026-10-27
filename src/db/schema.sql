-- ====================================================================
-- Institution of Engineers (India) - Tiruvallur Local Centre (IEI TVLC)
-- Production PostgreSQL Database Schema (Neon / Supabase Compatible)
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

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'staff', 'coordinator', 'auditor')),
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

-- 4. Annual Membership Snapshots Table
CREATE TABLE IF NOT EXISTS membership_snapshots (
    id VARCHAR(64) PRIMARY KEY,
    year INTEGER NOT NULL,
    chapter_id VARCHAR(64) NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    student_count INTEGER NULL,
    corporate_count INTEGER NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_snapshot_year_chapter UNIQUE (year, chapter_id)
);

-- 5. Membership Intake (Growth) Table
CREATE TABLE IF NOT EXISTS new_memberships (
    id VARCHAR(64) PRIMARY KEY,
    year INTEGER NOT NULL,
    chapter_id VARCHAR(64) NULL REFERENCES chapters(id) ON DELETE SET NULL,
    institution_name VARCHAR(255) NOT NULL,
    student_new INTEGER DEFAULT 0,
    corporate_new INTEGER DEFAULT 0,
    recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    target VARCHAR(255),
    details TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_events_reporting_year ON events(reporting_year);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_chapter_id ON events(chapter_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_chapters_status ON chapters(status);
CREATE INDEX IF NOT EXISTS idx_snapshots_year ON membership_snapshots(year);
CREATE INDEX IF NOT EXISTS idx_new_memberships_year ON new_memberships(year);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
