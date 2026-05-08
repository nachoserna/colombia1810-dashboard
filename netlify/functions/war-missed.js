const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok, err } = require('./_auth');

const CLAN_TAGS = [
  '#90CLYR88', '#2JQYJ0PL9', '#2GGY8V0GR', '#2JCPQ8G0P',
  '#2RRJRL882', '#2J290PRQ2', '#2JVJC9LVL'
];

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const params = event.queryStringParameters || {};
  const desde = params.desde;
  const clansFiltro = params.clans ? params.clans.split(',') : CLAN_TAGS;

  const db = await getDb();

  const filtroWarMonth = desde ? { warMonth: { $gte: desde.substring(0, 7) } } : {};

  const guerras = await db.collection('guerras').find({
    ...filtroWarMonth,
    clanTag: { $in: clansFiltro },
    state: 'warEnded'
  }).toArray();

  const clanes = await db.collection('clanes').find({
    _id: { $in: clansFiltro }
  }).toArray();
  const clanesMap = Object.fromEntries(clanes.map(c => [c._id, c.name]));

  const missed = [];

  for (const guerra of guerras) {
    for (const m of (guerra.miembros || [])) {
      const ataques = m.ataques || [];
      const esperados = guerra.attacksPerMember || 2;

      if (ataques.length < esperados) {
        missed.push({
          name: m.name,
          tag: m.tag,
          clanName: clanesMap[guerra.clanTag] || guerra.clanTag,
          opponentName: guerra.oponente?.nombre || guerra.oponente?.tag || '?',
          missed: esperados - ataques.length,
          warDate: guerra.endTime,
          teamSize: guerra.teamSize || 0
        });
      }
    }
  }

  missed.sort((a, b) => (b.warDate || '').localeCompare(a.warDate || ''));

  return ok(missed);
};
