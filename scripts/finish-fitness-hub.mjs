import fs from 'node:fs';
import { productionEnv } from './admin-support.mjs';
import n from '../api/_lib/fitnessNotion.js';
Object.assign(process.env,await productionEnv());
const file = new URL('../.fitness-setup.json',import.meta.url);
const m = JSON.parse(fs.readFileSync(file));
const save = () => fs.writeFileSync(file,JSON.stringify(m,null,2),{ mode: 0o600 });
const ds = await n.request(`data_sources/${m.databases.exercises.dataSourceId}`);
if (ds.properties['Equipment profiles'].relation.type !== 'dual_property') await n.request(`data_sources/${ds.id}`, { method: 'PATCH', body: {
  properties: { 'Equipment profiles': { relation: { data_source_id: m.databases.machines.dataSourceId, dual_property: { synced_property_name: 'Linked exercises' } } } }
} });
const machines = await n.request(`data_sources/${m.databases.machines.dataSourceId}`);
// This redundant bootstrap column exists only in the newly created Equipment database.
if (machines.properties.Exercises) await n.request(`data_sources/${machines.id}`, { method: 'PATCH', body: { properties: { Exercises: null } } });
if (!m.hubContent) {
  const children = await n.request(`blocks/${m.parentPageId}/children`);
  if (!children.results.some(block => block.type === 'bookmark' && block.bookmark.url === 'https://gym-tracker-app-omega.vercel.app')) {
    await n.request(`blocks/${m.parentPageId}/children`, { method: 'PATCH', body: { children: [
      { object: 'block', type: 'bookmark', bookmark: { url: 'https://gym-tracker-app-omega.vercel.app', caption: [{ type: 'text', text: { content: 'Open app' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'SF Ocean · rolling weekly targets' } }] } },
      { object: 'block', type: 'link_to_page', link_to_page: { type: 'database_id', database_id: m.databases.exercises.databaseId } },
      { object: 'block', type: 'link_to_page', link_to_page: { type: 'database_id', database_id: process.env.ROUTINE_DB_ID } }
    ] } });
  }
  m.hubContent = true; save();
}
// Verify every original catalog row and column still exists with its original values.
const currentSchema = await n.request(`data_sources/${m.databases.exercises.dataSourceId}`);
for (const [name, property] of Object.entries(m.originalSchema)) {
  if (!currentSchema.properties[name] || currentSchema.properties[name].id !== property.id || currentSchema.properties[name].type !== property.type) throw new Error(`Original source column changed: ${name}`);
}
const pages = await n.rows(m.databases.exercises.dataSourceId);
const simplify = value => {
  if (Array.isArray(value)) return value.map(simplify);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !['plain_text','href','expiry_time'].includes(key) && !(key === 'url' && 'expiry_time' in value)).map(([key,val]) => [key,simplify(val)]));
};
for (const original of m.originalExercises) {
  const current = pages.find(page => page.id === original.id);
  if (!current || current.archived || current.in_trash) throw new Error(`Original exercise is missing: ${original.id}`);
  for (const name of Object.keys(m.originalSchema)) {
    if (JSON.stringify(simplify(original.properties[name])) !== JSON.stringify(simplify(current.properties[name]))) throw new Error(`Original exercise property changed: ${name} on ${original.id}`);
  }
}
console.log(JSON.stringify({ originalRowsPreserved: m.originalExercises.length, originalColumnsPreserved: Object.keys(m.originalSchema).length, totalCatalogRows: pages.length, bidirectionalEquipmentLinks: true, hubReady: true }));
