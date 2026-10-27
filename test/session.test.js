const test = require('node:test');
const assert = require('node:assert/strict');

test('session round-trip preserves logged sets, unlogged inputs, position and timer after a reload', async () => {
  const { readSession, saveSession, exerciseInput, sessionSetCount } = await import('../src/session.mjs');
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const exercise = { id: 'press', suggestedWeight: 20, targetReps: 10 };
  const draft = { version: 1, id: 'session', startedAt: '2026-10-26T19:00:00Z',
    routine: { id: 'A2', gym: '24h Fitness Ocean', exercises: [exercise] }, currentExerciseIndex: 0,
    workoutLog: { press: [{ id: 'set-1', w: 20, r: 8, weightUnit: 'kg' }] },
    inputs: { press: { weight: '22.5', reps: '12', note: 'Unsaved note' } }, targetEndTime: Date.now() + 60000
  };
  saveSession(storage, draft);
  const restored = readSession(storage);
  assert.deepEqual(restored, draft);
  assert.equal(sessionSetCount(restored), 1);
  assert.deepEqual(exerciseInput(exercise, restored.inputs, restored.workoutLog), draft.inputs.press);
});

test('unit changes only relabel a load and do not mutate earlier logged values', async () => {
  const { changeRoutineUnit, exerciseInput } = await import('../src/session.mjs');
  const routine = { exercises: [{ id: 'press', suggestedWeight: 20, weightUnit: 'kg' }] };
  const lbs = changeRoutineUnit(routine, 0, 'lbs');
  assert.equal(lbs.exercises[0].suggestedWeight, 20);
  assert.equal(lbs.exercises[0].weightUnit, 'lbs');
  assert.equal(routine.exercises[0].weightUnit, 'kg');
  const log = { press: [{ w: 20, r: 8, weightUnit: 'kg' }] };
  assert.equal(exerciseInput(lbs.exercises[0], {}, log).weight, 20);
  assert.equal(changeRoutineUnit(lbs, 0, 'kg').exercises[0].suggestedWeight, 20);
  assert.equal(log.press[0].weightUnit, 'kg');
});

test('preferences are shared within a gym and isolated between gyms', async () => {
  const { preferenceKey, gymName } = await import('../src/session.mjs');
  const exercise = { name: 'Chest Press', notionExerciseId: 'guide-1' };
  assert.notEqual(preferenceKey({ gym: '24h Fitness Ocean' }, exercise), preferenceKey({}, exercise));
  assert.equal(preferenceKey({ gym: '24h Fitness Ocean' }, exercise), preferenceKey({ gym: '24h Fitness Ocean' }, { ...exercise, name: 'Renamed press' }));
  assert.equal(gymName(), 'Previous gym');
});
