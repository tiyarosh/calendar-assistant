# Calendar Assistant

React + Node app: Google Calendar OAuth → calendar display → chat agent (Claude tool use) that analyzes schedule and drafts emails.

## Tech Stack

- Frontend: React 18 + Vite 6 + Tailwind CSS 3 (no component library)
- Backend: Node.js + Express (ESM, `"type": "module"`)
- LLM: `claude-sonnet-4-6` via `@anthropic-ai/sdk`
- Auth: Google OAuth 2.0 (Google Identity Services — CDN, not npm)
- Calendar: Google Calendar API v3

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

## Key Patterns

- Google OAuth token is held in `App.jsx` state (session only), passed as props and per-request to backend — backend is stateless, no sessions
- Auth gate in `App.jsx`: `accessToken` null → `LoginScreen`, set → `MainLayout`; `onLogout` threaded down to `CalendarPanel` as `onSessionExpired`
- `CalendarPanel` fetches `calendarList` first, then all calendars' events in parallel (`Promise.all`), merges and sorts by start time, slices to top 10
- Backend proxies chat to Claude API — never exposes `ANTHROPIC_API_KEY` client-side
- Business logic lives in Claude tool use, not Express — the server is intentionally thin
- `get_events` is the only formal Anthropic tool; email drafting and schedule analysis are system prompt instructions (structured output without a tool round-trip)
- Tool use loop: stream → detect `tool_use` blocks → execute → append results → stream again, until `stop_reason !== 'tool_use'`
- Dark mode follows system preference via Tailwind `darkMode: 'media'` — no JS toggle

## SSE / Streaming — Critical Notes

**Do not route chat through the Vite proxy.** Vite's proxy discards SSE response bodies. `ChatPanel` connects directly to `http://localhost:3001` in dev via `import.meta.env.DEV`:

```js
const apiBase = import.meta.env.DEV ? 'http://localhost:3001' : ''
fetch(`${apiBase}/api/chat`, ...)
```

The server has CORS headers on `/api/chat` to allow this cross-origin request.

**Use `res.on('close', ...)` not `req.on('close', ...')` for disconnect detection.** `req.on('close')` fires when the POST request body is consumed (immediately after `express.json()` parses it), not when the client disconnects from the SSE stream. Using it sets `aborted = true` before any text is written. `res.on('close')` fires when the actual response connection drops.

**SSE keepalive:** A `setInterval` sends `: ping\n\n` every 3 seconds during tool execution to hold the connection open while Google Calendar API calls resolve.

**`res.flushHeaders()`** is called immediately after setting SSE headers to ensure headers reach the client before the first `res.write()`.

## Dev Commands

Run from their respective directories:

- `cd client && npm run dev` — Vite dev server (port 5173)
- `cd server && npm run server` — Express backend (port 3001)
- `cd client && npm run build` — production build (verified clean)

If port 3001 is already in use: `lsof -ti tcp:3001 | xargs kill`

## Environment Variables

| Variable                | Location            | Description                                      |
| ----------------------- | ------------------- | ------------------------------------------------ |
| `VITE_GOOGLE_CLIENT_ID` | `client/.env.local` | GCP OAuth client ID (baked in at build time)     |
| `ANTHROPIC_API_KEY`     | `server/.env`       | Claude API key — backend only, never client-side |

## API / Integration Notes

- GIS scope: `calendar.readonly` only — MVP is read-only
- Calendar fetch window: now → +7 days, `singleEvents=true` (expands recurring events)
- All-day events use `event.start.date` (no `dateTime`) — parse as `new Date(year, month-1, day)` to avoid UTC offset shift
- 401 from Google Calendar API anywhere in the fetch chain → call `onSessionExpired()` → clears token → back to login
- `get_events` tool on the backend fetches `calendarList` then all calendars in parallel, same pattern as `CalendarPanel` but with Claude-specified time range and up to 50 results per calendar
- Attendees, location, and description are included in tool results so Claude has full context for drafting emails

## Constraints

- No database — session only
- Send email functionality is configured with sendUpdates paramater set to : "none" — attendees are listed but not notified, keeping the human in the loop
- No component library — Tailwind only
- Prioritize working end-to-end over polish

## Milestones

- **Milestone 1 (2026-04-06):** Frontend shell — React + Vite + Tailwind, all four components, clean build
- **Milestone 2 (2026-04-07):** Google OAuth (real GIS) + live multi-calendar event fetching
- **Milestone 3 (2026-04-07):** Dark mode (system preference) + Express backend + Claude SSE streaming chat + `req`/`res` close bug fixed
- **Milestone 4 (2026-04-07):** Full Tool Suite, Token Caching + Auth Expiry
- **Milestone 5 (2026-04-08):** User Acceptance Testing, UI Polish, System Prompt Refinement, and Documentation. Ran through multiple real-world scenarios, including heavy meeting weeks, all-day events, and expired tokens; verified correct tool use, graceful error handling, and overall UX flow
- **Milestone 6 (2026-04-08):** Added foundational tool for creating calendar events (`create_event`) and integrated it into the system prompt instructions, enabling Claude to proactively suggest calendar updates in response to user queries about scheduling. Tested end-to-end flow for event creation, including handling of required fields and edge cases like overlapping events.
- **Milestone 7 (2026-04-09):** Implemented a more intentional and specific advanced feature, brief writter tool, where users can ask the assistant to prepare for upcoming meetings (e.g., "Draft a brief for my 2pm with Sarah about the Q3 roadmap"). The agent uses the get_events tool to fetch the relevant calendar event, then uses the draft_brief tool to generate a concise summary including meeting purpose, attendees, time, and any context the user provides in the conversation. Inspired by interviews with a former executive assistant/chief of staff about calendar management pain points when working with executives. This feature expands on the existing functionality by integrating additional GSuite tool, like Google Drive, to automatically surface relevant documents — the tool-use architecture made this a straightforward addition of a new tool without changing the core agentic loop.
