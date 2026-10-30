import React, { useEffect, useState } from 'react';
import './flexible.css';
export default function PrivateAccess({ children }) {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('access'));
  useEffect(() => {
    let cancelled = false;
    // Remove the credential before rendering anything that could load external images.
    if (token) history.replaceState(null, '', location.pathname + location.search);
    (async () => {
      try {
        const response = await fetch('/api/access', token ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) } : { cache: 'no-store' });
        const data = await response.json();
        if (!cancelled) { setStatus(data.authenticated ? 'ready' : 'locked'); setError(data.error || ''); }
      } catch { if (!cancelled) { setStatus('locked'); setError('Could not connect. Try again.'); } }
    })();
    return () => { cancelled = true; };
  }, []);
  if (status === 'ready') return children;
  return <main className="flex-app"><section className="flex-panel" style={{ marginTop: '20vh' }}><h1>Training</h1>
    <p>{status === 'loading' ? 'Opening…' : 'Open your private access link to sign in.'}</p>
    {error && <p role="alert">{error}</p>}
    {status === 'locked' && <button className="flex-secondary" onClick={() => location.reload()}>Retry</button>}
  </section></main>;
}
