import { json, clip, readJson, meta, looksLikeBot, classify, EMAIL_RE } from '../../lib/util.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Request too large.' }, 413); }

  // Pretend success for bots so they don't retry.
  if (looksLikeBot(body)) return json({ ok: true });

  const email = clip(body.email, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);

  const m = meta(request);
  // A signup is never rejected for looking like a bot (real people use VPNs);
  // it's just flagged, and "internal" marks our own test signups.
  const c = classify(request, body);
  const existing = await env.DB.prepare('SELECT id FROM signups WHERE email = ?').bind(email).first();
  await env.DB.prepare(
    `INSERT INTO signups (email, listings, location, source, campaign, referrer, visitor_id, country, region, city, user_agent, internal, bot_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       listings = COALESCE(NULLIF(excluded.listings, ''), signups.listings)`
  ).bind(
    email,
    clip(body.listings, 40),
    clip(body.location, 20),
    clip(body.source, 100),
    clip(body.campaign, 100),
    clip(body.referrer, 500),
    clip(body.vid, 64),
    m.country, m.region, m.city, m.ua,
    c.internal, c.reason
  ).run();

  if (existing) return json({ ok: true, already: true });

  await env.DB.prepare(
    `INSERT INTO events (name, detail, source, campaign, referrer, path, visitor_id, country, user_agent, is_bot, bot_reason, internal, asn, as_org)
     VALUES ('signup', ?, ?, ?, ?, '/', ?, ?, ?, 0, ?, ?, ?, ?)`
  ).bind(clip(body.location, 20), clip(body.source, 100), clip(body.campaign, 100), clip(body.referrer, 500), clip(body.vid, 64), m.country, m.ua,
    c.reason, c.internal, c.asn, c.asOrg).run();

  return json({ ok: true, already: false });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
