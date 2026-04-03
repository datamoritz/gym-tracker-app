const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseNumber,
  parseInteger,
  normalizeRoutine,
  normalizeWorkoutLog,
  normalizeWorkoutQuery,
  assertValidRoutineInput,
  assertValidWorkoutInput,
  assertValidWorkoutQuery
} = require('../api/_lib/validation');

test('parseNumber falls back for invalid values', () => {
  assert.equal(parseNumber('7.5', 0), 7.5);
  assert.equal(parseNumber('abc', 4), 4);
});

test('parseInteger falls back for invalid values', () => {
  assert.equal(parseInteger('12', 0), 12);
  assert.equal(parseInteger(undefined, 9), 9);
});

test('normalizeRoutine fills in defaults', () => {
  const routine = normalizeRoutine({
    name: 'Push',
    exercises: [{ name: 'Bench Press', targetSets: '4', targetReps: '8' }]
  });

  assert.equal(routine.name, 'Push');
  assert.equal(routine.exercises.length, 1);
  assert.equal(routine.exercises[0].targetSets, 4);
  assert.equal(routine.exercises[0].targetReps, 8);
  assert.equal(routine.exercises[0].defaultPause, 90);
});

test('normalizeWorkoutLog coerces values and strips invalid sets', () => {
  const workoutLog = normalizeWorkoutLog({
    bench: [{ w: '80', r: '8', note: 'solid' }, { w: 'bad', r: undefined }]
  });

  assert.deepEqual(workoutLog.bench, [
    { w: 80, r: 8, note: 'solid' },
    { w: 0, r: 0, note: '' }
  ]);
});

test('assertValidRoutineInput rejects missing routine', () => {
  assert.throws(() => assertValidRoutineInput(null), /Missing routine data/);
});

test('assertValidWorkoutInput validates date and normalizes payload', () => {
  const payload = assertValidWorkoutInput({
    date: '2026-04-02',
    routine: { name: 'Push', exercises: [] },
    workoutLog: { bench: [{ w: '90', r: '5' }] }
  });

  assert.equal(payload.date, '2026-04-02');
  assert.equal(payload.routine.name, 'Push');
  assert.deepEqual(payload.workoutLog.bench, [{ w: 90, r: 5, note: '' }]);
});

test('normalizeWorkoutQuery applies defaults and bounds', () => {
  assert.deepEqual(normalizeWorkoutQuery({}), {
    limit: 50,
    startDate: null,
    endDate: null
  });

  assert.deepEqual(normalizeWorkoutQuery({ limit: '999' }), {
    limit: 200,
    startDate: null,
    endDate: null
  });
});

test('assertValidWorkoutQuery validates optional date filters', () => {
  const query = assertValidWorkoutQuery({
    limit: '25',
    startDate: '2026-03-01',
    endDate: '2026-03-31'
  });

  assert.deepEqual(query, {
    limit: 25,
    startDate: '2026-03-01',
    endDate: '2026-03-31'
  });

  assert.throws(() => assertValidWorkoutQuery({ startDate: '03/01/2026' }), /startDate must use YYYY-MM-DD/);
});
