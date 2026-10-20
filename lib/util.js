export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export function clip(v, n) {
  return String(v == null ? '' : v).trim().slice(0, n);
}

export async function readJson(request) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 20000) throw new Error('too large');
  try { return await request.json(); } catch { return {}; }
}

// Metadata Cloudflare attaches to every request (no cookies or fingerprinting needed).
export function meta(request) {
  const cf = request.cf || {};
  return {
    country: clip(cf.country, 8),
    region: clip(cf.region, 64),
    city: clip(cf.city, 64),
    ua: clip(request.headers.get('user-agent'), 300)
  };
}

// Bots fill the hidden "company" field, or submit faster than a human can type.
export function looksLikeBot(body) {
  if (body.company) return true;
  const elapsed = Number(body.elapsed || 0);
  return elapsed > 0 && elapsed < 1200;
}

export function isAdmin(request, env) {
  const key = env.ADMIN_KEY;
  if (!key) return false;
  const url = new URL(request.url);
  const given = url.searchParams.get('key') || (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return given.length > 0 && given === key;
}
