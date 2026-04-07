export default function LoginScreen({ onLogin }) {
  // Placeholder — Google OAuth wired in next
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="text-4xl">📅</div>
        <h1 className="text-2xl font-semibold text-gray-800">Calendar Assistant</h1>
        <p className="text-sm text-gray-500 text-center">
          Connect your Google Calendar to get started.
        </p>
        <button
          onClick={() => onLogin('mock-token')}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.86l6.09-6.09C34.46 3.19 29.53 1 24 1 14.82 1 7.07 6.48 3.64 14.22l7.09 5.51C12.3 13.35 17.68 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.73H24v8.95h12.42c-.54 2.9-2.17 5.36-4.63 7.01l7.19 5.59C43.18 37.3 46.1 31.36 46.1 24.55z"/>
            <path fill="#FBBC05" d="M10.73 28.27A14.6 14.6 0 0 1 9.5 24c0-1.49.26-2.93.73-4.27L3.14 14.22A23.94 23.94 0 0 0 0 24c0 3.86.93 7.51 2.56 10.72l8.17-6.45z"/>
            <path fill="#34A853" d="M24 47c5.53 0 10.17-1.83 13.56-4.97l-7.19-5.59c-1.83 1.23-4.18 1.96-6.37 1.96-6.32 0-11.7-3.85-13.27-9.13l-7.09 5.51C7.07 41.52 14.82 47 24 47z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
