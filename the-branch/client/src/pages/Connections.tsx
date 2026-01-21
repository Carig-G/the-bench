import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pairs, auth } from '../api';
import { useAuth } from '../context/AuthContext';
import type { ConversationPair, UserStats, User } from '../types';

export function Connections() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [pairsList, setPairsList] = useState<ConversationPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profile, setProfile] = useState({ display_name: '', contact_info: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadData();
    // Initialize profile from user data
    setProfile({
      display_name: (user as User & { display_name?: string })?.display_name || '',
      contact_info: (user as User & { contact_info?: string })?.contact_info || '',
    });
  }, [user]);

  const loadData = async () => {
    try {
      const [statsResult, pairsResult] = await Promise.all([
        pairs.stats(),
        pairs.list(),
      ]);
      setStats(statsResult.stats);
      setPairsList(pairsResult.pairs);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReveal = async (pairId: number) => {
    try {
      const result = await pairs.requestReveal(pairId);
      // Reload data to reflect changes
      loadData();
      if (result.revealed) {
        alert('Identity revealed! You can now see each other\'s contact info.');
      } else {
        alert('Reveal request sent! Waiting for your partner to agree.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to request reveal');
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await auth.updateProfile(profile);
      // Refresh user context to get updated data
      await refreshUser();
      setShowProfileModal(false);
      alert('Profile updated! This info will be shared when you reveal your identity.');
    } catch (err: any) {
      alert(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const eligiblePairs = pairsList.filter(p => p.conversation_count >= 10 && !p.revealed);
  const revealedPairs = pairsList.filter(p => p.revealed);
  const inProgressPairs = pairsList.filter(p => p.conversation_count < 10);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-warmgray-800 mb-2">Connections</h1>
          <p className="text-warmgray-500">Track your conversation partners and reveals</p>
        </div>
        <button
          onClick={() => setShowProfileModal(true)}
          className="btn btn-outline"
        >
          Edit Profile
        </button>
      </div>

      {error && (
        <div className="bg-terracotta-50 border border-terracotta-200 text-terracotta-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-warmgray-500">Loading connections...</div>
        </div>
      ) : (
        <>
          {/* Stats Dashboard */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl p-5 border border-cream-300 text-center">
                <div className="text-3xl font-bold text-sage-600 mb-1">
                  {stats.total_conversations}
                </div>
                <div className="text-sm text-warmgray-500">Total Conversations</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-cream-300 text-center">
                <div className="text-3xl font-bold text-sage-600 mb-1">
                  {stats.unique_partners}
                </div>
                <div className="text-sm text-warmgray-500">Unique Partners</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-cream-300 text-center">
                <div className="text-3xl font-bold text-terracotta-500 mb-1">
                  {stats.closest_to_reveal}
                </div>
                <div className="text-sm text-warmgray-500">Until Next Reveal</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-cream-300 text-center">
                <div className="text-3xl font-bold text-amber-500 mb-1">
                  {stats.pending_reveals}
                </div>
                <div className="text-sm text-warmgray-500">Pending Reveals</div>
              </div>
            </div>
          )}

          {/* Explanation Banner */}
          <div className="bg-sage-50 border border-sage-200 rounded-xl p-6 mb-8">
            <h3 className="font-semibold text-sage-700 mb-2">How Reveals Work</h3>
            <p className="text-sage-600 text-sm">
              After 10 conversations with the same person, you can both choose to reveal your identities.
              Both parties must agree - it's a mutual decision. Once revealed, you'll see each other's
              contact info and display name.
            </p>
          </div>

          {/* Ready to Reveal */}
          {eligiblePairs.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-warmgray-700 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-terracotta-400 rounded-full animate-pulse"></span>
                Ready to Reveal ({eligiblePairs.length})
              </h2>
              <div className="grid gap-4">
                {eligiblePairs.map(pair => (
                  <div key={pair.id} className="bg-white rounded-xl p-5 border-2 border-terracotta-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-warmgray-700">
                            {pair.partner_username}
                          </span>
                          <span className="px-2 py-0.5 bg-sage-100 text-sage-600 rounded-full text-xs">
                            {pair.conversation_count} conversations
                          </span>
                        </div>
                        <div className="text-sm text-warmgray-500">
                          {pair.i_requested_reveal ? (
                            <span className="text-amber-600">You've requested reveal - waiting for partner</span>
                          ) : pair.partner_requested_reveal ? (
                            <span className="text-terracotta-600 font-medium">Partner wants to reveal!</span>
                          ) : (
                            <span>Both can request reveal</span>
                          )}
                        </div>
                      </div>
                      {!pair.i_requested_reveal && (
                        <button
                          onClick={() => handleRequestReveal(pair.id)}
                          className="btn btn-primary"
                        >
                          {pair.partner_requested_reveal ? 'Accept Reveal' : 'Request Reveal'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Revealed Connections */}
          {revealedPairs.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-warmgray-700 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-sage-400 rounded-full"></span>
                Revealed Connections ({revealedPairs.length})
              </h2>
              <div className="grid gap-4">
                {revealedPairs.map(pair => (
                  <div key={pair.id} className="bg-white rounded-xl p-5 border border-sage-300">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-warmgray-700 text-lg">
                            {pair.partner_display_name || pair.partner_username}
                          </span>
                          <span className="px-2 py-0.5 bg-sage-100 text-sage-600 rounded-full text-xs">
                            {pair.conversation_count} conversations
                          </span>
                        </div>
                        <p className="text-sm text-warmgray-500 mb-1">
                          @{pair.partner_username}
                        </p>
                        {pair.partner_contact_info && (
                          <p className="text-sm text-sage-600 mt-2">
                            <span className="font-medium">Contact:</span> {pair.partner_contact_info}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-warmgray-400">
                        Revealed {pair.revealed_at ? new Date(pair.revealed_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* In Progress */}
          {inProgressPairs.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-warmgray-700 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-warmgray-300 rounded-full"></span>
                Building Connections ({inProgressPairs.length})
              </h2>
              <div className="grid gap-3">
                {inProgressPairs.map(pair => (
                  <div key={pair.id} className="bg-white rounded-xl p-4 border border-cream-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-warmgray-700">
                          {pair.partner_username}
                        </span>
                        <span className="text-sm text-warmgray-500">
                          {pair.conversation_count} / 10 conversations
                        </span>
                      </div>
                      <div className="w-32 bg-cream-200 rounded-full h-2">
                        <div
                          className="bg-sage-400 h-2 rounded-full transition-all"
                          style={{ width: `${(pair.conversation_count / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {pairsList.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-cream-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-warmgray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-warmgray-700 mb-2">No connections yet</h2>
              <p className="text-warmgray-500 mb-6 max-w-md mx-auto">
                Join conversations to start building connections. After 10 conversations with the same person,
                you can both choose to reveal your identities.
              </p>
            </div>
          )}
        </>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-warmgray-800 mb-4">Edit Profile</h2>
            <p className="text-sm text-warmgray-500 mb-6">
              This information will be shared with conversation partners when you mutually reveal identities.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-warmgray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={profile.display_name}
                  onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                  placeholder="Your real name or preferred name"
                  className="w-full px-4 py-2 rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-sage-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-warmgray-700 mb-1">
                  Contact Info
                </label>
                <textarea
                  value={profile.contact_info}
                  onChange={(e) => setProfile({ ...profile, contact_info: e.target.value })}
                  placeholder="Email, social media handles, or other ways to reach you..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-sage-400"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowProfileModal(false)}
                className="btn btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="btn btn-primary flex-1"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
