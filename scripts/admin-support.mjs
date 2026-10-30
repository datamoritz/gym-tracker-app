import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const project = JSON.parse(fs.readFileSync(new URL('../.vercel/project.json', import.meta.url)));
export async function vercelRequest(route, { method = 'GET', body } = {}) {
  const auth = JSON.parse(fs.readFileSync(path.join(os.homedir(), 'Library/Application Support/com.vercel.cli/auth.json')));
  const response = await fetch(`https://api.vercel.com${route}${route.includes('?') ? '&' : '?'}teamId=${project.orgId}`, {
    method, headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Vercel ${response.status}: ${data.error?.message || 'request failed'}`);
  return data;
}
export async function productionEnv() {
  const { envs } = await vercelRequest(`/v10/projects/${project.projectId}/env`);
  const values = {};
  for (const env of envs.filter(item => item.target.includes('production'))) {
    const data = await vercelRequest(`/v1/projects/${project.projectId}/env/${env.id}?decrypt=true`);
    values[env.key] = data.value;
  }
  return values;
}
export async function setProductionEnv(key, value) {
  return vercelRequest(`/v10/projects/${project.projectId}/env?upsert=true`, {
    method: 'POST', body: { key, value, type: 'encrypted', target: ['production', 'preview', 'development'] }
  });
}
export { project };
