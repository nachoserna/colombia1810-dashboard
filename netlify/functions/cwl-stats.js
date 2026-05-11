const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

const CLAN_TAGS = [
  '#90CLYR88', '#2JQYJ0PL9', '#2GGY8V0GR', '#2JCPQ8G0P',
  '#2RRJRL882', '#2J290PRQ2', '#2JVJC9LVL'
];

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const params = event.queryStringParameters || {};
  const desde = params.desde;
  const clansFiltro = params.clans ? params.clans.split(',') : CLAN_TAGS;

  const db = await getDb();

  const filtroSeason = desde ? { season: { $gte: desde } } : {};

  const guerras = await db.collection('guerras_cwl').find({
    ...filtroSeason,
    clanTag: { $in: clansFiltro }
  }).toArray();

  const totalWars = guerras.length;
  if (totalWars === 0) return ok({ players: [], totalWars: 0 });

  const miembros = await db.collection('miembros').find({ clanTag: { $in: clansFiltro } }).toArray();
  const miembrosMap = Object.fromEntries(miembros.map(m => [m._id, m]));

  const clanes = await db.collection('clanes').find({ _id: { $in: clansFiltro } }).toArray();
  const clanesMap = Object.fromEntries(clanes.map(c => [c._id, c.name]));

  const statsMap = {};

  for (const guerra of guerras) {
    // Los miembros están en clan.members (estructura original de la API)
    // El clan que es nuestro está identificado por clanTag
    const nuestroClan = guerra.clan?.tag === guerra.clanTag ? guerra.clan : guerra.opponent;
    const miembrosGuerra = nuestroClan?.members || [];

    for (const m of miembrosGuerra) {
      if (!statsMap[m.tag]) {
        statsMap[m.tag] = {
          tag: m.tag,
          name: m.name,
          townHallLevel: m.townhallLevel || m.townHallLevel || 0,
          clanTag: guerra.clanTag,
          clanName: clanesMap[guerra.clanTag] || guerra.clanTag,
          wars: 0, attacks: 0, stars: 0, destruccion: 0,
          tresEstrellas: 0, noAtaco: 0, defStars: 0, defCount: 0,
          mapPositionSum: 0, mapPositionCount: 0
        };
      }

      const s = statsMap[m.tag];
      s.wars++;

      const ataques = m.attacks || [];
      if (ataques.length > 0) {
        for (const ataque of ataques) {
          s.attacks++;
          s.stars += ataque.stars || 0;
          s.destruccion += ataque.destructionPercentage || 0;
          if (ataque.stars === 3) s.tresEstrellas++;
          // Buscar mapPosition del defensor
          const defensor = miembrosGuerra.find(x => x.tag === ataque.defenderTag);
          if (defensor?.mapPosition) { s.mapPositionSum += defensor.mapPosition; s.mapPositionCount++; }
        }
      } else {
        s.noAtaco++;
      }

      if (m.bestOpponentAttack) {
        s.defStars += m.bestOpponentAttack.stars || 0;
        s.defCount++;
      }
    }
  }

  const players = Object.values(statsMap).map(s => {
    const miembro = miembrosMap[s.tag];
    const avgStars = s.attacks > 0 ? (s.stars / s.attacks).toFixed(2) : '0.00';
    const threeStarRate = s.attacks > 0 ? Math.round((s.tresEstrellas / s.attacks) * 100) : 0;
    const avgDest = s.attacks > 0 ? Math.round(s.destruccion / s.attacks) : 0;
    const avgDefStars = s.defCount > 0 ? (s.defStars / s.defCount).toFixed(2) : '0.00';

    return {
      tag: s.tag,
      name: s.name,
      townHallLevel: miembro?.townHallLevel || s.townHallLevel,
      clanName: s.clanName,
      wars: s.wars,
      attacks: s.attacks,
      missed: s.noAtaco,
      stars: s.stars,
      avgStars,
      avgTrueStars: avgStars,
      avgDest,
      threeStarRate,
      avgDefStars,
      leagueTier: miembro?.leagueTier || null,
      trophies: miembro?.trophies || null,
      avgMapPosition: s.mapPositionCount > 0 ? (s.mapPositionSum / s.mapPositionCount).toFixed(1) : null
    };
  });

  players.sort((a, b) => b.stars - a.stars || b.threeStarRate - a.threeStarRate);

  return ok({ players, totalWars });
};
