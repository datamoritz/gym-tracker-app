import React, { useEffect, useRef, useState } from 'react';
import { exerciseNote, saveExerciseNote } from './exerciseNotes.mjs';

export default function ExerciseNote({ state, exerciseId, commit }) {
  const saved = exerciseNote(state, exerciseId);
  const [draft, setDraft] = useState(saved.text);
  const pending = useRef({ text: saved.text, dirty: false });
  const flush = useRef(null);
  const fieldId = React.useId();
  flush.current = () => {
    const value = pending.current;
    if (!value.dirty) return;
    if (commit(previous => saveExerciseNote(previous, exerciseId, value.text))) value.dirty = false;
  };
  useEffect(() => {
    if (!pending.current.dirty) { pending.current.text = saved.text; setDraft(saved.text); }
  }, [saved.text]);
  useEffect(() => {
    if (!pending.current.dirty) return;
    const timeout = setTimeout(() => flush.current(), 800);
    return () => clearTimeout(timeout);
  }, [draft]);
  // Also flush when switching exercises or views before the debounce finishes.
  useEffect(() => {
    const save = () => flush.current();
    const hide = () => { if (document.hidden) save(); };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', hide);
    return () => { window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', hide); save(); };
  }, []);
  const updated = saved.updatedAt && Number.isFinite(Date.parse(saved.updatedAt)) ? new Date(saved.updatedAt) : null;
  return <div className="flex-exercise-note flex-field">
    <div><label htmlFor={fieldId}>Note</label>{updated && <time dateTime={updated.toISOString()} title={updated.toLocaleString(undefined, { timeZone: state.timeZone })}>{updated.toLocaleString(undefined, { timeZone: state.timeZone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>}</div>
    <textarea id={fieldId} rows="2" maxLength="5000" value={draft} onChange={event => { pending.current = { text: event.target.value, dirty: true }; setDraft(event.target.value); }} onBlur={() => flush.current()} />
  </div>;
}
