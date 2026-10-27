import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { weightUnit, convertWeight, moveExercise, buildFeedbackWorkout } from './workout.mjs';
import ExerciseGuide, { ExerciseInfoButton } from './ExerciseGuide.jsx';
import { findExerciseGuide } from './exerciseGuide.mjs';
import { DRAFT_KEY, PREVIOUS_GYM, gymName, preferenceKey, sessionDate, readSession, saveSession, exerciseInput, changeRoutineUnit, sessionSetCount } from './session.mjs';

const MOTIVATIONS = [
  'Stronger than yesterday.',
  'Discipline beats motivation.',
  'Focus on progress, not perfection.',
  'Great work, now go recover!'
];

const Icons = {
  Logo: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="9" width="4" height="6" rx="2" fill="#8ab4f8" />
      <rect x="18" y="9" width="4" height="6" rx="2" fill="#8ab4f8" />
      <path d="M6 12H18" stroke="#8ab4f8" strokeWidth="3" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2" fill="#e3e3e3" />
    </svg>
  ),
  Settings: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  Play: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>,
  Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
  ChevronLeft: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>,
  History: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  Chart: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>,
  Cloud: ({ active }) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={active ? '#10b981' : 'none'} stroke={active ? '#10b981' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2.3-1.7-4.2-4-4.5A7 7 0 1 0 5 13c0 .3 0 .7.1 1a4.5 4.5 0 1 0 4.4 5h8z" /></svg>
};

function Header({ title, sub, leftAction, rightAction, notionAvailable, setView }) {
  return (
    <header className="glass-header pt-14 pb-5 px-6 sticky top-0 z-50 flex justify-between items-end safe-top">
      <div className="flex items-center gap-3">
        {leftAction || <Icons.Logo />}
        <div>
          <h1 className="text-xl font-bold text-[#e3e3e3] leading-none mb-1">{title}</h1>
          <div className="flex items-center gap-1.5">
            <Icons.Cloud active={notionAvailable} />
            <p className="text-[10px] text-[#9e9e9e] font-bold uppercase tracking-widest">{sub}</p>
          </div>
        </div>
      </div>
      {rightAction || (
        <div className="flex gap-2">
          <button aria-label="Open analytics" onClick={() => setView('analytics')} className="p-3 bg-[#28292c] text-[#9e9e9e] rounded-full"><Icons.Chart /></button>
          <button aria-label="Open history" onClick={() => setView('history')} className="p-3 bg-[#28292c] text-[#9e9e9e] rounded-full"><Icons.History /></button>
          <button aria-label="Open settings" onClick={() => setView('settings')} className="p-3 bg-[#28292c] text-[#9e9e9e] rounded-full"><Icons.Settings /></button>
        </div>
      )}
    </header>
  );
}

function Notice({ message, tone = 'error' }) {
  const styles = tone === 'success'
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
    : 'bg-red-500/10 border-red-500/30 text-red-200';

  return (
    <div className={`mx-6 mt-4 px-4 py-3 rounded-2xl border text-sm ${styles}`}>
      {message}
    </div>
  );
}

function WeightUnitToggle({ value, onChange, disabled = false, label }) {
  return (
    <div className="weight-unit-toggle" role="group" aria-label={label}>
      {['kg', 'lbs'].map(unit => (
        <button key={unit} type="button" aria-pressed={weightUnit(value) === unit} disabled={disabled}
          onClick={() => onChange(unit)}>{unit}</button>
      ))}
    </div>
  );
}

function getExerciseUnits(routines, gym) {
  return Object.fromEntries(routines.filter(routine => !gym || gymName(routine.gym) === gym).flatMap(routine => (routine.exercises || [])
    .map(exercise => [exercise.name.trim().toLowerCase(), weightUnit(exercise.weightUnit)])));
}

function parseFeedbackText(text, keyPrefix) {
  const segments = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const [token] = match;
    const tokenIndex = match.index || 0;

    if (tokenIndex > lastIndex) {
      segments.push(text.slice(lastIndex, tokenIndex));
    }

    if (token.startsWith('**') && token.endsWith('**')) {
      segments.push(<strong key={`${keyPrefix}-strong-${matchIndex}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      segments.push(<em key={`${keyPrefix}-em-${matchIndex}`}>{token.slice(1, -1)}</em>);
    }

    lastIndex = tokenIndex + token.length;
    matchIndex += 1;
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return segments.length ? segments : [text];
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload;
}

function formatChartDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function buildExerciseAnalytics(workouts, units = {}) {
  const chronologicalWorkouts = [...(workouts || [])].reverse();
  const grouped = new Map();

  for (const workout of chronologicalWorkouts) {
    const exerciseName = typeof workout?.exerciseName === 'string' ? workout.exerciseName.trim() : '';
    if (!exerciseName) continue;

    const key = exerciseName.toLowerCase();
    if (!grouped.has(key)) {
      grouped.set(key, {
        exerciseName,
        weightUnit: weightUnit(units[key]),
        points: [],
        sessions: new Set(),
        totalVolume: 0,
        maxWeight: 0,
        maxReps: 0
      });
    }

    const entry = grouped.get(key);
    const weight = convertWeight(workout.weight, workout.weightUnit, entry.weightUnit);
    const reps = Number(workout.reps) || 0;
    const date = workout.date || null;

    entry.points.push({
      id: workout.id,
      exerciseName,
      x: entry.points.length + 1,
      date,
      weight,
      weightUnit: entry.weightUnit,
      reps,
      notes: workout.notes || '',
      sessionStart: !entry.points.length || entry.points[entry.points.length - 1].date !== date
    });
    if (date) entry.sessions.add(date);
    entry.totalVolume += weight * reps;
    entry.maxWeight = Math.max(entry.maxWeight, weight);
    entry.maxReps = Math.max(entry.maxReps, reps);
  }

  return Array.from(grouped.values())
    .map(entry => {
      const latestPoint = entry.points[entry.points.length - 1] || null;
      const previousPoint = entry.points[entry.points.length - 2] || null;
      const sortedDates = Array.from(entry.sessions).sort();
      let averageGapDays = null;

      if (sortedDates.length > 1) {
        let totalGap = 0;
        for (let index = 1; index < sortedDates.length; index += 1) {
          const current = new Date(`${sortedDates[index]}T12:00:00`);
          const previous = new Date(`${sortedDates[index - 1]}T12:00:00`);
          totalGap += Math.round((current - previous) / 86400000);
        }
        averageGapDays = Math.round(totalGap / (sortedDates.length - 1));
      }

      return {
        exerciseName: entry.exerciseName,
        weightUnit: entry.weightUnit,
        points: entry.points,
        sessionCount: entry.sessions.size,
        totalVolume: Math.round(entry.totalVolume),
        maxWeight: entry.maxWeight,
        maxReps: entry.maxReps,
        averageGapDays,
        latestPoint,
        previousPoint
      };
    })
    .sort((left, right) => left.exerciseName.localeCompare(right.exerciseName));
}

function mergeLiveExercisePoints(points, loggedSets, exerciseName, unit) {
  const normalizedName = typeof exerciseName === 'string' ? exerciseName.trim() : '';
  if (!loggedSets?.length || !normalizedName) return points;

  const today = new Date().toISOString().split('T')[0];
  const nextPoints = [...points];
  const lastDate = nextPoints[nextPoints.length - 1]?.date || null;

  loggedSets.forEach((set, index) => {
    nextPoints.push({
      id: `live-${normalizedName}-${index}`,
      exerciseName: normalizedName,
      x: nextPoints.length + 1,
      date: today,
      weight: convertWeight(set.w, set.weightUnit || unit, unit),
      weightUnit: unit,
      reps: Number(set.r) || 0,
      notes: set.note || '',
      sessionStart: index === 0 ? lastDate !== today : false,
      live: true
    });
  });

  return nextPoints;
}

function AnalyticsChart({ points, compact = false, subtitle = 'Each point is one logged set.' }) {
  const scrollRef = useRef(null);
  const latestPoint = points[points.length - 1];
  const unit = weightUnit(latestPoint?.weightUnit);
  const width = 840;
  const height = compact ? 250 : 300;
  const padding = compact
    ? { top: 18, right: 18, bottom: 52, left: 24 }
    : { top: 18, right: 20, bottom: 58, left: 24 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxWeight = Math.max(...points.map(point => point.weight), 1);
  const maxReps = Math.max(...points.map(point => point.reps), 1);
  const maxValue = Math.max(maxWeight, maxReps);
  const minValue = 0;
  const weightColor = '#8ab4f8';
  const repsColor = '#7ef0c7';

  const getX = index => (
    points.length === 1
      ? padding.left + chartWidth / 2
      : padding.left + (index / (points.length - 1)) * chartWidth
  );
  const getY = value => padding.top + chartHeight - ((value - minValue) / (maxValue - minValue || 1)) * chartHeight;
  const buildLine = accessor => points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(accessor(point))}`).join(' ');
  const gridValues = Array.from({ length: 4 }, (_, index) => Math.round((maxValue / 4) * (4 - index)));

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [points]);

  if (!points.length) return null;

  return (
    <div className="analytics-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-[140px] flex-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#6f747b] font-black">Trajectory</p>
          <p className="text-sm text-[#9aa0a6]">{subtitle}</p>
        </div>
        <div className="shrink-0 ml-auto rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-right">
          <p className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#6f747b]">Last used</p>
          <div className="flex items-center justify-end gap-2 text-xs font-bold tabular-nums">
            <span className="flex items-center gap-1.5 text-[#c9d7f8]"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: weightColor }}></span>{latestPoint.weight} {unit}</span>
            <span className="text-[#50545a]">×</span>
            <span className="flex items-center gap-1.5 text-[#b8f3e1]"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: repsColor }}></span>{latestPoint.reps} reps</span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto no-scrollbar" ref={scrollRef}>
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px] w-full h-auto">
          <defs>
            <linearGradient id="weightGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8ab4f8" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#8ab4f8" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="repsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#7ef0c7" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#7ef0c7" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridValues.map(value => (
            <g key={value}>
              <line
                x1={padding.left}
                y1={getY(value)}
                x2={width - padding.right}
                y2={getY(value)}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="4 8"
              />
              <text x={padding.left - 2} y={getY(value) - 6} fill="#6f747b" fontSize="10" textAnchor="start">
                {value}
              </text>
            </g>
          ))}

          {points.map((point, index) => (
            point.sessionStart ? (
              <g key={`${point.id}-session`}>
                <line
                  x1={getX(index)}
                  y1={padding.top}
                  x2={getX(index)}
                  y2={height - padding.bottom}
                  stroke="rgba(255,255,255,0.08)"
                />
                <text
                  x={getX(index)}
                  y={height - 18}
                  fill="#6f747b"
                  fontSize="10"
                  textAnchor={index === 0 ? 'start' : 'middle'}
                >
                  {formatChartDate(point.date)}
                </text>
              </g>
            ) : null
          ))}

          <path d={`${buildLine(point => point.weight)} L ${getX(points.length - 1)} ${height - padding.bottom} L ${getX(0)} ${height - padding.bottom} Z`} fill="url(#weightGradient)" />
          <path d={`${buildLine(point => point.reps)} L ${getX(points.length - 1)} ${height - padding.bottom} L ${getX(0)} ${height - padding.bottom} Z`} fill="url(#repsGradient)" />
          <path d={buildLine(point => point.weight)} fill="none" stroke={weightColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={buildLine(point => point.reps)} fill="none" stroke={repsColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {points.map((point, index) => (
            <g key={point.id}>
              <circle cx={getX(index)} cy={getY(point.weight)} r="4.5" fill={weightColor} />
              <circle cx={getX(index)} cy={getY(point.weight)} r="12" fill="transparent">
                <title>{`${point.exerciseName || ''}${point.exerciseName ? '\n' : ''}${formatChartDate(point.date)}\nWeight: ${point.weight} ${unit}\nReps: ${point.reps}${point.notes ? `\nNotes: ${point.notes}` : ''}`}</title>
              </circle>
              <circle cx={getX(index)} cy={getY(point.reps)} r="4.5" fill={repsColor} />
            </g>
          ))}

          {points.map((point, index) => (
            <text key={`${point.id}-index`} x={getX(index)} y={height - 34} fill="#9aa0a6" fontSize="10" textAnchor="middle">
              {index + 1}
            </text>
          ))}

        </svg>
      </div>
      {!compact && (
        <div className="flex items-center justify-between mt-3 text-[11px] text-[#6f747b]">
          <span>Set index across all logged sessions</span>
          <span>Dates mark session starts</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('home');
  const [draft, setDraft] = useState(() => readSession(localStorage));
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [exerciseInputs, setExerciseInputs] = useState({});
  const [exercisePreferences, setExercisePreferences] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gym_exercise_preferences_v1') || '{}'); } catch { return {}; }
  });
  const [routines, setRoutines] = useState(() => JSON.parse(localStorage.getItem('gym_routines') || '[]'));
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('gym_history') || '[]'));
  const [notionAvailable, setNotionAvailable] = useState(false);
  const [notionExercises, setNotionExercises] = useState(() => JSON.parse(localStorage.getItem('notion_exercises_cache') || '[]'));
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [workoutLog, setWorkoutLog] = useState({});
  const [currentNote, setCurrentNote] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [inputWeight, setInputWeight] = useState(0);
  const [inputReps, setInputReps] = useState(10);
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [targetEndTime, setTargetEndTime] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [isLogging, setIsLogging] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [completedWorkout, setCompletedWorkout] = useState(null);
  const [isSavingUnit, setIsSavingUnit] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(() => JSON.parse(localStorage.getItem('gym_user_profile') || '{"bodyweight":75,"experienceLevel":"intermediate","goal":"hypertrophy","weeklySplit":"Push Pull Legs"}'));
  const [notice, setNotice] = useState(null);
  const [noticeTone, setNoticeTone] = useState('error');
  const [analyticsWorkouts, setAnalyticsWorkouts] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsGym, setAnalyticsGym] = useState(null);
  const [selectedGym, setSelectedGym] = useState(() => gymName(draft?.routine.gym || localStorage.getItem('gym_history_filter_v1')));
  const [selectedExercise, setSelectedExercise] = useState('');
  const [guideExercise, setGuideExercise] = useState(null);
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const feedbackRequestRef = useRef(0);
  const analyticsRequestRef = useRef(0);
  const submittingRef = useRef(false);
  const latestDraftRef = useRef(draft);
  const currentAnalyticsGym = view === 'active' ? gymName(activeRoutine?.gym) : selectedGym;

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();
        setNotionAvailable(Boolean(data.notionConfigured));
      } catch (error) {
        setNotice('Could not load app configuration.');
        setNoticeTone('error');
      }
    })();
  }, []);

  useEffect(() => { localStorage.setItem('gym_routines', JSON.stringify(routines)); }, [routines]);
  useEffect(() => { if (notionAvailable) { fetchExercisesFromNotion(); fetchRoutinesFromNotion(); } }, [notionAvailable]);
  useEffect(() => { localStorage.setItem('gym_history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('gym_user_profile', JSON.stringify(userProfile)); }, [userProfile]);
  useEffect(() => { localStorage.setItem('gym_history_filter_v1', selectedGym); }, [selectedGym]);
  useEffect(() => { localStorage.setItem('gym_exercise_preferences_v1', JSON.stringify(exercisePreferences)); }, [exercisePreferences]);
  useEffect(() => {
    if ((view === 'analytics' || view === 'active') && notionAvailable) {
      fetchWorkoutAnalytics(currentAnalyticsGym);
    }
  }, [view, notionAvailable, currentAnalyticsGym]);

  useLayoutEffect(() => {
    if (view !== 'active' || !sessionId || !activeRoutine?.exercises?.length) return;
    persistCurrentSession();
  }, [view, sessionId, sessionStartedAt, activeRoutine, currentExerciseIndex, workoutLog, exerciseInputs, inputWeight, inputReps, currentNote, timerActive, targetEndTime]);

  useEffect(() => {
    const persist = () => {
      if (latestDraftRef.current) {
        try { saveSession(localStorage, latestDraftRef.current); } catch { /* The visible save error is handled during editing. */ }
      }
    };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', persist);
    return () => { window.removeEventListener('pagehide', persist); document.removeEventListener('visibilitychange', persist); };
  }, []);

  function persistCurrentSession() {
    if (!sessionId || !activeRoutine?.exercises[currentExerciseIndex]) return;
    const snapshot = {
      version: 1, id: sessionId, startedAt: sessionStartedAt, routine: activeRoutine,
      currentExerciseIndex, workoutLog,
      inputs: { ...exerciseInputs, [activeRoutine.exercises[currentExerciseIndex].id]: { weight: inputWeight, reps: inputReps, note: currentNote } },
      targetEndTime: timerActive ? targetEndTime : null
    };
    latestDraftRef.current = snapshot;
    try { saveSession(localStorage, snapshot); }
    catch { setNotice('Could not save progress on this phone. Please keep the app open and free some storage.'); setNoticeTone('error'); }
    setDraft(snapshot);
  }

  function resumeWorkout() {
    if (!draft) return;
    setConfirmDiscard(false);
    const index = Math.min(Math.max(draft.currentExerciseIndex || 0, 0), draft.routine.exercises.length - 1);
    const input = exerciseInput(draft.routine.exercises[index], draft.inputs, draft.workoutLog);
    setSessionId(draft.id); setSessionStartedAt(draft.startedAt); setActiveRoutine(draft.routine);
    setSelectedGym(gymName(draft.routine.gym));
    setCurrentExerciseIndex(index); setWorkoutLog(draft.workoutLog); setExerciseInputs(draft.inputs || {});
    setInputWeight(input.weight); setInputReps(input.reps); setCurrentNote(input.note || '');
    const remaining = Math.max(0, Math.ceil(((draft.targetEndTime || 0) - Date.now()) / 1000));
    setTimeLeft(remaining); setTimerActive(remaining > 0); setTargetEndTime(remaining ? draft.targetEndTime : null);
    setView('active');
  }

  function startWorkout(routine) {
    if (draft) {
      if (draft.routine.id === routine.id) resumeWorkout();
      else { setNotice(`Resume or discard ${draft.routine.name} before starting another routine.`); setNoticeTone('error'); }
      return;
    }
    const next = prepareRoutine(routine);
    const input = exerciseInput(next.exercises[0]);
    setSessionId(crypto.randomUUID()); setSessionStartedAt(new Date().toISOString()); setActiveRoutine(next);
    setSelectedGym(gymName(next.gym));
    setCurrentExerciseIndex(0); setWorkoutLog({}); setExerciseInputs({}); setInputWeight(input.weight); setInputReps(input.reps); setCurrentNote('');
    setTimerActive(false); setTargetEndTime(null); setAiFeedback(null); setCompletedWorkout(null);
    feedbackRequestRef.current += 1; setAiFeedbackLoading(false); setView('active');
  }

  function prepareRoutine(routine) {
    return { ...routine, gym: gymName(routine.gym), exercises: routine.exercises.map(exercise => {
      const guide = findExerciseGuide(exercise, notionExercises);
      const linked = guide ? { ...exercise, notionExerciseId: guide.id } : exercise;
      return { ...linked, ...exercisePreferences[preferenceKey(routine, linked)] };
    }) };
  }

  function discardWorkout() {
    localStorage.removeItem(DRAFT_KEY); latestDraftRef.current = null; setDraft(null); setSessionId(null);
    setConfirmDiscard(false);
    setWorkoutLog({}); setExerciseInputs({}); setTimerActive(false); setTargetEndTime(null);
  }

  function leaveWorkout(nextView = 'home') {
    if (isLogging) return;
    if (nextView === 'analytics' || nextView === 'history') setSelectedGym(gymName(activeRoutine.gym));
    persistCurrentSession(); setView(nextView);
  }

  function goToExercise(index) {
    if (isLogging) return;
    const inputs = { ...exerciseInputs, [activeRoutine.exercises[currentExerciseIndex].id]: { weight: inputWeight, reps: inputReps, note: currentNote } };
    const input = exerciseInput(activeRoutine.exercises[index], inputs, workoutLog);
    setExerciseInputs(inputs); setCurrentExerciseIndex(index); setInputWeight(input.weight); setInputReps(input.reps); setCurrentNote(input.note || '');
  }

  function logSet(exercise, unit) {
    if (isLogging) return;
    const set = { id: crypto.randomUUID(), w: parseFloat(inputWeight) || 0, r: parseInt(inputReps, 10) || 0, weightUnit: unit, note: currentNote };
    setWorkoutLog(log => ({ ...log, [exercise.id]: [...(log[exercise.id] || []), set] }));
    setExercisePreferences(previous => ({ ...previous, [preferenceKey(activeRoutine, exercise)]: { suggestedWeight: set.w, weightUnit: unit } }));
    setCurrentNote(''); startTimer(exercise.defaultPause);
  }

  async function fetchExercisesFromNotion() {
    if (!notionAvailable) return;
    setSyncStatus('syncing');
    try {
      const response = await fetch('/api/exercises');
      const data = await readJson(response);
      const fetched = data.exercises || [];
      setNotionExercises(fetched);
      localStorage.setItem('notion_exercises_cache', JSON.stringify(fetched));
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (error) {
      setSyncStatus('error');
      setNotice(error.message || 'Could not sync exercise library.');
      setNoticeTone('error');
    }
  }

  async function fetchRoutinesFromNotion() {
    if (!notionAvailable) return;
    try {
      const response = await fetch('/api/routines');
      const data = await readJson(response);
      const fetched = data.routines || [];
      if (fetched.length) {
        setRoutines(prev => {
          const notionIds = new Set(fetched.map(routine => routine.id));
          const localOnly = prev.filter(routine => !notionIds.has(routine.id));
          return [...fetched, ...localOnly];
        });
      }
    } catch (error) {
      setNotice(error.message || 'Could not load synced routines.');
      setNoticeTone('error');
    }
  }

  async function fetchAIFeedback(workoutPayload) {
    if (aiFeedbackLoading || !workoutPayload) return;
    const requestId = ++feedbackRequestRef.current;
    setAiFeedbackLoading(true);
    setAiFeedback(null);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workout: workoutPayload,
          profile: {
            experience_level: userProfile.experienceLevel,
            bodyweight: parseFloat(userProfile.bodyweight) || 75,
            goal: userProfile.goal,
            weekly_split: userProfile.weeklySplit
          }
        })
      });
      const data = await readJson(response);
      if (requestId !== feedbackRequestRef.current) return;
      setAiFeedback(data.feedback || 'No feedback available.');
      setView(current => current === 'success' ? 'feedback' : current);
    } catch (error) {
      if (requestId !== feedbackRequestRef.current) return;
      setAiFeedback(null);
      setNotice(error.message || 'Could not generate AI feedback.');
      setNoticeTone('error');
    }
    if (requestId === feedbackRequestRef.current) setAiFeedbackLoading(false);
  }

  async function fetchWorkoutAnalytics(gym = currentAnalyticsGym) {
    if (!notionAvailable) return;
    const request = ++analyticsRequestRef.current;
    setAnalyticsLoading(true);
    try {
      const response = await fetch(`/api/workouts?limit=200&gym=${encodeURIComponent(gym)}`);
      const data = await readJson(response);
      if (request !== analyticsRequestRef.current) return;
      const workouts = data.workouts || [];
      setAnalyticsWorkouts(workouts);
      setAnalyticsGym(gym);
      const entries = buildExerciseAnalytics(workouts, getExerciseUnits(routines, gym));
      if (entries.length && !entries.some(entry => entry.exerciseName === selectedExercise)) {
        setSelectedExercise(entries[0].exerciseName);
      }
      setNotice(null);
    } catch (error) {
      if (request !== analyticsRequestRef.current) return;
      setAnalyticsWorkouts([]); setAnalyticsGym(gym);
      setNotice(error.message || 'Could not load analytics data.');
      setNoticeTone('error');
    } finally {
      if (request === analyticsRequestRef.current) setAnalyticsLoading(false);
    }
  }

  async function pushToNotionLog() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLogging(true);
    try {
      persistCurrentSession();
      const today = sessionDate(sessionStartedAt || Date.now());
      const workoutPayload = buildFeedbackWorkout(activeRoutine, workoutLog, today);

      if (notionAvailable) {
        const response = await fetch('/api/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routine: activeRoutine,
            sessionId,
            workoutLog,
            date: today
          })
        });
        await readJson(response);
        setNotice('Workout synced to Notion.');
        setNoticeTone('success');
      } else {
        throw new Error('Your workout is saved on this phone. Reconnect, then try finishing again.');
      }

      setHistory(prev => [{ id: sessionId, date: today, routineName: activeRoutine.name, gym: gymName(activeRoutine.gym), summary: 'Synced' }, ...prev.filter(item => item.id !== sessionId)]);
      localStorage.removeItem(DRAFT_KEY); latestDraftRef.current = null; setDraft(null); setSessionId(null);
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      setSuccessMessage(MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)]);
      setCompletedWorkout(workoutPayload);
      setAiFeedback(null);
      setTimerActive(false);
      setTargetEndTime(null);
      setAnalyticsWorkouts([]);
      setView('success');
    } catch (error) {
      setNotice(error.message || 'Could not save workout log.');
      setNoticeTone('error');
    } finally {
      submittingRef.current = false;
      setIsLogging(false);
    }
  }

  async function saveRoutineToNotion(routine) {
    if (!notionAvailable) return routine;
    try {
      const response = await fetch('/api/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routine })
      });
      const data = await readJson(response);
      setNotice('Routine saved.');
      setNoticeTone('success');
      return data.routine || routine;
    } catch (error) {
      setNotice(`Routine saved locally. Notion sync failed: ${error.message || 'Please try again.'}`);
      setNoticeTone('error');
      return routine;
    }
  }

  async function saveRoutine() {
    setIsSaving(true);
    try {
      let routineToSave = {
        ...activeRoutine,
        exercises: activeRoutine.exercises.map(exercise => {
          const guide = findExerciseGuide(exercise, notionExercises);
          return guide ? { ...exercise, notionExerciseId: guide.id } : exercise;
        })
      };
      if (notionAvailable) {
        routineToSave = await saveRoutineToNotion(routineToSave);
      } else {
        setNotice('Routine saved locally.');
        setNoticeTone('success');
      }

      setRoutines(prev => prev.find(routine => routine.id === routineToSave.id)
        ? prev.map(routine => routine.id === routineToSave.id ? routineToSave : routine)
        : [...prev, routineToSave]
      );
      setExercisePreferences(previous => ({ ...previous, ...Object.fromEntries(routineToSave.exercises.map(exercise => [preferenceKey(routineToSave, exercise), { suggestedWeight: exercise.suggestedWeight, weightUnit: weightUnit(exercise.weightUnit) }])) }));
      setView('home');
    } finally {
      setIsSaving(false);
    }
  }

  function updateExercise(index, changes) {
    setActiveRoutine(routine => ({
      ...routine,
      exercises: routine.exercises.map((exercise, position) => position === index ? { ...exercise, ...changes } : exercise)
    }));
  }

  async function changeWeightUnit(index, nextUnit, persist = false) {
    const exercise = activeRoutine.exercises[index];
    const previousUnit = weightUnit(exercise.weightUnit);
    if (previousUnit === nextUnit || isSavingUnit) return;
    const nextRoutine = changeRoutineUnit(activeRoutine, index, nextUnit);
    setActiveRoutine(nextRoutine);
    if (!persist) return;
    setExercisePreferences(previous => ({ ...previous, [preferenceKey(activeRoutine, exercise)]: { suggestedWeight: parseFloat(inputWeight) || 0, weightUnit: nextUnit } }));
    setRoutines(previous => previous.map(routine => routine.id === nextRoutine.id ? nextRoutine : routine));
    setIsSavingUnit(true);
    try {
      const saved = await saveRoutineToNotion(nextRoutine);
      // Only merge the page ID: a later edit may already have changed the routine.
      if (saved.notionPageId) {
        setRoutines(previous => previous.map(routine => routine.id === saved.id ? { ...routine, notionPageId: saved.notionPageId } : routine));
        setActiveRoutine(previous => previous?.id === saved.id ? { ...previous, notionPageId: saved.notionPageId } : previous);
      }
    } finally {
      setIsSavingUnit(false);
    }
  }

  function startTimer(seconds) {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } else if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch (error) {
      // ignore audio initialization failures
    }
    setTargetEndTime(Date.now() + (seconds * 1000));
    setTimeLeft(seconds);
    setTimerActive(true);
  }

  useEffect(() => {
    if (timerActive && targetEndTime) {
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0) {
          setTimerActive(false);
          setTargetEndTime(null);
          try {
            const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
            const playBeep = () => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.frequency.value = 880;
              osc.connect(gain);
              gain.connect(ctx.destination);
              gain.gain.setValueAtTime(0.4, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.8);
            };
            if (ctx.state === 'suspended') {
              ctx.resume().then(playBeep).catch(() => {});
            } else {
              playBeep();
            }
          } catch (error) {
            // ignore audio playback failures
          }
        }
      }, 500);
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive, targetEndTime]);

  if (view === 'settings') {
    return (
      <div className="min-h-screen bg-[#131314]">
        <Header title="Settings" sub="Pulse Engine" leftAction={<button onClick={() => setView('home')} className="p-2 -ml-2"><Icons.ChevronLeft /></button>} notionAvailable={notionAvailable} setView={setView} />
        {notice && <Notice message={notice} tone={noticeTone} />}
        <main className="p-6 space-y-6">
          <div className="p-6 dark-card space-y-2">
            <p className="text-[10px] font-black text-zinc-500 uppercase">Notion</p>
            <p className="text-sm text-[#9e9e9e]">Set <span className="text-[#8ab4f8] font-mono">NOTION_API_KEY</span>, <span className="text-[#8ab4f8] font-mono">EXERCISE_DB_ID</span>, <span className="text-[#8ab4f8] font-mono">ROUTINE_DB_ID</span>, <span className="text-[#8ab4f8] font-mono">LOG_DB_ID</span>, and <span className="text-[#8ab4f8] font-mono">OPENAI_API_KEY</span> in Vercel env vars.</p>
          </div>
          <button disabled={!notionAvailable} onClick={fetchExercisesFromNotion} className="w-full py-5 bg-[#8ab4f8] text-black rounded-[24px] font-bold disabled:opacity-50">Sync Notion Library</button>
          <div className="p-6 dark-card space-y-4">
            <p className="text-[10px] font-black text-zinc-500 uppercase">Your Profile</p>
            <div><label className="text-[10px] font-black text-zinc-500 uppercase block mb-1">Bodyweight (kg)</label><input type="number" value={userProfile.bodyweight} onChange={event => setUserProfile(profile => ({ ...profile, bodyweight: event.target.value }))} className="w-full bg-[#131314] border border-[#3c4043] rounded-xl text-[#8ab4f8] font-bold text-sm p-3 outline-none" /></div>
            <div><label className="text-[10px] font-black text-zinc-500 uppercase block mb-1">Experience</label><select value={userProfile.experienceLevel} onChange={event => setUserProfile(profile => ({ ...profile, experienceLevel: event.target.value }))} className="w-full bg-[#131314] border border-[#3c4043] rounded-xl text-[#8ab4f8] font-bold text-sm p-3 outline-none"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>
            <div><label className="text-[10px] font-black text-zinc-500 uppercase block mb-1">Goal</label><select value={userProfile.goal} onChange={event => setUserProfile(profile => ({ ...profile, goal: event.target.value }))} className="w-full bg-[#131314] border border-[#3c4043] rounded-xl text-[#8ab4f8] font-bold text-sm p-3 outline-none"><option value="hypertrophy">Hypertrophy</option><option value="strength">Strength</option><option value="endurance">Endurance</option></select></div>
            <div><label className="text-[10px] font-black text-zinc-500 uppercase block mb-1">Weekly Split</label><input type="text" value={userProfile.weeklySplit} onChange={event => setUserProfile(profile => ({ ...profile, weeklySplit: event.target.value }))} placeholder="e.g. Push Pull Legs" className="w-full bg-[#131314] border border-[#3c4043] rounded-xl text-[#8ab4f8] font-bold text-sm p-3 outline-none" /></div>
          </div>
        </main>
      </div>
    );
  }

  if (view === 'home') {
    return (
      <div className="min-h-screen bg-[#131314]">
        <Header title="Training" sub={notionAvailable ? 'Synced' : 'Local Only'} notionAvailable={notionAvailable} setView={setView} />
        {notice && <Notice message={notice} tone={noticeTone} />}
        <main className="p-6 space-y-4 pb-32">
          {draft && <section className="session-resume-card" aria-label="Workout in progress">
            <div><p className="session-status">In progress</p><h2>{draft.routine.name}</h2><p>{gymName(draft.routine.gym)} · {sessionSetCount(draft)} {sessionSetCount(draft) === 1 ? 'set' : 'sets'} logged</p></div>
            {confirmDiscard ? <>
              <p className="session-discard-warning">Discard all unfinished sets and notes in {draft.routine.name}?</p>
              <button type="button" className="session-resume-button" onClick={() => setConfirmDiscard(false)}>Keep workout</button>
              <button type="button" className="session-discard-button session-discard-confirm" onClick={discardWorkout}>Discard progress</button>
            </> : <>
              <button type="button" className="session-resume-button" onClick={resumeWorkout}>Resume workout</button>
              <button type="button" className="session-discard-button" onClick={() => setConfirmDiscard(true)}>Discard workout</button>
            </>}
          </section>}
          {routines.map(routine => (
            <div key={routine.id} className={`p-5 dark-card flex items-center justify-between gap-3 ${draft?.routine.id === routine.id ? 'routine-in-progress' : ''}`}>
              <div className="flex-1">
                <h3 className="text-lg font-bold">{routine.name}</h3>
                <p className="text-[10px] text-[#9e9e9e] font-bold uppercase">{(routine.exercises || []).length} Exercises</p>
                <p className="routine-gym">{gymName(routine.gym)}{draft?.routine.id === routine.id ? ' · In progress' : ''}</p>
              </div>
              <div className="flex gap-2">
                <button aria-label={`Edit ${routine.name}`} onClick={() => { setActiveRoutine(prepareRoutine(routine)); setView('planner'); }} className="px-3 py-2 text-sm font-bold text-[#8ab4f8] rounded-xl border border-[#3c4043]">Edit</button>
                <button aria-label={`${draft?.routine.id === routine.id ? 'Resume' : 'Start'} ${routine.name}`} disabled={!routine.exercises?.length} onClick={() => startWorkout(routine)} className="w-12 h-12 shrink-0 bg-[#8ab4f8] text-black rounded-[20px] flex items-center justify-center disabled:opacity-50"><Icons.Play /></button>
              </div>
            </div>
          ))}
          <button onClick={() => { setActiveRoutine({ id: Date.now(), name: 'New Session', exercises: [] }); setView('planner'); }} className="w-full py-10 border-2 border-dashed border-[#3c4043] rounded-[32px] flex flex-col items-center gap-2 text-[#9e9e9e]"><Icons.Plus /><span>Create Routine</span></button>
        </main>
      </div>
    );
  }

  if (view === 'planner') {
    return (
      <div className="min-h-screen bg-[#131314] pb-48">
        {guideExercise && <ExerciseGuide exercise={guideExercise} library={notionExercises} notionAvailable={notionAvailable} onClose={() => setGuideExercise(null)} />}
        <Header title="Planner" sub="Protocol Editor" leftAction={<button onClick={() => setView('home')} className="p-2 -ml-2"><Icons.ChevronLeft /></button>} rightAction={<button onClick={() => setShowConfirmDelete(!showConfirmDelete)} className="p-3 bg-[#28292c] rounded-full"><Icons.Trash /></button>} notionAvailable={notionAvailable} setView={setView} />
        {notice && <Notice message={notice} tone={noticeTone} />}
        <main className="p-6 space-y-6">
          {showConfirmDelete && <div className="p-5 bg-red-900/20 border border-red-900 rounded-2xl"><button onClick={() => { setRoutines(routines.filter(routine => routine.id !== activeRoutine.id)); setView('home'); }} className="w-full bg-red-600 py-3 rounded-xl font-bold">DELETE</button></div>}
          <input value={activeRoutine.name} onChange={event => setActiveRoutine({ ...activeRoutine, name: event.target.value })} className="text-3xl font-bold bg-transparent w-full text-white italic outline-none" />
          <label className="gym-field">Gym
            <input aria-label="Gym for this routine" list="gym-options" value={activeRoutine.gym ?? PREVIOUS_GYM} onChange={event => setActiveRoutine({ ...activeRoutine, gym: event.target.value })} />
            <datalist id="gym-options">{[...new Set([PREVIOUS_GYM, '24h Fitness Ocean', ...routines.map(routine => gymName(routine.gym))])].map(gym => <option key={gym} value={gym} />)}</datalist>
          </label>
          <p className="text-sm text-[#9e9e9e]">Use ↑ and ↓ to reorder exercises, then Save Protocol.</p>
          <div className="flex flex-wrap gap-2">
            {[...notionExercises].sort((left, right) => (left.tag || '').localeCompare(right.tag || '')).map(exercise => (
              <div key={exercise.id} className="exercise-library-chip">
                <button type="button" aria-label={`Add ${exercise.name}`} onClick={() => setActiveRoutine({ ...activeRoutine, exercises: [...activeRoutine.exercises, { id: Math.random(), notionExerciseId: exercise.id, name: exercise.name, defaultPause: exercise.pause, targetSets: exercise.sets, suggestedWeight: exercise.weight, targetReps: 10, weightUnit: weightUnit(exercise.weightUnit) }] })}><span className="exercise-library-tag">{exercise.tag}</span><span>{exercise.name}</span></button>
                <ExerciseInfoButton exercise={exercise} onClick={() => setGuideExercise(exercise)} />
              </div>
            ))}
          </div>
          {activeRoutine.exercises.map((exercise, index) => (
            <div key={exercise.id} className="p-5 dark-card space-y-4">
              <div className="planner-exercise-heading">
                <div className="planner-exercise-name">
                  <input value={exercise.name} onChange={event => updateExercise(index, { name: event.target.value })} aria-label={`Exercise ${index + 1} name`} className="font-bold bg-transparent outline-none w-full min-w-0" />
                  <ExerciseInfoButton exercise={exercise} onClick={() => setGuideExercise(exercise)} />
                </div>
                <div className="flex items-center shrink-0 gap-1 ml-2">
                  <button type="button" aria-label={`Move ${exercise.name} up`} title="Move up" disabled={index === 0}
                    onClick={() => setActiveRoutine(routine => ({ ...routine, exercises: moveExercise(routine.exercises, index, -1) }))} className="reorder-button">↑</button>
                  <button type="button" aria-label={`Move ${exercise.name} down`} title="Move down" disabled={index === activeRoutine.exercises.length - 1}
                    onClick={() => setActiveRoutine(routine => ({ ...routine, exercises: moveExercise(routine.exercises, index, 1) }))} className="reorder-button">↓</button>
                  <button aria-label={`Remove ${exercise.name}`} onClick={() => setActiveRoutine(routine => ({ ...routine, exercises: routine.exercises.filter((_, position) => position !== index) }))} className="p-2 text-[#9e9e9e]"><Icons.Trash /></button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-black text-zinc-500 uppercase">Weight unit</span>
                <WeightUnitToggle value={exercise.weightUnit} onChange={unit => changeWeightUnit(index, unit)} label={`Weight unit for ${exercise.name}`} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase block">Sets</label>
                  <input type="number" value={exercise.targetSets} onChange={event => updateExercise(index, { targetSets: parseFloat(event.target.value) || 0 })} className="planner-input" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase block">Reps</label>
                  <input type="number" value={exercise.targetReps} onChange={event => updateExercise(index, { targetReps: parseFloat(event.target.value) || 0 })} className="planner-input" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase block">{weightUnit(exercise.weightUnit)}</label>
                  <input type="number" value={exercise.suggestedWeight} onChange={event => updateExercise(index, { suggestedWeight: parseFloat(event.target.value) || 0 })} className="planner-input" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase block">Rest</label>
                  <input type="number" value={exercise.defaultPause} onChange={event => updateExercise(index, { defaultPause: parseFloat(event.target.value) || 0 })} className="planner-input" />
                </div>
              </div>
            </div>
          ))}
        </main>
        <footer className="fixed bottom-0 left-0 right-0 p-6 bg-[#131314] border-t border-[#28292c]"><button onClick={saveRoutine} disabled={isSaving} className="w-full py-5 bg-[#8ab4f8] text-black rounded-[24px] font-bold disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Protocol'}</button></footer>
      </div>
    );
  }

  if (view === 'active') {
    const exercise = activeRoutine.exercises[currentExerciseIndex];
    const logged = workoutLog[exercise.id] || [];
    const exerciseEntries = buildExerciseAnalytics(analyticsGym === gymName(activeRoutine.gym) ? analyticsWorkouts : [], getExerciseUnits(routines, gymName(activeRoutine.gym)));
    const activeEntry = exerciseEntries.find(entry => entry.exerciseName.toLowerCase() === exercise.name.toLowerCase()) || null;
    const unit = weightUnit(exercise.weightUnit);
    const historicalPoints = (activeEntry?.points || []).map(point => ({ ...point, weight: convertWeight(point.weight, point.weightUnit, unit), weightUnit: unit }));
    const playModePoints = mergeLiveExercisePoints(historicalPoints, logged, exercise.name, unit);

    return (
      <div className="min-h-screen bg-[#131314]">
        {guideExercise && <ExerciseGuide exercise={guideExercise} library={notionExercises} notionAvailable={notionAvailable} onClose={() => setGuideExercise(null)} />}
        <Header title={exercise.name} sub={`Step ${currentExerciseIndex + 1} of ${activeRoutine.exercises.length}`} notionAvailable={notionAvailable} setView={leaveWorkout} />
        {notice && <Notice message={notice} tone={noticeTone} />}
        <div className="h-1 bg-[#28292c]"><div className="h-1 bg-[#8ab4f8] transition-all duration-300" style={{ width: `${((currentExerciseIndex + 1) / activeRoutine.exercises.length) * 100}%` }}></div></div>
        <main className="workout-main">
          <div className="workout-guide-access workout-gym-row">
            <span className="routine-gym">{gymName(activeRoutine.gym)}</span>
            <ExerciseInfoButton exercise={exercise} onClick={() => setGuideExercise(exercise)} />
          </div>
          <div className="workout-values">
            <div className="workout-value-column">
              <div className="workout-value-card dark-card">
                <span className="workout-value-label">Load</span>
                <input type="text" inputMode="decimal" aria-label={`Weight in ${unit}`} style={{ fontSize: `min(48px, calc(100cqw / ${Math.max(String(inputWeight).length, 4) * 0.65}))` }} value={inputWeight} onChange={event => setInputWeight(event.target.value)} className="workout-value-input" />
                <div className="workout-value-unit">
                  <WeightUnitToggle value={unit} disabled={isSavingUnit} onChange={nextUnit => changeWeightUnit(currentExerciseIndex, nextUnit, true)} label={`Weight unit for ${exercise.name}`} />
                </div>
              </div>
              <div className="workout-adjustments">
                <button onClick={() => setInputWeight(prev => Math.max(0, parseFloat(prev) - 5))}>-5</button>
                <button onClick={() => setInputWeight(prev => Math.max(0, parseFloat(prev) - 2.5))}>-2.5</button>
                <button onClick={() => setInputWeight(prev => parseFloat(prev) + 2.5)}>+2.5</button>
                <button onClick={() => setInputWeight(prev => parseFloat(prev) + 5)}>+5</button>
              </div>
            </div>
            <div className="workout-value-column">
              <div className="workout-value-card dark-card">
                <span className="workout-value-label">Reps</span>
                <input type="number" aria-label="Reps" value={inputReps} onChange={event => setInputReps(event.target.value)} style={{ fontSize: `min(48px, calc(100cqw / ${Math.max(String(inputReps).length, 4) * 0.65}))` }} className="workout-value-input" />
                <span className="workout-value-unit workout-reps-unit">reps</span>
              </div>
              <div className="workout-adjustments">
                <button onClick={() => setInputReps(prev => Math.max(0, parseInt(prev, 10) - 1))}>-1</button>
                <button onClick={() => setInputReps(prev => parseInt(prev, 10) + 1)}>+1</button>
              </div>
            </div>
          </div>
          {notionAvailable && analyticsLoading && !playModePoints.length && (
            <div className="analytics-panel p-5 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-[#8ab4f8]/40 border-t-[#8ab4f8] rounded-full animate-spin"></div>
              <p className="text-sm text-[#9aa0a6]">Loading exercise trend...</p>
            </div>
          )}
          {notionAvailable && playModePoints.length > 0 && (
            <AnalyticsChart
              points={playModePoints}
              compact
              subtitle={logged.length ? 'Live session sets are appended on the right.' : 'Weight and reps across prior sessions.'}
            />
          )}
          <section className="workout-set-entry" aria-label="Record a set">
            <button disabled={isLogging} onClick={() => logSet(exercise, unit)} className="w-full py-7 bg-white text-black rounded-[28px] font-black text-xl italic disabled:opacity-50">Log Set {logged.length + 1} / {exercise.targetSets}</button>
            {logged.length > 0 && <div className="flex flex-wrap gap-2">{logged.map((set, index) => <div key={index} className="px-4 py-2 bg-[#8ab4f8]/10 text-[#8ab4f8] rounded-xl text-[10px] font-black">SET {index + 1}: {set.w} {weightUnit(set.weightUnit)} × {set.r}</div>)}</div>}
            <div className="workout-note">
              <label htmlFor="workout-set-note" className="text-[10px] font-black text-zinc-500 uppercase">Note for Set {logged.length + 1}</label>
              <textarea id="workout-set-note" value={currentNote} onChange={event => setCurrentNote(event.target.value)} placeholder="How did it feel? Any adjustments..." rows={2} className="w-full bg-[#1e1f20] border border-[#3c4043] rounded-2xl p-4 text-sm text-[#e3e3e3] outline-none resize-none placeholder-[#3c4043] focus:border-[#8ab4f8]/40" />
            </div>
          </section>
        </main>
        {timerActive && (
          <div className="fixed bottom-[6.5rem] left-4 right-4 z-40 flex items-center gap-4 px-5 py-4 rounded-2xl shadow-2xl" style={{ background: 'linear-gradient(135deg, #ff6b35, #f7931e)' }}>
            <div className="flex flex-col">
              <span className="text-white/70 text-[9px] font-black uppercase tracking-widest">Recovery</span>
              <span className="text-white font-black text-4xl leading-none tabular-nums timer-animate">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => { setTargetEndTime(prev => Math.max(Date.now() + 500, prev - 15000)); }} className="py-2 px-3 bg-white/20 border border-white/30 text-white rounded-xl font-black text-sm">-15s</button>
              <button onClick={() => { setTimerActive(false); setTargetEndTime(null); }} className="py-2 px-4 bg-white text-[#f7931e] rounded-xl font-black text-sm">Skip</button>
            </div>
          </div>
        )}
        <footer className="fixed bottom-0 left-0 right-0 p-6 bg-[#131314] border-t border-[#28292c] flex gap-4">
          <button aria-label={currentExerciseIndex === 0 ? 'Back to overview' : 'Previous exercise'} disabled={isLogging} onClick={() => currentExerciseIndex === 0 ? leaveWorkout() : goToExercise(currentExerciseIndex - 1)} className="p-5 bg-[#28292c] rounded-2xl"><Icons.ChevronLeft /></button>
          <button disabled={isLogging} onClick={() => currentExerciseIndex === activeRoutine.exercises.length - 1 ? pushToNotionLog() : goToExercise(currentExerciseIndex + 1)} className="flex-1 bg-[#8ab4f8] text-black rounded-[24px] font-bold italic">{isLogging ? 'Syncing...' : (currentExerciseIndex === activeRoutine.exercises.length - 1 ? 'End Session' : 'Next Move')}</button>
        </footer>
      </div>
    );
  }

  if (view === 'success') {
    return (
      <div className="min-h-screen bg-[#131314] flex flex-col items-center justify-center p-10 space-y-8">
        {notice && <Notice message={notice} tone={noticeTone} />}
        <div className="text-8xl animate-bounce">💪</div>
        <h2 className="text-5xl font-black italic uppercase">Complete</h2>
        <p className="text-xl italic text-center text-[#8ab4f8]">"{successMessage}"</p>
        {aiFeedbackLoading && (
          <div className="flex items-center gap-3 text-[#9e9e9e] text-sm">
            <div className="w-4 h-4 border-2 border-[#9e9e9e] border-t-transparent rounded-full animate-spin"></div>
            Analyzing your workout...
          </div>
        )}
        <button disabled={aiFeedbackLoading || !completedWorkout} onClick={async () => {
          if (aiFeedback) { setView('feedback'); return; }
          await fetchAIFeedback(completedWorkout);
        }} className="w-full py-5 bg-[#1e1f20] border border-[#8ab4f8]/40 text-[#8ab4f8] rounded-[24px] font-bold disabled:opacity-50">
          {aiFeedbackLoading ? 'Analyzing...' : aiFeedback ? 'View AI Feedback' : 'Get AI Feedback'}
        </button>
        <button onClick={() => setView('home')} className="w-full py-6 bg-white text-black rounded-3xl font-black italic">Return Home</button>
      </div>
    );
  }

  if (view === 'feedback') {
    const renderLine = (line, index) => {
      const isBullet = /^[\s]*[-•]\s/.test(line);
      const text = line.replace(/^[\s\-•]+/, '').trim();
      if (!text) return null;
      if (isBullet) {
        return (
          <div key={index} className="flex gap-3 items-start">
            <span className="text-[#8ab4f8] flex-shrink-0 mt-0.5">●</span>
            <span className="text-[#e3e3e3] text-sm leading-relaxed">{parseFeedbackText(text, `feedback-bullet-${index}`)}</span>
          </div>
        );
      }

      return <p key={index} className="text-[#9e9e9e] text-[10px] font-black uppercase tracking-widest pt-4 first:pt-0">{parseFeedbackText(text, `feedback-label-${index}`)}</p>;
    };

    return (
      <div className="min-h-screen bg-[#131314]">
        <Header title="AI Feedback" sub="Coach Analysis" leftAction={<button onClick={() => setView('success')} className="p-2 -ml-2"><Icons.ChevronLeft /></button>} notionAvailable={notionAvailable} setView={setView} />
        {notice && <Notice message={notice} tone={noticeTone} />}
        <main className="p-6 space-y-2 pb-28">
          {(aiFeedback || '').split('\n').map((line, index) => renderLine(line, index)).filter(Boolean)}
        </main>
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-[#131314] border-t border-[#28292c]">
          <button onClick={() => setView('home')} className="w-full py-5 bg-white text-black rounded-[24px] font-black italic">Return Home</button>
        </div>
      </div>
    );
  }

  if (view === 'analytics') {
    const exerciseEntries = buildExerciseAnalytics(analyticsGym === selectedGym ? analyticsWorkouts : [], getExerciseUnits(routines, selectedGym));
    const activeEntry = exerciseEntries.find(entry => entry.exerciseName === selectedExercise) || exerciseEntries[0] || null;
    const latestPoint = activeEntry?.latestPoint || null;
    const previousPoint = activeEntry?.previousPoint || null;
    const unit = weightUnit(activeEntry?.weightUnit);
    const weightDelta = latestPoint && previousPoint ? Math.round((latestPoint.weight - previousPoint.weight) * 100) / 100 : null;
    const repsDelta = latestPoint && previousPoint ? (latestPoint.reps - previousPoint.reps) : null;

    return (
      <div className="min-h-screen bg-[#131314]">
        <Header title="Analytics" sub="Signal Layer" leftAction={<button onClick={() => setView('home')} className="p-2 -ml-2"><Icons.ChevronLeft /></button>} rightAction={<button onClick={() => fetchWorkoutAnalytics(selectedGym)} disabled={!notionAvailable || analyticsLoading} className="px-4 py-3 bg-[#28292c] text-[#9e9e9e] rounded-full text-xs font-black uppercase tracking-[0.2em] disabled:opacity-50">{analyticsLoading ? 'Syncing' : 'Refresh'}</button>} notionAvailable={notionAvailable} setView={setView} />
        {notice && <Notice message={notice} tone={noticeTone} />}
        <main className="p-6 space-y-5 pb-20">
          <label className="gym-field">Gym history
            <select aria-label="Gym history" value={selectedGym} onChange={event => setSelectedGym(event.target.value)}>
              {[...new Set([PREVIOUS_GYM, '24h Fitness Ocean', ...routines.map(routine => gymName(routine.gym))])].map(gym => <option key={gym} value={gym}>{gym}</option>)}
            </select>
          </label>
          {!notionAvailable && (
            <div className="analytics-panel p-6 space-y-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#6f747b] font-black">Notion Required</p>
              <p className="text-sm text-[#9aa0a6]">Analytics reads from your synced workout log database, so this section becomes active once Notion is configured on Vercel.</p>
            </div>
          )}

          {notionAvailable && analyticsLoading && !analyticsWorkouts.length && (
            <div className="analytics-panel p-8 text-center space-y-3">
              <div className="w-8 h-8 mx-auto border-2 border-[#8ab4f8]/40 border-t-[#8ab4f8] rounded-full animate-spin"></div>
              <p className="text-sm text-[#9aa0a6]">Collecting your latest workout sets...</p>
            </div>
          )}

          {notionAvailable && !analyticsLoading && !exerciseEntries.length && (
            <div className="analytics-panel p-8 text-center space-y-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#6f747b] font-black">No Signals Yet</p>
              <p className="text-sm text-[#9aa0a6]">No logged sets for {selectedGym} yet. Your other gym’s history is kept separately.</p>
            </div>
          )}

          {activeEntry && (
            <>
              <div className="analytics-panel p-4">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-[#6f747b] font-black">Exercise Stream</p>
                    <h2 className="text-2xl font-black italic">{activeEntry.exerciseName}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-[#6f747b] font-black">Tracked Sets</p>
                    <p className="text-xl font-black text-[#8ab4f8]">{activeEntry.points.length}</p>
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {exerciseEntries.map(entry => (
                    <button
                      key={entry.exerciseName}
                      onClick={() => setSelectedExercise(entry.exerciseName)}
                      className={`shrink-0 px-4 py-2 rounded-full border text-sm transition-all ${entry.exerciseName === activeEntry.exerciseName ? 'bg-[#8ab4f8] text-black border-[#8ab4f8] shadow-[0_0_30px_rgba(138,180,248,0.22)]' : 'bg-[#17181a] text-[#9aa0a6] border-[#2a2c31]'}`}
                    >
                      {entry.exerciseName}
                    </button>
                  ))}
                </div>
              </div>

              <AnalyticsChart points={activeEntry.points} />

              <div className="grid grid-cols-2 gap-3">
                <div className="analytics-panel p-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#6f747b] font-black">Latest Set</p>
                  <p className="mt-3 text-2xl font-black text-white">{latestPoint ? `${latestPoint.weight} ${unit}` : '--'}</p>
                  <p className="text-sm text-[#9aa0a6]">{latestPoint ? `${latestPoint.reps} reps on ${formatChartDate(latestPoint.date)}` : 'No data yet'}</p>
                  {weightDelta !== null && repsDelta !== null && (
                    <p className={`mt-3 text-xs font-bold ${weightDelta > 0 || repsDelta > 0 ? 'text-[#7ef0c7]' : 'text-[#9aa0a6]'}`}>
                      {`${weightDelta >= 0 ? '+' : ''}${weightDelta} ${unit} / ${repsDelta >= 0 ? '+' : ''}${repsDelta} reps vs previous set`}
                    </p>
                  )}
                </div>
                <div className="analytics-panel p-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#6f747b] font-black">Best Envelope</p>
                  <p className="mt-3 text-2xl font-black text-white">{activeEntry.maxWeight} {unit}</p>
                  <p className="text-sm text-[#9aa0a6]">Peak load, with a rep ceiling of {activeEntry.maxReps}</p>
                  <p className="mt-3 text-xs font-bold text-[#8ab4f8]">{activeEntry.sessionCount} logged sessions</p>
                </div>
                <div className="analytics-panel p-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#6f747b] font-black">Volume Flow</p>
                  <p className="mt-3 text-2xl font-black text-white">{activeEntry.totalVolume}</p>
                  <p className="text-sm text-[#9aa0a6]">Total {unit}-reps accumulated for this exercise</p>
                </div>
                <div className="analytics-panel p-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#6f747b] font-black">Cadence</p>
                  <p className="mt-3 text-2xl font-black text-white">{activeEntry.averageGapDays ?? '--'}</p>
                  <p className="text-sm text-[#9aa0a6]">{activeEntry.averageGapDays !== null ? 'Average days between sessions' : 'Need more than one session to estimate gaps'}</p>
                </div>
              </div>

              {latestPoint?.notes && (
                <div className="analytics-panel p-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#6f747b] font-black">Latest Note</p>
                  <p className="mt-3 text-sm leading-relaxed text-[#d5dae0]">{latestPoint.notes}</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  if (view === 'history') {
    return (
      <div className="min-h-screen bg-[#131314]">
        <Header title="Vault" sub="Archives" leftAction={<button onClick={() => setView('home')} className="p-2 -ml-2"><Icons.ChevronLeft /></button>} notionAvailable={notionAvailable} setView={setView} />
        {notice && <Notice message={notice} tone={noticeTone} />}
        <main className="p-6 space-y-4">
          <label className="gym-field">Gym history
            <select aria-label="Gym history" value={selectedGym} onChange={event => setSelectedGym(event.target.value)}>
              {[...new Set([PREVIOUS_GYM, '24h Fitness Ocean', ...routines.map(routine => gymName(routine.gym)), ...history.map(item => gymName(item.gym))])].map(gym => <option key={gym} value={gym}>{gym}</option>)}
            </select>
          </label>
          {history.filter(item => gymName(item.gym) === selectedGym).map(item => <div key={item.id} className="p-5 dark-card"><h4>{item.routineName}</h4><p className="routine-gym">{gymName(item.gym)}</p><p className="text-[10px] text-zinc-500">{item.date}</p></div>)}
          {!history.some(item => gymName(item.gym) === selectedGym) && <p className="text-sm text-[#9aa0a6]">No completed workouts here yet.</p>}
        </main>
      </div>
    );
  }

  return null;
}
