# Gym Tracker App

This is a small single-page React application that stores workout routines locally
and synchronises exercise, routine, and workout data with Notion through
server-side Vercel API routes. It is deployed to Vercel via the GitHub integration.

## Configuration

To keep the Notion integration secret server-side, configure these environment
variables on your deployment platform:

```bash
NOTION_API_KEY=secret_xxx
EXERCISE_DB_ID=...
ROUTINE_DB_ID=...
LOG_DB_ID=...
OPENAI_API_KEY=...
```

When the client starts it will call `/api/config` to determine whether the
Notion integration is available and adjust the UI accordingly.

## Development

The frontend lives in `index.html` and uses unpkg-hosted React, Babel, and
Tailwind. App-facing server endpoints live in:

* `api/config.js`
* `api/exercises.js`
* `api/routines.js`
* `api/workouts.js`
* `api/feedback.js`

Shared Notion and validation helpers live in `api/_lib/`.

## Tooling

This project now includes a minimal `package.json` with a built-in Node test
script:

```bash
npm test
```

The current tests cover the request/data validation helpers in `api/_lib`.
