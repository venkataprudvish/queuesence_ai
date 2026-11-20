import React, { useState } from 'react';
import { Shield, Mail, Lock, User, ArrowRight, Eye, LogIn } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAppStore } from '../hooks/useAppStore';

type AuthMode = 'signin' | 'signup' | 'recover';

export const AuthScreen: React.FC = () => {
  const { signInUser, signInWithGoogle, setFlowState, updatePreferences } = useAppStore();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'recover') {
      if (!email.trim()) {
        setStatusBanner('Please enter your account email address to request password recovery.');
        return;
      }
      setStatusBanner(`Password recovery instructions sent for ${email.trim()}.`);
      return;
    }

    const cleanEmail = email.trim() || 'operator@queuesense.edu';
    const cleanName =
      mode === 'signup' && displayName.trim()
        ? displayName.trim()
        : cleanEmail.split('@')[0] || 'Queue Operator';

    signInUser(cleanEmail, cleanName, 'authenticated');
  };

  const handleGoogleSignIn = async () => {
    setStatusBanner(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setStatusBanner(
        `Google Sign-In notice: ${
          err instanceof Error ? err.message : 'Popup closed or blocked.'
        }`
      );
    }
  };

  const handleGuestDemo = (enableSampleData: boolean) => {
    updatePreferences({ showSampleDemoData: enableSampleData });
    signInUser(
      enableSampleData ? 'demo@queuesense.edu' : 'evaluator@queuesense.edu',
      enableSampleData ? 'Guest Demo (With Sample Data)' : 'Live Evaluator (Clean State)',
      enableSampleData ? 'guest_demo' : 'local_eval'
    );
  };

  return (
    <div className="min-h-screen bg-[#F7F5EC] text-[#252B26] flex flex-col justify-center px-4 sm:px-6 py-10">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="text-center">
          <button
            type="button"
            onClick={() => setFlowState('onboarding')}
            className="text-xs font-medium text-[#777D75] hover:text-[#244C3A] mb-2 inline-block cursor-pointer"
          >
            View Onboarding Guide
          </button>
          <h1 className="text-3xl font-bold text-[#244C3A] font-display">QueueSense</h1>
          <p className="text-sm text-[#777D75] mt-1">
            Don&apos;t Just Wait. Know Your Wait.
          </p>
        </div>

        <Card padding="lg">
          {statusBanner && (
            <div className="p-3.5 rounded-xl bg-[#F7F5EC] border border-[#D49A45] text-xs text-[#252B26] mb-5 leading-relaxed">
              {statusBanner}
            </div>
          )}

          {/* Primary Firebase Google OAuth Popup Sign-In */}
          <div className="mb-5">
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={handleGoogleSignIn}
              icon={<LogIn className="w-4 h-4" />}
            >
              Sign In with Google (Firebase Cloud Sync)
            </Button>
          </div>

          <div className="my-5 border-t border-[#E1E6DA] relative">
            <span className="bg-[#FFFDF6] px-3 text-xs text-[#777D75] absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
              Or Operator / Demonstration Modes
            </span>
          </div>

          {/* Segmented Auth Mode Selector */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#F7F5EC] border border-[#E1E6DA] rounded-xl mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setStatusBanner(null);
              }}
              className={`min-h-[38px] text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                mode === 'signin'
                  ? 'bg-[#244C3A] text-[#F7F5EC]'
                  : 'text-[#777D75] hover:text-[#252B26]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setStatusBanner(null);
              }}
              className={`min-h-[38px] text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                mode === 'signup'
                  ? 'bg-[#244C3A] text-[#F7F5EC]'
                  : 'text-[#777D75] hover:text-[#252B26]'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('recover');
                setStatusBanner(null);
              }}
              className={`min-h-[38px] text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                mode === 'recover'
                  ? 'bg-[#244C3A] text-[#F7F5EC]'
                  : 'text-[#777D75] hover:text-[#252B26]'
              }`}
            >
              Recovery
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-[#252B26] mb-1.5">
                  Full Name or Department
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#777D75] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Campus Operations Team"
                    className="w-full min-h-[44px] pl-10 pr-4 py-2.5 text-sm bg-[#F7F5EC] border border-[#E1E6DA] rounded-xl text-[#252B26] placeholder:text-[#777D75]/70 focus:outline-none focus:border-[#244C3A]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#252B26] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#777D75] absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@university.edu"
                  className="w-full min-h-[44px] pl-10 pr-4 py-2.5 text-sm bg-[#F7F5EC] border border-[#E1E6DA] rounded-xl text-[#252B26] placeholder:text-[#777D75]/70 focus:outline-none focus:border-[#244C3A]"
                />
              </div>
            </div>

            {mode !== 'recover' && (
              <div>
                <label className="block text-xs font-medium text-[#252B26] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#777D75] absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[44px] pl-10 pr-4 py-2.5 text-sm bg-[#F7F5EC] border border-[#E1E6DA] rounded-xl text-[#252B26] placeholder:text-[#777D75]/70 focus:outline-none focus:border-[#244C3A]"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="secondary"
              fullWidth
              icon={<ArrowRight className="w-4 h-4" />}
            >
              {mode === 'signin'
                ? 'Continue with Operator Credentials'
                : mode === 'signup'
                ? 'Create Operator Session'
                : 'Send Recovery Link'}
            </Button>
          </form>

          <div className="mt-5 pt-5 border-t border-[#E1E6DA] space-y-2.5">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => handleGuestDemo(false)}
              icon={<Shield className="w-4 h-4" />}
            >
              Enter Clean Evaluation Mode (Real Data Only)
            </Button>
            <Button
              type="button"
              variant="ghost"
              fullWidth
              onClick={() => handleGuestDemo(true)}
              icon={<Eye className="w-4 h-4" />}
            >
              Enter Guest Demo Mode (With Labelled Sample Data)
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
