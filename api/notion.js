export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    // the client may send whatever it wants, but the real secret lives in an
    // environment variable on the server. we ignore any notionKey provided by
    // the browser so that no sensitive information ever leaves the server.
    const { path, body, method: clientMethod } = req.body || {};
    if (!path) {
      return res.status(400).json({ error: "Missing path" });
    }

    const notionKey = process.env.NOTION_API_KEY;
    if (!notionKey) {
      return res.status(500).json({ error: "Notion API key not configured" });
    }

    // optional simple access control for the endpoint; consumers of the
    // front end should send the matching value in an `x-gym-tracker-key` header.
    // this makes the API unusable from random third parties. the key itself can
    // also be stored in an environment variable (see README/comments).
    const accessKey = process.env.GYM_TRACKER_KEY;
    if (accessKey) {
      const supplied = req.headers['x-gym-tracker-key'];
      if (supplied !== accessKey) {
        return res.status(403).json({ error: 'Invalid API key' });
      }
    }

    const url = `https://api.notion.com/v1/${String(path).replace(/^\/+/, "")}`;

    const httpMethod = ['GET', 'PATCH', 'DELETE'].includes(clientMethod) ? clientMethod : 'POST';
    const r = await fetch(url, {
      method: httpMethod,
      headers: {
        "Authorization": `Bearer ${notionKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body || {})
    });

    const text = await r.text();
    res.status(r.status).send(text);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
