import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../api';

export function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const [step, setStep] = useState<'credentials' | 'moniker'>('credentials');
  const [moniker, setMoniker] = useState('');
  const { register, refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await register(username, password);
      // Get the user's moniker from the API
      const { user } = await auth.me();
      setMoniker(user.moniker || 'Anonymous User');
      setStep('moniker');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleShuffle = async () => {
    setShuffling(true);
    try {
      const result = await auth.shuffleMoniker();
      setMoniker(result.moniker);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to shuffle moniker');
    } finally {
      setShuffling(false);
    }
  };

  const handleConfirm = () => {
    navigate('/');
  };

  if (step === 'moniker') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="card w-full max-w-md text-center">
          <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-sage-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-warmgray-800 mb-2">Your Moniker</h1>
          <p className="text-warmgray-500 mb-6">
            This is your anonymous identity on The Bench. Other users will see this after 10 conversations.
          </p>

          <div className="bg-sage-50 border border-sage-200 rounded-xl p-6 mb-6">
            <div className="text-2xl font-bold text-sage-700 mb-2">
              {moniker}
            </div>
            <p className="text-sm text-sage-600">
              Your unique moniker
            </p>
          </div>

          <button
            onClick={handleShuffle}
            disabled={shuffling}
            className="btn btn-outline w-full mb-3"
          >
            {shuffling ? 'Shuffling...' : 'Shuffle for a new one'}
          </button>

          <button
            onClick={handleConfirm}
            className="btn btn-primary w-full"
          >
            Keep this moniker
          </button>

          <p className="mt-6 text-xs text-warmgray-400">
            Your moniker is permanent once you start conversing. You won't be able to change it later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-warmgray-800 mb-2">Create an account</h1>
        <p className="text-warmgray-500 mb-6">Join The Bench and start meaningful conversations</p>

        {error && (
          <div className="mb-4 p-3 bg-terracotta-50 border border-terracotta-200 rounded-lg text-terracotta-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm text-warmgray-600 mb-1.5">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              minLength={3}
              maxLength={50}
              required
            />
            <p className="text-xs text-warmgray-400 mt-1">This is private and used only for login</p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-warmgray-600 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              minLength={6}
              required
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm text-warmgray-600 mb-1.5">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-warmgray-500 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-sage-500 hover:text-sage-600 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
