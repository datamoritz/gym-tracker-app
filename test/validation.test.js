const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseNumber,
  parseInteger,
  normalizeRoutine,
  normalizeWorkoutLog,
  assertValidRoutineInput,
  assertValidWorkoutInput
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
