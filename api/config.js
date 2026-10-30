const { requireAccess } = require('./_lib/privateAccess');
export default function handler(req, res) {
  if (!requireAccess(req,res)) return;
  const notionConfigured = Boolean(
    process.env.NOTION_API_KEY &&
    process.env.EXERCISE_DB_ID &&
    process.env.ROUTINE_DB_ID &&
    process.env.FITNESS_DATABASES
  );

  res.status(200).json({
    notionConfigured,
    aiConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
}
