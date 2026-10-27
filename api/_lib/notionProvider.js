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
  let response;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(`https://api.notion.com/v1/${String(path).replace(/^\/+/, '')}`, {
      method,
      headers: getNotionHeaders(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    if (response.status !== 429 || attempt === 3) break;
    const seconds = Number(response.headers?.get('retry-after')) || 1;
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

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
  const richText = name => (properties[name]?.rich_text || [])
    .map(item => item.plain_text ?? item.text?.content ?? '').join('');

  return {
    id: page.id,
    name: properties['Exercise Name']?.title?.[0]?.plain_text || 'Untitled',
    tag: properties.Routine?.select?.name || '',
    sets: parseInteger(properties.Sets?.rich_text?.[0]?.plain_text, 3),
    pause: parseInteger(properties.Pause?.rich_text?.[0]?.plain_text, 90),
    weight: parseNumber(weightText.match(/[\d.]+/)?.[0], 0),
    weightUnit: /\b(lbs?|pounds?)\b/i.test(weightText) ? 'lbs' : 'kg',
    musclesWorked: richText('Muscles Worked'),
    instructions: richText('Instructions'),
    commonMistakes: richText('Common Mistakes'),
    sourceUrl: properties['Source URL']?.url || '',
    images: (properties.Images?.files || []).map(file => ({
      name: file.name || 'Exercise illustration',
      url: file.file?.url || file.external?.url || '',
      expiryTime: file.file?.expiry_time || null
    })).filter(image => image.url)
  };
}

function mapRoutinePage(page) {
  const rawJson = page?.properties?.JSON?.rich_text?.map(item => item.plain_text).join('');
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
  const exercises = [];
  let cursor;
  do {
    const data = await notionRequest(`databases/${exerciseDbId}/query`, {
      body: {
        ...(cursor ? { start_cursor: cursor } : {})
      }
    });
    // Guide entries can be used as alternatives without belonging to a routine.
    exercises.push(...(data.results || []).map(mapExercisePage).filter(exercise =>
      exercise.tag || exercise.instructions || exercise.musclesWorked || exercise.commonMistakes || exercise.images.length));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return exercises;
}

async function getExercise(id) {
  if (typeof id !== 'string' || !/^(?:[a-f\d]{32}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i.test(id)) {
    const error = new Error('Invalid exercise ID');
    error.status = 400;
    throw error;
  }
  const page = await notionRequest(`pages/${id}`, { method: 'GET' });
  const normalizeId = value => String(value || '').replaceAll('-', '').toLowerCase();
  if (normalizeId(page.parent?.database_id) !== normalizeId(requireEnv('EXERCISE_DB_ID')) || page.archived || page.in_trash) {
    const error = new Error('Exercise not found');
    error.status = 404;
    throw error;
  }
  return mapExercisePage(page);
}

async function listRoutines() {
  const routineDbId = requireEnv('ROUTINE_DB_ID');
  const data = await notionRequest(`databases/${routineDbId}/query`, { body: {} });
  return (data?.results || []).map(mapRoutinePage).filter(Boolean);
}

function mapWorkoutPage(page) {
  const properties = page.properties || {};
  const text = name => (properties[name]?.rich_text || []).map(item => item.plain_text ?? item.text?.content ?? '').join('');

  return {
    id: page.id,
    exerciseName: properties.Exercise?.title?.[0]?.plain_text || 'Untitled Exercise',
    gym: text('Gym') || 'Previous gym',
    sessionId: text('Session ID') || null,
    setId: text('Set ID') || null,
    exerciseId: text('Exercise ID') || null,
    date: properties.Date?.date?.start || null,
    weight: parseNumber(properties.Weight?.number, 0),
    reps: parseInteger(properties.Reps?.number, 0),
    restSeconds: parseInteger(properties.Rest?.number, 0),
    notes: properties.Notes?.rich_text?.map(item => item.plain_text).join('').trim() || ''
  };
}

async function ensureWorkoutColumns(logDbId) {
  const database = await notionRequest(`databases/${logDbId}`, { method: 'GET' });
  const missing = {};
  for (const name of ['Gym', 'Session ID', 'Set ID', 'Exercise ID']) {
    const property = database.properties?.[name];
    if (!property) missing[name] = { rich_text: {} };
    else if (property.type !== 'rich_text') throw new Error(`${name} must be a Text property in the workout log`);
  }
  if (Object.keys(missing).length) await notionRequest(`databases/${logDbId}`, { method: 'PATCH', body: { properties: missing } });
}

async function listWorkoutEntries({ limit = 50, startDate = null, endDate = null, gym = null } = {}) {
  const logDbId = requireEnv('LOG_DB_ID');
  await ensureWorkoutColumns(logDbId);
  const filters = [];
  if (gym) {
    const match = { property: 'Gym', rich_text: { equals: gym } };
    filters.push(gym === 'Previous gym' ? { or: [match, { property: 'Gym', rich_text: { is_empty: true } }] } : match);
  }

  if (startDate) {
    filters.push({
      property: 'Date',
      date: { on_or_after: startDate }
    });
  }

  if (endDate) {
    filters.push({
      property: 'Date',
      date: { on_or_before: endDate }
    });
  }

  const workouts = [];
  let cursor;
  do {
    const data = await notionRequest(`databases/${logDbId}/query`, {
      body: {
        page_size: Math.min(100, limit - workouts.length),
        sorts: [{ property: 'Date', direction: 'descending' }],
        ...(cursor ? { start_cursor: cursor } : {}),
        ...(filters.length === 1 ? { filter: filters[0] } : {}),
        ...(filters.length > 1 ? { filter: { and: filters } } : {})
      }
    });
    workouts.push(...(data.results || []).map(mapWorkoutPage));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor && workouts.length < limit);
  return workouts;
}

async function saveRoutine(routineInput) {
  const routineDbId = requireEnv('ROUTINE_DB_ID');
  const routine = normalizeRoutine(routineInput);
  const { notionPageId, ...routineData } = routine;
  // Notion limits each rich-text item to 2,000 characters.
  const json = JSON.stringify(routineData);
  const richText = Array.from({ length: Math.ceil(json.length / 2000) }, (_, index) => ({
    text: { content: json.slice(index * 2000, (index + 1) * 2000) }
  }));

  if (notionPageId) {
    await notionRequest(`pages/${notionPageId}`, {
      method: 'PATCH',
      body: {
        properties: {
          JSON: { rich_text: richText }
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
        JSON: { rich_text: richText }
      }
    }
  });

  return { ...routine, notionPageId: created.id };
}

async function logWorkout({ routine, workoutLog, date, sessionId }) {
  const logDbId = requireEnv('LOG_DB_ID');
  const normalizedRoutine = normalizeRoutine(routine);
  const normalizedLog = normalizeWorkoutLog(workoutLog);
  await ensureWorkoutColumns(logDbId);
  const savedSets = new Set();
  if (sessionId) {
    let cursor;
    do {
      const data = await notionRequest(`databases/${logDbId}/query`, { body: {
        filter: { property: 'Session ID', rich_text: { equals: sessionId } },
        ...(cursor ? { start_cursor: cursor } : {})
      } });
      for (const page of data.results || []) {
        const id = page.properties?.['Set ID']?.rich_text?.map(item => item.plain_text ?? item.text?.content ?? '').join('');
        if (id) savedSets.add(id);
      }
      cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);
  }

  for (const [exerciseId, sets] of Object.entries(normalizedLog)) {
    const exercise = normalizedRoutine.exercises.find(item => item.id.toString() === exerciseId.toString());
    if (!exercise) continue;

    for (const [index, set] of sets.entries()) {
      const setId = set.id || (sessionId ? `${sessionId}:${exerciseId}:${index}` : null);
      if (setId && savedSets.has(setId)) continue;
      const unit = set.weightUnit || exercise.weightUnit;
      // Keep the existing numeric Weight column in kg for comparable history.
      const weightKg = unit === 'lbs' ? set.w * 0.45359237 : set.w;
      const note = [unit === 'lbs' ? `Entered load: ${set.w} lbs` : '', set.note].filter(Boolean).join('\n');
      await notionRequest('pages', {
        body: {
          parent: { database_id: logDbId },
          properties: {
            Gym: { rich_text: [{ text: { content: normalizedRoutine.gym } }] },
            ...(sessionId ? { 'Session ID': { rich_text: [{ text: { content: sessionId } }] } } : {}),
            ...(setId ? { 'Set ID': { rich_text: [{ text: { content: setId } }] } } : {}),
            ...(exercise.notionExerciseId ? { 'Exercise ID': { rich_text: [{ text: { content: exercise.notionExerciseId } }] } } : {}),
            Exercise: { title: [{ text: { content: exercise.name } }] },
            Date: { date: { start: date } },
            Weight: { number: weightKg },
            Reps: { number: set.r },
            Rest: { number: parseInteger(exercise.defaultPause, 0) },
            ...(note ? { Notes: { rich_text: [{ text: { content: note } }] } } : {})
          }
        }
      });
      if (setId) savedSets.add(setId);
    }
  }

  return { ok: true };
}

module.exports = {
  listExercises,
  getExercise,
  listRoutines,
  listWorkoutEntries,
  saveRoutine,
  logWorkout
};
