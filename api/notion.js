export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const { path, body, notionKey } = req.body || {};
    if (!path || !notionKey) {
      return res.status(400).json({ error: "Missing path or notionKey" });
    }

    const url = `https://api.notion.com/v1/${String(path).replace(/^\/+/, "")}`;

    const r = await fetch(url, {
      method: "POST",
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
