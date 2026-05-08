const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok, err } = require('./_auth');

const CLAN_TAGS = [
  '#90CLYR88', '#2JQYJ0PL9', '#2GGY8V0GR', '#2JCPQ8G0P',
  '#2RRJRL882', '#2J290PRQ2', '#2JVJC9LVL'
];

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const params = event.queryStringParameters || {};
  const warMonth = params.month;
  const clanTagFiltro = params.clan;

  if (!warMonth) return err('month requerido (YYYY-MM)');

  const db = await getDb();

  const clanTagsFiltro = clanTagFiltro ? [clanTagFiltro] : CLAN_TAGS;

  const guerras = await db.collection('guerras').find({
    warMonth,
    clanTag: { $in: clanTagsFiltro }
  }).toArray();

  if (guerras.length === 0) return ok([]);

  // Miembros actuales
  const miembros = await db.collection('miembros').find({
    clanTag: { $in: clanTagsFiltro }
  }).toArray();
  const miembrosMap = Object.fromEntries(miembros.map(m => [m._id, m]));

  // Acumular stats por jugador
  const statsMap = {};

  for (const guerra of guerras) {
    for (const m of (guerra.miembros || [])) {
      if (!statsMap[m.tag]) {
        statsMap[m.tag] = {
          tag: m.tag,
          nombre: m.name,
          th: m.townHallLevel,
          clanTag: guerra.clanTag,
          ataques: 0,
          estrellas: 0,
          destruccion: 0,
          tresEstrellas: 0,
          noAtaco: 0
        };
      }

      const s = statsMap[m.tag];
      for (const ataque of (m.ataques || [])) {
        s.ataques++;
        s.estrellas += ataque.stars || 0;
        s.destruccion += ataque.destructionPercentage || 0;
        if (ataque.stars === 3) s.tresEstrellas++;
      }
      if (!m.ataques || m.ataques.length === 0) s.noAtaco++;
    }
  }

  const result = Object.values(statsMap).map(s => {
    const miembro = miembrosMap[s.tag];
    return {
      ...s,
      leagueTier: miembro?.leagueTier || null,
      trofeos: miembro?.trophies || null,
      rate: s.ataques > 0 ? Math.round((s.tresEstrellas / s.ataques) * 100) : 0,
      avgDestruccion: s.ataques > 0 ? Math.round(s.destruccion / s.ataques) : 0
    };
  });

  result.sort((a, b) => b.estrellas - a.estrellas || b.rate - a.rate);

  return ok(result);
};
