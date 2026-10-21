const test = require('node:test');
const assert = require('node:assert/strict');

test('reordering preserves exercise settings and leaves the original routine intact', async () => {
  const { moveExercise } = await import('../src/workout.mjs');
  const exercises = [{ id: 1, weightUnit: 'lbs', targetSets: 4 }, { id: 2 }, { id: 3 }];
  const moved = moveExercise(exercises, 0, 1);
  assert.deepEqual(moved.map(item => item.id), [2, 1, 3]);
  assert.equal(moved[1].weightUnit, 'lbs');
  assert.deepEqual(exercises.map(item => item.id), [1, 2, 3]);
  assert.deepEqual(moveExercise(moved, 1, -1), exercises);
  assert.deepEqual(moveExercise(exercises, 0, -1), exercises);
  assert.deepEqual(moveExercise(exercises, 2, 1), exercises);
});

test('weight conversion defaults old data to kg and handles both directions', async () => {
  const { convertWeight } = await import('../src/workout.mjs');
  assert.equal(convertWeight(100, 'lbs', 'kg'), 45.36);
  assert.equal(convertWeight(45.36, 'kg', 'lbs'), 100);
  assert.equal(convertWeight('2.5', 'kg', 'kg'), 2.5);
  assert.equal(convertWeight(50, undefined, 'lbs'), 110.23);
});

test('feedback follows routine order and compares mixed-unit sets in the selected unit', async () => {
  const { buildFeedbackWorkout } = await import('../src/workout.mjs');
  const workout = buildFeedbackWorkout({ name: 'Push', exercises: [
    { id: 2, name: 'Chest press', weightUnit: 'lbs' },
    { id: 1, name: 'Shoulder press' },
    { id: 3, name: 'Skipped' }
  ] }, {
    1: [{ w: 20, r: 8 }],
    2: [{ w: 100, r: '10', weightUnit: 'lbs', note: 'Good' }, { w: 45.36, r: 8, weightUnit: 'kg' }]
  }, '2026-10-21');
  assert.deepEqual(workout.exercises.map(item => item.name), ['Chest press', 'Shoulder press']);
  assert.deepEqual(workout.exercises[0].weight, [100, 100]);
  assert.equal(workout.exercises[0].weight_unit, 'lbs');
  assert.equal(workout.exercises[1].weight_unit, 'kg');
  assert.equal(workout.exercises[0].notes, 'Set 1: Good');
});
