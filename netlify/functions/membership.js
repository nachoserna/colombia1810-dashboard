const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const { clan } = event.queryStringParameters || {};
  const db = await getDb();

  const match = { event: { $in: ['joined', 'left'] } };
  if (clan) match.clanTag = clan;

  const events = await db.collection('membership_log')
    .find(match).sort({ timestamp: -1 }).limit(100).toArray();

  return ok(events);
};
