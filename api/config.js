export default function handler(req, res) {
  const notionConfigured = Boolean(
    process.env.NOTION_API_KEY &&
    process.env.EXERCISE_DB_ID &&
    process.env.ROUTINE_DB_ID &&
    process.env.LOG_DB_ID
  );

  res.status(200).json({
    notionConfigured,
    aiConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
}
