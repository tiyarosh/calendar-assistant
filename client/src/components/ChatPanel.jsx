import { useState } from 'react'

export default function ChatPanel({ accessToken }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your calendar assistant. Ask me about your schedule, and I can help analyze your meetings or draft scheduling emails.",
    },
  ])
  const [input, setInput] = useState('')

  function handleSend(e) {
    e.preventDefault()
    if (!input.trim()) return

    setMessages((prev) => [...prev, { role: 'user', content: input.trim() }])
    setInput('')
    // API call wired in next
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xl rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your schedule..."
          className="flex-1 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-full px-4 py-2 text-sm font-medium transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
