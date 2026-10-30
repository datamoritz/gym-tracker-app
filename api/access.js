const access = require('./_lib/privateAccess');
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (req.method === 'GET') return res.status(200).json({ authenticated: access.authenticated(req) });
    if (req.method !== 'POST' || !access.sameOrigin(req) || !String(req.headers?.['content-type'] || '').startsWith('application/json')) return res.status(403).json({ error: 'Open the app to sign in.' });
    if (req.body?.action === 'logout') {
      res.setHeader('Set-Cookie', access.sessionCookie('').replace(`Max-Age=${access.YEAR}`, 'Max-Age=0'));
      return res.status(200).json({ ok: true });
    }
    if (req.body?.action === 'invite') {
      if (!access.requireAccess(req, res)) return;
      return res.status(200).json({ token: access.sign('invite', 15 * 60) });
    }
    if (!access.verify(req.body?.token, 'invite')) return res.status(401).json({ error: 'This access link has expired. Create another link from a signed-in device.' });
    res.setHeader('Set-Cookie', access.sessionCookie(access.sign('session', access.YEAR)));
    return res.status(200).json({ authenticated: true });
  } catch { return res.status(503).json({ error: 'Private access is not configured.' }); }
}
