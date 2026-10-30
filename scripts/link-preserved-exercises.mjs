import fs from 'node:fs';
import { productionEnv } from './admin-support.mjs';
import n from '../api/_lib/fitnessNotion.js';
Object.assign(process.env,await productionEnv());
const m=JSON.parse(fs.readFileSync(new URL('../.fitness-setup.json',import.meta.url)));
const muscles = await n.rows(m.databases.muscles.dataSourceId);
const muscleId = name => muscles.find(page=>n.rich(page.properties.Name)===name).id;
const cableIds = [1,2,3].map(i=>m.seeds[`machines:cable${i}`].pageId);
for(const [id,type,primary,supporting] of [
  ['401fe23d-5e3c-805e-8090-f9b1b33a2ae7','isolation',['Triceps'],[]],
  ['2ddfe23d-5e3c-80d9-a8b8-f45dc2bc2ce3','isolation',['Triceps'],[]]
]) await n.updatePage(id,{ 'Primary muscles':n.relation(primary.map(muscleId)), 'Supporting muscles':n.relation(supporting.map(muscleId)),
  'Equipment profiles':n.relation(cableIds),'Exercise type':{select:{name:type}} });
console.log('Preserved non-plan cable exercises remain usable in original routines; no extra weekly targets added.');
