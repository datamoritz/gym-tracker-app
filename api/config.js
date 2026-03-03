export default function handler(req, res) {
  // simple helper route for the client to know whether the server has a notion
  // key configured. this avoids storing the key in localStorage and prevents
  // the UI from offering a text field for it.
  // expose a few configuration values so that the client doesn't have to
  // hard‑code database ids in the HTML. the values are read from the same
  // environment that the serverless function runs in (e.g. Vercel vars).
  const notionConfigured = !!process.env.NOTION_API_KEY;
  const cfg = {
    notionConfigured,
    // if you want to change these without editing index.html, set them in
    // your deployment environment. they default to null so the client can
    // fall back to its built‑in constants for convenience during local
    // development.
    EXERCISE_DB_ID: process.env.EXERCISE_DB_ID || null,
    ROUTINE_DB_ID: process.env.ROUTINE_DB_ID || null,
    LOG_DB_ID: process.env.LOG_DB_ID || null
  };
  res.status(200).json(cfg);
}
