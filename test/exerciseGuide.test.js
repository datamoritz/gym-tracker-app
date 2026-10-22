const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRoutine } = require('../api/_lib/validation');

test('saved exercise links survive routine normalization and library renames', async () => {
  const { findExerciseGuide } = await import('../src/exerciseGuide.mjs');
  const routine = normalizeRoutine({ name: 'Push', exercises: [
    { id: 15, name: 'My cable raise', notionExerciseId: 'raise-page' }
  ] });
  assert.equal(routine.exercises[0].notionExerciseId, 'raise-page');
  const guide = { id: 'raise-page', name: 'Cable Single-Arm Lateral Raise' };
  assert.equal(findExerciseGuide(routine.exercises[0], [guide]), guide);
});

test('legacy routine names find their guides without confusing machine or arm variants', async () => {
  const { findExerciseGuide } = await import('../src/exerciseGuide.mjs');
  const library = [
    { id: 'raise', name: 'Cable Single-Arm Lateral Raise' },
    { id: 'bar', name: 'Cable Triceps Pushdown (Straight Bar)' },
    { id: 'one', name: 'Overhead Tricep Extension (single arm)' },
    { id: 'two', name: 'Overhead Tricep Extension' },
    { id: 'machine', name: 'Chest Fly' },
    { id: 'cable', name: 'Cable Chest Fly (low to high)' }
  ];
  for (const [name, id] of [
    ['Cable Lateral Raise', 'raise'], ['Cable Triceps Push Down', 'bar'],
    ['Overhead Tricep Extension (one arm)', 'one'], ['Overhead Tricep Extension (two arm)', 'two'],
    ['Chest Fly', 'machine'], ['Cable Chest Fly (low to high)', 'cable']
  ]) assert.equal(findExerciseGuide({ name }, library)?.id, id);
  assert.equal(findExerciseGuide({ name: 'Unknown movement' }, library), null);
  assert.equal(findExerciseGuide({ name: 'Chest Fly' }, [library[4], { id: 'duplicate', name: 'Chest fly' }]), null);
});

test('guide image and source URLs accept web links and reject executable or malformed links', async () => {
  const { safeWebUrl } = await import('../src/exerciseGuide.mjs');
  assert.equal(safeWebUrl('https://example.com/image.avif?signature=abc'), 'https://example.com/image.avif?signature=abc');
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', '/relative', '', null]) assert.equal(safeWebUrl(url), '');
});
