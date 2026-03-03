# Gym Tracker App

This is a small single-page React application that stores workout routines locally
and synchronises with a Notion workspace using the Notion API. It is deployed to
Vercel via the GitHub integration.

## Configuration

To keep your Notion integration token secret, the application no longer accepts
it from the browser. You must configure the key as an environment variable on
your deployment platform (e.g. Vercel, Netlify, etc):

```bash
NOTION_API_KEY=secret_xxx
```

Optionally you can also set an application-level key that the frontend must send
in a header (`x-gym-tracker-key`); if it is provided the server will reject
requests that do not include it. Example:

```bash
GYM_TRACKER_KEY=something-public-but-unguessable
```

When the client starts it will call `/api/config` to determine whether the
Notion integration is available and adjust the UI accordingly.

## Development

The frontend lives in `index.html` and uses unpkg-hosted React, Babel, and
Tailwind. The server endpoints are in `api/notion.js` and `api/config.js`. The
current structure is minimal for prototyping.

### Suggestions for improvement

* Move to a proper bundler or framework (Next.js/Vite/Create‑React‑App) so you
  can split the code into modules, use npm packages, and have type checking.
* Break the monolithic `index.html` into multiple JS/JSX files and import them.
* Add linting, tests, and build scripts.
* Cache Notion responses on the server or schedule a cron job instead of
  fetching from the browser.
* Harden the API route with rate limiting, authentication, or logging.

The above changes have already been partially implemented: the token is stored
server-side, a config endpoint was added, and the client no longer retains the
secret or uses a CORS proxy.
