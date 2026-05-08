const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const db = await getDb();
  const type = event.queryStringParameters?.type;

  if (type === 'leagues') {
    // Ligas de guerra de los clanes rivales en guerras CWL
    const ligas = await db.collection('guerras_cwl').distinct('oponente.nombre', { 'oponente.nombre': { $ne: null } });
    return ok(ligas.sort());
  }

  // Default: temporadas + clanes
  const [temporadas, clanes] = await Promise.all([
    db.collection('guerras_cwl').distinct('season', { season: { $ne: null } }),
    db.collection('clanes').find({}, { projection: { _id: 1, name: 1 } }).toArray()
  ]);

  return ok({
    temporadas: temporadas.sort().reverse(),
    clanes: clanes.map(c => ({ tag: c._id, nombre: c.name }))
  });
};
