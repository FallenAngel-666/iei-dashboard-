/**
 * IEI TVLC Database Migration & Seeding Runner
 * Applies schema and imports official seed data into PostgreSQL (Neon / Supabase).
 */

const fs = require('fs');
const path = require('path');
const { query, withTransaction, testConnection } = require('./pgClient');
const seedData = require('../seedData');

async function runMigration() {
  console.log('=======================================================');
  console.log(' IEI TVLC Database Migration & Schema Initializer');
  console.log('=======================================================');

  if (!process.env.DATABASE_URL) {
    console.error('[Error] DATABASE_URL environment variable is not defined.');
    console.log('Please provide a valid PostgreSQL connection string from Neon or Supabase:');
    console.log('  Example: postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require');
    process.exit(1);
  }

  // 1. Verify Connectivity
  console.log('[1/4] Testing connection to PostgreSQL...');
  const connTest = await testConnection();
  if (!connTest.connected) {
    console.error('[Error] Failed to connect to PostgreSQL:', connTest.error || connTest.reason);
    process.exit(1);
  }
  console.log(`✓ Connected to PostgreSQL database "${connTest.database}" at ${connTest.serverTime}`);

  // 2. Apply Schema
  console.log('\n[2/4] Applying SQL DDL Schema (tables, indexes, constraints)...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  try {
    await query(schemaSql);
    console.log('✓ Database schema created/verified successfully.');
  } catch (err) {
    console.error('[Error] Failed to execute schema.sql:', err.message);
    process.exit(1);
  }

  // 3. Check existing data
  console.log('\n[3/4] Checking existing institutional records...');
  const chCheck = await query('SELECT COUNT(*) AS count FROM chapters');
  const count = parseInt(chCheck.rows[0].count, 10);

  if (count > 0) {
    console.log(`✓ Database already contains ${count} collegiate chapters. Skipping initial seed.`);
  } else {
    console.log('Database is empty. Populating with official IEI TVLC institutional seed data...');

    await withTransaction(async (client) => {
      // 3.1 Insert Chapters
      for (const ch of seedData.seedChapters) {
        await client.query(`
          INSERT INTO chapters (
            id, chapter_name, college_name, college_code, departments,
            student_members_count, corporate_members_count, faculty_advisors,
            established_year, status, contact_email, phone, location, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO NOTHING
        `, [
          ch.id,
          ch.chapterName,
          ch.collegeName,
          ch.collegeCode,
          JSON.stringify(ch.departments || []),
          ch.studentMembersCount !== null ? ch.studentMembersCount : null,
          ch.corporateMembersCount !== null ? ch.corporateMembersCount : null,
          JSON.stringify(ch.facultyAdvisors || []),
          ch.establishedYear,
          ch.status,
          ch.contactEmail,
          ch.phone,
          ch.location,
          ch.updatedAt || new Date().toISOString()
        ]);
      }
      console.log(`  ✓ Inserted ${seedData.seedChapters.length} collegiate chapters (9 known, 9 census pending).`);

      // 3.2 Insert Users
      for (const u of seedData.seedUsers) {
        await client.query(`
          INSERT INTO users (
            id, name, email, password_hash, role, assigned_chapter_id,
            designation, department, is_active, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (email) DO NOTHING
        `, [
          u.id,
          u.name,
          u.email,
          u.passwordHash,
          u.role,
          u.assignedChapterId || null,
          u.designation,
          u.department,
          u.isActive !== false,
          u.createdAt || new Date().toISOString()
        ]);
      }
      console.log(`  ✓ Inserted ${seedData.seedUsers.length} institutional user accounts.`);

      // 3.3 Insert Events
      for (const ev of seedData.seedEvents) {
        await client.query(`
          INSERT INTO events (
            id, event_number, title, category, event_date, event_time,
            chapter_id, college_or_chapter, speaker_name, speaker_designation,
            speaker_org, venue, attendees_count, description, status,
            reporting_year, poster_url, report_url, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          ON CONFLICT (id) DO NOTHING
        `, [
          ev.id,
          ev.eventNumber || null,
          ev.title,
          ev.category,
          ev.eventDate,
          ev.eventTime || '10:00 AM',
          ev.chapterId || null,
          ev.collegeOrChapter,
          ev.speakerName || '',
          ev.speakerDesignation || '',
          ev.speakerOrg || '',
          ev.venue || '',
          ev.attendeesCount !== null ? ev.attendeesCount : null,
          ev.description || '',
          ev.status || 'Completed',
          ev.reportingYear || 2026,
          ev.posterUrl || '',
          ev.reportUrl || '',
          ev.createdAt || new Date().toISOString()
        ]);
      }
      console.log(`  ✓ Inserted ${seedData.seedEvents.length} institutional activities (1,019 participants).`);

      // 3.4 Insert Membership Snapshots
      for (const ms of seedData.seedMembershipSnapshots) {
        await client.query(`
          INSERT INTO membership_snapshots (
            id, year, chapter_id, student_count, corporate_count, recorded_at
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (year, chapter_id) DO NOTHING
        `, [
          ms.id,
          ms.year,
          ms.chapterId,
          ms.studentCount !== null ? ms.studentCount : null,
          ms.corporateCount !== null ? ms.corporateCount : null,
          ms.recordedAt || new Date().toISOString()
        ]);
      }
      console.log(`  ✓ Inserted ${seedData.seedMembershipSnapshots.length} historical membership snapshots.`);

      // 3.5 Insert New Membership Intakes
      for (const nm of seedData.seedNewMemberships) {
        await client.query(`
          INSERT INTO new_memberships (
            id, year, chapter_id, institution_name, student_new, corporate_new,
            recorded_date, recorded_by, notes, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO NOTHING
        `, [
          nm.id,
          nm.year,
          nm.chapterId || null,
          nm.institutionName,
          nm.studentNew || 0,
          nm.corporateNew || 0,
          nm.recordedDate || '2026-09-30',
          nm.recordedBy || 'System Bootstrap',
          nm.notes || '',
          nm.createdAt || new Date().toISOString()
        ]);
      }
      console.log(`  ✓ Inserted ${seedData.seedNewMemberships.length} membership intake growth records (+1,287 gained).`);

      // 3.6 Insert Initial Audit Log
      await client.query(`
        INSERT INTO audit_logs (id, action, performed_by, target, details, timestamp)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [
        'log_init_' + Date.now(),
        'POSTGRESQL_MIGRATION',
        'Migration CLI',
        'Production Database',
        'Applied relational schema and loaded verified institutional seed records.'
      ]);
    });
  }

  // 4. Verification Summary
  console.log('\n[4/4] Verifying database integrity counts...');
  const [vCh, vEv, vNm, vUsr] = await Promise.all([
    query('SELECT COUNT(*) AS count FROM chapters'),
    query('SELECT COUNT(*) AS count FROM events'),
    query('SELECT COUNT(*) AS count FROM new_memberships'),
    query('SELECT COUNT(*) AS count FROM users')
  ]);

  console.log(`  • Chapters Registered:  ${vCh.rows[0].count}`);
  console.log(`  • Events Logged:        ${vEv.rows[0].count}`);
  console.log(`  • Intake Records:       ${vNm.rows[0].count}`);
  console.log(`  • User Accounts:        ${vUsr.rows[0].count}`);
  console.log('=======================================================');
  console.log(' Migration Completed Successfully! ✓');
  console.log('=======================================================');
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Migration Error]:', err);
      process.exit(1);
    });
}

module.exports = { runMigration };
