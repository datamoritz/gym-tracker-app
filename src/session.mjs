export const DRAFT_KEY = 'gym_active_session_v1';
export const PREVIOUS_GYM = 'Previous gym';
export const gymName = value => typeof value === 'string' && value.trim() ? value.trim() : PREVIOUS_GYM;
export const preferenceKey = (routine, exercise) => `${gymName(routine.gym).toLowerCase()}|${exercise.notionExerciseId || exercise.name.trim().toLowerCase()}`;
export const sessionDate = value => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function readSession(storage) {
  try {
    const draft = JSON.parse(storage.getItem(DRAFT_KEY) || 'null');
    if (!draft || draft.version !== 1 || !draft.id || !draft.routine?.exercises?.length || !draft.workoutLog) return null;
    return draft;
  } catch { return null; }
}

export function saveSession(storage, draft) {
  storage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function exerciseInput(exercise, inputs = {}, log = {}) {
  if (inputs[exercise.id]) return inputs[exercise.id];
  const previous = (log[exercise.id] || []).at(-1);
  return { weight: previous?.w ?? exercise.suggestedWeight ?? 0, reps: previous?.r ?? exercise.targetReps ?? 10, note: '' };
}

export function changeRoutineUnit(routine, index, unit) {
  return { ...routine, exercises: routine.exercises.map((exercise, position) => position === index
    ? { ...exercise, weightUnit: unit } : exercise) };
}

export function sessionSetCount(draft) {
  return Object.values(draft?.workoutLog || {}).reduce((count, sets) => count + sets.length, 0);
}
