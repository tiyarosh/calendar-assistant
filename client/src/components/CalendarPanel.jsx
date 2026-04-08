import { useState, useEffect } from 'react'

export default function CalendarPanel({ accessToken, onSessionExpired }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)

  useEffect(() => {
    fetchAllEvents()
  }, [accessToken])

  async function fetchAllEvents() {
    setLoading(true)
    try {
      // 1. Get all calendars the user has access to
      const listRes = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (listRes.status === 401) { onSessionExpired(); return }
      const { items: calendars } = await listRes.json()

      // 2. Fetch next-week events from each calendar in parallel
      const now = new Date().toISOString()
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const results = await Promise.all(
        calendars.map(async (cal) => {
          const url = new URL(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`
          )
          url.searchParams.set('maxResults', '10')
          url.searchParams.set('orderBy', 'startTime')
          url.searchParams.set('singleEvents', 'true')
          url.searchParams.set('timeMin', now)
          url.searchParams.set('timeMax', nextWeek)

          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
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

      // 3. Merge across calendars, sort by start time, take the soonest 10
      const merged = results
        .flat()
        .sort((a, b) => {
          const aTime = a.start.dateTime || a.start.date
          const bTime = b.start.dateTime || b.start.date
          return new Date(aTime) - new Date(bTime)
        })
        .slice(0, 10)

      setEvents(merged)
    } catch (err) {
      console.error('Failed to fetch calendar events:', err)
    } finally {
      setLoading(false)
    }
  }

  function formatEventTime(event) {
    if (event.start.date) {
      // All-day event — parse as local date to avoid UTC-shift
      const [year, month, day] = event.start.date.split('-').map(Number)
      const d = new Date(year, month - 1, day)
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · All day'
    }
    const start = new Date(event.start.dateTime)
    const end = new Date(event.end.dateTime)
    const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return `${dateStr} · ${startTime} – ${endTime}`
  }

  return (
    <div className="w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Upcoming Events
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 p-3 animate-pulse">
              <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2" />
              <div className="h-2.5 bg-gray-200 dark:bg-gray-600 rounded w-1/2" />
            </div>
          ))
        ) : events.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center mt-8">No upcoming events this week.</p>
        ) : (
          events.map((event) => (
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
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{event.calendarName}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex"
          onClick={() => setSelectedEvent(null)}
        >
          {/* Spacer aligns with the calendar panel so popup sits in the chat area */}
          <div className="w-96 flex-shrink-0" />
          <div className="flex-1 flex items-start justify-center pt-20">
            <div
              className="w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Title + close */}
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
                >
                  ×
                </button>
              </div>

              {/* Time */}
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{formatEventTime(selectedEvent)}</p>

              <div className="space-y-2.5">
                {/* Location */}
                {selectedEvent.location && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Location</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200">{selectedEvent.location}</p>
                  </div>
                )}

                {/* Attendees */}
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

                {/* Description */}
                {selectedEvent.description && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Notes</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
                      {selectedEvent.description}
                    </p>
                  </div>
                )}

                {/* Calendar */}
                <p className="text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-700">
                  {selectedEvent.calendarName}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
