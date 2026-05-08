const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok, err } = require('./_auth');

function mesActual() {
  return new Date().toISOString().substring(0, 7);
}

function mesAnterior(offset = 1) {
<br>  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return d.toISOString().substring(0, 7);
}

function calcStats(ataques) {
  if (!ataques || ataques.length === 0) return null;
  const total = ataques.length;
  const estrellas = ataques.reduce((s, a) => s + (a.stars || 0), 0);
  const tresEstrellas = ataques.filter(a => a.stars === 3).length;
  const rate = total > 0 ? Math.round((tresEstrellas / total) * 100) : 0;
  return { stars: estrellas, attacks: total, rate };
}

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const clanTag = event.queryStringParameters?.tag;
  if (!clanTag) return err('tag requerido');

  const db = await getDb();

  const mesAct = mesActual();
  const mesAnt = mesAnterior(1);
  const mesAnt2 = mesAnterior(2);

  // Info del clan
  const clan = await db.collection('clanes').findOne({ _id: clanTag });
  if (!clan) return err('Clan no encontrado', 404);

  // Miembros del clan
  const miembros = await db.collection('miembros').find({ clanTag }).toArray();
  if (miembros.length === 0) return ok({ clan: normalizeClan(clan), members: [], seasons: [], warLabels: [] });

  const tags = miembros.map(m => m._id);

  // Guerras regulares — mes actual y anterior
  const guerras = await db.collection('guerras').find({
    warMonth: { $in: [mesAct, mesAnt] },
    'miembros.tag': { $in: tags }
  }).toArray();

  // Guerras CWL — temporada actual y anterior
  const guerrasCwl = await db.collection('guerras_cwl').find({
    season: { $in: [mesAct, mesAnt] },
    'miembros.tag': { $in: tags }
  }).toArray();

  // Seasons para encabezados
  const seasons = [mesAct, mesAnt, mesAnt2];

  // Labels de guerra (meses con datos)
  const warMonths = [...new Set(guerras.map(g => g.warMonth))].sort().reverse();
  const warLabels = [warMonths[0] || mesAct, warMonths[1] || mesAnt];

  // Construir stats por jugador
  const members = miembros.map(m => {
    const tag = m._id;

    const ataquesWarAct = guerras
      .filter(g => g.warMonth === mesAct)
      .flatMap(g => (g.miembros || []).filter(p => p.tag === tag).flatMap(p => p.ataques || []));

    const ataquesWarAnt = guerras
      .filter(g => g.warMonth === mesAnt)
      .flatMap(g => (g.miembros || []).filter(p => p.tag === tag).flatMap(p => p.ataques || []));

    const ataquesCwlAct = guerrasCwl
      .filter(g => g.season === mesAct)
      .flatMap(g => (g.miembros || []).filter(p => p.tag === tag).map(p => p.ataque).filter(Boolean));

    const ataquesCwlAnt = guerrasCwl
      .filter(g => g.season === mesAnt)
      .flatMap(g => (g.miembros || []).filter(p => p.tag === tag).map(p => p.ataque).filter(Boolean));

    return {
      tag,
      name: m.name,
      role: m.role,
      townHallLevel: m.townHallLevel,
      trophies: m.trophies,
      league: m.leagueTier?.nombre || m.leagueTier?.name || 'Unranked',
      leagueId: m.leagueTier?.id || 0,
      leagueIconUrl: m.leagueTier?.iconUrl || m.leagueTier?.iconUrls?.small || null,
      war0: calcStats(ataquesWarAct),
      war1: calcStats(ataquesWarAnt),
      cwl0: calcStats(ataquesCwlAct),
      cwl1: calcStats(ataquesCwlAnt)
    };
  });

  return ok({
    clan: normalizeClan(clan),
    members,
    seasons,
    warLabels
  });
};

function normalizeClan(c) {
  return {
    ...c,
    tag: c._id,
    level: c.clanLevel,
    warLeague: c.warLeague?.name || 'Unranked',
    warLeagueIconUrl: c.warLeague?.iconUrls?.small || null
  };
}
