import React from 'react';

const paths = {
  next: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" />,
  targets: <path d="m5 12 4 4L19 6" />,
  exercises: <><circle cx="12" cy="5" r="2" /><path d="M12 9v8M12 11 4 7m8 4 8-4M12 17l-4 5m4-5 4 5M3 5v4m18-4v4" /></>,
  library: <path d="M5 3v18h15M5 5h12v6M11 12h6v5h-6M11 17v4M17 17v4M17 5h4v6h-4" />,
  history: <path d="M5 18v-4m5 4V9m5 9V5m5 13V3" />,
  pin: <><path d="M18 10c0 4-6 10-6 10S6 14 6 10a6 6 0 0 1 12 0Z" /><circle cx="12" cy="10" r="2" /></>,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  down: <path d="m7 10 5 5 5-5" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  back: <path d="m14 6-6 6 6 6" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m9 3 1-1h4l1 3 3 1 3 1v4l-2 2-1 3 1 3-3 2-3-1-3 1-3 1-2-3 1-3-1-3-2-2 1-3 3-1z" /></>,
  pull: <path d="M4 4h16M7 4v6l5 4 5-4V4M12 14v7M8 21h8" />,
  row: <path d="M4 5v15h16M6 12h5l5 6M10 12l4-5 6 2M15 5h.1" />,
  press: <path d="M7 4v7m10-7v7M4 7h6m4 0h6M9 12v8m6-8v8M8 20h8M9 12h6M7 11l2 1m8-1-2 1" />,
  curl: <path d="m8 8 8 8M5 4 3 6l1 3 3 1 3-3-1-3-3-1M17 14l-3 3 1 3 3 1 3-3-1-3zM3 3l2 2m14 14 2 2" />,
  mat: <><rect x="3" y="7" width="18" height="11" rx="2" /><path d="M6 10h12M6 13h12M6 16h12" /></>
};
// Display only: these names never participate in entity matching or target credit.
export function exerciseGlyph(exercise) {
  const name = exercise?.name?.toLowerCase() || '';
  if (/row/.test(name)) return 'row';
  if (/pull|traction|tricep/.test(name)) return 'pull';
  if (/press/.test(name)) return 'press';
  if (/curl/.test(name)) return 'curl';
  return 'exercises';
}
export function equipmentGlyph(machine) {
  return /cable|pulldown|traction/i.test(machine?.name || '') ? 'pull' : /floor|mat/i.test(machine?.name || '') ? 'mat' : 'library';
}
export default function TrainingIcon({ name, className = '' }) {
  return <svg className={`training-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.exercises}</svg>;
}
