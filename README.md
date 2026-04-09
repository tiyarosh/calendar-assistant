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

This section walks you through everything from scratch. If you're comfortable working with the CLI, the short version is: install Node 18+, add your keys to `client/.env.local` and `server/.env`, run `npm install` in both directories, and start each server in its own terminal tab.

---

### Step 1 — Install Node.js

Node.js is the JavaScript runtime that powers the backend server. You need version 18 or later.

**Check if you already have it:**

Open a terminal and run:

- **Mac:** press `Cmd + Space`, type `Terminal`, press Enter
- **Windows:** press `Win + X` and choose **Terminal** (or search for "PowerShell" in the Start menu)


```bash
node --version
```

If you see `v18.x.x` or higher, you're good. If you get "command not found" or an older version, download the latest LTS release from [nodejs.org](https://nodejs.org) and run the installer.

---

### Step 2 — Get an Anthropic API Key

The AI assistant is powered by Claude. You need an API key to use it.

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign up or log in.
2. In the left sidebar, click **API Keys**.
3. Click **Create Key**, give it a name (e.g. "Calendar Assistant"), and copy the key. Save it somewhere — you won't be able to see it again.

---

### Step 3 — Download the Code

If you have Git installed:

```bash
git clone <repo-url>
cd calendar-assistant
```

If you don't have Git, click the **Code** button on the GitHub page and choose **Download ZIP**. Unzip it, then open a terminal and navigate into the folder:

```bash
cd path/to/calendar-assistant
```

---

### Step 4 — Add Your API Keys

The app reads secrets from local config files that are never committed to the repo. Example files are included to make this easy.

**Frontend config** — the Google Client ID is already provided in the example file. Just copy it:

```bash
cd client
cp .env.example .env.local
```

> **Windows Command Prompt:** use `copy .env.example .env.local` instead. PowerShell users can use `cp` as written above.

**Backend config** — copy the example, then open `server/.env` in any text editor and replace the placeholder with your Anthropic API key from Step 2:

```bash
cd server
cp .env.example .env
```

> **Windows Command Prompt:** use `copy .env.example .env` instead.

Open `server/.env` and it will look like this — replace the placeholder with your real key:

```
ANTHROPIC_API_KEY="your-anthropic-api-key-here"
```

---

### Step 5 — Install Dependencies

In your terminal, run these four commands one at a time:

```bash
cd client
npm install
cd ../server
npm install
```

This downloads the packages each part of the app needs. It only takes a minute or two.

---

### Step 6 — Start the App

The app has two parts that run simultaneously — a frontend and a backend. You need to run them in **two separate terminal windows or tabs**.

**Terminal 1 — start the frontend:**

```bash
cd client
npm run dev
```

You'll see output ending in something like `Local: http://localhost:5173`. Leave this terminal running.

**Terminal 2 — start the backend:**

Open a new terminal window or tab (Mac: `Cmd + T` in Terminal — Windows: `Ctrl + T` in Windows Terminal, or open a new PowerShell window), navigate back to the project folder, then run:

```bash
cd server
npm run server
```

You'll see `Server listening on port 3001`. Leave this running too.

---

### Step 7 — Open the App

Go to [http://localhost:5173](http://localhost:5173) in your browser. Click **Sign in with Google**, authorize the app with the Google account you added as a test user in Step 3, and start chatting.

---

## How to Run

Both servers need to be running at the same time whenever you use the app. Open two terminal tabs, one for each:

| Terminal | Command                       | What it does                        |
| -------- | ----------------------------- | ----------------------------------- |
| 1        | `cd client && npm run dev`    | Starts the frontend on port 5173    |
| 2        | `cd server && npm run server` | Starts the backend API on port 3001 |

To stop either server, click into that terminal window and press `Ctrl + C`.

If the backend won't start because port 3001 is already in use, run this to free it:

**Mac / Linux:**
```bash
lsof -ti tcp:3001 | xargs kill
```

**Windows (PowerShell):**
```powershell
Stop-Process -Id (netstat -ano | Select-String ":3001" | ForEach-Object { ($_ -split '\s+')[-1] }) -Force
```

Then start the server again.

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
│   │       ├── CalendarPanel.jsx  # Daily/weekly/monthly/upcoming views with grid, nav, and event popup
│   │       └── ChatPanel.jsx      # Conversational chat UI
│   ├── vite.config.js         # Vite config + /api proxy
│   ├── tailwind.config.js
│   └── package.json
├── server/                    # Node.js + Express backend
│   ├── server.js              # Single-file Express server — tools, prompt, SSE chat handler
│   │   ├── TOOLS              # Anthropic tool definitions: get_events, analyze_schedule, draft_email
│   │   ├── buildSystemPrompt()       # Injects today's date and plain-text behavior instructions
│   │   ├── formatDisplayDateTime()   # Formats event dates in the user's IANA timezone
│   │   ├── fetchCalendarEvents()     # Shared Google Calendar fetch (calendarList + parallel events)
│   │   ├── executeGetEvents()        # Runs get_events tool — supports optional calendar_name filter
│   │   ├── executeAnalyzeSchedule()  # Computes meeting load stats for Claude to narrate
│   │   ├── executeDraftEmail()       # Packages email fields into a consistent formatted result
│   │   └── POST /api/chat     # SSE endpoint — tool use loop, keepalive pings, auth expiry handling
│   ├── .env                   # ANTHROPIC_API_KEY (gitignored)
│   └── package.json
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

## Milestone 5 - User Acceptance Testing, UI Polish, System Prompt Refinement, and Documentation (2026-04-08)

- User acceptance testing — ran through multiple real-world scenarios, including heavy meeting weeks, all-day events, and expired tokens; verified correct tool use, graceful error handling, and overall UX flow

- Bugs identified and fixed:
  - Remove unnecessary '#', '\*' markdown characters from the assistant's response: fixed by adding a simple regex replacement in the frontend after receiving each text chunk, ensuring cleaner display in the chat bubble
  - Request to draft email in different tone did not produce email within chat bubble: fixed by ensuring `draft_email` tool returns the full email object and that the system prompt instructs Claude to include the email content in its response
  - Scroll functionality of the chat window: fixed by adjusting CSS to ensure the chat panel scrolls independently of the main layout
  - Click into events functionality missing from calendar panel: added an `onClick` handler to each event item that opens the corresponding Google Calendar event in a pop-up window.
  - Text spacing issues in the response from the chat in the bubble: fixed by adding CSS rules to ensure consistent spacing between lines and paragraphs in the assistant's responses.
  - Accessing information about events on a specific calendar when referencing that calendar by name in the chat; filter events in the panel based on specific calendar: enhanced the `get_events` tool to accept an optional `calendar_name` parameter, allowing users to specify which calendar's events they want to retrieve.
  - Mis represents what day certain fetched events are occuring on (calendar events from google api are correct, but response from chat is not, usually off by a day): fixed by ensuring that the `get_events` tool returns event data with properly formatted dates and times, and that the system prompt instructs Claude to narrate event times accurately.
  - UI enhancements to calendar events panel; daily, weekly, monthly, and yearly toggles. If daily is selected, transform the events panel to show only the events for the current day, structured by time. adjusts the chat window portion of the page accprdingly. If weekly is selected, transform the web page and events panel to show the events for the current week, structured by day and time and move and arrange chat window on page appropriately. If monthly is selected, transform the web page and events panel to show the events for the current month, structured by week and day. If yearly is selected, transform the web page and events panel to show the events for the current year, structured by month and day. In each toggle case, ensure the chat window remains functional and appropriately sized, allowing users to interact with the assistant while viewing their calendar events in the selected time frame. Also include a toggle to return to the default view showing all upcoming events. Each toggle can have directional arrows to indicate the ability to navigate forward and backward in time within the selected view (e.g., next week, previous month)

## Milestone 6 - Specific and foundational Features (2026-04-08)

- Calendar Event Creation:
  Users can ask the assistant to create calendar events through natural language (e.g., "Schedule a meeting with Dan on Thursday at 2pm"). The agent uses the create_event tool to create events via the Google Calendar API with support for attendees, custom durations, and descriptions. Events are created with sendUpdates: "none" — attendees are listed but not notified, keeping the human in the loop. In production, a confirmation step would let users review event details and explicitly approve sending invitations before any outbound communication.

## Milestone 7 - Advanced Features (2026-04-08)

- Meeting Brief Drafting:
  Users can ask the assistant to prepare for upcoming meetings (e.g., "Draft a brief for my 2pm with Sarah about the Q3 roadmap"). The agent uses the get_events tool to fetch the relevant calendar event, then uses the draft_brief tool to generate a concise summary including meeting purpose, attendees, time, and any context the user provides in the conversation. Inspired by interviews with a former executive assistant/chief of staff about calendar management pain points when working with executives. This feature expands on the existing functionality by integrating additional GSuite tool, like Google Drive, to automatically surface relevant documents — the tool-use architecture made this a straightforward addition of a new tool without changing the core agentic loop.
