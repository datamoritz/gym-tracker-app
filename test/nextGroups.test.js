const test=require('node:test');
const assert=require('node:assert/strict');
test('Done Today and rolling Done are independent, including their overlap',async()=>{
  const {nextCompletionGroups}=await import('../src/nextGroups.mjs');
  const todayOnly={target:{id:'today'},finished_today:true,rolling_target_met:false};
  const weeklyOnly={target:{id:'week'},finished_today:false,rolling_target_met:true};
  const both={target:{id:'both'},finished_today:true,rolling_target_met:true};
  const partial={target:{id:'partial'},finished_today:false,rolling_target_met:false};
  const rows=[todayOnly,weeklyOnly,both,partial],before=JSON.stringify(rows);
  const result=nextCompletionGroups(rows);
  assert.deepEqual(result.doneToday,[todayOnly,both]);
  assert.deepEqual(result.doneWeekly,[weeklyOnly,both]);
  assert.equal(JSON.stringify(rows),before);
});
test('a finished first weekly occasion appears Today, then only weekly-met targets remain Done after the daily reset',async()=>{
  const domain=await import('../src/flexible.mjs');
  const {exerciseMachines}=await import('../src/equipment.mjs');
  const {nextCompletionGroups}=await import('../src/nextGroups.mjs');
  let state=domain.createFlexibleState('America/Los_Angeles');
  const target=state.targets.find(t=>t.presetKey==='chest'),exerciseId=target.exerciseIds[0],machineId=exerciseMachines(state,exerciseId)[0].id;
  state=domain.startFlexibleSession(state,'2026-11-07','2026-11-07T20:00:00Z');
  for(let i=0;i<3;i++) state=domain.addFlexibleSet(state,{targetId:target.id,exerciseId,machineId,weight:20,reps:10,day:'2026-11-07',now:'2026-11-07T20:00:00Z'});
  const today=nextCompletionGroups(domain.rankTargets(state,'2026-11-07','2026-11-07T21:00:00Z'));
  assert.ok(today.doneToday.some(row=>row.target.id===target.id));
  assert.ok(!today.doneWeekly.some(row=>row.target.id===target.id));
  const next=nextCompletionGroups(domain.rankTargets(state,'2026-11-08','2026-11-08T20:00:00Z'));
  assert.ok(!next.doneToday.some(row=>row.target.id===target.id));
});
