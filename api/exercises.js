const notionProvider = require('./_lib/notionProvider');
const { requireAccess } = require('./_lib/privateAccess');

export default async function handler(req, res) {
  if (!requireAccess(req,res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Use GET' });
  }

  try {
    // Notion-hosted image links expire; always obtain fresh links when a guide opens.
    res.setHeader('Cache-Control', 'no-store');
    if (req.query?.id !== undefined) {
      const exercise = await notionProvider.getExercise(req.query.id);
      return res.status(200).json({ exercise });
    }
    const exercises = await notionProvider.listExercises();
    return res.status(200).json({ exercises });
  } catch (error) {
    return res.status(error?.status || 500).json({ error: String(error?.message || error) });
  }
}
