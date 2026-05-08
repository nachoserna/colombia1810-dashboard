const { getDb } = require('./_db');
const { verifyToken, unauthorized, ok, err } = require('./_auth');

const CLAN_TAGS = [
  '#90CLYR88', '#2JQYJ0PL9', '#2GGY8V0GR', '#2JCPQ8G0P',
  '#2RRJRL882', '#2J290PRQ2', '#2JVJC9LVL'
];

exports.handler = async (event) => {
  if (!verifyToken(event)) return unauthorized();

  const params = event.queryStringParameters || {};
  const warMonth = params.month;
  const clanTagFiltro = params.clan;

  if (!warMonth) return err('month requerido (YYYY-MM)');

  const db = await getDb();

  const clanTagsFiltro = clanTagFiltro ? [clanTagFiltro] : CLAN_TAGS;

  const guerras = await db.collection('guerras').find({
    warMonth,
    clanTag: { $in: clanTagsFiltro },
    state: 'warEnded'
  }).toArray();

  if (guerras.length === 0) return ok([]);

  // Buscar jugadores que no atacaron
  const missed = [];

  for (const guerra of guerras) {
    for (const m of (guerra.miembros || [])) {
      const ataques = m.ataques || [];
      const esperados = guerra.attacksPerMember || 2;

      if (ataques.length < esperados) {
        missed.push({
          jugadorTag: m.tag,
          jugadorNombre: m.name,
          clanTag: guerra.clanTag,
          warId: guerra._id,
          endTime: guerra.endTime,
          warMonth: guerra.warMonth,
          ataquesRealizados: ataques.length,
          ataquesEsperados: esperados,
          ataquesPerdidos: esperados - ataques.length
        });
      }
    }
  }

  // Ordenar por fecha desc
  missed.sort((a, b) => b.endTime?.localeCompare(a.endTime));

  return ok(missed);
};
