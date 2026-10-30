const test = require('node:test');
const assert = require('node:assert/strict');
const lib = import('../src/flexible.mjs');

test('shared muscle IDs survive renames and storage reload without changing ranking', async () => {
  const api = await lib;
  let state = api.createFlexibleState('America/Los_Angeles');
  const target = state.targets.find(item => item.presetKey === 'chest');
  const machine = state.machines.find(item => item.exerciseId === target.exerciseIds[0]);
  state = api.addFlexibleSet(api.startFlexibleSession(state, '2026-10-29'), { targetId: target.id, machineId: machine.id, weight: 30, reps: 10, day: '2026-10-29', now: '2026-10-29T19:00:00Z' });
  const before = api.rankTargets(state, '2026-10-29', '2026-10-29T20:00:00Z').map(row => [row.target.id, row.score]);
  const renamed = { ...state, muscles: state.muscles.map(muscle => ({ ...muscle, name: `Renamed ${muscle.id.slice(0, 4)}` })) };
  const after = api.readFlexibleState({ getItem: () => JSON.stringify(renamed) });
  assert.deepEqual(after.exercises, state.exercises);
  assert.deepEqual(after.muscles, renamed.muscles);
  assert.deepEqual(api.rankTargets(after, '2026-10-29', '2026-10-29T20:00:00Z').map(row => [row.target.id, row.score]), before);
  const chest = state.exercises.find(exercise => exercise.id === target.exerciseIds[0]);
  const fly = state.exercises.find(exercise => exercise.catalogKey === 'fly:0');
  assert.equal(chest.primaryMuscleIds[0], fly.primaryMuscleIds[0]);
});

test('local exercise saves preserve catalog metadata and allow absent optional tags', async () => {
  const api = await lib;
  const state = api.createFlexibleState('America/Los_Angeles');
  const exercise = state.exercises[0];
  const saved = api.saveExercise(state, { id: exercise.id, name: 'Renamed', type: 'isolation', primaryMuscleIds: [], supportingMuscleIds: [] }).exercises[0];
  assert.equal(saved.type, exercise.type);
  assert.deepEqual(saved.primaryMuscleIds, exercise.primaryMuscleIds);
  assert.deepEqual(saved.supportingMuscleIds, exercise.supportingMuscleIds);
  const next = api.saveExercise(state, { name: 'New exercise' });
  assert.equal(next.exercises.at(-1).type, null);
  assert.deepEqual(next.exercises.at(-1).primaryMuscleIds, []);
  assert.doesNotThrow(() => api.rankTargets(next, '2026-10-29'));
});

test('legacy muscle labels migrate once without changing exercise or log IDs', async () => {
  const api = await lib;
  const original = api.createFlexibleState('America/Los_Angeles');
  const legacy = { ...original, musclesVersion: undefined, muscles: undefined,
    exercises: original.exercises.map(({ primaryMuscleIds, supportingMuscleIds, ...exercise }) => ({ ...exercise,
      primaryMuscles: primaryMuscleIds.map(id => original.muscles.find(muscle => muscle.id === id).name),
      supportingMuscles: supportingMuscleIds.map(id => original.muscles.find(muscle => muscle.id === id).name) })) };
  const migrated = api.readFlexibleState({ getItem: () => JSON.stringify(legacy) });
  assert.deepEqual(migrated.exercises.map(exercise => exercise.id), legacy.exercises.map(exercise => exercise.id));
  assert.deepEqual(migrated.sets, legacy.sets);
  assert.ok(migrated.exercises.every(exercise => [...exercise.primaryMuscleIds, ...exercise.supportingMuscleIds].every(id => migrated.muscles.some(muscle => muscle.id === id))));
  assert.deepEqual(api.readFlexibleState({ getItem: () => JSON.stringify(migrated) }), migrated);
});
