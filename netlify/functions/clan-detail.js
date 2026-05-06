const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok, err } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const tag = (event.queryStringParameters?.tag || '').replace(/^#/, '');
  if (!tag) return err('Missing tag');
  const clanTag = '#' + tag;

  const db = await getDb();

  const clan = await db.collection('clans').findOne({ tag: clanTag });
  if (!clan) return err('Clan not found', 404);

  const today = new Date().toISOString().split('T')[0];
  const snapshots = await db.collection('player_snapshots')
    .find({ clanTag, snapshotDate: today })
    .toArray();
  const snapMap = {};
  snapshots.forEach(s => { snapMap[s.tag] = s; });

  // Build last 3 seasons
  const now = new Date();
  const seasons = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    seasons.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  // seasons[0] = current, seasons[1] = prev, seasons[2] = 2 months ago

  // War stats — current month
  const warStartOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const recentWars = await db.collection('clan_wars')
    .find({ clanTag, state: 'warEnded', warType: 'regular', startTime: { $gte: warStartOfMonth } })
    .toArray();

  // CWL stats — last 3 seasons separately
  const cwlWars = await db.collection('cwl_wars')
    .find({ clanTag, state: 'warEnded', season: { $in: seasons } })
    .toArray();

  // Aggregate war perfects per player
  const warPerf = {};
  for (const war of recentWars) {
    for (const m of war.clan?.members || []) {
      if (!warPerf[m.tag]) warPerf[m.tag] = { attacks: 0, threeStars: 0 };
      for (const atk of m.attacks || []) {
        warPerf[m.tag].attacks++;
        if (atk.stars === 3) warPerf[m.tag].threeStars++;
      }
    }
  }

  // Aggregate CWL per season per player
  const cwlBySeason = {}; // tag -> { season: { attacks, threeStars } }
  for (const war of cwlWars) {
    for (const m of war.clan?.members || []) {
      if (!cwlBySeason[m.tag]) cwlBySeason[m.tag] = {};
      if (!cwlBySeason[m.tag][war.season]) cwlBySeason[m.tag][war.season] = { attacks: 0, threeStars: 0 };
      for (const atk of m.attacks || []) {
        cwlBySeason[m.tag][war.season].attacks++;
        if (atk.stars === 3) cwlBySeason[m.tag][war.season].threeStars++;
      }
    }
  }

  function threeStarRate(perf) {
    if (!perf || perf.attacks === 0) return null;
    return +((perf.threeStars / perf.attacks) * 100).toFixed(1);
  }

  const LEAGUE_ORDER = {
    'Legend League': 100, 'Titan League I': 91, 'Titan League II': 90, 'Titan League III': 89,
    'Champion League I': 81, 'Champion League II': 80, 'Champion League III': 79,
    'Master League I': 71, 'Master League II': 70, 'Master League III': 69,
    'Crystal League I': 61, 'Crystal League II': 60, 'Crystal League III': 59,
    'Gold League I': 51, 'Gold League II': 50, 'Gold League III': 49,
    'Silver League I': 41, 'Silver League II': 40, 'Silver League III': 39,
    'Bronze League I': 31, 'Bronze League II': 30, 'Bronze League III': 29,
    'Unranked': 0
  };

  const members = (clan.memberList || []).map(m => {
    const snap = snapMap[m.tag] || {};
    const wp = warPerf[m.tag];
    const cs = cwlBySeason[m.tag] || {};
    return {
      tag: m.tag,
      name: m.name,
      role: m.role,
      townHallLevel: m.townHallLevel || snap.townHallLevel,
      expLevel: m.expLevel || snap.expLevel,
      trophies: m.trophies || snap.trophies || 0,
      league: m.league || snap.league || 'Unranked',
      leagueId: m.leagueId || snap.leagueId || 0,
      leagueIconUrl: m.leagueIconUrl || null,
      warThreeStarRate: threeStarRate(wp),
      warAttacks: wp?.attacks || 0,
      cwl0: threeStarRate(cs[seasons[0]]), // current
      cwl1: threeStarRate(cs[seasons[1]]), // prev
      cwl2: threeStarRate(cs[seasons[2]]), // 2 months ago
    };
  });

  members.sort((a, b) => {
    const la = LEAGUE_ORDER[a.league] ?? (a.leagueId || 0);
    const lb = LEAGUE_ORDER[b.league] ?? (b.leagueId || 0);
    if (lb !== la) return lb - la;
    return b.trophies - a.trophies;
  });

  return ok({
    clan: {
      tag: clan.tag, name: clan.name, level: clan.level,
      badgeUrls: clan.badgeUrls, warLeague: clan.warLeague,
      warLeagueId: clan.warLeagueId, members: clan.members, warWins: clan.warWins,
    },
    members,
    seasons, // [current, prev, prev-1]
    totalWars: recentWars.length,
  });
};
