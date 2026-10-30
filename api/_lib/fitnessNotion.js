const crypto = require('node:crypto');
const VERSION = '2025-09-03';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(path, { method = 'GET', body, version = VERSION } = {}) {
  if (!process.env.NOTION_API_KEY) throw new Error('Notion is not configured');
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(`https://api.notion.com/v1/${path}`, {
      method, headers: { Authorization: `Bearer ${process.env.NOTION_API_KEY}`, 'Notion-Version': version, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const data = await response.json();
    if (response.ok) return data;
    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      await sleep(Math.min(8000, (Number(response.headers.get('retry-after')) || 1 + attempt) * 1000)); continue;
    }
    const error = new Error(`Notion ${response.status}: ${data.message || 'request failed'}`);
    error.status = response.status; throw error;
  }
}
const text = (value = '') => ({ rich_text: Array.from({ length: Math.ceil(String(value).length / 1900) }, (_, i) => ({ text: { content: String(value).slice(i * 1900, (i + 1) * 1900) } })) });
const title = value => ({ title: [{ text: { content: String(value).slice(0, 2000) } }] });
const rich = value => (value?.rich_text || value?.title || []).map(item => item.plain_text ?? item.text?.content ?? '').join('');
const relation = ids => ({ relation: [...new Set(ids || [])].map(id => ({ id })) });
const related = value => (value?.relation || []).map(item => item.id);
async function rows(dataSourceId, filter, limit = Infinity) {
  const result = []; let cursor;
  do {
    const data = await request(`data_sources/${dataSourceId}/query`, { method: 'POST', body: { page_size: Math.min(100, limit - result.length), ...(filter ? { filter } : {}), ...(cursor ? { start_cursor: cursor } : {}) } });
    result.push(...data.results); cursor = data.has_more ? data.next_cursor : null;
  } while (cursor && result.length < limit);
  return result;
}
async function createPage(dataSourceId, properties) {
  return request('pages', { method: 'POST', body: { parent: { type: 'data_source_id', data_source_id: dataSourceId }, properties } });
}
async function updatePage(id, properties) { return request(`pages/${id}`, { method: 'PATCH', body: { properties } }); }
const uuid = value => typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
const stableId = value => {
  const hex = crypto.createHash('sha256').update(value).digest('hex').slice(0,32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
module.exports = { request, text, title, rich, relation, related, rows, createPage, updatePage, uuid, stableId, randomId: () => crypto.randomUUID() };
