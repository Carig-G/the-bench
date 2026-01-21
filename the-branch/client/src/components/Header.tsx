import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-cream-400 bg-cream-100/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          {/* Bench icon */}
          <svg
            className="w-8 h-8 text-sage-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Bench seat */}
            <rect x="2" y="10" width="20" height="3" rx="1" />
            {/* Bench back */}
            <rect x="3" y="5" width="18" height="2" rx="0.5" />
            {/* Left legs */}
            <line x1="4" y1="13" x2="4" y2="19" />
            <line x1="7" y1="13" x2="7" y2="19" />
            {/* Right legs */}
            <line x1="17" y1="13" x2="17" y2="19" />
            <line x1="20" y1="13" x2="20" y2="19" />
            {/* Back support */}
            <line x1="5" y1="7" x2="5" y2="10" />
            <line x1="19" y1="7" x2="19" y2="10" />
          </svg>
          <span className="text-xl font-bold text-warmgray-700">The Bench</span>
        </Link>

        <nav className="flex items-center gap-4">
          <Link to="/browse" className="text-warmgray-500 hover:text-warmgray-700 transition-colors">
            Browse
          </Link>
          <Link to="/join" className="text-warmgray-500 hover:text-warmgray-700 transition-colors">
            Join
          </Link>

          {user ? (
            <>
              <Link to="/my-conversations" className="text-warmgray-500 hover:text-warmgray-700 transition-colors">
                My Conversations
              </Link>
              <Link to="/connections" className="text-warmgray-500 hover:text-warmgray-700 transition-colors">
                Connections
              </Link>
              <Link to="/start" className="btn btn-primary">
                Start Conversation
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-warmgray-500 text-sm">{user.username}</span>
                <button
                  onClick={logout}
                  className="text-warmgray-500 hover:text-warmgray-700 text-sm transition-colors"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary">
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
