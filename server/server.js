import 'dotenv/config'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
app.use(express.json())

// Allow the Vite dev server to connect directly (bypassing the proxy for SSE)
app.use('/api/chat', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Token cache ───────────────────────────────────────────────────────────────
// Single-user MVP — stores the Google OAuth token in memory so it doesn't
// need to be sent on every request. Updated on receipt; invalidated on 401.

let cachedToken = null

class TokenExpiredError extends Error {
  constructor() { super('Google token expired — please sign in again') }
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_events',
    description: "Fetch the user's Google Calendar events across all calendars for a given date range. Use this for specific event lookups or when you need the raw event list.",
    input_schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start of the range as an ISO 8601 datetime string (e.g. 2026-04-07T00:00:00Z).',
        },
        end_date: {
          type: 'string',
          description: 'End of the range as an ISO 8601 datetime string.',
        },
        max_results: {
          type: 'integer',
          description: 'Maximum total events to return. Defaults to 20.',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'analyze_schedule',
    description: "Fetch and analyze the user's meeting load for a date range. Returns total meeting hours, busiest day, per-day breakdown, and the full event list for Claude to narrate. Use this for questions about busyness, free time, meeting patterns, or schedule summaries.",
    input_schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start of the analysis window as an ISO 8601 datetime string.',
        },
        end_date: {
          type: 'string',
          description: 'End of the analysis window as an ISO 8601 datetime string.',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'draft_email',
    description: 'Format and return an email draft. Always call this tool when the user asks you to write, draft, or compose an email — never write email drafts as plain text. You supply all content; the tool packages it consistently.',
    input_schema: {
      type: 'object',
      properties: {
        recipient_name: {
          type: 'string',
          description: 'Name (and optionally email address) of the recipient.',
        },
        subject: {
          type: 'string',
          description: 'Email subject line.',
        },
        context: {
          type: 'string',
          description: 'Full email body text. Write this as a complete, ready-to-send email.',
        },
      },
      required: ['recipient_name', 'subject', 'context'],
    },
  },
]

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt() {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `# Calendar Assistant

You are a highly capable calendar assistant. Today's date is **${date}**.

## Tools Available

- \`get_events\` — fetch raw calendar events for a date range
- \`analyze_schedule\` — fetch events and compute meeting load stats; use this for questions about busyness, free time, or schedule patterns
- \`draft_email\` — format and present an email draft; always use this tool when composing emails

## Instructions

### Calendar Queries
1. Always call \`get_events\` or \`analyze_schedule\` before answering questions about the user's schedule. Do not guess or assume what is on the calendar.
2. Use \`analyze_schedule\` for questions about meeting load, free time, or patterns. Use \`get_events\` for specific event lookups.
3. Present calendar information chronologically with times, event names, and relevant details such as location or attendees.
4. When checking for conflicts or free time, compare all relevant events and explicitly state any overlaps or open windows.

### Email Drafting
1. Always call \`draft_email\` when composing emails — never write them as plain text.
2. Do not send the email. Present it for the user's review and wait for explicit approval.
3. Pre-fill recipient, subject, and body from calendar context when available (attendee names, event times, proposed alternatives).

### General Behavior
- Be concise but thorough. Provide all relevant details without unnecessary filler.
- If a request is ambiguous, ask a clarifying question rather than assuming.
- Use relative time references naturally ("tomorrow at 2 PM", "this Friday") alongside absolute dates.
- If a tool returns an error, inform the user clearly and suggest next steps.`
}

// ── Shared Google Calendar fetch ──────────────────────────────────────────────

async function fetchCalendarEvents(start_date, end_date, max_results = 20) {
  // Fetch all calendars the user has access to
  const listRes = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    { headers: { Authorization: `Bearer ${cachedToken}` } }
  )
  if (listRes.status === 401) {
    cachedToken = null
    throw new TokenExpiredError()
  }
  if (!listRes.ok) throw new Error(`Calendar list fetch failed: ${listRes.status}`)
  const { items: calendars } = await listRes.json()

  // Fetch events from every calendar in parallel
  const perCalendarLimit = Math.min(max_results, 50)
  const results = await Promise.all(
    calendars.map(async (cal) => {
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`
      )
      url.searchParams.set('timeMin', start_date)
      url.searchParams.set('timeMax', end_date)
      url.searchParams.set('maxResults', String(perCalendarLimit))
      url.searchParams.set('singleEvents', 'true')
      url.searchParams.set('orderBy', 'startTime')

      const res = await fetch(url, { headers: { Authorization: `Bearer ${cachedToken}` } })
      if (res.status === 401) {
        cachedToken = null
        throw new TokenExpiredError()
      }
      if (!res.ok) return []
      const data = await res.json()
      return (data.items || []).map((e) => ({
        id: e.id,
        summary: e.summary,
        start: e.start,
        end: e.end,
        location: e.location,
        attendees: e.attendees,
        description: e.description,
        calendarName: cal.summary,
      }))
    })
  )

  return results
    .flat()
    .sort((a, b) => {
      const aTime = a.start.dateTime || a.start.date
      const bTime = b.start.dateTime || b.start.date
      return new Date(aTime) - new Date(bTime)
    })
}

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeGetEvents({ start_date, end_date, max_results }) {
  return fetchCalendarEvents(start_date, end_date, max_results)
}

async function executeAnalyzeSchedule({ start_date, end_date }) {
  const events = await fetchCalendarEvents(start_date, end_date, 100)

  // Only timed events count toward hour stats (all-day events excluded)
  const timed = events.filter((e) => e.start.dateTime)

  let totalMinutes = 0
  const minutesByDay = {}

  for (const event of timed) {
    const start = new Date(event.start.dateTime)
    const end = new Date(event.end.dateTime)
    const duration = (end - start) / 60000

    totalMinutes += duration

    const day = start.toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric',
    })
    minutesByDay[day] = (minutesByDay[day] || 0) + duration
  }

  const busiestEntry = Object.entries(minutesByDay).sort((a, b) => b[1] - a[1])[0]

  return {
    total_events: events.length,
    timed_events: timed.length,
    all_day_events: events.length - timed.length,
    total_meeting_hours: Math.round((totalMinutes / 60) * 10) / 10,
    average_meeting_minutes: timed.length > 0 ? Math.round(totalMinutes / timed.length) : 0,
    busiest_day: busiestEntry
      ? { day: busiestEntry[0], hours: Math.round((busiestEntry[1] / 60) * 10) / 10 }
      : null,
    meeting_hours_by_day: Object.fromEntries(
      Object.entries(minutesByDay).map(([day, mins]) => [day, Math.round((mins / 60) * 10) / 10])
    ),
    events,
  }
}

function executeDraftEmail({ recipient_name, subject, context }) {
  return {
    to: recipient_name,
    subject,
    body: context,
    formatted: `To: ${recipient_name}\nSubject: ${subject}\n\n${context}`,
  }
}

// ── SSE smoke test ────────────────────────────────────────────────────────────

app.get('/api/test-sse', (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()
  res.write('data: {"type":"text","text":"chunk 1"}\n\n')
  setTimeout(() => res.write('data: {"type":"text","text":" chunk 2"}\n\n'), 500)
  setTimeout(() => { res.write('data: {"type":"done"}\n\n'); res.end() }, 1000)
})

// ── Chat route ────────────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { messages, accessToken } = req.body

  if (!messages?.length) {
    return res.status(400).json({ error: 'messages is required' })
  }

  // Update token cache whenever a fresh token is provided
  if (accessToken) cachedToken = accessToken

  if (!cachedToken) {
    return res.status(401).json({ error: 'No Google token — please sign in' })
  }

  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`)

  // Use res.on('close') — req.on('close') fires when the POST body is consumed,
  // not when the SSE connection drops.
  let aborted = false
  res.on('close', () => { aborted = true })

  try {
    let currentMessages = [...messages]

    // Tool use loop — cycles until Claude produces no more tool calls
    while (!aborted) {
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: buildSystemPrompt(),
        tools: TOOLS,
        messages: currentMessages,
      })

      stream.on('text', (text) => {
        if (!aborted) send({ type: 'text', text })
      })

      const message = await stream.finalMessage()
      if (aborted) break

      const toolCalls = message.content.filter((b) => b.type === 'tool_use')

      if (toolCalls.length === 0) {
        send({ type: 'done' })
        break
      }

      // Keep connection alive during tool execution
      const keepalive = setInterval(() => {
        if (!aborted) res.write(': ping\n\n')
      }, 3000)

      const toolResults = await Promise.all(
        toolCalls.map(async (block) => {
          try {
            let result
            if (block.name === 'get_events') {
              result = await executeGetEvents(block.input)
            } else if (block.name === 'analyze_schedule') {
              result = await executeAnalyzeSchedule(block.input)
            } else if (block.name === 'draft_email') {
              result = executeDraftEmail(block.input)
            } else {
              result = { error: `Unknown tool: ${block.name}` }
            }
            return {
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            }
          } catch (err) {
            if (err instanceof TokenExpiredError) throw err  // propagate — exits the loop
            return {
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ error: err.message }),
              is_error: true,
            }
          }
        })
      )

      clearInterval(keepalive)

      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: message.content },
        { role: 'user', content: toolResults },
      ]
    }
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      if (!aborted) send({ type: 'auth_expired' })
    } else {
      console.error('Chat error:', err)
      if (!aborted) send({ type: 'error', message: err.message })
    }
  } finally {
    res.end()
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001
const server = app.listen(PORT, () => console.log(`Server listening on port ${PORT}`))

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Is another instance of the server running?`)
    console.error(`Run: lsof -ti tcp:${PORT} | xargs kill  to free the port, then restart.`)
    process.exit(1)
  }
  throw err
})
