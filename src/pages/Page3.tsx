import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Footer from '../components/Footer';
import QuickAccess from '../components/QuickAccess';
import GrokChat from '../components/GrokChat';

interface PageProps {
  onNavigate: (page: number) => void;
}

const STRIPE_LINKS = {
  basic: import.meta.env.VITE_STRIPE_BASIC_LINK || '',
  pro: import.meta.env.VITE_STRIPE_PRO_LINK || '',
  studio: import.meta.env.VITE_STRIPE_STUDIO_LINK || '',
};

export default function Page3({ onNavigate }: PageProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(loginEmail, loginPassword);
      onNavigate(4);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedPlan) {
      setError('Please select a plan to continue');
      return;
    }

    setLoading(true);

    try {
      await signUp(registerEmail, registerPassword);
      onNavigate(4);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const openStripeLink = (url: string) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-black to-purple-900/20 text-white flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-6xl flex flex-col">
        <div className="grid md:grid-cols-2 gap-8 mb-12 max-w-4xl mx-auto items-start">
          <div className="bg-gradient-to-br from-purple-900/30 to-black/50 backdrop-blur-xl p-8 rounded-3xl border-2 border-purple-500/60 shadow-2xl shadow-purple-900/50">
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-black border border-purple-500/50 text-white placeholder-white/60 focus:outline-none focus:border-purple-400"
              />
              <input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-black border border-purple-500/50 text-white placeholder-white/60 focus:outline-none focus:border-purple-400"
              />
              {error && (
                <div className="text-white text-sm bg-purple-600/30 px-4 py-2 rounded-lg border border-purple-500">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-500 transition-all disabled:opacity-50"
              >
                {loading ? 'Please wait...' : 'LOGIN'}
              </button>
            </form>
          </div>

          <div className="bg-gradient-to-br from-purple-900/30 to-black/50 backdrop-blur-xl p-8 rounded-3xl border-2 border-purple-500/60 shadow-2xl shadow-purple-900/50">
            <form onSubmit={handleRegister} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-black border border-purple-500/50 text-white placeholder-white/60 focus:outline-none focus:border-purple-400"
              />
              <input
                type="password"
                placeholder="Password"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-black border border-purple-500/50 text-white placeholder-white/60 focus:outline-none focus:border-purple-400"
              />
              <div>
                <label className="block text-sm font-bold mb-2 text-white/80">Select Plan *</label>
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-black border border-purple-500/50 text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="">Choose a plan...</option>
                  <option value="basic">BASIC - $20/month (30 min films)</option>
                  <option value="pro">PRO - $30/month (1 hour films)</option>
                  <option value="studio">STUDIO - $50/month (2.5 hour films)</option>
                </select>
              </div>
              {error && (
                <div className="text-white text-sm bg-purple-600/30 px-4 py-2 rounded-lg border border-purple-500">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-500 transition-all disabled:opacity-50"
              >
                {loading ? 'Please wait...' : 'REGISTER'}
              </button>
            </form>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-3xl font-bold text-center mb-6 text-purple-400">SUBSCRIPTION PLANS</h2>
          <p className="text-center text-white/70 mb-8">Choose the plan that fits your creative vision</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-5xl mx-auto">
          <button
            onClick={() => openStripeLink(STRIPE_LINKS.basic)}
            className="bg-gradient-to-br from-purple-900/30 to-black/50 backdrop-blur-xl border-2 border-purple-500/60 hover:border-purple-400 hover:from-purple-900/40 hover:to-black/60 text-white font-bold py-6 px-6 rounded-3xl transition-all shadow-lg shadow-purple-900/30"
          >
            <div className="text-center">
              <div className="text-3xl font-black mb-2">BASIC</div>
              <div className="text-4xl font-black mb-2 text-purple-400">$20</div>
              <div className="text-lg font-semibold mb-2">Monthly</div>
              <p className="text-sm text-white/80">Perfect for short films, music videos, and quick creative projects</p>
            </div>
          </button>

          <button
            onClick={() => openStripeLink(STRIPE_LINKS.pro)}
            className="bg-gradient-to-br from-purple-900/30 to-black/50 backdrop-blur-xl border-2 border-purple-500/60 hover:border-purple-400 hover:from-purple-900/40 hover:to-black/60 text-white font-bold py-6 px-6 rounded-3xl transition-all shadow-lg shadow-purple-900/30"
          >
            <div className="text-center">
              <div className="text-3xl font-black mb-2">PRO</div>
              <div className="text-4xl font-black mb-2 text-purple-400">$30</div>
              <div className="text-lg font-semibold mb-2">Monthly</div>
              <p className="text-sm text-white/80">Ideal for standard documentaries, corporate videos, and feature-length content</p>
            </div>
          </button>

          <button
            onClick={() => openStripeLink(STRIPE_LINKS.studio)}
            className="bg-gradient-to-br from-purple-900/30 to-black/50 backdrop-blur-xl border-2 border-purple-500/60 hover:border-purple-400 hover:from-purple-900/40 hover:to-black/60 text-white font-bold py-6 px-6 rounded-3xl transition-all shadow-lg shadow-purple-900/30"
          >
            <div className="text-center">
              <div className="text-3xl font-black mb-2">STUDIO</div>
              <div className="text-4xl font-black mb-2 text-purple-400">$50</div>
              <div className="text-lg font-semibold mb-2">Monthly</div>
              <p className="text-sm text-white/80">Complete cinematic experience with full-length film capabilities and unlimited creative freedom</p>
            </div>
          </button>
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={() => onNavigate(2)}
            className="bg-black text-white font-bold px-10 py-4 rounded-lg text-lg hover:bg-purple-900 transition-all border border-purple-500"
          >
            Back
          </button>
          <button
            onClick={() => onNavigate(4)}
            className="bg-purple-600 text-white font-bold px-10 py-4 rounded-lg text-lg hover:bg-purple-500 transition-all border border-purple-500"
          >
            Next
          </button>
        </div>
        </div>
      </div>
      <QuickAccess onNavigate={onNavigate} />
      <GrokChat onNavigate={onNavigate} />
      <Footer />
    </div>
  );
}
