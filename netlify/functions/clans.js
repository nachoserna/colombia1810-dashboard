const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const db = await getDb();

  const clanes = await db.collection('clanes').find({}).toArray();

  // Normalizar para el frontend: tag = _id, level = clanLevel, warLeague = nombre
  const result = clanes.map(c => ({
    ...c,
    tag: c._id,
    name: c.name,
    level: c.clanLevel,
    members: c.members,
    warLeague: c.warLeague?.name || 'Unranked',
    warLeagueIconUrl: c.warLeague?.iconUrls?.small || null,
    badgeUrls: c.badgeUrls
  }));

  return ok(result);
};
