const test = require('node:test');
const assert = require('node:assert/strict');
const editor = import('../src/targetEditor.mjs');
const form = () => ({ frequency: 2, prescriptions: [{ id: 'first', requiredSets: 2, maxSets: 3 }, { id: 'second', requiredSets: 2, maxSets: 2 }] });
test('clearing and retyping frequency preserves the empty draft and accepts 2 instead of jumping to 7', async () => {
  const { editTargetFrequency } = await editor;
  const original = form(), blank = editTargetFrequency(original, '', () => 'new');
  assert.equal(blank.frequency, '');
  assert.deepEqual(blank.prescriptions, original.prescriptions);
  const typed = editTargetFrequency(blank, '2', () => 'new');
  assert.equal(typed.frequency, '2');
  assert.deepEqual(typed.prescriptions, original.prescriptions);
});
test('invalid frequency drafts do not clamp or resize; valid changes preserve doses and add unique IDs', async () => {
  const { editTargetFrequency } = await editor;
  const original = form();
  for (const value of ['0', '12', '2.5']) {
    const changed = editTargetFrequency(original, value, () => 'new');
    assert.equal(changed.frequency, value);
    assert.deepEqual(changed.prescriptions, original.prescriptions);
  }
  let id = 0;
  const expanded = editTargetFrequency(original, '4', () => `new-${++id}`);
  assert.deepEqual(expanded.prescriptions.map(p => p.id), ['first', 'second', 'new-1', 'new-2']);
  assert.equal(expanded.prescriptions[1].maxSets, 2);
  assert.equal(original.prescriptions.length, 2);
  assert.equal(editTargetFrequency(expanded, '1', () => 'unused').prescriptions.length, 1);
});
