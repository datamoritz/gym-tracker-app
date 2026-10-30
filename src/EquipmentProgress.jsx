import React, { useId, useState } from 'react';

export default function EquipmentProgress({ history, unit }) {
  const [pointId, setPointId] = useState(null);
  const chartId = useId();
  if (!history.length) return <p className="flex-muted">No history for this exercise and profile.</p>;
  const last = history.filter(set => !set.demo).at(-1) || history.at(-1);
  const selected = history.find(set => set.id === pointId) || last;
  const width = 620, height = 310, left = 38, right = 12, plotHeight = 92;
  const x = index => left + (history.length === 1 ? .5 : index / (history.length - 1)) * (width - left - right);
  const date = value => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return <section className="flex-progress-chart" aria-label="Exercise and equipment progress">
    <strong>{selected.weight} {unit} × {selected.reps}</strong><span className="flex-chart-date">{date(selected.trainingDate)}{selected.demo ? ' · Demo' : ''}{selected.id === last.id ? ' · Last' : ''}</span>
    <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Load in ${unit} and reps across ${history.length} sets for the selected exercise and equipment profile`}>
      {[['weight', unit, '#91c9ff'], ['reps', 'Reps', '#f6b16c']].map(([metric, label, color], plotIndex) => {
        const top = 28 + plotIndex * 142;
        const maximum = Math.max(...history.map(set => set[metric]), 1) * 1.12;
        const y = set => top + (1 - set[metric] / maximum) * plotHeight;
        const gradientId = `${chartId}-${metric}`;
        const path = history.map((set, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(set)}`).join(' ');
        return <g key={metric} role="group" aria-label={metric === 'weight' ? `Load in ${unit}` : 'Reps'}>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".15" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          <text x={left} y={top - 12} fill={color} fontSize="13" fontWeight="600">{label}</text>
          {[0, .5, 1].map(fraction => <g key={fraction}><line x1={left} x2={width - right} y1={top + fraction * plotHeight} y2={top + fraction * plotHeight} stroke="#ffffff13" strokeDasharray="3 5" /><text x={left - 7} y={top + fraction * plotHeight + 4} fill="#7f8792" fontSize="11" textAnchor="end">{Number((maximum * (1 - fraction)).toFixed(1))}</text></g>)}
          <path d={`${path} L ${x(history.length - 1)} ${top + plotHeight} L ${x(0)} ${top + plotHeight} Z`} fill={`url(#${gradientId})`} />
          {history.slice(1).map((set, index) => <path key={set.id} d={`M ${x(index)} ${y(history[index])} L ${x(index + 1)} ${y(set)}`} stroke={color} strokeWidth="2.5" strokeDasharray={set.demo && history[index].demo ? '4 4' : undefined} fill="none" />)}
          {history.map((set, index) => <g key={set.id} role="button" tabIndex="0" aria-label={`${label} · ${date(set.trainingDate)}: ${set.weight} ${unit}, ${set.reps} reps${set.demo ? ', demo' : ''}`} onClick={() => setPointId(set.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPointId(set.id); } }}>
            <circle cx={x(index)} cy={y(set)} r={selected.id === set.id ? 5 : 3.5} fill={set.demo ? '#131314' : color} stroke={color} strokeWidth="1.5" /><circle cx={x(index)} cy={y(set)} r="12" fill="transparent"><title>{`${date(set.trainingDate)} · ${set.weight} ${unit} × ${set.reps}${set.demo ? ' · Demo' : ''}`}</title></circle>
          </g>)}
        </g>;
      })}
      <text x={left} y={height - 7} fill="#7f8792" fontSize="11">{date(history[0].trainingDate)}</text><text x={width - right} y={height - 7} fill="#7f8792" fontSize="11" textAnchor="end">{date(history.at(-1).trainingDate)}</text>
    </svg>
    {history.some(set => set.demo) && <span className="flex-chart-demo">Dashed: demo history</span>}
  </section>;
}
