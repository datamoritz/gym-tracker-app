const test = require('node:test');
const assert = require('node:assert/strict');
const provider = require('../api/_lib/notionProvider');

function mockNotion(t, respond) {
  const keys = ['NOTION_API_KEY', 'ROUTINE_DB_ID', 'LOG_DB_ID', 'EXERCISE_DB_ID'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  keys.forEach(key => { process.env[key] = 'test-only'; });
  t.after(() => keys.forEach(key => {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }));
  t.mock.method(global, 'fetch', async (url, options) => {
    const data = respond(url, options.body === undefined ? undefined : JSON.parse(options.body), options);
    return { ok: true, text: async () => JSON.stringify(data) };
  });
}

test('Notion routine round-trip preserves exercise order and units, including long JSON', async t => {
  let stored;
  mockNotion(t, (url, body) => {
    if (url.endsWith('/query')) return { results: [{ id: 'routine-page', properties: {
      JSON: { rich_text: stored.map(item => ({ plain_text: item.text.content })) }
    } }] };
    stored = body.properties.JSON.rich_text;
    return { id: 'routine-page' };
  });
  const routine = { id: 'push', name: 'Push', exercises: Array.from({ length: 20 }, (_, index) => ({
    id: 20 - index, name: `Exercise ${index}`, weightUnit: index % 2 ? 'kg' : 'lbs', suggestedWeight: 100
  })) };
  const saved = await provider.saveRoutine(routine);
  assert.equal(saved.notionPageId, 'routine-page');
  assert.ok(stored.length > 1);
  assert.ok(stored.every(item => item.text.content.length <= 2000));
  const [loaded] = await provider.listRoutines();
  assert.deepEqual(loaded.exercises.map(item => [item.id, item.weightUnit]),
    routine.exercises.map(item => [item.id, item.weightUnit]));
});

test('exercise guides preserve rich-text segments, uploaded and external images, and missing fields', async t => {
  mockNotion(t, () => ({ results: [{ id: 'guide', properties: {
    'Exercise Name': { title: [{ plain_text: 'Chest Fly' }] },
    'Muscles Worked': { rich_text: [{ plain_text: 'Chest — ' }, { plain_text: 'Primary' }] },
    Instructions: { rich_text: [{ plain_text: '1. Sit tall.\n' }, { plain_text: '2. Move slowly.' }] },
    'Common Mistakes': { rich_text: [{ plain_text: 'Avoid swinging.' }] },
    'Source URL': { url: 'https://example.com/guide' },
    Images: { files: [
      { name: 'fly.avif', file: { url: 'https://example.com/signed.avif', expiry_time: '2026-10-22T00:00:00Z' } },
      { name: 'fly.webp', external: { url: 'https://example.com/fly.webp' } },
      { name: 'incomplete' }
    ] }
  } }, { id: 'empty', properties: {} }] }));
  const [guide, empty] = await provider.listExercises();
  assert.equal(guide.musclesWorked, 'Chest — Primary');
  assert.equal(guide.instructions, '1. Sit tall.\n2. Move slowly.');
  assert.equal(guide.commonMistakes, 'Avoid swinging.');
  assert.equal(guide.sourceUrl, 'https://example.com/guide');
  assert.deepEqual(guide.images, [
    { name: 'fly.avif', url: 'https://example.com/signed.avif', expiryTime: '2026-10-22T00:00:00Z' },
    { name: 'fly.webp', url: 'https://example.com/fly.webp', expiryTime: null }
  ]);
  assert.equal(empty.instructions, '');
  assert.deepEqual(empty.images, []);
});

test('opening a guide fetches a fresh page and only allows exercise database pages', async t => {
  let parent = 'test-only';
  let archived = false;
  mockNotion(t, (url, body, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(body, undefined);
    return { id: '2b3fe23d-5e3c-802f-b092-f8f679d3e372', parent: { database_id: parent }, archived, properties: {
      Images: { files: [{ name: 'raise.avif', file: { url: 'https://example.com/fresh.avif' } }] }
    } };
  });
  const id = '2b3fe23d-5e3c-802f-b092-f8f679d3e372';
  assert.equal((await provider.getExercise(id)).images[0].url, 'https://example.com/fresh.avif');
  parent = 'another-database';
  await assert.rejects(provider.getExercise(id), { status: 404 });
  parent = 'test-only';
  archived = true;
  await assert.rejects(provider.getExercise(id), { status: 404 });
  await assert.rejects(provider.getExercise('../other'), { status: 400 });
  await assert.rejects(provider.getExercise([id]), { status: 400 });
});

test('the exercise library includes later pages of Notion results', async t => {
  mockNotion(t, (url, body) => body.start_cursor
    ? { results: [{ id: 'second', properties: {} }], has_more: false }
    : { results: [{ id: 'first', properties: {} }], has_more: true, next_cursor: 'next' });
  assert.deepEqual((await provider.listExercises()).map(exercise => exercise.id), ['first', 'second']);
});

test('mixed-unit sets use the existing kg column and preserve original pounds and notes', async t => {
  const writes = [];
  mockNotion(t, (url, body) => { writes.push(body.properties); return { id: 'set' }; });
  await provider.logWorkout({ date: '2026-10-21', routine: { exercises: [
    { id: 'press', name: 'Chest press', weightUnit: 'lbs' },
    { id: 'legacy', name: 'Bench' }
  ] }, workoutLog: {
    press: [{ w: 100, r: 8, weightUnit: 'lbs', note: 'Good' }, { w: 50, r: 6, weightUnit: 'kg' }],
    legacy: [{ w: 60, r: 10 }]
  } });
  assert.equal(writes.length, 3);
  assert.ok(Math.abs(writes[0].Weight.number - 45.359237) < 0.000001);
  assert.equal(writes[0].Notes.rich_text[0].text.content, 'Entered load: 100 lbs\nGood');
  assert.equal(writes[1].Weight.number, 50);
  assert.equal(writes[2].Weight.number, 60);
  assert.ok(writes.every(properties => !('Unit' in properties)));
});

test('exercise library recognizes pounds while older weights remain kilograms', async t => {
  mockNotion(t, () => ({ results: ['100 lbs', '20 kg', '7.5'].map((weight, index) => ({
    id: String(index), properties: { Weight: { rich_text: [{ plain_text: weight }] } }
  })) }));
  const exercises = await provider.listExercises();
  assert.deepEqual(exercises.map(item => [item.weight, item.weightUnit]), [[100, 'lbs'], [20, 'kg'], [7.5, 'kg']]);
});
