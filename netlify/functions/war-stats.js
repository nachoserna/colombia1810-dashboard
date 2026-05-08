const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok, err } = require('./_auth');

const CLAN_TAGS = [
  '#90CLYR88', '#2JQYJ0PL9', '#2GGY8V0GR', '#2JCPQ8G0P',
  '#2RRJRL882', '#2J290PRQ2', '#2JVJC9LVL'
];

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const params = event.queryStringParameters || {};
  const desde = params.desde; // formato YYYY-MM-DD
  const clansFiltro = params.clans ? params.clans.split(',') : CLAN_TAGS;

  const db = await getDb();

  // Convertir desde (YYYY-MM-DD) a warMonth (YYYY-MM) si existe
  const filtroWarMonth = desde ? { warMonth: { $gte: desde.substring(0, 7) } } : {};

  const guerras = await db.collection('guerras').find({
    ...filtroWarMonth,
    clanTag: { $in: clansFiltro },
    state: 'warEnded'
  }).toArray();

  const totalWars = guerras.length;

  if (totalWars === 0) return ok({ players: [], totalWars: 0 });

  // Miembros actuales
  const miembros = await db.collection('miembros').find({
    clanTag: { $in: clansFiltro }
  }).toArray();
  const miembrosMap = Object.fromEntries(miembros.map(m => [m._id, m]));

  // Clanes para nombres
  const clanes = await db.collection('clanes').find({
    _id: { $in: clansFiltro }
  }).toArray();
  const clanesMap = Object.fromEntries(clanes.map(c => [c._id, c.name]));

  // Acumular stats por jugador
  const statsMap = {};

  for (const guerra of guerras) {
    for (const m of (guerra.miembros || [])) {
      if (!statsMap[m.tag]) {
        statsMap[m.tag] = {
          tag: m.tag,
          name: m.name,
          townHallLevel: m.townHallLevel || 0,
          clanTag: guerra.clanTag,
          clanName: clanesMap[guerra.clanTag] || guerra.clanTag,
          wars: 0,
          attacks: 0,
          stars: 0,
          destruccion: 0,
          tresEstrellas: 0,
          noAtaco: 0,
          totalEsperados: 0
        };
      }

      const s = statsMap[m.tag];
      s.wars++;
      const esperados = guerra.attacksPerMember || 2;
      s.totalEsperados += esperados;

      for (const ataque of (m.ataques || [])) {
        s.attacks++;
        s.stars += ataque.stars || 0;
        s.destruccion += ataque.destructionPercentage || 0;
        if (ataque.stars === 3) s.tresEstrellas++;
      }

      if (!m.ataques || m.ataques.length === 0) s.noAtaco += esperados;
      else if (m.ataques.length < esperados) s.noAtaco += esperados - m.ataques.length;
    }
  }

  const players = Object.values(statsMap).map(s => {
    const miembro = miembrosMap[s.tag];
    const avgTrueStars = s.attacks > 0 ? (s.stars / s.attacks).toFixed(2) : '0.00';
    const threeStarRate = s.attacks > 0 ? Math.round((s.tresEstrellas / s.attacks) * 100) : 0;
    const avgDest = s.attacks > 0 ? Math.round(s.destruccion / s.attacks) : 0;
    const missedRate = s.totalEsperados > 0 ? Math.round((s.noAtaco / s.totalEsperados) * 100) : 0;

    return {
      tag: s.tag,
      name: s.name,
      townHallLevel: miembro?.townHallLevel || s.townHallLevel,
      clanName: s.clanName,
      wars: s.wars,
      attacks: s.attacks,
      missed: s.noAtaco,
      missedRate,
      stars: s.stars,
      avgTrueStars,
      avgDest,
      threeStarRate,
      leagueTier: miembro?.leagueTier || null,
      trophies: miembro?.trophies || null
    };
  });

  players.sort((a, b) => b.stars - a.stars || b.threeStarRate - a.threeStarRate);

  return ok({ players, totalWars });
};
