const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../src/dailyStars.mjs'),import('../src/trainingCalendar.mjs')]);
test('visual stars persist through reload and reset at the same 4 a.m. boundary as progress',async()=>{
  const [stars,calendar]=await modules;
  const state={production:true,timeZone:'America/Los_Angeles'};
  const day=calendar.currentTrainingDay(state,'2026-10-30T06:59:00Z');
  let saved=stars.toggleDailyStar({},day,'target-id');
  const storage={getItem:()=>JSON.stringify(saved)};
  const reloaded=stars.readDailyStars(storage,'stars');
  assert.deepEqual(stars.starsForDay(reloaded,calendar.currentTrainingDay(state,'2026-10-30T07:23:00Z')),['target-id']);
  assert.deepEqual(stars.starsForDay(reloaded,calendar.currentTrainingDay(state,'2026-10-30T11:00:00Z')),[]);
  assert.deepEqual(stars.toggleDailyStar(reloaded,day,'target-id').ids,[]);
  saved=stars.toggleDailyStar(reloaded,'2026-10-30','second-target');
  assert.deepEqual(saved.ids,['second-target']);
  assert.deepEqual(reloaded.ids,['target-id']);
});
test('invalid star storage is safe and never creates duplicate stars',async()=>{
  const [stars]=await modules;
  assert.deepEqual(stars.readDailyStars({getItem(){throw new Error('blocked');}},'stars'),{});
  assert.deepEqual(stars.readDailyStars({getItem:()=>'{invalid'},'stars'),{});
  assert.deepEqual(stars.starsForDay({day:'2026-10-29',ids:['a','a',null,2]},'2026-10-29'),['a']);
  assert.deepEqual(stars.starsForDay(null,'2026-10-29'),[]);
});
