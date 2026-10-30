const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../src/flexible.mjs'), import('../src/equipment.mjs')]);

async function setup() {
  const [training, equipment] = await modules;
  const state = training.createFlexibleState('America/Los_Angeles');
  const exercise = state.exercises.find(item => item.catalogKey === 'lateral:1');
  const target = state.targets.find(item => item.presetKey === 'lateral');
  const machines = equipment.exerciseMachines(state, exercise.id);
  const log = (previous, machineId, options = {}) => training.addFlexibleSet(training.startFlexibleSession(previous, '2026-10-29'), {
    targetId: target.id, exerciseId: exercise.id, machineId, weight: 9, reps: 16, day: '2026-10-29', now: '2026-10-29T19:00:00Z', ...options
  });
  return { ...training, ...equipment, state, exercise, target, machines, log };
}

test('lateral cable raises have three equipment profiles representing six stations', async () => {
  const { machines, state, exercise, machineExerciseIds } = await setup();
  assert.deepEqual(machines.map(machine => machine.stations.length), [1, 1, 4]);
  assert.deepEqual(machines.map(machine => machine.name), ['Older cable tower 1', 'Older cable tower 2', 'Standard cable towers']);
  assert.equal(new Set(machines.flatMap(machine => machine.stations.map(station => station.id))).size, 6);
  assert.equal(machines.length, 3);
  assert.ok(machines.every(machine => machineExerciseIds(state, machine.id).includes(exercise.id)));
  assert.ok(machines.every(machine => machineExerciseIds(state, machine.id).length > 1));
});

test('last loads and curve points are separated by both exercise and equipment IDs', async () => {
  const { state, exercise, machines, log, equipmentHistory, lastEquipmentSet, machineExerciseIds, addFlexibleSet } = await setup();
  let next = log(state, machines[0].id, { weight: 9 });
  next = log(next, machines[1].id, { weight: 14 });
  const biceps = next.exercises.find(item => item.catalogKey === 'biceps:1');
  const bicepsTarget = next.targets.find(item => item.presetKey === 'biceps');
  assert.ok(machineExerciseIds(next, machines[0].id).includes(biceps.id));
  next = addFlexibleSet(next, { targetId: bicepsTarget.id, exerciseId: biceps.id, machineId: machines[0].id, weight: 35, reps: 10, day: '2026-10-29', now: '2026-10-29T19:01:00Z' });
  const selection = { exerciseId: exercise.id, machineId: machines[0].id, day: '2026-10-29' };
  assert.equal(lastEquipmentSet(next, selection).weight, 9);
  const real = equipmentHistory(next, selection).filter(set => !set.demo);
  assert.deepEqual(real.map(set => set.weight), [9]);
  assert.equal(lastEquipmentSet(next, { ...selection, machineId: machines[1].id }).weight, 14);
  assert.equal(lastEquipmentSet(next, { ...selection, exerciseId: biceps.id }).weight, 35);
});

test('mixed equipment sets share target credit without combining progression', async () => {
  const { state, target, exercise, machines, log, targetProgress, equipmentHistory } = await setup();
  const next = log(log(state, machines[0].id), machines[2].id, { weight: 5 });
  assert.equal(targetProgress(next, target, '2026-10-29').occasions, 1);
  assert.equal(targetProgress(next, target, '2026-10-29').todaySets, 2);
  assert.equal(equipmentHistory(next, { exerciseId: exercise.id, machineId: machines[0].id }).filter(set => !set.demo).length, 1);
});

test('demo history is labelled and never contributes to real workout totals or recovery', async () => {
  const { state, target, exercise, machines, equipmentHistory, targetProgress, sessionSets } = await setup();
  assert.equal(state.demoHistory.length, 30);
  assert.equal(state.sets.length, 0);
  assert.equal(state.sessions.length, 0);
  assert.equal(sessionSets(state, 'any').length, 0);
  const progress = targetProgress(state, target, '2099-12-31');
  assert.equal(progress.occasions, 0);
  assert.equal(progress.lastWorkedDay, null);
  assert.equal(equipmentHistory(state, { exerciseId: exercise.id, machineId: machines[0].id }).length, 10);
  assert.ok(state.demoHistory.every(set => set.demo));
});

test('real last-used values override sample suggestions and units convert within one pair', async () => {
  const { state, exercise, machines, log, lastEquipmentSet, equipmentHistory } = await setup();
  const next = log(state, machines[0].id, { weight: 20, unit: 'lbs' });
  const selection = { exerciseId: exercise.id, machineId: machines[0].id, day: '2099-12-31' };
  assert.equal(lastEquipmentSet(next, selection).unit, 'lbs');
  assert.equal(lastEquipmentSet(next, selection).weight, 20);
  assert.equal(equipmentHistory(next, { ...selection, unit: 'kg' }).find(set => !set.demo).weight, 9.07);
  assert.ok(equipmentHistory(next, { ...selection, unit: 'lbs' }).every(set => set.unit === 'lbs'));
});

test('unlinking used equipment preserves equipment, target credit and exact-pair history', async () => {
  const { state, exercise, target, machines, log, saveMachine, setExerciseMachines, machineExerciseIds, equipmentHistory, exerciseHistoryMachines, exerciseMachines, targetProgress, readFlexibleState, newId } = await setup();
  let next = log(state, machines[0].id);
  const machine = machines[0];
  const current = machineExerciseIds(next, machine.id);
  const unlinked = setExerciseMachines(next, exercise.id, machines.slice(1).map(item => item.id), newId);
  const restored = readFlexibleState({ getItem: () => JSON.stringify(unlinked) });
  assert.ok(!machineExerciseIds(restored, machine.id).includes(exercise.id));
  assert.deepEqual(restored.machines, next.machines);
  assert.deepEqual(restored.sets, next.sets);
  assert.ok(!exerciseMachines(restored, exercise.id).some(item => item.id === machine.id));
  assert.ok(exerciseHistoryMachines(restored, exercise.id).some(item => item.id === machine.id));
  assert.equal(targetProgress(restored, target, '2026-10-29').todaySets, 1);
  assert.equal(equipmentHistory(restored, { exerciseId: exercise.id, machineId: machine.id }).filter(set => !set.demo).length, 1);
  const relinked = setExerciseMachines(restored, exercise.id, machines.map(item => item.id), newId);
  assert.equal(relinked.equipmentLinks.filter(link => link.exerciseId === exercise.id && link.machineId === machine.id).length, 1);
  assert.ok(machineExerciseIds(relinked, machine.id).includes(exercise.id));
  const renamed = saveMachine(next, { ...machine, name: 'New tower label', stationCount: 5, exerciseIds: current });
  assert.equal(renamed.machines.find(item => item.id === machine.id).stations[0].id, machine.stations[0].id);
  assert.equal(renamed.machines.find(item => item.id === machine.id).stations.length, 5);
  const another = next.exercises.find(item => item.catalogKey === 'dead:0');
  next = setExerciseMachines(next, another.id, [machine.id], newId);
  assert.ok(machineExerciseIds(next, machine.id).includes(another.id));
  next = setExerciseMachines(next, another.id, [], newId);
  assert.ok(!machineExerciseIds(next, machine.id).includes(another.id));
});

test('renaming an exercise or profile preserves links, charts and original log labels', async () => {
  const { state, exercise, machines, log, saveMachine, saveExercise, machineExerciseIds, lastEquipmentSet } = await setup();
  let next = log(state, machines[0].id);
  next = saveMachine(next, { ...machines[0], name: 'Renamed towers', exerciseIds: machineExerciseIds(next, machines[0].id) });
  next = saveExercise(next, { ...exercise, name: 'Cable raise renamed' });
  const last = lastEquipmentSet(next, { machineId: machines[0].id, exerciseId: exercise.id });
  assert.equal(last.weight, 9);
  assert.equal(last.machineName, machines[0].name);
  assert.equal(last.exerciseName, exercise.name);
  assert.ok(machineExerciseIds(next, machines[0].id).includes(exercise.id));
});

test('old records migrate by ID without merging used cable profiles or repeating demo seeds', async () => {
  const { state, newId, migrateEquipment, installLateralExample, readFlexibleState } = await setup();
  const legacy = { ...state, equipmentVersion: undefined, equipmentLinks: undefined, lateralExampleVersion: undefined, demoHistory: [] };
  const cable = legacy.exercises.find(item => item.catalogKey === 'lat:1');
  const old = legacy.machines.find(item => item.exerciseId === cable.id);
  old.archived = false;
  legacy.sets = [{ id: newId(), machineId: old.id, exerciseId: cable.id, weight: 80, unit: 'kg', kind: 'working', trainingDate: '2026-10-01', performedAt: '2026-10-01T12:00:00Z' }];
  const migrated = installLateralExample(migrateEquipment(legacy, newId), newId, new Date('2026-10-29T19:00:00Z'));
  assert.equal(migrated.machines.find(machine => machine.id === old.id).archived, false);
  assert.deepEqual(migrated.sets, legacy.sets);
  const again = readFlexibleState({ getItem: () => JSON.stringify(migrated) });
  assert.deepEqual(again, migrated);
});

test('future history and legacy warmups never replace remembered working loads', async () => {
  const { state, exercise, machines, log, lastEquipmentSet } = await setup();
  let next = log(state, machines[0].id, { weight: 10 });
  next = { ...next, sets: [...next.sets, { ...next.sets[0], id: crypto.randomUUID(), weight: 2, kind: 'warmup', performedAt: '2026-10-29T19:05:00Z' }] };
  next = log(next, machines[0].id, { weight: 25, day: '2026-11-01', now: '2026-11-01T19:00:00Z' });
  assert.equal(lastEquipmentSet(next, { exerciseId: exercise.id, machineId: machines[0].id, day: '2026-10-29' }).weight, 10);
});

test('equipment links reject missing IDs instead of creating orphan relationships', async () => {
  const { state, exercise, machines, setMachineExercises, setExerciseMachines, newId } = await setup();
  assert.throws(() => setMachineExercises(state, 'missing-profile', [exercise.id], newId), /valid equipment/);
  assert.throws(() => setMachineExercises(state, machines[0].id, ['missing-exercise'], newId), /valid exercises/);
  assert.throws(() => setExerciseMachines(state, exercise.id, ['missing-profile'], newId), /valid exercise/);
});
