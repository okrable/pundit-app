#!/usr/bin/env node

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const manifestPath = path.join(__dirname, '..', 'assets', 'avatars', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const validIds = new Set(manifest.assets.map(({ id }) => id));

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const result = await pool.query('SELECT id, avatar_id FROM users ORDER BY id');
    const nullUsers = result.rows.filter(({ avatar_id }) => avatar_id === null);
    const invalidUsers = result.rows.filter(
      ({ avatar_id }) => avatar_id !== null && !validIds.has(avatar_id)
    );
    const letterUsers = result.rows.filter(({ avatar_id }) => avatar_id?.startsWith('letter-'));

    console.log(JSON.stringify({
      totalUsers: result.rows.length,
      nullAvatarCount: nullUsers.length,
      invalidAvatarCount: invalidUsers.length,
      letterAvatarCount: letterUsers.length,
      nullUserIds: nullUsers.map(({ id }) => id),
      invalidUsers,
    }, null, 2));

    if (nullUsers.length > 0 || invalidUsers.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
