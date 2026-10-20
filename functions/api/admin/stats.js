import { json, isAdmin } from '../../../lib/util.js';

// A "real visitor" is a browser that
//   1. did something a person does (scrolled, tapped, clicked, typed, opened an FAQ, signed up...),
//   2. was not flagged as a bot on any of its events, and
//   3. is not one of us (?internal=1 or anyone who has opened /admin in that browser).
const REAL = `
  real AS (
    SELECT visitor_id FROM events
    WHERE visitor_id <> ''
    GROUP BY visitor_id
    HAVING MAX(is_bot) = 0
       AND MAX(internal) = 0
       AND SUM(name IN ('engaged','section_view','click','faq_open','hero_toggle','version_click','restore_click','signup')) > 0
  )`;

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
  const db = env.DB;
  const one = (sql) => db.prepare(sql).first();
  const all = async (sql) => (await db.prepare(sql).all()).results;

  const [real, raw, bots, internal, views, signups, messages] = await Promise.all([
    one(`WITH ${REAL} SELECT COUNT(*) AS n FROM real`),
    one(`SELECT COUNT(DISTINCT visitor_id) AS n FROM events WHERE name = 'page_view' AND visitor_id <> ''`),
    one(`SELECT COUNT(DISTINCT visitor_id) AS n FROM events WHERE is_bot = 1`),
    one(`SELECT COUNT(DISTINCT visitor_id) AS n FROM events WHERE internal = 1`),
    one(`WITH ${REAL} SELECT COUNT(*) AS n FROM events e JOIN real r USING (visitor_id) WHERE e.name = 'page_view'`),
    one(`SELECT COUNT(*) AS n FROM signups WHERE internal = 0`),
    one(`SELECT COUNT(*) AS n FROM messages`)
  ]);

  const [bySource, byDay, sections, faqs, interactions, listings, byCountry, filtered, recentSignups, recentMessages] = await Promise.all([
    all(`WITH ${REAL}
         SELECT COALESCE(NULLIF(e.source, ''), '(direct)') AS source,
                COUNT(DISTINCT e.visitor_id) AS visitors,
                COUNT(DISTINCT s.email) AS signups
         FROM events e
         JOIN real r USING (visitor_id)
         LEFT JOIN signups s ON s.visitor_id = e.visitor_id AND s.internal = 0
         WHERE e.name = 'page_view'
         GROUP BY 1 ORDER BY visitors DESC LIMIT 25`),
    all(`WITH ${REAL}
         SELECT date(e.created_at) AS day,
                COUNT(DISTINCT CASE WHEN e.name = 'page_view' THEN e.visitor_id END) AS visitors,
                SUM(e.name = 'signup') AS signups
         FROM events e JOIN real r USING (visitor_id)
         WHERE e.created_at >= datetime('now', '-30 days')
         GROUP BY 1 ORDER BY 1`),
    all(`WITH ${REAL}
         SELECT e.detail AS section, COUNT(DISTINCT e.visitor_id) AS visitors
         FROM events e JOIN real r USING (visitor_id)
         WHERE e.name = 'section_view' GROUP BY 1 ORDER BY visitors DESC`),
    all(`WITH ${REAL}
         SELECT e.detail AS question, COUNT(*) AS opens
         FROM events e JOIN real r USING (visitor_id)
         WHERE e.name = 'faq_open' GROUP BY 1 ORDER BY opens DESC`),
    all(`WITH ${REAL}
         SELECT e.name || CASE WHEN e.detail <> '' THEN ': ' || e.detail ELSE '' END AS action, COUNT(*) AS n
         FROM events e JOIN real r USING (visitor_id)
         WHERE e.name IN ('click', 'hero_toggle', 'version_click', 'restore_click')
         GROUP BY 1 ORDER BY n DESC`),
    all(`SELECT COALESCE(NULLIF(listings, ''), '(not given)') AS listings, COUNT(*) AS n
         FROM signups WHERE internal = 0 GROUP BY 1 ORDER BY n DESC`),
    all(`WITH ${REAL}
         SELECT COALESCE(NULLIF(e.country, ''), '??') AS country, COUNT(DISTINCT e.visitor_id) AS visitors
         FROM events e JOIN real r USING (visitor_id)
         WHERE e.name = 'page_view' GROUP BY 1 ORDER BY visitors DESC LIMIT 15`),
    all(`WITH ${REAL},
         v AS (
           SELECT visitor_id,
                  MAX(internal) AS internal,
                  MAX(is_bot) AS is_bot,
                  MAX(CASE WHEN is_bot = 1 THEN bot_reason END) AS reason,
                  MAX(CASE WHEN as_org <> '' THEN as_org END) AS network
           FROM events WHERE visitor_id <> '' GROUP BY visitor_id
         )
         SELECT CASE
                  WHEN v.internal = 1 THEN 'You / your team'
                  WHEN v.is_bot = 1 THEN 'Bot: ' || COALESCE(v.reason, '?')
                  ELSE 'Loaded the page but never interacted'
                END AS why,
                COUNT(*) AS visitors,
                GROUP_CONCAT(DISTINCT v.network) AS networks
         FROM v LEFT JOIN real r USING (visitor_id)
         WHERE r.visitor_id IS NULL
         GROUP BY 1 ORDER BY visitors DESC`),
    all(`SELECT email, listings, location, source, country, created_at,
                CASE WHEN internal = 1 THEN 'test (you)' WHEN bot_reason <> '' THEN 'check: ' || bot_reason ELSE '' END AS flag
         FROM signups ORDER BY id DESC LIMIT 50`),
    all(`SELECT name, email, message, created_at FROM messages ORDER BY id DESC LIMIT 50`)
  ]);

  return json({
    totals: {
      visitors: real.n,
      rawVisitors: raw.n,
      botVisitors: bots.n,
      internalVisitors: internal.n,
      pageViews: views.n,
      signups: signups.n,
      messages: messages.n,
      conversion: real.n ? signups.n / real.n : 0
    },
    bySource, byDay, sections, faqs, interactions, listings, byCountry, filtered, recentSignups, recentMessages
  });
}
