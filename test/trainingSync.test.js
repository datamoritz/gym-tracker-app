const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const provider = require('../api/_lib/trainingProvider');
const notion = require('../api/_lib/fitnessNotion');
const id = () => crypto.randomUUID();

async function fixture() {
  const domain = await import('../src/flexible.mjs');
  const sync = await import('../src/trainingSync.mjs');
  const state = { ...domain.createFlexibleState(), production: true, settingsId: id() };
  return { domain, sync, state };
}
test('production saves contain no demo history and preserve one physical set with all target-credit snapshots', async () => {
  const { domain, sync, state } = await fixture();
  const target = state.targets[0], exerciseId = target.exerciseIds[0], machineId = state.machines.find(m=>m.exerciseId===exerciseId).id;
  const next = domain.addFlexibleSet(domain.startFlexibleSession(state,'2026-10-29','2026-10-29T18:00:00Z'), { targetId: target.id, machineId, exerciseId, weight:25,reps:10,day:'2026-10-29',now:'2026-10-29T18:01:00Z' });
  const ops = sync.mutationsBetween(state,next);
  assert.deepEqual(ops.map(op=>op.entity),['sessions','sets']);
  assert.equal(ops[1].changes.activities.length,1);
  assert.equal(ops[1].changes.activities[0].targetId,target.id);
  assert.equal(JSON.stringify(ops).includes('demoHistory'),false);
  assert.equal(sync.mutationsBetween(next,JSON.parse(JSON.stringify(next))).length,0);
});
test('equipment unlinking only changes the authoritative assignment relation; deleting and undoing sets preserve identity', async () => {
  const { sync, state } = await fixture();
  const link = state.equipmentLinks[0];
  const unlinked = { ...state, equipmentLinks: state.equipmentLinks.filter(x=>x.id!==link.id) };
  const [op] = sync.mutationsBetween(state,unlinked);
  assert.equal(op.entity,'assignments'); assert.equal(op.recordId,link.exerciseId);
  const set = { id:id(), exerciseId:link.exerciseId, machineId:link.machineId,weight:20,reps:10,kind:'working',unit:'kg' };
  const withSet = { ...state, sets:[set] };
  const [remove] = sync.mutationsBetween(withSet,state);
  assert.deepEqual(remove.changes,{deleted:true}); assert.equal(remove.recordId,set.id);
  const [restore] = sync.mutationsBetween(state,withSet);
  assert.equal(restore.recordId,set.id); assert.equal(restore.changes.deleted,false);
});
test('Notion updates are idempotent and conflict instead of overwriting a changed field', async t => {
  const { sync } = await fixture();
  const record = { id:id(),name:'SF Ocean',notionPageId:id(),deleted:false };
  const context = { all: { gyms:[record] }, cfg:{} };
  let writes = 0;
  t.mock.method(notion,'updatePage',async ()=>{ writes++; return {id:record.notionPageId}; });
  const op = { id:id(),entity:'gyms',recordId:record.id,changes:{name:'SF Ocean updated'},base:{name:'SF Ocean'} };
  await provider.applyOperation(context,op,sync.equal);
  await provider.applyOperation(context,op,sync.equal);
  assert.equal(writes,1);
  await assert.rejects(provider.applyOperation(context,{...op,changes:{name:'Other name'}},sync.equal),error=>error.status===409);
  assert.equal(writes,1);
});
test('sync validation prevents metadata editing and arbitrary Notion IDs', () => {
  assert.throws(()=>provider.validateOperation({id:id(),entity:'exercises',recordId:id(),changes:{primaryMuscleIds:[id()]}}), /Invalid training change/);
  assert.throws(()=>provider.validateOperation({id:id(),entity:'sets',recordId:'not-a-uuid',changes:{deleted:true}}), /Invalid training change/);
  assert.throws(()=>provider.validateRecord('sets',{weight:-1}), /Invalid working set/);
});
test('Notion minute rounding preserves exact set and session timestamps, but respects deliberate date edits', () => {
  const precise = '2026-10-30T01:01:07.441Z';
  assert.equal(provider.notionTimestamp({Performed:{date:{start:'2026-10-30T01:01:00.000+00:00'}}},'Performed',precise),precise);
  assert.equal(provider.notionTimestamp({Performed:{date:{start:'2026-10-30T02:01:00.000+00:00'}}},'Performed',precise),'2026-10-30T02:01:00.000Z');
  assert.equal(provider.notionTimestamp({Finished:{date:null}},'Finished',precise),null);
});
test('a reverse-ordered Notion response still uses the earliest working set for the daily threshold', async () => {
  const {state,domain}=await fixture();
  const target=state.targets[0],sessionId=id(),oldActivity=id(),newActivity=id();
  const makeSet=(activityId,time)=>({id:id(),activityId,sessionId,exerciseId:target.exerciseIds[0],kind:'working',trainingDate:'2026-10-29',performedAt:time});
  const before=makeSet(oldActivity,'2026-10-29T18:00:01.000Z');
  const later=makeSet(newActivity,'2026-10-29T19:00:01.000Z');
  const next={...state,activities:[{id:oldActivity,targetId:target.id,requiredSets:2},{id:newActivity,targetId:target.id,requiredSets:3}],sets:[later,before]};
  const progress=domain.targetProgress(next,target,'2026-10-29');
  assert.equal(progress.requiredSets,2);assert.equal(progress.occasions,1);
});
test('Notion relation changes unlink equipment without deleting its page or past sets', async t => {
  const { sync } = await fixture();
  const exerciseId=id(),machineId=id(),exercisePage=id(),machinePage=id();
  const context = { all:{exercises:[{id:exerciseId,notionPageId:exercisePage}],machines:[{id:machineId,notionPageId:machinePage}],equipmentLinks:[{exerciseId,machineId}],sets:[{id:id(),exerciseId,machineId}]},cfg:{} };
  let change;
  t.mock.method(notion,'updatePage',async (page,properties)=>{ change={page,properties}; return {id:page}; });
  await provider.applyOperation(context,{id:id(),entity:'assignments',recordId:exerciseId,changes:{machineIds:[]},base:{machineIds:[machineId]}},sync.equal);
  assert.deepEqual(change,{page:exercisePage,properties:{'Equipment profiles':{relation:[]}}});
  assert.equal(context.all.machines.length,1); assert.equal(context.all.sets.length,1);
});

test('personal exercise notes sync without touching names, assignments, guides or past sets', async t => {
  const { sync, state } = await fixture();
  const { saveExerciseNote } = await import('../src/exerciseNotes.mjs');
  const exercise = state.exercises[0];
  const next = saveExerciseNote(state, exercise.id, 'Seat 4', '2026-11-21T22:10:35.123Z');
  const ops = sync.mutationsBetween(state, next);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].entity, 'exercises');
  assert.deepEqual(ops[0].changes, { note: 'Seat 4', noteUpdatedAt: '2026-11-21T22:10:00.000Z' });
  let written;
  const page = id(), context = { all: { exercises: [{ ...exercise, note: '', noteUpdatedAt: null, notionPageId: page }] }, cfg: {} };
  t.mock.method(notion, 'updatePage', async (pageId, properties) => { written = { pageId, properties }; return { id: pageId }; });
  await provider.applyOperation(context, ops[0], sync.equal);
  assert.deepEqual(written, { pageId: page, properties: {
    'Training note': notion.text('Seat 4'), 'Training note updated': { date: { start: '2026-11-21T22:10:00.000Z' } }
  } });
  await provider.applyOperation(context, ops[0], sync.equal);
  assert.equal(next.sets, state.sets);
  assert.throws(() => provider.validateRecord('exercises', { ...exercise, note: 'x'.repeat(5001) }), /note/);
  assert.deepEqual(ops[0].base, { note: '', noteUpdatedAt: null }, 'Older cached exercises use the same empty defaults as Notion');
});

test('Notion reads personal notes and canonicalizes the minute timestamp for subsequent edits', async t => {
  const cfg = Object.fromEntries(['exercises','gyms','muscles','machines','targets','sessions','sets','settings'].map(key => [key, { dataSourceId: id() }]));
  cfg.parentPageId = id(); cfg.settingsId = id();
  const original = process.env.FITNESS_DATABASES;
  process.env.FITNESS_DATABASES = JSON.stringify(cfg);
  t.after(() => { if (original === undefined) delete process.env.FITNESS_DATABASES; else process.env.FITNESS_DATABASES = original; });
  const exerciseId = id();
  t.mock.method(notion, 'rows', async source => source === cfg.exercises.dataSourceId ? [{ id: exerciseId, properties: {
    'Exercise Name': notion.title('Lateral raise'), 'Tracker active': { checkbox: true },
    'Training note': notion.text('Seat 4'), 'Training note updated': { date: { start: '2026-11-21T22:10:00.000+00:00' } }
  } }] : []);
  const { state } = await provider.readAll();
  assert.equal(state.exercises[0].note, 'Seat 4');
  assert.equal(state.exercises[0].noteUpdatedAt, '2026-11-21T22:10:00.000Z');
});
