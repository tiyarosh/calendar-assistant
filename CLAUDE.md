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
client/
├── src/
│   ├── App.jsx                    # Auth gate — routes on accessToken presence
│   ├── index.css                  # Tailwind directives only
│   └── components/
│       ├── LoginScreen.jsx        # GIS OAuth sign-in (real, not mock)
│       ├── MainLayout.jsx         # Header + two-panel shell
│       ├── CalendarPanel.jsx      # Left panel: live calendar events
│       └── ChatPanel.jsx          # Right panel: SSE streaming chat
├── index.html                     # Loads GIS script via CDN (<script async>)
├── vite.config.js                 # Proxies /api → localhost:3001 (not used for chat — see SSE note)
├── tailwind.config.js             # darkMode: 'media'
├── .env.local                     # VITE_GOOGLE_CLIENT_ID (gitignored)
└── package.json
server/
├── server.js                      # Single-file Express server
├── .env                           # ANTHROPIC_API_KEY (gitignored)
└── package.json
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

| Variable | Location | Description |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | `client/.env.local` | GCP OAuth client ID (baked in at build time) |
| `ANTHROPIC_API_KEY` | `server/.env` | Claude API key — backend only, never client-side |

## API / Integration Notes

- GIS scope: `calendar.readonly` only — MVP is read-only
- Calendar fetch window: now → +7 days, `singleEvents=true` (expands recurring events)
- All-day events use `event.start.date` (no `dateTime`) — parse as `new Date(year, month-1, day)` to avoid UTC offset shift
- 401 from Google Calendar API anywhere in the fetch chain → call `onSessionExpired()` → clears token → back to login
- `get_events` tool on the backend fetches `calendarList` then all calendars in parallel, same pattern as `CalendarPanel` but with Claude-specified time range and up to 50 results per calendar
- Attendees, location, and description are included in tool results so Claude has full context for drafting emails

## Constraints

- No database — session only
- Don't send emails — draft inline in chat only
- No component library — Tailwind only
- Prioritize working end-to-end over polish

## Milestones

- **Milestone 1 (2026-04-06):** Frontend shell — React + Vite + Tailwind, all four components, clean build
- **Milestone 2 (2026-04-07):** Google OAuth (real GIS) + live multi-calendar event fetching
- **Milestone 3 (2026-04-07):** Dark mode (system preference) + Express backend + Claude SSE streaming chat + `req`/`res` close bug fixed
