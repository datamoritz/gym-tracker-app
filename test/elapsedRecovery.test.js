const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../src/ranking.mjs'),import('../src/flexible.mjs')]);
const nearly = (actual,expected) => assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);

async function fixture(performedAt = '2026-10-27T01:00:00Z') {
  const [ranking,domain] = await modules;
  const exercise = { id:'press',primaryMuscleIds:['chest'],supportingMuscleIds:['triceps'] };
  const set = { id:'set-1',exerciseId:'press',kind:'working',performedAt,trainingDate:domain.trainingDay(performedAt,'America/Los_Angeles') };
  const at = (now, sets=[set], target={spacingDays:2}) => ranking.fatigueModifiers(exercise,target,sets,domain.trainingDay(now,'America/Los_Angeles'),new Map([['press',exercise]]),ranking.DEFAULT_RANKING,now);
  return { ...ranking,...domain,set,at };
}
test('each working set fades gradually over exactly 48 elapsed hours, once per physical set',async()=>{
  const {at,set}=await fixture();
  for(const [hours,load] of [[0,1],[12,.75],[24,.5],[36,.25],[48,0],[49,0]]) {
    const now=new Date(Date.parse(set.performedAt)+hours*3600000).toISOString();
    const result=at(now);
    nearly(result.fatigueLoad,load);
    nearly(result.fatigueModifier,1/(1+load*.35));
  }
  const now=set.performedAt;
  nearly(at(now,[set,{...set}]).fatigueLoad,1);
  nearly(at(now,[set,{...set,id:'set-2'}]).fatigueLoad,2);
});
test('midnight changes the explanation only; fatigue has no calendar-date jump',async()=>{
  const {at,set}=await fixture('2026-10-29T06:00:00Z'); // Wednesday 11 pm in SF.
  const before=at('2026-10-29T06:59:59Z'),after=at('2026-10-29T07:00:01Z');
  assert.ok(before.todayLoad>0);assert.equal(before.recentLoad,0);
  assert.ok(after.recentLoad>0);assert.equal(after.todayLoad,0);
  assert.ok(after.fatigueModifier>before.fatigueModifier);
  assert.ok(after.fatigueModifier-before.fatigueModifier<.00001);
  nearly(at('2026-10-29T07:00:00Z',[{...set,trainingDate:'2026-10-28'}]).fatigueModifier,at('2026-10-29T07:00:00Z',[{...set,trainingDate:'2026-10-29'}]).fatigueModifier);
});
test('48 hours remains 48 hours across daylight-saving changes',async()=>{
  for(const performedAt of ['2026-11-01T08:30:00Z','2026-03-08T09:30:00Z']) {
    const {at}=await fixture(performedAt);
    nearly(at(new Date(Date.parse(performedAt)+24*3600000).toISOString()).fatigueLoad,.5);
    nearly(at(new Date(Date.parse(performedAt)+48*3600000).toISOString()).fatigueLoad,0);
  }
});
test('future, invalid, warmup and demo records do not contribute, and a zero window disables fatigue',async()=>{
  const {at,set}=await fixture();
  const now=set.performedAt;
  const excluded=[{...set,id:'future',performedAt:'2026-10-28T01:00:00Z'},{...set,id:'invalid',performedAt:'invalid'},{...set,id:'warmup',kind:'warmup'},{...set,id:'demo',demo:true}];
  nearly(at(now,excluded).fatigueModifier,1);
  nearly(at(now,[set],{spacingDays:0}).fatigueModifier,1);
  nearly(at('2026-10-27T19:00:00Z',[set],{spacingDays:1.5}).fatigueLoad,.5);
});
test('existing recovery settings migrate without retaining a second fatigue penalty',async()=>{
  const {rankingConfig,saveRankingConfig,createFlexibleState,saveTarget}=await fixture();
  const config=rankingConfig({rankingConfig:{recoveryPenaltyPerSet:.42,recommendedRecoveryThreshold:.8,sessionPenaltyPerSet:5,recommendedSessionThreshold:1}});
  assert.equal(config.fatiguePenaltyPerSet,.42);assert.equal(config.recommendedFatigueThreshold,.8);
  assert.equal('sessionPenaltyPerSet' in config,false);
  const state=createFlexibleState();
  assert.deepEqual(saveRankingConfig(state,config).rankingConfig,config);
  const target=state.targets[0];
  const edited=saveTarget(state,{...target,spacingDays:1.5}).targets[0];
  assert.equal(edited.spacingDays,1.5);
  assert.doesNotThrow(()=>require('../api/_lib/trainingProvider').validateRecord('targets',edited));
});
