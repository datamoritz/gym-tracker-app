export function readDailyStars(storage, key) {
  try { return JSON.parse(storage.getItem(key)) || {}; } catch { return {}; }
}
export function starsForDay(value, day) {
  return value?.day === day && Array.isArray(value.ids) ? [...new Set(value.ids.filter(id => typeof id === 'string'))] : [];
}
export function toggleDailyStar(value, day, id) {
  const ids = starsForDay(value, day);
  return { day, ids: ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id] };
}
