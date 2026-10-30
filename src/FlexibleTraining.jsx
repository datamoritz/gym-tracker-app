import React, { useEffect, useRef, useState } from 'react';
import { FLEXIBLE_KEY, newId, trainingDay, readFlexibleState, activeSession, rankTargets, targetProgress, targetSets, sessionSets,
  startFlexibleSession, addFlexibleSet, finishFlexibleSession, saveTarget, saveExercise, saveMachine, prescription, weeklyPrescription } from './flexible.mjs';
import './flexible.css';
import WorkoutValues from './WorkoutValues.jsx';
import EquipmentProgress from './EquipmentProgress.jsx';
import EquipmentAssignments from './EquipmentAssignments.jsx';
import AssignmentPicker from './AssignmentPicker.jsx';
import ExerciseGuide, { ExerciseInfoButton } from './ExerciseGuide.jsx';
import { byName, machineExerciseIds, exerciseMachines, exerciseHistoryMachines, equipmentHistory, lastEquipmentSet, setExerciseMachines } from './equipment.mjs';
import { scopeItems, scopedMachineExercises } from './focusedExample.mjs';
import { DEFAULT_RANKING, RANKING_FIELDS, rankingConfig, saveRankingConfig, NEXT_REASONS } from './ranking.mjs';

const labelFor = (items, id, fallback = '') => items.find(item => item.id === id)?.name || fallback;
function download(contents) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'gym-data.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Field({ label, children }) {
  const id = React.useId();
  return <div className="flex-field"><label htmlFor={id}>{label}</label>{React.cloneElement(children, { id })}</div>;
}

function TargetEditor({ state, target, onSave, onClose }) {
  const [form, setForm] = useState(target || { name: '', exerciseIds: [], frequency: 1, requiredSets: 3, spacingDays: 2, priority: 2, active: true,
    prescriptions: [{ id: newId(), requiredSets: 3, maxSets: 3, repMin: 8, repMax: 12, perSide: false }] });
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  function changeFrequency(value) {
    const frequency = Math.min(7, Math.max(1, Number(value)));
    setForm(previous => ({ ...previous, frequency, prescriptions: Array.from({ length: frequency }, (_, index) => previous.prescriptions[index] || { ...previous.prescriptions[0], id: newId() }) }));
  }
  function changeDose(index, key, value) {
    setForm(previous => ({ ...previous, prescriptions: previous.prescriptions.map((dose, position) => position === index ? { ...dose, [key]: value,
      ...(key === 'requiredSets' && Number(value) > Number(dose.maxSets) ? { maxSets: value } : {}) } : dose) }));
  }
  return <form className="flex-panel flex-editor" onSubmit={event => {
    event.preventDefault(); const first = form.prescriptions[0];
    onSave({ ...form, requiredSets: first.requiredSets, maxSets: first.maxSets, repMin: first.repMin, repMax: first.repMax, perSide: first.perSide });
  }}>
    <div className="flex-row"><h2>{target ? 'Edit target' : 'New target'}</h2><button type="button" className="flex-quiet" onClick={onClose}>Cancel</button></div>
    <Field label="Name"><input required value={form.name} onChange={event => change('name', event.target.value)} /></Field>
    <div className="flex-grid"><Field label="Times / 7 days"><input type="number" min="1" max="7" required value={form.frequency} onChange={event => changeFrequency(event.target.value)} /></Field><Field label="Recovery window (hours)"><input type="number" min="0" max="336" step="1" required value={form.spacingDays === '' ? '' : Math.round(form.spacingDays * 24)} onChange={event => change('spacingDays', event.target.value === '' ? '' : Number(event.target.value) / 24)} /></Field></div>
    {form.prescriptions.map((dose, index) => <fieldset key={dose.id}><legend>{form.prescriptions.length > 1 ? `Occasion ${index + 1}` : 'Sets & reps'}</legend><div className="flex-grid flex-dose-fields">
      {[['requiredSets', 'Sets to qualify', 1, 20], ['maxSets', 'Recommended sets', 1, 20], ['repMin', 'Min reps', 1, 1000], ['repMax', 'Max reps', 1, 1000]].map(([key, label, min, max]) => <Field key={key} label={label}><input type="number" min={min} max={max} required value={dose[key]} onChange={event => changeDose(index, key, event.target.value)} /></Field>)}
    </div><label className="flex-check"><input type="checkbox" checked={dose.perSide} onChange={event => changeDose(index, 'perSide', event.target.checked)} />Per side</label></fieldset>)}
    <Field label="Priority"><select value={form.priority} onChange={event => change('priority', event.target.value)}><option value="1">Normal</option><option value="2">Important</option><option value="3">High</option></select></Field>
    <AssignmentPicker label="Exercises" items={scopeItems(state, 'exercises').sort(byName)} selectedIds={form.exerciseIds} onChange={ids => change('exerciseIds', ids)} />
    <div className="flex-actions"><label className="flex-check"><input type="checkbox" checked={Boolean(form.optional)} onChange={event => change('optional', event.target.checked)} />Optional</label><label className="flex-check"><input type="checkbox" checked={form.active} onChange={event => change('active', event.target.checked)} />Active</label></div>
    <button className="flex-primary">Save</button>
  </form>;
}

function Library({ state, commit, kind, onGuide }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const exercises = scopeItems(state, 'exercises').sort(byName);
  const open = (kind, item) => {
    setEditing(kind);
    setForm(kind === 'exercise'
      ? { ...(item || { name: '', type: null, primaryMuscleIds: [], supportingMuscleIds: [] }), machineIds: item ? scopeItems(state, 'machines').filter(machine => machineExerciseIds(state, machine.id).includes(item.id)).map(machine => machine.id) : [] }
      : { ...(item || { name: '', gymId: state.selectedGymId }), exerciseIds: item ? scopedMachineExercises(state, item.id) : [], stationCount: item?.stations?.length || 1 });
  };
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  return <>
    {!state.testingScope && <div className="flex-toolbar"><span /><button className="flex-secondary" onClick={() => open(kind)}>{kind === 'exercise' ? '+ Exercise' : '+ Machine'}</button></div>}
    {editing && <form className="flex-panel flex-editor" onSubmit={event => { event.preventDefault(); if (commit(previous => {
      if (editing !== 'exercise') return saveMachine(previous, form);
      const next = saveExercise(previous, form);
      return setExerciseMachines(next, form.id || next.exercises.at(-1).id, form.machineIds, newId);
    })) setEditing(null); }}>
      <div className="flex-row"><h2>{editing === 'exercise' ? 'Exercise' : 'Machine'}</h2><button type="button" className="flex-quiet" onClick={() => setEditing(null)}>Cancel</button></div>
      <Field label="Name"><input required value={form.name} onChange={event => change('name', event.target.value)} /></Field>
      {editing === 'exercise' ? <>
        <div className="flex-metadata"><span>Type</span><span className="flex-metadata-value">{form.type === 'compound' ? 'Compound' : form.type === 'isolation' ? 'Isolation' : '—'}</span></div>
        {[['Primary muscles', form.primaryMuscleIds], ['Supporting muscles', form.supportingMuscleIds]].map(([label, ids]) => <div className="flex-metadata" key={label}><span>{label}</span><div className="flex-pills" aria-label={label}>{ids?.length ? ids.map(id => <span className="flex-pill" key={id}>{labelFor(state.muscles || [], id, 'Unknown muscle')}</span>) : <span className="flex-metadata-value">—</span>}</div></div>)}
        <EquipmentAssignments state={state} selectedIds={form.machineIds} onChange={ids => change('machineIds', ids)} />
      </> : <>
        <div className="flex-grid"><Field label="Gym"><select value={form.gymId} onChange={event => change('gymId', event.target.value)}>{state.gyms.map(gym => <option value={gym.id} key={gym.id}>{gym.name}</option>)}</select></Field><Field label="Equivalent stations"><input type="number" min="1" max="50" required value={form.stationCount} onChange={event => change('stationCount', event.target.value)} /></Field></div>
        <fieldset><legend>Exercises</legend><div className="flex-checks">{exercises.map(exercise => <label key={exercise.id}><input type="checkbox" checked={form.exerciseIds.includes(exercise.id)} onChange={event => change('exerciseIds', event.target.checked ? [...form.exerciseIds, exercise.id] : form.exerciseIds.filter(id => id !== exercise.id))} />{exercise.name}</label>)}</div></fieldset>
      </>}
      <button className="flex-primary">Save</button>
    </form>}
    {kind === 'exercise'
      ? <div className="flex-list">{exercises.map(exercise => <div className="flex-list-row" key={exercise.id}><div><span>{exercise.name}</span><p className="flex-muted">{exerciseMachines(state, exercise.id).length} equipment profiles</p></div><div className="flex-row-actions"><ExerciseInfoButton exercise={exercise} onClick={() => onGuide(exercise)} /><button className="flex-quiet" aria-label={`Edit exercise ${exercise.name}`} onClick={() => open('exercise', exercise)}>Edit</button></div></div>)}</div>
      : <div className="flex-list">{scopeItems(state, 'machines').filter(machine => machine.gymId === state.selectedGymId).sort(byName).map(machine => <div className="flex-list-row" key={machine.id}><div><span>{machine.name}</span><p className="flex-muted">{machine.stations?.length || 1} {(machine.stations?.length || 1) === 1 ? 'station' : 'stations'} · {scopedMachineExercises(state, machine.id).length} {scopedMachineExercises(state, machine.id).length === 1 ? 'exercise' : 'exercises'}</p></div><button className="flex-quiet" aria-label={`Edit machine ${machine.name}`} onClick={() => open('machine', machine)}>Edit</button></div>)}</div>}
  </>;
}

export default function FlexibleTraining({ initialState, persist, syncStatus, syncError, onSync, hasConflict, onUseNotion }) {
  const [initial] = useState(() => { try { return { state: initialState || readFlexibleState(localStorage, { focused: true }) }; } catch (error) { return { state: null, error: error.message }; } });
  const [state, setState] = useState(initial.state);
  const stateRef = useRef(state);
  const [error, setError] = useState(initial.error || '');
  const [tab, setTab] = useState('next');
  const [now, setNow] = useState(new Date());
  const [testDate, setTestDate] = useState(() => activeSession(initial.state || { sessions: [] })?.simulated ? activeSession(initial.state).trainingDate : '');
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [input, setInput] = useState({ weight: 0, reps: 10, unit: 'kg', note: '' });
  const [editingTarget, setEditingTarget] = useState(undefined);
  const [historyMachineId, setHistoryMachineId] = useState('');
  const [historyExerciseId, setHistoryExerciseId] = useState('');
  const [removed, setRemoved] = useState(null);
  const [restUntil, setRestUntil] = useState(() => activeSession(initial.state || { sessions: [] })?.restUntil || 0);
  const [restSeconds, setRestSeconds] = useState(90);
  const [guideExercise, setGuideExercise] = useState(null);
  const [deviceLink, setDeviceLink] = useState('');

  useEffect(() => {
    if (initialState && initialState !== stateRef.current) {
      stateRef.current = initialState; setState(initialState);
      setRestUntil(activeSession(initialState)?.restUntil || 0);
    }
  }, [initialState]);

  useEffect(() => {
    if (!initial.state || initialState) return;
    try { localStorage.setItem(FLEXIBLE_KEY, JSON.stringify(stateRef.current)); }
    catch { setError('Storage unavailable. Export your data before leaving.'); }
  }, [initial]);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);

  function commit(update) {
    try {
      const next = update(stateRef.current);
      if (persist) persist(next); else localStorage.setItem(FLEXIBLE_KEY, JSON.stringify(next));
      stateRef.current = next; setState(next); setError(''); return true;
    } catch (error) { setError(error.message || 'Could not save.'); return false; }
  }
  function chooseMachine(id, dose, exerciseId = selectedExerciseId) {
    setMachineId(id);
    const previous = lastEquipmentSet(state, { machineId: id, exerciseId, day });
    setInput({ weight: previous?.weight ?? 0, reps: previous && previous.reps >= dose.repMin && previous.reps <= dose.repMax ? previous.reps : dose.repMin || 10,
      unit: previous?.unit || 'kg', note: '' });
  }
  function openTarget(row) {
    const exerciseId = row.recommendedExerciseId;
    setSelectedTargetId(row.target.id); chooseExercise(exerciseId, row.progress.prescription); setTab('next');
  }
  function chooseExercise(exerciseId, dose) {
    setSelectedExerciseId(exerciseId);
    const machines = exerciseMachines(state, exerciseId);
    const machine = machines[0];
    chooseMachine(machine?.id || '', dose, exerciseId);
  }
  function removeSet(set) {
    const index = state.sets.findIndex(item => item.id === set.id);
    if (commit(previous => ({ ...previous, sets: previous.sets.filter(item => item.id !== set.id) }))) setRemoved({ set, index });
  }
  function undoRemove() {
    if (commit(previous => { const sets = [...previous.sets]; sets.splice(removed.index, 0, removed.set); return { ...previous, sets }; })) setRemoved(null);
  }
  function updateRest(deadline) {
    const current = activeSession(stateRef.current);
    if (current && commit(previous => ({ ...previous, sessions: previous.sessions.map(item => item.id === current.id ? { ...item, restUntil: deadline } : item) }))) {
      setRestUntil(deadline); setNow(new Date());
    }
  }
  if (!state) return <main className="flex-app"><p role="alert">{error}</p><button className="flex-primary" onClick={() => download(localStorage.getItem(FLEXIBLE_KEY) || '{}')}>Export data</button></main>;

  const session = activeSession(state);
  const day = testDate || trainingDay(now, state.timeZone);
  const rows = rankTargets(state, day, now.toISOString());
  const done = rows.filter(row => row.bucket === 'done');
  const choices = rows.filter(row => row.bucket === 'recommended');
  const otherOptions = rows.filter(row => row.bucket === 'other');
  const selectedRow = rows.find(row => row.target.id === selectedTargetId);
  const currentSets = session ? sessionSets(state, session.id) : [];
  const currentWorkingSets = currentSets.filter(set => set.kind === 'working').length;
  const selectedSets = targetSets(state, selectedTargetId).filter(set => set.trainingDate === day);
  const selectedMachine = state.machines.find(machine => machine.id === machineId);
  const selectedMachines = exerciseMachines(state, selectedExerciseId);
  const machineHistory = equipmentHistory(state, { machineId, exerciseId: selectedExerciseId, day, unit: input.unit });
  const historyExercises = state.exercises.filter(exercise => !exercise.archived || state.sets.some(set => set.exerciseId === exercise.id)).sort(byName);
  const historyExercise = historyExercises.find(exercise => exercise.id === historyExerciseId) || historyExercises[0];
  const historyMachines = historyExercise ? exerciseHistoryMachines(state, historyExercise.id) : [];
  const historyMachine = historyMachines.find(machine => machine.id === historyMachineId) || historyMachines[0];
  const historyChart = historyMachine && historyExercise ? equipmentHistory(state, { machineId: historyMachine.id, exerciseId: historyExercise.id, day, unit: 'kg' }) : [];
  const previewMismatch = !state.production && session && Boolean(session.simulated) !== Boolean(testDate);
  const remainingRest = Math.max(0, Math.ceil((restUntil - now.getTime()) / 1000));

  return <div className={`flex-app${remainingRest > 0 ? ' has-rest-timer' : ''}`}>
    <header className="flex-header"><h1>Training</h1><div className="flex-row-actions">
      {state.gyms.length > 1 && <select aria-label="Gym" value={state.selectedGymId} disabled={Boolean(session)} onChange={event => { const id = event.target.value; commit(previous => ({ ...previous, selectedGymId: id })); setSelectedTargetId(null); }}>{state.gyms.map(gym => <option key={gym.id} value={gym.id}>{gym.name}</option>)}</select>}
      <button type="button" className="flex-settings-button" aria-label="Settings" title="Settings" aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => setTab('settings')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
      </button>
    </div></header>
    <nav className="flex-tabs" aria-label="Training views">{[['next', 'Next'], ['targets', 'Targets'], ['exercises', 'Exercises'], ['library', 'Machines'], ['history', 'History']].map(([key, title]) => <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{title}</button>)}</nav>
    {error && <div className="flex-error" role="alert">{error}<button className="flex-quiet" onClick={() => setError('')}>Dismiss</button></div>}
    {removed && <div className="flex-undo" role="status">Set removed<button className="flex-quiet" onClick={undoRemove}>Undo</button></div>}
    {testDate && <div className="flex-test-warning">Test date · {testDate}</div>}
    <main>
      {tab === 'next' && <>
        {session && <div className="flex-toolbar"><span>{currentWorkingSets} {currentWorkingSets === 1 ? 'set' : 'sets'}</span><button className="flex-secondary" onClick={() => { if (commit(previous => finishFlexibleSession(previous))) { setSelectedTargetId(null); setRestUntil(0); } }}>Finish</button></div>}
        {previewMismatch && <p className="flex-error">Finish this session before changing the date.</p>}
        {selectedRow ? <section className="flex-panel flex-log-panel">
          <div className="flex-row"><h2>{selectedRow.target.name}</h2><div className="flex-row-actions"><ExerciseInfoButton exercise={state.exercises.find(item => item.id === selectedExerciseId) || selectedRow.exercise} onClick={() => setGuideExercise(state.exercises.find(item => item.id === selectedExerciseId) || selectedRow.exercise)} /><button className="flex-quiet" onClick={() => setSelectedTargetId(null)}>Back</button></div></div>
          <p className="flex-prescription">{prescription(selectedRow.progress.prescription)} · {selectedRow.progress.todaySets}/{selectedRow.progress.prescription.recommendedSets || selectedRow.progress.requiredSets} sets{selectedRow.progress.prescription.recommendedSets > selectedRow.progress.requiredSets ? ` · ${selectedRow.progress.requiredSets} to qualify` : ''}</p>
          {selectedRow.target.guidance && <p className="flex-muted">{selectedRow.target.guidance}</p>}
          {selectedRow.exercises.length > 1 && <Field label="Exercise"><select value={selectedExerciseId} onChange={event => chooseExercise(event.target.value, selectedRow.progress.prescription)}>{selectedRow.exercises.map(exercise => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></Field>}
          <div className="flex-options" role="group" aria-label="Equipment">{selectedMachines.map(machine => <div key={machine.id} className={`flex-option ${machineId === machine.id ? 'is-selected' : ''}`}><button className="flex-option-select" aria-pressed={machineId === machine.id} onClick={() => chooseMachine(machine.id, selectedRow.progress.prescription)}>{machine.name}{machine.stations?.length > 1 && <span className="flex-station-count">{machine.stations.length} stations</span>}</button></div>)}</div>
          {!selectedMachines.length && <p className="flex-muted">No machine linked.</p>}
          {selectedMachine && <form onSubmit={event => {
            event.preventDefault(); if (previewMismatch) return;
            const restDeadline = Date.now() + restSeconds * 1000;
            if (commit(previous => {
              const logged = addFlexibleSet(startFlexibleSession(previous, day, now.toISOString(), Boolean(testDate)), { ...input, targetId: selectedTargetId, exerciseId: selectedExerciseId, machineId, day, now: now.toISOString() });
              const active = activeSession(logged);
              return { ...logged, sessions: logged.sessions.map(item => item.id === active.id ? { ...item, restUntil: restDeadline } : item) };
            })) { setInput(previous => ({ ...previous, note: '' })); setRestUntil(restDeadline); setNow(new Date()); }
          }}>
            <WorkoutValues input={input} onChange={setInput} perSide={selectedRow.progress.prescription.perSide} />
            <div className="flex-actions flex-play-actions"><button className="flex-log-button" disabled={previewMismatch}>{`Log set ${selectedRow.progress.todaySets + 1}${selectedRow.progress.todaySets < (selectedRow.progress.prescription.recommendedSets || selectedRow.progress.requiredSets) ? ` / ${selectedRow.progress.prescription.recommendedSets || selectedRow.progress.requiredSets}` : ''}`}</button><button type="button" className="flex-primary" onClick={() => setSelectedTargetId(null)}>{selectedRow.progress.completedToday ? 'Done' : 'Next'}</button></div>
            <EquipmentProgress key={`${selectedExerciseId}:${machineId}`} history={machineHistory} unit={input.unit} />
            <details className="flex-details"><summary>More</summary><div className="flex-grid"><Field label="Note"><input value={input.note} onChange={event => setInput(previous => ({ ...previous, note: event.target.value }))} /></Field><Field label="Rest (seconds)"><input type="number" min="0" max="600" value={restSeconds} onChange={event => setRestSeconds(Math.min(600, Math.max(0, Number(event.target.value))))} /></Field></div></details>
          </form>}
          {selectedSets.length > 0 && <div className="flex-set-list">{selectedSets.map(set => <SetRow key={set.id} set={set} state={state} onRemove={removeSet} />)}</div>}
          {machineHistory.length > 0 && <details className="flex-details"><summary>History</summary>{[...machineHistory].reverse().slice(0, 12).map(set => <SetRow key={set.id} set={set} state={state} date />)}</details>}
        </section> : <>
          {choices.length > 0 && <section aria-label="Recommended"><h2 className="flex-bucket-heading">Recommended</h2><div className="flex-target-list">{choices.map(row => <TargetCard key={row.target.id} row={row} onChoose={() => openTarget(row)} />)}</div></section>}
          {!rows.length && <p className="flex-empty">No linked exercises at this gym.</p>}
          {!choices.length && !otherOptions.length && done.length > 0 && <p className="flex-empty">Done for today.</p>}
        </>}
        {otherOptions.length > 0 && !selectedRow && <details className="flex-details" open><summary>Other options ({otherOptions.length})</summary>{otherOptions.map(row => <TargetCard key={row.target.id} row={row} onChoose={() => openTarget(row)} />)}</details>}
        {done.length > 0 && !selectedRow && <details className="flex-details"><summary>Done ({done.length})</summary>{done.map(row => <TargetCard key={row.target.id} row={row} onChoose={() => openTarget(row)} />)}</details>}
      </>}
      {tab === 'targets' && <>
        {!state.testingScope && <div className="flex-toolbar"><span /><button className="flex-secondary" onClick={() => setEditingTarget(null)}>+ Target</button></div>}
        {editingTarget !== undefined && <TargetEditor key={editingTarget?.id || 'new'} state={state} target={editingTarget} onClose={() => setEditingTarget(undefined)} onSave={form => { if (commit(previous => saveTarget(previous, form))) setEditingTarget(undefined); }} />}
        <div className="flex-list">{scopeItems(state, 'targets').map(target => {
          const completed = Math.min(targetProgress(state, target, day, now.toISOString()).occasions, target.frequency);
          return <div key={target.id} className="flex-list-row"><div><h3>{target.name}{target.optional ? ' · Optional' : ''}{!target.active ? ' · Paused' : ''}</h3><p className="flex-muted flex-target-details"><span>{target.frequency}× / 7d · {weeklyPrescription(target)}</span></p></div>
            <div className="flex-row-actions"><span className="flex-target-progress"><progress value={completed} max={target.frequency} aria-label={`${target.name} progress in the last 7 days`} aria-valuetext={`${completed} of ${target.frequency} training days completed`} /><span aria-hidden="true">{completed}/{target.frequency}</span></span>
              <button className="flex-quiet" aria-label={`Edit target ${target.name}`} onClick={() => setEditingTarget(target)}>Edit</button></div>
          </div>;
        })}</div>
      </>}
      {(tab === 'exercises' || tab === 'library') && <Library key={tab} state={state} commit={commit} kind={tab === 'exercises' ? 'exercise' : 'machine'} onGuide={setGuideExercise} />}
      {tab === 'history' && <>
        <div className="flex-grid">
          <Field label="Exercise"><select value={historyExercise?.id || ''} onChange={event => { setHistoryExerciseId(event.target.value); setHistoryMachineId(''); }}>{historyExercises.map(exercise => <option value={exercise.id} key={exercise.id}>{exercise.name}</option>)}</select></Field>
          <Field label="Equipment"><select value={historyMachine?.id || ''} onChange={event => setHistoryMachineId(event.target.value)}>{historyMachines.map(machine => <option value={machine.id} key={machine.id}>{machine.name}</option>)}</select></Field>
        </div>
        {historyMachine && historyExercise && <EquipmentProgress key={`${historyMachine.id}:${historyExercise.id}`} history={historyChart} unit="kg" />}
        {[...state.sessions].reverse().map(item => { const sets = sessionSets(state, item.id).filter(set => set.machineId === historyMachine?.id && set.exerciseId === historyExercise?.id); if (!sets.length) return null; return <section className="flex-panel" key={item.id}><div className="flex-row"><h3>{item.trainingDate}</h3><span className="flex-muted">{sets.length} sets{!item.endedAt ? ' · Active' : ''}{item.simulated ? ' · Test' : ''}</span></div>{sets.map(set => <SetRow key={set.id} set={set} state={state} onRemove={removeSet} />)}</section>; })}
      </>}
      {tab === 'settings' && <div className="flex-settings">
        {state.gyms.map(gym => <GymName key={gym.id} gym={gym} commit={commit} />)}
        {!state.production && <button className="flex-secondary" onClick={() => commit(previous => ({ ...previous, gyms: [...previous.gyms, { id: newId(), name: `Gym ${previous.gyms.length + 1}` }] }))}>+ Gym</button>}
        <button className="flex-secondary" onClick={() => download(state.production ? localStorage.getItem('fitness_notion_v1') || JSON.stringify(state) : JSON.stringify(state, null, 2))}>Export data</button>
        {state.demoHistory?.length > 0 && <button className="flex-quiet" onClick={() => commit(previous => ({ ...previous, demoHistory: [] }))}>Remove demo history</button>}
        {state.production && <><div className="flex-row"><span className="flex-muted" role="status">{syncStatus}</span><button className="flex-quiet" onClick={onSync}>Sync</button></div>
          {syncError && <p className="flex-error" role="alert">{syncError}</p>}
          {hasConflict && <button className="flex-secondary" onClick={onUseNotion}>Use Notion version</button>}
          <button className="flex-secondary" onClick={async () => { try { const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'invite' }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setDeviceLink(`${location.origin}/#access=${data.token}`); } catch (error) { setError(error.message); } }}>Connect another device</button>
          {deviceLink && <div className="flex-panel"><p className="flex-muted">Open on your other device within 15 minutes.</p><input aria-label="Private device link" readOnly value={deviceLink} onFocus={event => event.target.select()} /><button className="flex-quiet" onClick={() => { navigator.clipboard.writeText(deviceLink).catch(() => setError('Select and copy the link.')); }}>Copy link</button></div>}
          <a href={state.notionUrl} target="_blank" rel="noopener noreferrer" className="flex-back">Notion</a>
          <button className="flex-quiet" onClick={async () => { if (syncStatus !== 'Saved') { setError('Sync or export pending changes before signing out.'); return; } try { const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); if (!response.ok) throw new Error(); localStorage.removeItem('fitness_notion_v1'); location.reload(); } catch { setError('Could not sign out. Try again.'); } }}>Sign out</button>
        </>}
        <a href="/?mode=routines" className="flex-back">Routines</a>
        <RankingSettings state={state} commit={commit} />
        {!state.production && <details className="flex-details"><summary>Testing</summary><Field label="Test date"><input type="date" value={testDate} disabled={Boolean(session)} onChange={event => { setTestDate(event.target.value); setSelectedTargetId(null); }} /></Field>{testDate && !session && <button className="flex-quiet" onClick={() => setTestDate('')}>Today</button>}</details>}
      </div>}
    </main>
    {state.production && syncStatus !== 'Saved' && <div className="flex-sync-status" role="status">{syncStatus}{syncError && <button className="flex-quiet" onClick={onSync}>Retry</button>}</div>}
    {guideExercise && <ExerciseGuide exercise={guideExercise} library={state.exercises} notionAvailable={Boolean(state.production)} onClose={() => setGuideExercise(null)} />}
    {remainingRest > 0 && <aside className="flex-rest-timer" aria-label="Rest timer">
      <div><span className="flex-rest-label">Rest</span><span className="flex-rest-time" role="timer">{Math.floor(remainingRest / 60)}:{String(remainingRest % 60).padStart(2, '0')}</span></div>
      <div className="flex-rest-actions"><button type="button" aria-label="Reduce rest by 15 seconds" onClick={() => updateRest(Math.max(Date.now() + 500, restUntil - 15000))}>-15s</button><button type="button" className="flex-rest-skip" onClick={() => updateRest(0)}>Skip</button></div>
    </aside>}
  </div>;
}

function TargetCard({ row, onChoose }) {
  const { target, progress } = row;
  const status = row.finished_today ? NEXT_REASONS.FINISHED_TODAY : row.rolling_target_met ? NEXT_REASONS.TARGET_MET
    : row.reasonCodes.includes('RECENT_OVERLAP') ? NEXT_REASONS.RECENT_OVERLAP
    : row.reasonCodes.includes('SESSION_OVERLAP') ? NEXT_REASONS.SESSION_OVERLAP : row.deferred ? 'Better later' : target.optional ? 'Optional' : '';
  return <article className="flex-target-card" aria-label={target.name}><div className="flex-target-content"><h3>{target.name}</h3><p className="flex-prescription">{prescription(progress.prescription)}{progress.todaySets > 0 ? ` · ${progress.todaySets}/${progress.prescription.recommendedSets || progress.requiredSets} sets` : ''}{status ? ` · ${status}` : ''}</p></div><span className="flex-week-count" aria-label={`${progress.occasions} of ${target.frequency} training days in 7 days`}>{progress.occasions}/{target.frequency}</span><button className="flex-secondary" onClick={onChoose}>{row.finished_today || row.rolling_target_met ? 'Open' : progress.todaySets ? 'Continue' : 'Start'}</button></article>;
}

function SetRow({ set, state, onRemove, date }) {
  return <div className="flex-set-row"><div><strong>{set.weight} {set.unit} × {set.reps}{set.perSide ? '/side' : ''}</strong><p>{labelFor(state.exercises, set.exerciseId, set.exerciseName)} · {labelFor(state.machines, set.machineId, set.machineName)}{set.kind === 'warmup' ? ' · Warm-up' : ''}{date ? ` · ${set.trainingDate}` : ''}{set.demo ? ' · Demo' : ''}</p>{set.note && <p>{set.note}</p>}</div>{onRemove && <button className="flex-quiet" aria-label={`Remove set ${set.weight} ${set.unit} × ${set.reps}`} onClick={() => onRemove(set)}>×</button>}</div>;
}

function GymName({ gym, commit }) {
  const [name, setName] = useState(gym.name);
  return <form className="flex-gym-form" onSubmit={event => { event.preventDefault(); if (name.trim()) commit(previous => ({ ...previous, gyms: previous.gyms.map(item => item.id === gym.id ? { ...item, name: name.trim() } : item) })); }}><Field label="Gym"><input required value={name} onChange={event => setName(event.target.value)} /></Field><button className="flex-secondary">Save</button></form>;
}

function RankingSettings({ state, commit }) {
  const [form, setForm] = useState(() => rankingConfig(state));
  const [saved, setSaved] = useState(false);
  return <details className="flex-details"><summary>Ranking</summary>
    <RankingOverview config={rankingConfig(state)} />
    <details className="flex-details"><summary>Adjust ranking</summary><form className="flex-editor" onSubmit={event => { event.preventDefault(); if (commit(previous => saveRankingConfig(previous, form))) setSaved(true); }}>
    <div className="flex-grid">{RANKING_FIELDS.map(([key, label, min, max]) => <Field key={key} label={label}><input type="number" min={min} max={max} step="0.01" required value={form[key]} onChange={event => { setForm(previous => ({ ...previous, [key]: event.target.value })); setSaved(false); }} /></Field>)}</div>
    <div className="flex-actions"><button className="flex-primary">{saved ? 'Saved' : 'Save'}</button><button type="button" className="flex-quiet" onClick={() => { setForm({ ...DEFAULT_RANKING }); setSaved(false); }}>Defaults</button></div>
    </form></details>
  </details>;
}

function RankingOverview({ config }) {
  return <section className="flex-ranking-overview" aria-label="How Next is ordered">
    <h3>How Next is ordered</h3>
    <p>Weekly progress uses the last seven local calendar days. Recovery uses elapsed hours. Choices need linked equipment at this gym.</p>
    <dl>
      <div><dt>1. Group</dt><dd><strong>Recommended</strong> — due, with suitable recovery.<br /><strong>Other options</strong> — due, with more muscle overlap, or optional.<br /><strong>Done</strong> — today’s sets completed or rolling target met.</dd></div>
      <div><dt>2. Score within each group</dt><dd>More weekly work remaining and higher personal priority raise the score. Overlapping working sets lower it, fading gradually over the target’s recovery window (48 hours by default). Primary muscles count more than supporting muscles.</dd></div>
      <div><dt>3. Small adjustments</dt><dd>Unfinished sets today get a continuation boost. Isolation gets a small penalty while a suitable, due compound of equal or higher priority needs those muscles. Near-equal scores favor different primary muscles from your last exercise; further ties keep plan order.</dd></div>
    </dl>
    <p>Chest press before flies is a preference. A higher-scoring fly can come first. You can choose from any group; equipment stays alphabetical.</p>
    <details className="flex-details"><summary>Current calculation</summary>
      <p className="flex-ranking-formula">Score = (remaining ÷ weekly target × priority) × fatigue factor + continue bonus − isolation penalty</p>
      <dl>
        <div><dt>Weekly need &amp; priority</dt><dd>One of two occasions completed means ½ remains. Normal ×1, Important ×2, High ×3. At Important, that starts at 1 before the modifiers.</dd></div>
        <div><dt>Continuous recovery</dt><dd>One factor is 1 ÷ (1 + weighted sets × penalty). Each set’s contribution fades linearly from full influence when logged to zero after 48 elapsed hours by default. A target’s Recovery window can change this duration. Today’s and earlier sets combine across sessions and gyms, with each set counted once and no switch at midnight.</dd></div>
        <div><dt>Saved weights</dt><dd>Primary muscles: 1; supporting: {config.supportingWeight}. Overlap is normalized, capped at one equivalent set per logged set. Fatigue penalty: {config.fatiguePenaltyPerSet}.</dd></div>
        <div><dt>Saved adjustments</dt><dd>Continue: +{config.continuationBonus}. Isolation: up to −{config.isolationPenalty}, scaled by overlap.</dd></div>
        <div><dt>Recommended thresholds</dt><dd>Fatigue factor ≥ {config.recommendedFatigueThreshold}. Group comes before score; optional targets stay in Other options. Scores are compared to two decimal places before the alternation tie-breaker.</dd></div>
        <div><dt>Completion &amp; fatigue</dt><dd>An occasion counts once per target per local day after its qualifying sets are completed, combining setups and sessions. Recommended sets can be higher. Partial sets affect fatigue without earning an occasion. Shared muscles alone never award another target credit. Weight and reps don’t affect ranking.</dd></div>
      </dl>
      <p>For targets with alternatives, the best-ranked eligible exercise determines the card’s position. These factors are adjustable estimates, not measurements of recovery.</p>
    </details>
  </section>;
}
