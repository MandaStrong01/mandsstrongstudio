import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Film, Volume2, Mic, Music, Sparkles, Play, Pause, VolumeX, Sliders, Headphones, Radio, BarChart3, Layers, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadFile } from '../lib/storage';
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

export default function Page13({ onNavigate }: PageProps) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<AIAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; type: string; url: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAsset, setSelectedAsset] = useState<AIAsset | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(180);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(100);
  const [audioType, setAudioType] = useState('music');
  const [audioDucking, setAudioDucking] = useState(false);
  const [noiseReduction, setNoiseReduction] = useState(false);
  const [bass, setBass] = useState(50);
  const [mid, setMid] = useState(50);
  const [treble, setTreble] = useState(50);
  const [compressor, setCompressor] = useState(false);
  const [normalize, setNormalize] = useState(false);

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = '';

    setUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);
    setUploadError('');

    const fileList = Array.from(files);
    const results: Array<{ name: string; type: string; url: string }> = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const assetType = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';

      if (user) {
        const result = await uploadFile(file, user.id, (p) => {
          const overall = Math.round(((i / fileList.length) + (p / 100) / fileList.length) * 100);
          setUploadProgress(overall);
        });
        if (result.success && result.fileUrl) {
          results.push({ name: file.name, type: assetType, url: result.fileUrl });
        } else {
          setUploadStatus('error');
          setUploadError(result.error || 'Upload failed');
          setUploading(false);
          setTimeout(() => setUploadStatus('idle'), 3000);
          return;
        }
      } else {
        // Guest: local object URL only
        results.push({ name: file.name, type: assetType, url: URL.createObjectURL(file) });
      }
    }

    setUploadedFiles(prev => [...prev, ...results]);
    setUploading(false);
    setUploadProgress(100);
    setUploadStatus('success');
    // Refresh the asset list so new uploads appear in MEDIA BOX
    if (user) loadAssets();
    setTimeout(() => setUploadStatus('idle'), 2500);
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
          <h1 className="text-3xl font-black text-purple-400 mb-4 text-center">DOXY THE SCHOOL BULLY - Sound & Voice Studio</h1>

          <div className="grid grid-cols-12 gap-4 flex-1">
            <div className="col-span-3 bg-black/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-4 overflow-y-auto">
              <h2 className="text-xl font-bold mb-3 text-purple-400">MEDIA BOX</h2>

              {/* Upload button */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="video/*,audio/*,image/*"
                onChange={handleUpload}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed border rounded-lg p-3 transition-all mb-1 font-bold text-sm relative overflow-hidden"
                style={{
                  background: uploadStatus === 'error' ? '#7f1d1d' : uploadStatus === 'success' ? '#14532d' : '#7c3aed',
                  borderColor: uploadStatus === 'error' ? '#ef4444' : uploadStatus === 'success' ? '#22c55e' : '#a78bfa',
                }}
              >
                {/* Progress fill */}
                {uploadStatus === 'uploading' && (
                  <div className="absolute inset-0 bg-purple-400/30 transition-all" style={{ width: `${uploadProgress}%` }} />
                )}
                <span className="relative flex items-center gap-2">
                  {uploadStatus === 'uploading' ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : uploadStatus === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : uploadStatus === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploadStatus === 'uploading' ? `UPLOADING... ${uploadProgress}%` : uploadStatus === 'success' ? 'SAVED TO LIBRARY!' : uploadStatus === 'error' ? 'UPLOAD FAILED' : 'UPLOAD MEDIA'}
                </span>
              </button>
              {uploadStatus === 'error' && (
                <p className="text-red-400 text-xs mb-2 px-1">{uploadError}</p>
              )}
              {uploadStatus !== 'error' && <div className="mb-2" />}

              {/* Locally uploaded files */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-1 mb-3">
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Uploaded</p>
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-purple-900/20 border border-purple-500/30 rounded-lg px-3 py-2">
                      {f.type === 'video' ? <Film className="w-3 h-3 text-purple-400 shrink-0" /> : f.type === 'audio' ? <Music className="w-3 h-3 text-purple-400 shrink-0" /> : <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />}
                      <span className="text-xs truncate text-slate-300">{f.name}</span>
                    </div>
                  ))}
                </div>
              )}

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
                      <Volume2 className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                      <h3 className="text-lg font-bold mb-2">{selectedAsset.tool_name}</h3>
                      <p className="text-sm text-white/70">Background Music, Voiceover, AI Speech Generation</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Volume2 className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                      <p className="text-slate-400">Select an asset to add audio</p>
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
              <h2 className="text-xl font-bold mb-4 text-purple-400">AUDIO CONTROLS</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Audio Type</label>
                  <select
                    value={audioType}
                    onChange={(e) => setAudioType(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-purple-500/50 rounded-lg text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value="music">Background Music</option>
                    <option value="voiceover">Voiceover</option>
                    <option value="ai-speech">AI Speech</option>
                    <option value="sound-effects">Sound Effects</option>
                  </select>
                </div>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Music className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Add Music Track</span>
                </button>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Mic className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Voiceover Recording</span>
                </button>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Generate AI Voice</span>
                </button>

                <div className="pt-4 border-t border-purple-500/30">
                  <button
                    onClick={() => setAudioDucking(!audioDucking)}
                    className={`w-full flex items-center gap-3 border rounded-lg p-3 transition-all mb-2 ${audioDucking ? 'bg-purple-600 border-purple-400' : 'bg-purple-900/30 hover:bg-purple-900/50 border-purple-500/30'}`}
                  >
                    <VolumeX className="w-5 h-5 text-purple-400" />
                    <span className="font-semibold">Audio Ducking</span>
                  </button>

                  <button
                    onClick={() => setNoiseReduction(!noiseReduction)}
                    className={`w-full flex items-center gap-3 border rounded-lg p-3 transition-all ${noiseReduction ? 'bg-purple-600 border-purple-400' : 'bg-purple-900/30 hover:bg-purple-900/50 border-purple-500/30'}`}
                  >
                    <Radio className="w-5 h-5 text-purple-400" />
                    <span className="font-semibold">Noise Reduction</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="flex items-center gap-2 text-sm font-semibold mb-3">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    Equalizer
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Bass: {bass}</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={bass}
                        onChange={(e) => setBass(parseInt(e.target.value))}
                        className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Mid: {mid}</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={mid}
                        onChange={(e) => setMid(parseInt(e.target.value))}
                        className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Treble: {treble}</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={treble}
                        onChange={(e) => setTreble(parseInt(e.target.value))}
                        className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setCompressor(!compressor)}
                  className={`w-full flex items-center gap-3 border rounded-lg p-3 transition-all ${compressor ? 'bg-purple-600 border-purple-400' : 'bg-purple-900/30 hover:bg-purple-900/50 border-purple-500/30'}`}
                >
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Compressor</span>
                </button>

                <button
                  onClick={() => setNormalize(!normalize)}
                  className={`w-full flex items-center gap-3 border rounded-lg p-3 transition-all ${normalize ? 'bg-purple-600 border-purple-400' : 'bg-purple-900/30 hover:bg-purple-900/50 border-purple-500/30'}`}
                >
                  <Headphones className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Normalize Audio</span>
                </button>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Layers className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Multi-track Mixer</span>
                </button>

                <button className="w-full flex items-center gap-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-3 transition-all">
                  <Music className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Audio Sync Tools</span>
                </button>

                <div className="pt-4 border-t border-purple-500/30">
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Volume2 className="w-4 h-4 text-purple-400" />
                    Volume
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(parseInt(e.target.value))}
                    className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-right text-xs text-slate-400 mt-1">{volume}%</div>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Voice Type</label>
                  <select
                    className="w-full px-3 py-2 bg-black border border-purple-500/50 rounded-lg text-white focus:outline-none focus:border-purple-400"
                  >
                    <option>Male - Adult</option>
                    <option>Female - Adult</option>
                    <option>Child</option>
                    <option>Deep Voice</option>
                    <option>High Pitch</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Audio Effects</label>
                  <div className="space-y-2">
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all">
                      Fade In/Out
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all">
                      Echo
                    </button>
                    <button className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-sm transition-all">
                      Reverb
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-center mt-6">
            <button
              onClick={() => onNavigate(12)}
              className="flex items-center gap-2 bg-black text-white font-bold px-8 py-4 rounded-lg text-lg hover:bg-purple-900 transition-all border border-purple-500"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <button
              onClick={() => onNavigate(14)}
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
