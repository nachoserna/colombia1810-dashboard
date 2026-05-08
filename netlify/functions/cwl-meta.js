const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const db = await getDb();

  const [temporadas, clanes] = await Promise.all([
    db.collection('guerras_cwl').distinct('season', { season: { $ne: null } }),
    db.collection('clanes').find({}, { projection: { _id: 1, name: 1 } }).toArray()
  ]);

  return ok({
    temporadas: temporadas.sort().reverse(),
    clanes: clanes.map(c => ({ tag: c._id, nombre: c.name }))
  });
};
