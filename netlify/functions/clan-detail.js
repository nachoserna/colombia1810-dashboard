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
    .find({ clanTag, snapshotDate: today }).toArray();
  const snapMap = {};
  snapshots.forEach(s => { snapMap[s.tag] = s; });

  const now = new Date();

  // CWL seasons — current and previous 2 (YYYY-MM)
  const cwlSeasons = [];
  for (let i = 0; i < 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    cwlSeasons.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // War month labels
  const warLabels = [];
  for (let i = 0; i < 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    warLabels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // Get recent wars sorted by updatedAt
  const allWars = await db.collection('clan_wars')
    .find({ clanTag, state: 'warEnded', warType: 'regular' })
    .sort({ updatedAt: -1 })
    .limit(60)
    .toArray();

  const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const wars0 = allWars.filter(w => w.updatedAt && w.updatedAt >= curMonthStart);
  const wars1 = allWars.filter(w => w.updatedAt && w.updatedAt >= prevMonthStart && w.updatedAt < curMonthStart);

  // Get all CWL wars for this clan and find what seasons exist
  const allCwlWars = await db.collection('cwl_wars')
    .find({ clanTag, state: 'warEnded' })
    .sort({ updatedAt: -1 })
    .toArray();

  // Get distinct seasons from actual data
  const allSeasons = [...new Set(allCwlWars.map(w => w.season).filter(Boolean))].sort().reverse();
  
  // Use actual seasons from data for cwl0 and cwl1
  const actualCwl0Season = allSeasons[0] || cwlSeasons[0];
  const actualCwl1Season = allSeasons[1] || cwlSeasons[1];

  const cwlWars0 = allCwlWars.filter(w => w.season === actualCwl0Season);
  const cwlWars1 = allCwlWars.filter(w => w.season === actualCwl1Season);

  function aggregateWarPerf(wars) {
    const perf = {};
    for (const war of wars) {
      for (const m of war.clan?.members || []) {
        if (!perf[m.tag]) perf[m.tag] = { attacks: 0, threeStars: 0 };
        for (const atk of m.attacks || []) {
          perf[m.tag].attacks++;
          if (atk.stars === 3) perf[m.tag].threeStars++;
        }
      }
    }
    return perf;
  }

  const warPerf0 = aggregateWarPerf(wars0);
  const warPerf1 = aggregateWarPerf(wars1);
  const cwlPerf0 = aggregateWarPerf(cwlWars0);
  const cwlPerf1 = aggregateWarPerf(cwlWars1);

  // Returns {stars, attacks, rate} or null
  function stats(perf) {
    if (!perf || perf.attacks === 0) return null;
    return {
      stars: perf.threeStars,
      attacks: perf.attacks,
      rate: +((perf.threeStars / perf.attacks) * 100).toFixed(1)
    };
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
    return {
      tag: m.tag, name: m.name, role: m.role,
      townHallLevel: m.townHallLevel || snap.townHallLevel,
      trophies: m.trophies || snap.trophies || 0,
      league: m.league || snap.league || 'Unranked',
      leagueId: m.leagueId || snap.leagueId || 0,
      leagueIconUrl: m.leagueIconUrl || null,
      cwl0: stats(cwlPerf0[m.tag]),
      cwl1: stats(cwlPerf1[m.tag]),
      war0: stats(warPerf0[m.tag]),
      war1: stats(warPerf1[m.tag]),
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
      members: clan.members,
    },
    members,
    seasons: [actualCwl0Season, actualCwl1Season],
    warLabels,
  });
};
