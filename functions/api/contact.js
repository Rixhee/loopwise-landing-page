import { json, clip, readJson, meta, looksLikeBot, EMAIL_RE } from '../../lib/util.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Message too long.' }, 413); }
  if (looksLikeBot(body)) return json({ ok: true });

  const email = clip(body.email, 254).toLowerCase();
  const message = clip(body.message, 5000);
  if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);
  if (!message) return json({ error: 'Please write a short message.' }, 400);

  const m = meta(request);
  await env.DB.prepare(
    `INSERT INTO messages (name, email, message, source, visitor_id, country, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(clip(body.name, 120), email, message, clip(body.source, 100), clip(body.vid, 64), m.country, m.ua).run();

  return json({ ok: true });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
