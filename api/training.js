const { requireAccess } = require('./_lib/privateAccess');
const provider = require('./_lib/trainingProvider');
export default async function handler(req, res) {
  if (!requireAccess(req, res)) return;
  try {
    if (req.method === 'GET') return res.status(200).json({ state: (await provider.readAll()).state });
    if (req.method === 'POST') return res.status(200).json(await provider.mutate(req.body?.operations));
    return res.status(405).json({ error: 'Use GET or POST' });
  } catch (error) {
    return res.status(error.status === 400 || error.status === 409 ? error.status : 503).json({ error: error.status < 500 ? error.message : 'Could not connect to Notion. Your pending changes remain on this device.' });
  }
}
