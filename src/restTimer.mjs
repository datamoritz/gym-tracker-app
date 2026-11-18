export const EMPTY_TIMER = Object.freeze({ deadline: 0, alerted: true });
export const MAX_ALERT_DELAY = 5 * 60 * 1000;
export const restRemaining = (timer, now = Date.now()) => Math.max(0, Math.ceil((timer.deadline - now) / 1000));
export const restNeedsAlarm = (timer, now = Date.now()) => timer.deadline > 0 && !timer.alerted && now >= timer.deadline && now - timer.deadline <= MAX_ALERT_DELAY;
export const newRestTimer = deadline => Number.isFinite(deadline) && deadline > 0 ? { deadline, alerted: false } : { ...EMPTY_TIMER };

export function readRestTimer(storage, key, legacyDeadline = 0, now = Date.now()) {
  try {
    const raw = storage.getItem(key);
    if (raw !== null) {
      const value = JSON.parse(raw);
      if (value && Number.isFinite(value.deadline) && value.deadline >= 0 && typeof value.alerted === 'boolean') {
        return value.deadline && now - value.deadline > MAX_ALERT_DELAY ? { ...EMPTY_TIMER } : value;
      }
    }
  } catch { /* An unavailable cache must not prevent the workout opening. */ }
  return legacyDeadline > now ? newRestTimer(legacyDeadline) : { ...EMPTY_TIMER };
}

// Uses the system audio output (including connected headphones). Create/resume
// only in response to a user gesture; no external audio download is needed.
export function createRestAlarm(getAudioContext) {
  let context = null, generation = 0;
  const nodes = new Set();
  function cancel() {
    generation++;
    for (const node of nodes) { try { node.stop(); node.disconnect(); } catch { /* Already ended. */ } }
    nodes.clear();
  }
  return {
    async unlock() {
      try {
        if (!context || context.state === 'closed') {
          const AudioContext = getAudioContext();
          if (!AudioContext) return false;
          context = new AudioContext();
        }
        if (context.state !== 'running') await context.resume();
        return context.state === 'running';
      } catch { return false; }
    },
    async play() {
      if (!context) return false;
      const token = generation, active = context;
      try {
        if (active.state !== 'running') await active.resume();
        if (token !== generation || active !== context || active.state !== 'running') return false;
        [0, .36, .72].forEach((offset, index) => {
          if (token !== generation) return;
          const oscillator = context.createOscillator(), gain = context.createGain();
          const start = context.currentTime + offset;
          oscillator.type = 'sine'; oscillator.frequency.value = index === 2 ? 1046.5 : 880;
          gain.gain.setValueAtTime(.001, start);
          gain.gain.exponentialRampToValueAtTime(.24, start + .015);
          gain.gain.exponentialRampToValueAtTime(.001, start + .28);
          oscillator.connect(gain); gain.connect(context.destination); nodes.add(oscillator);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); nodes.delete(oscillator); };
          oscillator.start(start); oscillator.stop(start + .3);
        });
        return true;
      } catch { cancel(); return false; }
    },
    cancel,
    dispose() { cancel(); if (context) context.close().catch(() => {}); context = null; }
  };
}
