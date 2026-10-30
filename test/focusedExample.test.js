const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../src/flexible.mjs'), import('../src/equipment.mjs'), import('../src/focusedExample.mjs')]);

async function setup() {
  const [training, equipment, example] = await modules;
  const original = training.createFlexibleState('America/Los_Angeles');
  const state = example.installFocusedExample(original, training.newId, new Date('2026-10-29T19:00:00Z'));
  return { ...training, ...equipment, ...example, original, state };
}

test('focused testing exposes exactly three targets, three exercises and five equipment profiles', async () => {
  const { state, scopeItems, exerciseMachines, rankTargets } = await setup();
  assert.deepEqual(scopeItems(state, 'targets').map(item => item.name), ['Chest press', 'Low-to-high cable fly', 'Lateral raises']);
  assert.deepEqual(scopeItems(state, 'exercises').map(item => item.name), ['Chest press', 'Low-to-high cable fly', 'Cable lateral raises']);
  assert.equal(scopeItems(state, 'machines').length, 5);
  const lateral = scopeItems(state, 'exercises').find(item => item.name === 'Cable lateral raises');
  const chest = scopeItems(state, 'exercises').find(item => item.name === 'Chest press');
  assert.deepEqual(exerciseMachines(state, lateral.id).map(machine => machine.stations.length), [1, 1, 4]);
  assert.deepEqual(exerciseMachines(state, chest.id).map(machine => machine.name), ['Chest press machine 1', 'Chest press machine 2']);
  assert.equal(rankTargets(state, '2026-10-29').length, 3);
});

test('each chest-press machine has a separate curve while contributing to the same target', async () => {
  const { state, scopeItems, exerciseMachines, equipmentHistory, lastEquipmentSet, targetProgress, startFlexibleSession, addFlexibleSet } = await setup();
  const exercise = scopeItems(state, 'exercises').find(item => item.name === 'Chest press');
  const machines = exerciseMachines(state, exercise.id);
  const target = scopeItems(state, 'targets').find(item => item.presetKey === 'chest');
  const first = equipmentHistory(state, { exerciseId: exercise.id, machineId: machines[0].id });
  const second = equipmentHistory(state, { exerciseId: exercise.id, machineId: machines[1].id });
  assert.equal(first.length, 10); assert.equal(second.length, 10);
  assert.equal(first.at(-1).weight, 45); assert.equal(second.at(-1).weight, 60);
  assert.equal(targetProgress(state, target, '2026-10-29').occasions, 0);
  let next = startFlexibleSession(state, '2026-10-29');
  for (const machine of [machines[0], machines[1], machines[0]]) next = addFlexibleSet(next, { targetId: target.id, exerciseId: exercise.id, machineId: machine.id, weight: 30, reps: 10, day: '2026-10-29' });
  assert.equal(targetProgress(next, target, '2026-10-29').occasions, 1);
  assert.equal(lastEquipmentSet(next, { exerciseId: exercise.id, machineId: machines[1].id }).weight, 30);
  assert.equal(equipmentHistory(next, { exerciseId: exercise.id, machineId: machines[1].id }).filter(set => !set.demo).length, 1);
});

test('the simpler example preserves existing logs and hidden library IDs and migrates once', async () => {
  const { original, installFocusedExample, newId, startFlexibleSession, addFlexibleSet, readFlexibleState } = await setup();
  const target = original.targets.find(item => item.presetKey === 'chest');
  const exerciseId = target.exerciseIds[0];
  const machine = original.machines.find(item => item.exerciseId === exerciseId);
  const logged = addFlexibleSet(startFlexibleSession(original, '2026-10-28'), { targetId: target.id, machineId: machine.id, exerciseId, weight: 12, reps: 8, day: '2026-10-28' });
  const next = installFocusedExample(logged, newId);
  assert.deepEqual(next.sets, logged.sets);
  assert.deepEqual(next.sessions, logged.sessions);
  assert.ok(original.exercises.every(exercise => next.exercises.some(item => item.id === exercise.id)));
  assert.ok(original.machines.every(profile => next.machines.some(item => item.id === profile.id)));
  assert.equal(next.targets.length, original.targets.length);
  assert.deepEqual(readFlexibleState({ getItem: () => JSON.stringify(next) }, { focused: true }), next);
});

test('editing focused profiles preserves hidden exercise links and historical combinations', async () => {
  const { state, scopeItems, scopedMachineExercises, machineExerciseIds, saveMachine } = await setup();
  const machine = scopeItems(state, 'machines').find(item => item.stations.length === 4);
  const original = machineExerciseIds(state, machine.id);
  const visible = scopedMachineExercises(state, machine.id);
  assert.equal(visible.length, 2);
  assert.ok(original.length > 1);
  const next = saveMachine(state, { ...machine, name: 'Renamed group', exerciseIds: visible });
  assert.deepEqual(machineExerciseIds(next, machine.id), original);
  assert.equal(next.machines.find(item => item.id === machine.id).name, 'Renamed group');
});

test('new browsers open the focused example and demo history never becomes training credit', async () => {
  const { readFlexibleState, scopeItems, targetProgress } = await setup();
  const state = readFlexibleState({ getItem: () => null }, { focused: true });
  assert.equal(state.demoHistory.length, 80);
  assert.equal(state.sets.length, 0);
  for (const target of scopeItems(state, 'targets')) assert.equal(targetProgress(state, target, '2099-12-31').occasions, 0);
});

test('the dummy muscles reflect assistance and shared chest emphasis using shared IDs', async () => {
  const { state, scopeItems, exerciseMachines, machineExerciseIds } = await setup();
  const names = ids => ids.map(id => state.muscles.find(muscle => muscle.id === id).name);
  const exercises = scopeItems(state, 'exercises');
  const chest = exercises.find(exercise => exercise.catalogKey === 'chest:0');
  const lateral = exercises.find(exercise => exercise.catalogKey === 'lateral:1');
  const fly = exercises.find(exercise => exercise.catalogKey === 'fly:0');
  assert.deepEqual(names(chest.primaryMuscleIds), ['Chest']);
  assert.deepEqual(names(chest.supportingMuscleIds), ['Triceps', 'Front shoulders']);
  assert.deepEqual(names(lateral.primaryMuscleIds), ['Side shoulders']);
  assert.deepEqual(names(lateral.supportingMuscleIds), ['Supraspinatus', 'Upper trapezius']);
  assert.deepEqual(fly.primaryMuscleIds, chest.primaryMuscleIds);
  assert.deepEqual(names(fly.supportingMuscleIds), ['Front shoulders']);
  const equipment = exerciseMachines(state, fly.id);
  assert.equal(equipment.length, 3);
  assert.ok(equipment.every(machine => machineExerciseIds(state, machine.id).includes(lateral.id)));
});

test('upgrading the two-exercise preview keeps user data and seeds the fly only once', async () => {
  const { state, newId, installFocusedExample, scopeItems } = await setup();
  const fly = state.exercises.find(exercise => exercise.catalogKey === 'fly:0');
  const old = { ...state, focusedExampleVersion: 1,
    testingScope: { ...state.testingScope, exerciseIds: state.testingScope.exerciseIds.filter(id => id !== fly.id),
      targetIds: state.testingScope.targetIds.filter(id => state.targets.find(target => target.id === id).presetKey !== 'fly') },
    demoHistory: state.demoHistory.filter(set => set.exerciseId !== fly.id) };
  const upgraded = installFocusedExample(old, newId, new Date('2026-10-29T19:00:00Z'));
  assert.equal(scopeItems(upgraded, 'exercises').length, 3);
  assert.deepEqual(upgraded.machines, old.machines);
  assert.deepEqual(upgraded.equipmentLinks, old.equipmentLinks);
  assert.deepEqual(upgraded.sets, old.sets);
  assert.deepEqual(upgraded.sessions, old.sessions);
  assert.deepEqual(upgraded.muscles, old.muscles);
  assert.equal(upgraded.demoHistory.length, 80);
  assert.deepEqual(installFocusedExample(upgraded, newId), upgraded);
});

test('due chest compounds precede overlapping flies, while completed chest work favors lateral raises', async () => {
  const { state, rankTargets, startFlexibleSession, addFlexibleSet, exerciseMachines, scopeItems } = await setup();
  const day = '2026-10-29', now = '2026-10-29T19:00:00Z';
  const before = rankTargets(state, day, now);
  assert.equal(before[0].target.presetKey, 'chest');
  assert.equal(before.find(row => row.target.presetKey === 'fly').deferred, true);
  const target = scopeItems(state, 'targets').find(target => target.presetKey === 'chest');
  const machine = exerciseMachines(state, target.exerciseIds[0])[0];
  let next = startFlexibleSession(state, day, now);
  for (let index = 0; index < 3; index++) next = addFlexibleSet(next, { targetId: target.id, machineId: machine.id, weight: 30, reps: 10, day, now });
  const after = rankTargets(next, day, now);
  assert.equal(after[0].target.presetKey, 'lateral');
  assert.equal(after.find(row => row.target.presetKey === 'chest').progress.completedToday, true);
  assert.ok(!after.find(row => row.target.presetKey === 'fly').deferred);
});
