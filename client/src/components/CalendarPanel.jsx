import { useState, useEffect } from 'react'

const VIEWS = ['upcoming', 'daily', 'weekly', 'monthly']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getDateRange(view, offset) {
  const today = new Date()
  const y = today.getFullYear(), mo = today.getMonth(), d = today.getDate()

  if (view === 'upcoming') {
    return {
      start: new Date(),
      end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      label: 'Next 7 days',
    }
  }
  if (view === 'daily') {
    const day = new Date(y, mo, d + offset)
    return {
      start: day,
      end: new Date(y, mo, d + offset + 1),
      label: day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    }
  }
  if (view === 'weekly') {
    const dow = today.getDay()
    const weekStart = new Date(y, mo, d - dow + offset * 7)
    const weekEnd = new Date(y, mo, d - dow + offset * 7 + 7)
    const s = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const e = new Date(weekEnd - 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return { start: weekStart, end: weekEnd, label: `${s} – ${e}` }
  }
  if (view === 'monthly') {
    const start = new Date(y, mo + offset, 1)
    const end = new Date(y, mo + offset + 1, 1)
    return {
      start,
      end,
      label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    }
  }
}

// Returns array of weeks, each week an array of 7 Date objects.
// Always includes the complete last week even if it extends into the next month.
function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const cursor = new Date(year, month, 1 - firstOfMonth.getDay())
  const lastOfMonth = new Date(year, month + 1, 0) // last day of month
  const weeks = []
  while (cursor <= lastOfMonth || weeks.length === 0) {
    const week = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dayOffsetFromToday(date) {
  const today = new Date()
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

function groupByDay(events) {
  const map = {}
  for (const e of events) {
    const key = e.start.date || e.start.dateTime?.substring(0, 10)
    if (!map[key]) map[key] = []
    map[key].push(e)
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
}

function dayHeader(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function CalendarPanel({ accessToken, onSessionExpired, view, onViewChange, panelStyle }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [calendarFilter, setCalendarFilter] = useState('all')
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    fetchAllEvents()
  }, [accessToken, view, offset])

  async function fetchAllEvents() {
    setLoading(true)
    const { start, end } = getDateRange(view, offset)
    try {
      const listRes = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (listRes.status === 401) { onSessionExpired(); return }
      const { items: calendars } = await listRes.json()

      const results = await Promise.all(
        calendars.map(async (cal) => {
          const url = new URL(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`
          )
          url.searchParams.set('maxResults', view === 'monthly' ? '100' : '50')
          url.searchParams.set('orderBy', 'startTime')
          url.searchParams.set('singleEvents', 'true')
          url.searchParams.set('timeMin', start.toISOString())
          url.searchParams.set('timeMax', end.toISOString())

          const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
          if (res.status === 401) { onSessionExpired(); return [] }
          if (!res.ok) return []
          const data = await res.json()
          return (data.items || []).map((e) => ({
            ...e,
            calendarName: cal.summary,
            calendarColor: cal.backgroundColor,
          }))
        })
      )

      const merged = results
        .flat()
        .sort((a, b) => {
          const aTime = a.start.dateTime || a.start.date
          const bTime = b.start.dateTime || b.start.date
          return new Date(aTime) - new Date(bTime)
        })

      setEvents(view === 'upcoming' ? merged.slice(0, 10) : merged)
    } catch (err) {
      console.error('Failed to fetch calendar events:', err)
    } finally {
      setLoading(false)
    }
  }

  function formatEventTime(event, forceFullDate = false) {
    const grouped = view === 'daily' || view === 'weekly' || view === 'monthly'
    if (event.start.date) {
      if (!grouped || forceFullDate) {
        const [year, month, day] = event.start.date.split('-').map(Number)
        return new Date(year, month - 1, day).toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
        }) + ' · All day'
      }
      return 'All day'
    }
    const start = new Date(event.start.dateTime)
    const end = new Date(event.end.dateTime)
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    if (grouped && !forceFullDate) return `${startTime} – ${endTime}`
    const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return `${dateStr} · ${startTime} – ${endTime}`
  }

  function renderEvent(event) {
    return (
      <div
        key={`${event.id}-${event.calendarName}`}
        onClick={() => setSelectedEvent(event)}
        className="rounded-lg border border-gray-100 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      >
        <div className="flex items-start gap-2.5">
          <div
            className="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: event.calendarColor || '#4285F4' }}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
              {event.summary || '(No title)'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatEventTime(event)}</p>
            {view === 'upcoming' && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{event.calendarName}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  function renderMonthGrid() {
    const { start: rangeStart } = getDateRange('monthly', offset)
    const gridYear = rangeStart.getFullYear()
    const gridMonth = rangeStart.getMonth()
    const weeks = buildMonthGrid(gridYear, gridMonth)
    const today = new Date()
    const todayKey = toDateKey(today)

    const eventsByDay = {}
    for (const e of filteredEvents) {
      const key = e.start.date || e.start.dateTime?.substring(0, 10)
      if (!eventsByDay[key]) eventsByDay[key] = []
      eventsByDay[key].push(e)
    }

    return (
      <div className="flex flex-col h-full">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700 flex-none">
          {DOW.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">
              {d}
            </div>
          ))}
        </div>
        {/* Grid rows */}
        <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((date, di) => {
                const key = toDateKey(date)
                const dayEvents = eventsByDay[key] || []
                const isCurrentMonth = date.getMonth() === gridMonth
                const isToday = key === todayKey
                const visible = dayEvents.slice(0, 2)
                const overflow = dayEvents.length - visible.length

                return (
                  <div
                    key={di}
                    className={`border-b border-r border-gray-100 dark:border-gray-700 p-1 overflow-hidden ${
                      !isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900/40' : ''
                    }`}
                  >
                    {/* Day number */}
                    <div className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full mb-0.5 ${
                      isToday
                        ? 'bg-blue-600 text-white'
                        : isCurrentMonth
                        ? 'text-gray-700 dark:text-gray-200'
                        : 'text-gray-300 dark:text-gray-600'
                    }`}>
                      {date.getDate()}
                    </div>
                    {/* Event chips */}
                    <div className="space-y-0.5">
                      {visible.map((event) => (
                        <div
                          key={`${event.id}-${event.calendarName}`}
                          onClick={() => setSelectedEvent(event)}
                          className="flex items-center gap-1 rounded px-1 py-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: (event.calendarColor || '#4285F4') + '22' }}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: event.calendarColor || '#4285F4' }}
                          />
                          <span className="text-xs truncate text-gray-700 dark:text-gray-200 leading-tight">
                            {event.summary || '(No title)'}
                          </span>
                        </div>
                      ))}
                      {overflow > 0 && (
                        <button
                          onClick={() => { setOffset(dayOffsetFromToday(date)); onViewChange('daily') }}
                          className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 px-1 leading-tight"
                        >
                          +{overflow} more
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const filteredEvents = events.filter((e) => calendarFilter === 'all' || e.calendarName === calendarFilter)
  const { label } = getDateRange(view, offset)
  const isGrouped = view === 'daily' || view === 'weekly'

  return (
    <div
      className={`bg-white dark:bg-gray-800 flex flex-col ${
        view === 'monthly'
          ? 'w-full border-b border-gray-200 dark:border-gray-700'
          : 'w-96 border-r border-gray-200 dark:border-gray-700'
      }`}
      style={panelStyle}
    >

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 space-y-2 flex-none">
        {/* View toggles — reset offset on manual switch */}
        <div className="flex items-center gap-1">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => { onViewChange(v); setOffset(0) }}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                view === v
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Period label + nav arrows */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate">{label}</span>
          {view !== 'upcoming' && (
            <div className="flex items-center gap-0.5 flex-none ml-2">
              <button
                onClick={() => setOffset((o) => o - 1)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors text-sm"
              >‹</button>
              {offset !== 0 && (
                <button
                  onClick={() => setOffset(0)}
                  className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 px-1 transition-colors"
                >Today</button>
              )}
              <button
                onClick={() => setOffset((o) => o + 1)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors text-sm"
              >›</button>
            </div>
          )}
        </div>

        {/* Calendar filter */}
        {!loading && events.length > 0 && (
          <select
            value={calendarFilter}
            onChange={(e) => setCalendarFilter(e.target.value)}
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 dark:focus:ring-blue-900 transition"
          >
            <option value="all">All calendars</option>
            {[...new Set(events.map((e) => e.calendarName))].sort().map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Events */}
      {view === 'monthly' ? (
        <div className="flex-1 overflow-hidden px-2 pb-2">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-gray-400 dark:text-gray-500">Loading…</div>
            </div>
          ) : renderMonthGrid()}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 p-3 animate-pulse">
                <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2" />
                <div className="h-2.5 bg-gray-200 dark:bg-gray-600 rounded w-1/2" />
              </div>
            ))
          ) : filteredEvents.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center mt-8">No events for this period.</p>
          ) : isGrouped ? (
            <div className="space-y-3">
              {groupByDay(filteredEvents).map(([dateKey, dayEvents]) => (
                <div key={dateKey}>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-1 pb-1">
                    {dayHeader(dateKey)}
                  </p>
                  <div className="space-y-1.5">
                    {dayEvents.map((event) => renderEvent(event))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            filteredEvents.map((event) => renderEvent(event))
          )}
        </div>
      )}

      {/* Event detail popup — centered in viewport */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: selectedEvent.calendarColor || '#4285F4' }}
                />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-snug">
                  {selectedEvent.summary || '(No title)'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0 text-lg leading-none"
              >×</button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {formatEventTime(selectedEvent, true)}
            </p>

            <div className="space-y-2.5">
              {selectedEvent.location && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Location</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200">{selectedEvent.location}</p>
                </div>
              )}
              {selectedEvent.attendees?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Attendees</p>
                  <ul className="space-y-1">
                    {selectedEvent.attendees.map((a, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          a.responseStatus === 'accepted' ? 'bg-green-400' :
                          a.responseStatus === 'declined' ? 'bg-red-400' : 'bg-gray-300'
                        }`} />
                        {a.displayName || a.email}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedEvent.description && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Notes</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
                    {selectedEvent.description}
                  </p>
                </div>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-700">
                {selectedEvent.calendarName}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
