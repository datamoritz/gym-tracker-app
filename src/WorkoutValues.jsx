import React from 'react';

// Reuse the original play screen's card and adjustment layout.
export default function WorkoutValues({ input, onChange, perSide = false }) {
  const weightId = React.useId();
  const repsId = React.useId();
  const adjust = (field, delta) => onChange(previous => ({ ...previous,
    [field]: Math.min(field === 'reps' ? 1000 : Infinity,
      Math.max(field === 'reps' ? 1 : 0, Math.round(((Number.parseFloat(previous[field]) || 0) + delta) * 100) / 100))
  }));
  const size = value => ({ fontSize: `min(48px, calc(100cqw / ${Math.max(String(value).length, 4) * 0.65}))` });
  return <div className="workout-values">
    <div className="workout-value-column">
      <div className="workout-value-card dark-card">
        <label htmlFor={weightId} className="workout-value-label">Load</label>
        <input id={weightId} type="number" inputMode="decimal" min="0" step="any" required
          value={input.weight} onChange={event => onChange(previous => ({ ...previous, weight: event.target.value }))}
          style={size(input.weight)} className="workout-value-input" />
        <div className="workout-value-unit"><div className="weight-unit-toggle" role="group" aria-label="Weight unit">
          {['kg', 'lbs'].map(unit => <button type="button" key={unit} aria-pressed={input.unit === unit}
            onClick={() => onChange(previous => ({ ...previous, unit }))}>{unit}</button>)}
        </div></div>
      </div>
      <div className="workout-adjustments" role="group" aria-label="Adjust load">
        {[-5, -2.5, 2.5, 5].map(delta => <button type="button" key={delta} onClick={() => adjust('weight', delta)}>{delta > 0 ? '+' : ''}{delta}</button>)}
      </div>
    </div>
    <div className="workout-value-column">
      <div className="workout-value-card dark-card">
        <label htmlFor={repsId} className="workout-value-label">{perSide ? 'Reps / side' : 'Reps'}</label>
        <input id={repsId} type="number" inputMode="numeric" min="1" max="1000" step="1" required
          value={input.reps} onChange={event => onChange(previous => ({ ...previous, reps: event.target.value }))}
          style={size(input.reps)} className="workout-value-input" />
        <span className="workout-value-unit workout-reps-unit">{perSide ? 'reps / side' : 'reps'}</span>
      </div>
      <div className="workout-adjustments" role="group" aria-label="Adjust reps">
        {[-1, 1].map(delta => <button type="button" key={delta} onClick={() => adjust('reps', delta)}>{delta > 0 ? '+' : ''}{delta}</button>)}
      </div>
    </div>
  </div>;
}
