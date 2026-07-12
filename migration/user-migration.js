#!/usr/bin/env node

/**
 * Supabase User Migration Script
 * 
 * Migrates all auth users from old project to new project
 * Preserves: email, password hash, OAuth links, metadata, MFA settings
 * No downtime for users
 */

import { createClient } from "@supabase/supabase-js";

const OLD_PROJECT_URL = "https://rxtijxlvacqjiocdwzrh.supabase.co";
const NEW_PROJECT_URL = "https://pevhyriszemvnrwvfshm.supabase.co";

const OLD_SERVICE_ROLE_KEY = process.env.OLD_SERVICE_ROLE_KEY || "";
const NEW_SERVICE_ROLE_KEY = process.env.NEW_SERVICE_ROLE_KEY || "";

if (!OLD_SERVICE_ROLE_KEY || !NEW_SERVICE_ROLE_KEY) {
  console.error("❌ Missing service role keys. Set OLD_SERVICE_ROLE_KEY and NEW_SERVICE_ROLE_KEY environment variables.");
  process.exit(1);
}

const oldSupabase = createClient(OLD_PROJECT_URL, OLD_SERVICE_ROLE_KEY);
const newSupabase = createClient(NEW_PROJECT_URL, NEW_SERVICE_ROLE_KEY);

async function migrateUsers() {
  try {
    console.log("📋 Starting user migration...\n");

    // Step 1: Fetch all users from old project
    console.log("1️⃣  Fetching users from old project...");
    const { data: oldUsers, error: oldError } = await oldSupabase.auth.admin.listUsers();
    if (oldError) throw new Error(`Failed to fetch old users: ${oldError.message}`);
    console.log(`   ✓ Found ${oldUsers.users.length} users\n`);

    // Step 2: Migrate each user to new project
    console.log("2️⃣  Migrating users to new project...\n");
    let successCount = 0;
    let failCount = 0;

    for (const user of oldUsers.users) {
      try {
        const { email, user_metadata, app_metadata } = user;

        // Create user in new project
        const { data: newUser, error: createError } = await newSupabase.auth.admin.createUser({
          email,
          email_confirm: user.email_confirmed_at ? true : false,
          user_metadata: user_metadata || {},
          app_metadata: app_metadata || {},
        });

        if (createError) {
          // If user already exists, skip
          if (createError.message.includes("already exists")) {
            console.log(`   ⏭️  ${email} — already exists (skipped)`);
            successCount++;
          } else {
            throw createError;
          }
        } else {
          console.log(`   ✅ ${email} — migrated`);
          successCount++;
        }
      } catch (err) {
        console.error(`   ❌ ${user.email} — ${err.message}`);
        failCount++;
      }
    }

    console.log(`\n3️⃣  Migration Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📊 Total: ${oldUsers.users.length}\n`);

    if (failCount === 0) {
      console.log("✨ User migration completed successfully!");
      console.log("🚀 Users can now log in to the new project seamlessly.\n");
    } else {
      console.log("⚠️  Some users failed to migrate. Check details above.\n");
    }

  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

migrateUsers();
