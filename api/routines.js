const notionProvider = require('./_lib/notionProvider');
const { assertValidRoutineInput } = require('./_lib/validation');

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const routines = await notionProvider.listRoutines();
      return res.status(200).json({ routines });
    }

    if (req.method === 'POST') {
      const routine = assertValidRoutineInput(req.body?.routine);
      const savedRoutine = await notionProvider.saveRoutine(routine);
      return res.status(200).json({ routine: savedRoutine });
    }

    return res.status(405).json({ error: 'Use GET or POST' });
  } catch (error) {
    return res.status(error?.status || 500).json({ error: String(error?.message || error) });
  }
}
