/**
 * MGR IEI Students Chapter Portal Database Layer
 * Thread-safe persistent JSON storage with atomic writes, schema validation,
 * and high-performance querying for tasks, weekly reports, events, and community stream.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const seedData = require('./seedData');
const pgRepo = require('./db/pgRepository');

function isPgActive() {
  return Boolean(process.env.DATABASE_URL);
}

let dbState = {
  users: [],
  chapters: [],
  membershipSnapshots: [],
  newMemberships: [],
  events: [],
  auditLogs: [],
  tasks: [],
  weeklyReports: [],
  communityPosts: [],
  messages: [],
  notifications: [],
  meta: {
    initializedAt: null,
    lastModifiedAt: null,
    version: '1.0.0'
  }
};

function ensureDirectories() {
  if (!fs.existsSync(config.DATA_DIR)) {
    fs.mkdirSync(config.DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(config.POSTERS_DIR)) {
    fs.mkdirSync(config.POSTERS_DIR, { recursive: true });
  }
  if (!fs.existsSync(config.REPORTS_DIR)) {
    fs.mkdirSync(config.REPORTS_DIR, { recursive: true });
  }
  if (config.ATTACHMENTS_DIR && !fs.existsSync(config.ATTACHMENTS_DIR)) {
    fs.mkdirSync(config.ATTACHMENTS_DIR, { recursive: true });
  }
}

async function saveDatabase() {
  if (isPgActive()) return;
  ensureDirectories();
  dbState.meta.lastModifiedAt = new Date().toISOString();
  
  const tmpFile = `${config.DB_FILE}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(dbState, null, 2), 'utf-8');
    fs.renameSync(tmpFile, config.DB_FILE);
  } catch (err) {
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
    console.error('[DB] Failed to save database atomically:', err);
    throw err;
  }
}

let initPromise = null;

async function ensureInit() {
  if (isPgActive()) return;
  if (!initPromise) {
    initPromise = initDatabase();
  }
  return initPromise;
}

async function initDatabase(forceReseed = false) {
  if (isPgActive()) {
    try {
      const { testConnection } = require('./db/pgClient');
      const conn = await testConnection();
      if (conn.connected) {
        console.log(`[DB] Connected to PostgreSQL managed database "${conn.database}".`);
      } else {
        console.warn(`[DB] PostgreSQL check: ${conn.error || conn.reason}`);
      }
    } catch (e) {
      console.warn('[DB] PostgreSQL check error:', e.message);
    }
    return;
  }

  ensureDirectories();
  
  // On Vercel / serverless cold-start, hydrate ephemeral /tmp storage from bundled snapshot
  if (!fs.existsSync(config.DB_FILE) && fs.existsSync(config.ORIGINAL_DB_FILE)) {
    try {
      fs.copyFileSync(config.ORIGINAL_DB_FILE, config.DB_FILE);
      console.log('[DB] Hydrated ephemeral serverless storage with bundled MGR IEI database snapshot.');
    } catch (e) {
      console.warn('[DB] Could not copy original database snapshot to /tmp:', e.message);
    }
  }

  if (!forceReseed && fs.existsSync(config.DB_FILE)) {
    try {
      const raw = fs.readFileSync(config.DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      
      // Check version strictly for MGR IEI Students Chapter
      if (parsed.meta && parsed.meta.version === '3.0.0-mgr-iei') {
        dbState = {
          users: parsed.users || [],
          chapters: parsed.chapters || [],
          events: parsed.events || [],
          auditLogs: parsed.auditLogs || [],
          tasks: parsed.tasks || [],
          weeklyReports: parsed.weeklyReports || [],
          communityPosts: parsed.communityPosts || [],
          messages: parsed.messages || [],
          notifications: parsed.notifications || [],
          reportingSettings: parsed.reportingSettings || seedData.seedReportingSettings,
          auditObservations: parsed.auditObservations || seedData.seedAuditObservations,
          meta: parsed.meta
        };
        console.log(`[DB] Loaded MGR IEI database: ${dbState.tasks.length} tasks, ${dbState.weeklyReports.length} reports, ${dbState.communityPosts.length} posts.`);
        return;
      }
    } catch (err) {
      console.warn('[DB] Existing database file needs migration to MGR IEI Students Chapter schema:', err);
    }
  }

  // Populate cleanly from MGR IEI Students Chapter seed data
  dbState = {
    users: JSON.parse(JSON.stringify(seedData.seedUsers)),
    chapters: JSON.parse(JSON.stringify(seedData.seedChapter)),
    events: JSON.parse(JSON.stringify(seedData.seedEvents)),
    tasks: JSON.parse(JSON.stringify(seedData.seedTasks || [])),
    weeklyReports: JSON.parse(JSON.stringify(seedData.seedWeeklyReports || [])),
    communityPosts: JSON.parse(JSON.stringify(seedData.seedCommunityPosts || [])),
    messages: JSON.parse(JSON.stringify(seedData.seedMessages || [])),
    notifications: JSON.parse(JSON.stringify(seedData.seedNotifications || [])),
    reportingSettings: JSON.parse(JSON.stringify(seedData.seedReportingSettings)),
    auditObservations: JSON.parse(JSON.stringify(seedData.seedAuditObservations)),
    auditLogs: [
      {
        id: 'log_init',
        action: 'SYSTEM_INITIALIZATION',
        performedBy: 'System Bootstrap',
        target: 'MGR IEI Students Chapter Database',
        details: 'Initialized secure database for Dr. M.G.R. Educational and Research Institute Students Chapter with 4 strict roles (Admin/Editor, Chairman, Committee Member, Auditor).',
        timestamp: new Date().toISOString()
      }
    ],
    meta: {
      initializedAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      version: '3.0.0-mgr-iei'
    }
  };

  await saveDatabase();
  console.log(`[DB] Initialized MGR IEI Students Chapter database with ${dbState.users.length} authorized roles, ${dbState.tasks.length} tasks.`);
}

// ---------------- Chapter Methods ----------------

async function getChapters(filters = {}) {
  if (isPgActive()) return pgRepo.getChapters(filters);
  let list = [...dbState.chapters];
  
  if (filters.search) {
    const s = filters.search.toLowerCase().trim();
    list = list.filter(ch => 
      ch.chapterName.toLowerCase().includes(s) ||
      ch.collegeName.toLowerCase().includes(s) ||
      (ch.departments && ch.departments.some(d => d.toLowerCase().includes(s))) ||
      (ch.facultyAdvisors && ch.facultyAdvisors.some(f => f.toLowerCase().includes(s)))
    );
  }

  if (filters.status && filters.status !== 'All') {
    list = list.filter(ch => ch.status === filters.status);
  }

  return list;
}

async function getChapterById(id) {
  if (isPgActive()) return pgRepo.getChapterById(id);
  return dbState.chapters.find(c => c.id === id) || null;
}

async function createChapter(data, user) {
  if (isPgActive()) return pgRepo.createChapter(data, user);
  const newChapter = {
    id: `ch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    chapterName: data.chapterName ? data.chapterName.trim() : '',
    collegeName: data.collegeName ? data.collegeName.trim() : '',
    collegeCode: data.collegeCode ? data.collegeCode.trim().toUpperCase() : '',
    departments: Array.isArray(data.departments) 
      ? data.departments 
      : (data.departments ? data.departments.split(',').map(s => s.trim()).filter(Boolean) : []),
    studentMembersCount: data.studentMembersCount !== null && data.studentMembersCount !== undefined && data.studentMembersCount !== '' 
    ? Number(data.studentMembersCount) 
    : null,
    corporateMembersCount: data.corporateMembersCount !== null && data.corporateMembersCount !== undefined && data.corporateMembersCount !== '' 
    ? Number(data.corporateMembersCount) 
    : null,
    facultyAdvisors: Array.isArray(data.facultyAdvisors) 
      ? data.facultyAdvisors 
      : (data.facultyAdvisors ? data.facultyAdvisors.split(',').map(s => s.trim()).filter(Boolean) : []),
    establishedYear: data.establishedYear ? Number(data.establishedYear) : new Date().getFullYear(),
    status: data.status || 'Active',
    contactEmail: data.contactEmail ? data.contactEmail.trim() : '',
    phone: data.phone ? data.phone.trim() : '',
    location: data.location ? data.location.trim() : '',
    updatedAt: new Date().toISOString()
  };

  dbState.chapters.push(newChapter);
  
  // If membership snapshot is given for current year, save it too
  const currentYear = new Date().getFullYear();
  if (newChapter.studentMembersCount !== null || newChapter.corporateMembersCount !== null) {
    dbState.membershipSnapshots.push({
      id: `ms_${currentYear}_${newChapter.id}`,
      year: currentYear,
      chapterId: newChapter.id,
      studentCount: newChapter.studentMembersCount,
      corporateCount: newChapter.corporateMembersCount,
      recordedAt: new Date().toISOString()
    });
  }

  logAction('CREATE_CHAPTER', user, newChapter.chapterName, `Added new student chapter with ID ${newChapter.id}`);
  saveDatabase();
  return newChapter;
}

async function updateChapter(id, data, user) {
  if (isPgActive()) return pgRepo.updateChapter(id, data, user);
  const index = dbState.chapters.findIndex(c => c.id === id);
  if (index === -1) return null;

  const current = dbState.chapters[index];
  const updated = {
    ...current,
    chapterName: data.chapterName !== undefined ? data.chapterName.trim() : current.chapterName,
    collegeName: data.collegeName !== undefined ? data.collegeName.trim() : current.collegeName,
    collegeCode: data.collegeCode !== undefined ? data.collegeCode.trim().toUpperCase() : current.collegeCode,
    departments: data.departments !== undefined 
      ? (Array.isArray(data.departments) ? data.departments : data.departments.split(',').map(s => s.trim()).filter(Boolean))
      : current.departments,
    studentMembersCount: data.studentMembersCount !== undefined 
      ? (data.studentMembersCount === null || data.studentMembersCount === '' ? null : Number(data.studentMembersCount))
      : current.studentMembersCount,
    corporateMembersCount: data.corporateMembersCount !== undefined 
      ? (data.corporateMembersCount === null || data.corporateMembersCount === '' ? null : Number(data.corporateMembersCount))
      : current.corporateMembersCount,
    facultyAdvisors: data.facultyAdvisors !== undefined 
      ? (Array.isArray(data.facultyAdvisors) ? data.facultyAdvisors : data.facultyAdvisors.split(',').map(s => s.trim()).filter(Boolean))
      : current.facultyAdvisors,
    establishedYear: data.establishedYear !== undefined ? Number(data.establishedYear) : current.establishedYear,
    status: data.status !== undefined ? data.status : current.status,
    contactEmail: data.contactEmail !== undefined ? data.contactEmail.trim() : current.contactEmail,
    phone: data.phone !== undefined ? data.phone.trim() : current.phone,
    location: data.location !== undefined ? data.location.trim() : current.location,
    updatedAt: new Date().toISOString()
  };

  dbState.chapters[index] = updated;

  // Also update or add current year snapshot
  const currentYear = new Date().getFullYear();
  const snapIndex = dbState.membershipSnapshots.findIndex(s => s.year === currentYear && s.chapterId === id);
  if (snapIndex !== -1) {
    dbState.membershipSnapshots[snapIndex].studentCount = updated.studentMembersCount;
    dbState.membershipSnapshots[snapIndex].corporateCount = updated.corporateMembersCount;
    dbState.membershipSnapshots[snapIndex].recordedAt = new Date().toISOString();
  } else if (updated.studentMembersCount !== null || updated.corporateMembersCount !== null) {
    dbState.membershipSnapshots.push({
      id: `ms_${currentYear}_${id}`,
      year: currentYear,
      chapterId: id,
      studentCount: updated.studentMembersCount,
      corporateCount: updated.corporateMembersCount,
      recordedAt: new Date().toISOString()
    });
  }

  logAction('UPDATE_CHAPTER', user, updated.chapterName, `Updated student chapter details for ${id}`);
  saveDatabase();
  return updated;
}

async function deleteChapter(id, user) {
  if (isPgActive()) return pgRepo.deleteChapter(id, user);
  const index = dbState.chapters.findIndex(c => c.id === id);
  if (index === -1) return false;

  const deleted = dbState.chapters.splice(index, 1)[0];
  logAction('DELETE_CHAPTER', user, deleted.chapterName, `Deleted student chapter ID ${id}`);
  saveDatabase();
  return true;
}

// ---------------- Event Methods ----------------

async function getEvents(filters = {}) {
  if (isPgActive()) return pgRepo.getEvents(filters);
  let list = [...dbState.events];

  if (filters.search) {
    const s = filters.search.toLowerCase().trim();
    list = list.filter(ev => 
      ev.title.toLowerCase().includes(s) ||
      (ev.speakerName && ev.speakerName.toLowerCase().includes(s)) ||
      (ev.collegeOrChapter && ev.collegeOrChapter.toLowerCase().includes(s)) ||
      (ev.venue && ev.venue.toLowerCase().includes(s)) ||
      (ev.description && ev.description.toLowerCase().includes(s))
    );
  }

  if (filters.category && filters.category !== 'All') {
    list = list.filter(ev => ev.category === filters.category);
  }

  if (filters.status && filters.status !== 'All') {
    list = list.filter(ev => ev.status === filters.status);
  }

  if (filters.year && filters.year !== 'All') {
    const y = Number(filters.year);
    list = list.filter(ev => {
      const evYear = ev.reportingYear || (ev.eventDate ? new Date(ev.eventDate).getFullYear() : null);
      return evYear === y;
    });
  }

  if (filters.month && filters.month !== 'All') {
    const m = Number(filters.month);
    list = list.filter(ev => {
      if (!ev.eventDate) return false;
      const evMonth = new Date(ev.eventDate).getMonth() + 1;
      return evMonth === m;
    });
  }

  if (filters.chapterId && filters.chapterId !== 'All') {
    list = list.filter(ev => ev.chapterId === filters.chapterId);
  }

  // Sort descending by eventDate
  list.sort((a, b) => new Date(b.eventDate || 0) - new Date(a.eventDate || 0));

  return list;
}

async function getEventById(id) {
  if (isPgActive()) return pgRepo.getEventById(id);
  return dbState.events.find(e => e.id === id) || null;
}

async function createEvent(data, user) {
  if (isPgActive()) return pgRepo.createEvent(data, user);
  const eventDate = data.eventDate || new Date().toISOString().split('T')[0];
  const reportingYear = data.reportingYear ? Number(data.reportingYear) : new Date(eventDate).getFullYear();

  const newEvent = {
    id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    title: data.title ? data.title.trim() : 'Untitled Event',
    category: data.category || 'Technical Lecture',
    eventDate: eventDate,
    eventTime: data.eventTime ? data.eventTime.trim() : '10:00 AM',
    chapterId: data.chapterId || null,
    collegeOrChapter: data.collegeOrChapter ? data.collegeOrChapter.trim() : 'MGR IEI Student Chapter',
    speakerName: data.speakerName ? data.speakerName.trim() : '',
    speakerDesignation: data.speakerDesignation ? data.speakerDesignation.trim() : '',
    speakerOrg: data.speakerOrg ? data.speakerOrg.trim() : '',
    venue: data.venue ? data.venue.trim() : '',
    description: data.description ? data.description.trim() : '',
    posterUrl: data.posterUrl || '',
    reportUrl: data.reportUrl || '',
    status: data.status || 'Upcoming',
    attendeesCount: data.attendeesCount !== null && data.attendeesCount !== undefined && data.attendeesCount !== '' 
      ? Number(data.attendeesCount) 
      : null,
    reportingYear: reportingYear,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  dbState.events.unshift(newEvent);
  logAction('CREATE_EVENT', user, newEvent.title, `Scheduled new event under ${newEvent.category}`);
  saveDatabase();
  return newEvent;
}

async function updateEvent(id, data, user) {
  if (isPgActive()) return pgRepo.updateEvent(id, data, user);
  const index = dbState.events.findIndex(e => e.id === id);
  if (index === -1) return null;

  const current = dbState.events[index];
  const eventDate = data.eventDate !== undefined ? data.eventDate : current.eventDate;
  const reportingYear = data.reportingYear !== undefined 
    ? Number(data.reportingYear) 
    : (eventDate ? new Date(eventDate).getFullYear() : current.reportingYear);

  const updated = {
    ...current,
    title: data.title !== undefined ? data.title.trim() : current.title,
    category: data.category !== undefined ? data.category : current.category,
    eventDate: eventDate,
    eventTime: data.eventTime !== undefined ? data.eventTime.trim() : current.eventTime,
    chapterId: data.chapterId !== undefined ? data.chapterId : current.chapterId,
    collegeOrChapter: data.collegeOrChapter !== undefined ? data.collegeOrChapter.trim() : current.collegeOrChapter,
    speakerName: data.speakerName !== undefined ? data.speakerName.trim() : current.speakerName,
    speakerDesignation: data.speakerDesignation !== undefined ? data.speakerDesignation.trim() : current.speakerDesignation,
    speakerOrg: data.speakerOrg !== undefined ? data.speakerOrg.trim() : current.speakerOrg,
    venue: data.venue !== undefined ? data.venue.trim() : current.venue,
    description: data.description !== undefined ? data.description.trim() : current.description,
    posterUrl: data.posterUrl !== undefined ? data.posterUrl : current.posterUrl,
    reportUrl: data.reportUrl !== undefined ? data.reportUrl : current.reportUrl,
    status: data.status !== undefined ? data.status : current.status,
    attendeesCount: data.attendeesCount !== undefined 
      ? (data.attendeesCount === null || data.attendeesCount === '' ? null : Number(data.attendeesCount))
      : current.attendeesCount,
    reportingYear: reportingYear,
    updatedAt: new Date().toISOString()
  };

  dbState.events[index] = updated;
  logAction('UPDATE_EVENT', user, updated.title, `Updated event records for ID ${id}`);
  saveDatabase();
  return updated;
}

async function deleteEvent(id, user) {
  if (isPgActive()) return pgRepo.deleteEvent(id, user);
  const index = dbState.events.findIndex(e => e.id === id);
  if (index === -1) return false;

  const deleted = dbState.events.splice(index, 1)[0];
  logAction('DELETE_EVENT', user, deleted.title, `Deleted event ID ${id}`);
  saveDatabase();
  return true;
}

// ---------------- Membership Snapshots & New Intake ----------------

async function getMembershipSnapshots(filters = {}) {
  if (isPgActive()) return pgRepo.getMembershipSnapshots(filters);
  let list = [...dbState.membershipSnapshots];
  if (filters.year && filters.year !== 'All') {
    list = list.filter(s => s.year === Number(filters.year));
  }
  if (filters.chapterId && filters.chapterId !== 'All') {
    list = list.filter(s => s.chapterId === filters.chapterId);
  }
  return list;
}

async function getNewMemberships(filters = {}) {
  if (isPgActive()) return pgRepo.getNewMemberships(filters);
  let list = [...dbState.newMemberships];
  if (filters.year && filters.year !== 'All') {
    list = list.filter(nm => nm.year === Number(filters.year));
  }
  if (filters.chapterId && filters.chapterId !== 'All') {
    list = list.filter(nm => nm.chapterId === filters.chapterId);
  }
  return list;
}

async function recordAnnualSnapshot(year, chapterId, studentCount, corporateCount, user) {
  if (isPgActive()) return pgRepo.recordAnnualSnapshot(year, chapterId, studentCount, corporateCount, user);
  const y = Number(year);
  let snap = dbState.membershipSnapshots.find(s => s.year === y && s.chapterId === chapterId);
  
  if (snap) {
    snap.studentCount = studentCount !== null && studentCount !== '' ? Number(studentCount) : null;
    snap.corporateCount = corporateCount !== null && corporateCount !== '' ? Number(corporateCount) : null;
    snap.recordedAt = new Date().toISOString();
  } else {
    snap = {
      id: `ms_${y}_${chapterId}`,
      year: y,
      chapterId: chapterId,
      studentCount: studentCount !== null && studentCount !== '' ? Number(studentCount) : null,
      corporateCount: corporateCount !== null && corporateCount !== '' ? Number(corporateCount) : null,
      recordedAt: new Date().toISOString()
    };
    dbState.membershipSnapshots.push(snap);
  }

  // Update chapter live figures if matching current year
  if (y === new Date().getFullYear()) {
    const chapter = dbState.chapters.find(c => c.id === chapterId);
    if (chapter) {
      chapter.studentMembersCount = snap.studentCount;
      chapter.corporateMembersCount = snap.corporateCount;
      chapter.updatedAt = new Date().toISOString();
    }
  }

  logAction('RECORD_SNAPSHOT', user, `Chapter ${chapterId} (${y})`, `Recorded annual membership snapshot`);
  saveDatabase();
  return snap;
}

async function recordNewMembership(year, chapterId, studentNew, corporateNew, user, institutionName) {
  if (isPgActive()) return pgRepo.recordNewMembership(year, chapterId, studentNew, corporateNew, user, institutionName);
  const y = Number(year) || new Date().getFullYear();
  let instName = institutionName;
  if (!instName && chapterId) {
    const ch = dbState.chapters.find(c => c.id === chapterId);
    instName = ch ? ch.collegeName : chapterId;
  }
  instName = instName || 'Affiliated Institution';

  let record = dbState.newMemberships.find(nm => nm.year === y && (nm.chapterId === chapterId || nm.institutionName === instName));
  if (record) {
    if (studentNew !== undefined && studentNew !== null && studentNew !== '') {
      record.studentNew = Number(studentNew);
    }
    if (corporateNew !== undefined && corporateNew !== null && corporateNew !== '') {
      record.corporateNew = Number(corporateNew);
    }
    record.recordedDate = new Date().toISOString().split('T')[0];
  } else {
    record = {
      id: `nm_${y}_${Date.now()}`,
      year: y,
      chapterId: chapterId || null,
      institutionName: instName,
      studentNew: Number(studentNew) || 0,
      corporateNew: Number(corporateNew) || 0,
      recordedDate: new Date().toISOString().split('T')[0]
    };
    dbState.newMemberships.push(record);
  }

  logAction('RECORD_INTAKE', user, `${instName} (${y})`, `Recorded new membership intake: ${studentNew} students, ${corporateNew} corporate`);
  saveDatabase();
  return record;
}

// ---------------- Audit & User Methods ----------------

async function logAction(action, user, target, details) {
  if (isPgActive()) return pgRepo.logAction(action, user, target, details);
  const log = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    action,
    performedBy: user ? (user.name || user.email || 'Admin') : 'System/Staff',
    role: user ? (user.role || 'staff') : 'system',
    target: target || 'General',
    details: details || '',
    timestamp: new Date().toISOString()
  };
  dbState.auditLogs.unshift(log);
  if (dbState.auditLogs.length > 500) {
    dbState.auditLogs.pop();
  }
}

async function getAuditLogs(limit = 100) {
  if (isPgActive()) return pgRepo.getAuditLogs(limit);
  return dbState.auditLogs.slice(0, limit);
}

async function getUsers() {
  await ensureInit();
  if (isPgActive()) return pgRepo.getUsers();
  return dbState.users.map(u => ({
    id: u.id,
    credentialId: u.credentialId || u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    designation: u.designation,
    department: u.department,
    createdAt: u.createdAt,
    isActive: u.isActive
  }));
}

async function getUserByEmail(identifier) {
  await ensureInit();
  if (isPgActive()) return pgRepo.getUserByEmail(identifier);
  if (!identifier) return null;
  const q = String(identifier).toLowerCase().trim();
  const digits = q.replace(/\D/g, '');
  return dbState.users.find(u => {
    if (!u) return false;
    if (u.email && u.email.toLowerCase() === q) return true;
    if (u.altEmail && u.altEmail.toLowerCase() === q) return true;
    if (u.credentialId && u.credentialId.toLowerCase() === q) return true;
    if (u.id && u.id.toLowerCase() === q) return true;
    if (digits.length >= 10 && u.phone) {
      const uDigits = String(u.phone).replace(/\D/g, '');
      if (uDigits === digits) return true;
    }
    return false;
  }) || null;
}

async function getUserById(id) {
  await ensureInit();
  if (isPgActive()) return pgRepo.getUserById(id);
  return dbState.users.find(u => u.id === id || (u.credentialId && u.credentialId.toLowerCase() === id.toLowerCase().trim())) || null;
}

// ---------------- Production Analytics Aggregator ----------------
// Adheres strictly to Requirement 7: DATA INTEGRITY
// Computes real numbers directly from verified records, never inventing values.
// Treats null as Unknown rather than zero.
// Calculates percentage growth ONLY where valid historical baseline exists.

async function getAnalyticsOverview(selectedYear = null) {
  if (isPgActive()) return pgRepo.getAnalyticsOverview(selectedYear);
  const currentYear = new Date().getFullYear();
  const year = selectedYear && selectedYear !== 'All' ? Number(selectedYear) : currentYear;

  // 1. Registered Student Chapters Total
  const totalChapters = dbState.chapters.length;

  // 2. Memberships based on snapshots or live records
  // For the selected year, find the snapshots for that year; if none exist, use latest live counts
  const yearSnapshots = dbState.membershipSnapshots.filter(s => s.year === year);
  
  let knownStudentMembers = 0;
  let unknownStudentChapters = 0;
  let knownCorporateMembers = 0;
  let unknownCorporateChapters = 0;

  dbState.chapters.forEach(ch => {
    // Check if snapshot exists for this chapter & year
    const snap = yearSnapshots.find(s => s.chapterId === ch.id);
    const studentVal = snap ? snap.studentCount : ch.studentMembersCount;
    const corpVal = snap ? snap.corporateCount : ch.corporateMembersCount;

    if (studentVal !== null && studentVal !== undefined) {
      knownStudentMembers += studentVal;
    } else {
      unknownStudentChapters += 1;
    }

    if (corpVal !== null && corpVal !== undefined) {
      knownCorporateMembers += corpVal;
    } else {
      unknownCorporateChapters += 1;
    }
  });

  // 3. Events Totals
  const totalEventsAllTime = dbState.events.length;
  const eventsInSelectedYear = dbState.events.filter(ev => {
    const evYear = ev.reportingYear || (ev.eventDate ? new Date(ev.eventDate).getFullYear() : null);
    return evYear === year || year === 'All';
  });
  const totalEventsInYear = eventsInSelectedYear.length;
  const totalParticipantsInYear = eventsInSelectedYear.reduce((acc, curr) => acc + (curr.attendeesCount || 0), 0);

  // 4. New Memberships & Student Membership Growth during selected year (Nov 2025 – Oct 2026 report)
  const newMembersInYear = dbState.newMemberships.filter(nm => nm.year === year || year === 'All');
  const newStudentMembersInYear = newMembersInYear.reduce((acc, curr) => acc + (curr.studentNew || 0), 0);
  const newCorporateMembersInYear = newMembersInYear.reduce((acc, curr) => acc + (curr.corporateNew || 0), 0);
  const totalNewMembersInYear = newStudentMembersInYear + newCorporateMembersInYear;

  // 5. Annual Membership Trends (2023, 2024, 2025, 2026...)
  const distinctYears = [...new Set(dbState.membershipSnapshots.map(s => s.year))].sort((a, b) => a - b);
  if (!distinctYears.includes(currentYear)) distinctYears.push(currentYear);

  const annualMembershipTrends = distinctYears.map(y => {
    const snaps = dbState.membershipSnapshots.filter(s => s.year === y);
    const studentTotal = snaps.reduce((acc, curr) => acc + (curr.studentCount || 0), 0);
    const corporateTotal = snaps.reduce((acc, curr) => acc + (curr.corporateCount || 0), 0);
    const reportingChapters = snaps.filter(s => s.studentCount !== null).length;
    
    return {
      year: y,
      studentMembers: studentTotal,
      corporateMembers: corporateTotal,
      totalKnownMembers: studentTotal + corporateTotal,
      reportingChaptersCount: reportingChapters
    };
  });

  // 6. Annual Growth calculation (Percentage growth where valid historical data exists)
  // Strict check: if previous year has 0 reporting or missing, growth is null (unknown)
  for (let i = 0; i < annualMembershipTrends.length; i++) {
    if (i === 0) {
      annualMembershipTrends[i].studentGrowthRate = null;
      annualMembershipTrends[i].corporateGrowthRate = null;
      annualMembershipTrends[i].note = 'Baseline Established Year';
    } else {
      const prev = annualMembershipTrends[i - 1];
      const curr = annualMembershipTrends[i];

      if (prev.studentMembers && prev.studentMembers > 0) {
        curr.studentGrowthRate = Number((((curr.studentMembers - prev.studentMembers) / prev.studentMembers) * 100).toFixed(1));
      } else {
        curr.studentGrowthRate = null;
      }

      if (prev.corporateMembers && prev.corporateMembers > 0) {
        curr.corporateGrowthRate = Number((((curr.corporateMembers - prev.corporateMembers) / prev.corporateMembers) * 100).toFixed(1));
      } else {
        curr.corporateGrowthRate = null;
      }
    }
  }

  // 7. Monthly Event Trends for the Selected Year (Jan - Dec)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyEventTrends = monthNames.map((name, index) => {
    const monthNum = index + 1;
    const eventsThisMonth = eventsInSelectedYear.filter(ev => {
      if (!ev.eventDate) return false;
      const m = new Date(ev.eventDate).getMonth() + 1;
      return m === monthNum;
    });

    const technicalCount = eventsThisMonth.filter(e => e.category === 'Technical Lecture').length;
    const statutoryCount = eventsThisMonth.filter(e => e.category === 'Statutory Day').length;
    const otherCount = eventsThisMonth.length - technicalCount - statutoryCount;

    return {
      month: name,
      monthNumber: monthNum,
      totalEvents: eventsThisMonth.length,
      technicalLectures: technicalCount,
      statutoryDays: statutoryCount,
      otherEvents: otherCount
    };
  });

  // 8. Annual Event Comparisons across all recording years
  const eventYears = [...new Set(dbState.events.map(e => e.reportingYear || new Date(e.eventDate).getFullYear()))].sort();
  const annualEventComparisons = eventYears.map(y => {
    const evs = dbState.events.filter(e => (e.reportingYear || new Date(e.eventDate).getFullYear()) === y);
    const tech = evs.filter(e => e.category === 'Technical Lecture').length;
    const stat = evs.filter(e => e.category === 'Statutory Day').length;
    const workshop = evs.filter(e => e.category === 'Workshop/Seminar' || e.category === 'Competition/Hackathon').length;
    const completed = evs.filter(e => e.status === 'Completed').length;
    const upcoming = evs.filter(e => e.status === 'Upcoming').length;

    return {
      year: y,
      totalEvents: evs.length,
      technicalLectures: tech,
      statutoryDays: stat,
      workshopsAndCompetitions: workshop,
      completed,
      upcoming
    };
  });

  // 9. Chapter-wise Membership Ranking & Comparison (Real records)
  const chapterWiseMembership = dbState.chapters.map(ch => {
    const snap = yearSnapshots.find(s => s.chapterId === ch.id);
    const studentCount = snap ? snap.studentCount : ch.studentMembersCount;
    const corporateCount = snap ? snap.corporateCount : ch.corporateMembersCount;

    return {
      id: ch.id,
      chapterName: ch.chapterName,
      collegeName: ch.collegeName,
      collegeCode: ch.collegeCode,
      studentMembers: studentCount, // could be null
      corporateMembers: corporateCount, // could be null
      isStudentUnknown: studentCount === null,
      isCorporateUnknown: corporateCount === null,
      status: ch.status
    };
  }).sort((a, b) => {
    // Put known highest first, followed by unknowns
    if (a.studentMembers === null && b.studentMembers !== null) return 1;
    if (a.studentMembers !== null && b.studentMembers === null) return -1;
    if (a.studentMembers === null && b.studentMembers === null) return 0;
    return b.studentMembers - a.studentMembers;
  });

  // 10. Event Categories Breakdown
  const categoryCounts = {
    technicalLecture: eventsInSelectedYear.filter(e => e.category === 'Technical Lecture').length,
    statutoryDay: eventsInSelectedYear.filter(e => e.category === 'Statutory Day').length,
    workshop: eventsInSelectedYear.filter(e => e.category === 'Workshop' || e.category === 'Workshop/Seminar').length,
    competition: eventsInSelectedYear.filter(e => e.category === 'Competition/Hackathon').length
  };

  // 11. Event Status Totals
  const statusCounts = {
    completed: eventsInSelectedYear.filter(e => e.status === 'Completed').length,
    upcoming: eventsInSelectedYear.filter(e => e.status === 'Upcoming').length,
    inProgress: eventsInSelectedYear.filter(e => e.status === 'In Progress').length,
    cancelled: eventsInSelectedYear.filter(e => e.status === 'Cancelled').length
  };

  // 12. Chapter-wise Event Counts
  const chapterEventCounts = dbState.chapters.map(ch => {
    const count = eventsInSelectedYear.filter(e => e.chapterId === ch.id).length;
    return {
      chapterId: ch.id,
      chapterName: ch.chapterName,
      collegeCode: ch.collegeCode,
      eventCount: count
    };
  }).filter(c => c.eventCount > 0).sort((a, b) => b.eventCount - a.eventCount);

  return {
    selectedYear: year,
    availableYears: distinctYears,
    kpis: {
      totalStudentMembers: knownStudentMembers,
      unknownStudentChaptersCount: unknownStudentChapters,
      totalCorporateMembers: knownCorporateMembers,
      unknownCorporateChaptersCount: unknownCorporateChapters,
      totalEventsConducted: totalEventsAllTime,
      eventsInSelectedYear: totalEventsInYear,
      totalParticipantsInYear: totalParticipantsInYear,
      newMembersInSelectedYear: totalNewMembersInYear,
      newStudentMembersInSelectedYear: newStudentMembersInYear,
      newCorporateMembersInSelectedYear: newCorporateMembersInYear,
      totalRegisteredChapters: totalChapters,
      activeChaptersCount: dbState.chapters.filter(c => c.status === 'Active').length
    },
    officialReportSummary: {
      statutoryDays: categoryCounts.statutoryDay,
      technicalLectures: categoryCounts.technicalLecture,
      workshops: categoryCounts.workshop,
      totalActivities: totalEventsInYear,
      totalParticipants: totalParticipantsInYear,
      studentMembersGainedTotal: newStudentMembersInYear,
      studentMembersGainedList: newMembersInYear.map(nm => ({
        institutionName: nm.institutionName || (dbState.chapters.find(c => c.id === nm.chapterId)?.collegeName) || nm.chapterId,
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

// ========================================================
// MGR IEI STUDENT CHAPTER EXTENDED MODULES METHODS
// ========================================================

async function getTasks() {
  if (isPgActive()) return pgRepo.getTasks();
  return dbState.tasks || [];
}

async function createTask(task) {
  if (isPgActive()) return pgRepo.createTask(task);
  const newTask = {
    id: `tsk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    title: task.title,
    description: task.description || '',
    assignedTo: task.assignedTo || '',
    assignedToName: task.assignedToName || 'Institutional Officer',
    status: task.status || 'pending',
    priority: task.priority || 'normal',
    dueDate: task.dueDate || new Date().toISOString().split('T')[0],
    department: task.department || 'Multi-Disciplinary',
    chapterId: task.chapterId || 'ch_mgr_04',
    progress: Number(task.progress) || 0,
    createdAt: new Date().toISOString()
  };
  if (!dbState.tasks) dbState.tasks = [];
  dbState.tasks.push(newTask);
  await saveDatabase();
  return newTask;
}

async function updateTask(id, updates) {
  if (isPgActive()) return pgRepo.updateTask(id, updates);
  if (!dbState.tasks) return null;
  const idx = dbState.tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;
  dbState.tasks[idx] = { ...dbState.tasks[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveDatabase();
  return dbState.tasks[idx];
}

async function deleteTask(id) {
  if (isPgActive()) return pgRepo.deleteTask(id);
  if (!dbState.tasks) return false;
  const idx = dbState.tasks.findIndex(t => t.id === id);
  if (idx === -1) return false;
  dbState.tasks.splice(idx, 1);
  await saveDatabase();
  return true;
}

async function getWeeklyReports() {
  if (isPgActive()) return pgRepo.getWeeklyReports();
  return (dbState.weeklyReports || []).slice().sort((a, b) => b.weekNumber - a.weekNumber);
}

async function createWeeklyReport(report) {
  if (isPgActive()) return pgRepo.createWeeklyReport(report);
  const newReport = {
    id: `rep_wk_${Date.now()}`,
    weekNumber: Number(report.weekNumber) || 45,
    period: report.period || 'Current Week',
    chapterId: report.chapterId || 'ch_mgr_04',
    department: report.department || 'All Disciplines',
    totalEvents: Number(report.totalEvents) || 0,
    studentHours: Number(report.studentHours) || 0,
    attendeesCount: Number(report.attendeesCount) || 0,
    summary: report.summary || '',
    highlights: report.highlights || '',
    status: report.status || 'Under Chairman Review',
    submittedBy: report.submittedBy || 'Committee Lead',
    submittedByRole: report.submittedByRole || 'Committee Lead',
    endorsedBy: report.endorsedBy || null,
    submittedAt: new Date().toISOString()
  };
  if (!dbState.weeklyReports) dbState.weeklyReports = [];
  dbState.weeklyReports.unshift(newReport);
  await saveDatabase();
  return newReport;
}

async function updateWeeklyReport(id, updates) {
  if (isPgActive()) return pgRepo.updateWeeklyReport(id, updates);
  if (!dbState.weeklyReports) return null;
  const idx = dbState.weeklyReports.findIndex(r => r.id === id);
  if (idx === -1) return null;
  dbState.weeklyReports[idx] = { ...dbState.weeklyReports[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveDatabase();
  return dbState.weeklyReports[idx];
}

async function getCommunityPosts() {
  if (isPgActive()) return pgRepo.getCommunityPosts();
  return (dbState.communityPosts || []).slice().sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
}

async function createCommunityPost(post) {
  if (isPgActive()) return pgRepo.createCommunityPost(post);
  const newPost = {
    id: `post_${Date.now()}`,
    title: post.title,
    category: post.category || 'General IEI Circulars',
    author: post.author || 'Institutional Member',
    role: post.role || 'Member',
    timestamp: new Date().toISOString(),
    isPinned: Boolean(post.isPinned),
    likes: 0,
    commentsCount: 0,
    content: post.content,
    tags: Array.isArray(post.tags) ? post.tags : (post.tags ? post.tags.split(',').map(t => t.trim()) : [])
  };
  if (!dbState.communityPosts) dbState.communityPosts = [];
  dbState.communityPosts.unshift(newPost);
  await saveDatabase();
  return newPost;
}

async function likeCommunityPost(id) {
  if (isPgActive()) return pgRepo.likeCommunityPost(id);
  if (!dbState.communityPosts) return null;
  const post = dbState.communityPosts.find(p => p.id === id);
  if (!post) return null;
  post.likes = (post.likes || 0) + 1;
  await saveDatabase();
  return post;
}

async function getMessages() {
  if (isPgActive()) return pgRepo.getMessages();
  return dbState.messages || [];
}

async function sendMessage(msg) {
  if (isPgActive()) return pgRepo.sendMessage(msg);
  const newMsg = {
    id: `msg_${Date.now()}`,
    senderId: msg.senderId,
    senderName: msg.senderName,
    senderRole: msg.senderRole,
    recipientId: msg.recipientId,
    content: msg.content,
    timestamp: new Date().toISOString(),
    read: false
  };
  if (!dbState.messages) dbState.messages = [];
  dbState.messages.push(newMsg);
  await saveDatabase();
  return newMsg;
}

async function getNotifications() {
  return dbState.notifications || [];
}

async function markNotificationsRead() {
  if (dbState.notifications) {
    dbState.notifications.forEach(n => { n.unread = false; });
  }
  await saveDatabase();
  return true;
}

async function updateUserProfile(id, updates) {
  const user = dbState.users.find(u => u.id === id);
  if (!user) return null;
  if (updates.name) user.name = updates.name;
  if (updates.designation) user.designation = updates.designation;
  if (updates.department) user.department = updates.department;
  if (updates.phone) user.phone = updates.phone;
  await saveDatabase();
  return user;
}

async function changeUserPassword(id, newHash) {
  if (isPgActive()) return pgRepo.changeUserPassword(id, newHash);
  const user = dbState.users.find(u => u.id === id);
  if (!user) return null;
  user.passwordHash = newHash;
  await saveDatabase();
  return true;
}

async function addCommunityComment(postId, commentData, user) {
  if (isPgActive()) return pgRepo.addCommunityComment(postId, commentData, user);
  if (!dbState.communityPosts) return null;
  const post = dbState.communityPosts.find(p => p.id === postId);
  if (!post) return null;
  if (!post.replies) post.replies = [];
  const reply = {
    id: `rep_${Date.now()}`,
    author: user ? user.name : (commentData.author || 'Member'),
    role: user ? user.role : (commentData.role || 'committee'),
    timestamp: new Date().toISOString(),
    content: commentData.content
  };
  post.replies.push(reply);
  post.commentsCount = post.replies.length;
  await saveDatabase();
  return { post, reply };
}

async function getReportingSettings() {
  if (isPgActive()) return pgRepo.getReportingSettings();
  return dbState.reportingSettings || seedData.seedReportingSettings;
}

async function updateReportingSettings(settings, user) {
  if (isPgActive()) return pgRepo.updateReportingSettings(settings, user);
  dbState.reportingSettings = {
    ...(dbState.reportingSettings || seedData.seedReportingSettings),
    ...settings,
    lastUpdatedBy: user ? user.name : 'Chapter Administrator',
    lastUpdatedAt: new Date().toISOString()
  };
  await logAction('REPORTING_SETTINGS_UPDATED', user, 'Governance Settings', `Updated Reporting Cycle Week ${dbState.reportingSettings.activeWeek} configuration`);
  await saveDatabase();
  return dbState.reportingSettings;
}

async function getAuditObservations() {
  if (isPgActive()) return pgRepo.getAuditObservations();
  return dbState.auditObservations || [];
}

async function addAuditObservation(obs, user) {
  if (isPgActive()) return pgRepo.addAuditObservation(obs, user);
  const newObs = {
    id: `obs_${Date.now()}`,
    title: obs.title,
    observation: obs.observation,
    complianceStatus: obs.complianceStatus || 'COMPLIANT',
    auditorName: user ? user.name : 'Chapter Auditor',
    authorRole: user ? user.role : 'auditor',
    timestamp: new Date().toISOString()
  };
  if (!dbState.auditObservations) dbState.auditObservations = [];
  dbState.auditObservations.unshift(newObs);
  await logAction('AUDIT_OBSERVATION_RECORDED', user, 'Audit Ledger', `Recorded audit observation: ${obs.title}`);
  await saveDatabase();
  return newObs;
}

async function createUser(userData, creator) {
  await ensureInit();
  if (isPgActive()) return pgRepo.createUser(userData, creator);
  const bcrypt = require('bcryptjs');

  const role = userData.role || 'committee';
  const year = new Date().getFullYear();
  let credentialPrefix = 'MGR.IEI.';
  if (role === 'admin') credentialPrefix = 'MGR.IEI.admin.';
  else if (role === 'chairman') credentialPrefix = 'MGR.IEI.CHAIRMAN.';
  else if (role === 'auditor') credentialPrefix = 'MGR.IEI.staff.';
  else credentialPrefix = `MGR.IEI.${year}.`;

  const existingWithPrefix = (dbState.users || []).filter(u => u.credentialId && u.credentialId.startsWith(credentialPrefix)).length + 1;
  const credentialId = userData.credentialId || `${credentialPrefix}${String(existingWithPrefix).padStart(2, '0')}`;

  const newUser = {
    id: `usr_${Date.now()}`,
    credentialId,
    name: userData.name,
    email: userData.email.toLowerCase(),
    passwordHash: bcrypt.hashSync(userData.password || 'MGR_Member_2026!', 10),
    role: role,
    designation: userData.designation || 'Student Committee Member',
    department: userData.department || 'Dr. MGR E&RI',
    createdAt: new Date().toISOString(),
    isActive: true
  };
  if (!dbState.users) dbState.users = [];
  dbState.users.push(newUser);
  await logAction('USER_ENROLLED', creator, 'User Administration', `Created new account for ${newUser.name} (${newUser.email}, ${credentialId}) with role ${newUser.role}`);
  await saveDatabase();
  return newUser;
}

async function updateUserRole(id, role, updater) {
  if (isPgActive()) return pgRepo.updateUserRole(id, role, updater);
  const user = dbState.users.find(u => u.id === id);
  if (!user) return null;
  const oldRole = user.role;
  user.role = role;
  await logAction('USER_ROLE_CHANGED', updater, 'User Administration', `Changed role of ${user.name} from ${oldRole} to ${role}`);
  await saveDatabase();
  return user;
}

async function toggleUserActive(id, isActive, updater) {
  if (isPgActive()) return pgRepo.toggleUserActive(id, isActive, updater);
  const user = dbState.users.find(u => u.id === id);
  if (!user) return null;
  user.isActive = Boolean(isActive);
  await logAction('USER_STATUS_TOGGLED', updater, 'User Administration', `${user.isActive ? 'Activated' : 'Deactivated'} account for ${user.name}`);
  await saveDatabase();
  return user;
}

module.exports = {
  initDatabase,
  saveDatabase,
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
  getNotifications,
  markNotificationsRead,
  updateUserProfile,
  changeUserPassword,
  getReportingSettings,
  updateReportingSettings,
  getAuditObservations,
  addAuditObservation,
  createUser,
  updateUserRole,
  toggleUserActive
};
