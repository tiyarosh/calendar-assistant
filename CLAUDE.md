# Calendar Assistant

React + Node app: Google Calendar OAuth → calendar display → chat agent (Claude tool use) that analyzes schedule and drafts emails.

## Tech Stack

- Frontend: React 18 + Vite 6 + Tailwind CSS 3 (no component library)
- Backend: Node.js + Express
- LLM: Claude API (Anthropic) with tool use
- Auth: Google OAuth 2.0 (Google Identity Services)
- Calendar: Google Calendar API v3

## Project Structure

```
client/
├── src/
│   ├── App.jsx                    # Auth gate — routes on accessToken presence
│   ├── index.css                  # Tailwind directives only
│   └── components/
│       ├── LoginScreen.jsx        # Google sign-in button
│       ├── MainLayout.jsx         # Header + two-panel shell
│       ├── CalendarPanel.jsx      # Left panel: upcoming events list
│       └── ChatPanel.jsx          # Right panel: chat UI + message history
├── vite.config.js                 # Proxies /api → localhost:3001
├── tailwind.config.js
└── package.json
server/                            # Not yet scaffolded
```

## Key Patterns

- Google OAuth token is handled client-side, passed to backend per-request — backend is stateless
- Backend proxies chat messages to Claude API with tool use (never expose API keys client-side)
- Claude tools: `get_events`, `analyze_schedule`, `draft_email`
- Keep backend thin — business logic lives in Claude's tool use, not Express routes
- Auth gate in `App.jsx`: `accessToken` state null → LoginScreen, set → MainLayout
- No CORS config needed in dev — Vite proxy handles `/api` → `:3001` forwarding

## Dev Commands

Run from their respective directories:

- `cd client && npm run dev` — start frontend (Vite, port 5173)
- `cd server && npm run server` — start backend (Express, port 3001)

## Environment Variables

- `GOOGLE_CLIENT_ID` — from GCP console (used client-side for GIS)
- `ANTHROPIC_API_KEY` — Claude API key (backend only, never client-side)

## Constraints

- No database — session only
- Don't send emails, just draft them in chat
- Prioritize working end-to-end over polish
- No component library — Tailwind only

## Build Status

- `cd client && npm run build` produces a clean build (verified)
- `server/` directory not yet created — backend is next milestone

## Milestones

- **Milestone 1 (2026-04-06):** Frontend shell complete. React + Vite + Tailwind scaffolded, all four shell components written, build verified clean.
