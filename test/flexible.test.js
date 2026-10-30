const test = require('node:test');
const assert = require('node:assert/strict');
const lib = import('../src/flexible.mjs');
const DAY = '2026-10-28';

async function fixture() {
  const api = await lib;
  const state = api.createFlexibleState('America/Los_Angeles');
  const target = state.targets.find(item => item.presetKey === 'lat');
  // Keep these general frequency tests independent of the variable-dose preset.
  delete target.prescriptions;
  const { machineExerciseIds } = await import('../src/equipment.mjs');
  const machines = state.machines.filter(item => !item.archived && machineExerciseIds(state, item.id).some(id => target.exerciseIds.includes(id)));
  const log = (previous, options = {}) => api.addFlexibleSet(api.startFlexibleSession(previous, options.day || DAY), { targetId: target.id, machineId: machines[0].id, weight: 50, reps: 10, day: DAY, ...options });
  return { api, state, target, machines, log };
}

test('renaming gyms, targets, exercises and machines preserves all links and original log labels', async () => {
  const { api, target, machines, log, state } = await fixture();
  let next = log(state);
  next = api.saveTarget(next, { ...target, name: 'Pulling goal' });
  const exercise = next.exercises.find(item => item.id === machines[0].exerciseId);
  next = api.saveExercise(next, { ...exercise, name: 'Renamed exercise' });
  next = api.saveMachine(next, { ...machines[0], name: 'Machine 12' });
  next = { ...next, gyms: next.gyms.map(gym => ({ ...gym, name: 'Renamed gym' })) };
  assert.equal(next.targets.find(item => item.id === target.id).exerciseIds[0], exercise.id);
  assert.equal(next.sets[0].machineId, machines[0].id);
  assert.equal(next.sets[0].exerciseId, exercise.id);
  assert.equal(next.sets[0].machineName, machines[0].name);
  assert.equal(next.sets[0].exerciseName, exercise.name);
  assert.equal(api.targetProgress(next, target, DAY).todaySets, 1);
});

test('mixing eligible machine alternatives qualifies the same target and preserves separate loads', async () => {
  const { api, target, machines, log, state } = await fixture();
  const next = log(log(log(state), { machineId: machines[1].id, weight: 80, unit: 'lbs' }));
  const progress = api.targetProgress(next, target, DAY);
  assert.equal(progress.occasions, 1);
  assert.equal(progress.completedToday, true);
  assert.deepEqual(next.sets.map(set => [set.machineId, set.weight, set.unit]), [[machines[0].id, 50, 'kg'], [machines[1].id, 80, 'lbs'], [machines[0].id, 50, 'kg']]);
});

test('legacy warmups do not earn credit and partial work remains resumable', async () => {
  const { api, target, log, state } = await fixture();
  const next = log(log(log(state)));
  next.sets = next.sets.map((set, index) => index === 1 ? set : { ...set, kind: 'warmup' });
  const progress = api.targetProgress(next, target, DAY);
  assert.equal(progress.occasions, 0);
  assert.equal(progress.todaySets, 1);
  assert.equal(next.activities.length, 1);
});

test('partial sets aggregate across sessions but a day earns at most one occasion', async () => {
  const { api, target, log, state } = await fixture();
  let next = log(log(state));
  next = api.finishFlexibleSession(next);
  next = log(next);
  assert.equal(next.sessions.length, 2);
  assert.equal(api.targetProgress(next, target, DAY).occasions, 1);
  next = log(log(next));
  assert.equal(api.targetProgress(next, target, DAY).occasions, 1);
});

test('rolling seven calendar days includes six days ago and expires seven days ago', async () => {
  const { api, target, log, state } = await fixture();
  let next = log(log(log(state, { day: '2026-10-21' }), { day: '2026-10-21' }), { day: '2026-10-21' });
  next = api.finishFlexibleSession(next);
  next = log(log(log(next, { day: '2026-10-22' }), { day: '2026-10-22' }), { day: '2026-10-22' });
  assert.equal(api.targetProgress(next, target, '2026-10-27').occasions, 2);
  assert.equal(api.targetProgress(next, target, DAY).occasions, 1);
  assert.equal(api.targetProgress(next, target, '2026-10-29').occasions, 0);
});

test('doing work ahead counts on the actual training day and future records do not influence earlier previews', async () => {
  const { api, target, log, state } = await fixture();
  const next = log(log(log(state)));
  assert.equal(api.targetProgress(next, target, '2026-10-27').occasions, 0);
  assert.equal(api.targetProgress(next, target, '2026-10-29').occasions, 1);
  assert.equal(api.targetProgress(next, target, '2026-10-29').completedToday, false);
});

test('editing qualifying sets does not retroactively change earlier training days', async () => {
  const { api, target, log, state } = await fixture();
  let next = log(log(state));
  next = api.saveTarget(next, { ...target, requiredSets: 4, maxSets: 4 });
  next = api.finishFlexibleSession(next);
  next = log(next);
  const edited = next.targets.find(item => item.id === target.id);
  assert.equal(api.targetProgress(next, edited, DAY).completedToday, true);
  assert.equal(api.targetProgress(next, edited, DAY).requiredSets, 3);
  next = api.finishFlexibleSession(next);
  next = log(log(log(next, { day: '2026-10-29' }), { day: '2026-10-29' }), { day: '2026-10-29' });
  assert.equal(api.targetProgress(next, edited, '2026-10-29').completedToday, false);
  assert.equal(api.targetProgress(next, edited, '2026-10-29').requiredSets, 4);
});

test('removing a qualifying set recalculates credit without stale completion flags', async () => {
  const { api, target, log, state } = await fixture();
  const next = log(log(log(state)));
  const deleted = { ...next, sets: next.sets.slice(0, 2) };
  assert.equal(api.targetProgress(deleted, target, DAY).completedToday, false);
  assert.equal(api.targetProgress(deleted, target, DAY).remaining, 2);
});

test('recent training lowers priority without blocking an override or counting extra sets twice', async () => {
  const { api, target, log, state } = await fixture();
  const next = api.finishFlexibleSession(log(log(log(state))));
  const row = api.rankTargets(next, '2026-10-29').find(item => item.target.id === target.id);
  assert.equal(row.recovering, true);
  assert.ok(row.reasonCodes.includes('RECENT_OVERLAP'));
  assert.ok(row.fatigueModifier < 1);
  assert.doesNotThrow(() => log(next, { day: '2026-10-29' }));
});

test('isolation work is deferred while overlapping priority compounds remain', async () => {
  const { api, state } = await fixture();
  const rows = api.rankTargets(state, DAY);
  const curl = rows.find(row => row.target.presetKey === 'biceps');
  const pull = rows.find(row => row.target.presetKey === 'lat');
  assert.equal(curl.deferred, true);
  assert.ok(curl.score < pull.score);
  assert.ok(curl.orderingAdjustment < 0);
  assert.ok(curl.reasons.some(reason => /overlapping compound/.test(reason)));
});

test('partial working sets influence next-day spacing while same-day continuation stays available', async () => {
  const { api, target, log, state } = await fixture();
  const next = log(state);
  const today = api.rankTargets(next, DAY).find(row => row.target.id === target.id);
  assert.equal(today.recovering, true);
  const tomorrow = api.rankTargets(next, '2026-10-29').find(row => row.target.id === target.id);
  assert.equal(tomorrow.progress.occasions, 0);
  assert.equal(tomorrow.recovering, true);
});

test('all linked equipment stays selectable and unrelated equipment cannot be logged', async () => {
  const { api, target, machines, log, state } = await fixture();
  const row = api.rankTargets(state, DAY).find(item => item.target.id === target.id);
  assert.deepEqual(row.machines.map(item => item.id).sort(), machines.map(item => item.id).sort());
  assert.deepEqual(row.machines.map(item => item.name), [...row.machines].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(item => item.name));
  for (const machine of row.machines) assert.doesNotThrow(() => log(state, { machineId: machine.id }));
  const unrelated = state.machines.find(machine => !target.exerciseIds.includes(machine.exerciseId));
  assert.throws(() => log(state, { machineId: unrelated.id }), /linked machine/);
});

test('equipment assignment edits preserve historical exercise IDs and gym identity', async () => {
  const { api, machines, log, state } = await fixture();
  const next = log(state);
  const changed = api.saveMachine(next, { ...machines[0], exerciseId: machines[1].exerciseId });
  assert.deepEqual(changed.sets, next.sets);
  const anotherGym = api.newId();
  const withGym = { ...next, gyms: [...next.gyms, { id: anotherGym, name: 'Other gym' }] };
  assert.throws(() => api.saveMachine(withGym, { ...machines[0], gymId: anotherGym }), /different gym/);
  assert.doesNotThrow(() => api.saveMachine(next, { ...machines[0], name: 'New label' }));
});

test('invalid target settings and empty or fractional set inputs are rejected', async () => {
  const { api, state, target, log } = await fixture();
  for (const values of [{ frequency: 0 }, { frequency: 8 }, { requiredSets: 0 }, { exerciseIds: [] }, { spacingDays: -1 }, { name: ' ' }]) {
    assert.throws(() => api.saveTarget(state, { ...target, ...values }));
  }
  for (const values of [{ weight: '' }, { weight: -1 }, { reps: 0 }, { reps: 2.5 }, { weight: Infinity }, { unit: 'stone' }, { kind: 'warmup' }]) assert.throws(() => log(state, values));
  assert.doesNotThrow(() => log(state, { weight: 0, reps: 1 }));
  assert.equal(log(state).sets.at(-1).kind, 'working');
});

test('session and IDs survive browser storage round-trip, with corrupt data preserved for recovery', async () => {
  const { api, state, log } = await fixture();
  const next = log(state);
  const raw = JSON.stringify(next);
  assert.deepEqual(api.readFlexibleState({ getItem: () => raw }), next);
  assert.equal(api.activeSession(api.readFlexibleState({ getItem: () => raw })).id, next.sessions[0].id);
  assert.throws(() => api.readFlexibleState({ getItem: () => '{broken' }));
  assert.throws(() => api.readFlexibleState({ getItem: () => '{"version":2}' }), /unsupported/);
});

test('calendar days use the configured timezone across midnight and daylight saving', async () => {
  const { api } = await fixture();
  assert.equal(api.trainingDay('2026-10-29T02:00:00Z', 'America/Los_Angeles'), '2026-10-28');
  assert.equal(api.trainingDay('2026-10-29T02:00:00Z', 'Europe/Berlin'), '2026-10-29');
  assert.equal(api.dayDistance('2026-10-31', '2026-11-02'), 2);
});

test('no missed-week debt accumulates and credit follows target IDs rather than tags', async () => {
  const { api, state, target, log } = await fixture();
  const next = log(log(log(state)));
  assert.equal(api.targetProgress(next, target, '2026-12-01').remaining, 2);
  const rowTarget = state.targets.find(item => item.presetKey === 'row');
  assert.equal(api.targetProgress(next, rowTarget, DAY).todaySets, 0);
});

test('a second gym shares target credit but stores a distinct physical machine ID', async () => {
  const { api, state, target, machines, log } = await fixture();
  let next = api.finishFlexibleSession(log(log(state)));
  const gymId = api.newId();
  next = { ...next, gyms: [...next.gyms, { id: gymId, name: 'Another gym' }], selectedGymId: gymId };
  next = api.saveMachine(next, { name: 'Pulldown station', exerciseId: machines[0].exerciseId, gymId });
  const machine = next.machines.at(-1);
  next = log(next, { machineId: machine.id, weight: 25 });
  assert.equal(api.targetProgress(next, target, DAY).occasions, 1);
  assert.notEqual(next.sets[0].machineId, next.sets.at(-1).machineId);
  assert.equal(next.sets.at(-1).gymId, gymId);
});

test('the personal target preset combines repeated exercises and preserves every prescription', async () => {
  const api = await lib;
  const state = api.createFlexibleState('America/Los_Angeles');
  assert.equal(state.targets.length, 13);
  const specs = Object.fromEntries(state.targets.map(target => [target.name, [target.frequency, target.prescriptions.map(api.prescription), Boolean(target.optional)]]));
  assert.deepEqual(specs, {
    'Chest press': [2, ['3×8–12', '2×8–12'], false],
    'Shoulder press': [1, ['3×8–12'], false],
    'Lat pulldown': [2, ['3×8–12', '3×8–12'], false],
    'Seated bilateral row': [2, ['2×10–12', '3×8–12'], false],
    'Low-to-high cable fly': [1, ['2×10–15'], false],
    'Straight-arm pulldown': [1, ['2×12–15'], false],
    'Lateral raises': [2, ['2×12–20', '2×12–20'], false],
    'Reverse pec deck': [2, ['2×12–20', '2×12–20'], false],
    'Overhead triceps extension': [2, ['2×10–15', '2×10–15'], false],
    'Biceps curls': [2, ['2×10–15', '2×10–15'], false],
    'Wood chops': [1, ['2×10–12/side'], false],
    'Goblet squats': [1, ['1–2×8–12'], true],
    'Dead bugs': [1, ['2×8–12/side'], false]
  });
});

test('different weekly doses are consumed once and return individually when they expire', async () => {
  const api = await lib;
  let state = api.createFlexibleState('America/Los_Angeles');
  const target = state.targets.find(item => item.presetKey === 'chest');
  const machine = state.machines.find(item => target.exerciseIds.includes(item.exerciseId));
  const log = day => { state = api.addFlexibleSet(api.startFlexibleSession(state, day), { targetId: target.id, machineId: machine.id, weight: 30, reps: 10, day }); };
  log('2026-10-28'); log('2026-10-28');
  assert.equal(api.targetProgress(state, target, '2026-10-28').completedToday, false);
  log('2026-10-28');
  assert.equal(api.targetProgress(state, target, '2026-10-28').completedToday, true);
  state = api.finishFlexibleSession(state);
  assert.equal(api.targetProgress(state, target, '2026-10-30').requiredSets, 2);
  log('2026-10-30');
  assert.equal(api.targetProgress(state, target, '2026-10-30').completedToday, false);
  log('2026-10-30');
  assert.equal(api.targetProgress(state, target, '2026-10-30').occasions, 2);
  assert.equal(api.targetProgress(state, target, '2026-11-04').occasions, 1);
  assert.equal(api.targetProgress(state, target, '2026-11-04').requiredSets, 3);
});

test('row rep range switches with the next weekly dose without merging machine history', async () => {
  const api = await lib;
  let state = api.createFlexibleState('America/Los_Angeles');
  const target = state.targets.find(item => item.presetKey === 'row');
  const machine = state.machines.find(item => target.exerciseIds.includes(item.exerciseId));
  state = api.startFlexibleSession(state, DAY);
  for (let i = 0; i < 2; i++) state = api.addFlexibleSet(state, { targetId: target.id, machineId: machine.id, weight: 20, reps: 11, day: DAY });
  assert.equal(api.prescription(api.targetProgress(state, target, DAY).prescription), '2×10–12');
  assert.equal(api.prescription(api.targetProgress(state, target, '2026-10-30').prescription), '3×8–12');
  const renamed = api.saveTarget(state, { ...target, name: 'Row renamed' });
  assert.deepEqual(renamed.targets.find(item => item.id === target.id).prescriptions.map(dose => dose.id), target.prescriptions.map(dose => dose.id));
});

test('upgrading the sample plan preserves old logs and IDs without guessing links by label', async () => {
  const api = await lib;
  let state = api.createFlexibleState('America/Los_Angeles');
  const target = state.targets[0], machine = state.machines.find(item => target.exerciseIds.includes(item.exerciseId));
  state = api.addFlexibleSet(api.startFlexibleSession(state, DAY), { targetId: target.id, machineId: machine.id, weight: 20, reps: 10, day: DAY });
  delete state.targetPlanVersion;
  const migrated = api.readFlexibleState({ getItem: () => JSON.stringify(state) });
  assert.equal(migrated.targets.filter(item => !item.archived).length, 13);
  assert.equal(migrated.targets.find(item => item.id === target.id).archived, true);
  assert.deepEqual(migrated.sets, state.sets);
  assert.equal(migrated.machines.find(item => item.id === machine.id).name, machine.name);
  assert.deepEqual(api.readFlexibleState({ getItem: () => JSON.stringify(migrated) }), migrated);
});
