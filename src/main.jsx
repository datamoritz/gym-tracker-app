import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import PrivateAccess from './PrivateAccess.jsx';
import SyncedTraining from './SyncedTraining.jsx';
import { readAppearance, applyBrowserAppearance } from './trainingAppearance.mjs';

if (new URLSearchParams(window.location.search).get('mode') !== 'routines') {
  try { applyBrowserAppearance(document, readAppearance(localStorage)); } catch { applyBrowserAppearance(document, {}); }
}

const FlexibleTraining = import.meta.env.DEV ? React.lazy(() => import('./FlexibleTraining')) : null;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {import.meta.env.DEV && new URLSearchParams(window.location.search).get('mode') === 'preview'
      ? <React.Suspense fallback={<p style={{ padding: 32 }}>Opening…</p>}><FlexibleTraining /></React.Suspense>
      : <PrivateAccess>{new URLSearchParams(window.location.search).get('mode') === 'routines' ? <App /> : <SyncedTraining />}</PrivateAccess>}
  </React.StrictMode>
);
