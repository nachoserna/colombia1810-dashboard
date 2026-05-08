const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok, err } = require('./_auth');

function mesActual() {
  return new Date().toISOString().substring(0, 7);
}

function mesAnterior() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().substring(0, 7);
}

function calcStats(ataques) {
  if (!ataques || ataques.length === 0) return null;
  const stars = ataques.reduce((s, a) => s + (a.stars || 0), 0);
  const total = ataques.length;
  const threeStars = ataques.filter(a => a.stars === 3).length;
  const rate = total > 0 ? Math.round((threeStars / total) * 100) : 0;
  return { stars, attacks: total, rate };
}

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const clanTag = event.queryStringParameters?.tag;
  if (!clanTag) return err('tag requerido');

  const db = await getDb();
  const mesAct = mesActual();
  const mesAnt = mesAnterior();

  // Miembros del clan
  const miembros = await db.collection('miembros')
    .find({ clanTag })
    .toArray();

  if (miembros.length === 0) return ok([]);

  const tags = miembros.map(m => m._id);

  // Guerras regulares de todos los clanes de la familia — mes actual y anterior
  const guerras = await db.collection('guerras').find({
    warMonth: { $in: [mesAct, mesAnt] },
    'miembros.tag': { $in: tags }
  }).toArray();

  // Guerras CWL de todos los clanes — temporada actual y anterior
  const guerrasCwl = await db.collection('guerras_cwl').find({
    season: { $in: [mesAct, mesAnt] },
    'miembros.tag': { $in: tags }
  }).toArray();

  // Construir stats por jugador
  const result = miembros.map(m => {
    const tag = m._id;

    // Guerras regulares — mes actual
    const ataquesWarAct = guerras
      .filter(g => g.warMonth === mesAct)
      .flatMap(g => (g.miembros || []).filter(p => p.tag === tag).flatMap(p => p.ataques || []));

    // Guerras regulares — mes anterior
    const ataquesWarAnt = guerras
      .filter(g => g.warMonth === mesAnt)
      .flatMap(g => (g.miembros || []).filter(p => p.tag === tag).flatMap(p => p.ataques || []));

    // CWL — temporada actual
    const ataquesCwlAct = guerrasCwl
      .filter(g => g.season === mesAct)
      .flatMap(g => (g.miembros || []).filter(p => p.tag === tag).map(p => p.ataque).filter(Boolean));

    // CWL — temporada anterior
    const ataquesCwlAnt = guerrasCwl
      .filter(g => g.season === mesAnt)
      .flatMap(g => (g.miembros || []).filter(p => p.tag === tag).map(p => p.ataque).filter(Boolean));

    return {
      tag,
      nombre: m.name,
      rol: m.role,
      th: m.townHallLevel,
      trofeos: m.trophies,
      leagueTier: m.leagueTier,
      clanRank: m.clanRank,
      warActual: calcStats(ataquesWarAct),
      warAnterior: calcStats(ataquesWarAnt),
      cwlActual: calcStats(ataquesCwlAct),
      cwlAnterior: calcStats(ataquesCwlAnt)
    };
  });

  return ok(result);
};
