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

// ---------- Bot detection ----------
const BOT_UA = /bot\b|bot\/|crawl|spider|slurp|preview|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|scan|python|curl|wget|httpclient|okhttp|go-http|java\/|axios|node-fetch|undici|libwww|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|vkshare|quora link|bitly|linkcheck|validator|feedfetcher/i;

// Hosting/cloud networks: real shoppers browse from home or mobile ISPs, scanners run here.
// Deliberately NOT listed: Cloudflare, Akamai, Fastly (they carry Apple iCloud Private Relay users).
const DATACENTER_ORG = /amazon|aws|google cloud|google llc|microsoft|azure|digitalocean|ovh|hetzner|linode|akamai connected cloud|vultr|choopa|oracle|alibaba|tencent|huawei cloud|contabo|leaseweb|scaleway|m247|datacamp|cdn77|hostinger|ionos|godaddy|hostroyale|colocrossing|psychz|quadranet|servers\.com|packet|equinix|zenlayer|g-core|gcore|kamatera|upcloud|netcup|aeza|stark industries|pfcloud|bl networks|censys|shodan|internet measurement/i;

export function classify(request, body = {}) {
  const cf = request.cf || {};
  const ua = request.headers.get('user-agent') || '';
  const asOrg = String(cf.asOrganization || '');
  let reason = '';
  if (!ua) reason = 'no-user-agent';
  else if (BOT_UA.test(ua)) reason = 'bot-user-agent';
  else if (body.automation) reason = 'automation:' + clip(body.automation, 30);
  else if (!/Mozilla\/5\.0/.test(ua)) reason = 'non-browser';
  else if (!request.headers.get('accept-language')) reason = 'no-accept-language';
  else if (DATACENTER_ORG.test(asOrg)) reason = 'datacenter';
  return {
    isBot: reason ? 1 : 0,
    reason,
    internal: Number(body.internal) === 1 ? 1 : 0,
    asn: Number(cf.asn) || 0,
    asOrg: clip(asOrg, 80)
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
