const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();
  const db = await getDb();
  const clans = await db.collection('clans').find({}).toArray();
  return ok(clans);
};
