import { projectSetDay } from './trainingCalendar.mjs';
// Configurable ordering heuristics, not measurements of physiological recovery.
export const DEFAULT_RANKING = Object.freeze({
  supportingWeight: 0.35,
  fatiguePenaltyPerSet: 0.35,
  recommendedFatigueThreshold: 0.7,
  continuationBonus: 0.08,
  isolationPenalty: 0.12,
  openingCompoundBonus: 2
});

export const OPENING_COMPOUND_GOAL = 2;

export const RANKING_FIELDS = [
  ['supportingWeight', 'Supporting muscle weight', 0, 1],
  ['fatiguePenaltyPerSet', 'Fatigue penalty / set', 0, 5],
  ['recommendedFatigueThreshold', 'Recommended threshold', 0, 1],
  ['continuationBonus', 'Continue bonus', 0, 0.25],
  ['isolationPenalty', 'Isolation ordering penalty', 0, 0.5],
  ['openingCompoundBonus', 'Opening compound bonus', 0, 3]
];

export function rankingConfig(state) {
  // Preserve previously configured recovery weights when upgrading to one factor.
  const legacy = { fatiguePenaltyPerSet: 'recoveryPenaltyPerSet', recommendedFatigueThreshold: 'recommendedRecoveryThreshold' };
  return Object.fromEntries(RANKING_FIELDS.map(([key, , min, max]) => {
    const value = state.rankingConfig?.[key] ?? state.rankingConfig?.[legacy[key]];
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
  SESSION_OVERLAP: 'Muscles worked today', FINISHED_TODAY: 'Finished today', TARGET_MET: 'Target met',
  OPENING_COMPOUND: 'Larger exercise first'
});

export function uniqueWorkingSets(state, day, now) {
  const seen = new Set();
  return state.sets.map(set => projectSetDay(state, set)).filter(set => {
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

export function fatigueModifiers(exercise, target, sets, day, exerciseById, config, now = new Date().toISOString()) {
  let recentLoad = 0, todayLoad = 0, fatigueLoad = 0;
  const nowMs = Date.parse(now);
  // The persisted duration remains in days for Notion/backward compatibility;
  // each day now means exactly 24 elapsed hours, independent of calendar/DST.
  const windowHours = Number(target.spacingDays ?? 2) * 24;
  const seen = new Set();
  for (const set of sets) {
    if (seen.has(set.id) || set.kind !== 'working' || set.demo) continue;
    seen.add(set.id);
    const ageHours = (nowMs - Date.parse(set.performedAt)) / 3600000;
    if (!Number.isFinite(ageHours) || ageHours < 0 || ageHours >= windowHours || !(windowHours > 0)) continue;
    const overlap = muscleOverlap(exercise, exerciseById.get(set.exerciseId), config);
    if (!overlap) continue;
    const load = overlap * (1 - ageHours / windowHours);
    fatigueLoad += load;
    if (set.trainingDate === day) todayLoad += load;
    else recentLoad += load;
  }
  // Date partitions only explain the reason; each set enters this factor once.
  return { recentLoad, todayLoad, fatigueLoad, fatigueModifier: 1 / (1 + fatigueLoad * config.fatiguePenaltyPerSet) };
}

const bucketOrder = { recommended: 0, other: 1, done: 2 };
export function compareRankedOptions(a, b) {
  // Round to hundredths so alternation only breaks practically equal scores.
  return bucketOrder[a.bucket] - bucketOrder[b.bucket] || Math.round(b.score * 100) - Math.round(a.score * 100) ||
    Number(b.alternatesPrimary) - Number(a.alternatesPrimary);
}
