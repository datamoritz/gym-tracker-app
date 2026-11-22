// Personal notes belong to the exercise, not to a set or equipment profile.
export function exerciseNote(state, exerciseId) {
  const exercise = state.exercises.find(item => item.id === exerciseId);
  if (exercise?.noteUpdatedAt || exercise?.note) return { text: exercise.note || '', updatedAt: exercise.noteUpdatedAt || null };
  // Keep existing set notes useful without rewriting historical workout logs.
  const previous = state.sets.filter(set => set.exerciseId === exerciseId && !set.demo && !set.deleted && set.note?.trim())
    .sort((a, b) => Date.parse(b.performedAt) - Date.parse(a.performedAt))[0];
  return { text: previous?.note || '', updatedAt: previous?.performedAt || null };
}

export function saveExerciseNote(state, exerciseId, text, now = new Date().toISOString()) {
  if (typeof text !== 'string' || text.length > 5000) throw new Error('Keep exercise notes within 5,000 characters.');
  if (!state.exercises.some(item => item.id === exerciseId)) throw new Error('The exercise is missing.');
  const note = text.trim();
  if (exerciseNote(state, exerciseId).text === note) return state;
  // Notion date columns have minute precision; use the same canonical value in
  // the local outbox so a second edit does not conflict with its own first save.
  const noteUpdatedAt = new Date(Math.floor(Date.parse(now) / 60000) * 60000).toISOString();
  return { ...state, exercises: state.exercises.map(item => item.id === exerciseId ? { ...item, note, noteUpdatedAt } : item) };
}
