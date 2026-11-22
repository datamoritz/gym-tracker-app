// Keep the raw input while editing. Clamping an empty field to 1 makes the
// following keystroke append to 1 ("2" becomes "12", then gets capped at 7).
export function editTargetFrequency(form, value, newId) {
  const frequency = Number(value);
  if (value === '' || !Number.isInteger(frequency) || frequency < 1 || frequency > 7) return { ...form, frequency: value };
  return { ...form, frequency: value, prescriptions: Array.from({ length: frequency }, (_, index) =>
    form.prescriptions[index] || { ...form.prescriptions[0], id: newId() }) };
}
