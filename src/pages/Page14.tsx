import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Film, Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Sparkles, Play, Pause, Minus, Circle, Box, Layers, Spline, Cuboid } from 'lucide-react';
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

export default function Page14({ onNavigate }: PageProps) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<AIAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<AIAsset | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(180);
  const [isPlaying, setIsPlaying] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [fontSize, setFontSize] = useState(24);
  const [textColor, setTextColor] = useState('#ffffff');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [shadowOffset, setShadowOffset] = useState(0);
  const [shadowBlur, setShadowBlur] = useState(0);
  const [shadowOpacity, setShadowOpacity] = useState(100);
  const [text3D, setText3D] = useState(false);

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
          <h1 className="text-3xl font-black text-purple-400 mb-4 text-center">DOXY THE SCHOOL BULLY - Title & Text Creator</h1>

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
                      <Type className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                      <h3 className="text-lg font-bold mb-2">{selectedAsset.tool_name}</h3>
                      <p className="text-sm text-white/70">Create Title Cards, Captions, and Lower Thirds</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Type className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                      <p className="text-slate-400">Select an asset to add text</p>
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
              <h2 className="text-xl font-bold mb-4 text-purple-400">TEXT TOOLS</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Text Content</label>
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Enter your text here..."
                    className="w-full px-3 py-2 bg-black border border-purple-500/50 rounded-lg text-white focus:outline-none focus:border-purple-400 resize-none"
                    rows={4}
                  />
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 p-2 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg transition-all">
                    <Bold className="w-4 h-4 mx-auto" />
                  </button>
                  <button className="flex-1 p-2 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg transition-all">
                    <Italic className="w-4 h-4 mx-auto" />
                  </button>
                  <button className="flex-1 p-2 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg transition-all">
                    <Underline className="w-4 h-4 mx-auto" />
                  </button>
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 p-2 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg transition-all">
                    <AlignLeft className="w-4 h-4 mx-auto" />
                  </button>
                  <button className="flex-1 p-2 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg transition-all">
                    <AlignCenter className="w-4 h-4 mx-auto" />
                  </button>
                  <button className="flex-1 p-2 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg transition-all">
                    <AlignRight className="w-4 h-4 mx-auto" />
                  </button>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Font Family</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-purple-500/50 rounded-lg text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Impact">Impact</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Font Size: {fontSize}px</label>
                  <input
                    type="range"
                    min="12"
                    max="72"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Text Color</label>
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-full h-10 bg-black border border-purple-500/50 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="text-sm font-semibold mb-2 block">Text Animation Presets</label>
                  <div className="space-y-2">
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Fade In
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Slide In
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Typewriter
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Bounce
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all text-left">
                      Zoom In
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Minus className="w-4 h-4 text-purple-400" />
                    Stroke Width: {strokeWidth}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                    className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="mt-2">
                    <label className="text-xs text-slate-400 mb-1 block">Stroke Color</label>
                    <input
                      type="color"
                      value={strokeColor}
                      onChange={(e) => setStrokeColor(e.target.value)}
                      className="w-full h-8 bg-black border border-purple-500/50 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Circle className="w-4 h-4 text-purple-400" />
                    Shadow Controls
                  </label>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Offset: {shadowOffset}px</label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={shadowOffset}
                        onChange={(e) => setShadowOffset(parseInt(e.target.value))}
                        className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Blur: {shadowBlur}px</label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={shadowBlur}
                        onChange={(e) => setShadowBlur(parseInt(e.target.value))}
                        className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Opacity: {shadowOpacity}%</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={shadowOpacity}
                        onChange={(e) => setShadowOpacity(parseInt(e.target.value))}
                        className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Box className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Text Background Options</span>
                </button>

                <button
                  onClick={() => setText3D(!text3D)}
                  className={`w-full flex items-center gap-3 border rounded-lg p-3 transition-all ${text3D ? 'bg-purple-600 border-purple-400' : 'bg-purple-900/30 hover:bg-purple-900/50 border-purple-500/30'}`}
                >
                  <Cuboid className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">3D Text</span>
                </button>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Spline className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Text Path/Curve Tools</span>
                </button>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Layers className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Multiple Text Layers</span>
                </button>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Type className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Text Masking</span>
                </button>

                <button className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Sparkles className="w-5 h-5" />
                  <span className="font-semibold">Generate AI Text</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-center mt-6">
            <button
              onClick={() => onNavigate(13)}
              className="flex items-center gap-2 bg-black text-white font-bold px-8 py-4 rounded-lg text-lg hover:bg-purple-900 transition-all border border-purple-500"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <button
              onClick={() => onNavigate(15)}
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
