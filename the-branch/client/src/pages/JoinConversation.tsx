import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { conversations } from '../api';
import { useAuth } from '../context/AuthContext';

interface QueuedConversation {
  id: number;
  title: string;
  topic: string;
  description: string | null;
  created_at: string;
  creator_username: string;
  opening_message: string;
}

export function JoinConversation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversationList, setConversationList] = useState<QueuedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [joining, setJoining] = useState<number | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async (topic?: string) => {
    setLoading(true);
    try {
      const result = await conversations.browseQueue(topic);
      setConversationList(result.conversations);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadQueue(topicFilter || undefined);
  };

  const handleJoin = async (id: number) => {
    if (!user) {
      navigate('/login');
      return;
    }

    setJoining(id);
    try {
      await conversations.join(id);
      navigate(`/conversation/${id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join conversation');
      setJoining(null);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.substring(0, length) + '...' : text;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-warmgray-800 mb-3">Join a Conversation</h1>
        <p className="text-warmgray-500 max-w-xl mx-auto">
          These conversations are waiting for a second voice. Find a topic that interests you and join the dialogue.
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            placeholder="Filter by topic (e.g., philosophy, technology, relationships)"
            className="input flex-1"
          />
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-terracotta-50 border border-terracotta-200 text-terracotta-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-warmgray-500">Finding conversations...</div>
        </div>
      ) : conversationList.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-cream-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-warmgray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-warmgray-700 mb-2">No conversations waiting</h2>
          <p className="text-warmgray-500 mb-8 max-w-md mx-auto">
            All current conversations have partners. Be the first to start one!
          </p>

          {/* Starter prompt suggestions */}
          <div className="max-w-lg mx-auto text-left">
            <p className="text-sm text-warmgray-500 mb-4 text-center">Here are some ideas to get you started:</p>
            <div className="space-y-3">
              <Link to="/start" className="block card-hover group">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎧</span>
                  <span className="text-warmgray-700 group-hover:text-sage-600">What's the best podcast you've listened to lately?</span>
                </div>
              </Link>
              <Link to="/start" className="block card-hover group">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🤔</span>
                  <span className="text-warmgray-700 group-hover:text-sage-600">What's a question you've been turning over in your mind?</span>
                </div>
              </Link>
              <Link to="/start" className="block card-hover group">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚡</span>
                  <span className="text-warmgray-700 group-hover:text-sage-600">What's something you believe that most people would disagree with?</span>
                </div>
              </Link>
            </div>
            <div className="mt-6 text-center">
              <Link to="/start" className="text-sage-500 hover:text-sage-600 text-sm font-medium">
                See all conversation starters →
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {conversationList.map((conv) => (
            <div key={conv.id} className="card">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-sage-100 text-sage-600 rounded-full text-xs font-medium">
                      {conv.topic}
                    </span>
                    <span className="text-xs text-warmgray-400">
                      Posted {formatTimeAgo(conv.created_at)}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-warmgray-800">
                    {conv.title}
                  </h3>
                </div>
                <button
                  onClick={() => handleJoin(conv.id)}
                  disabled={joining === conv.id}
                  className="btn btn-primary whitespace-nowrap"
                >
                  {joining === conv.id ? 'Joining...' : 'Join Conversation'}
                </button>
              </div>

              {conv.description && (
                <p className="text-warmgray-500 text-sm mb-4">
                  {conv.description}
                </p>
              )}

              {/* Opening message preview */}
              <div className="bg-sage-50 border border-sage-200 rounded-xl p-4">
                <div className="text-xs text-sage-600 font-medium mb-2">Opening message:</div>
                <p className="text-warmgray-700 leading-relaxed">
                  {truncate(conv.opening_message, 300)}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-cream-300 flex items-center justify-between">
                <span className="text-sm text-warmgray-400">
                  Started by an anonymous user
                </span>
                <Link
                  to={`/conversation/${conv.id}`}
                  className="text-sm text-sage-500 hover:text-sage-600"
                >
                  Preview conversation →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom CTA */}
      {conversationList.length > 0 && (
        <div className="mt-12 text-center">
          <p className="text-warmgray-500 mb-4">
            Don't see a topic you're interested in?
          </p>
          <Link to="/start" className="btn btn-outline">
            Start Your Own Conversation
          </Link>
        </div>
      )}
    </div>
  );
}
