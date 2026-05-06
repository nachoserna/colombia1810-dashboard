const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const { clan } = event.queryStringParameters || {};
  const db = await getDb();

  const today = new Date().toISOString().split('T')[0];
  const match = { snapshotDate: today };
  if (clan) match.clanTag = clan;

  const snapshots = await db.collection('player_snapshots').find(match).toArray();
  return ok(snapshots.sort((a, b) => b.trophies - a.trophies));
};
