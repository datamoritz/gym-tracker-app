const {
  parseNumber,
  parseInteger,
  normalizeRoutine,
  normalizeWorkoutLog
} = require('./validation');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`${name} not configured`);
    error.status = 500;
    throw error;
  }

  return value;
}

function getNotionHeaders() {
  const notionKey = requireEnv('NOTION_API_KEY');

  return {
    Authorization: `Bearer ${notionKey}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };
}

async function notionRequest(path, { method = 'POST', body } = {}) {
  const response = await fetch(`https://api.notion.com/v1/${String(path).replace(/^\/+/, '')}`, {
    method,
    headers: getNotionHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    const err = new Error(data?.message || text || `Notion request failed with ${response.status}`);
    err.status = response.status;
    throw err;
  }

  return data;
}

function mapExercisePage(page) {
  const properties = page.properties || {};
  const weightText = properties.Weight?.rich_text?.[0]?.plain_text || '0';

  return {
    id: page.id,
    name: properties['Exercise Name']?.title?.[0]?.plain_text || 'Untitled',
    tag: properties.Routine?.select?.name || '',
    sets: parseInteger(properties.Sets?.rich_text?.[0]?.plain_text, 3),
    pause: parseInteger(properties.Pause?.rich_text?.[0]?.plain_text, 90),
    weight: parseNumber(weightText.match(/[\d.]+/)?.[0], 0)
  };
}

function mapRoutinePage(page) {
  const rawJson = page?.properties?.JSON?.rich_text?.[0]?.plain_text;
  if (!rawJson) return null;

  try {
    return normalizeRoutine({
      ...JSON.parse(rawJson),
      notionPageId: page.id
    });
  } catch (error) {
    return null;
  }
}

async function listExercises() {
  const exerciseDbId = requireEnv('EXERCISE_DB_ID');
  const data = await notionRequest(`databases/${exerciseDbId}/query`, {
    body: {
      filter: {
        property: 'Routine',
        select: { is_not_empty: true }
      }
    }
  });

  return (data?.results || []).map(mapExercisePage);
}

async function listRoutines() {
  const routineDbId = requireEnv('ROUTINE_DB_ID');
  const data = await notionRequest(`databases/${routineDbId}/query`, { body: {} });
  return (data?.results || []).map(mapRoutinePage).filter(Boolean);
}

async function saveRoutine(routineInput) {
  const routineDbId = requireEnv('ROUTINE_DB_ID');
  const routine = normalizeRoutine(routineInput);
  const { notionPageId, ...routineData } = routine;

  if (notionPageId) {
    await notionRequest(`pages/${notionPageId}`, {
      method: 'PATCH',
      body: {
        properties: {
          JSON: { rich_text: [{ text: { content: JSON.stringify(routineData) } }] }
        }
      }
    });

    return routine;
  }

  const created = await notionRequest('pages', {
    body: {
      parent: { database_id: routineDbId },
      properties: {
        Name: { title: [{ text: { content: routine.name } }] },
        JSON: { rich_text: [{ text: { content: JSON.stringify(routineData) } }] }
      }
    }
  });

  return { ...routine, notionPageId: created.id };
}

async function logWorkout({ routine, workoutLog, date }) {
  const logDbId = requireEnv('LOG_DB_ID');
  const normalizedRoutine = normalizeRoutine(routine);
  const normalizedLog = normalizeWorkoutLog(workoutLog);

  for (const [exerciseId, sets] of Object.entries(normalizedLog)) {
    const exercise = normalizedRoutine.exercises.find(item => item.id.toString() === exerciseId.toString());
    if (!exercise) continue;

    for (const set of sets) {
      await notionRequest('pages', {
        body: {
          parent: { database_id: logDbId },
          properties: {
            Exercise: { title: [{ text: { content: exercise.name } }] },
            Date: { date: { start: date } },
            Weight: { number: set.w },
            Reps: { number: set.r },
            Rest: { number: parseInteger(exercise.defaultPause, 0) },
            ...(set.note ? { Notes: { rich_text: [{ text: { content: set.note } }] } } : {})
          }
        }
      });
    }
  }

  return { ok: true };
}

module.exports = {
  listExercises,
  listRoutines,
  saveRoutine,
  logWorkout
};
