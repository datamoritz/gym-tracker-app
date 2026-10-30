import React, { useEffect, useRef } from 'react';

// A visual bookmark only. Never enters the training state, outbox, or ranking.
export default function DailyStar({ children, name, starred, onToggle, tile = false }) {
  const gesture = useRef({ timer: null, held: false, start: null });
  const cancel = () => { clearTimeout(gesture.current.timer); gesture.current.timer = null; gesture.current.start = null; };
  useEffect(() => cancel, []);
  return <div className={`flex-star-card${tile ? ' is-tile' : ''}${starred ? ' is-starred' : ''}`}
    onPointerDown={event => {
      cancel(); gesture.current.held = false;
      if (event.button !== 0 || event.target.closest('.flex-star-toggle')) return;
      gesture.current.start = { x: event.clientX, y: event.clientY };
      gesture.current.timer = setTimeout(() => { gesture.current.held = true; onToggle(); }, 500);
    }}
    onPointerMove={event => { const start = gesture.current.start; if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) cancel(); }}
    onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel}
    onContextMenu={event => event.preventDefault()}
    onClickCapture={event => { if (gesture.current.held) { event.preventDefault(); event.stopPropagation(); gesture.current.held = false; } }}>
    {children}
    <button type="button" className="flex-star-toggle" aria-label={`${starred ? 'Unstar' : 'Star'} ${name} for today`} aria-pressed={starred}
      onClick={event => { event.stopPropagation(); onToggle(); }}><svg viewBox="0 0 24 24" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" /></svg></button>
  </div>;
}
