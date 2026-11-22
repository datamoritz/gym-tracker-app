const test = require('node:test');
const assert = require('node:assert/strict');
const modulePromise = import('../src/restTimer.mjs');
const NOW = 1800000000000;
function storage() { const map=new Map(); return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}; }

test('a running timer retains its absolute deadline across view changes and reloads',async()=>{
  const {newRestTimer,readRestTimer,restRemaining}=await modulePromise;
  const cache=storage(),timer=newRestTimer(NOW+90000);
  cache.setItem('rest',JSON.stringify(timer));
  const restored=readRestTimer(cache,'rest',NOW+1000,NOW+25000);
  assert.deepEqual(restored,timer);
  assert.equal(restRemaining(restored,NOW+25000),65);
  assert.equal(restRemaining(restored,NOW+89999),1);
  assert.equal(restRemaining(restored,NOW+90000),0);
});
test('stale session refreshes cannot resurrect a skipped or dismissed local timer',async()=>{
  const {newRestTimer,readRestTimer,restNeedsAlarm}=await modulePromise;
  const cache=storage();cache.setItem('rest',JSON.stringify(newRestTimer(0)));
  const restored=readRestTimer(cache,'rest',NOW+90000,NOW);
  assert.equal(restored.deadline,0);
  assert.equal(restNeedsAlarm(restored,NOW+90000),false);
});
test('an expiry is due once, remains visible at zero, and does not repeat after a reload',async()=>{
  const {newRestTimer,restNeedsAlarm,readRestTimer,restRemaining}=await modulePromise;
  const timer=newRestTimer(NOW+3000),cache=storage();
  assert.equal(restNeedsAlarm(timer,NOW+2999),false);
  assert.equal(restNeedsAlarm(timer,NOW+3000),true);
  cache.setItem('rest',JSON.stringify({...timer,alerted:true}));
  const restored=readRestTimer(cache,'rest',0,NOW+4000);
  assert.equal(restRemaining(restored,NOW+4000),0);
  assert.equal(restored.deadline,timer.deadline);
  assert.equal(restNeedsAlarm(restored,NOW+4000),false);
});
test('expired ancient sessions stay quiet and missing/corrupt storage safely adopts only a running legacy timer',async()=>{
  const {readRestTimer,MAX_ALERT_DELAY,restNeedsAlarm,newRestTimer}=await modulePromise;
  const cache=storage();
  assert.equal(readRestTimer(cache,'rest',NOW+90000,NOW).deadline,NOW+90000);
  assert.equal(readRestTimer(cache,'rest',NOW-1,NOW).deadline,0);
  cache.setItem('rest','{broken');
  assert.equal(readRestTimer(cache,'rest',NOW+90000,NOW).deadline,NOW+90000);
  cache.setItem('rest',JSON.stringify(newRestTimer(NOW-MAX_ALERT_DELAY-1)));
  assert.equal(readRestTimer(cache,'rest',0,NOW).deadline,0);
  assert.equal(restNeedsAlarm(newRestTimer(NOW-MAX_ALERT_DELAY-1),NOW),false);
  assert.equal(readRestTimer({getItem(){throw new Error('blocked');}},'rest',NOW+1000,NOW).deadline,NOW+1000);
});

function audioFixture() {
  const oscillators=[],contexts=[];
  class AudioContext {
    constructor(){this.state='suspended';this.currentTime=10;this.destination={};contexts.push(this);}
    async resume(){this.state='running';}
    async close(){this.state='closed';}
    createOscillator(){const node={frequency:{},connect(){},disconnect(){node.disconnected=true;},start(at){node.at=at;},stop(at){node.stopAt=at;}};oscillators.push(node);return node;}
    createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
  }
  return {AudioContext,oscillators,contexts};
}
test('the restored alarm unlocks audio on interaction and plays three bounded tones on the system output',async()=>{
  const {createRestAlarm}=await modulePromise;
  const {AudioContext,oscillators,contexts}=audioFixture();
  const alarm=createRestAlarm(()=>AudioContext);
  assert.equal(await alarm.play(),false);
  assert.equal(contexts.length,0);
  assert.equal(await alarm.unlock(),true);
  assert.equal(await alarm.play(),true);
  assert.equal(oscillators.length,3);
  assert.deepEqual(oscillators.map(n=>n.frequency.value),[880,880,1046.5]);
  assert.ok(oscillators.every(n=>n.stopAt>n.at&&n.stopAt-n.at<0.31));
  alarm.cancel();
  assert.ok(oscillators.every(n=>n.disconnected));
  alarm.dispose();
});
test('skipping/replacing a timer cancels an alarm waiting for audio to resume',async()=>{
  const {createRestAlarm}=await modulePromise;
  const {AudioContext,oscillators,contexts}=audioFixture();
  const alarm=createRestAlarm(()=>AudioContext);
  await alarm.unlock();
  contexts[0].state='suspended';let release;
  contexts[0].resume=()=>new Promise(resolve=>{release=()=>{contexts[0].state='running';resolve();};});
  const ringing=alarm.play();alarm.cancel();release();
  assert.equal(await ringing,false);
  assert.equal(oscillators.length,0);
  alarm.dispose();
});
test('unsupported or blocked audio returns a retryable failure without breaking the timer',async()=>{
  const {createRestAlarm}=await modulePromise;
  const unsupported=createRestAlarm(()=>undefined);
  assert.equal(await unsupported.unlock(),false);
  assert.equal(await unsupported.play(),false);
  const blocked=createRestAlarm(()=>class {constructor(){this.state='suspended';}resume(){return Promise.reject(new Error('blocked'));}close(){return Promise.resolve();}});
  assert.equal(await blocked.unlock(),false);
  assert.equal(await blocked.play(),false);
  blocked.dispose();
});

function mediaFixture() {
  const calls = [], session = { type: 'auto' };
  const audio = { currentTime: 0, play() { calls.push('play'); return Promise.resolve(); }, pause() { calls.push('pause'); } };
  return { audio, calls, session, options: { createAudio: () => audio, audioSession: () => session } };
}
test('timer sound primes one reusable media element on the gesture and uses a transient headphone-friendly session', async () => {
  const { createRestAlarm } = await modulePromise;
  const { audio, calls, session, options } = mediaFixture();
  const alarm = createRestAlarm(() => undefined, options);
  const priming = alarm.unlock();
  assert.deepEqual(calls, ['play'], 'play must run synchronously before awaiting');
  assert.equal(await priming, true);
  assert.deepEqual(calls, ['play', 'pause']);
  assert.equal(session.type, 'transient');
  assert.equal(audio.currentTime, 0);
  assert.equal(await alarm.unlock(), true);
  assert.equal(calls.length, 2, 'ordinary taps must not restart audio');
  assert.equal(await alarm.play(), true);
  assert.equal(calls.at(-1), 'play');
  alarm.cancel();
  assert.equal(calls.at(-1), 'pause');
});
test('Settings plays directly on its original click without an asynchronous unlock step', async () => {
  const { createRestAlarm } = await modulePromise;
  const { calls, options } = mediaFixture();
  const alarm = createRestAlarm(() => undefined, options);
  const playing = alarm.play({ gesture: true });
  assert.deepEqual(calls, ['play']);
  assert.equal(await playing, true);
  alarm.dispose();
});
test('a slow pointer-down unlock cannot pause the Settings test requested by the following click', async () => {
  const { createRestAlarm } = await modulePromise;
  const { audio, calls, options } = mediaFixture();
  let release;
  audio.play = () => { calls.push('play'); return new Promise(resolve => { release = resolve; }); };
  const alarm = createRestAlarm(() => undefined, options);
  const priming = alarm.unlock(), releasePrime = release;
  const testSound = alarm.play({ gesture: true }), releaseSound = release;
  releasePrime(); releaseSound();
  assert.equal(await priming, false);
  assert.equal(await testSound, true);
  assert.deepEqual(calls, ['play', 'play'], 'The stale unlock must not pause/reset the test sound');
  alarm.dispose();
});
test('blocked media falls back to tones and late priming cannot restart a cancelled timer', async () => {
  const { createRestAlarm } = await modulePromise;
  const fixture = audioFixture(), media = mediaFixture();
  media.audio.play = () => Promise.reject(new Error('blocked'));
  const fallback = createRestAlarm(() => fixture.AudioContext, media.options);
  assert.equal(await fallback.unlock(), true);
  assert.equal(await fallback.play(), true);
  assert.equal(fixture.oscillators.length, 3);
  fallback.dispose();
  let release;
  const pending = mediaFixture();
  pending.audio.play = () => new Promise(resolve => { release = resolve; });
  const cancelled = createRestAlarm(() => undefined, pending.options);
  const priming = cancelled.unlock(); cancelled.cancel(); release();
  assert.equal(await priming, false);
  assert.equal(await cancelled.play(), false);
});
