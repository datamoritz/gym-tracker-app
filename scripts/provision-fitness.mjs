import fs from 'node:fs';
import crypto from 'node:crypto';
import { productionEnv } from './admin-support.mjs';
import n from '../api/_lib/fitnessNotion.js';
import { EXERCISES, MACHINES, TARGETS } from './fitness-plan.mjs';

const manifestPath = new URL('../.fitness-setup.json', import.meta.url);
const env = await productionEnv();
process.env.NOTION_API_KEY = env.NOTION_API_KEY;
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath)) : {
  parentPageId: '409fe23d-5e3c-809f-8205-e9a1f81c53d4', databases: {}, seeds: {}
};
const persist = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
await n.request(`pages/${manifest.parentPageId}`);
const source = await n.request(`databases/${env.EXERCISE_DB_ID}`);
manifest.databases.exercises = { databaseId: source.id, dataSourceId: source.data_sources[0].id };
const original = await n.rows(manifest.databases.exercises.dataSourceId);
if (!manifest.originalExercises) { manifest.originalExercises = original; persist(); }
const schema = await n.request(`data_sources/${manifest.databases.exercises.dataSourceId}`);
if (!manifest.originalSchema) { manifest.originalSchema = schema.properties; persist(); }
const simple = { Name: { title: {} }, 'App ID': { rich_text: {} }, Data: { rich_text: {} }, Deleted: { checkbox: {} } };
const schemas = {
  gyms: ['Gyms', {}], muscles: ['Muscles', {}],
  machines: ['Equipment', { Stations: { number: {} } }],
  targets: ['Targets', { Frequency: { number: {} }, 'Qualifying sets': { number: {} }, 'Recommended sets': { rich_text: {} },
    'Min reps': { number: {} }, 'Max reps': { number: {} }, 'Per side': { checkbox: {} },
    Priority: { number: {} }, Active: { checkbox: {} }, Optional: { checkbox: {} }, 'Recovery days': { number: {} }, Order: { number: {} } }],
  sessions: ['Training Sessions', { Started: { date: {} }, Finished: { date: {} } }],
  sets: ['Workout Log', { Weight: { number: {} }, Reps: { number: {} }, Unit: { select: { options: [{ name: 'kg' }, { name: 'lbs' }] } },
    Date: { date: {} }, Performed: { date: {} }, Notes: { rich_text: {} }, 'Per side': { checkbox: {} } }],
  settings: ['App Settings', {}]
};
if (!manifest.databasesPageId) {
  const page = await n.request('pages', { method: 'POST', body: { parent: { page_id: manifest.parentPageId }, properties: { title: n.title('Databases') } } });
  manifest.databasesPageId = page.id; persist();
}
for (const [key, [name, properties]] of Object.entries(schemas)) {
  if (manifest.databases[key]) continue;
  // Recover a database created just before a connection failure instead of creating a duplicate.
  const children = await n.request(`blocks/${manifest.databasesPageId}/children`);
  const existing = children.results.find(block => block.type === 'child_database' && block.child_database.title === name);
  const db = existing ? await n.request(`databases/${existing.id}`) : await n.request('databases', {
    method: 'POST', body: { parent: { type: 'page_id', page_id: manifest.databasesPageId }, title: [{ text: { content: name } }], initial_data_source: { properties: { ...simple, ...properties } } }
  });
  manifest.databases[key] = { databaseId: db.id, dataSourceId: db.data_sources[0].id }; persist();
  console.log(`Database ready: ${name}`);
}
const relSchema = key => ({ relation: { data_source_id: manifest.databases[key].dataSourceId, single_property: {} } });
for (const [key, relations] of Object.entries({ machines: { Gym: 'gyms', Exercises: 'exercises' }, targets: { Exercises: 'exercises' },
  sessions: { Gym: 'gyms' }, sets: { Exercise: 'exercises', Equipment: 'machines', Targets: 'targets', Session: 'sessions', Gym: 'gyms' } })) {
  const ds = await n.request(`data_sources/${manifest.databases[key].dataSourceId}`);
  const missing = Object.fromEntries(Object.entries(relations).filter(([name]) => !ds.properties[name]).map(([name, type]) => [name, relSchema(type)]));
  if (Object.keys(missing).length) await n.request(`data_sources/${ds.id}`, { method: 'PATCH', body: { properties: missing } });
}
const additions = { 'Primary muscles': relSchema('muscles'), 'Supporting muscles': relSchema('muscles'),
  'Equipment profiles': relSchema('machines'), 'Exercise type': { select: { options: [{ name: 'compound' }, { name: 'isolation' }] } }, 'Tracker active': { checkbox: {} } };
for (const [name, definition] of Object.entries(additions)) {
  if (schema.properties[name] && schema.properties[name].type !== Object.keys(definition)[0]) throw new Error(`Existing ${name} has a different type. No source column was changed.`);
}
const missing = Object.fromEntries(Object.entries(additions).filter(([name]) => !schema.properties[name]));
if (Object.keys(missing).length) await n.request(`data_sources/${schema.id}`, { method: 'PATCH', body: { properties: missing } });

async function seed(key, seedKey, data, extra = {}) {
  const token = `${key}:${seedKey}`;
  const existing = manifest.seeds[token];
  if (existing?.done) return existing;
  const id = existing?.id || crypto.randomUUID();
  manifest.seeds[token] = { ...existing, id }; persist();
  const matches = await n.rows(manifest.databases[key].dataSourceId, { property: 'App ID', rich_text: { equals: id } });
  const record = { ...data, id };
  const properties = { Name: n.title(record.name || seedKey), 'App ID': n.text(id), Data: n.text(JSON.stringify(record)), ...extra };
  const page = matches[0] ? await n.updatePage(matches[0].id, properties) : await n.createPage(manifest.databases[key].dataSourceId, properties);
  manifest.seeds[token] = { id, pageId: page.id, done: true }; persist(); return manifest.seeds[token];
}
const gym = await seed('gyms', 'sf-ocean', { name: 'SF Ocean' });
const muscleNames = [...new Set(EXERCISES.flatMap(x => [...x[4], ...x[5]]))];
const muscles = {};
for (const name of muscleNames) muscles[name] = await seed('muscles', name, { name });
const exerciseIds = {};
for (const [key, sourceId, name] of EXERCISES) {
  if (sourceId) {
    if (!original.some(page => page.id === sourceId)) throw new Error(`Catalog page ${key} is missing. Source data was not replaced.`);
    exerciseIds[key] = sourceId;
  } else {
    const token = `exercise:${key}`;
    if (!manifest.seeds[token]) {
      // The title is only an initial recovery key for newly created records, never a runtime matching key.
      const match = original.find(page => n.rich(page.properties['Exercise Name']) === name);
      const page = match || await n.createPage(schema.id, { 'Exercise Name': n.title(name) });
      manifest.seeds[token] = { pageId: page.id }; persist();
    }
    exerciseIds[key] = manifest.seeds[token].pageId;
  }
}
const equipment = {};
for (const [key, name] of MACHINES) {
  const exerciseKeys = EXERCISES.filter(x => x[6].includes(key) || key.startsWith('cable') && x[6].includes('cable')).map(x => x[0]);
  equipment[key] = await seed('machines', key, { name, gymId: gym.id, stations: [{ id: crypto.randomUUID(), name: 'Station 1' }] }, {
    Gym: n.relation([gym.pageId]), Exercises: n.relation(exerciseKeys.map(k => exerciseIds[k])), Stations: { number: 1 }
  });
}
for (const [key, , , type, primary, supporting, machineKeys] of EXERCISES) {
  const token = `metadata:${key}`;
  if (manifest.seeds[token]) continue;
  const machines = MACHINES.filter(([k]) => machineKeys.includes(k) || k.startsWith('cable') && machineKeys.includes('cable')).map(([k]) => equipment[k].pageId);
  await n.updatePage(exerciseIds[key], { 'Primary muscles': n.relation(primary.map(name => muscles[name].pageId)),
    'Supporting muscles': n.relation(supporting.map(name => muscles[name].pageId)), 'Equipment profiles': n.relation(machines),
    'Exercise type': { select: { name: type } }, 'Tracker active': { checkbox: true } });
  manifest.seeds[token] = true; persist();
}
for (const [order, [key, name, exerciseKeys, doses, perSide = false]] of TARGETS.entries()) {
  const prescriptions = doses.map(([requiredSets, recommendedSets, repMin, repMax]) => ({ id: crypto.randomUUID(), requiredSets, recommendedSets, maxSets: recommendedSets, repMin, repMax, perSide }));
  await seed('targets', key, { name, order, frequency: doses.length, exerciseIds: exerciseKeys.map(k => exerciseIds[k]),
    ...prescriptions[0], prescriptions, windowDays: 7, spacingDays: 2, priority: 2, active: true, optional: false,
    ...(key.startsWith('leg') ? { guidance: 'Keep it light · 3–4 reps in reserve' } : {}) }, {
    Exercises: n.relation(exerciseKeys.map(k => exerciseIds[k])), Frequency: { number: doses.length },
    'Qualifying sets': { number: doses[0][0] }, 'Recommended sets': n.text(doses.map(dose => dose[1]).join(' + ')),
    'Min reps': { number: doses[0][2] }, 'Max reps': { number: doses[0][3] }, 'Per side': { checkbox: perSide },
    Priority: { number: 2 }, Active: { checkbox: true }, Optional: { checkbox: false }, 'Recovery days': { number: 2 }, Order: { number: order }
  });
}
await seed('settings', 'preferences', { name: 'Preferences', timeZone: 'America/Los_Angeles', selectedGymId: gym.id });
manifest.config = { ...manifest.databases, parentPageId: manifest.parentPageId, settingsId: manifest.seeds['settings:preferences'].id };
persist();
console.log(JSON.stringify({ ready: true, sourceRowsBefore: manifest.originalExercises.length, exercisesInFocus: EXERCISES.length, equipment: MACHINES.length, targets: TARGETS.length, parentPageId: manifest.parentPageId }));
