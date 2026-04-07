import CalendarPanel from './CalendarPanel'
import ChatPanel from './ChatPanel'

export default function MainLayout({ accessToken, onLogout }) {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Calendar Assistant</h1>
        <button
          onClick={onLogout}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <CalendarPanel accessToken={accessToken} onSessionExpired={onLogout} />
        <ChatPanel accessToken={accessToken} onSessionExpired={onLogout} />
      </div>
    </div>
  )
}
