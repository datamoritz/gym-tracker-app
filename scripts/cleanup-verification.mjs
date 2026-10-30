import fs from 'node:fs';
import n from '../api/_lib/fitnessNotion.js';
Object.assign(process.env,JSON.parse(fs.readFileSync(new URL('../.env.server.local',import.meta.url))));
const cfg=JSON.parse(process.env.FITNESS_DATABASES);
const ids=JSON.parse(fs.readFileSync('/tmp/fitness-verification-records.json'));
const sets=await n.rows(cfg.sets.dataSourceId);
for(const id of ids.setIds) {
  const pages=sets.filter(page=>n.rich(page.properties['App ID'])===id);
  for(const page of pages) {
    if (!page.properties.Deleted?.checkbox || n.rich(page.properties.Notes)!=='Temporary deployment verification — remove before release') throw new Error('Refusing to archive an unmarked or active working set');
    await n.request(`pages/${page.id}`,{method:'PATCH',body:{archived:true}});
  }
}
const sessions=await n.rows(cfg.sessions.dataSourceId);
for(const id of ids.sessionIds) {
  const page=sessions.find(page=>n.rich(page.properties['App ID'])===id);
  if(page) {
    const activeSets=sets.filter(set=>!set.properties.Deleted?.checkbox && n.related(set.properties.Session).includes(page.id));
    if(activeSets.length || !page.properties.Finished?.date) throw new Error('Refusing to archive an active/nonempty session');
    await n.request(`pages/${page.id}`,{method:'PATCH',body:{archived:true}});
  }
}
console.log('Temporary verification rows archived. Workout Log and Training Sessions are empty.');
