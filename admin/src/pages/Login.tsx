import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (resetMode) {
      if (!email) {
        toast.error('Please enter your email');
        return;
      }
      setLoading(true);
      try {
        await resetPassword(email);
        toast.success('Password reset email sent!');
        setResetMode(false);
      } catch (error) {
        toast.error('Failed to send reset email');
      }
      setLoading(false);
      return;
    }

    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to sign in';
      toast.error(message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-purple via-brand-purple-dark to-brand-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-brand-purple rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-bold text-white">V</span>
            </div>
            <h1 className="text-2xl font-bold text-brand-dark">
              {resetMode ? 'Reset Password' : 'Welcome Back'}
            </h1>
            <p className="text-gray-500 mt-2">
              {resetMode
                ? 'Enter your email to receive a reset link'
                : 'Sign in to the admin panel'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="admin@example.com"
                  autoComplete="email"
                />
              </div>
            </div>

            {!resetMode && (
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-10 pr-10"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : resetMode ? (
                'Send Reset Link'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setResetMode(!resetMode)}
              className="text-sm text-brand-purple hover:underline"
            >
              {resetMode ? 'Back to sign in' : 'Forgot password?'}
            </button>
          </div>
        </div>

        <p className="text-center text-white/60 text-sm mt-6">
          The Vintage Realtors Admin Panel
        </p>
      </div>
    </div>
  );
}
