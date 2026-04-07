import { useState, useRef, useEffect } from 'react'

export default function ChatPanel({ accessToken }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your calendar assistant. Ask me about your schedule, and I can help analyze your meetings or draft scheduling emails.",
    },
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef(null)

  // Scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || streaming) return

    const userMessage = { role: 'user', content: input.trim() }
    const updatedMessages = [...messages, userMessage]

    setMessages(updatedMessages)
    setInput('')
    setStreaming(true)

    // Placeholder for the streaming assistant reply
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      // In dev, connect directly to bypass Vite's proxy (which discards SSE bodies).
      // In production, use a relative URL through whatever reverse proxy is in front.
      const apiBase = import.meta.env.DEV ? 'http://localhost:3001' : ''
      const res = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          accessToken,
        }),
      })

      if (!res.ok) throw new Error(`Server error: ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep any incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const chunk = JSON.parse(line.slice(6))

          if (chunk.type === 'text') {
            setMessages((prev) => {
              const next = [...prev]
              next[next.length - 1] = {
                role: 'assistant',
                content: next[next.length - 1].content + chunk.text,
              }
              return next
            })
          } else if (chunk.type === 'error') {
            setMessages((prev) => {
              const next = [...prev]
              next[next.length - 1] = {
                role: 'assistant',
                content: `Something went wrong: ${chunk.message}`,
              }
              return next
            })
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev]
        next[next.length - 1] = {
          role: 'assistant',
          content: 'Sorry, I could not reach the server. Please try again.',
        }
        return next
      })
    } finally {
      setStreaming(false)
    }
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
              className={`max-w-xl rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm'
              }`}
            >
              {msg.content}
              {/* Blinking cursor on the last message while streaming */}
              {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
                <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 align-middle animate-pulse" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your schedule..."
          disabled={streaming}
          className="flex-1 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-full px-4 py-2 text-sm font-medium transition-colors"
        >
          {streaming ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
