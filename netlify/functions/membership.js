const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const params = event.queryStringParameters || {};
  const clanTagFiltro = params.clan;
  const tipo = params.tipo; // 'ingreso' | 'salida' | undefined (todos)
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

  return ok(registros);
};
