const n = require('./fitnessNotion');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const parseData = page => {
  const raw = n.rich(page.properties?.Data);
  try { return raw ? JSON.parse(raw) : {}; } catch { throw fail('A Notion Data field contains invalid JSON. Fix it in Notion before syncing.', 409); }
};
function config() {
  const value = JSON.parse(process.env.FITNESS_DATABASES || '{}');
  if (!['exercises','gyms','muscles','machines','targets','sessions','sets','settings'].every(key => n.uuid(value[key]?.dataSourceId))) throw fail('Fitness databases are not configured.', 503);
  return value;
}
const number = (properties, name, fallback) => properties[name]?.number ?? fallback;
const checked = (properties, name, fallback = false) => properties[name]?.checkbox ?? fallback;
const date = (properties, name) => properties[name]?.date?.start || null;
function notionTimestamp(properties,name,precise) {
  const stored = date(properties,name);
  if (!stored) return null;
  // Notion date properties round to minutes. Keep exact JSON timestamps when
  // they describe the same minute, while still honoring a deliberate date edit.
  if (precise && Math.floor(Date.parse(stored)/60000) === Math.floor(Date.parse(precise)/60000)) return precise;
  return new Date(stored).toISOString();
}
function appRecord(page) {
  return { ...parseData(page), id: n.rich(page.properties['App ID']) || page.id, name: n.rich(page.properties.Name), deleted: checked(page.properties, 'Deleted'), notionPageId: page.id };
}
async function readAll() {
  const cfg = config();
  const raw = {};
  // Limit concurrency to respect Notion's average request budget.
  const entries = Object.entries(cfg).filter(([, value]) => value?.dataSourceId);
  for (let i = 0; i < entries.length; i += 3) {
    const results = await Promise.all(entries.slice(i, i + 3).map(async ([key, value]) => [key, await n.rows(value.dataSourceId)]));
    for (const [key, pages] of results) raw[key] = pages;
  }
  const byPage = {};
  for (const [entity, pages] of Object.entries(raw)) byPage[entity] = new Map(pages.map(page => [page.id, entity === 'exercises' ? n.rich(page.properties['Tracker ID']) || page.id : n.rich(page.properties['App ID']) || page.id]));
  const ids = (property, entity) => n.related(property).map(id => byPage[entity].get(id)).filter(Boolean);
  const state = { version: 1, production: true, equipmentVersion: 1, musclesVersion: 1, settingsId: cfg.settingsId,
    notionUrl: `https://www.notion.so/${cfg.parentPageId.replaceAll('-', '')}`, equipmentLinks: [], activities: [], demoHistory: [] };
  for (const entity of ['gyms','muscles','machines','targets','sessions','sets','settings']) state[entity] = raw[entity].map(page => {
    const record = appRecord(page), p = page.properties;
    if (entity === 'machines') Object.assign(record, { gymId: ids(p.Gym, 'gyms')[0], stations: Array.from({ length: Math.max(1, Math.min(50, number(p,'Stations', record.stations?.length || 1))) }, (_, i) => record.stations?.[i] || { id: `${record.id}:${i}`, name: `Station ${i + 1}` }) });
    if (entity === 'targets') {
      const frequency = number(p,'Frequency', record.frequency || 1);
      const qualifying = number(p,'Qualifying sets', record.requiredSets || 2);
      const recommendations = n.rich(p['Recommended sets']).split('+').map(value => Number(value.trim()));
      const prescriptions = Array.from({ length: frequency }, (_, index) => {
        const previous = record.prescriptions?.[index] || {};
        const recommendedSets = Math.max(qualifying, recommendations[index] || previous.recommendedSets || previous.maxSets || qualifying);
        return { ...previous, id: previous.id || n.stableId(`${record.id}:prescription:${index}`), requiredSets: qualifying === record.requiredSets ? previous.requiredSets || qualifying : qualifying, recommendedSets, maxSets: recommendedSets,
          repMin: number(p,'Min reps',record.repMin) === record.repMin ? previous.repMin || record.repMin : number(p,'Min reps',8),
          repMax: number(p,'Max reps',record.repMax) === record.repMax ? previous.repMax || record.repMax : number(p,'Max reps',12),
          perSide: checked(p,'Per side',record.perSide) === record.perSide ? previous.perSide : checked(p,'Per side') };
      });
      Object.assign(record, { ...prescriptions[0], id: record.id, exerciseIds: ids(p.Exercises, 'exercises'), frequency, prescriptions,
        priority: number(p,'Priority', 2), active: checked(p,'Active', true), optional: checked(p,'Optional'),
        spacingDays: number(p,'Recovery days', 2), order: number(p,'Order', 0), windowDays: 7 });
    }
    if (entity === 'sessions') Object.assign(record, { gymId: ids(p.Gym,'gyms')[0], startedAt: notionTimestamp(p,'Started',record.startedAt) || record.startedAt, endedAt: notionTimestamp(p,'Finished',record.endedAt) });
    if (entity === 'sets') Object.assign(record, { exerciseId: ids(p.Exercise,'exercises')[0] || record.exerciseId, machineId: ids(p.Equipment,'machines')[0] || record.machineId,
      sessionId: ids(p.Session,'sessions')[0] || record.sessionId, gymId: ids(p.Gym,'gyms')[0] || record.gymId,
      weight: number(p,'Weight', record.weight), reps: number(p,'Reps',record.reps), unit: p.Unit?.select?.name || record.unit,
      trainingDate: date(p,'Date') || record.trainingDate, performedAt: notionTimestamp(p,'Performed',record.performedAt) || record.performedAt, note: n.rich(p.Notes), perSide: checked(p,'Per side', record.perSide) });
    return record;
  });
  state.exercises = raw.exercises.map(page => {
    const p = page.properties, id = byPage.exercises.get(page.id);
    for (const machineId of ids(p['Equipment profiles'], 'machines')) state.equipmentLinks.push({ id: `${id}:${machineId}`, exerciseId: id, machineId, archived: false });
    return { id, notionPageId: page.id, name: n.rich(p['Exercise Name']), archived: !checked(p,'Tracker active'), type: p['Exercise type']?.select?.name || null,
      primaryMuscleIds: ids(p['Primary muscles'],'muscles'), supportingMuscleIds: ids(p['Supporting muscles'],'muscles'),
      instructions: n.rich(p.Instructions), commonMistakes: n.rich(p['Common Mistakes']), musclesWorked: n.rich(p['Muscles Worked']), sourceUrl: p['Source URL']?.url || '',
      images: (p.Images?.files || []).map(file => ({ name: file.name, url: file.file?.url || file.external?.url || '' })) };
  });
  const preferences = state.settings.find(item => item.id === cfg.settingsId) || state.settings[0] || {};
  Object.assign(state, { timeZone: preferences.timeZone || 'America/Los_Angeles', selectedGymId: preferences.selectedGymId || state.gyms[0]?.id, rankingConfig: preferences.rankingConfig });
  const activities = new Map();
  for (const set of state.sets) for (const activity of set.activities || []) activities.set(activity.id, activity);
  state.activities = [...activities.values()];
  // Keep deleted records in the context for idempotent restore/retry, never in UI/ranking.
  const context = { cfg, raw, all: state, byPage };
  const visible = { ...state };
  for (const entity of ['gyms','muscles','machines','targets','sessions','sets']) visible[entity] = [...new Map(state[entity].filter(item => !item.deleted).map(item => [item.id,item])).values()];
  delete visible.settings;
  // Retain inactive catalog metadata for historical fatigue and saved routine links.
  // scopeItems controls which exercises appear as current choices in the UI.
  visible.exercises = state.exercises;
  visible.equipmentLinks = state.equipmentLinks;
  visible.targets.sort((a,b) => a.order - b.order);
  visible.sessions.sort((a,b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  visible.sets.sort((a,b) => Date.parse(a.performedAt) - Date.parse(b.performedAt) || a.id.localeCompare(b.id));
  return { context, state: visible };
}

const ALLOWED = {
  gyms: ['name'], exercises: ['name'], assignments: ['machineIds'], machines: ['name','gymId','stations','archived'],
  targets: ['name','exerciseIds','frequency','requiredSets','recommendedSets','maxSets','repMin','repMax','perSide','prescriptions','windowDays','spacingDays','priority','active','optional','order','guidance'],
  sessions: ['gymId','startedAt','trainingDate','endedAt','restUntil'],
  sets: ['activityId','activityIds','sessionId','exerciseId','machineId','gymId','exerciseName','machineName','weight','reps','perSide','unit','kind','note','trainingDate','performedAt','activities','source','deleted'],
  settings: ['name','timeZone','selectedGymId','rankingConfig']
};
function validateOperation(op) {
  if (!op || !n.uuid(op.id) || !n.uuid(op.recordId) || !ALLOWED[op.entity] || !op.changes || Array.isArray(op.changes) || typeof op.changes !== 'object' ||
    Object.keys(op.changes).some(key => !ALLOWED[op.entity].includes(key)) || JSON.stringify(op).length > 60000) throw fail('Invalid training change.');
}
function validateRecord(entity, record) {
  const int = (value,min,max) => Number.isInteger(value) && value >= min && value <= max;
  const idList = value => Array.isArray(value) && value.length <= 100 && value.every(n.uuid);
  const when = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  if (['gyms','exercises','machines','targets','settings'].includes(entity) && (typeof record.name !== 'string' || !record.name.trim() || record.name.length > 300)) throw fail('Enter a name of up to 300 characters.');
  if (entity === 'assignments' && !idList(record.machineIds)) throw fail('Invalid equipment assignments.');
  if (entity === 'machines' && (!n.uuid(record.gymId) || !Array.isArray(record.stations) || !int(record.stations.length,1,50))) throw fail('Check the machine gym and stations.');
  if (entity === 'targets') {
    if (!int(record.frequency,1,7) || !int(record.requiredSets,1,20) || !int(record.priority,1,3) || !Number.isFinite(record.spacingDays) || record.spacingDays < 0 || record.spacingDays > 14 || !idList(record.exerciseIds) || !record.exerciseIds.length || !Array.isArray(record.prescriptions) || record.prescriptions.length !== record.frequency) throw fail('Check the target frequency, sets and exercises.');
    for (const dose of record.prescriptions) if (!n.uuid(dose.id) || !int(dose.requiredSets,1,20) || !int(dose.maxSets,dose.requiredSets,20) || !int(dose.repMin,1,1000) || !int(dose.repMax,dose.repMin,1000)) throw fail('Check the set and rep prescription.');
  }
  if (entity === 'sessions' && (!n.uuid(record.gymId) || !when(record.startedAt) || !/^\d{4}-\d{2}-\d{2}$/.test(record.trainingDate) || record.endedAt && !when(record.endedAt))) throw fail('Invalid session.');
  if (entity === 'sets') {
    if (!Number.isFinite(record.weight) || record.weight < 0 || record.weight > 10000 || !int(record.reps,1,1000) || !['kg','lbs'].includes(record.unit) || record.kind !== 'working' ||
      ![record.exerciseId,record.machineId,record.gymId,record.sessionId].every(n.uuid) || !when(record.performedAt) || !/^\d{4}-\d{2}-\d{2}$/.test(record.trainingDate) || typeof record.note !== 'string' || record.note.length > 5000 || !Array.isArray(record.activities) || record.activities.length > 100) throw fail('Invalid working set.');
    for (const activity of record.activities) if (![activity.id,activity.targetId,activity.sessionId].every(n.uuid) || activity.sessionId !== record.sessionId || activity.trainingDate !== record.trainingDate || !int(activity.requiredSets,1,20)) throw fail('Invalid target credit.');
  }
  if (entity === 'settings') {
    try { new Intl.DateTimeFormat('en-US', { timeZone: record.timeZone }); } catch { throw fail('Invalid time zone.'); }
    if (!n.uuid(record.selectedGymId)) throw fail('Choose a gym.');
  }
}
function currentRecord(context, entity, id) {
  if (entity === 'assignments') return { id, machineIds: context.all.equipmentLinks.filter(link => link.exerciseId === id && !link.archived).map(link => link.machineId).sort() };
  return context.all[entity]?.find(item => item.id === id);
}
function pageId(context, entity, id) {
  const record = context.all[entity]?.find(item => item.id === id && !item.deleted);
  if (!record) throw fail(`A linked ${entity} record is missing. Refresh and try again.`, 409);
  return record.notionPageId;
}
async function applyOperation(context, op, equal) {
  validateOperation(op);
  const current = currentRecord(context,op.entity,op.recordId);
  if (!current && !op.create) throw fail('A record was removed in Notion. Export pending changes before refreshing.',409);
  const changes = {};
  for (const [key,value] of Object.entries(op.changes)) {
    const existing = current?.[key] ?? null;
    if (equal(existing,value) || key === 'deleted' && Boolean(existing) === value) continue;
    if (current && !equal(existing,op.base?.[key] ?? null) && !(op.create && key === 'deleted' && existing === true && value === false)) throw fail('This record changed on another device or in Notion. Export pending changes before resolving the conflict.',409);
    changes[key] = value;
  }
  if (!Object.keys(changes).length && current) return;
  const record = { ...current, ...changes, id: op.recordId };
  validateRecord(op.entity,record);
  if (op.entity === 'exercises' || op.entity === 'assignments') {
    const properties = op.entity === 'assignments' ? { 'Equipment profiles': n.relation(record.machineIds.map(id => pageId(context,'machines',id))) } : {
      'Exercise Name': n.title(record.name), ...(!current ? { 'Tracker ID': n.text(record.id), 'Tracker active': { checkbox: true } } : {})
    };
    const exercise = context.all.exercises.find(item => item.id === op.recordId);
    if (!exercise && op.entity === 'assignments') throw fail('The exercise is missing.',409);
    const page = exercise ? await n.updatePage(exercise.notionPageId, properties) : await n.createPage(context.cfg.exercises.dataSourceId, properties);
    if (op.entity === 'assignments') context.all.equipmentLinks = [...context.all.equipmentLinks.filter(link => link.exerciseId !== op.recordId), ...record.machineIds.map(machineId => ({ exerciseId: op.recordId, machineId }))];
    else if (exercise) Object.assign(exercise, record); else context.all.exercises.push({ ...record, notionPageId: page.id, primaryMuscleIds: [], supportingMuscleIds: [] });
    return;
  }
  const { notionPageId, deleted, ...data } = record;
  const properties = { Name: n.title(record.name || record.exerciseName || `${op.entity} ${record.trainingDate || ''}`), 'App ID': n.text(record.id), Data: n.text(JSON.stringify(data)), Deleted: { checkbox: Boolean(deleted) } };
  if (op.entity === 'machines') Object.assign(properties, { Gym: n.relation([pageId(context,'gyms',record.gymId)]), Stations: { number: record.stations.length } });
  if (op.entity === 'targets') Object.assign(properties, {
    Exercises: n.relation(record.exerciseIds.map(id => pageId(context,'exercises',id))), Frequency: { number: record.frequency },
    'Qualifying sets': { number: record.requiredSets }, 'Recommended sets': n.text(record.prescriptions.map(dose => dose.recommendedSets || dose.maxSets).join(' + ')),
    'Min reps': { number: record.repMin }, 'Max reps': { number: record.repMax }, 'Per side': { checkbox: Boolean(record.perSide) },
    Priority: { number: record.priority }, Active: { checkbox: Boolean(record.active) }, Optional: { checkbox: Boolean(record.optional) }, 'Recovery days': { number: record.spacingDays }, Order: { number: record.order || 0 }
  });
  if (op.entity === 'sessions') Object.assign(properties, { Gym: n.relation([pageId(context,'gyms',record.gymId)]), Started: { date: { start: record.startedAt } }, Finished: { date: record.endedAt ? { start: record.endedAt } : null } });
  if (op.entity === 'sets') {
    if (record.source !== 'routine') {
      const machine = context.all.machines.find(item => item.id === record.machineId);
      if (machine?.gymId !== record.gymId || !context.all.sessions.some(item => item.id === record.sessionId && item.gymId === record.gymId)) throw fail('The equipment and session must belong to the same gym.');
      if (!current && !context.all.equipmentLinks.some(link => link.exerciseId === record.exerciseId && link.machineId === record.machineId)) throw fail('Link this exercise to the equipment before logging.');
      for (const activity of record.activities) if (!context.all.targets.some(target => target.id === activity.targetId && target.exerciseIds.includes(record.exerciseId))) {
        if (!current) throw fail('The exercise does not match its target.');
      }
    }
    Object.assign(properties, { Exercise: n.relation([pageId(context,'exercises',record.exerciseId)]), Equipment: n.relation([pageId(context,'machines',record.machineId)]),
      Targets: n.relation([...new Set(record.activities.map(activity => pageId(context,'targets',activity.targetId)))]),
      Session: n.relation([pageId(context,'sessions',record.sessionId)]), Gym: n.relation([pageId(context,'gyms',record.gymId)]), Weight: { number: record.weight }, Reps: { number: record.reps },
      Unit: { select: { name: record.unit } }, Date: { date: { start: record.trainingDate } }, Performed: { date: { start: record.performedAt } }, Notes: n.text(record.note), 'Per side': { checkbox: Boolean(record.perSide) } });
  }
  const page = current ? await n.updatePage(current.notionPageId,properties) : await n.createPage(context.cfg[op.entity].dataSourceId, properties);
  if (current) Object.assign(current,record); else context.all[op.entity].push({ ...record, notionPageId: page.id });
}
async function mutate(operations) {
  if (!Array.isArray(operations) || !operations.length || operations.length > 10) throw fail('Send between 1 and 10 changes.');
  operations.forEach(validateOperation);
  const { equal } = await import('../../src/trainingSync.mjs');
  const { context } = await readAll();
  const acknowledged = [];
  for (const op of operations) {
    try { await applyOperation(context,op,equal); acknowledged.push(op.id); }
    catch(error) { return { acknowledged, error: error.status && error.status < 500 ? error.message : 'Notion could not save this change. It remains on this device for retry.', status: error.status || 503 }; }
  }
  return { acknowledged };
}
module.exports = { readAll, mutate, validateOperation, validateRecord, applyOperation, currentRecord, config, notionTimestamp };
