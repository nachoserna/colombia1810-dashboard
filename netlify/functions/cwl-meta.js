const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();
  const db = await getDb();
  const path = event.path.replace('/.netlify/functions/', '').replace('/api/', '');

  const type = event.queryStringParameters?.type;

  if (type === 'seasons') {
    const seasons = await db.collection('cwl_wars').distinct('season', { season: { $ne: null } });
    return ok(seasons.filter(Boolean).sort().reverse());
  }

  if (type === 'leagues') {
    const leagues = await db.collection('cwl_wars').distinct('clanLeague', { clanLeague: { $ne: null } });
    return ok(leagues.filter(Boolean).sort());
  }

  return ok([]);
};
