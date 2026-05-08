const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const db = await getDb();

  const [clanes, miembros] = await Promise.all([
    db.collection('clanes').find({}).toArray(),
    db.collection('miembros').find({}).toArray()
  ]);

  // Agrupar miembros por clan
  const miembrosPorClan = {};
  for (const m of miembros) {
    if (!miembrosPorClan[m.clanTag]) miembrosPorClan[m.clanTag] = 0;
    miembrosPorClan[m.clanTag]++;
  }

  // Enriquecer clanes con conteo de miembros actuales
  const result = clanes.map(clan => ({
    ...clan,
    miembrosActuales: miembrosPorClan[clan._id] || 0
  }));

  return ok(result);
};
