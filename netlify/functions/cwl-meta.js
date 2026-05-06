const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();
  const db = await getDb();
  const path = event.path.replace('/.netlify/functions/', '').replace('/api/', '');

  if (path === 'cwl-seasons') {
    const seasons = await db.collection('cwl_wars').distinct('season', { season: { $ne: null } });
    return ok(seasons.sort().reverse());
  }

  if (path === 'cwl-leagues') {
    const leagues = await db.collection('cwl_wars').distinct('clanLeague', { clanLeague: { $ne: null } });
    return ok(leagues.sort());
  }

  return ok([]);
};
