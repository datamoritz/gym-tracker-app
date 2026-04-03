const notionProvider = require('./_lib/notionProvider');
const { assertValidWorkoutInput } = require('./_lib/validation');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  try {
    const payload = assertValidWorkoutInput(req.body);
    const result = await notionProvider.logWorkout(payload);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error?.status || 500).json({ error: String(error?.message || error) });
  }
}
