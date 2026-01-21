import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { conversations } from '../api';
import { useAuth } from '../context/AuthContext';
import { TrendingTags } from '../components/TrendingTags';
import { ConversationCard } from '../components/ConversationCard';
import { ConversationGrid } from '../components/ConversationGrid';
import type { BrowseConversation, TrendingTag } from '../types';

export function Browse() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [openBenches, setOpenBenches] = useState<BrowseConversation[]>([]);
  const [activeConversations, setActiveConversations] = useState<BrowseConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [error, setError] = useState('');
  const [joiningId, setJoiningId] = useState<number | null>(null);

  useEffect(() => {
    loadTrendingTags();
  }, []);

  useEffect(() => {
    loadBrowseData();
  }, [selectedTag]);

  const loadTrendingTags = async () => {
    setTagsLoading(true);
    try {
      const result = await conversations.getTrendingTags(15);
      setTrendingTags(result.tags);
    } catch (err: any) {
      console.error('Failed to load trending tags:', err);
    } finally {
      setTagsLoading(false);
    }
  };

  const loadBrowseData = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await conversations.browse(selectedTag || undefined);
      setOpenBenches(result.openBenches);
      setActiveConversations(result.activeConversations);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (id: number) => {
    if (!user) {
      navigate('/login');
      return;
    }

    setJoiningId(id);
    try {
      await conversations.join(id);
      navigate(`/conversation/${id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join conversation');
      setJoiningId(null);
    }
  };

  // Empty state for Open Benches
  const OpenBenchesEmptyState = (
    <div className="bg-cream-200 rounded-xl p-8 text-center">
      <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-sage-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-warmgray-700 mb-2">No open benches right now</h3>
      <p className="text-warmgray-500 mb-6">Be the first to start a conversation on this topic.</p>
      <Link to="/start" className="btn btn-primary">
        Start a Conversation
      </Link>
    </div>
  );

  // Empty state for Active Conversations
  const ActiveEmptyState = (
    <div className="bg-cream-200 rounded-xl p-8 text-center">
      <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-sage-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-warmgray-700 mb-2">No active conversations yet</h3>
      <p className="text-warmgray-500">Join an open bench to start a dialogue.</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-warmgray-800 mb-3">
          Browse Conversations
        </h1>
        <p className="text-warmgray-500 text-lg max-w-2xl mx-auto">
          Discover dialogues worth following or join a conversation waiting for a partner.
        </p>
      </div>

      {/* Trending Topics */}
      {(tagsLoading || trendingTags.length > 0) && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-warmgray-500 uppercase tracking-wide mb-4">
            Trending Topics
          </h2>
          <TrendingTags
            tags={trendingTags}
            selectedTag={selectedTag}
            onTagSelect={setSelectedTag}
            loading={tagsLoading}
          />
        </section>
      )}

      {/* Error */}
      {error && (
        <div className="bg-terracotta-50 border border-terracotta-200 text-terracotta-700 px-4 py-3 rounded-lg mb-8">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-12">
          {/* Skeleton for Open Benches */}
          <section>
            <div className="h-8 w-48 bg-cream-200 rounded mb-2 animate-pulse" />
            <div className="h-5 w-64 bg-cream-100 rounded mb-6 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-cream-100 border border-cream-200 rounded-xl h-72 animate-pulse" />
              ))}
            </div>
          </section>
          {/* Skeleton for Active */}
          <section>
            <div className="h-8 w-56 bg-cream-200 rounded mb-2 animate-pulse" />
            <div className="h-5 w-72 bg-cream-100 rounded mb-6 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-cream-100 border border-cream-200 rounded-xl h-72 animate-pulse" />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <>
          {/* Open Benches Section */}
          <ConversationGrid
            title="Open Benches"
            subtitle="Conversations waiting for a partner - start talking"
            isEmpty={openBenches.length === 0}
            emptyState={OpenBenchesEmptyState}
          >
            {openBenches.map((conv) => (
              <ConversationCard
                key={conv.id}
                id={conv.id}
                title={conv.title}
                openingPost={conv.opening_post}
                tags={conv.tags}
                messageCount={conv.message_count || 0}
                readerCount={conv.reader_count || 0}
                createdAt={conv.created_at}
                updatedAt={conv.updated_at}
                status={conv.status}
                variant="openBench"
                onJoin={() => handleJoin(conv.id)}
                joining={joiningId === conv.id}
              />
            ))}
          </ConversationGrid>

          {/* Active Conversations Section */}
          <ConversationGrid
            title="Active Conversations"
            subtitle="Ongoing dialogues you can follow along"
            isEmpty={activeConversations.length === 0}
            emptyState={ActiveEmptyState}
          >
            {activeConversations.map((conv) => (
              <ConversationCard
                key={conv.id}
                id={conv.id}
                title={conv.title}
                openingPost={conv.opening_post}
                tags={conv.tags}
                messageCount={conv.message_count || 0}
                readerCount={conv.reader_count || 0}
                createdAt={conv.created_at}
                updatedAt={conv.updated_at}
                status={conv.status}
                variant="active"
              />
            ))}
          </ConversationGrid>
        </>
      )}

      {/* Bottom CTA */}
      <div className="mt-16 text-center bg-gradient-to-r from-sage-50 to-cream-200 rounded-2xl p-8 border border-sage-200">
        <h3 className="text-xl font-semibold text-warmgray-700 mb-3">
          Have something to say?
        </h3>
        <p className="text-warmgray-500 mb-6 max-w-md mx-auto">
          Start a conversation and wait for someone to join the dialogue.
        </p>
        <Link to="/start" className="btn btn-primary">
          Start a Conversation
        </Link>
      </div>
    </div>
  );
}
