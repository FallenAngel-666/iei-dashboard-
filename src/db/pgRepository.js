/**
 * MGR IEI Students Chapter PostgreSQL Repository
 * Enterprise-grade parameterized queries for PostgreSQL (Neon / Supabase).
 */

const { query, withTransaction } = require('./pgClient');
const config = require('../config');

function mapChapterFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    chapterName: row.chapter_name,
    collegeName: row.college_name,
    collegeCode: row.college_code,
    departments: typeof row.departments === 'string' ? JSON.parse(row.departments) : (row.departments || []),
    studentMembersCount: row.student_members_count !== null && row.student_members_count !== undefined ? Number(row.student_members_count) : null,
    corporateMembersCount: row.corporate_members_count !== null && row.corporate_members_count !== undefined ? Number(row.corporate_members_count) : null,
    facultyAdvisors: typeof row.faculty_advisors === 'string' ? JSON.parse(row.faculty_advisors) : (row.faculty_advisors || []),
    establishedYear: row.established_year ? Number(row.established_year) : 2024,
    status: row.status,
    contactEmail: row.contact_email || '',
    phone: row.phone || '',
    location: row.location || '',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

function mapEventFromDb(row) {
  if (!row) return null;
  let formattedDate = '';
  if (row.event_date instanceof Date) {
    formattedDate = row.event_date.toISOString().split('T')[0];
  } else if (row.event_date) {
    formattedDate = String(row.event_date).split('T')[0];
  }

  return {
    id: row.id,
    eventNumber: row.event_number !== null && row.event_number !== undefined ? Number(row.event_number) : null,
    title: row.title,
    category: row.category,
    eventDate: formattedDate,
    eventTime: row.event_time || '10:00 AM',
    chapterId: row.chapter_id || null,
    collegeOrChapter: row.college_or_chapter || '',
    speakerName: row.speaker_name || '',
    speakerDesignation: row.speaker_designation || '',
    speakerOrg: row.speaker_org || '',
    venue: row.venue || '',
    attendeesCount: row.attendees_count !== null && row.attendees_count !== undefined ? Number(row.attendees_count) : null,
    description: row.description || '',
    status: row.status || 'Completed',
    reportingYear: Number(row.reporting_year),
    posterUrl: row.poster_url || '',
    reportUrl: row.report_url || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

function mapUserFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    assignedChapterId: row.assigned_chapter_id || null,
    designation: row.designation || '',
    department: row.department || '',
    isActive: row.is_active !== false,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

async function getChapters(filters = {}) {
  let queryStr = 'SELECT * FROM chapters';
  const conditions = [];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    conditions.push(`(LOWER(chapter_name) LIKE $${params.length} OR LOWER(college_name) LIKE $${params.length} OR LOWER(college_code) LIKE $${params.length} OR departments::text ILIKE $${params.length} OR faculty_advisors::text ILIKE $${params.length})`);
  }

  if (filters.status && filters.status !== 'All') {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  if (conditions.length > 0) {
    queryStr += ' WHERE ' + conditions.join(' AND ');
  }

  queryStr += ' ORDER BY established_year ASC, college_name ASC';
  const res = await query(queryStr, params);
  return res.rows.map(mapChapterFromDb);
}

async function getChapterById(id) {
  const res = await query('SELECT * FROM chapters WHERE id = $1', [id]);
  return res.rows.length > 0 ? mapChapterFromDb(res.rows[0]) : null;
}

async function createChapter(data, user) {
  const code = (data.collegeCode || 'inst').toLowerCase().replace(/[^a-z0-9]/g, '');
  const id = data.id || `ch_${code}_${Math.random().toString(36).substring(2, 6)}`;

  const departments = Array.isArray(data.departments) 
    ? data.departments 
    : (data.departments ? String(data.departments).split(',').map(s => s.trim()).filter(Boolean) : []);

  const facultyAdvisors = Array.isArray(data.facultyAdvisors) 
    ? data.facultyAdvisors 
    : (data.facultyAdvisors ? String(data.facultyAdvisors).split(',').map(s => s.trim()).filter(Boolean) : []);

  const studentCount = data.studentMembersCount !== undefined && data.studentMembersCount !== null && data.studentMembersCount !== '' 
    ? Number(data.studentMembersCount) 
    : null;

  const corporateCount = data.corporateMembersCount !== undefined && data.corporateMembersCount !== null && data.corporateMembersCount !== '' 
    ? Number(data.corporateMembersCount) 
    : null;

  const res = await query(`
    INSERT INTO chapters (
      id, chapter_name, college_name, college_code, departments,
      student_members_count, corporate_members_count, faculty_advisors,
      established_year, status, contact_email, phone, location, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
    RETURNING *
  `, [
    id,
    data.chapterName.trim(),
    data.collegeName.trim(),
    (data.collegeCode || '').trim().toUpperCase(),
    JSON.stringify(departments),
    studentCount,
    corporateCount,
    JSON.stringify(facultyAdvisors),
    Number(data.establishedYear) || new Date().getFullYear(),
    data.status || 'Active',
    (data.contactEmail || '').trim(),
    (data.phone || '').trim(),
    (data.location || '').trim()
  ]);

  await logAction('CREATE_CHAPTER', user, data.chapterName, `Added new student chapter with ID ${id}`);
  return mapChapterFromDb(res.rows[0]);
}

async function updateChapter(id, data, user) {
  const existing = await getChapterById(id);
  if (!existing) return null;

  const departments = data.departments !== undefined
    ? (Array.isArray(data.departments) ? data.departments : String(data.departments).split(',').map(s => s.trim()).filter(Boolean))
    : existing.departments;

  const facultyAdvisors = data.facultyAdvisors !== undefined
    ? (Array.isArray(data.facultyAdvisors) ? data.facultyAdvisors : String(data.facultyAdvisors).split(',').map(s => s.trim()).filter(Boolean))
    : existing.facultyAdvisors;

  const studentCount = data.studentMembersCount !== undefined
    ? (data.studentMembersCount === null || data.studentMembersCount === '' ? null : Number(data.studentMembersCount))
    : existing.studentMembersCount;

  const corporateCount = data.corporateMembersCount !== undefined
    ? (data.corporateMembersCount === null || data.corporateMembersCount === '' ? null : Number(data.corporateMembersCount))
    : existing.corporateMembersCount;

  const res = await query(`
    UPDATE chapters SET
      chapter_name = $1,
      college_name = $2,
      college_code = $3,
      departments = $4,
      student_members_count = $5,
      corporate_members_count = $6,
      faculty_advisors = $7,
      established_year = $8,
      status = $9,
      contact_email = $10,
      phone = $11,
      location = $12,
      updated_at = NOW()
    WHERE id = $13
    RETURNING *
  `, [
    data.chapterName !== undefined ? data.chapterName.trim() : existing.chapterName,
    data.collegeName !== undefined ? data.collegeName.trim() : existing.collegeName,
    data.collegeCode !== undefined ? data.collegeCode.trim().toUpperCase() : existing.collegeCode,
    JSON.stringify(departments),
    studentCount,
    corporateCount,
    JSON.stringify(facultyAdvisors),
    data.establishedYear !== undefined ? Number(data.establishedYear) : existing.establishedYear,
    data.status !== undefined ? data.status : existing.status,
    data.contactEmail !== undefined ? data.contactEmail.trim() : existing.contactEmail,
    data.phone !== undefined ? data.phone.trim() : existing.phone,
    data.location !== undefined ? data.location.trim() : existing.location,
    id
  ]);

  // Update or insert current year snapshot
  const currentYear = new Date().getFullYear();
  if (studentCount !== null || corporateCount !== null) {
    const snapId = `ms_${currentYear}_${id}`;
    await query(`
      INSERT INTO membership_snapshots (id, year, chapter_id, student_count, corporate_count, recorded_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (year, chapter_id) DO UPDATE SET
        student_count = EXCLUDED.student_count,
        corporate_count = EXCLUDED.corporate_count,
        recorded_at = NOW()
    `, [snapId, currentYear, id, studentCount, corporateCount]);
  }

  await logAction('UPDATE_CHAPTER', user, res.rows[0].chapter_name, `Updated student chapter details for ${id}`);
  return mapChapterFromDb(res.rows[0]);
}

async function deleteChapter(id, user) {
  const existing = await getChapterById(id);
  if (!existing) return false;

  await query('DELETE FROM chapters WHERE id = $1', [id]);
  await logAction('DELETE_CHAPTER', user, existing.chapterName, `Deleted student chapter ID ${id}`);
  return true;
}

// ---------------- Events Methods ----------------

async function getEvents(filters = {}) {
  let queryStr = 'SELECT * FROM events';
  const conditions = [];
  const params = [];

  if (filters.category && filters.category !== 'All') {
    params.push(filters.category);
    conditions.push(`category = $${params.length}`);
  }

  if (filters.status && filters.status !== 'All') {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  if (filters.year && filters.year !== 'All') {
    params.push(Number(filters.year));
    conditions.push(`reporting_year = $${params.length}`);
  }

  if (filters.chapterId && filters.chapterId !== 'All') {
    params.push(filters.chapterId);
    conditions.push(`chapter_id = $${params.length}`);
  }

  if (filters.month && filters.month !== 'All') {
    params.push(Number(filters.month));
    conditions.push(`EXTRACT(MONTH FROM event_date) = $${params.length}`);
  }

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    conditions.push(`(LOWER(title) LIKE $${params.length} OR LOWER(speaker_name) LIKE $${params.length} OR LOWER(venue) LIKE $${params.length} OR LOWER(college_or_chapter) LIKE $${params.length})`);
  }

  if (conditions.length > 0) {
    queryStr += ' WHERE ' + conditions.join(' AND ');
  }

  queryStr += ' ORDER BY event_date ASC, event_number ASC NULLS LAST';
  const res = await query(queryStr, params);
  return res.rows.map(mapEventFromDb);
}

async function getEventById(id) {
  const res = await query('SELECT * FROM events WHERE id = $1', [id]);
  return res.rows.length > 0 ? mapEventFromDb(res.rows[0]) : null;
}

async function createEvent(data, user) {
  const id = data.id || `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const eventDate = data.eventDate || new Date().toISOString().split('T')[0];
  const reportingYear = data.reportingYear ? Number(data.reportingYear) : new Date(eventDate).getFullYear();
  const attendees = data.attendeesCount !== undefined && data.attendeesCount !== null && data.attendeesCount !== '' 
    ? Number(data.attendeesCount) 
    : null;

  const res = await query(`
    INSERT INTO events (
      id, event_number, title, category, event_date, event_time,
      chapter_id, college_or_chapter, speaker_name, speaker_designation,
      speaker_org, venue, attendees_count, description, status,
      reporting_year, poster_url, report_url, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
    RETURNING *
  `, [
    id,
    data.eventNumber ? Number(data.eventNumber) : null,
    data.title.trim(),
    data.category,
    eventDate,
    data.eventTime ? data.eventTime.trim() : '10:00 AM',
    data.chapterId || null,
    data.collegeOrChapter ? data.collegeOrChapter.trim() : '',
    data.speakerName ? data.speakerName.trim() : '',
    data.speakerDesignation ? data.speakerDesignation.trim() : '',
    data.speakerOrg ? data.speakerOrg.trim() : '',
    data.venue ? data.venue.trim() : '',
    attendees,
    data.description ? data.description.trim() : '',
    data.status || 'Upcoming',
    reportingYear,
    data.posterUrl || '',
    data.reportUrl || ''
  ]);

  await logAction('CREATE_EVENT', user, data.title, `Scheduled event under ${data.category} (${eventDate})`);
  return mapEventFromDb(res.rows[0]);
}

async function updateEvent(id, data, user) {
  const existing = await getEventById(id);
  if (!existing) return null;

  const eventDate = data.eventDate !== undefined ? data.eventDate : existing.eventDate;
  const reportingYear = data.reportingYear !== undefined 
    ? Number(data.reportingYear) 
    : (eventDate ? new Date(eventDate).getFullYear() : existing.reportingYear);

  const attendees = data.attendeesCount !== undefined
    ? (data.attendeesCount === null || data.attendeesCount === '' ? null : Number(data.attendeesCount))
    : existing.attendeesCount;

  const res = await query(`
    UPDATE events SET
      title = $1,
      category = $2,
      event_date = $3,
      event_time = $4,
      chapter_id = $5,
      college_or_chapter = $6,
      speaker_name = $7,
      speaker_designation = $8,
      speaker_org = $9,
      venue = $10,
      attendees_count = $11,
      description = $12,
      status = $13,
      reporting_year = $14,
      poster_url = $15,
      report_url = $16,
      updated_at = NOW()
    WHERE id = $17
    RETURNING *
  `, [
    data.title !== undefined ? data.title.trim() : existing.title,
    data.category !== undefined ? data.category : existing.category,
    eventDate,
    data.eventTime !== undefined ? data.eventTime.trim() : existing.eventTime,
    data.chapterId !== undefined ? data.chapterId : existing.chapterId,
    data.collegeOrChapter !== undefined ? data.collegeOrChapter.trim() : existing.collegeOrChapter,
    data.speakerName !== undefined ? data.speakerName.trim() : existing.speakerName,
    data.speakerDesignation !== undefined ? data.speakerDesignation.trim() : existing.speakerDesignation,
    data.speakerOrg !== undefined ? data.speakerOrg.trim() : existing.speakerOrg,
    data.venue !== undefined ? data.venue.trim() : existing.venue,
    attendees,
    data.description !== undefined ? data.description.trim() : existing.description,
    data.status !== undefined ? data.status : existing.status,
    reportingYear,
    data.posterUrl !== undefined ? data.posterUrl : existing.posterUrl,
    data.reportUrl !== undefined ? data.reportUrl : existing.reportUrl,
    id
  ]);

  await logAction('UPDATE_EVENT', user, res.rows[0].title, `Updated event records for ID ${id}`);
  return mapEventFromDb(res.rows[0]);
}

async function deleteEvent(id, user) {
  const existing = await getEventById(id);
  if (!existing) return false;

  await query('DELETE FROM events WHERE id = $1', [id]);
  await logAction('DELETE_EVENT', user, existing.title, `Deleted event ID ${id}`);
  return true;
}

// ---------------- Snapshots & Intake ----------------

async function getMembershipSnapshots(filters = {}) {
  let queryStr = 'SELECT * FROM membership_snapshots';
  const conditions = [];
  const params = [];

  if (filters.year && filters.year !== 'All') {
    params.push(Number(filters.year));
    conditions.push(`year = $${params.length}`);
  }
  if (filters.chapterId && filters.chapterId !== 'All') {
    params.push(filters.chapterId);
    conditions.push(`chapter_id = $${params.length}`);
  }

  if (conditions.length > 0) {
    queryStr += ' WHERE ' + conditions.join(' AND ');
  }
  queryStr += ' ORDER BY year ASC';

  const res = await query(queryStr, params);
  return res.rows.map(r => ({
    id: r.id,
    year: Number(r.year),
    chapterId: r.chapter_id,
    studentCount: r.student_count !== null ? Number(r.student_count) : null,
    corporateCount: r.corporate_count !== null ? Number(r.corporate_count) : null,
    recordedAt: r.recorded_at ? new Date(r.recorded_at).toISOString() : new Date().toISOString()
  }));
}

async function getNewMemberships(filters = {}) {
  let queryStr = 'SELECT * FROM new_memberships';
  const conditions = [];
  const params = [];

  if (filters.year && filters.year !== 'All') {
    params.push(Number(filters.year));
    conditions.push(`year = $${params.length}`);
  }
  if (filters.chapterId && filters.chapterId !== 'All') {
    params.push(filters.chapterId);
    conditions.push(`chapter_id = $${params.length}`);
  }

  if (conditions.length > 0) {
    queryStr += ' WHERE ' + conditions.join(' AND ');
  }
  queryStr += ' ORDER BY recorded_date ASC';

  const res = await query(queryStr, params);
  return res.rows.map(r => ({
    id: r.id,
    year: Number(r.year),
    chapterId: r.chapter_id || null,
    institutionName: r.institution_name,
    studentNew: Number(r.student_new || 0),
    corporateNew: Number(r.corporate_new || 0),
    recordedDate: r.recorded_date instanceof Date ? r.recorded_date.toISOString().split('T')[0] : String(r.recorded_date).split('T')[0],
    recordedBy: r.recorded_by || '',
    notes: r.notes || '',
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
  }));
}

async function recordAnnualSnapshot(year, chapterId, studentCount, corporateCount, user) {
  const snapId = `ms_${year}_${chapterId}`;
  const sCount = studentCount !== null && studentCount !== '' && studentCount !== undefined ? Number(studentCount) : null;
  const cCount = corporateCount !== null && corporateCount !== '' && corporateCount !== undefined ? Number(corporateCount) : null;

  const res = await query(`
    INSERT INTO membership_snapshots (id, year, chapter_id, student_count, corporate_count, recorded_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (year, chapter_id) DO UPDATE SET
      student_count = EXCLUDED.student_count,
      corporate_count = EXCLUDED.corporate_count,
      recorded_at = NOW()
    RETURNING *
  `, [snapId, Number(year), chapterId, sCount, cCount]);

  await logAction('RECORD_SNAPSHOT', user, chapterId, `Recorded census for year ${year}: Students=${sCount}, Corporate=${cCount}`);
  return {
    id: res.rows[0].id,
    year: Number(res.rows[0].year),
    chapterId: res.rows[0].chapter_id,
    studentCount: res.rows[0].student_count !== null ? Number(res.rows[0].student_count) : null,
    corporateCount: res.rows[0].corporate_count !== null ? Number(res.rows[0].corporate_count) : null,
    recordedAt: res.rows[0].recorded_at
  };
}

async function recordNewMembership(year, chapterId, studentNew, corporateNew, user, institutionName) {
  const id = `nm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  let finalInstName = institutionName;

  if (!finalInstName && chapterId) {
    const ch = await getChapterById(chapterId);
    if (ch) finalInstName = ch.collegeName;
  }
  finalInstName = finalInstName || 'Collegiate Institution';

  const res = await query(`
    INSERT INTO new_memberships (
      id, year, chapter_id, institution_name, student_new, corporate_new,
      recorded_date, recorded_by, notes, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, $8, NOW())
    RETURNING *
  `, [
    id,
    Number(year),
    chapterId || null,
    finalInstName,
    Number(studentNew) || 0,
    Number(corporateNew) || 0,
    user ? user.name : 'Staff Officer',
    `Logged intake for session ${year}`
  ]);

  await logAction('RECORD_INTAKE', user, finalInstName, `Recorded new intake: +${studentNew} students, +${corporateNew} corporate`);
  return {
    id: res.rows[0].id,
    year: Number(res.rows[0].year),
    chapterId: res.rows[0].chapter_id,
    institutionName: res.rows[0].institution_name,
    studentNew: Number(res.rows[0].student_new),
    corporateNew: Number(res.rows[0].corporate_new),
    recordedDate: res.rows[0].recorded_date instanceof Date ? res.rows[0].recorded_date.toISOString().split('T')[0] : String(res.rows[0].recorded_date),
    recordedBy: res.rows[0].recorded_by,
    notes: res.rows[0].notes,
    createdAt: res.rows[0].created_at
  };
}

// ---------------- Users & Audit ----------------

async function getUsers() {
  const res = await query('SELECT * FROM users ORDER BY name ASC');
  return res.rows.map(mapUserFromDb);
}

async function getUserByEmail(identifier) {
  if (!identifier) return null;
  const q = String(identifier).trim();
  const digits = q.replace(/\D/g, '');
  const res = await query(
    `SELECT * FROM users 
     WHERE LOWER(email) = LOWER($1) 
        OR (credential_id IS NOT NULL AND LOWER(credential_id) = LOWER($1))
        OR (phone IS NOT NULL AND $2 != '' AND REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = $2)
     LIMIT 1`,
    [q, digits.length >= 10 ? digits : '']
  );
  return res.rows.length > 0 ? mapUserFromDb(res.rows[0]) : null;
}

async function getUserById(id) {
  if (!id) return null;
  const res = await query('SELECT * FROM users WHERE id = $1', [id]);
  return res.rows.length > 0 ? mapUserFromDb(res.rows[0]) : null;
}

async function getAuditLogs(limit = 100) {
  const res = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1', [limit]);
  return res.rows.map(r => ({
    id: r.id,
    action: r.action,
    performedBy: r.performed_by,
    target: r.target || '',
    details: r.details || '',
    timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString()
  }));
}

async function logAction(action, user, target, details) {
  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const performedBy = user ? `${user.name} (${user.role || 'user'})` : 'System';

  try {
    await query(`
      INSERT INTO audit_logs (id, action, performed_by, target, details, timestamp)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [id, action, performedBy, target || '', details || '']);
  } catch (err) {
    console.error('[Audit Log Error]: Failed to write log to PostgreSQL:', err.message);
  }
}

// ---------------- Analytics Overview ----------------

async function getAnalyticsOverview(targetYear = '2026') {
  const [chapters, events, snapshots, newMemberships] = await Promise.all([
    getChapters(),
    getEvents(),
    getMembershipSnapshots(),
    getNewMemberships()
  ]);

  // Aggregate using institutional calculations matching our verified formulas
  const totalChapters = chapters.length;
  let totalStudentMembers = 0;
  let unknownStudentChapters = 0;
  let totalCorporateMembers = 0;
  let unknownCorporateChapters = 0;

  chapters.forEach(ch => {
    if (ch.studentMembersCount !== null && ch.studentMembersCount !== undefined) {
      totalStudentMembers += Number(ch.studentMembersCount);
    } else {
      unknownStudentChapters++;
    }

    if (ch.corporateMembersCount !== null && ch.corporateMembersCount !== undefined) {
      totalCorporateMembers += Number(ch.corporateMembersCount);
    } else {
      unknownCorporateChapters++;
    }
  });

  const totalEventsConducted = events.length;

  let filteredEvents = events;
  if (targetYear !== 'All') {
    filteredEvents = events.filter(e => e.reportingYear === Number(targetYear));
  }
  const totalEventsInYear = filteredEvents.length;

  const totalParticipantsInYear = filteredEvents.reduce((acc, ev) => acc + (ev.attendeesCount || 0), 0);

  let newMembersInYear = newMemberships;
  if (targetYear !== 'All') {
    newMembersInYear = newMemberships.filter(nm => nm.year === Number(targetYear));
  }
  const newStudentMembersInYear = newMembersInYear.reduce((acc, nm) => acc + (nm.studentNew || 0), 0);
  const newCorporateMembersInYear = newMembersInYear.reduce((acc, nm) => acc + (nm.corporateNew || 0), 0);
  const totalNewMembersInYear = newStudentMembersInYear + newCorporateMembersInYear;

  const categoryCounts = {
    technicalLecture: filteredEvents.filter(e => e.category === 'Technical Lecture').length,
    statutoryDay: filteredEvents.filter(e => e.category === 'Statutory Day').length,
    workshop: filteredEvents.filter(e => e.category === 'Workshop' || e.category === 'Workshop/Seminar').length,
    seminar: filteredEvents.filter(e => e.category === 'Seminar' || e.category === 'Seminar / Conference').length,
    competition: filteredEvents.filter(e => e.category === 'Competition' || e.category === 'Competition / Hackathon').length,
    other: filteredEvents.filter(e => !['Technical Lecture', 'Statutory Day', 'Workshop', 'Workshop/Seminar', 'Seminar', 'Seminar / Conference', 'Competition', 'Competition / Hackathon'].includes(e.category)).length
  };

  const statusCounts = {
    completed: filteredEvents.filter(e => e.status === 'Completed').length,
    upcoming: filteredEvents.filter(e => e.status === 'Upcoming').length,
    cancelled: filteredEvents.filter(e => e.status === 'Cancelled').length
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyEventTrends = months.map((m, idx) => {
    const monthNum = idx + 1;
    const count = filteredEvents.filter(e => {
      if (!e.eventDate) return false;
      const d = new Date(e.eventDate);
      return (d.getMonth() + 1) === monthNum;
    }).length;
    return { month: m, monthNum, eventsCount: count };
  });

  const yearsAvailable = [...new Set(events.map(e => e.reportingYear))].sort((a, b) => a - b);
  const annualEventComparisons = yearsAvailable.map(yr => {
    const evInYr = events.filter(e => e.reportingYear === yr);
    return {
      year: yr,
      totalEvents: evInYr.length,
      technicalLectures: evInYr.filter(e => e.category === 'Technical Lecture').length,
      statutoryDays: evInYr.filter(e => e.category === 'Statutory Day').length,
      otherEvents: evInYr.filter(e => e.category !== 'Technical Lecture' && e.category !== 'Statutory Day').length
    };
  });

  const snapshotYears = [...new Set(snapshots.map(s => s.year))].sort((a, b) => a - b);
  const annualMembershipTrends = snapshotYears.map((yr, idx) => {
    const inYearSnaps = snapshots.filter(s => s.year === yr);
    const knownStudentSnaps = inYearSnaps.filter(s => s.studentCount !== null && s.studentCount !== undefined);
    const knownCorpSnaps = inYearSnaps.filter(s => s.corporateCount !== null && s.corporateCount !== undefined);

    const yearStudents = knownStudentSnaps.reduce((acc, s) => acc + s.studentCount, 0);
    const yearCorp = knownCorpSnaps.reduce((acc, s) => acc + s.corporateCount, 0);

    let studentGrowthRate = null;
    let corporateGrowthRate = null;

    if (idx > 0) {
      const prevYr = snapshotYears[idx - 1];
      const prevSnaps = snapshots.filter(s => s.year === prevYr);
      const prevStudents = prevSnaps.filter(s => s.studentCount !== null).reduce((acc, s) => acc + s.studentCount, 0);
      const prevCorp = prevSnaps.filter(s => s.corporateCount !== null).reduce((acc, s) => acc + s.corporateCount, 0);

      if (prevStudents > 0) {
        studentGrowthRate = parseFloat((((yearStudents - prevStudents) / prevStudents) * 100).toFixed(2));
      }
      if (prevCorp > 0) {
        corporateGrowthRate = parseFloat((((yearCorp - prevCorp) / prevCorp) * 100).toFixed(2));
      }
    }

    return {
      year: yr,
      studentMembers: yearStudents,
      studentGrowthRate,
      corporateMembers: yearCorp,
      corporateGrowthRate,
      reportingChaptersCount: inYearSnaps.length,
      totalKnownMembers: yearStudents + yearCorp,
      note: idx === 0 ? 'Baseline census year' : null
    };
  });

  const chapterWiseMembership = chapters
    .filter(ch => ch.studentMembersCount !== null && ch.studentMembersCount !== undefined)
    .sort((a, b) => (b.studentMembersCount || 0) - (a.studentMembersCount || 0))
    .map(ch => ({
      chapterId: ch.id,
      chapterName: ch.chapterName,
      collegeName: ch.collegeName,
      collegeCode: ch.collegeCode || ch.chapterName,
      studentMembers: ch.studentMembersCount || 0,
      corporateMembers: ch.corporateMembersCount || 0
    }));

  const chapterEventCounts = {};
  filteredEvents.forEach(e => {
    const key = e.collegeOrChapter || 'MGR IEI Secretariat';
    chapterEventCounts[key] = (chapterEventCounts[key] || 0) + 1;
  });

  return {
    selectedYear: targetYear,
    kpis: {
      totalStudentMembers,
      unknownStudentChaptersCount: unknownStudentChapters,
      totalCorporateMembers,
      unknownCorporateChaptersCount: unknownCorporateChapters,
      totalEventsConducted,
      eventsInSelectedYear: totalEventsInYear,
      totalParticipantsInYear,
      newMembersInSelectedYear: totalNewMembersInYear,
      newStudentMembersInSelectedYear: newStudentMembersInYear,
      newCorporateMembersInSelectedYear: newCorporateMembersInYear,
      totalRegisteredChapters: totalChapters,
      activeChaptersCount: chapters.filter(c => c.status === 'Active').length
    },
    officialReportSummary: {
      statutoryDays: categoryCounts.statutoryDay,
      technicalLectures: categoryCounts.technicalLecture,
      workshops: categoryCounts.workshop,
      totalActivities: totalEventsInYear,
      totalParticipants: totalParticipantsInYear,
      studentMembersGainedTotal: newStudentMembersInYear,
      studentMembersGainedList: newMembersInYear.map(nm => ({
        institutionName: nm.institutionName || (chapters.find(c => c.id === nm.chapterId)?.collegeName) || nm.chapterId,
        studentGained: nm.studentNew,
        corporateGained: nm.corporateNew,
        recordedDate: nm.recordedDate
      }))
    },
    annualMembershipTrends,
    monthlyEventTrends,
    annualEventComparisons,
    chapterWiseMembership,
    categoryCounts,
    statusCounts,
    chapterEventCounts,
    institution: config.INSTITUTION
  };
}


// ====================================================================
// TASKS REPOSITORY (POSTGRESQL)
// ====================================================================

function mapTaskFromDb(r) {
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    assignedTo: r.assigned_to,
    assignedToName: r.assigned_to_name,
    creatorId: r.creator_id || null,
    creatorName: r.creator_name || null,
    priority: r.priority || 'medium',
    status: r.status || 'ASSIGNED',
    progress: Number(r.progress) || 0,
    dueDate: r.due_date instanceof Date ? r.due_date.toISOString().split('T')[0] : String(r.due_date).split('T')[0],
    department: r.department || 'Technical',
    reviewComments: r.review_comments || '',
    history: Array.isArray(r.history) ? r.history : (typeof r.history === 'string' ? JSON.parse(r.history || '[]') : []),
    attachments: Array.isArray(r.attachments) ? r.attachments : (typeof r.attachments === 'string' ? JSON.parse(r.attachments || '[]') : []),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
  };
}

async function getTasks(filters = {}) {
  let queryStr = 'SELECT * FROM tasks';
  const params = [];
  const conds = [];
  if (filters.status && filters.status !== 'all') {
    params.push(filters.status);
    conds.push(`status = $${params.length}`);
  }
  if (filters.assignedTo) {
    params.push(filters.assignedTo);
    conds.push(`assigned_to = $${params.length}`);
  }
  if (conds.length > 0) queryStr += ' WHERE ' + conds.join(' AND ');
  queryStr += ' ORDER BY due_date ASC, created_at DESC';
  const res = await query(queryStr, params);
  return res.rows.map(mapTaskFromDb);
}

async function createTask(taskData) {
  const id = taskData.id || `tsk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const res = await query(`
    INSERT INTO tasks (
      id, title, description, assigned_to, assigned_to_name, creator_id, creator_name,
      priority, status, progress, due_date, department, review_comments, history, attachments, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
    RETURNING *
  `, [
    id,
    taskData.title,
    taskData.description || '',
    taskData.assignedTo,
    taskData.assignedToName || 'Member',
    taskData.creatorId || null,
    taskData.creatorName || null,
    taskData.priority || 'medium',
    taskData.status || 'ASSIGNED',
    Number(taskData.progress) || 0,
    taskData.dueDate || new Date().toISOString().split('T')[0],
    taskData.department || 'Technical',
    taskData.reviewComments || '',
    JSON.stringify(taskData.history || []),
    JSON.stringify(taskData.attachments || [])
  ]);
  return mapTaskFromDb(res.rows[0]);
}

async function updateTask(id, updates) {
  const currentRes = await query('SELECT * FROM tasks WHERE id = $1', [id]);
  if (currentRes.rows.length === 0) return null;
  const current = mapTaskFromDb(currentRes.rows[0]);

  const newTitle = updates.title !== undefined ? updates.title : current.title;
  const newDesc = updates.description !== undefined ? updates.description : current.description;
  const newAssignedTo = updates.assignedTo !== undefined ? updates.assignedTo : current.assignedTo;
  const newAssignedToName = updates.assignedToName !== undefined ? updates.assignedToName : current.assignedToName;
  const newPriority = updates.priority !== undefined ? updates.priority : current.priority;
  const newStatus = updates.status !== undefined ? updates.status : current.status;
  const newProgress = updates.progress !== undefined ? Number(updates.progress) : current.progress;
  const newDueDate = updates.dueDate !== undefined ? updates.dueDate : current.dueDate;
  const newDept = updates.department !== undefined ? updates.department : current.department;
  const newComments = updates.reviewComments !== undefined ? updates.reviewComments : current.reviewComments;
  const newHistory = updates.history !== undefined ? updates.history : current.history;
  const newAttachments = updates.attachments !== undefined ? updates.attachments : current.attachments;

  const res = await query(`
    UPDATE tasks SET
      title = $1, description = $2, assigned_to = $3, assigned_to_name = $4,
      priority = $5, status = $6, progress = $7, due_date = $8,
      department = $9, review_comments = $10, history = $11, attachments = $12, updated_at = NOW()
    WHERE id = $13
    RETURNING *
  `, [
    newTitle, newDesc, newAssignedTo, newAssignedToName,
    newPriority, newStatus, newProgress, newDueDate,
    newDept, newComments, JSON.stringify(newHistory), JSON.stringify(newAttachments), id
  ]);
  return mapTaskFromDb(res.rows[0]);
}

async function deleteTask(id) {
  const res = await query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
  return res.rows.length > 0;
}

// ====================================================================
// WEEKLY REPORTS REPOSITORY (POSTGRESQL)
// ====================================================================

function mapWeeklyReportFromDb(r) {
  if (!r) return null;
  return {
    id: r.id,
    weekNumber: Number(r.week_number),
    period: r.period,
    department: r.department,
    totalEvents: Number(r.total_events) || 0,
    studentHours: Number(r.student_hours) || 0,
    attendeesCount: Number(r.attendees_count) || 0,
    summary: r.summary,
    roadblocks: r.roadblocks || '',
    nextSteps: r.next_steps,
    submittedBy: r.submitted_by,
    submittedByRole: r.submitted_by_role,
    status: r.status,
    reviewComments: r.review_comments || '',
    endorsedBy: r.endorsed_by || null,
    endorsedAt: r.endorsed_at ? new Date(r.endorsed_at).toISOString() : null,
    submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : new Date().toISOString()
  };
}

async function getWeeklyReports() {
  const res = await query('SELECT * FROM weekly_reports ORDER BY week_number DESC, submitted_at DESC');
  return res.rows.map(mapWeeklyReportFromDb);
}

async function createWeeklyReport(reportData) {
  const id = reportData.id || `wr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const res = await query(`
    INSERT INTO weekly_reports (
      id, week_number, period, department, total_events, student_hours, attendees_count,
      summary, roadblocks, next_steps, submitted_by, submitted_by_role, status, review_comments, endorsed_by, endorsed_at, submitted_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
    RETURNING *
  `, [
    id,
    Number(reportData.weekNumber) || 45,
    reportData.period || 'Current Cycle',
    reportData.department || 'Technical',
    Number(reportData.totalEvents) || 0,
    Number(reportData.studentHours) || 0,
    Number(reportData.attendeesCount) || 0,
    reportData.summary,
    reportData.roadblocks || '',
    reportData.nextSteps || '',
    reportData.submittedBy || 'Member',
    reportData.submittedByRole || 'committee',
    reportData.status || 'UNDER_REVIEW',
    reportData.reviewComments || '',
    reportData.endorsedBy || null,
    reportData.endorsedAt || null
  ]);
  return mapWeeklyReportFromDb(res.rows[0]);
}

async function updateWeeklyReport(id, updates) {
  const currentRes = await query('SELECT * FROM weekly_reports WHERE id = $1', [id]);
  if (currentRes.rows.length === 0) return null;
  const current = mapWeeklyReportFromDb(currentRes.rows[0]);

  const summary = updates.summary !== undefined ? updates.summary : current.summary;
  const roadblocks = updates.roadblocks !== undefined ? updates.roadblocks : current.roadblocks;
  const nextSteps = updates.nextSteps !== undefined ? updates.nextSteps : current.nextSteps;
  const totalEvents = updates.totalEvents !== undefined ? Number(updates.totalEvents) : current.totalEvents;
  const studentHours = updates.studentHours !== undefined ? Number(updates.studentHours) : current.studentHours;
  const attendeesCount = updates.attendeesCount !== undefined ? Number(updates.attendeesCount) : current.attendeesCount;
  const status = updates.status !== undefined ? updates.status : current.status;
  const reviewComments = updates.reviewComments !== undefined ? updates.reviewComments : current.reviewComments;
  const endorsedBy = updates.endorsedBy !== undefined ? updates.endorsedBy : current.endorsedBy;
  const endorsedAt = updates.endorsedAt !== undefined ? updates.endorsedAt : current.endorsedAt;

  const res = await query(`
    UPDATE weekly_reports SET
      summary = $1, roadblocks = $2, next_steps = $3, total_events = $4,
      student_hours = $5, attendees_count = $6, status = $7,
      review_comments = $8, endorsed_by = $9, endorsed_at = $10, updated_at = NOW()
    WHERE id = $11
    RETURNING *
  `, [summary, roadblocks, nextSteps, totalEvents, studentHours, attendeesCount, status, reviewComments, endorsedBy, endorsedAt, id]);
  return mapWeeklyReportFromDb(res.rows[0]);
}

// ====================================================================
// COMMUNITY POSTS REPOSITORY (POSTGRESQL)
// ====================================================================

function mapCommunityPostFromDb(r) {
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    type: r.type,
    category: r.category || 'General Discussion',
    tags: Array.isArray(r.tags) ? r.tags : (typeof r.tags === 'string' ? JSON.parse(r.tags || '[]') : []),
    isPinned: Boolean(r.is_pinned),
    author: r.author,
    authorId: r.author_id || null,
    role: r.role,
    likes: Number(r.likes) || 0,
    replies: Array.isArray(r.replies) ? r.replies : (typeof r.replies === 'string' ? JSON.parse(r.replies || '[]') : []),
    attachments: Array.isArray(r.attachments) ? r.attachments : (typeof r.attachments === 'string' ? JSON.parse(r.attachments || '[]') : []),
    timestamp: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
  };
}

async function getCommunityPosts() {
  const res = await query('SELECT * FROM community_posts ORDER BY is_pinned DESC, created_at DESC');
  return res.rows.map(mapCommunityPostFromDb);
}

async function createCommunityPost(postData) {
  const id = postData.id || `post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const res = await query(`
    INSERT INTO community_posts (
      id, title, content, type, category, tags, is_pinned, author, author_id, role, likes, replies, attachments, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
    RETURNING *
  `, [
    id,
    postData.title || 'Discussion',
    postData.content,
    postData.type || 'discussion',
    postData.category || 'General',
    JSON.stringify(postData.tags || []),
    Boolean(postData.isPinned),
    postData.author || 'Member',
    postData.authorId || null,
    postData.role || 'committee',
    Number(postData.likes) || 0,
    JSON.stringify(postData.replies || []),
    JSON.stringify(postData.attachments || [])
  ]);
  return mapCommunityPostFromDb(res.rows[0]);
}

async function likeCommunityPost(id) {
  const res = await query(`
    UPDATE community_posts SET likes = likes + 1, updated_at = NOW() WHERE id = $1 RETURNING *
  `, [id]);
  return res.rows.length > 0 ? mapCommunityPostFromDb(res.rows[0]) : null;
}

async function addCommunityComment(postId, commentData, user) {
  const currentRes = await query('SELECT * FROM community_posts WHERE id = $1', [postId]);
  if (currentRes.rows.length === 0) return null;
  const post = mapCommunityPostFromDb(currentRes.rows[0]);

  const reply = {
    id: `reply_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    author: user ? user.name : 'Member',
    role: user ? user.role : 'committee',
    timestamp: new Date().toISOString(),
    content: commentData.content
  };
  post.replies.push(reply);

  const updatedRes = await query(`
    UPDATE community_posts SET replies = $1, updated_at = NOW() WHERE id = $2 RETURNING *
  `, [JSON.stringify(post.replies), postId]);

  return { post: mapCommunityPostFromDb(updatedRes.rows[0]), reply };
}

// ====================================================================
// PRIVATE MESSAGING REPOSITORY (POSTGRESQL)
// ====================================================================

function mapMessageFromDb(r) {
  if (!r) return null;
  return {
    id: r.id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    senderRole: r.sender_role,
    recipientId: r.recipient_id,
    content: r.content,
    attachments: Array.isArray(r.attachments) ? r.attachments : (typeof r.attachments === 'string' ? JSON.parse(r.attachments || '[]') : []),
    isRead: Boolean(r.is_read),
    timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString()
  };
}

async function getMessages(userId = null) {
  let queryStr = 'SELECT * FROM private_messages';
  const params = [];
  if (userId) {
    params.push(userId);
    queryStr += ` WHERE sender_id = $1 OR recipient_id = $1`;
  }
  queryStr += ' ORDER BY timestamp ASC';
  const res = await query(queryStr, params);
  return res.rows.map(mapMessageFromDb);
}

async function sendMessage(msgData) {
  const id = msgData.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const res = await query(`
    INSERT INTO private_messages (id, sender_id, sender_name, sender_role, recipient_id, content, attachments, is_read, timestamp)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING *
  `, [
    id,
    msgData.senderId,
    msgData.senderName,
    msgData.senderRole,
    msgData.recipientId,
    msgData.content,
    JSON.stringify(msgData.attachments || []),
    false
  ]);
  return mapMessageFromDb(res.rows[0]);
}

// ====================================================================
// REPORTING SETTINGS REPOSITORY (POSTGRESQL)
// ====================================================================

async function getReportingSettings() {
  const res = await query('SELECT * FROM reporting_settings LIMIT 1');
  if (res.rows.length === 0) {
    return {
      activeWeek: 45,
      period: 'Cycle 45',
      deadlineDay: 'Monday',
      deadlineTime: '23:59:59',
      timezone: 'Asia/Kolkata',
      lastUpdatedBy: 'System',
      lastUpdatedAt: new Date().toISOString()
    };
  }
  const r = res.rows[0];
  return {
    id: r.id,
    activeWeek: Number(r.active_week),
    period: r.period,
    deadlineDay: r.deadline_day,
    deadlineTime: r.deadline_time,
    timezone: r.timezone,
    lastUpdatedBy: r.last_updated_by,
    lastUpdatedAt: r.last_updated_at ? new Date(r.last_updated_at).toISOString() : new Date().toISOString()
  };
}

async function updateReportingSettings(settings, user) {
  const existing = await getReportingSettings();
  const id = existing.id || 'rs_default';
  const activeWeek = settings.activeWeek !== undefined ? Number(settings.activeWeek) : existing.activeWeek;
  const period = settings.period !== undefined ? settings.period : existing.period;
  const deadlineDay = settings.deadlineDay !== undefined ? settings.deadlineDay : existing.deadlineDay;
  const deadlineTime = settings.deadlineTime !== undefined ? settings.deadlineTime : existing.deadlineTime;
  const timezone = settings.timezone !== undefined ? settings.timezone : existing.timezone;
  const lastUpdatedBy = user ? user.name : 'Administrator';

  await query(`
    INSERT INTO reporting_settings (id, active_week, period, deadline_day, deadline_time, timezone, last_updated_by, last_updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (id) DO UPDATE SET
      active_week = EXCLUDED.active_week,
      period = EXCLUDED.period,
      deadline_day = EXCLUDED.deadline_day,
      deadline_time = EXCLUDED.deadline_time,
      timezone = EXCLUDED.timezone,
      last_updated_by = EXCLUDED.last_updated_by,
      last_updated_at = NOW()
  `, [id, activeWeek, period, deadlineDay, deadlineTime, timezone, lastUpdatedBy]);

  return { id, activeWeek, period, deadlineDay, deadlineTime, timezone, lastUpdatedBy, lastUpdatedAt: new Date().toISOString() };
}

// ====================================================================
// AUDIT OBSERVATIONS REPOSITORY (POSTGRESQL)
// ====================================================================

function mapAuditObservationFromDb(r) {
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    observation: r.observation,
    complianceStatus: r.compliance_status,
    auditorName: r.auditor_name,
    authorRole: r.author_role || 'auditor',
    timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString()
  };
}

async function getAuditObservations() {
  const res = await query('SELECT * FROM audit_observations ORDER BY timestamp DESC');
  return res.rows.map(mapAuditObservationFromDb);
}

async function addAuditObservation(obs, user) {
  const id = `obs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const auditorName = user ? user.name : 'Chapter Auditor';
  const authorRole = user ? user.role : 'auditor';
  const res = await query(`
    INSERT INTO audit_observations (id, title, observation, compliance_status, auditor_name, author_role, timestamp)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING *
  `, [
    id,
    obs.title,
    obs.observation,
    obs.complianceStatus || 'COMPLIANT',
    auditorName,
    authorRole
  ]);
  return mapAuditObservationFromDb(res.rows[0]);
}

// ====================================================================
// USER ADMINISTRATION REPOSITORY (POSTGRESQL)
// ====================================================================

async function createUser(userData, creator) {
  const bcrypt = require('bcryptjs');
  const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const passwordHash = bcrypt.hashSync(userData.password || 'MGR_Member_2026!', 10);
  const email = userData.email.toLowerCase().trim();

  const res = await query(`
    INSERT INTO users (id, name, email, password_hash, role, designation, department, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    RETURNING *
  `, [
    id,
    userData.name.trim(),
    email,
    passwordHash,
    userData.role || 'committee',
    userData.designation || 'Student Committee Member',
    userData.department || 'Dr. MGR E&RI',
    true
  ]);

  if (creator) {
    await logAction('USER_ENROLLED', creator, 'User Administration', `Created new account for ${userData.name} with role ${userData.role}`);
  }
  return mapUserFromDb(res.rows[0]);
}

async function updateUserRole(id, role, updater) {
  const current = await getUserById(id);
  if (!current) return null;
  const res = await query(`
    UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING *
  `, [role, id]);
  if (updater) {
    await logAction('USER_ROLE_CHANGED', updater, 'User Administration', `Changed role of ${current.name} from ${current.role} to ${role}`);
  }
  return mapUserFromDb(res.rows[0]);
}

async function toggleUserActive(id, isActive, updater) {
  const current = await getUserById(id);
  if (!current) return null;
  const res = await query(`
    UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *
  `, [Boolean(isActive), id]);
  if (updater) {
    await logAction('USER_STATUS_TOGGLED', updater, 'User Administration', `${Boolean(isActive) ? 'Activated' : 'Deactivated'} account for ${current.name}`);
  }
  return mapUserFromDb(res.rows[0]);
}

async function changeUserPassword(id, passwordHash) {
  const res = await query(`
    UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id
  `, [passwordHash, id]);
  return res.rows.length > 0;
}

module.exports = {
  getChapters,
  getChapterById,
  createChapter,
  updateChapter,
  deleteChapter,
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getMembershipSnapshots,
  getNewMemberships,
  recordAnnualSnapshot,
  recordNewMembership,
  getUsers,
  getUserByEmail,
  getUserById,
  getAuditLogs,
  logAction,
  getAnalyticsOverview,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getWeeklyReports,
  createWeeklyReport,
  updateWeeklyReport,
  getCommunityPosts,
  createCommunityPost,
  likeCommunityPost,
  addCommunityComment,
  getMessages,
  sendMessage,
  getReportingSettings,
  updateReportingSettings,
  getAuditObservations,
  addAuditObservation,
  createUser,
  updateUserRole,
  toggleUserActive,
  changeUserPassword
};
