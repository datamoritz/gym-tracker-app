const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../src/flexible.mjs'), import('../src/ranking.mjs'), import('../src/equipment.mjs'), import('../src/trainingSync.mjs')]);
const DAY = '2026-11-22', NOW = '2026-11-22T21:00:00Z';

async function fixture(keys = ['chest', 'row']) {
  const [domain, ranking, equipment, sync] = await modules;
  const initial = domain.createFlexibleState('America/Los_Angeles');
  const state = { ...initial, production: true, demoHistory: [], targets: initial.targets.filter(t => keys.includes(t.presetKey)) };
  const target = (s, key) => s.targets.find(t => t.presetKey === key);
  function log(s, key, day, count) {
    const t = target(s, key), exerciseId = t.exerciseIds[0], now = `${day}T20:00:00Z`;
    let next = domain.startFlexibleSession(domain.finishFlexibleSession(s, now), day, now);
    for (let i = 0; i < (count ?? t.requiredSets); i++) next = domain.addFlexibleSet(next, {
      targetId: t.id, exerciseId, machineId: equipment.exerciseMachines(next, exerciseId)[0].id,
      weight: 20, reps: 10, day, now
    });
    return domain.finishFlexibleSession(next, now);
  }
  const rank = (s, day = DAY) => domain.rankTargets(s, day, `${day}T21:00:00Z`);
  const row = (s, key, day = DAY) => rank(s, day).find(r => r.target.presetKey === key);
  return { ...domain, ...ranking, ...sync, state, log, target, rank, row };
}

test('after a week off, older completion history changes order without adding missed-week debt', async () => {
  const { state, log, rank, row, mutationsBetween } = await fixture();
  const next = log(log(state, 'chest', '2026-11-12'), 'row', '2026-10-23');
  const before = JSON.stringify(next), rows = rank(next);
  assert.equal(rows[0].target.presetKey, 'row', 'The older row should beat the first item in plan order');
  for (const candidate of rows) {
    assert.equal(candidate.progress.occasions, 0);
    assert.equal(candidate.progress.remaining, candidate.target.frequency);
    assert.equal(candidate.baseScore, candidate.target.priority);
  }
  assert.ok(row(next, 'row').recencyBonus > row(next, 'chest').recencyBonus);
  assert.ok(row(next, 'row').reasonCodes.includes('LESS_RECENT'));
  assert.equal(JSON.stringify(next), before);
  assert.deepEqual(mutationsBetween(JSON.parse(before), next), []);
});

test('rotation survives repeated breaks instead of always returning to the first target', async () => {
  const { state, log, rank, row } = await fixture();
  const previous = log(log(state, 'chest', '2026-11-12'), 'row', '2026-10-23');
  assert.equal(rank(previous)[0].target.presetKey, 'row');
  const returned = log(previous, 'row', DAY);
  assert.equal(row(returned, 'row').recencyBonus, 0);
  assert.equal(row(returned, 'row').bucket, 'done');
  assert.equal(rank(returned)[0].target.presetKey, 'chest');
  assert.equal(rank(returned, '2026-11-30')[0].target.presetKey, 'chest');
  assert.equal(row(returned, 'row', '2026-11-30').progress.occasions, 0);
});

test('the bonus is bounded while older dates still break ties after both targets reach the cap', async () => {
  const { state, log, rank, row, recencyPreference, DEFAULT_RANKING } = await fixture();
  const next = log(log(state, 'chest', '2026-08-01'), 'row', '2026-07-01');
  assert.equal(row(next, 'chest').recencyBonus, .25);
  assert.equal(row(next, 'row').recencyBonus, .25);
  assert.equal(rank(next)[0].target.presetKey, 'row');
  assert.equal(recencyPreference(7, true, DEFAULT_RANKING).recencyBonus, 0);
  assert.equal(recencyPreference(28, true, DEFAULT_RANKING).recencyBonus, .25);
  assert.equal(recencyPreference(100000, true, DEFAULT_RANKING).recencyBonus, .25);
  const disabled = { ...next, rankingConfig: { maxRecencyBonus: 0 } };
  assert.equal(rank(disabled)[0].target.presetKey, 'chest');
  assert.ok(rank(disabled).every(r => r.recencyBonus === 0 && r.recencyAge === -1));
});

test('never-completed targets receive the bounded preference; a fresh empty history retains plan order', async () => {
  const { state, log, rank, row } = await fixture();
  assert.equal(rank(state)[0].target.presetKey, 'chest');
  const previous = log(state, 'chest', '2026-07-01');
  assert.equal(rank(previous)[0].target.presetKey, 'row');
  assert.equal(row(previous, 'row').recencyBonus, .25);
  assert.ok(row(previous, 'row').reasonCodes.includes('NOT_COMPLETED'));
});

test('two larger exercises still lead before older core, then the oldest core receives preference', async () => {
  const { state, log, rank, row, openingCompoundProgress } = await fixture(['chest', 'row', 'wood', 'dead']);
  let next = log(log(log(log(state, 'chest', '2026-11-12'), 'row', '2026-11-11'), 'wood', '2026-09-01'), 'dead', '2026-09-02');
  next = { ...next, targets: next.targets.map(t => ({ ...t, order: t.presetKey === 'dead' ? 0 : 100 })) };
  assert.equal(rank(next)[0].exercise.type, 'compound');
  next = log(next, rank(next)[0].target.presetKey, DAY);
  assert.equal(openingCompoundProgress(next, DAY, NOW).completed, 1);
  assert.equal(rank(next)[0].exercise.type, 'compound');
  next = log(next, rank(next)[0].target.presetKey, DAY);
  assert.equal(openingCompoundProgress(next, DAY, NOW).completed, 2);
  assert.equal(rank(next)[0].target.presetKey, 'wood');
  assert.equal(row(next, 'chest').recencyBonus, 0);
  assert.equal(row(next, 'row').recencyBonus, 0);
});

test('partial work affects recovery without replacing the last completed occasion or changing credit', async () => {
  const { state, log, row } = await fixture();
  const next = log(log(log(state, 'row', '2026-10-01'), 'chest', '2026-11-12'), 'row', '2026-11-21', 1);
  const enabled = row(next, 'row'), disabled = row({ ...next, rankingConfig: { maxRecencyBonus: 0 } }, 'row');
  assert.equal(enabled.progress.lastDay, '2026-10-01');
  assert.equal(enabled.recencyBonus, .25);
  assert.ok(enabled.fatigueModifier < 1);
  assert.equal(enabled.fatigueModifier, disabled.fatigueModifier);
  assert.deepEqual(enabled.progress, disabled.progress);
});

test('weekly-met targets receive no recency boost even after a long absence', async () => {
  const { state, log, row } = await fixture();
  const next = log(log(state, 'chest', '2026-11-20'), 'chest', '2026-11-21');
  assert.equal(row(next, 'chest').weekly_target_met, true);
  assert.equal(row(next, 'chest').finished_today, false);
  assert.equal(row(next, 'chest').bucket, 'done');
  assert.equal(row(next, 'chest').recencyBonus, 0);
});
