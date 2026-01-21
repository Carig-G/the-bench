import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { conversations, messages as messagesApi, payments } from '../api';
import { useAuth } from '../context/AuthContext';
import type { ConversationWithDetails, Message } from '../types';

export function ConversationView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<ConversationWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    loadConversation();
  }, [id]);

  const loadConversation = async () => {
    if (!id) return;
    try {
      const result = await conversations.get(parseInt(id));
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newMessage.trim()) return;

    setSending(true);
    try {
      await messagesApi.create({
        conversationId: parseInt(id),
        content: newMessage.trim(),
      });
      setNewMessage('');
      loadConversation();
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handlePayment = async () => {
    if (!id) return;
    setPaying(true);
    try {
      await payments.create(parseInt(id), 1.99);
      loadConversation();
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const handleJoinConversation = async () => {
    if (!id) return;
    try {
      await conversations.join(parseInt(id));
      loadConversation();
    } catch (err: any) {
      setError(err.message || 'Failed to join conversation');
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <div className="animate-pulse text-warmgray-500">Loading conversation...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <div className="text-terracotta-600">{error || 'Conversation not found'}</div>
        <Link to="/browse" className="btn btn-secondary mt-4">
          Browse Conversations
        </Link>
      </div>
    );
  }

  const { conversation, messages, has_paid, is_participant } = data;
  const canSeeAll = is_participant || has_paid;
  const canReply = is_participant && conversation.status === 'active';
  const isWaitingForMatch = conversation.status === 'matching' && is_participant;
  const canJoin = conversation.status === 'matching' && !is_participant && user;

  const publicMessages = messages.filter(m => m.is_public);
  const privateMessages = messages.filter(m => !m.is_public);
  const totalMessageCount = messages.length;
  const hiddenCount = canSeeAll ? 0 : privateMessages.length;

  const getParticipantLabel = (role: string | undefined) => {
    if (role === 'initiator') return 'Person A';
    if (role === 'responder') return 'Person B';
    return 'Anonymous';
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-warmgray-500 mb-2">
          <span className="px-2 py-0.5 bg-sage-100 text-sage-600 rounded-full text-xs font-medium">
            {conversation.topic}
          </span>
          <span>·</span>
          <span className="capitalize">{conversation.status}</span>
          <span>·</span>
          <span>{totalMessageCount} messages</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-warmgray-800 mb-3">
          {conversation.title}
        </h1>
        {conversation.description && (
          <p className="text-warmgray-500">{conversation.description}</p>
        )}
      </div>

      {/* Waiting for match */}
      {isWaitingForMatch && (
        <div className="bg-cream-200 rounded-xl p-6 mb-8 text-center">
          <div className="w-12 h-12 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-sage-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-warmgray-700 mb-2">Waiting for a conversation partner</h3>
          <p className="text-warmgray-500 text-sm">
            Someone will join soon to explore this topic with you.
          </p>
        </div>
      )}

      {/* Join prompt */}
      {canJoin && (
        <div className="bg-sage-50 border border-sage-200 rounded-xl p-6 mb-8 text-center">
          <h3 className="font-semibold text-warmgray-700 mb-2">This conversation needs a partner</h3>
          <p className="text-warmgray-500 text-sm mb-4">
            Interested in exploring this topic? Join the conversation.
          </p>
          <button onClick={handleJoinConversation} className="btn btn-secondary">
            Join This Conversation
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-6">
        {publicMessages.map((message) => (
          <MessageBubble key={message.id} message={message} getLabel={getParticipantLabel} />
        ))}

        {/* Paywall */}
        {!canSeeAll && privateMessages.length > 0 && (
          <div className="paywall bg-gradient-to-b from-cream-100 to-cream-200 rounded-xl py-10 px-6 my-8">
            <div className="max-w-md mx-auto text-center">
              <h3 className="text-xl font-semibold text-warmgray-700 mb-3">
                Continue reading this conversation
              </h3>
              <p className="text-warmgray-500 mb-6">
                {hiddenCount} more message{hiddenCount !== 1 ? 's' : ''} to discover.
                The dialogue is just getting started.
              </p>
              {user ? (
                <div className="space-y-3">
                  <button
                    onClick={handlePayment}
                    disabled={paying}
                    className="btn btn-primary w-full py-3"
                  >
                    {paying ? 'Processing...' : 'Unlock for $1.99'}
                  </button>
                  <p className="text-xs text-warmgray-500">
                    Revenue splits 50/50 between the conversationalists
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link to="/register" className="btn btn-primary w-full py-3 block">
                    Sign up to unlock
                  </Link>
                  <p className="text-sm text-warmgray-500">
                    Already have an account? <Link to="/login" className="text-sage-500 hover:underline">Log in</Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Private messages (if paid/participant) */}
        {canSeeAll && privateMessages.map((message) => (
          <MessageBubble key={message.id} message={message} getLabel={getParticipantLabel} />
        ))}
      </div>

      {/* Reply box */}
      {canReply && (
        <form onSubmit={handleSendMessage} className="mt-8 bg-white rounded-xl border border-cream-400 p-4">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Continue the conversation..."
            className="textarea h-32 mb-4"
            required
          />
          <div className="flex justify-end">
            <button type="submit" disabled={sending} className="btn btn-primary">
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      )}

      {/* Completed conversation notice */}
      {conversation.status === 'completed' && (
        <div className="mt-8 bg-cream-200 rounded-xl p-6 text-center">
          <p className="text-warmgray-600">This conversation has concluded.</p>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  getLabel
}: {
  message: Message;
  getLabel: (role: string | undefined) => string;
}) {
  const isInitiator = message.author_role === 'initiator';
  const bubbleClass = isInitiator ? 'message-initiator' : 'message-responder';

  return (
    <div className={`message ${bubbleClass}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-warmgray-600">
          {getLabel(message.author_role)}
        </span>
        <span className="text-xs text-warmgray-400">
          {new Date(message.created_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <div className="prose-bench">
        {message.content.split('\n').map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
