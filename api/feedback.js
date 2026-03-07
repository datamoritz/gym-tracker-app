export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  const { workout, profile } = req.body || {};
  if (!workout) {
    return res.status(400).json({ error: 'Missing workout data' });
  }

  const prompt = `You are a strength training coach.

Analyze the following workout and give concise feedback.

Focus on:
1. Exercise order
2. Volume per muscle group
3. Rep ranges
4. Progressive overload suggestions
5. Missing muscle groups

Return:
- Overall rating (1–10)
- What was best
- Possible improvements
- 1 concrete progression suggestion

Be concise, in bullets (max 120 words).

---

${JSON.stringify(workout, null, 2)}

---

${JSON.stringify(profile, null, 2)}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 350,
        temperature: 0.7
      })
    });

    const data = await response.json();
    const feedback = data.choices?.[0]?.message?.content || '';
    res.status(200).json({ feedback });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
