/**
 * IEI TVLC Secure Administrator Setup Utility
 * Creates or updates an institutional Super Administrator account with a unique password.
 * Works with both PostgreSQL and the local fallback database.
 * 
 * Usage:
 *   node scripts/setup-admin.js --email "admin@ieitvlc.org" --password "YourStrongPassword123!"
 *   Or set environment variables: ADMIN_EMAIL, ADMIN_PASSWORD
 */

const bcrypt = require('bcryptjs');
const db = require('../src/db');
const { testConnection } = require('../src/db/pgClient');

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      params.email = args[++i];
    } else if (args[i] === '--password' && args[i + 1]) {
      params.password = args[++i];
    } else if (args[i] === '--name' && args[i + 1]) {
      params.name = args[++i];
    }
  }
  return params;
}

async function setupAdmin() {
  console.log('=======================================================');
  console.log(' IEI TVLC Super Administrator Account Setup');
  console.log('=======================================================');

  const cliArgs = parseArgs();
  const email = cliArgs.email || process.env.ADMIN_EMAIL;
  const password = cliArgs.password || process.env.ADMIN_PASSWORD;
  const name = cliArgs.name || process.env.ADMIN_NAME || 'IEI TVLC Chief Administrator';

  if (!email || !password) {
    console.error('[Error] Both email and password are required.');
    console.log('\nUsage Examples:');
    console.log('  node scripts/setup-admin.js --email "admin@ieitvlc.org" --password "StrongUniquePassword!"');
    console.log('  ADMIN_EMAIL="admin@ieitvlc.org" ADMIN_PASSWORD="StrongUniquePassword!" node scripts/setup-admin.js');
    process.exit(1);
  }

  if (password.length < 10) {
    console.error('[Security Warning] Password must be at least 10 characters for administrative roles.');
    process.exit(1);
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  console.log(`Configuring administrator account for: ${email}`);

  // Check if PostgreSQL is configured
  if (process.env.DATABASE_URL) {
    const { query } = require('../src/db/pgClient');
    console.log('Target: PostgreSQL Database (DATABASE_URL)');

    const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length > 0) {
      await query(`
        UPDATE users
        SET password_hash = $1, name = $2, role = 'admin', is_active = true, updated_at = NOW()
        WHERE LOWER(email) = LOWER($3)
      `, [passwordHash, name, email]);
      console.log('✓ Successfully updated existing Super Administrator password and profile in PostgreSQL.');
    } else {
      const newId = 'usr_admin_' + Date.now();
      await query(`
        INSERT INTO users (id, name, email, password_hash, role, designation, department, is_active, created_at)
        VALUES ($1, $2, $3, $4, 'admin', 'Centre Administrator & Systems Officer', 'IEI TVLC Secretariat', true, NOW())
      `, [newId, name, email, passwordHash]);
      console.log('✓ Successfully created new Super Administrator account in PostgreSQL.');
    }
  } else {
    console.log('Target: Local Database (JSON)');
    await db.initDatabase();
    const existing = await db.getUserByEmail(email);
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.name = name;
      existing.role = 'admin';
      existing.isActive = true;
      db.saveDatabase();
      console.log('✓ Successfully updated Super Administrator password in local database.');
    } else {
      const users = await db.getUsers();
      users.push({
        id: 'usr_admin_' + Date.now(),
        name,
        email,
        passwordHash,
        role: 'admin',
        designation: 'Centre Administrator & Systems Officer',
        department: 'IEI TVLC Secretariat',
        isActive: true,
        createdAt: new Date().toISOString()
      });
      db.saveDatabase();
      console.log('✓ Successfully registered new Super Administrator account in local database.');
    }
  }

  console.log('\n=======================================================');
  console.log(` Setup Complete! You can now log into the portal with:`);
  console.log(` Email: ${email}`);
  console.log(` Password: [PROTECTED - ${password.length} characters]`);
  console.log('=======================================================');
}

if (require.main === module) {
  setupAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Setup Error]:', err);
      process.exit(1);
    });
}

module.exports = { setupAdmin };
