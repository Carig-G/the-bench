import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { conversations } from '../api';
import { useAuth } from '../context/AuthContext';

interface StarterPrompt {
  id: string;
  category: string;
  icon: string;
  question: string;
  followUp: string;
  topicSuggestion: string;
  placeholder: string;
}

const STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: 'podcast',
    category: 'Media',
    icon: '🎧',
    question: "What's the best podcast you've listened to lately?",
    followUp: "What made it stick with you? Share an idea or moment that's been on your mind.",
    topicSuggestion: 'Podcasts & Ideas',
    placeholder: "I've been listening to... What struck me was...",
  },
  {
    id: 'book',
    category: 'Media',
    icon: '📚',
    question: "What book has changed how you think about something?",
    followUp: "How did it shift your perspective? What do you see differently now?",
    topicSuggestion: 'Books & Ideas',
    placeholder: "The book that changed my thinking was... It made me realize...",
  },
  {
    id: 'question',
    category: 'Curiosity',
    icon: '🤔',
    question: "What's a question you've been turning over in your mind?",
    followUp: "Share where you are in your thinking. What draws you to this question?",
    topicSuggestion: 'Philosophy',
    placeholder: "I've been wondering... What puzzles me is...",
  },
  {
    id: 'disagree',
    category: 'Ideas',
    icon: '⚡',
    question: "What's something you believe that most people would disagree with?",
    followUp: "Make your case. Why do you hold this view despite it being unpopular?",
    topicSuggestion: 'Contrarian Ideas',
    placeholder: "I think... and here's why most people get it wrong...",
  },
  {
    id: 'learned',
    category: 'Growth',
    icon: '💡',
    question: "What's something you learned recently that surprised you?",
    followUp: "What made it unexpected? How does it connect to other things you know?",
    topicSuggestion: 'Learning & Discovery',
    placeholder: "I recently discovered... What surprised me was...",
  },
  {
    id: 'changed',
    category: 'Growth',
    icon: '🔄',
    question: "What opinion have you changed your mind about?",
    followUp: "What convinced you? Walk us through the shift in your thinking.",
    topicSuggestion: 'Changing Minds',
    placeholder: "I used to believe... but now I think... because...",
  },
  {
    id: 'advice',
    category: 'Life',
    icon: '🧭',
    question: "What advice would you give your younger self?",
    followUp: "What experience taught you this? Why does it matter?",
    topicSuggestion: 'Life Lessons',
    placeholder: "If I could tell my younger self one thing, it would be...",
  },
  {
    id: 'custom',
    category: 'Your Own',
    icon: '✨',
    question: "Have your own topic in mind?",
    followUp: "Share what you want to explore. Be specific about what interests you.",
    topicSuggestion: '',
    placeholder: "I want to explore...",
  },
];

type Step = 'choose' | 'write' | 'details';

export function StartConversation() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('choose');
  const [selectedPrompt, setSelectedPrompt] = useState<StarterPrompt | null>(null);
  const [openingMessage, setOpeningMessage] = useState('');
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleSelectPrompt = (prompt: StarterPrompt) => {
    setSelectedPrompt(prompt);
    setTopic(prompt.topicSuggestion);
    setStep('write');
  };

  const handleContinueToDetails = () => {
    if (!openingMessage.trim()) {
      setError('Please write your opening message');
      return;
    }
    setError('');
    setStep('details');
  };

  const handleBack = () => {
    if (step === 'write') {
      setStep('choose');
      setSelectedPrompt(null);
    } else if (step === 'details') {
      setStep('write');
    }
  };

  const handleAddTag = () => {
    const newTag = tagInput.trim().toLowerCase();
    if (newTag && tags.length < 5 && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setTagInput('');
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please add a title for your conversation');
      return;
    }
    if (!topic.trim()) {
      setError('Please add a topic');
      return;
    }

    setLoading(true);

    try {
      const { conversation } = await conversations.create({
        title: title.trim(),
        topic: topic.trim(),
        openingMessage: openingMessage.trim(),
        tags: tags.length > 0 ? tags : undefined,
      });
      navigate(`/conversation/${conversation.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to start conversation');
      setLoading(false);
    }
  };

  // Step 1: Choose a prompt
  if (step === 'choose') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-warmgray-800 mb-3">Start a Conversation</h1>
          <p className="text-warmgray-500 text-lg">
            What do you want to talk about? Pick a prompt to get started.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => handleSelectPrompt(prompt)}
              className="card-hover text-left group"
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{prompt.icon}</span>
                <div>
                  <div className="text-xs text-warmgray-400 uppercase tracking-wide mb-1">
                    {prompt.category}
                  </div>
                  <h3 className="font-semibold text-warmgray-700 group-hover:text-sage-600 transition-colors">
                    {prompt.question}
                  </h3>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: Write your message
  if (step === 'write') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-warmgray-500 hover:text-warmgray-700 mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to prompts
        </button>

        <div className="bg-sage-50 border border-sage-200 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <span className="text-3xl">{selectedPrompt?.icon}</span>
            <div>
              <h2 className="text-xl font-semibold text-warmgray-800 mb-2">
                {selectedPrompt?.question}
              </h2>
              <p className="text-warmgray-600">
                {selectedPrompt?.followUp}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-terracotta-50 border border-terracotta-200 text-terracotta-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-warmgray-700 mb-2">
            Your opening message
          </label>
          <textarea
            value={openingMessage}
            onChange={(e) => setOpeningMessage(e.target.value)}
            placeholder={selectedPrompt?.placeholder}
            className="textarea h-48"
            autoFocus
          />
          <p className="mt-2 text-sm text-warmgray-500">
            Take your time. This sets the tone for the whole conversation.
          </p>
        </div>

        <button
          onClick={handleContinueToDetails}
          disabled={!openingMessage.trim()}
          className="btn btn-primary w-full py-3"
        >
          Continue
        </button>
      </div>
    );
  }

  // Step 3: Add details
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-warmgray-500 hover:text-warmgray-700 mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to message
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-warmgray-800 mb-2">Almost there</h1>
        <p className="text-warmgray-500">
          Add a title and topic to help others find your conversation.
        </p>
      </div>

      {error && (
        <div className="bg-terracotta-50 border border-terracotta-200 text-terracotta-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Preview */}
      <div className="bg-cream-200 rounded-xl p-5 mb-8">
        <div className="text-xs text-warmgray-500 uppercase tracking-wide mb-2">Your opening message</div>
        <p className="text-warmgray-700 line-clamp-3">{openingMessage}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-warmgray-700 mb-2">
            Conversation title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A compelling question or statement"
            className="input"
            maxLength={255}
          />
          <p className="mt-1.5 text-sm text-warmgray-500">
            This is what people will see when browsing. Make it intriguing.
          </p>
        </div>

        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-warmgray-700 mb-2">
            Topic
          </label>
          <input
            id="topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Philosophy, Technology, Culture"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-warmgray-700 mb-2">
            Tags (optional)
          </label>
          <div className="flex gap-2">
            <input
              id="tags"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Add a tag and press Enter"
              className="input flex-1"
              disabled={tags.length >= 5}
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!tagInput.trim() || tags.length >= 5}
              className="btn btn-secondary"
            >
              Add
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sage-100 text-sage-700 rounded-full text-sm font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-sage-500 hover:text-sage-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-sm text-warmgray-500">
            Add up to 5 tags to help people discover your conversation.
          </p>
        </div>

        <div className="bg-sage-50 border border-sage-200 rounded-xl p-5">
          <h3 className="font-medium text-warmgray-700 mb-2">What happens next?</h3>
          <ul className="text-sm text-warmgray-600 space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-sage-500 mt-0.5">1.</span>
              <span>Your conversation enters the queue</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-sage-500 mt-0.5">2.</span>
              <span>Someone interested in your topic will join</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-sage-500 mt-0.5">3.</span>
              <span>You'll exchange messages back and forth</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-sage-500 mt-0.5">4.</span>
              <span>Readers can pay to follow along</span>
            </li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full py-3 text-lg"
        >
          {loading ? 'Starting...' : 'Start Conversation'}
        </button>
      </form>
    </div>
  );
}
