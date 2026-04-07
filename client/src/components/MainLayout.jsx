import CalendarPanel from './CalendarPanel'
import ChatPanel from './ChatPanel'

export default function MainLayout({ accessToken, onLogout }) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">Calendar Assistant</h1>
        <button
          onClick={onLogout}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <CalendarPanel accessToken={accessToken} />
        <ChatPanel accessToken={accessToken} />
      </div>
    </div>
  )
}
