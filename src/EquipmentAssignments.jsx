import React, { useState } from 'react';
import { byName } from './equipment.mjs';
import { scopeItems } from './focusedExample.mjs';
import AssignmentPicker from './AssignmentPicker.jsx';

export default function EquipmentAssignments({ state, selectedIds, onChange }) {
  const [gymId, setGymId] = useState(state.selectedGymId);
  return <AssignmentPicker label="Equipment" items={scopeItems(state, 'machines').sort(byName)} selectedIds={selectedIds} onChange={onChange}
    matchesFilter={machine => !gymId || machine.gymId === gymId}
    getLabel={machine => `${machine.name}${state.gyms.length > 1 ? ` · ${state.gyms.find(gym => gym.id === machine.gymId)?.name || ''}` : ''}`}
    filterControls={state.gyms.length > 1 && <select aria-label="Filter equipment by gym" value={gymId} onChange={event => setGymId(event.target.value)}>
      {state.gyms.map(gym => <option key={gym.id} value={gym.id}>{gym.name}</option>)}<option value="">All gyms</option>
    </select>} />;
}
