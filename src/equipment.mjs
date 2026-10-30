import { convertWeight } from './workout.mjs';
export const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) || a.id.localeCompare(b.id);

export const machineExerciseIds = (state, machineId) => (state.equipmentLinks || [])
  .filter(link => link.machineId === machineId && !link.archived).map(link => link.exerciseId);
export const exerciseMachines = (state, exerciseId, gymId = state.selectedGymId) => state.machines
  .filter(machine => !machine.archived && (!state.testingScope || state.testingScope.machineIds.includes(machine.id)) && machine.gymId === gymId && machineExerciseIds(state, machine.id).includes(exerciseId)).sort(byName);

export function exerciseHistoryMachines(state, exerciseId, gymId = state.selectedGymId) {
  const ids = new Set(exerciseMachines(state, exerciseId, gymId).map(machine => machine.id));
  for (const set of [...state.sets, ...(state.demoHistory || [])]) {
    if (set.exerciseId === exerciseId) ids.add(set.machineId);
  }
  return state.machines.filter(machine => ids.has(machine.id) && machine.gymId === gymId && !machine.archived &&
    (!state.testingScope || state.testingScope.machineIds.includes(machine.id))).sort(byName);
}

export function migrateEquipment(state, id) {
  if (state.equipmentVersion === 1) return state;
  return { ...state, equipmentVersion: 1, demoHistory: state.demoHistory || [],
    machines: state.machines.map(machine => ({ ...machine, stations: machine.stations || [{ id: id(), name: 'Station 1' }] })),
    equipmentLinks: state.machines.filter(machine => machine.exerciseId).map(machine => ({ id: id(), machineId: machine.id, exerciseId: machine.exerciseId, archived: Boolean(machine.archived) })) };
}

export function setMachineExercises(state, machineId, exerciseIds, id) {
  if (!state.machines.some(machine => machine.id === machineId && !machine.archived)) throw new Error('Choose a valid equipment profile.');
  const requested = [...new Set(exerciseIds)];
  if (requested.some(exerciseId => !state.exercises.some(exercise => exercise.id === exerciseId && !exercise.archived))) throw new Error('Choose valid exercises.');
  const hidden = state.testingScope ? machineExerciseIds(state, machineId).filter(exerciseId => !state.testingScope.exerciseIds.includes(exerciseId)) : [];
  const wanted = [...new Set([...requested, ...hidden])];
  // Archived assignments leave equipment and historical set IDs untouched.
  const links = (state.equipmentLinks || []).map(link => link.machineId === machineId ? { ...link, archived: !wanted.includes(link.exerciseId) } : link);
  for (const exerciseId of wanted) {
    if (!links.some(link => link.machineId === machineId && link.exerciseId === exerciseId)) links.push({ id: id(), machineId, exerciseId, archived: false });
  }
  return { ...state, equipmentLinks: links };
}

export function setExerciseMachines(state, exerciseId, machineIds, id) {
  if (!state.exercises.some(exercise => exercise.id === exerciseId && !exercise.archived) || machineIds.some(machineId => !state.machines.some(machine => machine.id === machineId && !machine.archived))) throw new Error('Choose valid exercise and equipment links.');
  let next = state;
  for (const machine of state.machines.filter(item => !item.archived && (!state.testingScope || state.testingScope.machineIds.includes(item.id)))) {
    const current = machineExerciseIds(next, machine.id);
    const wanted = machineIds.includes(machine.id) ? [...new Set([...current, exerciseId])] : current.filter(value => value !== exerciseId);
    if (wanted.length !== current.length) next = setMachineExercises(next, machine.id, wanted, id);
  }
  return next;
}

export function installLateralExample(input, id, now = new Date()) {
  let state = migrateEquipment(input, id);
  if (state.lateralExampleVersion === 1) return state;
  // Stable preset metadata locates the exercise; labels are never matching keys.
  const cable = state.exercises.find(exercise => exercise.catalogKey === 'lateral:1' && !exercise.archived);
  if (!cable) return { ...state, lateralExampleVersion: 1 };
  const cableKeys = new Set(['chest:1', 'lat:1', 'row:1', 'fly:0', 'straight:0', 'lateral:1', 'triceps:0', 'biceps:1', 'wood:0']);
  const cableIds = state.exercises.filter(exercise => !exercise.archived && cableKeys.has(exercise.catalogKey)).map(exercise => exercise.id);
  const original = exerciseMachines(state, cable.id)[0];
  const standard = { ...(original || {}), id: original?.id || id(), name: 'Standard cable towers', gymId: state.selectedGymId,
    stations: Array.from({ length: 4 }, (_, index) => original?.stations?.[index] || { id: id(), name: `Tower ${index + 1}` }) };
  const older = [1, 2].map(number => ({ id: id(), name: `Older cable tower ${number}`, gymId: state.selectedGymId, stations: [{ id: id(), name: 'Station 1' }] }));
  // Unused single-exercise cable samples are replaced by the shared profiles.
  // Used profiles retain their IDs and histories rather than being merged.
  state = { ...state, machines: [...state.machines.map(machine => {
    if (machine.id === standard.id) return standard;
    const onlyCable = machineExerciseIds(state, machine.id).some(exerciseId => cableIds.includes(exerciseId));
    return onlyCable && machine.gymId === state.selectedGymId && !state.sets.some(set => set.machineId === machine.id) ? { ...machine, archived: true } : machine;
  }), ...(!original ? [standard] : []), ...older] };
  for (const machine of [standard, ...older]) state = setMachineExercises(state, machine.id, cableIds, id);
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: state.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const dateAt = daysAgo => new Date(Date.parse(`${parts}T12:00:00Z`) - daysAgo * 86400000).toISOString().slice(0, 10);
  const demoHistory = [...(state.demoHistory || [])];
  const loads = [[2.5, 3.75, 5, 6.25, 7.5], [8, 9, 10, 11, 12], [4, 4.5, 5, 5.5, 6]];
  [standard, ...older].forEach((machine, profileIndex) => {
    loads[profileIndex].forEach((weight, index) => {
      const day = dateAt(30 - index * 6), sessionId = id();
      for (let setIndex = 0; setIndex < 2; setIndex++) demoHistory.push({ id: id(), sessionId, exerciseId: cable.id, machineId: machine.id,
        gymId: machine.gymId, machineName: machine.name, exerciseName: cable.name, trainingDate: day,
        performedAt: `${day}T12:${String(setIndex).padStart(2, '0')}:00Z`, weight, reps: 16 - setIndex + index % 2, unit: 'kg', kind: 'working', demo: true });
    });
  });
  return { ...state, demoHistory, lateralExampleVersion: 1 };
}

export function equipmentHistory(state, { exerciseId, machineId, day = '9999-12-31', unit = 'kg' }) {
  return [...state.sets, ...(state.demoHistory || [])]
    .filter(set => set.exerciseId === exerciseId && set.machineId === machineId && set.kind === 'working' && set.trainingDate <= day)
    .sort((a, b) => a.trainingDate.localeCompare(b.trainingDate) || a.performedAt.localeCompare(b.performedAt))
    .map(set => ({ ...set, weight: convertWeight(set.weight, set.unit, unit), unit }));
}

export function lastEquipmentSet(state, selection) {
  const history = equipmentHistory(state, selection);
  const last = history.filter(set => !set.demo).at(-1) || history.at(-1) || null;
  return last && !selection.unit ? [...state.sets, ...(state.demoHistory || [])].find(set => set.id === last.id) : last;
}
