const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const { clans, desde } = event.queryStringParameters || {};
  const db = await getDb();

  const match = { state: 'warEnded', warType: 'regular' };
  if (clans) match.clanTag = { $in: clans.split(',').map(c => c.trim()) };
  if (desde) match.startTime = { $gte: new Date(desde) };

  const wars = await db.collection('clan_wars').find(match).sort({ startTime: -1 }).limit(200).toArray();

  const missed = [];
  for (const war of wars) {
    for (const m of war.clan?.members || []) {
      const attacksPerMember = war.attacksPerMember || 2;
      const made = m.attacks?.length || 0;
      if (made < attacksPerMember) {
        missed.push({
          name: m.name, tag: m.tag,
          clanName: war.clanName, clanTag: war.clanTag,
          opponentName: war.opponentName,
          missed: attacksPerMember - made,
          warDate: war.startTime,
          teamSize: war.teamSize
        });
      }
    }
  }

  return ok(missed.sort((a, b) => new Date(b.warDate) - new Date(a.warDate)));
};
