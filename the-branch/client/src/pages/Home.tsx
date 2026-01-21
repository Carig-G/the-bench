import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Home() {
  const { user } = useAuth();

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      {/* Hero Section */}
      <div className="text-center mb-20">
        <h1 className="text-5xl md:text-6xl font-bold text-warmgray-800 mb-6">
          Deep conversations{' '}
          <span className="text-sage-400">with strangers</span>
        </h1>
        <p className="text-xl text-warmgray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Pull up a seat on The Bench. Explore ideas with minds you've never met.
          Anonymous intellectual intimacy, one conversation at a time.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          {user ? (
            <Link to="/start" className="btn btn-primary text-lg px-8 py-3">
              Start a Conversation
            </Link>
          ) : (
            <Link to="/register" className="btn btn-primary text-lg px-8 py-3">
              Start a Conversation
            </Link>
          )}
          <Link to="/join" className="btn btn-secondary text-lg px-8 py-3">
            Join a Conversation
          </Link>
        </div>
        <p className="mt-6 text-warmgray-400 text-sm">
          or <Link to="/browse" className="text-sage-500 hover:underline">browse all conversations</Link>
        </p>
      </div>

      {/* How It Works */}
      <div className="grid md:grid-cols-3 gap-8 mb-20">
        <div className="card text-center">
          <div className="w-14 h-14 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-sage-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-warmgray-700 mb-3">Sit Down</h3>
          <p className="text-warmgray-500">
            Post a topic you want to explore deeply. A question, an idea, a subject that fascinates you.
          </p>
        </div>

        <div className="card text-center">
          <div className="w-14 h-14 bg-terracotta-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-terracotta-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-warmgray-700 mb-3">Talk</h3>
          <p className="text-warmgray-500">
            Get matched with a compatible mind. Engage in long-form written dialogue with a thoughtful stranger.
          </p>
        </div>

        <div className="card text-center">
          <div className="w-14 h-14 bg-cream-300 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-warmgray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-warmgray-700 mb-3">Share</h3>
          <p className="text-warmgray-500">
            Readers pay to follow your dialogue. Revenue splits 50/50 between you and your conversation partner.
          </p>
        </div>
      </div>

      {/* Philosophy Section */}
      <div className="bg-cream-200 rounded-2xl p-10 md:p-14 text-center mb-20">
        <h2 className="text-3xl font-bold text-warmgray-700 mb-6">
          Like eavesdropping on the best park bench conversation you've ever heard
        </h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
          <div className="flex gap-4">
            <div className="w-2 bg-sage-400 rounded-full flex-shrink-0"></div>
            <div>
              <h4 className="font-semibold text-warmgray-700 mb-2">Anonymous intellectual intimacy</h4>
              <p className="text-warmgray-500 text-sm">No status games, no credentials. Just ideas meeting ideas in their purest form.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-2 bg-sage-400 rounded-full flex-shrink-0"></div>
            <div>
              <h4 className="font-semibold text-warmgray-700 mb-2">Matchmaking compatible minds</h4>
              <p className="text-warmgray-500 text-sm">Find someone who wants to explore the same questions you do.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-2 bg-sage-400 rounded-full flex-shrink-0"></div>
            <div>
              <h4 className="font-semibold text-warmgray-700 mb-2">Long-form written dialogue</h4>
              <p className="text-warmgray-500 text-sm">Conversations that breathe. No character limits, no rush.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-2 bg-sage-400 rounded-full flex-shrink-0"></div>
            <div>
              <h4 className="font-semibold text-warmgray-700 mb-2">Follow in real-time</h4>
              <p className="text-warmgray-500 text-sm">Watch conversations unfold as they happen. Subscribe to dialogues that captivate you.</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-warmgray-700 mb-4">
          Ready to sit down?
        </h2>
        <p className="text-warmgray-500 mb-8 max-w-lg mx-auto">
          Start a conversation about something you've always wanted to explore,
          or browse existing dialogues to find one worth following.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          {user ? (
            <Link to="/start" className="btn btn-primary text-lg px-8 py-3">
              Start Your First Conversation
            </Link>
          ) : (
            <Link to="/register" className="btn btn-primary text-lg px-8 py-3">
              Create Your Account
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
