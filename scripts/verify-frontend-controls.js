const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');

const checks = [
  // User Enrollment
  'form-enroll-user',
  'enroll-name',
  'enroll-email',
  'enroll-role',
  'enroll-designation',
  'enroll-dept',
  'enroll-password',
  'btn-submit-enroll',
  'modal-enroll-user',
  'users-table-body',

  // Task Creation
  'modal-create-task',
  'form-create-task',
  'task-input-title',
  'task-input-desc',
  'task-input-priority',
  'task-input-due',
  'task-input-dept',
  'task-input-assignee',
  'btn-open-create-task',
  'tasks-kanban-board',
  'tasks-list-container',

  // Stream Publishing
  'community-post-content',
  'community-post-title',
  'btn-publish-stream',
  'community-posts-stream',

  // Compliance Observation
  'modal-log-observation',
  'form-log-observation',
  'obs-title',
  'obs-observation',
  'obs-status',
  'audit-observations-table-body',
  'btn-open-log-obs',

  // Weekly Reports
  'modal-submit-report',
  'form-submit-report',
  'rep-week',
  'rep-dept',
  'rep-events',
  'rep-hours',
  'rep-attendees',
  'rep-summary',
  'weekly-reports-table-body',

  // Announcements & Events
  'events-container',
  'form-create-event',
  'event-title',
  'event-date',

  // Reporting Settings
  'form-reporting-settings',
  'setting-day',
  'setting-time'
];

console.log('--- VERIFYING FRONTEND CONTROLS IN index.html ---');
let missing = 0;
for (const id of checks) {
  const found = html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
  console.log(`${id}: ${found ? 'FOUND' : 'MISSING'}`);
  if (!found) missing++;
}
console.log(`Summary: ${checks.length - missing}/${checks.length} IDs found in index.html. Missing: ${missing}`);
