const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok } = require('./_auth');

const CLAN_TAGS = [
  '#90CLYR88', '#2JQYJ0PL9', '#2GGY8V0GR', '#2JCPQ8G0P',
  '#2RRJRL882', '#2J290PRQ2', '#2JVJC9LVL'
];

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const db = await getDb();
  const type = event.queryStringParameters?.type;

  if (type === 'leagues') {
    // Liga de guerra desde grupos_cwl (histórico)
    const grupos = await db.collection('grupos_cwl').find(
      { clanTag: { $in: CLAN_TAGS }, 'warLeague.name': { $exists: true } },
      { projection: { 'warLeague.name': 1 } }
    ).toArray();

    const ligas = [...new Set(grupos.map(g => g.warLeague?.name).filter(Boolean))].sort();
    return ok(ligas);
  }

  const [temporadas, clanes] = await Promise.all([
    db.collection('guerras_cwl').distinct('season', { season: { $ne: null } }),
    db.collection('clanes').find({}, { projection: { _id: 1, name: 1 } }).toArray()
  ]);

  return ok({
    temporadas: temporadas.sort().reverse(),
    clanes: clanes.map(c => ({ tag: c._id, nombre: c.name }))
  });
};
