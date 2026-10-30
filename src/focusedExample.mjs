import { exerciseMachines, machineExerciseIds } from './equipment.mjs';
import { migrateMuscles } from './muscles.mjs';

export function scopeItems(state, collection) {
  const key = { targets: 'targetIds', exercises: 'exerciseIds', machines: 'machineIds' }[collection];
  const ids = state.testingScope?.[key];
  return state[collection].filter(item => !item.archived && (!ids || ids.includes(item.id)));
}

export function installFocusedExample(state, id, now = new Date()) {
  if (state.focusedExampleVersion === 2) return state;
  if (state.focusedExampleVersion === 1) return addFlyExample(state, id, now);
  const lateral = state.exercises.find(exercise => exercise.catalogKey === 'lateral:1' && !exercise.archived);
  const chest = state.exercises.find(exercise => exercise.catalogKey === 'chest:0' && !exercise.archived);
  const lateralTarget = state.targets.find(target => target.presetKey === 'lateral' && !target.archived);
  const chestTarget = state.targets.find(target => target.presetKey === 'chest' && !target.archived);
  if (!lateral || !chest || !lateralTarget || !chestTarget) throw new Error('The two-exercise example could not be loaded. Export your data before changing the library.');
  const cableProfiles = exerciseMachines(state, lateral.id);
  const firstChest = exerciseMachines(state, chest.id)[0];
  if (cableProfiles.length !== 3 || !firstChest) throw new Error('The equipment example needs three cable profiles and a chest-press profile.');
  const secondChest = { id: id(), name: 'Chest press machine 2', gymId: firstChest.gymId, stations: [{ id: id(), name: 'Station 1' }] };
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: state.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const demoHistory = [...(state.demoHistory || [])];
  [firstChest, secondChest].forEach((machine, profileIndex) => {
    [0, 1, 2, 3, 4].forEach(index => {
      const day = new Date(Date.parse(`${parts}T12:00:00Z`) - (29 - index * 6) * 86400000).toISOString().slice(0, 10);
      const sessionId = id();
      for (let setIndex = 0; setIndex < 2; setIndex++) demoHistory.push({ id: id(), sessionId, machineId: machine.id, exerciseId: chest.id,
        machineName: profileIndex ? secondChest.name : 'Chest press machine 1', exerciseName: 'Chest press', gymId: machine.gymId,
        weight: (profileIndex ? 40 : 25) + index * 5, reps: 10 - setIndex, unit: 'kg', kind: 'working', trainingDate: day,
        performedAt: `${day}T12:${String(setIndex).padStart(2, '0')}:00Z`, demo: true });
    });
  });
  return addFlyExample({ ...state, focusedExampleVersion: 1,
    testingScope: { targetIds: [lateralTarget.id, chestTarget.id], exerciseIds: [lateral.id, chest.id], machineIds: [...cableProfiles.map(machine => machine.id), firstChest.id, secondChest.id],
      previousTargetExerciseIds: { [lateralTarget.id]: [...lateralTarget.exerciseIds], [chestTarget.id]: [...chestTarget.exerciseIds] } },
    exercises: state.exercises.map(exercise => exercise.id === lateral.id ? { ...exercise, name: 'Cable lateral raises' } : exercise.id === chest.id ? { ...exercise, name: 'Chest press' } : exercise),
    targets: state.targets.map(target => target.id === lateralTarget.id ? { ...target, exerciseIds: [lateral.id] } : target.id === chestTarget.id ? { ...target, exerciseIds: [chest.id] } : target),
    machines: [...state.machines.map(machine => machine.id === firstChest.id ? { ...machine, name: 'Chest press machine 1' } : machine), secondChest],
    equipmentLinks: [...state.equipmentLinks, { id: id(), machineId: secondChest.id, exerciseId: chest.id, archived: false }], demoHistory }, id, now);
}

function addFlyExample(input, id, now) {
  const state = migrateMuscles(input, id);
  const fly = state.exercises.find(exercise => exercise.catalogKey === 'fly:0' && !exercise.archived);
  const target = state.targets.find(target => target.presetKey === 'fly' && !target.archived);
  const chest = state.exercises.find(exercise => exercise.catalogKey === 'chest:0' && !exercise.archived);
  if (!fly || !target || !chest) throw new Error('The cable-fly example could not be loaded. Export your data before changing the library.');
  const muscles = [...state.muscles];
  const supportIds = [['supraspinatus', 'Supraspinatus'], ['upper-trapezius', 'Upper trapezius']].map(([catalogKey, name]) => {
    let muscle = muscles.find(muscle => muscle.catalogKey === catalogKey);
    if (!muscle) { muscle = { id: id(), catalogKey, name }; muscles.push(muscle); }
    return muscle.id;
  });
  const cableIds = state.testingScope.machineIds.filter(machineId => {
    // Existing cable profiles already have the fly link from the original preset.
    return machineExerciseIds(state, machineId).includes(fly.id);
  });
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: state.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const demoHistory = [...(state.demoHistory || [])];
  cableIds.forEach((machineId, profileIndex) => {
    const machine = state.machines.find(machine => machine.id === machineId);
    for (let index = 0; index < 5; index++) {
      const trainingDate = new Date(Date.parse(`${day}T12:00:00Z`) - (30 - index * 6) * 86400000).toISOString().slice(0, 10);
      const sessionId = id();
      for (let setIndex = 0; setIndex < 2; setIndex++) demoHistory.push({ id: id(), sessionId, machineId, exerciseId: fly.id,
        machineName: machine.name, exerciseName: fly.name, gymId: machine.gymId, weight: [5, 8, 4][profileIndex] + index,
        reps: 12 + index % 3 - setIndex, unit: 'kg', kind: 'working', trainingDate, performedAt: `${trainingDate}T12:0${setIndex}:00Z`, demo: true });
    }
  });
  return { ...state, focusedExampleVersion: 2, muscles, demoHistory,
    testingScope: { ...state.testingScope, targetIds: [...new Set([...state.testingScope.targetIds, target.id])],
      exerciseIds: [...new Set([...state.testingScope.exerciseIds, fly.id])] },
    exercises: state.exercises.map(exercise => exercise.catalogKey === 'lateral:1' ? { ...exercise, type: 'isolation', supportingMuscleIds: supportIds }
      : exercise.id === fly.id ? { ...exercise, type: 'isolation', primaryMuscleIds: [...chest.primaryMuscleIds] } : exercise) };
}

export function scopedMachineExercises(state, machineId) {
  const ids = new Set(scopeItems(state, 'exercises').map(exercise => exercise.id));
  return machineExerciseIds(state, machineId).filter(id => ids.has(id));
}
