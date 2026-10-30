const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../src/trainingCalendar.mjs'),import('../src/flexible.mjs'),import('../src/equipment.mjs'),import('../src/workoutJournal.mjs'),import('../src/trainingSync.mjs')]);

test('4 a.m. Los Angeles boundary keeps late training together and resets exactly at the cutoff',async()=>{
  const [calendar]=await modules;
  const state={production:true,timeZone:'America/Los_Angeles'};
  for(const at of ['2026-10-30T06:39:00Z','2026-10-30T07:23:00Z','2026-10-30T10:59:59Z']) assert.equal(calendar.currentTrainingDay(state,at),'2026-10-29');
  assert.equal(calendar.currentTrainingDay(state,'2026-10-30T11:00:00Z'),'2026-10-30');
  assert.equal(calendar.trainingDay('2026-10-30T07:23:00Z',state.timeZone),'2026-10-30');
});

test('the reset follows civil time across both DST changes, not a 24-hour subtraction',async()=>{
  const [{currentTrainingDay}]=await modules;
  const state={production:true,timeZone:'America/Los_Angeles'};
  for(const at of ['2026-11-01T08:30:00Z','2026-11-01T09:30:00Z','2026-11-01T11:59:59Z']) assert.equal(currentTrainingDay(state,at),'2026-10-31');
  assert.equal(currentTrainingDay(state,'2026-11-01T12:00:00Z'),'2026-11-01');
  assert.equal(currentTrainingDay(state,'2026-03-08T10:59:59Z'),'2026-03-07');
  assert.equal(currentTrainingDay(state,'2026-03-08T11:00:00Z'),'2026-03-08');
});

test('a seven-target workout crossing midnight stays Done and shows 7 completed without rewriting logs',async()=>{
  const [calendar,domain,equipment,journal,sync]=await modules;
  let state=domain.createFlexibleState('America/Los_Angeles');
  state={...state,production:true,targets:state.targets.slice(0,7),sets:[],activities:[],sessions:[],demoHistory:[]};
  state.targets.forEach((target,i)=>{
    const exerciseId=target.exerciseIds[0],machineId=equipment.exerciseMachines(state,exerciseId)[0].id;
    const count=i===0?4:i===1?3:2;
    const minute=(i<3?35+i*5:2+(i-3)*5);
    const hour=i<3?'06':'07';
    const date=i<3?'2026-10-29':'2026-10-30';
    const activity={id:`activity${i}`,targetId:target.id,sessionId:'session',trainingDate:date,requiredSets:2,prescriptionId:target.prescriptions[0].id};
    state.activities.push(activity);
    for(let j=0;j<count;j++) state.sets.push({id:`set${i}-${j}`,activityId:activity.id,sessionId:'session',exerciseId,machineId,kind:'working',weight:10,reps:10,unit:'kg',trainingDate:date,performedAt:`2026-10-30T${hour}:${String(minute+j).padStart(2,'0')}:00Z`});
  });
  const before=JSON.stringify(state),now='2026-10-30T07:23:00Z',day=calendar.currentTrainingDay(state,now);
  const completed=state.targets.filter(target=>domain.targetProgress(state,target,day,now).completedToday);
  assert.equal(completed.length,7);
  assert.equal(domain.rankTargets(state,day,now).filter(row=>row.bucket==='done').length,7);
  assert.deepEqual(journal.journalDays(journal.journalSets(state)).map(item=>[item.day,item.sets.length]),[['2026-10-29',17]]);
  assert.equal(state.targets.filter(target=>domain.targetProgress(state,target,'2026-10-30','2026-10-30T11:00:00Z').completedToday).length,0);
  assert.equal(JSON.stringify(state),before);
  assert.deepEqual(sync.mutationsBetween(JSON.parse(before),state),[]);
});

test('partial sets across midnight combine once, but work after 4 a.m. starts a new occasion',async()=>{
  const [calendar,domain,equipment]=await modules;
  let state=domain.createFlexibleState('America/Los_Angeles');
  const target=state.targets.find(item=>item.presetKey==='lateral'),exerciseId=target.exerciseIds[0],machineId=equipment.exerciseMachines(state,exerciseId)[0].id;
  state={...state,production:true,demoHistory:[]};
  for(const now of ['2026-10-30T06:59:00Z','2026-10-30T07:01:00Z']){
    const day=calendar.currentTrainingDay(state,now);
    state=domain.addFlexibleSet(domain.startFlexibleSession(state,day,now),{targetId:target.id,exerciseId,machineId,weight:5,reps:12,day,now});
  }
  assert.equal(domain.targetProgress(state,target,'2026-10-29','2026-10-30T07:02:00Z').occasions,1);
  const now='2026-10-30T11:01:00Z',day=calendar.currentTrainingDay(state,now);
  state=domain.addFlexibleSet(state,{targetId:target.id,exerciseId,machineId,weight:5,reps:12,day,now});
  const progress=domain.targetProgress(state,target,day,now);
  assert.equal(progress.todaySets,1);
  assert.equal(progress.completedToday,false);
  assert.equal(progress.occasions,1);
});
