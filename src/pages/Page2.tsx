import { Sparkles } from 'lucide-react';
import QuickAccess from '../components/QuickAccess';
import GrokChat from '../components/GrokChat';

interface PageProps {
  onNavigate: (page: number) => void;
}

export default function Page2({ onNavigate }: PageProps) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/30 via-black to-purple-900/30 animate-pulse"></div>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_purple_1px,_transparent_1px)] bg-[length:50px_50px]"></div>
        </div>
        <div className="absolute inset-0">
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
          <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-purple-800/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
        </div>
      </div>

      <div className="relative z-10 text-center max-w-5xl">
        <div className="flex justify-center mb-8">
          <div className="bg-purple-900/30 backdrop-blur-sm p-6 rounded-2xl border border-purple-500/50 shadow-2xl">
            <Sparkles className="w-20 h-20 text-white" />
          </div>
        </div>

        <h1 className="text-7xl md:text-8xl font-black mb-6 tracking-tight text-purple-400">
          MANDASTRONG'S
          <br />
          <span className="bg-gradient-to-r from-purple-400 via-purple-300 to-purple-400 bg-clip-text text-transparent">
            STUDIO
          </span>
        </h1>

        <p className="text-2xl md:text-3xl font-bold italic mb-6 text-purple-400">
          Welcome!
        </p>

        <p className="text-xl md:text-2xl font-semibold mb-12 text-purple-400">
          Make Awesome Family Movies Or Put Your Dreams Into Film Reality! Enjoy!
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={() => onNavigate(1)}
            className="bg-black text-white font-bold px-10 py-4 rounded-lg text-lg hover:bg-purple-900 transition-all border border-purple-500 shadow-xl flex items-center gap-2"
          >
            <span>Back</span>
          </button>
          <button
            onClick={() => onNavigate(3)}
            className="bg-purple-600 text-white font-bold px-10 py-4 rounded-lg text-lg hover:bg-purple-500 transition-all transform hover:scale-105 shadow-xl flex items-center gap-2"
          >
            <span>Next</span>
          </button>
        </div>
      </div>
      <QuickAccess onNavigate={onNavigate} />
      <GrokChat onNavigate={onNavigate} />
    </div>
  );
}
