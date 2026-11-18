import { useEffect, useRef, useState } from 'react';
import { createRestAlarm, readRestTimer, restRemaining, restNeedsAlarm, newRestTimer } from './restTimer.mjs';

export default function useRestTimer({ storageKey, initialDeadline, onError }) {
  const [timer, setTimer] = useState(() => { try { return readRestTimer(localStorage, storageKey, initialDeadline); } catch { return readRestTimer(null, storageKey, initialDeadline); } });
  const current = useRef(timer), error = useRef(onError);
  error.current = onError;
  const [now, setNow] = useState(Date.now());
  const [soundReady, setSoundReady] = useState(false);
  const alarm = useRef(null);
  const attempt = useRef({ pending: false, blocked: false });
  if (!alarm.current) alarm.current = createRestAlarm(() => window.AudioContext || window.webkitAudioContext);
  function save(next) {
    current.current = next; setTimer(next); setNow(Date.now());
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { error.current?.('Could not save timer changes in this browser.'); }
  }
  function check() {
    const at = Date.now(), value = current.current;
    setNow(previous => restRemaining(value, previous) === restRemaining(value, at) ? previous : at);
    if (!restNeedsAlarm(value, at) || attempt.current.pending || attempt.current.blocked) return;
    const activeAttempt = attempt.current;
    activeAttempt.pending = true;
    alarm.current.play().then(played => {
      if (current.current.deadline !== value.deadline || attempt.current !== activeAttempt) return;
      setSoundReady(played);
      if (played) save({ ...current.current, alerted: true });
      else activeAttempt.blocked = true;
    }).finally(() => { activeAttempt.pending = false; });
  }
  function enableSound() {
    // Called synchronously from the original click/keyboard gesture for iOS.
    return alarm.current.unlock().then(ready => { setSoundReady(ready); if (ready) { attempt.current.blocked = false; check(); } return ready; });
  }
  function start(deadline) {
    alarm.current.cancel(); attempt.current = { pending: false, blocked: false }; save(newRestTimer(deadline)); if (deadline > 0) enableSound();
  }
  function clear() { alarm.current.cancel(); attempt.current = { pending: false, blocked: false }; save(newRestTimer(0)); }
  useEffect(() => {
    const tick = setInterval(check, 250);
    const gesture = () => { if (current.current.deadline > Date.now()) enableSound(); };
    const wake = () => { if (!document.hidden) { attempt.current.blocked = false; check(); } };
    const changed = event => {
      if (event.key !== storageKey) return;
      alarm.current.cancel(); attempt.current = { pending: false, blocked: false };
      const next = readRestTimer(localStorage, storageKey);
      current.current = next; setTimer(next); check();
    };
    check();
    window.addEventListener('pointerdown', gesture); window.addEventListener('keydown', gesture);
    window.addEventListener('focus', wake); window.addEventListener('pageshow', wake);
    document.addEventListener('visibilitychange', wake); window.addEventListener('storage', changed);
    return () => {
      clearInterval(tick); alarm.current.dispose();
      window.removeEventListener('pointerdown', gesture); window.removeEventListener('keydown', gesture);
      window.removeEventListener('focus', wake); window.removeEventListener('pageshow', wake);
      document.removeEventListener('visibilitychange', wake); window.removeEventListener('storage', changed);
    };
  }, [storageKey]);
  return { visible: timer.deadline > 0, deadline: timer.deadline, alerted: timer.alerted, remaining: restRemaining(timer, now), soundReady,
    start, clear, enableSound,
    async testSound() {
      const pendingAlarm = restNeedsAlarm(current.current);
      if (!await enableSound() || !pendingAlarm && !await alarm.current.play()) error.current?.('Could not play sound. Try enabling audio in your browser.');
    }
  };
}
