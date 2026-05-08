const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const params = event.queryStringParameters || {};
  const clanTagFiltro = params.clan;

  const db = await getDb();

  const filtroMiembros = clanTagFiltro ? { clanTag: clanTagFiltro } : {};
  const miembros = await db.collection('miembros').find(filtroMiembros).toArray();

  if (miembros.length === 0) return ok([]);

  const tags = miembros.map(m => m._id);
  const miembrosMap = Object.fromEntries(miembros.map(m => [m._id, m]));

  const jugadores = await db.collection('jugadores').find({
    _id: { $in: tags }
  }).toArray();

  const result = jugadores.map(j => {
    const miembro = miembrosMap[j._id];

    // heroes es array: [{ name, level, maxLevel, village }]
    // Convertir a objeto { 'Barbarian King': 105, ... } para compatibilidad con el frontend
    const heroesObj = {};
    if (Array.isArray(j.heroes)) {
      for (const h of j.heroes) {
        if (h.village === 'home') heroesObj[h.name] = h.level;
      }
    }

    return {
      ...j,
      tag: j._id,
      heroes: heroesObj,
      league: j.leagueTier?.nombre || j.leagueTier?.name || 'Sin liga',
      rol: miembro?.role || null,
      clanRank: miembro?.clanRank || null,
      clanTag: miembro?.clanTag || null,
      clanNombre: miembro?.clanNombre || null
    };
  });

  result.sort((a, b) => (b.trophies || 0) - (a.trophies || 0));

  return ok(result);
};
