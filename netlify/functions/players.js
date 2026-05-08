const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const params = event.queryStringParameters || {};
  const clanTagFiltro = params.clan;

  const db = await getDb();

  // Obtener miembros activos (para saber en qué clan está cada uno)
  const filtroMiembros = clanTagFiltro ? { clanTag: clanTagFiltro } : {};
  const miembros = await db.collection('miembros').find(filtroMiembros).toArray();

  if (miembros.length === 0) return ok([]);

  const tags = miembros.map(m => m._id);
  const miembrosMap = Object.fromEntries(miembros.map(m => [m._id, m]));

  // Obtener info rica de jugadores
  const jugadores = await db.collection('jugadores').find({
    _id: { $in: tags }
  }).toArray();

  // Combinar info de miembros (rol, clanRank) con info rica de jugadores
  const result = jugadores.map(j => ({
    ...j,
    rol: miembrosMap[j._id]?.role || null,
    clanRank: miembrosMap[j._id]?.clanRank || null,
    clanTag: miembrosMap[j._id]?.clanTag || null,
    clanNombre: miembrosMap[j._id]?.clanNombre || null
  }));

  // Ordenar por trofeos desc
  result.sort((a, b) => (b.trophies || 0) - (a.trophies || 0));

  return ok(result);
};
