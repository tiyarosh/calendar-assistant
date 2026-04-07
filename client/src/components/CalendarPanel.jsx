export default function CalendarPanel({ accessToken }) {
  // Placeholder — calendar events fetched and rendered here
  return (
    <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Upcoming Events
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* Placeholder events */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-lg bg-gray-50 border border-gray-100 p-3 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-2.5 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}
