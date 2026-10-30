// A civil-day boundary in the configured zone, including DST. Subtract a
// calendar day before the cutoff, rather than subtracting elapsed hours.
const formatters = new Map();
export function trainingDay(value = new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone, startHour = 0) {
  if (!formatters.has(timeZone)) formatters.set(timeZone, new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }));
  const parts = formatters.get(timeZone).formatToParts(new Date(value));
  const part = name => parts.find(item => item.type === name).value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  return Number(part('hour')) < startHour ? new Date(Date.parse(`${date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10) : date;
}

export const dayStartHour = state => state.trainingDayStartHour ?? (state.production ? 4 : 0);
export const currentTrainingDay = (state, value = new Date()) => trainingDay(value, state.timeZone, dayStartHour(state));

export function setTrainingDate(state, set) {
  // Tests with an explicitly simulated day keep their chosen date. Original
  // persisted dates/timestamps are never rewritten when changing the boundary.
  if (!dayStartHour(state) || state.sessions?.some(session => session.id === set.sessionId && session.simulated) || !Number.isFinite(Date.parse(set.performedAt))) return set.trainingDate;
  return currentTrainingDay(state, set.performedAt);
}

export const projectSetDay = (state, set) => {
  const trainingDate = setTrainingDate(state, set);
  return trainingDate === set.trainingDate ? set : { ...set, trainingDate };
};
