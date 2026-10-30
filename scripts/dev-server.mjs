import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../',import.meta.url));
const envFile = path.join(root,'.env.server.local');
if (fs.existsSync(envFile)) Object.assign(process.env,JSON.parse(fs.readFileSync(envFile)));
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url,'http://localhost');
  if (!url.pathname.startsWith('/api/')) return vite.middlewares(req,res,()=>{res.statusCode=404;res.end();});
  try {
    const name = url.pathname.slice('/api/'.length);
    if (!/^[a-z]+$/.test(name)) { res.statusCode=404; return res.end(); }
    const file = path.join(root,'api',`${name}.js`);
    if (!fs.existsSync(file)) {res.statusCode=404;return res.end();}
    let raw='';
    for await (const chunk of req) { raw+=chunk; if (raw.length>1000000) throw new Error('Request too large'); }
    req.body=raw ? JSON.parse(raw) : null; req.query=Object.fromEntries(url.searchParams);
    res.status=code=>{res.statusCode=code;return res;};
    res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
    const source = fs.readFileSync(file,'utf8').replace('export default','return');
    for (const key of Object.keys(createRequire(file).cache)) if (key.startsWith(path.join(root,'api','_lib'))) delete createRequire(file).cache[key];
    const handler = new Function('require',source)(createRequire(file));
    await handler(req,res);
  } catch(error) { console.error(error.message); if(!res.headersSent){res.statusCode=500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Local API error'}));} }
});
const port=Number(process.env.PORT||5174);
server.listen(port,'127.0.0.1',()=>console.log(`Fitness Tracker: http://127.0.0.1:${port}`));
