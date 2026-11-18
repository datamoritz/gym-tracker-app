// Presentation groups are independent: today's completed first occasion can be
// shown without meeting a weekly target; a target met today appears in both.
export function nextCompletionGroups(rows) {
  return {
    doneToday: rows.filter(row => row.finished_today),
    doneWeekly: rows.filter(row => row.rolling_target_met)
  };
}
