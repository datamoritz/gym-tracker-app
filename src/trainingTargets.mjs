// Preset keys are only used when installing the preset. User records link by UUID.
const DEFINITIONS = [
  ['chest', 'Chest press', 'Horizontal push', ['Chest'], ['Triceps', 'Front shoulders'], 'compound', ['Chest press machine', 'Cable chest press'], [[3, 3, 8, 12], [2, 2, 8, 12]]],
  ['shoulder', 'Shoulder press', 'Vertical push', ['Front shoulders'], ['Triceps'], 'compound', ['Shoulder press machine', 'Dumbbell shoulder press'], [[3, 3, 8, 12]]],
  ['lat', 'Lat pulldown', 'Vertical pull', ['Back'], ['Biceps'], 'compound', ['Lat pulldown machine', 'Cable lat pulldown'], [[3, 3, 8, 12], [3, 3, 8, 12]]],
  ['row', 'Seated bilateral row', 'Horizontal pull', ['Back'], ['Biceps', 'Rear shoulders'], 'compound', ['Seated bilateral row machine', 'Cable seated row'], [[2, 2, 10, 12], [3, 3, 8, 12]]],
  ['fly', 'Low-to-high cable fly', 'Horizontal adduction', ['Chest'], ['Front shoulders'], 'isolation', ['Low-to-high cable fly'], [[2, 2, 10, 15]]],
  ['straight', 'Straight-arm pulldown', 'Shoulder extension', ['Back'], [], 'isolation', ['Cable straight-arm pulldown'], [[2, 2, 12, 15]]],
  ['lateral', 'Lateral raises', 'Shoulder abduction', ['Side shoulders'], [], 'isolation', ['Lateral raise machine', 'Cable lateral raise', 'Dumbbell lateral raise'], [[2, 2, 12, 20], [2, 2, 12, 20]]],
  ['reverse', 'Reverse pec deck', 'Horizontal abduction', ['Rear shoulders'], ['Back'], 'isolation', ['Reverse pec deck'], [[2, 2, 12, 20], [2, 2, 12, 20]]],
  ['triceps', 'Overhead triceps extension', 'Elbow extension', ['Triceps'], [], 'isolation', ['Cable overhead triceps extension', 'Dumbbell overhead triceps extension'], [[2, 2, 10, 15], [2, 2, 10, 15]]],
  ['biceps', 'Biceps curls', 'Curl', ['Biceps'], [], 'isolation', ['Biceps curl machine', 'Cable curl', 'Dumbbell curl'], [[2, 2, 10, 15], [2, 2, 10, 15]]],
  ['wood', 'Wood chops', 'Rotation', ['Core'], [], 'isolation', ['Cable wood chops'], [[2, 2, 10, 12]], true],
  ['squat', 'Goblet squats', 'Squat', ['Quads', 'Glutes'], ['Core'], 'compound', ['Dumbbell goblet squat', 'Kettlebell goblet squat'], [[1, 2, 8, 12]], false, true],
  ['dead', 'Dead bugs', 'Anti-extension', ['Core'], [], 'isolation', ['Dead bugs'], [[2, 2, 8, 12]], true]
];

export function installTrainingTargets(state, id) {
  if (state.targetPlanVersion === 1) return state;
  const exercises = [], machines = [], targets = [];
  DEFINITIONS.forEach(([key, name, movement, primaryMuscles, supportingMuscles, type, options, doses, perSide = false, optional = false], order) => {
    const exerciseIds = options.map((label, index) => {
      const exerciseId = id();
      exercises.push({ id: exerciseId, catalogKey: `${key}:${index}`, name: label, movement, primaryMuscles, supportingMuscles, type });
      machines.push({ id: id(), exerciseId, gymId: state.selectedGymId, name: label });
      return exerciseId;
    });
    const prescriptions = doses.map(([requiredSets, maxSets, repMin, repMax]) => ({ id: id(), requiredSets, maxSets, repMin, repMax, perSide }));
    targets.push({ ...prescriptions[0], id: id(), presetKey: key, order, name, exerciseIds, prescriptions,
      optional, frequency: doses.length, windowDays: 7, spacingDays: 2, priority: 2, active: true });
  });
  // Keep old IDs and history intact; no name matching when replacing the sample plan.
  const archive = items => items.map(item => ({ ...item, archived: true, active: false }));
  return { ...state, targetPlanVersion: 1, exercises: [...archive(state.exercises), ...exercises],
    machines: [...archive(state.machines), ...machines], targets: [...archive(state.targets), ...targets] };
}

export function prescription(dose) {
  const sets = dose.recommendedSets ?? (dose.maxSets > dose.requiredSets ? `${dose.requiredSets}–${dose.maxSets}` : dose.requiredSets);
  return `${sets}×${dose.repMin ?? 8}–${dose.repMax ?? 12}${dose.perSide ? '/side' : ''}`;
}

export function weeklyPrescription(target) {
  const values = (target.prescriptions || [target]).map(prescription);
  return new Set(values).size === 1 ? values[0] : values.join(' + ');
}
