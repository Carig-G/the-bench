interface TrendingTagsProps {
  tags: { tag: string; conversation_count: number }[];
  selectedTag: string | null;
  onTagSelect: (tag: string | null) => void;
  loading?: boolean;
}

export function TrendingTags({ tags, selectedTag, onTagSelect, loading }: TrendingTagsProps) {
  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-9 w-24 bg-cream-200 rounded-full animate-pulse flex-shrink-0" />
        ))}
      </div>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <button
        onClick={() => onTagSelect(null)}
        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
          selectedTag === null
            ? 'bg-sage-400 text-white'
            : 'bg-cream-200 text-warmgray-600 hover:bg-cream-300'
        }`}
      >
        All Topics
      </button>
      {tags.map(({ tag, conversation_count }) => (
        <button
          key={tag}
          onClick={() => onTagSelect(tag)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
            selectedTag === tag
              ? 'bg-sage-400 text-white'
              : 'bg-cream-200 text-warmgray-600 hover:bg-cream-300'
          }`}
        >
          {tag}
          <span className="ml-1.5 text-xs opacity-70">({conversation_count})</span>
        </button>
      ))}
    </div>
  );
}
