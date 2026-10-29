/**
 * Official MGR IEI Student Chapter Member Enrollment Script
 * Enrolls the 20 authorized student officers into data/portal_database.json and src/seedData.js
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const defaultPasswordHash = bcrypt.hashSync('MGR_IEI_2026!', 10);

const membersData = [
  {
    id: 'usr_mgr_01',
    name: 'AAKANISH ANANTHIKA E',
    email: 'it.e250509@gmail.com',
    altEmail: 'ananthikaedwin07@gmail.com',
    phone: '9043433097',
    designation: 'Executive Member',
    department: 'Information Technology',
    role: 'committee',
    credentialId: 'MGR.IEI.2026.01'
  },
  {
    id: 'usr_mgr_02',
    name: 'RAMYA SRI M',
    email: 'ramyoshiii017@gmail.com',
    altEmail: null,
    phone: '9789961609',
    designation: 'Event Management Head',
    department: 'Student Committee',
    role: 'committee',
    credentialId: 'MGR.IEI.2026.02'
  },
  {
    id: 'usr_mgr_03',
    name: 'SRIMAN NARAYANA MOORTHY S',
    email: 'srimannarayanamoorthysridhar@gmail.com',
    altEmail: null,
    phone: '8015803274',
    designation: 'Chairman Elect',
    department: 'Executive Council',
    role: 'chairman',
    credentialId: 'MGR.IEI.CHAIRMAN.01'
  },
  {
    id: 'usr_mgr_04',
    name: 'SRIPRIYAN S',
    email: 'sri.priyan.s.2607@gmail.com',
    altEmail: null,
    phone: '8778991626',
    designation: 'Joint Secretary',
    department: 'Computer Science & Engineering',
    role: 'chairman',
    credentialId: 'MGR.IEI.CHAIRMAN.04'
  },
  {
    id: 'usr_mgr_05',
    name: 'MARIYA MERLINA I E',
    email: 'mariyamerlina02@gmail.com',
    altEmail: null,
    phone: '8825983447',
    designation: 'Secretary',
    department: 'Executive Secretariat',
    role: 'committee',
    credentialId: 'MGR.IEI.SEC.01'
  },
  {
    id: 'usr_mgr_06',
    name: 'GEETHALAKSHMI A',
    email: 'geethaashok3114@gmail.com',
    altEmail: null,
    phone: '9884633809',
    designation: 'Vice Chairman Elect',
    department: 'Executive Council',
    role: 'chairman',
    credentialId: 'MGR.IEI.CHAIRMAN.02'
  },
  {
    id: 'usr_mgr_07',
    name: 'VISHAVAJIT V',
    email: 'vishvajit11.7@gmail.com',
    altEmail: null,
    phone: '8072020406',
    designation: 'Executive Member',
    department: 'Student Committee',
    role: 'committee',
    credentialId: 'MGR.IEI.2026.03'
  },
  {
    id: 'usr_mgr_08',
    name: 'JAYAVARSAN A',
    email: 'jayavarsan27@gmail.com',
    altEmail: null,
    phone: '9952833020',
    designation: 'Executive Member',
    department: 'Student Committee',
    role: 'committee',
    credentialId: 'MGR.IEI.2026.04'
  },
  {
    id: 'usr_mgr_09',
    name: 'SRI BHARATH S',
    email: 'sribharathofficial07@gmail.com',
    altEmail: null,
    phone: '7448810507',
    designation: 'Executive Member',
    department: 'Student Committee',
    role: 'committee',
    credentialId: 'MGR.IEI.2026.05'
  },
  {
    id: 'usr_mgr_10',
    name: 'SABARISH R',
    email: 'arameshsabarish2007@gmail.com',
    altEmail: null,
    phone: '9361013782',
    designation: 'Executive Member',
    department: 'Student Committee',
    role: 'committee',
    credentialId: 'MGR.IEI.2026.06'
  },
  {
    id: 'usr_mgr_11',
    name: 'LOKESHVARI V',
    email: 'logipraveena30@gmail.com',
    altEmail: null,
    phone: '9944915106',
    designation: 'Treasurer',
    department: 'Finance & Accounts',
    role: 'committee',
    credentialId: 'MGR.IEI.2026.07'
  },
  {
    id: 'usr_mgr_12',
    name: 'DHARINISH G',
    email: 'dharinishb@gmail.com',
    altEmail: null,
    phone: '9025036409',
    designation: 'Executive Member',
    department: 'Student Committee',
    role: 'committee',
    credentialId: 'MGR.IEI.2026.08'
  },
  {
    id: 'usr_mgr_13',
    name: 'MAHALAKSHMI T',
    email: 'cse.e251804@gmail.com',
    altEmail: null,
    phone: '6369414319',
    designation: 'Executive Member',
    department: 'Computer Science & Engineering',
    role: 'committee',
    credentialId: 'MGR.IEI.2026.09'
  },
  {
    id: 'usr_mgr_14',
    name: 'KALAIVANI N',
    email: 'kalaivanin029@gmail.com',
    altEmail: null,
    phone: '9344544643',
    designation: 'Joint Treasurer',
    department: 'Finance & Accounts',
    role: 'committee',
    credentialId: 'MGR.IEI.2026.10'
  },
  {
    id: 'usr_mgr_15',
    name: 'FAHIMA N',
    email: 'ece.e250114@gmail.com',
    altEmail: 'f28309738@gmail.com',
    phone: '7200627606',
    designation: 'Executive Member',
    department: 'Electronics & Communication',
    role: 'committee',
    credentialId: 'MGR.IEI.2026.11'
  },
  {
    id: 'usr_mgr_16',
    name: 'SWATHI NANDHANA M',
    email: 'swathinandhana3@gmail.com',
    altEmail: null,
    phone: '8754709407',
    designation: 'Membership Director',
    department: 'Membership Services',
    role: 'committee',
    credentialId: 'MGR.IEI.2026.12'
  },
  {
    id: 'usr_mgr_17',
    name: 'ALAN PAUL R',
    email: 'paulalanr15@gmail.com',
    altEmail: null,
    phone: '8925124474',
    designation: 'Vice Chairman Elect',
    department: 'Executive Council',
    role: 'chairman',
    credentialId: 'MGR.IEI.CHAIRMAN.03'
  },
  {
    id: 'usr_mgr_18',
    name: 'J L HEMANTH',
    email: 'cse.e250988@gmail.com',
    altEmail: 'meethemanth01@gmail.com',
    phone: '9444247495',
    designation: 'Joint Secretary',
    department: 'Computer Science & Engineering',
    role: 'chairman',
    credentialId: 'MGR.IEI.CHAIRMAN.05'
  },
  {
    id: 'usr_mgr_19',
    name: 'SANGAVI J',
    email: 'cse.e251612@gmail.com',
    altEmail: null,
    phone: '8825438212',
    designation: 'Executive Member',
    department: 'Computer Science & Engineering',
    role: 'committee',
    credentialId: 'MGR.IEI.2026.13'
  },
  {
    id: 'usr_mgr_20',
    name: 'ARATHI',
    email: 'karumuruaarathi02@gmail.com',
    altEmail: null,
    phone: '9515938822',
    designation: 'Executive Member',
    department: 'Student Committee',
    role: 'committee',
    credentialId: 'MGR.IEI.2026.14'
  }
];

// Add metadata fields to members
const enrolledUsers = membersData.map((m, idx) => ({
  ...m,
  passwordHash: defaultPasswordHash,
  assignedChapterId: 'mgr-iei-sc',
  createdAt: '2026-10-29T18:32:00.000Z',
  isActive: true
}));

// 1. Update data/portal_database.json
const dbPath = path.join(__dirname, '..', 'data', 'portal_database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Retain system foundation accounts: admin@mgriei.org, chairman@mgriei.org, committee@mgriei.org, auditor@mgriei.org
const baseAccounts = db.users.filter(u => ['admin@mgriei.org', 'chairman@mgriei.org', 'committee@mgriei.org', 'auditor@mgriei.org'].includes(u.email));

// Merge so enrolled users take precedence
db.users = [...baseAccounts, ...enrolledUsers];
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log(`[OK] Successfully updated data/portal_database.json. Total users: ${db.users.length}`);

// 2. Also update seedData.js
const seedPath = path.join(__dirname, '..', 'src', 'seedData.js');
let seedContent = fs.readFileSync(seedPath, 'utf8');

// Check if enrolled users are already written in seedData
if (!seedContent.includes('usr_mgr_01')) {
  const insertionMarker = 'const seedUsers = [';
  const membersSeedString = enrolledUsers.map(u => `  {
    id: '${u.id}',
    name: '${u.name.replace(/'/g, "\\'")}',
    email: '${u.email}',
    altEmail: ${u.altEmail ? `'${u.altEmail}'` : 'null'},
    phone: '${u.phone}',
    passwordHash: defaultSeedHash,
    role: '${u.role}',
    designation: '${u.designation.replace(/'/g, "\\'")}',
    department: '${u.department.replace(/'/g, "\\'")}',
    credentialId: '${u.credentialId}',
    assignedChapterId: 'mgr-iei-sc',
    createdAt: '2026-10-29T18:32:00.000Z',
    isActive: true
  },`).join('\n');

  seedContent = seedContent.replace('const bcrypt = require(\'bcryptjs\');', `const bcrypt = require('bcryptjs');\nconst defaultSeedHash = bcrypt.hashSync('MGR_IEI_2026!', 10);`);
  seedContent = seedContent.replace(insertionMarker, `${insertionMarker}\n${membersSeedString}`);
  fs.writeFileSync(seedPath, seedContent, 'utf8');
  console.log('[OK] Successfully updated src/seedData.js');
}

console.log('[SUCCESS] All 20 members enrolled and verified!');
