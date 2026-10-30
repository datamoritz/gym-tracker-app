# Gym Tracker

Personal, private gym tracker. Flexible **Next** is the default; original routines remain at `/?mode=routines`.

## Running locally

```sh
npm install
npm run dev:full
npm test
npm run build
```

The full local server defaults to `http://127.0.0.1:5174` and serves the same API handlers as Vercel. It reads the ignored, permission-restricted `.env.server.local` JSON configuration. `npm run dev` serves the frontend alone; the isolated historical dummy preview is development-only at `/?mode=preview`. Production never initializes that sample or imports its history, and clears the old preview storage key after a successful real-data load.

## Production configuration

All credentials stay server-side:

- `NOTION_API_KEY`: existing Fitness_App connection.
- `EXERCISE_DB_ID`: existing Exercise Practices catalog.
- `ROUTINE_DB_ID`: existing routines, preserved.
- `LOG_DB_ID`: new Workout Log database, never the original log.
- `FITNESS_DATABASES`: JSON mapping entity keys to database/data-source IDs, plus `parentPageId` and `settingsId`.
- `FITNESS_AUTH_SECRET`: random secret of at least 32 characters for signed device invitations and sessions.
- `OPENAI_API_KEY`: optional, used only when requesting feedback in the original routines UI.

`api/_lib/fitnessNotion.js` uses Notion API version 2025-09-03 and data-source IDs. The existing exercise-guide/routine adapter retains the original compatible database endpoints. No route uses the old workout-log provider. `/api/workouts` adapts routine sets to the new domain and new log, including explicit equipment identity and target credit.

`node scripts/configure-fitness.mjs --production` installs encrypted deployment configuration using the existing Vercel login. The ignored `.fitness-setup.json` records provisioning IDs and the original catalog snapshot. Provisioning is resumable; do not replace that manifest or blindly run it against another workspace. These administrative scripts are excluded from deployment, along with local configuration, snapshots and user image files.

## Private access

Open a signed access link once per browser/device. The fragment is removed before exercise content or external images render; it is exchanged for a Secure, HttpOnly, SameSite=Strict cookie lasting up to one year. Initial owner links are time-limited; Settings → Connect another device creates a 15-minute link. Clearing browser data or cookie expiry requires a new link from an authenticated device. Rotating the server secret revokes all existing sessions and invitations.

Every data/feedback endpoint checks the session; writes additionally require same-origin JSON. The unauthenticated app shell contains no workout data. Sign out clears the device's production cache after pending writes have synced. Private links are credentials: do not commit, publish, or log them. Tailwind is compiled locally; no third-party runtime script executes on the sign-in page.

## Notion structure

Fitness Tracker contains the app link, links to the existing catalog/routines, and a Databases child page containing:

| Database | Role |
|---|---|
| Exercise Practices (existing) | Exercise names, guides/images, optional compound/isolation type, primary/supporting muscle relations and equipment relations |
| Gyms | SF Ocean initially |
| Equipment | Physical/comparable resistance profiles, gym and linked exercises |
| Muscles | Shared, stable muscle records |
| Targets | Explicit eligible exercises, frequency, qualifying/recommended sets, reps, priority, active/optional and recovery settings |
| Training Sessions | Session dates, gym and resume/rest state |
| Workout Log | One physical working set per row, exact exercise/equipment/session, target links and credit snapshots |
| App Settings | Time zone, selected gym and ranking settings |

Original Exercise Practices rows, columns, guide content and images are preserved. Added properties are `Primary muscles`, `Supporting muscles`, `Equipment profiles`, `Exercise type`, `Tracker active` and `Tracker ID`. The existing Equipment multi-select and muscle text/multi-select fields remain unchanged. `Equipment profiles` is a **two-way relation** to Equipment's `Linked exercises`; the app writes this same relation. Unlinking never deletes an exercise, machine or history.

Original exercises use their Notion page IDs. App-created catalog exercises retain a `Tracker ID`; other entities use immutable App ID UUIDs. Notion relation values resolve page IDs to these application IDs. Renaming labels does not change identity, credit or history. App ID/Data fields are internal storage, not labels shown in the app.

## Initial plan

The agreed 14 targets remain active and required. Chest press and seated row qualify at **two working sets** on either occasion; recommended weekly doses remain **3 + 2**. Leg press and seated leg curl default to **two sets**, once per seven days; their play screens show the light-work guidance. Wood chops and dead bugs remain required. No A/B/C grouping is enforced.

Explicit alternatives share target credit:

- Vertical pull: dedicated seated cable pulldown or vertical traction.
- Chest fly: low-to-high cable fly or pec deck.
- Rear delts: reverse pec deck or cable rear-delt fly.
- Biceps: cable curls or biceps curl machine.

Other catalog exercises do not automatically become weekly targets. SF Ocean starts with three distinct cable tower profiles, two seated cable row profiles, a dedicated pulldown station, shoulder press, chest press, pec deck, biceps curl, triceps extension, vertical traction, leg press, leg curl, leg extension and floor mats. Pec deck/reverse share equipment. Each tower's cable exercises have independent progress histories. No dummy history or original-log history is imported.

## Credit, ranking and progress

- **Credit:** explicit exercise-to-target mappings. One occasion per target per local calendar day after qualifying sets; combine sessions and setups that day. An incomplete day cannot borrow sets from another date.
- **Fatigue:** shared primary/supporting muscle IDs. Partial working sets count immediately; each physical set counts once regardless of how many targets it credits.
- **Progress:** exact exercise ID + comparable equipment ID, with unit conversion inside that pair. A shared target never combines weight curves.

Each set snapshots the target activity, qualifying threshold, prescription and rep range at log time. Later mapping/prescription changes do not rewrite past credit. The earliest remaining working set fixes that day's threshold, regardless of Notion's result order. A rolling window includes today and the previous six local dates; no missed-week debt accumulates. `finished_today` and `rolling_target_met` are derived separately and recalculated after removal, undo and expiry.

Next follows `gym filter → target status → muscle modifiers → score → bucket → sort`.

```
score = (remaining occasions / frequency × personal priority)
        × fatigue modifier
        + continuation bonus − isolation ordering adjustment
```

Primary involvement weighs 1, supporting involvement defaults to 0.35. A past set's normalized overlap is capped at one equivalent set. One fatigue modifier is `1 / (1 + weighted sets × penalty)`. Each set's influence fades linearly with elapsed hours: full influence when logged, half after 24 hours, zero at 48 hours by default. Today's and earlier sets enter this same factor once, with no handover at midnight and no calendar/DST rounding. The target editor shows the recovery duration in hours; the existing Notion `Recovery days` value remains a duration of 24-hour units for compatibility (2 = 48 hours, 1.5 = 36 hours). Zero disables fatigue penalties. Defaults: fatigue penalty 0.35, continuation bonus 0.08, isolation penalty up to 0.12. Previously saved recovery penalty/threshold values migrate to the unified settings; the separate session controls are retired. Demanding compounds are a soft preference, never a guaranteed order. Weight/reps/volume do not enter ranking.

Recommended means unmet with fatigue suitability ≥0.70. Other options contains reduced-suitability or optional targets. Done means today's qualifying sets are finished or the rolling target is met. Buckets precede score. Near-equal scores favor different primary muscles from the most recent working set, then plan order. All buckets remain selectable. Equipment stays alphabetical. Settings → Ranking explains and configures the rules.

## Persistence and recovery

The production cache and pending outbox share one atomic localStorage entry, `fitness_notion_v1`. Logging updates the screen immediately. The UI distinguishes Pending sync, Saving and Saved; only acknowledgement removes an operation from the outbox. Reconnect, foregrounding, explicit Sync and periodic refresh retry pending work. A failed write or unavailable storage is surfaced. Export includes the cached state and pending operations.

The backend patches only changed fields and checks their base values to detect competing Notion/device edits. Conflicts keep pending work for export/retry; Use Notion version requires explicit discard confirmation. Stable set UUIDs make retries idempotent, and deleted sets use recoverable tombstones so Undo restores the same ID. Notion date columns round to minutes, so precise JSON timestamps are retained when the displayed minute matches. Notion is not a transactional database; simultaneous independent writes to the same record should be avoided.

A phone needs a connection to initially open/sign in and load data. An already-open signed-in app queues changes during connection failures. There is no service worker claiming a fully offline launch. Fresh synced sets and sessions are available on other authenticated devices.

## Verification

`npm test` covers ranking, rolling/local-day credit, ID relationships, machine-specific histories, validation, auth, mutation retry/conflict behavior and timestamp precision. The full build compiles both the new screen and original routines. Administrative verification scripts exercise the live new log and authoritative relation using explicitly marked temporary sets, then remove/archive those test rows. Source-preservation verification checks every original exercise row and all original property values.
