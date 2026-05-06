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
  const months = [];
  for (let i = 0; i < 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const memberTags = (clan.memberList || []).map(m => m.tag);

  // Extract numeric war ID from warTag like "historical_#90CLYR88_5509180" -> "5509180"
  // or from warId like "#90CLYR88_5460277" -> "5460277"
  function getNumericId(war) {
    const wt = war.warTag || '';
    const wi = war.warId || '';
    // historical format: "historical_#CLAN_12345"
    const m1 = wt.match(/historical_[^_]+_(\d+)$/);
    if (m1) return m1[1];
    // new collector format: "#CLAN_20260506T..."
    const m2 = wi.match(/_(\d{8}T\d+)/);
    if (m2) return wi; // use full warId as key
    // fallback: use warTag or _id
    return wt || war._id.toString();
  }

  // Aggregate by player, deduplicating by numeric war ID
  function aggregatePerf(wars, targetTags) {
    const perf = {};
    for (const war of wars) {
      const warKey = getNumericId(war);
      for (const m of war.clan?.members || []) {
        if (!targetTags.includes(m.tag)) continue;
        if (!perf[m.tag]) perf[m.tag] = { seenWars: new Set(), attacks: 0, threeStars: 0 };
        if (perf[m.tag].seenWars.has(warKey)) continue;
        perf[m.tag].seenWars.add(warKey);
        for (const atk of m.attacks || []) {
          perf[m.tag].attacks++;
          if (atk.stars === 3) perf[m.tag].threeStars++;
        }
      }
    }
    return perf;
  }

  const wars0 = await db.collection('clan_wars')
    .find({ state: 'warEnded', warType: 'regular', warMonth: months[0] }).toArray();
  const wars1 = await db.collection('clan_wars')
    .find({ state: 'warEnded', warType: 'regular', warMonth: months[1] }).toArray();

  const allCwlWars = await db.collection('cwl_wars')
    .find({ state: 'warEnded' }).toArray();
  const allSeasons = [...new Set(allCwlWars.map(w => w.season).filter(Boolean))].sort().reverse();
  const cwl0Season = allSeasons[0] || months[0];
  const cwl1Season = allSeasons[1] || months[1];
  const cwlWars0 = allCwlWars.filter(w => w.season === cwl0Season);
  const cwlWars1 = allCwlWars.filter(w => w.season === cwl1Season);

  const warPerf0 = aggregatePerf(wars0, memberTags);
  const warPerf1 = aggregatePerf(wars1, memberTags);
  const cwlPerf0 = aggregatePerf(cwlWars0, memberTags);
  const cwlPerf1 = aggregatePerf(cwlWars1, memberTags);

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
      badgeUrls: clan.badgeUrls, warLeague: clan.warLeague, members: clan.members,
    },
    members,
    seasons: [cwl0Season, cwl1Season],
    warLabels: months,
  });
};
