const DAY_MS = 86400000;
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function validTrainingDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export const shiftTrainingDate = (day, amount) => new Date(Date.parse(`${day}T12:00:00Z`) + amount * DAY_MS).toISOString().slice(0, 10);
const distance = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
const weekday = day => new Date(`${day}T12:00:00Z`).getUTCDay();

export function validWeekSchedule(schedule) {
  return Array.isArray(schedule) && schedule.length <= 250 && new Set(schedule.map(item => item?.id)).size === schedule.length &&
    schedule.every(item => item && typeof item.id === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(item.id) &&
      validTrainingDate(item.effectiveOn) && validTrainingDate(item.startDay) && distance(item.startDay, item.effectiveOn) >= 0 && distance(item.startDay, item.effectiveOn) < 7);
}

export function trainingWeek(state, day) {
  // Retain schedule changes so a later reset cannot rewrite a historical query.
  const schedule = state.trainingWeekSchedule || [];
  const change = schedule.map((item, index) => ({ ...item, index })).filter(item => item.effectiveOn <= day)
    .sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn) || a.index - b.index).at(-1);
  const anchor = change?.startDay || '1970-01-05'; // Monday by default.
  const startDay = shiftTrainingDate(anchor, Math.floor(distance(anchor, day) / 7) * 7);
  return { startDay, endDay: shiftTrainingDate(startDay, 6), weekStartDay: weekday(anchor) };
}

export function startNewTrainingWeek(state, startDay, today, id = () => crypto.randomUUID()) {
  if (!validTrainingDate(startDay) || !validTrainingDate(today) || distance(startDay, today) < 0 || distance(startDay, today) > 6) {
    throw new Error('Choose a start date from the last seven days, including today.');
  }
  if (trainingWeek(state, today).startDay === startDay) return state;
  const trainingWeekSchedule = [...(state.trainingWeekSchedule || []), { id: id(), effectiveOn: today, startDay }];
  if (!validWeekSchedule(trainingWeekSchedule)) throw new Error('The training-week schedule could not be saved.');
  return { ...state, trainingWeekSchedule };
}

export function startDayForWeekday(value, today) {
  const day = Number(value);
  if (!Number.isInteger(day) || day < 0 || day > 6 || !validTrainingDate(today)) throw new Error('Choose a week-start day.');
  return shiftTrainingDate(today, -((weekday(today) - day + 7) % 7));
}

export function trainingWeekLabel(week) {
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
  return `${formatter.format(new Date(`${week.startDay}T12:00:00Z`))} – ${formatter.format(new Date(`${week.endDay}T12:00:00Z`))}`;
}
