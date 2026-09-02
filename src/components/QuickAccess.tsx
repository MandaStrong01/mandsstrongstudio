import { useState } from 'react';
import { Menu, Home, Film, Wand2, FileText, Users, HelpCircle, X } from 'lucide-react';

interface QuickAccessProps {
  onNavigate: (page: number) => void;
}

export default function QuickAccess({ onNavigate }: QuickAccessProps) {
  const [isOpen, setIsOpen] = useState(false);

  const quickLinks = [
    { page: 1, icon: Home, label: 'Home', color: 'text-purple-400' },
    { page: 4, icon: Wand2, label: 'AI Tools Hub', color: 'text-blue-400' },
    { page: 10, icon: Film, label: 'Doxy Movie', color: 'text-green-400' },
    { page: 11, icon: FileText, label: 'Editor Dashboard', color: 'text-yellow-400' },
    { page: 19, icon: HelpCircle, label: 'Help Desk', color: 'text-pink-400' },
    { page: 20, icon: Users, label: 'Community', color: 'text-cyan-400' },
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 sm:top-6 right-4 sm:right-6 z-50 bg-purple-600 hover:bg-purple-500 text-white p-3 sm:p-4 rounded-full shadow-2xl transition-all hover:scale-110"
        aria-label="Quick Access Menu"
      >
        {isOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed top-16 sm:top-24 right-4 sm:right-6 z-50 bg-black/90 backdrop-blur-xl rounded-2xl border border-purple-500/50 shadow-2xl p-3 sm:p-4 min-w-[200px] sm:min-w-[250px] max-w-[calc(100vw-2rem)]">
            <h3 className="text-white font-bold text-base sm:text-lg mb-2 sm:mb-3 px-2">Quick Access</h3>
            <div className="space-y-2">
              {quickLinks.map((link) => (
                <button
                  key={link.page}
                  onClick={() => {
                    onNavigate(link.page);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all text-left group"
                >
                  <link.icon className={`w-5 h-5 ${link.color} group-hover:scale-110 transition-transform`} />
                  <span className="text-white font-semibold">{link.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
