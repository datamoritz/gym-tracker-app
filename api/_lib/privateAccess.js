const crypto = require('node:crypto');
const COOKIE = '__Host-fitness';
const YEAR = 365 * 24 * 60 * 60;
function secret() {
  if (!process.env.FITNESS_AUTH_SECRET || process.env.FITNESS_AUTH_SECRET.length < 32) throw new Error('Private access is not configured');
  return process.env.FITNESS_AUTH_SECRET;
}
function sign(type, ttl, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ type, exp: Math.floor(now / 1000) + ttl, nonce: crypto.randomBytes(16).toString('hex') })).toString('base64url');
  return `${body}.${crypto.createHmac('sha256', secret()).update(body).digest('base64url')}`;
}
function verify(token, type, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 2048) return false;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra) return false;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(signature), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try { const payload = JSON.parse(Buffer.from(body, 'base64url').toString()); return payload.type === type && Number.isFinite(payload.exp) && payload.exp > now / 1000; } catch { return false; }
}
function authenticated(req) {
  const token = String(req.headers?.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return verify(token, 'session');
}
function sameOrigin(req) {
  const origin = req.headers?.origin;
  const host = req.headers?.host;
  try { return Boolean(origin && host && new URL(origin).host === host && (new URL(origin).protocol === 'https:' || host.startsWith('localhost:') || host.startsWith('127.0.0.1:'))); } catch { return false; }
}
function requireAccess(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (!authenticated(req)) { res.status(401).json({ error: 'Open your private access link to sign in.' }); return false; }
    if (!['GET','HEAD'].includes(req.method) && (!sameOrigin(req) || !String(req.headers?.['content-type'] || '').startsWith('application/json'))) {
      res.status(403).json({ error: 'Use the app to make this change.' }); return false;
    }
    return true;
  } catch { res.status(503).json({ error: 'Private access is not configured.' }); return false; }
}
const sessionCookie = token => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${YEAR}`;
module.exports = { sign, verify, authenticated, sameOrigin, requireAccess, sessionCookie, COOKIE, YEAR };
