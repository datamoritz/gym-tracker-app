const test = require('node:test');
const assert = require('node:assert/strict');
const modules = import('../src/workoutJournal.mjs');
const sets = [
  { id:'a',exerciseId:'press',machineId:'press1',trainingDate:'2026-10-29',performedAt:'2026-10-29T18:00:00Z',weight:20,unit:'lbs',reps:8,kind:'working' },
  { id:'b',exerciseId:'raise',machineId:'cable1',trainingDate:'2026-10-30',performedAt:'2026-10-30T18:00:00Z',weight:5,unit:'kg',reps:12,kind:'working' },
  { id:'c',exerciseId:'press',machineId:'press2',trainingDate:'2026-10-29',performedAt:'2026-10-29T18:05:00Z',weight:40,unit:'kg',reps:10,kind:'working' }
];
test('default journal includes every workout day and every original set once, without mixing units', async()=>{
  const {journalSets,journalDays}=await modules;
  const state={sets:[sets[2],sets[0],sets[1],sets[0],{...sets[0],id:'demo',demo:true}]};
  const before=JSON.stringify(state);
  const result=journalSets(state);
  assert.deepEqual(result.map(s=>s.id),['b','a','c']);
  assert.deepEqual(journalDays(result).map(d=>[d.day,d.sets.length]),[['2026-10-30',1],['2026-10-29',2]]);
  assert.equal(result.find(s=>s.id==='a').weight,20);
  assert.equal(result.find(s=>s.id==='a').unit,'lbs');
  assert.equal(JSON.stringify(state),before);
});
test('journal filters combine exercise, exact equipment and inclusive date range',async()=>{
  const {journalSets}=await modules;
  assert.deepEqual(journalSets({sets},{exerciseId:'press',machineId:'press2',from:'2026-10-29',to:'2026-10-29'}).map(s=>s.id),['c']);
  assert.equal(journalSets({sets},{exerciseId:'raise',machineId:'press2'}).length,0);
  assert.equal(journalSets({sets},{from:'2026-10-31'}).length,0);
});
