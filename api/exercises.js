const notionProvider = require('./_lib/notionProvider');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Use GET' });
  }

  try {
    const exercises = await notionProvider.listExercises();
    return res.status(200).json({ exercises });
  } catch (error) {
    return res.status(error?.status || 500).json({ error: String(error?.message || error) });
  }
}
