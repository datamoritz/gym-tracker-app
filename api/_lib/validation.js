function parseNumber(value, fallback = 0) {
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInteger(value, fallback = 0) {
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRoutine(routine) {
  return {
    id: routine?.id ?? Date.now(),
    name: typeof routine?.name === 'string' && routine.name.trim() ? routine.name.trim() : 'New Session',
    notionPageId: typeof routine?.notionPageId === 'string' && routine.notionPageId.trim() ? routine.notionPageId.trim() : null,
    exercises: Array.isArray(routine?.exercises)
      ? routine.exercises.map(exercise => ({
          id: exercise?.id ?? Math.random(),
          name: typeof exercise?.name === 'string' && exercise.name.trim() ? exercise.name.trim() : 'Untitled Exercise',
          defaultPause: parseInteger(exercise?.defaultPause, 90),
          targetSets: parseInteger(exercise?.targetSets, 3),
          suggestedWeight: parseNumber(exercise?.suggestedWeight, 0),
          targetReps: parseInteger(exercise?.targetReps, 10)
        }))
      : []
  };
}

function normalizeWorkoutLog(workoutLog) {
  return Object.fromEntries(
    Object.entries(workoutLog || {}).map(([exerciseId, sets]) => [
      exerciseId,
      Array.isArray(sets)
        ? sets.map(set => ({
            w: parseNumber(set?.w, 0),
            r: parseInteger(set?.r, 0),
            note: typeof set?.note === 'string' ? set.note.trim() : ''
          }))
        : []
    ])
  );
}

function assertValidRoutineInput(routine) {
  if (!routine || typeof routine !== 'object') {
    const error = new Error('Missing routine data');
    error.status = 400;
    throw error;
  }

  const normalized = normalizeRoutine(routine);
  if (!normalized.name) {
    const error = new Error('Routine name is required');
    error.status = 400;
    throw error;
  }

  return normalized;
}

function assertValidWorkoutInput(payload) {
  if (!payload || typeof payload !== 'object') {
    const error = new Error('Missing workout data');
    error.status = 400;
    throw error;
  }

  const date = typeof payload.date === 'string' && payload.date.trim() ? payload.date.trim() : null;
  if (!date) {
    const error = new Error('Workout date is required');
    error.status = 400;
    throw error;
  }

  return {
    date,
    routine: assertValidRoutineInput(payload.routine),
    workoutLog: normalizeWorkoutLog(payload.workoutLog)
  };
}

function normalizeWorkoutQuery(query) {
  const rawLimit = Array.isArray(query?.limit) ? query.limit[0] : query?.limit;
  const limit = Math.min(Math.max(parseInteger(rawLimit, 50), 1), 200);

  const rawStartDate = Array.isArray(query?.startDate) ? query.startDate[0] : query?.startDate;
  const rawEndDate = Array.isArray(query?.endDate) ? query.endDate[0] : query?.endDate;

  const startDate = typeof rawStartDate === 'string' && rawStartDate.trim() ? rawStartDate.trim() : null;
  const endDate = typeof rawEndDate === 'string' && rawEndDate.trim() ? rawEndDate.trim() : null;

  return { limit, startDate, endDate };
}

function assertValidWorkoutQuery(query) {
  const normalized = normalizeWorkoutQuery(query);
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (normalized.startDate && !datePattern.test(normalized.startDate)) {
    const error = new Error('startDate must use YYYY-MM-DD');
    error.status = 400;
    throw error;
  }

  if (normalized.endDate && !datePattern.test(normalized.endDate)) {
    const error = new Error('endDate must use YYYY-MM-DD');
    error.status = 400;
    throw error;
  }

  return normalized;
}

module.exports = {
  parseNumber,
  parseInteger,
  normalizeRoutine,
  normalizeWorkoutLog,
  normalizeWorkoutQuery,
  assertValidRoutineInput,
  assertValidWorkoutInput,
  assertValidWorkoutQuery
};
