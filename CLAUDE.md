# Calendar Assistant

React + Node app: Google Calendar OAuth → calendar display → chat agent (Claude tool use) that analyzes schedule and drafts emails.

## Tech Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- LLM: Claude API (Anthropic) with tool use
- Auth: Google OAuth 2.0 (Google Identity Services)
- Calendar: Google Calendar API v3

## Project Structure

- `/client` — React frontend
- `/server` — Express backend (LLM proxy + calendar data enrichment)

## Key Patterns

- Google OAuth token is handled client-side, passed to backend for Calendar API calls
- Backend proxies chat messages to Claude API with tool use (never expose API keys client-side)
- Claude tools: get_events, analyze_schedule, draft_email
- Keep backend thin — it's a proxy, not a full API

## Dev Commands

- `npm run dev` — start frontend (Vite, port 5173)
- `npm run server` — start backend (Express, port 3001)

## Environment Variables

- `GOOGLE_CLIENT_ID` — from GCP console
- `ANTHROPIC_API_KEY` — Claude API key

## Constraints

- No database — session only
- Don't send emails, just draft them in chat
- Prioritize working end-to-end over polish
