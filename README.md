# Calendar Assistant

An AI-powered calendar assistant that connects to your Google Calendar and lets you have a natural conversation about your schedule.

---

## Project Overview

Calendar Assistant is a full-stack web app that authenticates with Google Calendar via OAuth, displays your upcoming events, and lets you chat with an AI agent that reasons over your real schedule data. The agent can analyze your meeting load, surface scheduling patterns, and draft emails — all grounded in your actual calendar.

---

## Features

- Google OAuth 2.0 sign-in — no passwords, no database
- Live Google Calendar event display
- Conversational AI agent powered by Claude with tool use
- Schedule analysis: meeting load, free-time detection, conflict spotting
- Email drafting: the agent writes scheduling emails, you send them
- Session-only — nothing is persisted beyond your browser session

---

## Quick Start

**Prerequisites:** Node.js 18+, a Google Cloud project with Calendar API enabled, and an Anthropic API key.

1. Clone the repo and install dependencies:

   ```bash
   git clone <repo-url>
   cd calendar-assistant
   cd client && npm install
   cd ../server && npm install
   ```

2. Copy the example env files and fill in your keys:

   ```bash
   cd client
   cp .env.example .env.local
   ```

   ```bash
   cd server
   cp .env.example .env
   ```

3. Start both servers:

   ```bash
   # Terminal 1 — frontend (port 5173)
   cd client && npm run dev

   # Terminal 2 — backend (port 3001)
   cd server && npm run server
   ```

4. Open `http://localhost:5173`, sign in with Google, and start chatting.

---

## How to Run

| Command                       | Description                        |
| ----------------------------- | ---------------------------------- |
| `cd client && npm run dev`    | Start Vite dev server on port 5173 |
| `cd server && npm run server` | Start Express backend on port 3001 |
| `cd client && npm run build`  | Build frontend for production      |

The Vite dev server proxies all `/api` requests to `localhost:3001`, so no CORS config is needed during development.

---

## Project Structure

```
calendar-assistant/
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx            # Auth gate — routes between login and main layout
│   │   ├── index.css          # Tailwind CSS directives
│   │   └── components/
│   │       ├── LoginScreen.jsx    # Google OAuth sign-in
│   │       ├── MainLayout.jsx     # Header + two-panel shell
│   │       ├── CalendarPanel.jsx  # Upcoming events list
│   │       └── ChatPanel.jsx      # Conversational chat UI
│   ├── vite.config.js         # Vite config + /api proxy
│   ├── tailwind.config.js
│   └── package.json
├── server/                    # Express backend (coming soon)
│   └── ...
├── .env.example               # Required environment variables
├── CLAUDE.md                  # Claude Code project instructions
└── README.md
```

---

## Technical Details

**Frontend**

- React 18 with hooks for all state
- Vite for fast local dev and production builds
- Tailwind CSS for styling — no component library
- Google Identity Services (GIS) for OAuth — token handled entirely client-side and passed to the backend per request

**Backend**

- Node.js + Express, intentionally thin — acts as a proxy, not a full API
- Proxies chat messages to the Claude API, keeping the Anthropic key server-side
- Calls Google Calendar API v3 using the OAuth token from the client

**AI Agent**

- Claude API with tool use (streaming planned)
- Tools: `get_events`, `analyze_schedule`, `draft_email`
- No prompt stuffing — the agent pulls calendar data on demand via tools

**Environment Variables**

| Variable                | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| `VITE_GOOGLE_CLIENT_ID` | OAuth client ID from GCP console (provided for testing) |
| `ANTHROPIC_API_KEY`     | Anthropic API key for Claude (provided by user)         |

---

## Acknowledgments

Built with:

- [Claude API](https://www.anthropic.com) — Anthropic
- [Google Calendar API](https://developers.google.com/calendar) — Google
- [Vite](https://vitejs.dev), [React](https://react.dev), [Tailwind CSS](https://tailwindcss.com)

---

## Milestones / Key Decisions / Change Log

### Milestone 1 — Frontend Shell (2026-04-06)

Scaffolded the React + Vite + Tailwind client. Established the two-panel layout (calendar list + chat), auth gate pattern (`App.jsx` routing on token presence), and the component structure that will carry through the rest of the build.

**Key decisions:**

- OAuth token is owned client-side and passed per-request to the backend — keeps the backend stateless and avoids session management
- Backend is a deliberate proxy, not a full API — business logic lives in Claude's tool use, not Express routes
- No component library — Tailwind only, to keep the bundle lean and styling explicit
- No database — session-only scope keeps the MVP tight and avoids auth/persistence complexity

### Milestone 2 — Google OAuth + Live Calendar Fetching (2026-04-07)

Replaced mock auth and skeleton placeholders with real Google Identity Services OAuth and live Calendar API data. The app now signs users in, fetches events across all their calendars, and renders them in a sorted, color-coded list.

**Key decisions:**

- GIS loaded via CDN script tag (not npm) — no package needed, and the implicit token flow is sufficient for a client-side-only auth model
- `calendar.readonly` scope only — matches the read-only nature of the MVP; no write access requested
- All calendars fetched in parallel via `Promise.all` over `calendarList` — avoids the simpler primary-calendar-only approach so multi-calendar users get full coverage
- Events merged and sorted client-side after fetching — keeps each per-calendar request simple and avoids a server-side aggregation step
- 7-day rolling window with `singleEvents=true` — expands recurring events so they appear as individual items; scoped to one week to keep the list relevant
- 401 anywhere in the fetch chain signs the user out immediately — simple and safe for a session-only app with no silent re-auth complexity

### Milestone 3 — Express Backend + Claude Chat (2026-04-07)

Scaffolded the Express server and wired the full chat pipeline end-to-end: user message → backend → Claude API with tool use → SSE stream → live bubble in the UI. The assistant can now fetch real calendar data mid-conversation and respond with schedule analysis and drafted emails.

**What was built:**

- `server/server.js` — single-file Express server with one route: `POST /api/chat`
- Tool use loop — streams Claude's response, intercepts `get_events` tool calls, fetches live events from Google Calendar API across all calendars, appends results, and continues streaming until no further tool calls are made
- System prompt injected per request with today's date, `get_events` usage rules, email drafting format, and general behavior guidelines (user-designed)
- SSE keepalive (`: ping` every 3s) sent during tool execution to hold the connection open while Calendar API calls resolve
- `ChatPanel` fully wired — reads the SSE stream chunk by chunk, appends text to the assistant bubble in real time, shows a blinking cursor while streaming, disables input during in-flight requests

**Key decisions:**

- Business logic in Claude tool use, not Express — the server is intentionally thin; Claude decides when to call `get_events` and what to do with the results
- System prompt over formal tool definitions for email drafting and schedule analysis — structured instructions in the prompt produce more consistent output than leaving format to Claude's discretion each time
- `get_events` fetches live from Google Calendar at tool-call time — Claude controls the time range and can ask for data beyond the initial 7-day window shown in the panel
- CORS on `/api/chat` + direct connection from frontend — Vite's proxy discards SSE response bodies; the frontend bypasses it in dev using `import.meta.env.DEV` with `http://localhost:3001` directly
- `res.on('close')` for disconnect detection, not `req.on('close')` — see debug note below

**Debug: the `req` vs `res` close bug**

The hardest part of this milestone was a subtle Node.js HTTP lifecycle bug that produced empty chat bubbles with no error output.

Symptom: the assistant bubble appeared but stayed empty after every message. Server logs confirmed Claude was streaming text and `res.write()` was being called — but the browser's `reader.read()` returned `done: true` immediately with no body, and the Network tab's EventStream showed nothing.

Diagnosis path:

1. Ruled out SSE parsing — a standalone diagnostic script confirmed the Anthropic SDK's `stream.on('text', ...)` fires correctly and the SSE wire format round-trips cleanly through the frontend parser.
2. Ruled out the Vite proxy — added a `/api/test-sse` smoke-test endpoint; direct fetch from browser console confirmed SSE worked end-to-end from port 3001. Switched the frontend to connect directly and added CORS.
3. Added `aborted` flag logging — server logs revealed `[chat] req close fired — aborted = true` firing immediately after the stream started, _before_ any text events. Because `if (!aborted) send(...)` guarded every write, all text was silently dropped.

Root cause: the disconnect guard was on `req.on('close', ...)`. In Node.js HTTP, `req` is the _inbound_ request stream — it closes as soon as `express.json()` finishes parsing the POST body, which is immediate and expected. `res` is the _outbound_ response stream, and `res.on('close', ...)` is what actually signals that the SSE connection dropped. Changing one word (`req` → `res`) fixed it entirely.

### Milestone 4 — Full Tool Suite, Token Caching + Auth Expiry (2026-04-07)

Completed the tool use layer. All three tools are now formally defined in the Anthropic API call and fully executed server-side. Added server-side token caching and graceful expired-token handling. This milestone concludes major feature development.

**What was built:**

- `analyze_schedule` tool — fetches events internally via the shared `fetchCalendarEvents` helper, computes total meeting hours, average meeting duration, busiest day, per-day breakdown, and all-day vs timed event counts; returns structured data for Claude to narrate
- `draft_email` tool — synchronous, no external calls; Claude supplies `recipient_name`, `subject`, and the full `context` (body); tool packages it into a consistently formatted object
- `TokenExpiredError` class — thrown when Google returns 401 anywhere in the fetch chain; re-propagated out of the tool execution block to the outer catch, which sends `{ type: 'auth_expired' }` via SSE before closing the stream
- `ChatPanel` auth expiry handling — on `auth_expired` event, shows a message in the bubble then calls `onSessionExpired()`, which resets the token in `App.jsx` and returns to the login screen

**Key decisions:**

- Formal tool definitions for all three tools — `get_events`, `analyze_schedule`, and `draft_email` are all defined in the `TOOLS` array passed to the Anthropic API, replacing the earlier approach of embedding email drafting and schedule analysis as system prompt instructions; structured tool definitions produce more consistent, predictable output
- Token caching on the backend — `cachedToken` module-level variable updated on every request that includes an `accessToken`; all Google API calls read from the cache rather than passing the token through every function signature; cache is invalidated immediately on any 401 from Google
- Graceful re-auth over silent failure — a 401 from Google propagates as a typed error all the way to the SSE stream, surfaces a human-readable message in the chat bubble, then signs the user out cleanly; no silent swallowing of auth errors
- `analyze_schedule` computes stats server-side — returns structured data (numbers, breakdowns) for Claude to narrate, rather than asking Claude to do arithmetic over raw event lists
