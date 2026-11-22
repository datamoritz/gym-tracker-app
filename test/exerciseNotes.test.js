const test = require('node:test');
const assert = require('node:assert/strict');
const notes = import('../src/exerciseNotes.mjs');
const NOW = '2026-11-21T22:10:35.123Z';
function fixture() {
  return { exercises: [{ id: 'raise', name: 'Lateral raise' }, { id: 'press', name: 'Chest press' }], sets: [
    { id: 'old', exerciseId: 'raise', machineId: 'tower-1', note: 'Seat 4', performedAt: '2026-11-18T20:00:00Z' },
    { id: 'latest', exerciseId: 'raise', machineId: 'tower-2', note: 'Keep elbow soft', performedAt: '2026-11-20T20:00:00Z' },
    { id: 'empty', exerciseId: 'raise', note: '', performedAt: NOW },
    { id: 'demo', exerciseId: 'raise', note: 'Sample', demo: true, performedAt: NOW },
    { id: 'deleted', exerciseId: 'raise', note: 'Deleted', deleted: true, performedAt: NOW },
    { id: 'other', exerciseId: 'press', note: 'Different exercise', performedAt: NOW }
  ] };
}
test('the latest nonempty real note is restored by exercise ID across equipment and empty later sets', async () => {
  const { exerciseNote } = await notes;
  const state = fixture(), before = JSON.stringify(state);
  assert.deepEqual(exerciseNote(state, 'raise'), { text: 'Keep elbow soft', updatedAt: '2026-11-20T20:00:00Z' });
  assert.deepEqual(exerciseNote(state, 'missing'), { text: '', updatedAt: null });
  assert.equal(JSON.stringify(state), before);
});
test('personal notes save without a set, preserve historic logs, and survive reloads and renames', async () => {
  const { exerciseNote, saveExerciseNote } = await notes;
  const state = fixture(), next = saveExerciseNote(state, 'raise', ' New cue ', NOW);
  assert.equal(next.sets, state.sets);
  assert.deepEqual(exerciseNote(next, 'raise'), { text: 'New cue', updatedAt: '2026-11-21T22:10:00.000Z' });
  const restored = JSON.parse(JSON.stringify(next));
  restored.exercises[0].name = 'Renamed exercise';
  assert.equal(exerciseNote(restored, 'raise').text, 'New cue');
  assert.equal(saveExerciseNote(next, 'raise', 'New cue', '2026-11-22T00:00:00Z'), next, 'Reading/reusing a note must not update its timestamp');
  assert.equal(next.exercises[1], state.exercises[1]);
});
test('explicitly clearing a personal note does not resurrect old set notes', async () => {
  const { exerciseNote, saveExerciseNote } = await notes;
  const next = saveExerciseNote(fixture(), 'raise', '', NOW);
  assert.deepEqual(exerciseNote(next, 'raise'), { text: '', updatedAt: '2026-11-21T22:10:00.000Z' });
  assert.throws(() => saveExerciseNote(next, 'missing', 'x'), /missing/);
  assert.throws(() => saveExerciseNote(next, 'raise', 'x'.repeat(5001)), /5,000/);
});
