import { Film } from 'lucide-react';
import QuickAccess from '../components/QuickAccess';
import GrokChat from '../components/GrokChat';

interface PageProps {
  onNavigate: (page: number) => void;
}

export default function Page1({ onNavigate }: PageProps) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-black to-purple-900/30 animate-pulse"></div>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_purple_1px,_transparent_1px)] bg-[length:50px_50px]"></div>
        </div>
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-800/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
      </div>

      <div className="relative z-10 text-center max-w-5xl">
        <div className="flex justify-center mb-8">
          <div className="bg-purple-900/30 backdrop-blur-sm p-6 rounded-2xl border border-purple-500/50 shadow-2xl">
            <Film className="w-20 h-20 text-white" />
          </div>
        </div>

        <h1 className="text-7xl md:text-8xl font-black mb-6 tracking-tight">
          <span className="bg-gradient-to-r from-purple-400 via-purple-300 to-purple-400 bg-clip-text text-transparent">
            MANDASTRONG'S
          </span>
          <br />
          <span className="bg-gradient-to-r from-purple-400 via-purple-300 to-purple-400 bg-clip-text text-transparent">
            STUDIO
          </span>
        </h1>

        <p className="text-2xl md:text-3xl font-bold italic mb-12 text-purple-400">
          Welcome To The All-In-One Make-A-Movie-With-Two-Hours-Duration App!
        </p>

        <div className="flex flex-col items-center gap-6">
          <button
            onClick={() => onNavigate(2)}
            className="bg-purple-600 text-white font-bold px-16 py-4 rounded-lg text-xl hover:bg-purple-500 transition-all transform hover:scale-105 shadow-xl w-full max-w-md"
          >
            Next
          </button>

          <div className="flex gap-4 w-full max-w-md justify-center">
            <button
              onClick={() => onNavigate(3)}
              className="flex-1 bg-black text-white font-bold px-8 py-3 rounded-lg text-lg hover:bg-purple-900 transition-all border-2 border-purple-500 shadow-xl"
            >
              Login
            </button>
            <button
              onClick={() => onNavigate(3)}
              className="flex-1 bg-black text-white font-bold px-8 py-3 rounded-lg text-lg hover:bg-purple-900 transition-all border-2 border-purple-500 shadow-xl"
            >
              Register
            </button>
          </div>
        </div>
      </div>
      <QuickAccess onNavigate={onNavigate} />
      <GrokChat onNavigate={onNavigate} />
    </div>
  );
}
