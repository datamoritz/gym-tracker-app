import { installTrainingTargets } from './trainingTargets.mjs';
import { installLateralExample, machineExerciseIds, exerciseMachines, byName, setMachineExercises } from './equipment.mjs';
import { installFocusedExample, scopeItems } from './focusedExample.mjs';
import { migrateMuscles, primaryMuscleIds } from './muscles.mjs';
import { rankingConfig, uniqueWorkingSets, fatigueModifiers, muscleOverlap, compareRankedOptions, NEXT_REASONS } from './ranking.mjs';
export { prescription, weeklyPrescription } from './trainingTargets.mjs';
export const FLEXIBLE_KEY = 'gym_flexible_preview_v1';
export const newId = () => crypto.randomUUID();

export function trainingDay(value = new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const part = name => parts.find(item => item.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function dayDistance(from, to) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
}

// All relationships use immutable IDs. Labels are only display data.
export function createFlexibleState(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const gymId = newId();
  return migrateMuscles(installLateralExample(installTrainingTargets({ version: 1, timeZone, gyms: [{ id: gymId, name: 'Gym' }], selectedGymId: gymId,
    exercises: [], machines: [], targets: [], sessions: [], activities: [], sets: [] }, newId), newId), newId);
}

export function readFlexibleState(storage, { focused = false } = {}) {
  const raw = storage.getItem(FLEXIBLE_KEY);
  if (!raw) {
    const state = createFlexibleState();
    return focused ? installFocusedExample(state, newId) : state;
  }
  const state = JSON.parse(raw);
  if (state?.version !== 1 || !['gyms', 'exercises', 'machines', 'targets', 'sessions', 'activities', 'sets'].every(key => Array.isArray(state[key]))) {
    throw new Error('The saved preview has an unsupported format. Export the saved data before continuing.');
  }
  const next = migrateMuscles(installLateralExample(installTrainingTargets(state, newId), newId), newId);
  return focused ? installFocusedExample(next, newId) : next;
}

export const activeSession = state => state.sessions.find(session => !session.endedAt) || null;
export const setActivityIds = set => [...new Set([set.activityId, ...(set.activityIds || [])].filter(Boolean))];
export const activitySets = (state, activityId) => state.sets.filter(set => setActivityIds(set).includes(activityId));
export const sessionSets = (state, sessionId) => state.sets.filter(set => set.sessionId === sessionId);
export const targetSets = (state, targetId) => {
  const ids = new Set(state.activities.filter(activity => activity.targetId === targetId).map(activity => activity.id));
  return state.sets.filter(set => setActivityIds(set).some(id => ids.has(id)));
};

export function targetProgress(state, target, day, now) {
  const sets = uniqueWorkingSets(state, day, now);
  const activities = state.activities.filter(activity => activity.targetId === target.id);
  const activityById = new Map(activities.map(activity => [activity.id, activity]));
  const days = new Map();
  for (const set of sets) {
    const activity = setActivityIds(set).map(id => activityById.get(id)).find(Boolean);
    if (!activity) continue;
    let group = days.get(set.trainingDate);
    if (!group) {
      // The first work logged on a day fixes that day's qualifying threshold.
      group = { day: set.trainingDate, requiredSets: activity.requiredSets, count: 0, prescriptionId: activity.prescriptionId,
        repMin: activity.repMin ?? target.repMin, repMax: activity.repMax ?? target.repMax,
        maxSets: activity.maxSets ?? activity.requiredSets, recommendedSets: activity.recommendedSets, perSide: activity.perSide ?? target.perSide };
      days.set(set.trainingDate, group);
    }
    group.count += 1;
  }
  const qualified = [...days.values()].filter(group => group.count >= group.requiredSets).sort((a, b) => a.day.localeCompare(b.day));
  const recent = qualified.filter(group => dayDistance(group.day, day) < target.windowDays);
  const lastDay = qualified.at(-1)?.day || null;
  const relatedActivityIds = new Set(state.activities.filter(activity => {
    const relatedTarget = state.targets.find(item => item.id === activity.targetId);
    return relatedTarget?.exerciseIds.some(id => target.exerciseIds.includes(id));
  }).map(activity => activity.id));
  const lastWorkedDay = sets.filter(set => setActivityIds(set).some(id => relatedActivityIds.has(id)))
    .map(set => set.trainingDate).sort().at(-1) || null;
  const today = days.get(day);
  const doses = target.prescriptions || [target];
  const nextDose = doses.find(dose => !recent.some(group => group.prescriptionId === dose.id)) || doses[0];
  const dose = today || nextDose;
  return { occasions: recent.length, remaining: Math.max(0, target.frequency - recent.length), lastDay, lastWorkedDay,
    daysSince: lastWorkedDay ? dayDistance(lastWorkedDay, day) : null,
    todaySets: today?.count || 0, requiredSets: dose.requiredSets, prescription: dose,
    completedToday: Boolean(today && today.count >= today.requiredSets),
    finished_today: Boolean(today && today.count >= today.requiredSets), rolling_target_met: recent.length >= target.frequency };
}

export function rankTargets(state, day, now = new Date().toISOString()) {
  const config = rankingConfig(state);
  const sets = uniqueWorkingSets(state, day, now);
  const exerciseById = new Map(state.exercises.map(exercise => [exercise.id, exercise]));
  const lastSet = sets.filter(set => set.trainingDate === day).sort((a, b) => Date.parse(a.performedAt) - Date.parse(b.performedAt)).at(-1);
  const lastExercise = exerciseById.get(lastSet?.exerciseId);
  const rows = scopeItems(state, 'targets').filter(target => target.active).flatMap(target => {
    const progress = targetProgress(state, target, day, now);
    const eligible = scopeItems(state, 'exercises').filter(exercise => target.exerciseIds.includes(exercise.id))
      .map(exercise => ({ exercise, machines: exerciseMachines(state, exercise.id) })).filter(option => option.machines.length);
    if (!eligible.length) return [];
    const shortfall = progress.remaining / target.frequency;
    const baseScore = shortfall * target.priority;
    const continuing = progress.todaySets > 0 && !progress.finished_today;
    const continuationBonus = continuing ? config.continuationBonus : 0;
    const exerciseOptions = eligible.map(({ exercise, machines }) => {
      const modifiers = fatigueModifiers(exercise, target, sets, day, exerciseById, config, now);
      const suitable = modifiers.fatigueModifier >= config.recommendedFatigueThreshold;
      const bucket = progress.finished_today || progress.rolling_target_met ? 'done' : suitable && !target.optional ? 'recommended' : 'other';
      const alternatesPrimary = primaryMuscleIds(exercise).length > 0 && primaryMuscleIds(lastExercise).length > 0 &&
        !primaryMuscleIds(exercise).some(id => primaryMuscleIds(lastExercise).includes(id));
      return { exercise, machines, ...modifiers, bucket, baseScore, continuationBonus, orderingAdjustment: 0,
        score: baseScore * modifiers.fatigueModifier + continuationBonus, alternatesPrimary };
    });
    return [{ target, progress, exerciseOptions, shortfall, finished_today: progress.finished_today, rolling_target_met: progress.rolling_target_met }];
  });
  for (const row of rows) {
    for (const option of row.exerciseOptions) {
      if (option.exercise.type !== 'isolation' || row.finished_today || row.rolling_target_met) continue;
      const compounds = rows.filter(other => other.target.id !== row.target.id && !other.target.optional &&
        other.target.priority >= row.target.priority && !other.finished_today && !other.rolling_target_met)
        .flatMap(other => other.exerciseOptions).filter(other => other.exercise.type === 'compound' && other.bucket === 'recommended');
      const overlap = Math.max(0, ...compounds.map(compound => muscleOverlap(compound.exercise, option.exercise, config)));
      option.orderingAdjustment = -config.isolationPenalty * overlap;
      option.score += option.orderingAdjustment;
    }
    row.exerciseOptions.sort((a, b) => compareRankedOptions(a, b) || byName(a.exercise, b.exercise));
    const best = row.exerciseOptions[0];
    const reasonCodes = [];
    if (row.progress.remaining) reasonCodes.push('DUE');
    if (row.progress.todaySets > 0 && !row.finished_today) reasonCodes.push('CONTINUE');
    if (best.recentLoad > 0) reasonCodes.push('RECENT_OVERLAP');
    if (best.todayLoad > 0) reasonCodes.push('SESSION_OVERLAP');
    if (row.finished_today) reasonCodes.push('FINISHED_TODAY');
    if (row.rolling_target_met) reasonCodes.push('TARGET_MET');
    Object.assign(row, best, { recommendedExerciseId: best.exercise.id,
      exercises: row.exerciseOptions.map(option => option.exercise),
      machines: [...new Map(row.exerciseOptions.flatMap(option => option.machines).map(machine => [machine.id, machine])).values()].sort(byName),
      reasonCodes, reasons: [...reasonCodes.map(code => NEXT_REASONS[code]), ...(best.orderingAdjustment < 0 ? ['Better later · overlapping compound work remains'] : [])],
      recovering: best.fatigueLoad > 0, deferred: best.orderingAdjustment < 0,
      extra: row.rolling_target_met && !row.finished_today });
  }
  return rows.sort((a, b) => compareRankedOptions(a, b) || (a.target.order || 0) - (b.target.order || 0) || a.target.id.localeCompare(b.target.id));
}

export function startFlexibleSession(state, day, now = new Date().toISOString(), simulated = false) {
  if (activeSession(state)) return state;
  return { ...state, sessions: [...state.sessions, { id: newId(), gymId: state.selectedGymId, startedAt: now, trainingDate: day, simulated, endedAt: null }] };
}

export function addFlexibleSet(state, { targetId, machineId, exerciseId: requestedExerciseId, weight, reps, unit = 'kg', kind = 'working', note = '', day, now = new Date().toISOString() }) {
  const session = activeSession(state);
  const target = state.targets.find(item => item.id === targetId && item.active);
  const machine = state.machines.find(item => item.id === machineId);
  const choices = machine ? machineExerciseIds(state, machine.id).filter(exerciseId => target?.exerciseIds.includes(exerciseId)) : [];
  const exerciseId = requestedExerciseId || (choices.length === 1 ? choices[0] : null);
  if (!session || !target || !machine || machine.archived || machine.gymId !== session.gymId || !choices.includes(exerciseId)) throw new Error('Choose a linked machine and exercise at this session’s gym.');
  if (session.simulated && day !== session.trainingDate) throw new Error('Finish this session before changing the test date.');
  if (weight === '' || weight === null || !Number.isFinite(Number(weight)) || Number(weight) < 0 || !Number.isInteger(Number(reps)) || Number(reps) < 1 || Number(reps) > 1000) throw new Error('Enter a non-negative load and a whole number of reps greater than zero.');
  if (!['kg', 'lbs'].includes(unit) || kind !== 'working') throw new Error('Invalid unit or set type.');
  const applicableTargets = [target, ...scopeItems(state, 'targets').filter(item => item.id !== target.id && item.active && item.exerciseIds.includes(exerciseId))];
  const activities = [...state.activities], creditedActivities = [];
  for (const applicable of applicableTargets) {
    let activity = activities.find(item => item.sessionId === session.id && item.targetId === applicable.id && item.trainingDate === day);
    if (!activity) {
      const dose = targetProgress(state, applicable, day, now).prescription;
      activity = { id: newId(), targetId: applicable.id, sessionId: session.id, trainingDate: day, requiredSets: dose.requiredSets,
        maxSets: dose.maxSets, ...(dose.recommendedSets === undefined ? {} : { recommendedSets: dose.recommendedSets }), repMin: dose.repMin, repMax: dose.repMax, perSide: dose.perSide,
        prescriptionId: dose.prescriptionId || dose.id, targetName: applicable.name, createdAt: now };
      activities.push(activity);
    }
    creditedActivities.push(activity);
  }
  const activity = creditedActivities[0];
  const set = { id: newId(), activityId: activity.id, activityIds: creditedActivities.map(item => item.id), sessionId: session.id, exerciseId, machineId, gymId: machine.gymId,
    exerciseName: state.exercises.find(item => item.id === exerciseId)?.name || '', machineName: machine.name,
    weight: Number(weight), reps: Number(reps), perSide: Boolean(activity.perSide ?? target.perSide), unit, kind, note: note.trim(), trainingDate: day, performedAt: now };
  return { ...state, activities, sets: [...state.sets, set] };
}

export function finishFlexibleSession(state, now = new Date().toISOString()) {
  const session = activeSession(state);
  return session ? { ...state, sessions: state.sessions.map(item => item.id === session.id ? { ...item, endedAt: now } : item) } : state;
}

export function saveTarget(state, input) {
  if (!input.name.trim()) throw new Error('Give the target a name.');
  for (const [field, min, max] of [['frequency', 1, 7], ['requiredSets', 1, 20], ['priority', 1, 3]]) {
    if (!Number.isInteger(Number(input[field])) || Number(input[field]) < min || Number(input[field]) > max) throw new Error(`Check ${field}: use a whole number from ${min} to ${max}.`);
  }
  if (!Number.isFinite(Number(input.spacingDays)) || input.spacingDays === '' || Number(input.spacingDays) < 0 || Number(input.spacingDays) > 14) throw new Error('Use a recovery window from 0 to 336 hours.');
  if (!input.exerciseIds.length || input.exerciseIds.some(id => !state.exercises.some(exercise => exercise.id === id))) throw new Error('Link at least one exercise option.');
  const existing = state.targets.find(target => target.id === input.id);
  const rawDoses = input.prescriptions?.length ? input.prescriptions : Array.from({ length: Number(input.frequency) }, () => input);
  const prescriptions = rawDoses.map(dose => {
    const requiredSets = Number(dose.requiredSets), maxSets = Number(dose.maxSets ?? requiredSets);
    const repMin = Number(dose.repMin ?? 8), repMax = Number(dose.repMax ?? 12);
    if (!Number.isInteger(requiredSets) || requiredSets < 1 || requiredSets > 20 || !Number.isInteger(maxSets) || maxSets < requiredSets || maxSets > 20) throw new Error('Check the set range.');
    if (!Number.isInteger(repMin) || !Number.isInteger(repMax) || repMin < 1 || repMax < repMin || repMax > 1000) throw new Error('Check the rep range.');
    return { id: input.prescriptions?.length ? dose.id || newId() : newId(), requiredSets, maxSets, ...(state.production ? { recommendedSets: maxSets } : {}), repMin, repMax, perSide: Boolean(dose.perSide) };
  });
  if (prescriptions.length !== Number(input.frequency)) throw new Error('Add one prescription for each weekly occasion.');
  const { requiredSets, maxSets, repMin, repMax, perSide } = prescriptions[0];
  const target = { ...existing, id: existing?.id || newId(), name: input.name.trim(), frequency: Number(input.frequency), prescriptions, requiredSets, maxSets,
    ...(state.production ? { recommendedSets: maxSets, order: existing?.order ?? state.targets.length } : {}),
    repMin, repMax, perSide, optional: Boolean(input.optional),
    spacingDays: Number(input.spacingDays), priority: Number(input.priority), windowDays: 7, exerciseIds: [...new Set(input.exerciseIds)], active: input.active !== false };
  return { ...state, targets: existing ? state.targets.map(item => item.id === target.id ? target : item) : [...state.targets, target] };
}

export function saveExercise(state, input) {
  if (!input.name.trim()) throw new Error('Add an exercise name.');
  const existing = state.exercises.find(exercise => exercise.id === input.id);
  // Type and muscle relations are supplied by the catalog, never edited here.
  const exercise = { type: null, primaryMuscleIds: [], supportingMuscleIds: [], ...existing,
    id: existing?.id || newId(), name: input.name.trim() };
  return { ...state, exercises: existing ? state.exercises.map(item => item.id === exercise.id ? exercise : item) : [...state.exercises, exercise] };
}

export function saveMachine(state, input) {
  const exerciseIds = input.exerciseIds || (input.exerciseId ? [input.exerciseId] : []);
  if (!input.name.trim() || !exerciseIds.length || !state.gyms.some(gym => gym.id === input.gymId)) throw new Error('Add a machine name and choose exercises and a gym.');
  const existing = state.machines.find(machine => machine.id === input.id);
  if (existing && state.sets.some(set => set.machineId === existing.id) && existing.gymId !== input.gymId) throw new Error('This profile has logged sets. Create another profile for a different gym.');
  const stationCount = Number(input.stationCount ?? input.stations?.length ?? existing?.stations?.length ?? 1);
  if (!Number.isInteger(stationCount) || stationCount < 1 || stationCount > 50) throw new Error('Use 1–50 equivalent stations.');
  const machine = { ...existing, id: existing?.id || newId(), name: input.name.trim(), gymId: input.gymId,
    stations: Array.from({ length: stationCount }, (_, index) => existing?.stations?.[index] || { id: newId(), name: `Station ${index + 1}` }) };
  const next = { ...state, machines: existing ? state.machines.map(item => item.id === machine.id ? machine : item) : [...state.machines, machine] };
  return setMachineExercises(next, machine.id, exerciseIds, newId);
}
