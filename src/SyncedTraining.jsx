import React, { useCallback, useEffect, useRef, useState } from 'react';
import FlexibleTraining from './FlexibleTraining.jsx';
import { readTrainingCache, writeTrainingCache, mutationsBetween } from './trainingSync.mjs';

export default function SyncedTraining() {
  const journal = useRef(readTrainingCache(localStorage));
  const [state, setState] = useState(journal.current?.state || null);
  const [status, setStatus] = useState(journal.current?.queue.length ? 'Pending sync' : 'Loading…');
  const [syncError, setSyncError] = useState('');
  const [hasConflict, setHasConflict] = useState(false);
  const running = useRef(false);
  const conflict = useRef(false);
  const mounted = useRef(true);
  const show = (setter, value) => { if (mounted.current) setter(value); };
  const synchronize = useCallback(async () => {
    if (running.current || conflict.current) return;
    running.current = true;
    let succeeded = false;
    try {
      show(setSyncError, '');
      while (journal.current?.queue.length) {
        show(setStatus, 'Saving…');
        const operations = journal.current.queue.slice(0, 10);
        const response = await fetch('/api/training', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operations }) });
        const data = await response.json();
        if (data.acknowledged?.length) {
          const saved = new Set(data.acknowledged);
          journal.current = { ...journal.current, queue: journal.current.queue.filter(op => !saved.has(op.id)) };
          writeTrainingCache(localStorage, journal.current);
        }
        if (!response.ok || data.error) {
          conflict.current = (data.status || response.status) === 409;
          show(setHasConflict, conflict.current);
          throw new Error(data.error || 'Could not save.');
        }
      }
      show(setStatus, 'Syncing…');
      const response = await fetch('/api/training', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.state) throw new Error(data.error || 'Could not load training.');
      // A set may have been logged while the refresh was in flight. Never replace it.
      if (!journal.current?.queue.length) {
        const next = { state: data.state, queue: [] };
        writeTrainingCache(localStorage, next); journal.current = next;
        localStorage.removeItem('gym_flexible_preview_v1');
        show(setState, data.state); show(setStatus, 'Saved');
      } else show(setStatus, 'Pending sync');
      succeeded = true;
    } catch (error) {
      show(setStatus, journal.current?.queue.length ? 'Pending sync' : 'Offline');
      show(setSyncError, error.message || 'Could not connect.');
    } finally { running.current = false; if (succeeded && journal.current?.queue.length) queueMicrotask(synchronize); }
  }, []);
  const persist = useCallback(next => {
    const previous = journal.current;
    const latest = readTrainingCache(localStorage);
    if (latest && JSON.stringify(latest) !== JSON.stringify(previous)) {
      journal.current = latest; setState(latest.state);
      throw new Error('Training changed in another tab. Try saving again.');
    }
    const operations = mutationsBetween(previous.state, next);
    const value = { state: next, queue: [...previous.queue, ...operations] };
    // Cache and outbox share one atomic storage entry. A failed write prevents the UI claiming success.
    writeTrainingCache(localStorage,value); journal.current = value;
    setStatus(value.queue.length ? 'Pending sync' : 'Saved');
    queueMicrotask(synchronize);
  }, [synchronize]);
  const retry = useCallback(() => { conflict.current = false; setHasConflict(false); synchronize(); },[synchronize]);
  const useNotion = useCallback(() => {
    if (!window.confirm('Discard pending changes on this device and reload from Notion? Export first to keep a copy.')) return;
    const next = { ...journal.current, queue: [] };
    writeTrainingCache(localStorage,next); journal.current=next;
    conflict.current=false; setHasConflict(false); synchronize();
  },[synchronize]);
  useEffect(() => {
    mounted.current = true; synchronize();
    const timer = setInterval(synchronize, 30000);
    const refresh = () => { if (document.visibilityState === 'visible') synchronize(); };
    const changed = event => {
      if (event.key !== 'fitness_notion_v1') return;
      const latest = readTrainingCache(localStorage);
      if (latest) { journal.current = latest; setState(latest.state); }
    };
    window.addEventListener('online',synchronize); document.addEventListener('visibilitychange',refresh); window.addEventListener('storage',changed);
    return () => { mounted.current = false; clearInterval(timer); window.removeEventListener('online',synchronize); document.removeEventListener('visibilitychange',refresh); window.removeEventListener('storage',changed); };
  }, [synchronize]);
  if (!state) return <main className="flex-app"><p role="status">{status}</p>{syncError && <p role="alert">{syncError}</p>}<button className="flex-secondary" onClick={synchronize}>Retry</button></main>;
  return <FlexibleTraining initialState={state} persist={persist} syncStatus={status} syncError={syncError} onSync={retry} hasConflict={hasConflict} onUseNotion={useNotion} />;
}
