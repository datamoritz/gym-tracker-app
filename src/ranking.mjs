// Configurable ordering heuristics, not measurements of physiological recovery.
export const DEFAULT_RANKING = Object.freeze({
  supportingWeight: 0.35,
  recoveryPenaltyPerSet: 0.35,
  sessionPenaltyPerSet: 0.2,
  recommendedRecoveryThreshold: 0.7,
  recommendedSessionThreshold: 0.65,
  continuationBonus: 0.08,
  isolationPenalty: 0.12
});

export const RANKING_FIELDS = [
  ['supportingWeight', 'Supporting muscle weight', 0, 1],
  ['recoveryPenaltyPerSet', 'Recovery penalty / set', 0, 5],
  ['sessionPenaltyPerSet', 'Today’s penalty / set', 0, 5],
  ['recommendedRecoveryThreshold', 'Recovery threshold', 0, 1],
  ['recommendedSessionThreshold', 'Today’s threshold', 0, 1],
  ['continuationBonus', 'Continue bonus', 0, 0.25],
  ['isolationPenalty', 'Isolation ordering penalty', 0, 0.5]
];

export function rankingConfig(state) {
  return Object.fromEntries(RANKING_FIELDS.map(([key, , min, max]) => {
    const value = state.rankingConfig?.[key];
    return [key, typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : DEFAULT_RANKING[key]];
  }));
}

export function saveRankingConfig(state, input) {
  const config = {};
  for (const [key, label, min, max] of RANKING_FIELDS) {
    const value = input[key];
    if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) throw new Error(`Check ${label}: use ${min}–${max}.`);
    config[key] = Number(value);
  }
  return { ...state, rankingConfig: config };
}

export const NEXT_REASONS = Object.freeze({
  DUE: 'Due', CONTINUE: 'Continue', RECENT_OVERLAP: 'Recent muscle work',
  SESSION_OVERLAP: 'Muscles worked today', FINISHED_TODAY: 'Finished today', TARGET_MET: 'Target met'
});

export function uniqueWorkingSets(state, day, now) {
  const seen = new Set();
  return state.sets.filter(set => {
    if (set.kind !== 'working' || set.demo || set.trainingDate > day || (now && Date.parse(set.performedAt) > Date.parse(now)) || seen.has(set.id)) return false;
    seen.add(set.id);
    return true;
  }).sort((a,b) => Date.parse(a.performedAt) - Date.parse(b.performedAt) || a.id.localeCompare(b.id));
}

function involvement(exercise, config) {
  const weights = new Map((exercise?.supportingMuscleIds || []).map(id => [id, config.supportingWeight]));
  for (const id of exercise?.primaryMuscleIds || []) weights.set(id, 1);
  return weights;
}

// A past set contributes at most one equivalent set to any candidate. A muscle
// appearing in both relation lists is still counted once, with primary weight.
export function muscleOverlap(candidate, performed, config) {
  const wanted = involvement(candidate, config), used = involvement(performed, config);
  let shared = 0, scale = 0;
  for (const [id, weight] of wanted) { shared += weight * (used.get(id) || 0); scale += weight * weight; }
  return scale ? Math.min(1, shared / Math.max(1, scale)) : 0;
}

export function fatigueModifiers(exercise, target, sets, day, exerciseById, config) {
  let recentLoad = 0, todayLoad = 0;
  for (const set of sets) {
    const overlap = muscleOverlap(exercise, exerciseById.get(set.exerciseId), config);
    if (!overlap) continue;
    if (set.trainingDate === day) { todayLoad += overlap; continue; }
    const ageDays = Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${set.trainingDate}T12:00:00Z`)) / 86400000);
    const window = Number(target.spacingDays) || 0;
    if (ageDays > 0 && ageDays < window) recentLoad += overlap * (1 - ageDays / window);
  }
  return { recentLoad, todayLoad,
    recoveryModifier: 1 / (1 + recentLoad * config.recoveryPenaltyPerSet),
    sessionModifier: 1 / (1 + todayLoad * config.sessionPenaltyPerSet) };
}

const bucketOrder = { recommended: 0, other: 1, done: 2 };
export function compareRankedOptions(a, b) {
  // Round to hundredths so alternation only breaks practically equal scores.
  return bucketOrder[a.bucket] - bucketOrder[b.bucket] || Math.round(b.score * 100) - Math.round(a.score * 100) ||
    Number(b.alternatesPrimary) - Number(a.alternatesPrimary);
}
