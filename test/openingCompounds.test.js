const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../src/flexible.mjs'),import('../src/equipment.mjs'),import('../src/ranking.mjs'),import('../src/trainingCalendar.mjs'),import('../src/trainingSync.mjs')]);
const DAY='2026-10-29', NOW='2026-10-29T20:00:00Z';
async function fixture() {
  const [domain,equipment,ranking,calendar,sync]=await modules;
  let state=domain.createFlexibleState('America/Los_Angeles');
  state={...state,production:true,demoHistory:[]};
  const target=(s,key)=>s.targets.find(t=>t.presetKey===key);
  const log=(s,key,count,options={})=>{
    const t=target(s,key), exerciseId=options.exerciseId||t.exerciseIds[0];
    const day=options.day||DAY,now=options.now||'2026-10-29T19:00:00Z';
    let next=domain.startFlexibleSession(s,day,now);
    for(let i=0;i<count;i++) next=domain.addFlexibleSet(next,{targetId:t.id,exerciseId,machineId:options.machineId||equipment.exerciseMachines(s,exerciseId)[0].id,weight:10,reps:10,day,now,...options});
    return next;
  };
  const rank=(s,day=DAY,now=NOW)=>domain.rankTargets(s,day,now);
  const row=(s,key,day=DAY,now=NOW)=>rank(s,day,now).find(r=>r.target.id===target(s,key).id);
  return {...domain,...equipment,...ranking,...calendar,...sync,state,target,log,rank,row};
}

test('a fresh training day starts with a due compound ahead of untouched core and accessories',async()=>{
  const {state,rank,row}=await fixture();
  const rows=rank(state);
  assert.equal(rows[0].exercise.type,'compound');
  assert.equal(row(state,'wood').openingBonus,0);
  assert.equal(row(state,'dead').openingBonus,0);
  assert.ok(row(state,'chest').openingBonus>0);
  assert.ok(row(state,'chest').reasonCodes.includes('OPENING_COMPOUND'));
});

test('second-day half-finished weekly compounds beat untouched normally prioritized core',async()=>{
  const {state,log,row,rank,finishFlexibleSession}=await fixture();
  const worked=finishFlexibleSession(log(log(state,'chest',3),'lat',3));
  const day='2026-10-31',now='2026-10-31T20:00:00Z';
  const next={...worked,targets:worked.targets.filter(t=>['chest','lat','wood','dead'].includes(t.presetKey))};
  assert.equal(row(next,'chest',day,now).progress.occasions,1);
  assert.equal(row(next,'wood',day,now).progress.occasions,0);
  assert.equal(rank(next,day,now)[0].exercise.type,'compound');
  assert.ok(row(next,'chest',day,now).score>row(next,'wood',day,now).score);
});

test('one completed compound and partial work on the second keep the full opening preference',async()=>{
  const {state,log,rank,openingCompoundProgress,target}=await fixture();
  let next=log({...state,rankingConfig:{fatiguePenaltyPerSet:0}},'chest',target(state,'chest').requiredSets);
  assert.equal(openingCompoundProgress(next,DAY,NOW).completed,1);
  next=log(next,'lat',2);
  assert.equal(openingCompoundProgress(next,DAY,NOW).completed,1);
  const dueCompounds=rank(next).filter(r=>r.exercise.type==='compound'&&r.bucket==='recommended');
  assert.ok(dueCompounds.length>0);
  assert.ok(dueCompounds.every(r=>r.openingBonus===2));
  assert.equal(rank(next)[0].exercise.type,'compound');
});

test('after two distinct qualifying compounds, the normal ranking is restored exactly',async()=>{
  const {state,log,rank,openingCompoundProgress,target}=await fixture();
  const next=log(log(state,'chest',target(state,'chest').requiredSets),'lat',3);
  assert.equal(openingCompoundProgress(next,DAY,NOW).completed,2);
  const rows=rank(next);
  assert.ok(rows.every(r=>r.openingBonus===0));
  assert.ok(rows.every(r=>!r.reasonCodes.includes('OPENING_COMPOUND')));
  assert.deepEqual(rows,rank({...next,rankingConfig:{...next.rankingConfig,openingCompoundBonus:0}}));
});

test('equivalent machines, extra sets and duplicated target mappings count as one compound',async()=>{
  const {state,log,target,exerciseMachines,newId,openingCompoundProgress}=await fixture();
  const chest=target(state,'chest'),exerciseId=chest.exerciseIds[0],machine=exerciseMachines(state,exerciseId)[0];
  const alternative={...machine,id:newId(),name:'Alternative machine'};
  const copy={...chest,id:newId(),prescriptions:chest.prescriptions.map(p=>({...p,id:newId()}))};
  let next={...state,targets:[...state.targets,copy],machines:[...state.machines,alternative],equipmentLinks:[...state.equipmentLinks,{id:newId(),exerciseId,machineId:alternative.id}]};
  next=log(next,'chest',2,{machineId:machine.id});
  next=log(next,'chest',2,{machineId:alternative.id});
  assert.equal(openingCompoundProgress(next,DAY,NOW).completed,1);
});

test('qualifying an isolation alternative never satisfies a compound opening slot',async()=>{
  const {state,log,target,openingCompoundProgress}=await fixture();
  const chest=target(state,'chest'),fly=target(state,'fly');
  let next={...state,targets:state.targets.map(t=>t.id===chest.id?{...t,exerciseIds:[...t.exerciseIds,...fly.exerciseIds]}:t)};
  next=log(next,'chest',3,{exerciseId:fly.exerciseIds[0]});
  assert.equal(openingCompoundProgress(next,DAY,NOW).completed,0);
});

test('working sets combine across sessions, while the preference resets at 4 a.m. and on removal',async()=>{
  const {state,log,target,finishFlexibleSession,openingCompoundProgress,currentTrainingDay}=await fixture();
  let next=log(state,'chest',target(state,'chest').requiredSets,{now:'2026-10-30T06:50:00Z'});
  next=finishFlexibleSession(next);
  next=log(next,'lat',3,{now:'2026-10-30T07:10:00Z'});
  assert.equal(openingCompoundProgress(next,DAY,'2026-10-30T07:23:00Z').completed,2);
  const newDay=currentTrainingDay(next,'2026-10-30T11:00:00Z');
  assert.equal(openingCompoundProgress(next,newDay,'2026-10-30T11:00:00Z').completed,0);
  assert.equal(openingCompoundProgress({...next,sets:next.sets.slice(0,-1)},DAY,'2026-10-30T07:23:00Z').completed,1);
});

test('the opening bonus never moves recovering, optional or completed work into Recommended',async()=>{
  const {state,log,row,rank,target}=await fixture();
  const previous=log(state,'chest',2,{day:'2026-10-28',now:'2026-10-29T06:50:00Z'});
  assert.equal(row(previous,'chest').bucket,'other');
  assert.equal(row(previous,'chest').openingBonus,0);
  const optional={...state,targets:state.targets.map(t=>t.id===target(state,'chest').id?{...t,optional:true}:t)};
  assert.equal(row(optional,'chest').bucket,'other');
  assert.equal(row(optional,'chest').openingBonus,0);
  const done=log(state,'chest',3);
  assert.equal(row(done,'chest').bucket,'done');
  assert.equal(row(done,'chest').openingBonus,0);
  assert.deepEqual(rank(previous).map(r=>[r.target.id,r.bucket]).sort(),rank({...previous,rankingConfig:{openingCompoundBonus:0}}).map(r=>[r.target.id,r.bucket]).sort());
});

test('a high-priority accessory can still win; opening changes neither log data nor target credit',async()=>{
  const {state,log,target,rank,row,mutationsBetween}=await fixture();
  const previous=log(state,'chest',3,{day:'2026-10-26',now:'2026-10-26T19:00:00Z'});
  const next={...previous,targets:previous.targets.filter(t=>['chest','wood'].includes(t.presetKey)).map(t=>({...t,priority:t.presetKey==='wood'?3:1}))};
  assert.equal(rank(next)[0].target.presetKey,'wood');
  const before=JSON.stringify(next);
  const without={...next,rankingConfig:{openingCompoundBonus:0}};
  for(const t of next.targets) assert.deepEqual(row(next,t.presetKey).progress,row(without,t.presetKey).progress);
  rank(next);
  assert.equal(JSON.stringify(next),before);
  assert.deepEqual(mutationsBetween(JSON.parse(before),next),[]);
});
