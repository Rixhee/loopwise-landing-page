import { clip, meta, classify } from '../../lib/util.js';

const ALLOWED = new Set(['page_view', 'engaged', 'section_view', 'click', 'faq_open', 'hero_toggle', 'version_click', 'restore_click']);

export async function onRequestPost({ request, env }) {
  let body = {};
  try {
    const text = await request.text();
    if (text.length > 4000) return new Response(null, { status: 204 });
    body = JSON.parse(text || '{}');
  } catch {}

  const name = clip(body.name, 40);
  if (!ALLOWED.has(name)) return new Response(null, { status: 204 });

  // Everything is stored, but suspected bots and our own visits are flagged
  // so the stats can leave them out (and you can still audit what was filtered).
  const m = meta(request);
  const c = classify(request, body);
  await env.DB.prepare(
    `INSERT INTO events (name, detail, source, campaign, referrer, path, visitor_id, country, user_agent, is_bot, bot_reason, internal, asn, as_org)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    name,
    clip(body.detail, 80),
    clip(body.source, 100),
    clip(body.campaign, 100),
    clip(body.referrer, 500),
    clip(body.path, 200),
    clip(body.vid, 64),
    m.country, m.ua,
    c.isBot, c.reason, c.internal, c.asn, c.asOrg
  ).run();

  return new Response(null, { status: 204 });
}
