const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok, err } = require('./_auth');

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

  // Filtro de temporada
  const filtroSeason = desde ? { season: { $gte: desde } } : {};

  const guerras = await db.collection('guerras_cwl').find({
    ...filtroSeason,
    clanTag: { $in: clansFiltro }
  }).toArray();

  const totalWars = guerras.length;

  if (totalWars === 0) return ok({ players: [], totalWars: 0 });

  // Miembros actuales para info de liga y TH
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
          defStars: 0,
          defCount: 0
        };
      }

      const s = statsMap[m.tag];
      s.wars++;

      if (m.ataque) {
        s.attacks++;
        s.stars += m.ataque.stars || 0;
        s.destruccion += m.ataque.destructionPercentage || 0;
        if (m.ataque.stars === 3) s.tresEstrellas++;
      } else {
        s.noAtaco++;
      }

      if (m.mejorDefensaRecibida) {
        s.defStars += m.mejorDefensaRecibida.estrellas || m.mejorDefensaRecibida.stars || 0;
        s.defCount++;
      }
    }
  }

  // Calcular rates y enriquecer
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
      avgTrueStars: avgStars, // CWL solo tiene 1 ataque, true stars = stars
      avgDest,
      threeStarRate,
      avgDefStars,
      leagueTier: miembro?.leagueTier || null,
      trophies: miembro?.trophies || null
    };
  });

  // Ordenar por estrellas desc
  players.sort((a, b) => b.stars - a.stars || b.threeStarRate - a.threeStarRate);

  return ok({ players, totalWars });
};
