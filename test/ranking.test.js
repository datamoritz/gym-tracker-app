const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../src/flexible.mjs'), import('../src/ranking.mjs'), import('../src/equipment.mjs')]);
const DAY = '2026-10-29', NOW = '2026-10-29T20:00:00.000Z';

async function setup(focused = true) {
  const [api, ranking, equipment] = await modules;
  const state = focused ? { ...api.readFlexibleState({ getItem: () => null }, { focused: true }), timeZone: 'America/Los_Angeles' } : api.createFlexibleState('America/Los_Angeles');
  const targetFor = (state, key) => state.targets.find(target => target.presetKey === key);
  const log = (state, key, count = 1, options = {}) => {
    const target = targetFor(state, key), day = options.day || DAY, now = options.now || `${day}T19:00:00.000Z`;
    const exerciseId = options.exerciseId || target.exerciseIds[0];
    const machineId = options.machineId || equipment.exerciseMachines(state, exerciseId)[0]?.id;
    let next = api.startFlexibleSession(state, day, now);
    for (let index = 0; index < count; index++) next = api.addFlexibleSet(next, { targetId: target.id, exerciseId, machineId, weight: 30, reps: 10, day, now, ...options });
    return next;
  };
  const row = (state, key, day = DAY, now = NOW) => api.rankTargets(state, day, now).find(item => item.target.presetKey === key);
  return { ...api, ...ranking, ...equipment, state, targetFor, log, row };
}

test('partial work changes shared-muscle fatigue without awarding another exercise target credit', async () => {
  const { state, log, row } = await setup();
  const next = log(state, 'chest');
  const chest = row(next, 'chest'), fly = row(next, 'fly'), lateral = row(next, 'lateral');
  assert.equal(chest.progress.occasions, 0);
  assert.equal(chest.progress.todaySets, 1);
  assert.ok(chest.reasonCodes.includes('CONTINUE'));
  assert.equal(fly.progress.todaySets, 0);
  assert.equal(fly.progress.occasions, 0);
  assert.ok(fly.fatigueModifier < 1);
  assert.ok(fly.fatigueLoad > 0);
  assert.ok(fly.reasonCodes.includes('SESSION_OVERLAP'));
  assert.equal(lateral.fatigueModifier, 1);
  assert.equal(lateral.fatigueModifier, 1);
});

test('partial previous-day work affects the same continuous fatigue factor', async () => {
  const { state, log, row } = await setup();
  const next = log(state, 'chest', 1, { day: '2026-10-28' });
  const fly = row(next, 'fly');
  assert.ok(fly.fatigueModifier < 1);
  assert.ok(fly.fatigueLoad > 0);
  assert.ok(fly.reasonCodes.includes('RECENT_OVERLAP'));
  assert.ok(!fly.reasonCodes.includes('SESSION_OVERLAP'));
  assert.equal(row(next, 'chest').progress.occasions, 0);
  const recovered = row(next, 'fly', '2026-10-30', '2026-10-30T20:00:00Z');
  assert.equal(recovered.fatigueModifier, 1);
});

test('today’s overlapping work accumulates across sessions and gyms', async () => {
  const { state, log, row, finishFlexibleSession, exerciseMachines, targetFor, newId } = await setup();
  let next = log(state, 'chest');
  const one = row(next, 'fly').todayLoad;
  next = finishFlexibleSession(next);
  next = log(next, 'chest');
  assert.equal(row(next, 'fly').todayLoad, one * 2);
  next = finishFlexibleSession(next);
  const originalGymId = next.selectedGymId, gymId = newId(), machineId = newId();
  const exerciseId = targetFor(next, 'chest').exerciseIds[0];
  const originalMachine = exerciseMachines(next, exerciseId)[0];
  next = { ...next, selectedGymId: gymId, gyms: [...next.gyms, { id: gymId, name: 'Other gym' }],
    machines: [...next.machines, { ...originalMachine, id: machineId, gymId }],
    equipmentLinks: [...next.equipmentLinks, { id: newId(), machineId, exerciseId, archived: false }],
    testingScope: { ...next.testingScope, machineIds: [...next.testingScope.machineIds, machineId] } };
  next = log(next, 'chest', 1, { machineId });
  next = { ...finishFlexibleSession(next), selectedGymId: originalGymId };
  assert.ok(Math.abs(row(next, 'fly').todayLoad - one * 3) < 1e-10);
  assert.ok(row(next, 'fly').fatigueModifier < row(log(state, 'chest'), 'fly').fatigueModifier);
  assert.equal(row(next, 'chest').progress.occasions, 1);
});

test('primary involvement contributes more fatigue than supporting involvement', async () => {
  const { state, log, row } = await setup(false);
  const support = row(log(state, 'chest'), 'triceps');
  const primary = row(log(state, 'triceps'), 'triceps');
  assert.ok(support.todayLoad > 0);
  assert.ok(primary.todayLoad > support.todayLoad);
  assert.ok(primary.fatigueModifier < support.fatigueModifier);
});

test('credit combines setups and sessions within a local day, with separate derived completion flags', async () => {
  const { state, log, row, trainingDay, finishFlexibleSession, exerciseMachines, targetFor, targetProgress } = await setup();
  const target = targetFor(state, 'chest'), machines = exerciseMachines(state, target.exerciseIds[0]);
  const firstTime = '2026-10-29T06:30:00Z', secondTime = '2026-10-29T06:50:00Z';
  const firstDay = trainingDay(firstTime, state.timeZone);
  assert.equal(firstDay, '2026-10-28');
  let next = log(state, 'chest', 2, { day: firstDay, now: firstTime, machineId: machines[0].id });
  next = log(finishFlexibleSession(next), 'chest', 1, { day: firstDay, now: secondTime, machineId: machines[1].id });
  let progress = targetProgress(next, target, firstDay);
  assert.equal(progress.occasions, 1);
  assert.equal(progress.finished_today, true);
  assert.equal(progress.rolling_target_met, false);
  assert.equal(row(next, 'chest', firstDay, secondTime).bucket, 'done');
  const afterMidnight = '2026-10-29T07:10:00Z', secondDay = trainingDay(afterMidnight, state.timeZone);
  assert.equal(secondDay, DAY);
  next = log(finishFlexibleSession(next), 'chest', 1, { day: secondDay, now: afterMidnight });
  progress = targetProgress(next, target, secondDay);
  assert.equal(progress.occasions, 1);
  assert.equal(progress.finished_today, false);
  assert.equal(progress.requiredSets, 2);
  next = log(next, 'chest', 1, { now: '2026-10-29T07:20:00Z' });
  const done = row(next, 'chest');
  assert.equal(done.finished_today, true);
  assert.equal(done.rolling_target_met, true);
  assert.ok(done.reasonCodes.includes('FINISHED_TODAY'));
  assert.ok(done.reasonCodes.includes('TARGET_MET'));
  const tomorrow = row(next, 'chest', '2026-10-30', '2026-10-30T19:00:00Z');
  assert.equal(tomorrow.finished_today, false);
  assert.equal(tomorrow.rolling_target_met, true);
  assert.ok(!tomorrow.reasonCodes.includes('FINISHED_TODAY'));
  const deleted = { ...next, sets: next.sets.slice(0, -1) };
  assert.equal(row(deleted, 'chest').finished_today, false);
  assert.equal(row(deleted, 'chest').rolling_target_met, false);
  assert.ok(row(deleted, 'fly').fatigueModifier < 1);
  assert.ok(row(deleted, 'fly').todayLoad < row(next, 'fly').todayLoad);
});

test('the repeated hour at daylight-saving fallback remains one local training occasion', async () => {
  const { state, log, trainingDay, finishFlexibleSession, targetFor, targetProgress } = await setup();
  const first = '2026-11-01T08:30:00Z', repeated = '2026-11-01T09:30:00Z';
  const day = trainingDay(first, state.timeZone);
  assert.equal(day, trainingDay(repeated, state.timeZone));
  let next = log(state, 'chest', 2, { day, now: first });
  next = log(finishFlexibleSession(next), 'chest', 2, { day, now: repeated });
  const progress = targetProgress(next, targetFor(next, 'chest'), day, repeated);
  assert.equal(progress.todaySets, 4);
  assert.equal(progress.occasions, 1);
  assert.equal(progress.finished_today, true);
  assert.equal(progress.rolling_target_met, false);
});

test('incomplete work never earns an occasion even across local-day boundaries', async () => {
  const { state, log, row, finishFlexibleSession } = await setup();
  let next = log(state, 'chest', 2, { day: '2026-10-28' });
  next = log(finishFlexibleSession(next), 'chest', 1);
  assert.equal(row(next, 'chest').progress.occasions, 0);
  assert.equal(row(next, 'chest').progress.todaySets, 1);
  assert.ok(row(next, 'fly').fatigueModifier < 1);
  assert.ok(row(next, 'fly').recentLoad > 0);
  assert.ok(row(next, 'fly').todayLoad > 0);
});

test('duplicate, demo, warmup and future sets do not inflate credit or fatigue', async () => {
  const { state, log, row, rankTargets, targetFor, targetProgress, newId } = await setup();
  const real = log(state, 'chest'), original = row(real, 'fly');
  const set = real.sets[0];
  const variants = [{ ...set }, { ...set, id: newId(), demo: true }, { ...set, id: newId(), kind: 'warmup' },
    { ...set, id: newId(), performedAt: '2026-10-29T23:00:00Z' },
    { ...set, id: newId(), trainingDate: '2026-10-30', performedAt: '2026-10-30T19:00:00Z' }];
  const next = { ...real, sets: [...real.sets, ...variants] };
  assert.equal(row(next, 'fly').todayLoad, original.todayLoad);
  assert.equal(row(next, 'chest').progress.todaySets, 1);
  assert.equal(targetProgress(next, targetFor(next, 'chest'), DAY, NOW).occasions, 0);
  assert.equal(rankTargets(next, DAY, NOW).find(row => row.target.presetKey === 'chest').finished_today, false);
  assert.ok(row(real, 'fly', DAY, '2026-10-29T19:00:00Z').fatigueLoad > original.fatigueLoad);
});

test('candidates require active explicit exercise links and equipment at the selected gym', async () => {
  const { state, targetFor, rankTargets, row, setExerciseMachines, newId } = await setup();
  const chest = targetFor(state, 'chest');
  const next = setExerciseMachines(state, chest.exerciseIds[0], [], newId);
  assert.ok(!row(next, 'chest'));
  assert.ok(row(next, 'fly'));
  const wrongGym = { ...state, selectedGymId: newId() };
  assert.equal(rankTargets(wrongGym, DAY, NOW).length, 0);
  const archived = { ...state, exercises: state.exercises.map(exercise => chest.exerciseIds.includes(exercise.id) ? { ...exercise, archived: true } : exercise) };
  assert.ok(!row(archived, 'chest'));
  const paused = { ...state, targets: state.targets.map(target => target.id === chest.id ? { ...target, active: false } : target) };
  assert.ok(!row(paused, 'chest'));
});

test('bucket suitability takes precedence over a higher numerical score', async () => {
  const { state, log, rankTargets, row } = await setup();
  const priorities = { ...state, targets: state.targets.map(target => ({ ...target, priority: target.presetKey === 'fly' ? 3 : 1 })) };
  const next = log(priorities, 'chest', 3, { day: '2026-10-28' });
  const fly = row(next, 'fly'), lateral = row(next, 'lateral');
  assert.equal(fly.bucket, 'other');
  assert.equal(lateral.bucket, 'recommended');
  assert.ok(fly.score > lateral.score);
  assert.ok(rankTargets(next, DAY, NOW).findIndex(row => row.target.id === lateral.target.id) < rankTargets(next, DAY, NOW).findIndex(row => row.target.id === fly.target.id));
});

test('compound ordering is a soft preference: a larger shortfall or higher priority fly can win', async () => {
  const { state, log, row, rankTargets } = await setup();
  assert.ok(row(state, 'fly').orderingAdjustment < 0);
  assert.equal(rankTargets(state, DAY, NOW)[0].target.presetKey, 'chest');
  const priorities = { ...state, targets: state.targets.map(target => target.presetKey === 'fly' ? { ...target, priority: 3 } : target) };
  assert.equal(rankTargets(priorities, DAY, NOW)[0].target.presetKey, 'fly');
  const next = log(state, 'chest', 3, { day: '2026-10-26' });
  assert.ok(row(next, 'fly').orderingAdjustment < 0);
  assert.ok(row(next, 'fly').score > row(next, 'chest').score);
  const ordered = rankTargets(next, DAY, NOW).map(row => row.target.presetKey);
  assert.ok(ordered.indexOf('fly') < ordered.indexOf('chest'));
});

test('alternation is only a small tie-breaker, not a mandatory sequence', async () => {
  const { state, log, rankTargets, DEFAULT_RANKING } = await setup();
  let next = log({ ...state, rankingConfig: { ...DEFAULT_RANKING, fatiguePenaltyPerSet: 0, continuationBonus: 0, isolationPenalty: 0 } }, 'chest');
  assert.equal(rankTargets(next, DAY, NOW)[0].target.presetKey, 'lateral');
  next = { ...next, targets: next.targets.map(target => target.presetKey === 'chest' ? { ...target, priority: 3 } : target) };
  assert.equal(rankTargets(next, DAY, NOW)[0].target.presetKey, 'chest');
});

test('missing metadata is neutral and the best eligible exercise alternative guides each target', async () => {
  const { state, log, row, targetFor } = await setup();
  const lateral = targetFor(state, 'lateral'), chest = targetFor(state, 'chest');
  const next = log({ ...state, targets: state.targets.map(target => target.id === lateral.id ? { ...target, exerciseIds: [...target.exerciseIds, ...chest.exerciseIds] } : target) }, 'chest', 1);
  const candidate = row(next, 'lateral');
  assert.equal(candidate.recommendedExerciseId, lateral.exerciseIds[0]);
  assert.equal(candidate.progress.occasions, 0);
  assert.equal(candidate.exerciseOptions.length, 2);
  const unknown = { ...next, exercises: next.exercises.map(exercise => lateral.exerciseIds.includes(exercise.id) ? { ...exercise, primaryMuscleIds: [], supportingMuscleIds: [], type: null } : exercise) };
  const neutral = row(unknown, 'lateral').exerciseOptions.find(option => option.exercise.id === lateral.exerciseIds[0]);
  assert.equal(neutral.fatigueModifier, 1);
  assert.equal(neutral.fatigueLoad, 0);
  assert.equal(neutral.orderingAdjustment, 0);
});

test('weight, reps and units do not enter ranking; setup-specific progress stays separate', async () => {
  const { state, log, rankTargets, row, equipmentHistory, targetFor } = await setup();
  const next = log(state, 'chest');
  const changed = { ...next, sets: next.sets.map(set => ({ ...set, weight: 999, reps: 1, unit: 'lbs' })) };
  assert.deepEqual(rankTargets(changed, DAY, NOW), rankTargets(next, DAY, NOW));
  const chest = row(next, 'chest'), fly = targetFor(next, 'fly');
  const history = equipmentHistory(next, { exerciseId: chest.recommendedExerciseId, machineId: next.sets[0].machineId }).filter(set => !set.demo);
  assert.equal(history.length, 1);
  assert.equal(equipmentHistory(next, { exerciseId: fly.exerciseIds[0], machineId: next.sets[0].machineId }).filter(set => !set.demo).length, 0);
});

test('heuristics are validated, persisted, and can disable supporting-muscle fatigue', async () => {
  const { state, log, row, DEFAULT_RANKING, saveRankingConfig, rankingConfig, readFlexibleState } = await setup(false);
  const configured = saveRankingConfig(state, { ...DEFAULT_RANKING, supportingWeight: 0, continuationBonus: 0 });
  const restored = readFlexibleState({ getItem: () => JSON.stringify(configured) });
  assert.deepEqual(rankingConfig(restored), { ...DEFAULT_RANKING, supportingWeight: 0, continuationBonus: 0 });
  assert.equal(row(log(restored, 'chest'), 'triceps').fatigueModifier, 1);
  assert.ok(row(log(restored, 'chest'), 'chest').reasonCodes.includes('CONTINUE'));
  for (const values of [{ supportingWeight: 2 }, { recommendedFatigueThreshold: -1 }, { fatiguePenaltyPerSet: '' }, { isolationPenalty: Infinity }]) {
    assert.throws(() => saveRankingConfig(state, { ...DEFAULT_RANKING, ...values }));
  }
  assert.equal(rankingConfig({ rankingConfig: { supportingWeight: 'bad' } }).supportingWeight, DEFAULT_RANKING.supportingWeight);
});

test('one physical set credits each explicitly mapped target once while fatigue counts it once', async () => {
  const { state, log, row, targetFor, targetSets } = await setup();
  const lateral = targetFor(state, 'lateral'), chest = targetFor(state, 'chest');
  const linked = { ...state, targets: state.targets.map(target => target.id === lateral.id ? { ...target, exerciseIds: [...target.exerciseIds, ...chest.exerciseIds] } : target) };
  const next = log(linked, 'chest', 3);
  assert.equal(next.sets.length, 3);
  assert.equal(targetSets(next, chest.id).length, 3);
  assert.equal(targetSets(next, lateral.id).length, 3);
  assert.equal(row(next, 'chest').progress.occasions, 1);
  assert.equal(row(next, 'lateral').progress.occasions, 1);
  assert.equal(row(next, 'fly').progress.todaySets, 0);
  assert.equal(row(next, 'fly').todayLoad, row(log(state, 'chest', 3), 'fly').todayLoad);
  const unlinked = { ...next, targets: next.targets.map(target => target.id === lateral.id ? { ...target, exerciseIds: lateral.exerciseIds } : target) };
  const later = log(unlinked, 'chest');
  assert.equal(targetSets(later, lateral.id).length, 3);
  assert.equal(targetSets(later, chest.id).length, 4);
  const duplicateCredits = { ...next, sets: next.sets.map(set => ({ ...set, activityIds: [...set.activityIds, ...set.activityIds] })) };
  assert.equal(row(duplicateCredits, 'lateral').progress.todaySets, 3);
});
