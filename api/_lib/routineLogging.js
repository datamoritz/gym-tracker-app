const provider = require('./trainingProvider');
const n = require('./fitnessNotion');
async function logRoutine({ routine, workoutLog, sessionId, date }) {
  if (!n.uuid(sessionId)) throw Object.assign(new Error('Resume a session with a valid ID.'), { status: 400 });
  const [{ context, state }, domain, sync] = await Promise.all([provider.readAll(), import('../../src/flexible.mjs'), import('../../src/trainingSync.mjs')]);
  const gym = state.gyms.find(item => item.id === state.selectedGymId);
  if (routine.gym !== gym.name) throw Object.assign(new Error(`Use ${gym.name} and choose the equipment for this session.`), { status: 400 });
  const time = new Date().toISOString();
  const existingSession = state.sessions.find(item => item.id === sessionId);
  const session = existingSession || { id: sessionId, gymId: gym.id, startedAt: time, trainingDate: date, endedAt: null };
  let next = { ...state, sessions: [{ ...session, endedAt: null }] };
  for (const [routineExerciseId, sets] of Object.entries(workoutLog)) {
    const exercise = routine.exercises.find(item => String(item.id) === routineExerciseId);
    if (!exercise) continue;
    const canonical = state.exercises.find(item => item.id === exercise.notionExerciseId || item.notionPageId === exercise.notionExerciseId);
    if (!canonical) throw Object.assign(new Error(`Link ${exercise.name} to an exercise before saving.`), { status: 400 });
    for (const set of sets) {
      if (!n.uuid(set.id) || !n.uuid(set.machineId)) throw Object.assign(new Error(`Choose equipment for ${exercise.name} before logging.`), { status: 400 });
      if (state.sets.some(item => item.id === set.id)) continue;
      const day = set.trainingDate || date, now = set.performedAt || time;
      const target = state.targets.find(item => item.active && item.exerciseIds.includes(canonical.id));
      if (target) {
        next = domain.addFlexibleSet(next, { targetId: target.id, exerciseId: canonical.id, machineId: set.machineId, weight: set.w, reps: set.r,
          unit: set.weightUnit || exercise.weightUnit, note: set.note, day, now });
        next = { ...next, sets: next.sets.map((item,index) => index === next.sets.length - 1 ? { ...item, id: set.id, source: 'routine' } : item) };
      } else {
        if (!state.equipmentLinks.some(link => link.exerciseId === canonical.id && link.machineId === set.machineId)) throw Object.assign(new Error('This equipment is not linked to the exercise.'), { status: 400 });
        next = { ...next, sets: [...next.sets, { id: set.id, sessionId, exerciseId: canonical.id, machineId: set.machineId, gymId: gym.id,
          exerciseName: canonical.name, machineName: state.machines.find(item => item.id === set.machineId)?.name || '', weight: set.w, reps: set.r,
          unit: set.weightUnit || exercise.weightUnit, note: set.note, kind: 'working', perSide: false, trainingDate: day, performedAt: now, source: 'routine' }] };
      }
    }
  }
  next.sessions = [...state.sessions.filter(item => item.id !== sessionId), { ...session, endedAt: time }];
  const operations = sync.mutationsBetween(state,next);
  for (const op of operations) await provider.applyOperation(context,op,sync.equal);
  return { ok: true };
}
module.exports = { logRoutine };
