import React from 'react';

export default function RestTimer({ timer, onReduce, onDismiss }) {
  if (!timer.visible) return null;
  return <aside className="flex-rest-timer" aria-label="Rest timer">
    <div><span className="flex-rest-label">{timer.remaining > 0 ? 'Rest' : 'Rest complete'}</span><span className="flex-rest-time" role="timer">{Math.floor(timer.remaining / 60)}:{String(timer.remaining % 60).padStart(2, '0')}</span></div>
    <div className="flex-rest-actions">
      {!timer.soundReady && (timer.remaining > 0 || !timer.alerted) && <button type="button" aria-label="Enable timer sound" title="Enable sound" onClick={timer.enableSound}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></svg></button>}
      {timer.remaining > 0 && <button type="button" aria-label="Reduce rest by 15 seconds" onClick={onReduce}>-15s</button>}
      <button type="button" className="flex-rest-skip" onClick={onDismiss}>{timer.remaining > 0 ? 'Skip' : 'Dismiss'}</button>
    </div>
  </aside>;
}
