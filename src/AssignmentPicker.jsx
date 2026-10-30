import React, { useId, useState } from 'react';

export default function AssignmentPicker({ label, items, selectedIds, onChange, filterControls,
  matchesFilter = () => true, getLabel = item => item.name, emptyMessage }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId(), inputId = useId();
  const noun = label.toLocaleLowerCase();
  const options = items.filter(item => matchesFilter(item) && item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selected = items.filter(item => selectedIds.includes(item.id));
  const activeIndex = Math.min(active, Math.max(0, options.length - 1));
  const toggle = id => onChange(selectedIds.includes(id) ? selectedIds.filter(value => value !== id) : [...new Set([...selectedIds, id])]);
  return <div className="flex-assignment-picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <div className="flex-assignment-heading"><label htmlFor={inputId}>{label}</label>{filterControls}</div>
    {selected.length > 0 && <div className="flex-pills" aria-label={`Selected ${noun}`}>{selected.map(item => <span className="flex-pill" key={item.id}><span>{getLabel(item)}</span><button type="button" aria-label={`Unlink ${item.name}`} onClick={() => toggle(item.id)}>×</button></span>)}</div>}
    <input id={inputId} type="search" role="combobox" aria-label={`Search ${noun}`} aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
      aria-activedescendant={open && options[activeIndex] ? `${listId}-${options[activeIndex].id}` : undefined}
      placeholder={`Search ${noun}`} value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); event.stopPropagation(); }
        else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          setActive(options.length ? open ? (activeIndex + delta + options.length) % options.length : delta > 0 ? 0 : options.length - 1 : 0);
          setOpen(true);
        } else if (event.key === 'Enter') { event.preventDefault(); if (open && options[activeIndex]) toggle(options[activeIndex].id); else setOpen(true); }
      }} />
    {open && <div className="flex-assignment-results" id={listId} role="listbox" aria-label={`${label} options`} aria-multiselectable="true">
      {options.map((item, index) => <button key={item.id} id={`${listId}-${item.id}`} type="button" role="option" aria-selected={selectedIds.includes(item.id)}
        className={index === activeIndex ? 'is-active' : ''} onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => toggle(item.id)}>
        <span>{getLabel(item)}</span><span aria-hidden="true">{selectedIds.includes(item.id) ? '✓' : '+'}</span>
      </button>)}
      {!options.length && <p className="flex-muted">{emptyMessage || `No ${noun} found.`}</p>}
    </div>}
  </div>;
}
