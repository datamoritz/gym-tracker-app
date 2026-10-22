const normalizeName = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Names used by existing saved routines before the library entries were clarified.
const aliases = new Map([
  ['cablelateralraise', 'cablesinglearmlateralraise'],
  ['cabletricepspushdown', 'cabletricepspushdownstraightbar'],
  ['overheadtricepextensiontwoarm', 'overheadtricepextension'],
  ['overheadtricepextensiononearm', 'overheadtricepextensionsinglearm']
]);

const canonicalName = value => {
  const name = normalizeName(value);
  return aliases.get(name) || name;
};

export function findExerciseGuide(exercise, library = []) {
  if (!exercise) return null;
  const id = exercise.notionExerciseId || exercise.id;
  const byId = library.find(item => item.id === id);
  if (byId) return byId;
  const name = canonicalName(exercise.name);
  const matches = library.filter(item => canonicalName(item.name) === name);
  return matches.length === 1 ? matches[0] : null;
}

export function safeWebUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}
