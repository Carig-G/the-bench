import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { stories as storiesApi } from '../api';
import type { Story } from '../types';

export function Stories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchStories = async () => {
      setLoading(true);
      try {
        const data = await storiesApi.list(page);
        setStories(data.stories);
        setTotalPages(data.pagination.pages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stories');
      } finally {
        setLoading(false);
      }
    };

    fetchStories();
  }, [page]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center py-16">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Browse Stories</h1>
        <Link to="/create" className="btn btn-primary">
          New Story
        </Link>
      </div>

      {stories.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">No stories yet. Be the first to create one!</p>
          <Link to="/create" className="btn btn-primary">
            Create Story
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stories.map((story) => (
              <Link
                key={story.id}
                to={`/story/${story.id}`}
                className="card hover:border-gray-700 transition-colors group"
              >
                <h2 className="text-lg font-semibold mb-2 group-hover:text-brand-500 transition-colors">
                  {story.title}
                </h2>
                {story.description && (
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                    {story.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>by {story.creator_username}</span>
                  <span>{story.node_count || 1} chapters</span>
                  {(story.complete_votes || 0) > 0 && (
                    <span className="text-brand-500">{story.complete_votes} complete</span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary"
              >
                Previous
              </button>
              <span className="flex items-center px-4 text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-secondary"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
