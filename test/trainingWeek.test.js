const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const provider = require('../api/_lib/trainingProvider');
const notion = require('../api/_lib/fitnessNotion');
const modules = Promise.all([import('../src/trainingWeek.mjs'), import('../src/flexible.mjs'), import('../src/equipment.mjs'), import('../src/trainingCalendar.mjs'), import('../src/trainingSync.mjs')]);

async function fixture() {
  const [week, domain, equipment, calendar, sync] = await modules;
  const initial = domain.createFlexibleState('America/Los_Angeles');
  const state = { ...initial, production: true, trainingDayStartHour: 4, settingsId: crypto.randomUUID(), demoHistory: [] };
  const target = state.targets.find(t => t.presetKey === 'lateral');
  function log(s, day, count = 2, at = `${day}T20:00:00Z`, selected = target) {
    const exerciseId = selected.exerciseIds[0], machineId = equipment.exerciseMachines(s, exerciseId)[0].id;
    let next = domain.startFlexibleSession(domain.finishFlexibleSession(s, at), day, at);
    for (let i = 0; i < count; i++) next = domain.addFlexibleSet(next, { targetId: selected.id, exerciseId, machineId, weight: 10, reps: 12, day, now: at });
    return domain.finishFlexibleSession(next, at);
  }
  return { ...week, ...domain, ...equipment, ...calendar, ...sync, state, target, log };
}

test('Monday–Sunday is the default and week dates use civil days across year boundaries', async () => {
  const { trainingWeek } = await fixture();
  assert.deepEqual(trainingWeek({}, '2026-11-22'), { startDay: '2026-11-16', endDay: '2026-11-22', weekStartDay: 1 });
  assert.deepEqual(trainingWeek({}, '2026-11-23'), { startDay: '2026-11-23', endDay: '2026-11-29', weekStartDay: 1 });
  assert.deepEqual(trainingWeek({}, '2027-01-01'), { startDay: '2026-12-28', endDay: '2027-01-03', weekStartDay: 1 });
});

test('weeks change at the configured 4 a.m. Los Angeles boundary, including daylight saving', async () => {
  const { state, trainingWeek, currentTrainingDay } = await fixture();
  for (const [before, after, oldStart, newStart] of [
    ['2026-11-23T11:59:59Z', '2026-11-23T12:00:00Z', '2026-11-16', '2026-11-23'],
    ['2026-11-02T11:59:59Z', '2026-11-02T12:00:00Z', '2026-10-26', '2026-11-02'],
    ['2026-03-09T10:59:59Z', '2026-03-09T11:00:00Z', '2026-03-02', '2026-03-09']
  ]) {
    assert.equal(trainingWeek(state, currentTrainingDay(state, before)).startDay, oldStart);
    assert.equal(trainingWeek(state, currentTrainingDay(state, after)).startDay, newStart);
  }
});

test('a Wednesday reset counts Wednesday–Tuesday and renews automatically without catch-up debt', async () => {
  const { state, target, log, startNewTrainingWeek, trainingWeek, targetProgress } = await fixture();
  let next = startNewTrainingWeek(log(state, '2026-11-24'), '2026-11-25', '2026-11-25');
  assert.equal(targetProgress(next, target, '2026-11-25', '2026-11-25T21:00:00Z').occasions, 0);
  next = log(log(next, '2026-11-25'), '2026-12-01');
  assert.equal(targetProgress(next, target, '2026-12-01', '2026-12-01T21:00:00Z').occasions, 2);
  assert.deepEqual(trainingWeek(next, '2026-12-01'), { startDay: '2026-11-25', endDay: '2026-12-01', weekStartDay: 3 });
  assert.equal(targetProgress(next, target, '2026-12-02', '2026-12-02T21:00:00Z').occasions, 0);
  const afterBreak = targetProgress(next, target, '2027-01-06', '2027-01-06T21:00:00Z');
  assert.equal(afterBreak.remaining, target.frequency);
  assert.equal(afterBreak.lastDay, '2026-12-01');
});

test('a reset preserves today, notes, machine history and all logs; only a settings mutation is queued', async () => {
  const { state, target, log, startNewTrainingWeek, targetProgress, equipmentHistory, mutationsBetween } = await fixture();
  let before = log(log(state, '2026-11-23'), '2026-11-25');
  before = { ...before, exercises: before.exercises.map(e => ({ ...e, note: 'Seat 4', noteUpdatedAt: '2026-11-23T20:00:00Z' })) };
  const next = startNewTrainingWeek(before, '2026-11-25', '2026-11-25');
  assert.equal(targetProgress(before, target, '2026-11-25').occasions, 2);
  assert.equal(targetProgress(next, target, '2026-11-25').occasions, 1, 'Existing work on the chosen start date counts');
  assert.equal(targetProgress(next, target, '2026-11-25').finished_today, true);
  for (const key of ['sets', 'activities', 'sessions', 'exercises', 'machines', 'targets']) assert.equal(next[key], before[key]);
  const pair = { exerciseId: target.exerciseIds[0], machineId: before.sets[0].machineId };
  assert.deepEqual(equipmentHistory(next, pair), equipmentHistory(before, pair));
  const operations = mutationsBetween(before, next);
  assert.equal(operations.length, 1);
  assert.equal(operations[0].entity, 'settings');
  assert.deepEqual(Object.keys(operations[0].changes), ['trainingWeekSchedule']);
  assert.deepEqual(operations[0].base, { trainingWeekSchedule: [] }, 'Old caches must have the same empty default as Notion');
  assert.equal(startNewTrainingWeek(next, '2026-11-25', '2026-11-25'), next, 'Repeated confirmation is idempotent');
});

test('Sunday evening work still affects Tuesday recovery after a new target week starts', async () => {
  const { state, log, startNewTrainingWeek, rankTargets, targetProgress } = await fixture();
  const shoulder = state.targets.find(t => t.presetKey === 'shoulder');
  const previous = log(state, '2026-11-22', 3, '2026-11-23T04:00:00Z', shoulder);
  const next = startNewTrainingWeek(previous, '2026-11-24', '2026-11-24');
  const before = rankTargets(previous, '2026-11-24', '2026-11-24T16:00:00Z').find(r => r.target.id === shoulder.id);
  const after = rankTargets(next, '2026-11-24', '2026-11-24T16:00:00Z').find(r => r.target.id === shoulder.id);
  assert.equal(targetProgress(next, shoulder, '2026-11-24').occasions, 0);
  assert.equal(after.progress.lastDay, '2026-11-22');
  assert.ok(after.fatigueModifier < 1);
  assert.equal(after.fatigueModifier, before.fatigueModifier);
  assert.equal(after.recencyAge, before.recencyAge);
  assert.ok(after.machines.length > 0, 'Recovery cannot remove a selectable exercise');
});

test('weekly-met exercises remain selectable and can log more work', async () => {
  const { state, log, rankTargets } = await fixture();
  const shoulder = state.targets.find(t => t.presetKey === 'shoulder');
  const previous = log(state, '2026-11-24', 3, '2026-11-24T20:00:00Z', shoulder);
  const row = rankTargets(previous, '2026-11-25', '2026-11-25T21:00:00Z').find(r => r.target.id === shoulder.id);
  assert.equal(row.weekly_target_met, true);
  assert.ok(row.machines.length > 0);
  assert.equal(log(previous, '2026-11-25', 3, '2026-11-25T20:00:00Z', shoulder).sets.length, 6);
});

test('schedule changes preserve earlier week definitions, handle same-day changes, and reject invalid dates', async () => {
  const { state, trainingWeek, startNewTrainingWeek, startDayForWeekday, validWeekSchedule } = await fixture();
  let next = startNewTrainingWeek(state, '2026-11-18', '2026-11-18');
  next = startNewTrainingWeek(next, '2026-11-26', '2026-11-26');
  assert.equal(trainingWeek(next, '2026-11-22').startDay, '2026-11-18');
  assert.equal(trainingWeek(next, '2026-11-26').startDay, '2026-11-26');
  next = startNewTrainingWeek(next, startDayForWeekday(1, '2026-11-26'), '2026-11-26');
  assert.equal(trainingWeek(next, '2026-11-26').startDay, '2026-11-23');
  assert.equal(trainingWeek(next, '2026-11-22').startDay, '2026-11-18');
  assert.equal(validWeekSchedule(next.trainingWeekSchedule), true);
  for (const date of ['2026-11-27', '2026-11-19', '2026-02-30', 'bad']) assert.throws(() => startNewTrainingWeek(next, date, '2026-11-26'), /start date/);
  assert.equal(validWeekSchedule([{ id: crypto.randomUUID(), startDay: '2026-02-30', effectiveOn: '2026-03-01' }]), false);
  assert.equal(validWeekSchedule([...next.trainingWeekSchedule, next.trainingWeekSchedule[0]]), false);
});

test('week settings sync through Notion, retry without duplication, and conflict rather than lose another device’s reset', async t => {
  const { state, startNewTrainingWeek, mutationsBetween, equal } = await fixture();
  const next = startNewTrainingWeek(state, '2026-11-25', '2026-11-25');
  const [operation] = mutationsBetween(state, next), page = crypto.randomUUID();
  const record = { id: state.settingsId, name: 'Preferences', timeZone: state.timeZone, selectedGymId: state.selectedGymId, trainingWeekSchedule: [], notionPageId: page };
  const context = { all: { settings: [record] }, cfg: {} };
  let writes = 0, saved;
  t.mock.method(notion, 'updatePage', async (pageId, properties) => { writes++; saved = JSON.parse(notion.rich(properties.Data)); return { id: pageId }; });
  await provider.applyOperation(context, operation, equal);
  await provider.applyOperation(context, operation, equal);
  assert.equal(writes, 1);
  assert.deepEqual(saved.trainingWeekSchedule, next.trainingWeekSchedule);
  const other = mutationsBetween(state, startNewTrainingWeek(state, '2026-11-24', '2026-11-25'))[0];
  await assert.rejects(provider.applyOperation(context, other, equal), error => error.status === 409);
  await assert.rejects(provider.applyOperation(context, { ...operation, base: { trainingWeekSchedule: next.trainingWeekSchedule }, changes: { trainingWeekSchedule: [{ id: crypto.randomUUID(), startDay: 'bad', effectiveOn: 'bad' }] } }, equal), /Invalid training-week schedule/);
  assert.equal(writes, 1);
});

test('Notion reload preserves the chosen week schedule and supplies an empty default for older preferences', async t => {
  const { state, startNewTrainingWeek } = await fixture();
  const next = startNewTrainingWeek(state, '2026-11-25', '2026-11-25');
  const cfg = Object.fromEntries(['exercises','gyms','muscles','machines','targets','sessions','sets','settings'].map(key => [key, { dataSourceId: crypto.randomUUID() }]));
  cfg.parentPageId = crypto.randomUUID(); cfg.settingsId = state.settingsId;
  const original = process.env.FITNESS_DATABASES;
  process.env.FITNESS_DATABASES = JSON.stringify(cfg);
  t.after(() => { if (original === undefined) delete process.env.FITNESS_DATABASES; else process.env.FITNESS_DATABASES = original; });
  let data = { trainingWeekSchedule: next.trainingWeekSchedule };
  t.mock.method(notion, 'rows', async source => source === cfg.settings.dataSourceId ? [{ id: crypto.randomUUID(), properties: {
    Name: notion.title('Preferences'), 'App ID': notion.text(state.settingsId), Data: notion.text(JSON.stringify(data))
  } }] : []);
  assert.deepEqual((await provider.readAll()).state.trainingWeekSchedule, next.trainingWeekSchedule);
  data = {};
  const restored = await provider.readAll();
  assert.deepEqual(restored.state.trainingWeekSchedule, []);
  assert.deepEqual(restored.context.all.settings[0].trainingWeekSchedule, []);
});
