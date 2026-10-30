const provider = require('./_lib/trainingProvider');
const { requireAccess } = require('./_lib/privateAccess');
const { assertValidWorkoutInput, assertValidWorkoutQuery } = require('./_lib/validation');

export default async function handler(req, res) {
  if (!requireAccess(req,res)) return;
  try {
    if (req.method === 'GET') {
      const query = assertValidWorkoutQuery(req.query);
      const { state } = await provider.readAll();
      const workouts = state.sets.filter(set => (!query.gym || state.gyms.find(gym => gym.id === set.gymId)?.name === query.gym) &&
        (!query.startDate || set.trainingDate >= query.startDate) && (!query.endDate || set.trainingDate <= query.endDate))
        .sort((a,b) => b.performedAt.localeCompare(a.performedAt)).slice(0,query.limit).map(set => ({
          id: set.id, setId: set.id, sessionId: set.sessionId, exerciseId: set.exerciseId, machineId: set.machineId,
          exerciseName: state.exercises.find(exercise => exercise.id === set.exerciseId)?.name || set.exerciseName,
          gym: state.gyms.find(gym => gym.id === set.gymId)?.name, date: set.trainingDate,
          weight: set.unit === 'lbs' ? set.weight * 0.45359237 : set.weight, reps: set.reps, notes: set.note, restSeconds: 0
        }));
      return res.status(200).json({ workouts });
    }

    if (req.method === 'POST') {
      const payload = assertValidWorkoutInput(req.body);
      const result = await require('./_lib/routineLogging').logRoutine(payload);
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Use GET or POST' });
  } catch (error) {
    return res.status(error?.status || 500).json({ error: String(error?.message || error) });
  }
}
