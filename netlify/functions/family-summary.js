const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 15 * 60 * 1000;

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  if (cache && Date.now() - cacheTime < CACHE_TTL) return ok(cache);

  const db = await getDb();

  const [clanes, miembros] = await Promise.all([
    db.collection('clanes').find({}).toArray(),
    db.collection('miembros').find({}).toArray()
  ]);

  const guerrasActivas = await db.collection('guerras').find({
    state: { $in: ['inWar', 'preparation'] }
  }).toArray();
  const enWar = new Set(guerrasActivas.map(g => g.clanTag)).size;

  const gruposCwlActivos = await db.collection('grupos_cwl').find({
    state: { $in: ['inWar', 'preparation'] }
  }).toArray();
  const cwlActive = new Set(gruposCwlActivos.map(g => g.clanTag)).size;

  // Campos alineados con el frontend: clans, members, enWar, cwlActive
  cache = { clans: clanes.length, members: miembros.length, enWar, cwlActive };
  cacheTime = Date.now();

  return ok(cache);
};
