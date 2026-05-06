#!/usr/bin/env node
/**
 * Colombia 1810 — Crear usuario del dashboard
 * Uso: MONGODB_URI="mongodb+srv://..." node create-user.js <username> <password> [admin|viewer]
 */
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

async function main() {
  const [,, username, password, role = 'viewer'] = process.argv;
  if (!username || !password) {
    console.log('Uso: node create-user.js <username> <password> [admin|viewer]');
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('Falta MONGODB_URI'); process.exit(1); }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('colombia1810');
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  await db.collection('dashboard_users').updateOne(
    { username },
    { $set: { username, password: hash, role, updatedAt: new Date() } },
    { upsert: true }
  );
  console.log(`✅ Usuario '${username}' (${role}) listo`);
  await client.close();
}
main().catch(console.error);
