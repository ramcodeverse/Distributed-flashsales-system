import { useState } from 'react';
import { useAuth } from '../lib/useAuth';
import { Zap, Mail, Lock, ArrowRight, Loader2, Shield } from 'lucide-react';

export function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fn = isSignUp ? signUp : signIn;
    const { error } = await fn(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[480px] relative overflow-hidden bg-zinc-950 border-r border-zinc-800/40">
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-amber-500/[0.03] rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-orange-500/[0.02] rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-12">
          <div className="inline-flex items-center gap-2.5 mb-10">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-zinc-950" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">FlashDeal</span>
          </div>

          <h2 className="text-3xl font-bold text-white leading-tight mb-3">
            Lightning-fast deals.<br />
            <span className="text-amber-400">Zero overselling.</span>
          </h2>

          <p className="text-zinc-500 text-sm leading-relaxed mb-10 max-w-sm">
            Production-grade flash sale system built for 10K+ concurrent users with atomic inventory control and sub-200ms response times.
          </p>

          <div className="space-y-3">
            {[
              { icon: Shield, text: 'Atomic stock decrement prevents overselling' },
              { icon: Zap, text: 'Real-time stock updates via WebSockets' },
              { icon: Shield, text: 'Rate limiting & idempotency for abuse prevention' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 text-zinc-500">
                <div className="w-7 h-7 rounded-md bg-amber-500/[0.07] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <span className="text-[13px]">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px]">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center">
                <Zap className="w-4.5 h-4.5 text-zinc-950" />
              </div>
              <span className="text-lg font-bold text-white">FlashDeal</span>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-7">
            <h2 className="text-lg font-semibold text-white mb-0.5">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-[13px] text-zinc-500 mb-6">
              {isSignUp ? 'Sign up to grab flash deals' : 'Sign in to access flash sales'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-medium text-zinc-500 mb-1.5 uppercase tracking-widest">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-800/50 border border-zinc-700/40 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/30 transition-all"
                    placeholder="you@example.com" required />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-zinc-500 mb-1.5 uppercase tracking-widest">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zinc-800/50 border border-zinc-700/40 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/30 transition-all"
                    placeholder="Min 6 characters" required minLength={6} />
                </div>
              </div>

              {error && (
                <div className="animate-bounce-in bg-red-500/[0.07] border border-red-500/15 rounded-lg px-3.5 py-2.5 text-red-300 text-[13px]">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 hover:shadow-amber-500/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>{isSignUp ? 'Create Account' : 'Sign In'} <ArrowRight className="w-3.5 h-3.5" /></>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-zinc-800/40 text-center">
              <button onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
                className="text-[13px] text-zinc-600 hover:text-amber-400 transition-colors">
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
