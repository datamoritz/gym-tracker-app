const notionProvider = require('./_lib/notionProvider');
const { assertValidWorkoutInput, assertValidWorkoutQuery } = require('./_lib/validation');

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const query = assertValidWorkoutQuery(req.query);
      const workouts = await notionProvider.listWorkoutEntries(query);
      return res.status(200).json({ workouts });
    }

    if (req.method === 'POST') {
      const payload = assertValidWorkoutInput(req.body);
      const result = await notionProvider.logWorkout(payload);
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Use GET or POST' });
  } catch (error) {
    return res.status(error?.status || 500).json({ error: String(error?.message || error) });
  }
}
