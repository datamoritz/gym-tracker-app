import React, { useEffect, useState } from 'react';
import { dayStartHour } from './trainingCalendar.mjs';
import { WEEKDAYS, trainingWeek, trainingWeekLabel, validTrainingDate, shiftTrainingDate, startNewTrainingWeek, startDayForWeekday } from './trainingWeek.mjs';

export function TrainingWeekControls({ state, day, commit }) {
  const [open, setOpen] = useState(false);
  const [startDay, setStartDay] = useState(day);
  const dateId = React.useId();
  const preview = validTrainingDate(startDay) ? { startDay, endDay: shiftTrainingDate(startDay, 6) } : null;
  return <>
    <div className="flex-week-heading"><span>{trainingWeekLabel(trainingWeek(state, day))}</span><button type="button" className="flex-quiet" aria-expanded={open} onClick={() => { setStartDay(day); setOpen(value => !value); }}>New week</button></div>
    {open && <form className="flex-panel flex-editor flex-week-editor" aria-label="New training week" onSubmit={event => {
      event.preventDefault();
      if (commit(previous => startNewTrainingWeek(previous, startDay, day))) setOpen(false);
    }}>
      <div className="flex-field"><label htmlFor={dateId}>Start date</label><input id={dateId} type="date" required min={shiftTrainingDate(day, -6)} max={day} value={startDay} onInput={event => setStartDay(event.currentTarget.value)} onChange={event => setStartDay(event.target.value)} /></div>
      {preview && <p className="flex-muted">{trainingWeekLabel(preview)}</p>}
      <p className="flex-muted">Resets target progress. Keeps all workout history.</p>
      <p className="flex-muted">Work logged since {String(dayStartHour(state)).padStart(2, '0')}:00 on this date counts. Future weeks start on the same weekday.</p>
      <div className="flex-actions"><button className="flex-primary">Start new training week</button><button type="button" className="flex-quiet" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>}
  </>;
}

export function WeekStartSettings({ state, day, commit }) {
  const current = trainingWeek(state, day).weekStartDay;
  const [value, setValue] = useState(current);
  const [saved, setSaved] = useState(false);
  const fieldId = React.useId();
  useEffect(() => { setValue(current); }, [current]);
  const startDay = startDayForWeekday(value, day);
  return <form className="flex-editor flex-week-settings" aria-label="Training week settings" onSubmit={event => {
    event.preventDefault();
    if (commit(previous => startNewTrainingWeek(previous, startDay, day))) setSaved(true);
  }}>
    <div className="flex-field"><label htmlFor={fieldId}>Week starts</label><select id={fieldId} value={value} onChange={event => { setValue(event.target.value); setSaved(false); }}>{[1, 2, 3, 4, 5, 6, 0].map(index => <option key={index} value={index}>{WEEKDAYS[index]}</option>)}</select></div>
    <p className="flex-muted">{trainingWeekLabel({ startDay, endDay: shiftTrainingDate(startDay, 6) })} · {String(dayStartHour(state)).padStart(2, '0')}:00 {state.timeZone}</p>
    <div className="flex-actions"><button className="flex-secondary">{saved ? 'Saved' : 'Save week start'}</button></div>
  </form>;
}
