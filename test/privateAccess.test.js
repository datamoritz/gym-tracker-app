const test = require('node:test');
const assert = require('node:assert/strict');
const access = require('../api/_lib/privateAccess');

function configured(t) {
  const previous = process.env.FITNESS_AUTH_SECRET;
  process.env.FITNESS_AUTH_SECRET = 'test-only-auth-secret-with-at-least-32-characters';
  t.after(() => { if (previous === undefined) delete process.env.FITNESS_AUTH_SECRET; else process.env.FITNESS_AUTH_SECRET = previous; });
}
test('private tokens reject forgery, expiry and use of an invitation as a session', t => {
  configured(t);
  const token = access.sign('invite',60,1000000);
  assert.equal(access.verify(token,'invite',1000001),true);
  assert.equal(access.verify(token,'invite',1060000),false);
  assert.equal(access.verify(token,'session',1000001),false);
  assert.equal(access.verify(token + 'x','invite',1000001),false);
  assert.equal(access.verify(token + '.extra','invite',1000001),false);
  assert.equal(access.verify(null,'invite'),false);
});
test('all private API writes require both a session and same-origin JSON', t => {
  configured(t);
  const request = { method: 'POST', headers: { host: 'example.com', origin: 'https://example.com', 'content-type': 'application/json', cookie: `${access.COOKIE}=${access.sign('session',60)}` } };
  const response = () => ({ setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } });
  assert.equal(access.requireAccess(request,response()),true);
  let res = response();
  assert.equal(access.requireAccess({ ...request, headers: { ...request.headers, origin: 'https://attacker.example' } },res),false);
  assert.equal(res.code,403);
  res = response();
  assert.equal(access.requireAccess({ ...request, headers: { ...request.headers, cookie: '' } },res),false);
  assert.equal(res.code,401);
  assert.equal(access.requireAccess({ ...request, headers: { ...request.headers, 'content-type': 'text/plain' } },response()),false);
  assert.match(access.sessionCookie('token'), /HttpOnly; Secure; SameSite=Strict; Max-Age=31536000/);
});
