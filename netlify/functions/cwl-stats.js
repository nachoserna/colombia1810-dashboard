const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const { clans, desde, league } = event.queryStringParameters || {};
  const db = await getDb();

  const match = { state: 'warEnded' };

  // Multi-clan filter
  if (clans) {
    const clanList = clans.split(',').map(c => c.trim());
    match.clanTag = { $in: clanList };
  }

  // Desde filter (start of month)
  if (desde) match.startTime = { $gte: new Date(desde) };

  // League filter
  if (league) match.clanLeague = league;

  const wars = await db.collection('cwl_wars').find(match).toArray();

  const players = {};
  for (const war of wars) {
    const members = war.clan?.members || [];
    for (const m of members) {
      const key = m.tag;
      if (!players[key]) {
        players[key] = {
          tag: m.tag, name: m.name,
          townHallLevel: m.townhallLevel,
          clanTag: war.clanTag, clanName: war.clanName,
          wars: 0, attacks: 0, missed: 0,
          stars: 0, trueStars: 0, dest: 0,
          threeStars: 0, twoStars: 0, oneStars: 0, zeroStars: 0,
          defStars: 0, defDest: 0, defCount: 0,
          lowerHits: 0, upperHits: 0, mirrorHits: 0
        };
      }
      const p = players[key];
      p.wars += 1;
      if (!m.attacks?.length) p.missed += 1;

      for (const atk of m.attacks || []) {
        p.attacks += 1;
        p.stars += atk.stars;
        p.trueStars += atk.trueStars ?? atk.stars;
        p.dest += atk.destructionPercentage;
        if (atk.stars === 3) p.threeStars++;
        else if (atk.stars === 2) p.twoStars++;
        else if (atk.stars === 1) p.oneStars++;
        else p.zeroStars++;
        if (atk.defenderTH && m.townhallLevel) {
          if (atk.defenderTH < m.townhallLevel) p.lowerHits++;
          else if (atk.defenderTH > m.townhallLevel) p.upperHits++;
          else p.mirrorHits++;
        }
      }
      if (m.bestOpponentAttack) {
        p.defStars += m.bestOpponentAttack.stars || 0;
        p.defDest += m.bestOpponentAttack.destructionPercentage || 0;
        p.defCount += 1;
      }
    }
  }

  const result = Object.values(players).map(p => ({
    ...p,
    avgStars: p.attacks > 0 ? +(p.stars / p.attacks).toFixed(2) : 0,
    avgTrueStars: p.attacks > 0 ? +(p.trueStars / p.attacks).toFixed(2) : 0,
    avgDest: p.attacks > 0 ? +(p.dest / p.attacks).toFixed(1) : 0,
    threeStarRate: p.attacks > 0 ? +((p.threeStars / p.attacks) * 100).toFixed(1) : 0,
    avgDefStars: p.defCount > 0 ? +(p.defStars / p.defCount).toFixed(2) : 0,
  })).sort((a, b) => b.trueStars - a.trueStars);

  return ok({ players: result, totalWars: wars.length });
};
