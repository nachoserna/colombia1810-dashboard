const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  if (cache && Date.now() - cacheTime < CACHE_TTL) return ok(cache);

  const db = await getDb();

  const [clanes, miembros] = await Promise.all([
    db.collection('clanes').find({}).toArray(),
    db.collection('miembros').find({}).toArray()
  ]);

  // KPIs
  const totalClanes = clanes.length;
  const totalMiembros = miembros.length;

  // En guerra: clanes con currentwar state inWar o preparation
  // Se deriva de la colección guerras — buscamos guerras con state activo
  const guerrasActivas = await db.collection('guerras').find({
    state: { $in: ['inWar', 'preparation'] }
  }).toArray();
  const enGuerra = new Set(guerrasActivas.map(g => g.clanTag)).size;

  // CWL activas: grupos con state inWar o preparation
  const gruposCwlActivos = await db.collection('grupos_cwl').find({
    state: { $in: ['inWar', 'preparation'] }
  }).toArray();
  const cwlActivas = new Set(gruposCwlActivos.map(g => g.clanTag)).size;

  cache = { clanes: totalClanes, miembros: totalMiembros, enGuerra, cwlActivas };
  cacheTime = Date.now();

  return ok(cache);
};
