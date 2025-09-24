#!/usr/bin/env node

/**
 * Migration Runner and Verifier
 * This script runs Supabase migrations and verifies their success
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Check if Supabase CLI is available
function checkSupabaseCLI() {
  try {
    execSync('npx supabase --version', { stdio: 'ignore' });
    return true;
  } catch {
    log('❌ Supabase CLI not found. Please install it first.', 'red');
    return false;
  }
}

// Get list of migration files
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    log('❌ Migrations directory not found', 'red');
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files;
}

// Run migrations
async function runMigrations() {
  log('\n🚀 Starting Migration Process', 'blue');
  log('================================\n', 'blue');

  // Check CLI
  if (!checkSupabaseCLI()) {
    process.exit(1);
  }

  // Get migration files
  const migrations = getMigrationFiles();
  log(`📁 Found ${migrations.length} migration files\n`, 'yellow');

  // List migrations
  log('📋 Migration Files:', 'magenta');
  migrations.forEach(m => console.log(`   - ${m}`));
  console.log('');

  try {
    // Check if we're linked to a project
    log('🔗 Checking Supabase project link...', 'yellow');
    try {
      execSync('npx supabase db remote list', { stdio: 'ignore' });
      log('✅ Project is linked\n', 'green');
    } catch {
      log('⚠️  Project not linked. Linking now...', 'yellow');

      // Try to link using project ID from .env.local
      const envPath = path.join(__dirname, '..', '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const projectId = envContent.match(/SUPABASE_PROJECT_ID=(\w+)/)?.[1];

        if (projectId) {
          log(`📎 Linking to project: ${projectId}`, 'blue');
          try {
            execSync(`npx supabase link --project-ref ${projectId}`, { stdio: 'inherit' });
            log('✅ Project linked successfully\n', 'green');
          } catch (err) {
            log('❌ Failed to link project. You may need to login first:', 'red');
            log('   Run: npx supabase login', 'yellow');
            process.exit(1);
          }
        }
      }
    }

    // Push migrations
    log('📤 Pushing migrations to database...', 'yellow');
    execSync('npx supabase db push', { stdio: 'inherit' });
    log('\n✅ Migrations pushed successfully!\n', 'green');

    // Get migration status
    log('📊 Checking migration status...', 'yellow');
    const status = execSync('npx supabase migration list', { encoding: 'utf8' });
    console.log(status);

  } catch (error) {
    log('\n❌ Migration failed!', 'red');
    console.error(error.message);
    process.exit(1);
  }

  log('\n✨ Migration process complete!', 'green');
}

// Verify migrations
async function verifyMigrations() {
  log('\n🔍 Verifying Migrations', 'blue');
  log('========================\n', 'blue');

  try {
    // Check RLS status
    log('🔐 Checking RLS Status...', 'yellow');

    const rlsCheckQuery = `
      SELECT
        schemaname,
        tablename,
        CASE WHEN c.relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status,
        COUNT(p.policyname) as policy_count
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
      LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
      WHERE t.schemaname = 'public'
        AND t.tablename NOT LIKE '%_view%'
      GROUP BY schemaname, tablename, c.relrowsecurity
      ORDER BY rls_status, tablename;
    `;

    // Would need to execute this query via Supabase
    log('⚠️  To verify RLS status, run this query in Supabase SQL Editor:', 'yellow');
    console.log(rlsCheckQuery);

  } catch (error) {
    log('❌ Verification failed', 'red');
    console.error(error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';

  switch (command) {
    case 'run':
      await runMigrations();
      break;
    case 'verify':
      await verifyMigrations();
      break;
    case 'help':
      log('Usage: node run-migrations.js [command]', 'blue');
      log('Commands:', 'blue');
      log('  run     - Run all migrations (default)', 'green');
      log('  verify  - Verify migration status', 'green');
      log('  help    - Show this help message', 'green');
      break;
    default:
      log(`Unknown command: ${command}`, 'red');
      log('Use "node run-migrations.js help" for usage', 'yellow');
  }
}

// Run the script
main().catch(err => {
  log('Fatal error:', 'red');
  console.error(err);
  process.exit(1);
});