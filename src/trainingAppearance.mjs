// Browser-only presentation preferences. Never part of the Notion state/outbox.
export const APPEARANCE_KEY = 'fitness_appearance_v1';
export const THEMES = { night: 'Night', burgundy: 'Burgundy', carbon: 'Carbon' };
export const DEFAULT_APPEARANCE = { theme: 'night', darkness: 50, menuLift: 0, goalDay: '', dailyGoal: null };
const bounded = (value, fallback, maximum) => Number.isFinite(value) ? Math.min(maximum, Math.max(0, Math.round(value))) : fallback;
export function normalizeAppearance(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  return { theme: Object.hasOwn(THEMES, value.theme) ? value.theme : 'night',
    darkness: bounded(value.darkness, 50, 100), menuLift: bounded(value.menuLift, 0, 160),
    goalDay: /^\d{4}-\d{2}-\d{2}$/.test(value.goalDay || '') ? value.goalDay : '',
    dailyGoal: Number.isInteger(value.dailyGoal) && value.dailyGoal >= 1 && value.dailyGoal <= 100 ? value.dailyGoal : null };
}
export function readAppearance(storage) {
  try { return normalizeAppearance(JSON.parse(storage.getItem(APPEARANCE_KEY) || '{}')); }
  catch { return { ...DEFAULT_APPEARANCE }; }
}
export function writeAppearance(storage, value) { storage.setItem(APPEARANCE_KEY, JSON.stringify(normalizeAppearance(value))); }
const palettes = {
  night: { bg: '#0c1421', surface: '#152133', line: '#253348', soft: '#1a2d43', chip: '#1a2a3e', featured: '#213a57', 'featured-line': '#3c5878', nav: '#151f30', selected: '#29415d', ink: '#e5efff', muted: '#98a9c0', accent: '#a9d3fa', 'button-ink': '#122338' },
  burgundy: { bg: '#191216', surface: '#271d24', line: '#443039', soft: '#3b2630', chip: '#34242d', featured: '#4d2c39', 'featured-line': '#704553', nav: '#241a20', selected: '#4b303b', ink: '#f0e7ea', muted: '#bc9fa9', accent: '#d9a5b4', 'button-ink': '#2b1721' },
  carbon: { bg: '#030506', surface: '#0d1113', line: '#263135', soft: '#10272c', chip: '#172126', featured: '#1a2b30', 'featured-line': '#42616b', nav: '#0b1012', selected: '#203339', ink: '#e8f0f2', muted: '#8d9fa5', accent: '#b7ecf5', 'button-ink': '#091a1e' }
};
function tone(hex, darkness) {
  const amount = darkness >= 50 ? (darkness - 50) / 50 * .84 : (50 - darkness) / 50 * .10;
  const toward = darkness >= 50 ? 0 : 255;
  return '#' + hex.slice(1).match(/../g).map(value => { const n = parseInt(value,16); return Math.round(n + (toward - n) * amount).toString(16).padStart(2,'0'); }).join('');
}
export function appearanceStyle(value) {
  const prefs = normalizeAppearance(value);
  return { ...Object.fromEntries(Object.entries(palettes[prefs.theme]).map(([key,color]) => [`--${key}`, ['ink','muted','accent','button-ink'].includes(key) ? color : tone(color,prefs.darkness)])), '--menu-lift': `${prefs.menuLift}px` };
}

// Match browser chrome and overscroll/safe-area surfaces to the app palette.
export function applyBrowserAppearance(doc, value) {
  const color = appearanceStyle(value)['--bg'];
  const surfaces = [doc.documentElement, doc.body].filter(Boolean);
  const previous = surfaces.map(element => ({ element, color: element.style.backgroundColor, scheme: element.style.colorScheme }));
  const meta = doc.querySelector('meta[name="theme-color"]');
  const previousMeta = meta?.getAttribute('content');
  for (const element of surfaces) { element.style.backgroundColor = color; element.style.colorScheme = 'dark'; }
  meta?.setAttribute('content', color);
  return () => {
    for (const { element, color, scheme } of previous) { element.style.backgroundColor = color; element.style.colorScheme = scheme; }
    if (meta) { if (previousMeta === null) meta.removeAttribute('content'); else meta.setAttribute('content', previousMeta); }
  };
}
