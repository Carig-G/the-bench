import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { stories } from '../api';
import { useAuth } from '../context/AuthContext';

export function CreateStory() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [firstChapter, setFirstChapter] = useState('');
  const [maxBranches, setMaxBranches] = useState(3);
  const [maxContributors, setMaxContributors] = useState(10);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await stories.create({
        title,
        description: description || undefined,
        firstChapter,
        maxBranches,
        maxContributors,
      });
      navigate(`/story/${result.story.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create story');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Create a New Story</h1>

      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm text-gray-400 mb-1">
            Title *
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="Enter your story title"
            maxLength={255}
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm text-gray-400 mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input min-h-[100px] resize-y"
            placeholder="A brief description of your story (optional)"
            rows={3}
          />
        </div>

        <div>
          <label htmlFor="firstChapter" className="block text-sm text-gray-400 mb-1">
            First Chapter *
          </label>
          <textarea
            id="firstChapter"
            value={firstChapter}
            onChange={(e) => setFirstChapter(e.target.value)}
            className="input min-h-[300px] resize-y font-serif text-lg leading-relaxed"
            placeholder="Begin your story here..."
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="maxBranches" className="block text-sm text-gray-400 mb-1">
              Max branches per chapter
            </label>
            <select
              id="maxBranches"
              value={maxBranches}
              onChange={(e) => setMaxBranches(Number(e.target.value))}
              className="input"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              How many different continuations can branch from each chapter
            </p>
          </div>

          <div>
            <label htmlFor="maxContributors" className="block text-sm text-gray-400 mb-1">
              Max contributors
            </label>
            <select
              id="maxContributors"
              value={maxContributors}
              onChange={(e) => setMaxContributors(Number(e.target.value))}
              className="input"
            >
              {[5, 10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Maximum number of different authors who can contribute
            </p>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
            {loading ? 'Creating...' : 'Create Story'}
          </button>
        </div>
      </form>
    </div>
  );
}
