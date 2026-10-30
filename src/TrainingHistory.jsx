import React, { useId, useState } from 'react';
import { byName, exerciseHistoryMachines, equipmentHistory } from './equipment.mjs';
import { journalSets, journalDays } from './workoutJournal.mjs';
import EquipmentProgress from './EquipmentProgress.jsx';

function Filter({ label, children }) {
  const id = useId();
  return <div className="flex-field"><label htmlFor={id}>{label}</label>{React.cloneElement(children, { id })}</div>;
}
const label = (items, id, fallback) => items.find(item => item.id === id)?.name || fallback || 'Unknown';

export default function TrainingHistory({ state, day, onRemove }) {
  const [view, setView] = useState('log');
  const [filters, setFilters] = useState({ exerciseId: '', machineId: '', from: '', to: '' });
  const [analysisExerciseId, setAnalysisExerciseId] = useState('');
  const [analysisMachineId, setAnalysisMachineId] = useState('');
  const exercises = state.exercises.filter(exercise => exerciseHistoryMachines(state, exercise.id).length > 0).sort(byName);
  const equipment = state.machines.filter(machine => state.sets.some(set => set.machineId === machine.id && (!filters.exerciseId || set.exerciseId === filters.exerciseId))).sort(byName);
  const sets = journalSets(state, filters), days = journalDays(sets);
  const last = [...state.sets].filter(set => !set.demo && exercises.some(exercise => exercise.id === set.exerciseId))
    .sort((a, b) => Date.parse(a.performedAt) - Date.parse(b.performedAt)).at(-1);
  const exercise = exercises.find(item => item.id === (analysisExerciseId || last?.exerciseId)) || exercises[0];
  const machines = exercise ? exerciseHistoryMachines(state, exercise.id) : [];
  const lastPair = [...state.sets].filter(set => !set.demo && set.exerciseId === exercise?.id && machines.some(machine => machine.id === set.machineId))
    .sort((a, b) => Date.parse(a.performedAt) - Date.parse(b.performedAt)).at(-1);
  const machine = machines.find(item => item.id === (analysisMachineId || lastPair?.machineId)) || machines[0];
  const history = exercise && machine ? equipmentHistory(state, { exerciseId: exercise.id, machineId: machine.id, day, unit: 'kg' }) : [];
  const all = journalSets(state), allDays = journalDays(all);
  const change = (key, value) => setFilters(previous => ({ ...previous, [key]: value, ...(key === 'exerciseId' ? { machineId: '' } : {}) }));
  return <>
    <div className="flex-history-views" role="group" aria-label="History view">{[['log', 'Workout log'], ['analysis', 'Analysis']].map(([key, name]) => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{name}</button>)}</div>
    {view === 'log' ? <>
      <details className="flex-details flex-history-filters"><summary>Filters{Object.values(filters).some(Boolean) ? ' · Active' : ''}</summary><div className="flex-grid">
        <Filter label="Exercise"><select value={filters.exerciseId} onChange={event => change('exerciseId', event.target.value)}><option value="">All exercises</option>{exercises.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Filter>
        <Filter label="Equipment"><select value={filters.machineId} onChange={event => change('machineId', event.target.value)}><option value="">All equipment</option>{equipment.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Filter>
        <Filter label="From"><input type="date" value={filters.from} onChange={event => change('from', event.target.value)} /></Filter><Filter label="To"><input type="date" value={filters.to} onChange={event => change('to', event.target.value)} /></Filter>
      </div><button className="flex-quiet" onClick={() => setFilters({ exerciseId: '', machineId: '', from: '', to: '' })}>Clear filters</button></details>
      {!days.length && <p className="flex-empty">No sets logged.</p>}
      {days.map(({ day, sets }) => <section className="flex-journal-day" key={day} aria-label={`Workout ${day}`}><div className="flex-row"><h2>{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</h2><span className="flex-muted">{sets.length} {sets.length === 1 ? 'set' : 'sets'}</span></div>
        <table className="flex-journal-table"><thead><tr><th scope="col">Exercise</th><th scope="col">Weight</th><th scope="col">Reps</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{sets.map(set => <tr key={set.id}><td><span>{label(state.exercises, set.exerciseId, set.exerciseName)}</span><small>{label(state.machines, set.machineId, set.machineName)}{set.note ? ` · ${set.note}` : ''}{set.kind !== 'working' ? ` · ${set.kind}` : ''}</small></td><td>{set.weight}<small className="flex-journal-unit"> {set.unit}</small></td><td>{set.reps}{set.perSide && <small>/side</small>}</td><td><button className="flex-quiet" aria-label={`Remove ${label(state.exercises, set.exerciseId, set.exerciseName)} set ${set.weight} ${set.unit} × ${set.reps}`} onClick={() => onRemove(set)}>×</button></td></tr>)}</tbody></table>
      </section>)}
    </> : <>
      <div className="flex-history-kpis" aria-label="All-time training totals"><div><strong>{allDays.length}</strong><span>Workout days</span></div><div><strong>{all.filter(set => set.kind === 'working').length}</strong><span>Working sets</span></div><div><strong>{new Set(all.map(set => set.exerciseId)).size}</strong><span>Exercises</span></div></div>
      <div className="flex-grid"><Filter label="Exercise"><select value={exercise?.id || ''} onChange={event => { setAnalysisExerciseId(event.target.value); setAnalysisMachineId(''); }}>{exercises.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Filter><Filter label="Equipment"><select value={machine?.id || ''} onChange={event => setAnalysisMachineId(event.target.value)}>{machines.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Filter></div>
      <EquipmentProgress key={`${exercise?.id}:${machine?.id}`} history={history} unit="kg" />
    </>}
  </>;
}
