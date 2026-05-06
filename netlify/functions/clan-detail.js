const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok, err } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const tag = (event.queryStringParameters?.tag || '').replace(/^#/, '');
  if (!tag) return err('Missing tag');
  const clanTag = '#' + tag;

  const db = await getDb();

  // Get clan with memberList
  const clan = await db.collection('clans').findOne({ tag: clanTag });
  if (!clan) return err('Clan not found', 404);

  // Get today's snapshots for these members for richer data
  const today = new Date().toISOString().split('T')[0];
  const snapshots = await db.collection('player_snapshots')
    .find({ clanTag, snapshotDate: today })
    .toArray();
  const snapMap = {};
  snapshots.forEach(s => { snapMap[s.tag] = s; });

  // Current season (YYYY-MM)
  const now = new Date();
  const currentSeason = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevSeason = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

  // War stats — current month
  const warStartOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const recentWars = await db.collection('clan_wars')
    .find({ clanTag, state: 'warEnded', warType: 'regular', startTime: { $gte: warStartOfMonth } })
    .toArray();

  // CWL stats — current + previous season
  const cwlWars = await db.collection('cwl_wars')
    .find({ clanTag, state: 'warEnded', season: { $in: [currentSeason, prevSeason] } })
    .toArray();

  // Aggregate war perfects (3-star all attacks) per player
  const warPerf = {}; // tag -> { attacks, threeStars }
  for (const war of recentWars) {
    const apm = war.attacksPerMember || 2;
    for (const m of war.clan?.members || []) {
      if (!warPerf[m.tag]) warPerf[m.tag] = { attacks: 0, threeStars: 0 };
      for (const atk of m.attacks || []) {
        warPerf[m.tag].attacks++;
        if (atk.stars === 3) warPerf[m.tag].threeStars++;
      }
    }
  }

  // Aggregate CWL perfects per player
  const cwlPerf = {};
  for (const war of cwlWars) {
    for (const m of war.clan?.members || []) {
      if (!cwlPerf[m.tag]) cwlPerf[m.tag] = { attacks: 0, threeStars: 0 };
      for (const atk of m.attacks || []) {
        cwlPerf[m.tag].attacks++;
        if (atk.stars === 3) cwlPerf[m.tag].threeStars++;
      }
    }
  }

  // Build member list merging clan data + snapshots + stats
  const members = (clan.memberList || []).map(m => {
    const snap = snapMap[m.tag] || {};
    const wp = warPerf[m.tag];
    const cp = cwlPerf[m.tag];
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
      heroes: snap.heroes || {},
      donations: snap.donations || 0,
      donationsReceived: snap.donationsReceived || 0,
      warThreeStarRate: wp?.attacks > 0 ? +((wp.threeStars / wp.attacks) * 100).toFixed(1) : null,
      warAttacks: wp?.attacks || 0,
      cwlThreeStarRate: cp?.attacks > 0 ? +((cp.threeStars / cp.attacks) * 100).toFixed(1) : null,
      cwlAttacks: cp?.attacks || 0,
    };
  });

  // Sort by leagueId desc, then trophies desc
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

  members.sort((a, b) => {
    const la = LEAGUE_ORDER[a.league] ?? (a.leagueId || 0);
    const lb = LEAGUE_ORDER[b.league] ?? (b.leagueId || 0);
    if (lb !== la) return lb - la;
    return b.trophies - a.trophies;
  });

  return ok({
    clan: {
      tag: clan.tag,
      name: clan.name,
      level: clan.level,
      badgeUrls: clan.badgeUrls,
      warLeague: clan.warLeague,
      warLeagueId: clan.warLeagueId,
      members: clan.members,
      warWins: clan.warWins,
    },
    members,
    currentSeason,
    totalWars: recentWars.length,
    totalCWLWars: cwlWars.length,
  });
};
