import fs from 'node:fs';
import crypto from 'node:crypto';
import { productionEnv, setProductionEnv } from './admin-support.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../.fitness-setup.json',import.meta.url)));
const env=await productionEnv();
const previousFile=new URL('../.env.server.local',import.meta.url);
const previous=fs.existsSync(previousFile) ? JSON.parse(fs.readFileSync(previousFile)) : {};
const secret=env.FITNESS_AUTH_SECRET || previous.FITNESS_AUTH_SECRET || crypto.randomBytes(48).toString('base64url');
const local={ NOTION_API_KEY:env.NOTION_API_KEY, EXERCISE_DB_ID:env.EXERCISE_DB_ID, ROUTINE_DB_ID:env.ROUTINE_DB_ID,
  LOG_DB_ID:manifest.databases.sets.databaseId, FITNESS_AUTH_SECRET:secret, FITNESS_DATABASES:JSON.stringify(manifest.config) };
fs.writeFileSync(new URL('../.env.server.local',import.meta.url),JSON.stringify(local,null,2),{mode:0o600});
if (process.argv.includes('--production')) {
  for(const key of ['FITNESS_AUTH_SECRET','FITNESS_DATABASES','LOG_DB_ID']) {
    if(env[key]!==local[key]) await setProductionEnv(key,local[key]);
    console.log(`Production configured: ${key}`);
  }
}
console.log('Local configuration ready. No secrets printed.');
