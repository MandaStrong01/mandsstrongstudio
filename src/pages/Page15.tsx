import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Film, Wand2, Zap, Sparkles, Play, Pause, Layers3, Aperture, Camera, Clock, Wind, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Footer from '../components/Footer';
import QuickAccess from '../components/QuickAccess';
import GrokChat from '../components/GrokChat';

interface PageProps {
  onNavigate: (page: number) => void;
}

interface AIAsset {
  id: string;
  tool_name: string;
  output_data: any;
  created_at: string;
}

export default function Page15({ onNavigate }: PageProps) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<AIAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<AIAsset | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(180);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationStyle, setAnimationStyle] = useState('smooth');
  const [animationSpeed, setAnimationSpeed] = useState(50);
  const [fps, setFps] = useState(30);
  const [depthStrength, setDepthStrength] = useState(50);
  const [motionBlur, setMotionBlur] = useState(0);

  useEffect(() => {
    if (user) {
      loadAssets();
    }
  }, [user]);

  const loadAssets = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_tool_outputs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssets(data || []);
      if (data && data.length > 0) {
        setSelectedAsset(data[0]);
      }
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number) => {
    const mins = Math.floor(minutes);
    const secs = Math.floor((minutes - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-black to-purple-900/20 text-white flex flex-col">
      <div className="flex-1 flex flex-col px-4 py-6">
        <div className="max-w-full w-full mx-auto flex-1 flex flex-col">
          <h1 className="text-3xl font-black text-purple-400 mb-4 text-center">DOXY THE SCHOOL BULLY - AI Animation Lab</h1>

          <div className="grid grid-cols-12 gap-4 flex-1">
            <div className="col-span-3 bg-black/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-4 overflow-y-auto">
              <h2 className="text-xl font-bold mb-4 text-purple-400">MEDIA BOX</h2>
              <div className="space-y-2">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-sm text-slate-400">Loading...</p>
                  </div>
                ) : assets.length === 0 ? (
                  <div className="text-center py-8">
                    <Film className="w-12 h-12 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm text-slate-400">No assets yet</p>
                  </div>
                ) : (
                  assets.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className={`w-full bg-purple-900/20 border rounded-lg p-3 text-left transition-all hover:bg-purple-900/40 ${
                        selectedAsset?.id === asset.id ? 'border-purple-400 bg-purple-900/40' : 'border-purple-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <h3 className="font-semibold text-sm truncate">{asset.tool_name}</h3>
                      </div>
                      <p className="text-xs text-slate-400">
                        {new Date(asset.created_at).toLocaleDateString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="col-span-6 bg-black/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-4 flex flex-col">
              <h2 className="text-xl font-bold mb-4 text-purple-400">VIEWER</h2>
              <div className="flex-1 flex flex-col">
                <div className="aspect-video bg-black rounded-lg border border-purple-500/30 mb-4 flex items-center justify-center">
                  {selectedAsset ? (
                    <div className="text-center p-8">
                      <Wand2 className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                      <h3 className="text-lg font-bold mb-2">{selectedAsset.tool_name}</h3>
                      <p className="text-sm text-white/70">Animate Still Images and Characters with AI</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Wand2 className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                      <p className="text-slate-400">Select an asset to animate</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-all"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <span className="text-sm text-slate-400">{formatTime(currentTime)}</span>
                  </div>

                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max={duration}
                      step="0.1"
                      value={currentTime}
                      onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                      className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #9333ea ${(currentTime / duration) * 100}%, rgba(147, 51, 234, 0.2) ${(currentTime / duration) * 100}%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>0:00</span>
                      <span>180:00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-3 bg-black/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-4 overflow-y-auto">
              <h2 className="text-xl font-bold mb-4 text-purple-400">ANIMATION OPTIONS</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Animation Style</label>
                  <select
                    value={animationStyle}
                    onChange={(e) => setAnimationStyle(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-purple-500/50 rounded-lg text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value="smooth">Smooth Motion</option>
                    <option value="dynamic">Dynamic</option>
                    <option value="cinematic">Cinematic</option>
                    <option value="bounce">Bounce</option>
                    <option value="float">Float</option>
                  </select>
                </div>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Wand2 className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Image to Video</span>
                </button>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Zap className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Morphing Effects</span>
                </button>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Particle Effects</span>
                </button>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Aperture className="w-4 h-4 text-purple-400" />
                    Frame Interpolation (FPS): {fps}
                  </label>
                  <input
                    type="range"
                    min="24"
                    max="120"
                    step="6"
                    value={fps}
                    onChange={(e) => setFps(parseInt(e.target.value))}
                    className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>24</span>
                    <span>60</span>
                    <span>120</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Layers3 className="w-4 h-4 text-purple-400" />
                    Depth/Parallax: {depthStrength}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={depthStrength}
                    onChange={(e) => setDepthStrength(parseInt(e.target.value))}
                    className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Camera className="w-4 h-4 text-purple-400" />
                    Camera Movements
                  </label>
                  <div className="space-y-2">
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Pan
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Tilt
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Zoom
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Dolly
                    </button>
                  </div>
                </div>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Clock className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Time Remapping</span>
                </button>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Wind className="w-4 h-4 text-purple-400" />
                    Motion Blur: {motionBlur}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={motionBlur}
                    onChange={(e) => setMotionBlur(parseInt(e.target.value))}
                    className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Puppet Tool (Character)</span>
                </button>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="text-sm font-semibold mb-2 block">Animation Speed: {animationSpeed}%</label>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    value={animationSpeed}
                    onChange={(e) => setAnimationSpeed(parseInt(e.target.value))}
                    className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Motion Presets</label>
                  <div className="space-y-2">
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Parallax Zoom
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Ken Burns Effect
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Camera Pan
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Rotate 3D
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="text-sm font-semibold mb-2 block">AI Animation Options</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="rounded border-purple-500/50" />
                      <span>Face Animation</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="rounded border-purple-500/50" />
                      <span>Body Movement</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="rounded border-purple-500/50" />
                      <span>Background Motion</span>
                    </label>
                  </div>
                </div>

                <button className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Sparkles className="w-5 h-5" />
                  <span className="font-semibold">Generate Animation</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-center mt-6">
            <button
              onClick={() => onNavigate(14)}
              className="flex items-center gap-2 bg-black text-white font-bold px-8 py-4 rounded-lg text-lg hover:bg-purple-900 transition-all border border-purple-500"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <button
              onClick={() => onNavigate(16)}
              className="flex items-center gap-2 bg-purple-600 text-white font-bold px-8 py-4 rounded-lg text-lg hover:bg-purple-500 transition-all"
            >
              Next
              <ArrowRight className="w-5 h-5" />
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
