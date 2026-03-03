export default function handler(req, res) {
  // simple helper route for the client to know whether the server has a notion
  // key configured. this avoids storing the key in localStorage and prevents
  // the UI from offering a text field for it.
  const notionConfigured = !!process.env.NOTION_API_KEY;
  res.status(200).json({ notionConfigured });
}
