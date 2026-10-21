export const weightUnit = value => value === 'lbs' ? 'lbs' : 'kg';

export function convertWeight(value, from = 'kg', to = 'kg') {
  const amount = Number.parseFloat(value) || 0;
  if (weightUnit(from) === weightUnit(to)) return amount;
  return Math.round((from === 'lbs' ? amount * 0.45359237 : amount / 0.45359237) * 100) / 100;
}

export function moveExercise(exercises, index, direction) {
  const destination = index + direction;
  if (destination < 0 || destination >= exercises.length) return exercises;
  const next = [...exercises];
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}

export function buildFeedbackWorkout(routine, workoutLog, date) {
  return {
    workout_type: routine.name,
    date,
    // Follow the routine order, including when exercise IDs happen to be integers.
    exercises: routine.exercises.flatMap(exercise => {
      const sets = workoutLog[exercise.id] || [];
      if (!sets.length) return [];
      const unit = weightUnit(exercise.weightUnit);
      return [{
        name: exercise.name,
        sets: sets.length,
        reps: sets.map(set => Number.parseInt(set.r, 10)),
        weight: sets.map(set => convertWeight(set.w, set.weightUnit || unit, unit)),
        weight_unit: unit,
        rest_sec: Number.parseInt(exercise.defaultPause, 10) || 60,
        ...(sets.some(set => set.note) ? {
          notes: sets.map((set, index) => set.note ? `Set ${index + 1}: ${set.note}` : '').filter(Boolean).join('; ')
        } : {})
      }];
    })
  };
}
