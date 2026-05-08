const { MongoClient } = require('mongodb');

let client;
let db;

async function getDb() {
  if (db) return db;

  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db('colombia1810');
  return db;
}

module.exports = { getDb };
