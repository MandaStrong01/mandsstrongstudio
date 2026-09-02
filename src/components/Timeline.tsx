import { Film, FileText, Volume2, Type } from 'lucide-react';

interface TimelineProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

export default function Timeline({ duration, currentTime, onSeek }: TimelineProps) {
  const tracks = [
    { name: 'SRT', icon: FileText, color: 'bg-blue-500/20 border-blue-500/50' },
    { name: 'VIDEO', icon: Film, color: 'bg-purple-500/20 border-purple-500/50' },
    { name: 'AUDIO', icon: Volume2, color: 'bg-green-500/20 border-green-500/50' },
    { name: 'TEXT', icon: Type, color: 'bg-yellow-500/20 border-yellow-500/50' },
  ];

  const formatTime = (minutes: number) => {
    const mins = Math.floor(minutes);
    const secs = Math.floor((minutes - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-black/50 rounded-lg border border-purple-500/30 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white/70">Timeline</span>
        <span className="text-sm text-purple-400 font-semibold">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <div className="space-y-2">
        {tracks.map((track) => (
          <div key={track.name} className="flex items-center gap-2">
            <div className="flex items-center gap-1 w-20">
              <track.icon className="w-3 h-3 text-white/70" />
              <span className="text-xs font-semibold text-white/70">{track.name}</span>
            </div>
            <div className={`flex-1 h-10 rounded border relative cursor-pointer ${track.color}`}>
              <div
                className="absolute top-0 left-0 bottom-0 bg-white/10"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-purple-400"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <input
          type="range"
          min="0"
          max={duration}
          step="0.1"
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #9333ea ${(currentTime / duration) * 100}%, rgba(147, 51, 234, 0.2) ${(currentTime / duration) * 100}%)`
          }}
        />
      </div>
    </div>
  );
}
