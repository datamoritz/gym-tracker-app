# Gym Tracker App

This is a small React application built with Vite that stores workout routines
locally and synchronises exercise, routine, and workout data with Notion through
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

The frontend now lives in `src/` and is served by Vite. App-facing server
endpoints live in:

* `api/config.js`
* `api/exercises.js`
* `api/routines.js`
* `api/workouts.js`
* `api/feedback.js`

Shared Notion and validation helpers live in `api/_lib/`.

## Frontend Commands

```bash
npm install
npm run dev
npm run build
```

## Tooling

This project now includes a minimal `package.json` with a built-in Node test
script:

```bash
npm test
```

The current tests cover the request/data validation helpers in `api/_lib`.

## Exercise order and weight units

Use the planner's up/down arrows to reorder exercises, then **Save Protocol**.
Each exercise has a kg/lbs toggle in the planner and during a workout. Switching
units keeps the entered number unchanged (20 kg becomes 20 lbs). Already logged
sets retain their original unit and load. Changes during a workout are saved immediately to
the local routine and synced to Notion. Planner changes use **Save Protocol**.

No Notion schema changes are required. Order and `weightUnit` are stored in the
routine database's existing JSON property. Existing exercises default to kg.
The workout log's numeric Weight property continues to store kilograms for
consistent comparisons; pound entries also record their original load in Notes.
Charts display weights in the exercise's selected unit. Exercise library Weight
text can include `lbs` (for example `100 lbs`) to set its initial unit.

## Exercise guides

The info button opens an exercise guide from the workout, each planned exercise,
or an exercise chip in the planner library. Guides use the Exercise Practices
properties **Images** (Files & media), **Muscles Worked**, **Instructions**,
**Common Mistakes** (Text), and **Source URL** (URL). Update these in Notion to
update the guide; no image assets need to be copied into the app.

Opening a guide refreshes its Notion page through `/api/exercises?id=PAGE_ID`
to obtain current, unexpired image URLs. Missing fields are omitted. A saved
library copy provides text when offline; image availability depends on the
Notion file link. New routine entries keep `notionExerciseId` in the existing
routine JSON, so a library rename does not break their guide. Older routines
are matched by name, including the clarified cable raise and pushdown names.

## Workout recovery and gym histories

An unfinished session is saved on the same phone/browser after each change.
The overview shows an in-progress card with **Resume workout**. Back navigation,
opening another view, editing routines, or refreshing does not clear the draft.
It includes the routine snapshot, logged sets, per-exercise inputs and notes,
position, and rest timer deadline. Only confirmed **Discard workout**, or a
successful Notion finish, removes it. Failed/offline finishes keep the draft.
Browser storage must remain available; cross-device recovery is not supported.

Each routine has a Gym field stored in its existing Notion JSON. History and
charts are separated by exercise and gym; blank legacy gyms appear as
**Previous gym**. Loads and units remembered on the device are scoped to the
exercise and gym. Individual machine profiles are deferred.

The workout API adds missing Text properties **Gym**, **Session ID**, **Set ID**,
and **Exercise ID** to the existing log database. Old entries are left intact.
Stable session/set identifiers allow a failed, partially completed upload to
skip sets that already reached Notion when retried. Weight remains canonical
kg in the existing numeric column, with original pound loads retained in Notes.

Completing a session saves the workout without requesting AI analysis. Use
**Get AI Feedback** on the completion screen to request it; failures can be retried.
