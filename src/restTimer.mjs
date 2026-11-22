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
export function createRestAlarm(getAudioContext, {
  createAudio = () => typeof Audio === 'undefined' ? null : new Audio('/rest-alarm.wav'),
  audioSession = () => globalThis.navigator?.audioSession
} = {}) {
  let context = null, media = null, primed = false, priming = null, generation = 0;
  const nodes = new Set();
  function configureOutput() {
    // A notification should mix with headphone music, rather than using the
    // default ambient Web Audio route (which can be silent on an iPhone).
    try { const session = audioSession(); if (session) session.type = 'transient'; } catch { /* Older browsers use their media output. */ }
  }
  function ensureMedia() {
    if (!media) { media = createAudio(); if (media) { media.preload = 'auto'; media.playsInline = true; media.volume = 1; } }
    return media;
  }
  function ensureContext() {
    try {
      if (!context || context.state === 'closed') {
        const AudioContext = getAudioContext();
        if (AudioContext) context = new AudioContext();
      }
    } catch { return null; }
    return context;
  }
  function cancel() {
    generation++;
    priming = null;
    try { media?.pause(); if (media) media.currentTime = 0; } catch { /* Not loaded yet. */ }
    for (const node of nodes) { try { node.stop(); node.disconnect(); } catch { /* Already ended. */ } }
    nodes.clear();
  }
  return {
    async unlock() {
      configureOutput();
      if (primed) return true;
      if (priming) return priming;
      const token = generation;
      const active = ensureContext();
      // Prime the fallback in this gesture too, even if loading the media file
      // later fails. A rejected resume remains a retryable audio failure.
      let resumed;
      try { resumed = Promise.resolve(active && active.state !== 'running' ? active.resume() : null).then(() => Boolean(active && active.state === 'running'), () => false); }
      catch { resumed = Promise.resolve(false); }
      try {
        const audio = ensureMedia();
        if (audio) {
          // play() must run in the original gesture, before any await. The file
          // starts with silence; pause immediately when playback is confirmed.
          const started = audio.play();
          const pending = Promise.resolve(started).then(() => {
            if (token !== generation) return false;
            audio.pause(); audio.currentTime = 0; primed = true; return true;
          }, () => false);
          priming = pending;
          const ready = await pending;
          if (priming === pending) priming = null;
          if (ready || token !== generation) return ready;
        }
        return await resumed && token === generation;
      } catch { return false; }
    },
    async play({ gesture = false } = {}) {
      configureOutput();
      const token = generation;
      const active = gesture ? ensureContext() : context;
      let resumed;
      try { resumed = Promise.resolve(active && active.state !== 'running' ? active.resume() : null).catch(() => {}); }
      catch { resumed = Promise.resolve(); }
      // In Settings this starts directly in the click handler. At expiry it
      // reuses the very same element already primed when the timer was started.
      try {
        const audio = gesture ? ensureMedia() : media;
        if (audio && (primed || gesture)) {
          audio.currentTime = 0;
          await audio.play();
          if (token !== generation) return false;
          primed = true; return true;
        }
      } catch { /* Fall back to synthesized audio if media playback failed. */ }
      if (!active || token !== generation) return false;
      try {
        await resumed;
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
    dispose() { cancel(); if (context) context.close().catch(() => {}); context = null; media = null; primed = false; }
  };
}
