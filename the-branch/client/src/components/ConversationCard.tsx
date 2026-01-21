import { Link } from 'react-router-dom';

interface ConversationCardProps {
  id: number;
  title: string;
  openingPost: string | null;
  tags: string[];
  messageCount: number;
  readerCount: number;
  createdAt: string;
  updatedAt: string;
  status: 'matching' | 'active' | 'completed' | 'archived';
  variant: 'openBench' | 'active';
  onJoin?: () => void;
  joining?: boolean;
}

export function ConversationCard({
  id,
  title,
  openingPost,
  tags,
  messageCount,
  readerCount,
  createdAt,
  updatedAt,
  variant,
  onJoin,
  joining,
}: ConversationCardProps) {
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    const truncated = text.slice(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclaim = truncated.lastIndexOf('!');
    const breakPoint = Math.max(lastPeriod, lastQuestion, lastExclaim);
    if (breakPoint > maxLength * 0.6) {
      return truncated.slice(0, breakPoint + 1);
    }
    return truncated.trim() + '...';
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

  const isOpenBench = variant === 'openBench';
  const isRecentlyActive = () => {
    const lastUpdate = new Date(updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - lastUpdate.getTime();
    return diffMs < 3600000; // Within last hour
  };

  return (
    <div className="bg-cream-100 border border-cream-300 rounded-xl p-6 flex flex-col h-full hover:border-cream-400 hover:shadow-md transition-all duration-200">
      {/* Title */}
      <h3 className="text-lg font-bold text-warmgray-700 mb-3 line-clamp-2 leading-snug">
        {title}
      </h3>

      {/* Opening Post Preview */}
      {openingPost && (
        <p className="text-warmgray-600 text-sm leading-relaxed mb-4 flex-grow">
          {truncateText(openingPost, 180)}
        </p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 bg-sage-100 text-sage-600 rounded-full text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-3 text-xs text-warmgray-400 mb-4 pt-4 border-t border-cream-200">
        {!isOpenBench && isRecentlyActive() && (
          <span className="flex items-center gap-1 text-sage-500 font-medium">
            <span className="w-2 h-2 bg-sage-400 rounded-full animate-pulse"></span>
            Active
          </span>
        )}
        <span>{formatTimeAgo(isOpenBench ? createdAt : updatedAt)}</span>
        {messageCount > 0 && <span>{messageCount} messages</span>}
        {readerCount > 0 && <span>{readerCount} readers</span>}
      </div>

      {/* CTA */}
      {isOpenBench && onJoin ? (
        <button
          onClick={onJoin}
          disabled={joining}
          className="w-full py-2.5 rounded-lg font-medium transition-all bg-terracotta-400 hover:bg-terracotta-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {joining ? 'Joining...' : 'Join Conversation'}
        </button>
      ) : (
        <Link
          to={`/conversation/${id}`}
          className="w-full py-2.5 rounded-lg font-medium transition-all text-center block bg-sage-400 hover:bg-sage-500 text-white"
        >
          Read Conversation
        </Link>
      )}
    </div>
  );
}
