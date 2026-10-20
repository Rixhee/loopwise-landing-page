import { json, isAdmin } from '../../../lib/util.js';

const TABLES = {
  signups: 'SELECT id, email, listings, location, source, campaign, referrer, country, region, city, internal, bot_reason, created_at FROM signups ORDER BY id',
  messages: 'SELECT id, name, email, message, source, country, created_at FROM messages ORDER BY id',
  events: 'SELECT id, name, detail, source, campaign, referrer, path, visitor_id, country, is_bot, bot_reason, internal, asn, as_org, user_agent, created_at FROM events ORDER BY id'
};

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
  const table = new URL(request.url).searchParams.get('table') || 'signups';
  const sql = TABLES[table];
  if (!sql) return json({ error: 'Unknown table' }, 400);

  const { results } = await env.DB.prepare(sql).all();
  const cols = results.length ? Object.keys(results[0]) : [];
  const lines = [cols.join(',')].concat(results.map((r) => cols.map((c) => csvCell(r[c])).join(',')));

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="loopwise-${table}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store'
    }
  });
}
