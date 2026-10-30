import { projectSetDay } from './trainingCalendar.mjs';
// Journal uses logged values in their original units. Charts convert only within
// one comparable exercise/equipment pair, never across equipment profiles.
export function journalSets(state, { exerciseId = '', machineId = '', from = '', to = '' } = {}) {
  const seen = new Set();
  return state.sets.map(set => projectSetDay(state, set)).filter(set => {
    if (set.demo || seen.has(set.id)) return false;
    seen.add(set.id);
    return (!exerciseId || set.exerciseId === exerciseId) && (!machineId || set.machineId === machineId) &&
      (!from || set.trainingDate >= from) && (!to || set.trainingDate <= to);
  }).sort((a, b) => b.trainingDate.localeCompare(a.trainingDate) || Date.parse(a.performedAt) - Date.parse(b.performedAt) || a.id.localeCompare(b.id));
}

export function journalDays(sets) {
  const days = new Map();
  for (const set of sets) {
    if (!days.has(set.trainingDate)) days.set(set.trainingDate, []);
    days.get(set.trainingDate).push(set);
  }
  return [...days].map(([day, sets]) => ({ day, sets }));
}
