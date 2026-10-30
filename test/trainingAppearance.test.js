const test = require('node:test');
const assert = require('node:assert/strict');

test('appearance preferences are isolated from training state and survive a browser reload', async () => {
  const ui = await import('../src/trainingAppearance.mjs');
  const values = new Map([['fitness_notion_v1', '{"queue":["pending workout"]}']]);
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key,value) };
  const originalTraining = values.get('fitness_notion_v1');
  assert.deepEqual(ui.readAppearance(storage), ui.DEFAULT_APPEARANCE);
  ui.writeAppearance(storage, { theme:'burgundy',darkness:78,menuLift:84,goalDay:'2026-10-29',dailyGoal:8 });
  assert.deepEqual(ui.readAppearance(storage), { theme:'burgundy',darkness:78,menuLift:84,goalDay:'2026-10-29',dailyGoal:8 });
  assert.equal(values.get('fitness_notion_v1'),originalTraining);
  assert.deepEqual([...values.keys()],['fitness_notion_v1',ui.APPEARANCE_KEY]);
});
test('invalid or unavailable appearance storage falls back safely, and offsets stay on screen', async () => {
  const ui = await import('../src/trainingAppearance.mjs');
  for (const getItem of [() => '{bad',() => 'null',() => { throw Error('disabled'); }]) assert.deepEqual(ui.readAppearance({getItem}),ui.DEFAULT_APPEARANCE);
  const normalized = ui.normalizeAppearance({theme:'__proto__',darkness:500,menuLift:9999,goalDay:'yesterday',dailyGoal:-4});
  assert.deepEqual(normalized,{theme:'night',darkness:100,menuLift:160,goalDay:'',dailyGoal:null});
  assert.equal(ui.appearanceStyle(normalized)['--menu-lift'],'160px');
  assert.equal(ui.normalizeAppearance({darkness:-50,menuLift:-40}).menuLift,0);
  assert.equal(ui.normalizeAppearance({darkness:NaN,menuLift:Infinity}).darkness,50);
  assert.throws(() => ui.writeAppearance({setItem(){throw Error('full');}},{}),/full/);
});
test('darkness changes surface tones without dimming text or mixing graph colors', async () => {
  const {appearanceStyle} = await import('../src/trainingAppearance.mjs');
  for (const theme of ['night','burgundy','carbon']) {
    const soft=appearanceStyle({theme,darkness:0}),normal=appearanceStyle({theme,darkness:50}),deep=appearanceStyle({theme,darkness:100});
    assert.notEqual(soft['--bg'],normal['--bg']);assert.notEqual(deep['--surface'],normal['--surface']);
    for(const key of ['--ink','--muted','--accent','--button-ink']) assert.equal(deep[key],soft[key]);
    assert.ok(Object.values(deep).every(value=>/^#[0-9a-f]{6}$|^\d+px$/.test(value)));
  }
});
