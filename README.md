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

2. Copy the example env file and fill in your keys:
   ```bash
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

| Command | Description |
|---|---|
| `cd client && npm run dev` | Start Vite dev server on port 5173 |
| `cd server && npm run server` | Start Express backend on port 3001 |
| `cd client && npm run build` | Build frontend for production |

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

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client ID from GCP console |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |

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
