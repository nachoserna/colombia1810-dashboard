const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const params = event.queryStringParameters || {};
  const clanTagFiltro = params.clan;
  const tipo = params.tipo; // 'ingreso' | 'salida' | undefined
  const limit = parseInt(params.limit) || 100;

  const db = await getDb();

  const filtro = {};
  if (clanTagFiltro) filtro.clanTag = clanTagFiltro;
  if (tipo) filtro.tipo = tipo;

  const registros = await db.collection('rotacion')
    .find(filtro)
    .sort({ fecha: -1 })
    .limit(limit)
    .toArray();

  // Normalizar para el frontend — usa e.event, e.name, e.timestamp, e.clanName
  const result = registros.map(r => ({
    ...r,
    event: r.tipo === 'ingreso' ? 'joined' : 'left',
    name: r.jugadorNombre,
    timestamp: r.fecha,
    clanName: r.clanNombre
  }));

  return ok(result);
};
