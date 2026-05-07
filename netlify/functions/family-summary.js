const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok, err } = require('./_auth');

// Simple in-memory cache — 5 min TTL
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  if (cache && Date.now() - cacheTime < CACHE_TTL) {
    return ok(cache);
  }

  const db = await getDb();
  const clans = await db.collection('clans').find({}).toArray();
  if (!clans.length) return err('No clans found');

  const totalClans = clans.length;
  const totalMembers = clans.reduce((s, c) => s + (c.members || 0), 0);
  const clanTags = clans.map(c => c.tag);

  // En Guerra — clan_wars con state inWar o preparation (recent, last 3 days)
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const activeWars = await db.collection('clan_wars')
    .find({
      clanTag: { $in: clanTags },
      state: { $in: ['inWar', 'preparation'] },
      updatedAt: { $gte: cutoff }
    })
    .toArray();

  // Deduplicate by clanTag (one clan can have one active war)
  const enWarClans = new Set(activeWars.map(w => w.clanTag));
  const enWar = enWarClans.size;

  // CWL Activas — cwl_wars con state inWar o preparation (current month)
  const now = new Date();
  const currentSeason = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const activeCwl = await db.collection('cwl_wars')
    .find({
      clanTag: { $in: clanTags },
      season: currentSeason,
      state: { $in: ['inWar', 'preparation'] },
      updatedAt: { $gte: cutoff }
    })
    .toArray();

  const cwlActiveClans = new Set(activeCwl.map(w => w.clanTag));
  const cwlActive = cwlActiveClans.size;

  // membersDelta4w
  let membersDelta4w = null;
  try {
    const fourWeeksAgo = new Date(now - 28 * 24 * 60 * 60 * 1000);
    const dateStr = fourWeeksAgo.toISOString().split('T')[0];
    const snaps = await db.collection('player_snapshots')
      .aggregate([
        { $match: { snapshotDate: dateStr } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]).toArray();
    if (snaps.length > 0) {
      membersDelta4w = totalMembers - snaps[0].count;
    }
  } catch { /* ignore */ }

  cache = { clans: totalClans, members: totalMembers, enWar, cwlActive, trends: { membersDelta4w } };
  cacheTime = Date.now();

  return ok(cache);
};
