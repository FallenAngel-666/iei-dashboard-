/**
 * IEI TVLC PostgreSQL Repository
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

async function getUserByEmail(email) {
  if (!email) return null;
  const res = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
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
    const key = e.collegeOrChapter || 'Central TVLC Secretariat';
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
  getAnalyticsOverview
};
