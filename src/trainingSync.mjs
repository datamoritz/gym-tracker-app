export const TRAINING_KEY = 'fitness_notion_v1';
const fields = {
  gyms: ['id','name'],
  exercises: ['id','name'],
  machines: ['id','name','gymId','stations','archived'],
  targets: ['id','name','exerciseIds','frequency','requiredSets','recommendedSets','maxSets','repMin','repMax','perSide','prescriptions','windowDays','spacingDays','priority','active','optional','order','guidance'],
  sessions: ['id','gymId','startedAt','trainingDate','endedAt','restUntil'],
  sets: ['id','activityId','activityIds','sessionId','exerciseId','machineId','gymId','exerciseName','machineName','weight','reps','perSide','unit','kind','note','trainingDate','performedAt','source'],
  settings: ['id','name','timeZone','selectedGymId','rankingConfig']
};
export function equal(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, i) => equal(value, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a).filter(key => a[key] !== undefined).sort(), bk = Object.keys(b).filter(key => b[key] !== undefined).sort();
    return equal(ak, bk) && ak.every(key => equal(a[key], b[key]));
  }
  return false;
}
export function recordsFor(state, entity) {
  if (!state) return [];
  if (entity === 'assignments') return state.exercises.map(exercise => ({ id: exercise.id, machineIds: (state.equipmentLinks || []).filter(link => !link.archived && link.exerciseId === exercise.id).map(link => link.machineId).sort() }));
  const records = entity === 'settings' ? [{ id: state.settingsId, name: 'Preferences', timeZone: state.timeZone, selectedGymId: state.selectedGymId, rankingConfig: state.rankingConfig }] : state[entity] || [];
  return records.map(record => ({ ...Object.fromEntries(fields[entity].filter(key => record[key] !== undefined).map(key => [key, record[key]])),
    ...(entity === 'sets' ? { deleted: false, activities: (state.activities || []).filter(activity => [record.activityId, ...(record.activityIds || [])].includes(activity.id)) } : {}) }));
}
export function mutationsBetween(before, after, id = () => crypto.randomUUID()) {
  const operations = [];
  for (const entity of [...Object.keys(fields), 'assignments']) {
    const oldRecords = new Map(recordsFor(before, entity).map(item => [item.id, item]));
    for (const record of recordsFor(after, entity)) {
      const previous = oldRecords.get(record.id); oldRecords.delete(record.id);
      const changed = Object.keys(record).filter(key => key !== 'id' && !equal(previous?.[key], record[key]));
      if (changed.length || !previous) operations.push({ id: id(), entity, recordId: record.id, create: !previous,
        changes: Object.fromEntries(changed.map(key => [key, record[key]])), base: Object.fromEntries(changed.map(key => [key, previous?.[key] ?? null])) });
    }
    if (entity === 'sets') for (const record of oldRecords.values()) operations.push({ id: id(), entity, recordId: record.id, changes: { deleted: true }, base: { deleted: false } });
  }
  return operations;
}
export function readTrainingCache(storage) {
  try {
    const value = JSON.parse(storage.getItem(TRAINING_KEY));
    return value?.state?.production === true && Array.isArray(value.queue) ? value : null;
  } catch { return null; }
}
export function writeTrainingCache(storage, value) { storage.setItem(TRAINING_KEY, JSON.stringify(value)); }
