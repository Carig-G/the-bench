import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { conversations } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Conversation } from '../types';

interface MyConversation extends Conversation {
  my_role: string;
  last_message: string | null;
  last_message_at: string | null;
}

export function MyConversations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversationList, setConversationList] = useState<MyConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadConversations();
  }, [user]);

  const loadConversations = async () => {
    try {
      const result = await conversations.mine();
      setConversationList(result.conversations);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const activeConversations = conversationList.filter(c => c.status === 'active');
  const waitingConversations = conversationList.filter(c => c.status === 'matching');
  const completedConversations = conversationList.filter(c => c.status === 'completed' || c.status === 'archived');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'matching':
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Waiting for partner</span>;
      case 'active':
        return <span className="px-2 py-0.5 bg-sage-100 text-sage-700 rounded-full text-xs font-medium">Active</span>;
      case 'completed':
        return <span className="px-2 py-0.5 bg-warmgray-100 text-warmgray-600 rounded-full text-xs font-medium">Completed</span>;
      default:
        return null;
    }
  };

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return '';
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

  const truncate = (text: string | null, length: number) => {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  };

  const ConversationCard = ({ conv }: { conv: MyConversation }) => (
    <Link
      to={`/conversation/${conv.id}`}
      className="card-hover block"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 bg-sage-100 text-sage-600 rounded-full text-xs font-medium">
            {conv.topic}
          </span>
          {getStatusBadge(conv.status)}
        </div>
        <span className="text-xs text-warmgray-400 whitespace-nowrap">
          {conv.my_role === 'initiator' ? 'You started' : 'You joined'}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-warmgray-700 mb-2 line-clamp-2">
        {conv.title}
      </h3>

      {conv.last_message && (
        <p className="text-warmgray-500 text-sm mb-3 line-clamp-2">
          {truncate(conv.last_message, 120)}
        </p>
      )}

      <div className="flex items-center justify-between text-sm text-warmgray-400 pt-3 border-t border-cream-300">
        <span>{conv.message_count || 0} messages</span>
        {conv.last_message_at && (
          <span>Last activity {formatTimeAgo(conv.last_message_at)}</span>
        )}
      </div>
    </Link>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-warmgray-800 mb-2">My Conversations</h1>
          <p className="text-warmgray-500">Your ongoing dialogues and discussions</p>
        </div>
        <Link to="/start" className="btn btn-primary">
          Start New
        </Link>
      </div>

      {error && (
        <div className="bg-terracotta-50 border border-terracotta-200 text-terracotta-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-warmgray-500">Loading your conversations...</div>
        </div>
      ) : conversationList.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-cream-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-warmgray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-warmgray-700 mb-2">No conversations yet</h2>
          <p className="text-warmgray-500 mb-6 max-w-md mx-auto">
            Start a conversation about something you want to explore, or browse existing conversations to join.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/start" className="btn btn-primary">
              Start a Conversation
            </Link>
            <Link to="/browse" className="btn btn-outline">
              Browse Conversations
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Conversations */}
          {activeConversations.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-warmgray-700 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-sage-400 rounded-full"></span>
                Active Conversations
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {activeConversations.map(conv => (
                  <ConversationCard key={conv.id} conv={conv} />
                ))}
              </div>
            </section>
          )}

          {/* Waiting for Partner */}
          {waitingConversations.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-warmgray-700 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                Waiting for Partner
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {waitingConversations.map(conv => (
                  <ConversationCard key={conv.id} conv={conv} />
                ))}
              </div>
            </section>
          )}

          {/* Completed */}
          {completedConversations.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-warmgray-700 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-warmgray-300 rounded-full"></span>
                Completed
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {completedConversations.map(conv => (
                  <ConversationCard key={conv.id} conv={conv} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
