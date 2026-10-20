import { json, isAdmin } from '../../../lib/util.js';

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
  const db = env.DB;
  const one = (sql) => db.prepare(sql).first();
  const all = async (sql) => (await db.prepare(sql).all()).results;

  const [visitors, views, signups, messages] = await Promise.all([
    one(`SELECT COUNT(DISTINCT visitor_id) AS n FROM events WHERE name = 'page_view' AND visitor_id <> ''`),
    one(`SELECT COUNT(*) AS n FROM events WHERE name = 'page_view'`),
    one(`SELECT COUNT(*) AS n FROM signups`),
    one(`SELECT COUNT(*) AS n FROM messages`)
  ]);

  const [bySource, byDay, sections, faqs, interactions, listings, byCountry, recentSignups, recentMessages] = await Promise.all([
    all(`SELECT COALESCE(NULLIF(v.source, ''), '(direct)') AS source,
                COUNT(DISTINCT v.visitor_id) AS visitors,
                COUNT(DISTINCT s.email) AS signups
         FROM events v
         LEFT JOIN signups s ON s.visitor_id = v.visitor_id AND s.visitor_id <> ''
         WHERE v.name = 'page_view'
         GROUP BY 1 ORDER BY visitors DESC LIMIT 25`),
    all(`SELECT date(created_at) AS day,
                COUNT(DISTINCT CASE WHEN name = 'page_view' THEN visitor_id END) AS visitors,
                SUM(CASE WHEN name = 'signup' THEN 1 ELSE 0 END) AS signups
         FROM events WHERE created_at >= datetime('now', '-30 days')
         GROUP BY 1 ORDER BY 1`),
    all(`SELECT detail AS section, COUNT(DISTINCT visitor_id) AS visitors FROM events WHERE name = 'section_view' GROUP BY 1 ORDER BY visitors DESC`),
    all(`SELECT detail AS question, COUNT(*) AS opens FROM events WHERE name = 'faq_open' GROUP BY 1 ORDER BY opens DESC`),
    all(`SELECT name || CASE WHEN detail <> '' THEN ': ' || detail ELSE '' END AS action, COUNT(*) AS n
         FROM events WHERE name IN ('click', 'hero_toggle', 'version_click', 'restore_click') GROUP BY 1 ORDER BY n DESC`),
    all(`SELECT COALESCE(NULLIF(listings, ''), '(not given)') AS listings, COUNT(*) AS n FROM signups GROUP BY 1 ORDER BY n DESC`),
    all(`SELECT COALESCE(NULLIF(country, ''), '??') AS country, COUNT(DISTINCT visitor_id) AS visitors FROM events WHERE name = 'page_view' GROUP BY 1 ORDER BY visitors DESC LIMIT 15`),
    all(`SELECT email, listings, location, source, country, created_at FROM signups ORDER BY id DESC LIMIT 50`),
    all(`SELECT name, email, message, created_at FROM messages ORDER BY id DESC LIMIT 50`)
  ]);

  return json({
    totals: { visitors: visitors.n, pageViews: views.n, signups: signups.n, messages: messages.n,
      conversion: visitors.n ? signups.n / visitors.n : 0 },
    bySource, byDay, sections, faqs, interactions, listings, byCountry, recentSignups, recentMessages
  });
}
