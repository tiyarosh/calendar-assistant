import 'dotenv/config'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
app.use(express.json())

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_events',
    description:
      "Fetch the user's Google Calendar events for a given time range across all their calendars.",
    input_schema: {
      type: 'object',
      properties: {
        time_min: {
          type: 'string',
          description: 'Start of the time range as an ISO 8601 datetime string (e.g. 2026-04-07T00:00:00Z).',
        },
        time_max: {
          type: 'string',
          description: 'End of the time range as an ISO 8601 datetime string.',
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of events to return in total. Defaults to 20.',
        },
      },
      required: ['time_min', 'time_max'],
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

## Core Capabilities

You have access to the user's Google Calendar through the \`get_events\` tool. Use it proactively whenever the user asks about their schedule, availability, upcoming events, conflicts, or anything that requires knowledge of their calendar.

## Instructions

Follow these guidelines when responding to user requests:

### Calendar Queries
1. When the user asks about their schedule, availability, or events, **always call the \`get_events\` tool first** before responding. Do not guess or assume what is on the calendar.
2. Present calendar information in a clear, organized format (e.g., chronological order with times, event names, and relevant details such as location or attendees).
3. When checking for conflicts or free time, compare all relevant events and explicitly state any overlaps or open windows.

### Email Drafting
1. When asked to draft an email (e.g., to reschedule a meeting, invite attendees, send a summary), **present the full draft inline in the chat** using a clearly formatted block.
2. **Do not send the email.** Always present it for the user's review and wait for explicit approval or edits before taking any further action.
3. Include all standard email fields in the draft: **To**, **Subject**, and **Body**. Pre-fill fields with relevant information from the calendar context when available (e.g., attendee email addresses, event names, proposed times).

### General Behavior
- Be concise but thorough. Provide all relevant details without unnecessary filler.
- If a request is ambiguous (e.g., "move my meeting"), ask a clarifying question rather than making assumptions — specify which meeting, what new time, etc.
- When suggesting times or changes, take into account the user's existing calendar to avoid conflicts.
- Use relative time references naturally (e.g., "tomorrow at 2 PM," "this Friday") alongside absolute dates for clarity.
- If the \`get_events\` tool returns no results or an error, inform the user clearly and suggest next steps.`
}

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeGetEvents(input, accessToken) {
  const { time_min, time_max, max_results = 20 } = input

  // Fetch all calendars
  const listRes = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!listRes.ok) throw new Error(`Calendar list fetch failed: ${listRes.status}`)
  const { items: calendars } = await listRes.json()

  // Fetch events from every calendar in parallel
  const perCalendarLimit = Math.min(max_results, 50)
  const results = await Promise.all(
    calendars.map(async (cal) => {
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`
      )
      url.searchParams.set('timeMin', time_min)
      url.searchParams.set('timeMax', time_max)
      url.searchParams.set('maxResults', String(perCalendarLimit))
      url.searchParams.set('singleEvents', 'true')
      url.searchParams.set('orderBy', 'startTime')

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
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

  // Merge across calendars and sort chronologically
  return results
    .flat()
    .sort((a, b) => {
      const aTime = a.start.dateTime || a.start.date
      const bTime = b.start.dateTime || b.start.date
      return new Date(aTime) - new Date(bTime)
    })
}

// ── Chat route ────────────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { messages, accessToken } = req.body

  if (!messages?.length || !accessToken) {
    return res.status(400).json({ error: 'messages and accessToken are required' })
  }

  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`)

  // Abort stream if client disconnects
  let aborted = false
  req.on('close', () => { aborted = true })

  try {
    let currentMessages = [...messages]

    // Tool use loop — keeps cycling until Claude produces no more tool calls
    while (!aborted) {
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: buildSystemPrompt(),
        tools: TOOLS,
        messages: currentMessages,
      })

      // Forward text deltas to the client as they arrive
      stream.on('text', (text) => {
        if (!aborted) send({ type: 'text', text })
      })

      const message = await stream.finalMessage()
      if (aborted) break

      const toolCalls = message.content.filter((b) => b.type === 'tool_use')

      // No tool calls — Claude is done
      if (toolCalls.length === 0) {
        send({ type: 'done' })
        break
      }

      // Execute each tool call and collect results
      const toolResults = await Promise.all(
        toolCalls.map(async (block) => {
          try {
            let result
            if (block.name === 'get_events') {
              result = await executeGetEvents(block.input, accessToken)
            } else {
              result = { error: `Unknown tool: ${block.name}` }
            }
            return {
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            }
          } catch (err) {
            return {
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ error: err.message }),
              is_error: true,
            }
          }
        })
      )

      // Append assistant turn + tool results and loop
      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: message.content },
        { role: 'user', content: toolResults },
      ]
    }
  } catch (err) {
    console.error('Chat error:', err)
    if (!aborted) send({ type: 'error', message: err.message })
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
