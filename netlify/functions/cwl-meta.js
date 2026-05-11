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
    // Obtener ligas de guerra de los grupos CWL de nuestros clanes
    const grupos = await db.collection('grupos_cwl').find(
      { clanTag: { $in: CLAN_TAGS } },
      { projection: { clans: 1 } }
    ).toArray();

    const ligas = new Set();
    for (const grupo of grupos) {
      for (const clan of (grupo.clans || [])) {
        if (clan.warLeague?.name) ligas.add(clan.warLeague.name);
      }
    }

    return ok([...ligas].sort());
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
