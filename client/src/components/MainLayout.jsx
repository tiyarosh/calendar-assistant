import { useState, useRef, useEffect } from 'react'
import CalendarPanel from './CalendarPanel'
import ChatPanel from './ChatPanel'

export default function MainLayout({ accessToken, onLogout }) {
  const [view, setView] = useState('upcoming')
  const [panelHeight, setPanelHeight] = useState(0.5) // fraction of content area
  const contentRef = useRef(null)
  const isDragging = useRef(false)

  useEffect(() => {
    function onMouseMove(e) {
      if (!isDragging.current || !contentRef.current) return
      const rect = contentRef.current.getBoundingClientRect()
      const fraction = (e.clientY - rect.top) / rect.height
      setPanelHeight(Math.max(0.2, Math.min(0.8, fraction)))
    }
    function onMouseUp() { isDragging.current = false }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between flex-none">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Calendar Assistant</h1>
        <button
          onClick={onLogout}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* Main content */}
      <div
        ref={contentRef}
        className={`flex-1 overflow-hidden flex ${view === 'monthly' ? 'flex-col' : ''}`}
      >
        <CalendarPanel
          accessToken={accessToken}
          onSessionExpired={onLogout}
          view={view}
          onViewChange={setView}
          panelStyle={view === 'monthly' ? { height: `${panelHeight * 100}%`, flexShrink: 0 } : undefined}
        />

        {/* Resize handle — monthly only */}
        {view === 'monthly' && (
          <div
            onMouseDown={(e) => { isDragging.current = true; e.preventDefault() }}
            className="h-1.5 flex-none bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 cursor-row-resize transition-colors flex items-center justify-center group"
          >
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {[0,1,2].map(i => <div key={i} className="w-4 h-0.5 rounded bg-white dark:bg-gray-900" />)}
            </div>
          </div>
        )}

        <ChatPanel accessToken={accessToken} onSessionExpired={onLogout} />
      </div>
    </div>
  )
}
