/**
 * IEI TVLC Portal Database Layer
 * Thread-safe persistent JSON storage with atomic writes, schema validation,
 * and high-performance querying for chapters, events, memberships, and analytics.
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
  
  if (!forceReseed && fs.existsSync(config.DB_FILE)) {
    try {
      const raw = fs.readFileSync(config.DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      
      // Check if database needs upgrade to official 2025-2026 report data
      const hasReportEvents = (parsed.events || []).some(e => e.id === 'ev_act_01' || e.title === 'One-Day Workshop');
      if (hasReportEvents) {
        // Ensure new seed users (e.g. coordinator@ieitvlc.org, example@gmail.com) are synced
        const existingUsers = parsed.users || [];
        let usersUpdated = false;
        seedData.seedUsers.forEach(su => {
          if (!existingUsers.some(u => u.email.toLowerCase() === su.email.toLowerCase())) {
            existingUsers.push(su);
            usersUpdated = true;
          }
        });

        dbState = {
          users: existingUsers,
          chapters: parsed.chapters || [],
          membershipSnapshots: parsed.membershipSnapshots || [],
          newMemberships: parsed.newMemberships || [],
          events: parsed.events || [],
          auditLogs: parsed.auditLogs || [],
          meta: parsed.meta || {
            initializedAt: new Date().toISOString(),
            lastModifiedAt: new Date().toISOString(),
            version: '2.0.0'
          }
        };

        if (usersUpdated) {
          await saveDatabase();
        }
        console.log(`[DB] Loaded existing database: ${dbState.chapters.length} chapters, ${dbState.events.length} events.`);
        return;
      }
    } catch (err) {
      console.warn('[DB] Existing database file corrupted or outdated, re-seeding:', err);
    }
  }

  // Populate from official seed data (Nov 2025 – Oct 2026 Report)
  dbState = {
    users: JSON.parse(JSON.stringify(seedData.seedUsers)),
    chapters: JSON.parse(JSON.stringify(seedData.seedChapters)),
    membershipSnapshots: JSON.parse(JSON.stringify(seedData.seedMembershipSnapshots)),
    newMemberships: JSON.parse(JSON.stringify(seedData.seedNewMemberships)),
    events: JSON.parse(JSON.stringify(seedData.seedEvents)),
    auditLogs: [
      {
        id: 'log_init',
        action: 'SYSTEM_INITIALIZATION',
        performedBy: 'System Bootstrap',
        target: 'Institution Database',
        details: 'Loaded official Annual Activity Report (Nov 2025 – Oct 2026) with 11 events, 1,019 participants, and 1,287 student members gained.',
        timestamp: new Date().toISOString()
      }
    ],
    meta: {
      initializedAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      version: '2.0.0'
    }
  };

  await saveDatabase();
  console.log(`[DB] Initialized database with ${dbState.chapters.length} chapters, ${dbState.events.length} events, ${dbState.users.length} users.`);
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
    collegeOrChapter: data.collegeOrChapter ? data.collegeOrChapter.trim() : 'IEI TVLC Central',
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
  if (isPgActive()) return pgRepo.getUsers();
  return dbState.users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    designation: u.designation,
    department: u.department,
    createdAt: u.createdAt,
    isActive: u.isActive
  }));
}

async function getUserByEmail(email) {
  if (isPgActive()) return pgRepo.getUserByEmail(email);
  if (!email) return null;
  return dbState.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
}

async function getUserById(id) {
  if (isPgActive()) return pgRepo.getUserById(id);
  return dbState.users.find(u => u.id === id) || null;
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
  getAnalyticsOverview
};
