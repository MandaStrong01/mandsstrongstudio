import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Film, Palette, Droplet, Sun, Contrast, Download, Save, Sparkles, Play, Pause, Activity, Maximize2, Circle, Zap, Flame, SplitSquareHorizontal } from 'lucide-react';
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

export default function Page16({ onNavigate }: PageProps) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<AIAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<AIAsset | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(180);
  const [isPlaying, setIsPlaying] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [shadows, setShadows] = useState(50);
  const [midtones, setMidtones] = useState(50);
  const [highlights, setHighlights] = useState(50);
  const [sharpness, setSharpness] = useState(50);
  const [denoise, setDenoise] = useState(false);
  const [filmGrain, setFilmGrain] = useState(0);
  const [splitView, setSplitView] = useState(false);

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
          <h1 className="text-3xl font-black text-purple-400 mb-4 text-center">DOXY THE SCHOOL BULLY - Color Grade / Visual FX</h1>

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
                      <Palette className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                      <h3 className="text-lg font-bold mb-2">{selectedAsset.tool_name}</h3>
                      <p className="text-sm text-white/70">Apply LUTs, Filters, Transitions, and Effects</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Palette className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                      <p className="text-slate-400">Select an asset to apply effects</p>
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
              <h2 className="text-xl font-bold mb-4 text-purple-400">COLOR & FX TOOLS</h2>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Sun className="w-4 h-4 text-purple-400" />
                    Brightness: {brightness}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                    className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Contrast className="w-4 h-4 text-purple-400" />
                    Contrast: {contrast}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={contrast}
                    onChange={(e) => setContrast(parseInt(e.target.value))}
                    className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Droplet className="w-4 h-4 text-purple-400" />
                    Saturation: {saturation}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={saturation}
                    onChange={(e) => setSaturation(parseInt(e.target.value))}
                    className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="flex items-center gap-2 text-sm font-semibold mb-3">
                    <Palette className="w-4 h-4 text-purple-400" />
                    Color Wheels
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Shadows: {shadows}</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={shadows}
                        onChange={(e) => setShadows(parseInt(e.target.value))}
                        className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Midtones: {midtones}</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={midtones}
                        onChange={(e) => setMidtones(parseInt(e.target.value))}
                        className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Highlights: {highlights}</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={highlights}
                        onChange={(e) => setHighlights(parseInt(e.target.value))}
                        className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Activity className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Curves Adjustment</span>
                </button>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Palette className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">HSL by Color</span>
                </button>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="text-sm font-semibold mb-2 block">Color Grading LUTs</label>
                  <div className="space-y-2">
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Cinematic
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Vintage
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Black & White
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Warm Tone
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Cool Tone
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Import Custom LUT
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Maximize2 className="w-4 h-4 text-purple-400" />
                    Sharpness/Clarity: {sharpness}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sharpness}
                    onChange={(e) => setSharpness(parseInt(e.target.value))}
                    className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <button
                  onClick={() => setDenoise(!denoise)}
                  className={`w-full flex items-center gap-3 border rounded-lg p-3 transition-all ${denoise ? 'bg-purple-600 border-purple-400' : 'bg-purple-900/30 hover:bg-purple-900/50 border-purple-500/30'}`}
                >
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Denoise</span>
                </button>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Circle className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Chromatic Aberration</span>
                </button>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Flame className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Light Leaks Overlay</span>
                </button>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Zap className="w-4 h-4 text-purple-400" />
                    Film Grain: {filmGrain}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filmGrain}
                    onChange={(e) => setFilmGrain(parseInt(e.target.value))}
                    className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <button
                  onClick={() => setSplitView(!splitView)}
                  className={`w-full flex items-center gap-3 border rounded-lg p-3 transition-all ${splitView ? 'bg-purple-600 border-purple-400' : 'bg-purple-900/30 hover:bg-purple-900/50 border-purple-500/30'}`}
                >
                  <SplitSquareHorizontal className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Split Before/After View</span>
                </button>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="text-sm font-semibold mb-2 block">Visual Effects</label>
                  <div className="space-y-2">
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Blur / Focus
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Vignette
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Lens Flare
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="text-sm font-semibold mb-2 block">Transitions</label>
                  <div className="space-y-2">
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Fade
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Dissolve
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Wipe
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-purple-500/30 flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 rounded-lg p-3 transition-all">
                    <Download className="w-4 h-4" />
                    <span className="font-semibold text-sm">Download</span>
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 rounded-lg p-3 transition-all">
                    <Save className="w-4 h-4" />
                    <span className="font-semibold text-sm">Export</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-center mt-6">
            <button
              onClick={() => onNavigate(15)}
              className="flex items-center gap-2 bg-black text-white font-bold px-8 py-4 rounded-lg text-lg hover:bg-purple-900 transition-all border border-purple-500"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <button
              onClick={() => onNavigate(17)}
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
