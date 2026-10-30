import fs from 'node:fs';
import { productionEnv } from './admin-support.mjs';
import provider from '../api/_lib/trainingProvider.js';
Object.assign(process.env,await productionEnv());
const manifest = JSON.parse(fs.readFileSync(new URL('../.fitness-setup.json', import.meta.url)));
process.env.FITNESS_DATABASES = JSON.stringify(manifest.config);
const { state } = await provider.readAll();
fs.writeFileSync('/tmp/fitness-state.json',JSON.stringify(state,null,2),{ mode: 0o600 });
console.log(JSON.stringify({ gyms: state.gyms.map(g => g.name), exercises: state.exercises.length, equipment: state.machines.length,
  muscles: state.muscles.length, targets: state.targets.map(t => ({name:t.name,frequency:t.frequency,sets:t.prescriptions.map(p=>[p.requiredSets,p.recommendedSets]),options:t.exerciseIds.length})), sessions: state.sessions.length, sets: state.sets.length }));
