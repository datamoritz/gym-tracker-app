// Local counterpart of the future shared Notion Muscles database.
export function migrateMuscles(state, id) {
  if (state.musclesVersion === 1 && state.exercises.every(exercise => Array.isArray(exercise.primaryMuscleIds) && Array.isArray(exercise.supportingMuscleIds))) return state;
  const muscles = [...(state.muscles || [])];
  const relationIds = labels => [...new Set((labels || []).map(name => {
    // Labels bootstrap legacy sample data once; all subsequent relations use IDs.
    let muscle = muscles.find(item => item.name === name);
    if (!muscle) { muscle = { id: id(), name }; muscles.push(muscle); }
    return muscle.id;
  }))];
  const exercises = state.exercises.map(exercise => {
    const { primaryMuscles, supportingMuscles, ...rest } = exercise;
    return { ...rest, primaryMuscleIds: exercise.primaryMuscleIds || relationIds(primaryMuscles),
      supportingMuscleIds: exercise.supportingMuscleIds || relationIds(supportingMuscles) };
  });
  return { ...state, musclesVersion: 1, muscles, exercises };
}

export const primaryMuscleIds = exercise => exercise?.primaryMuscleIds || [];
export const allMuscleIds = exercise => [...primaryMuscleIds(exercise), ...(exercise?.supportingMuscleIds || [])];
