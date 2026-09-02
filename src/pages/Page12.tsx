import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Film, Scissors, Crop, Music, FileText, Sparkles, Volume2, Maximize, Play, Pause, RotateCcw, Shield, Target, Key, Grid3x3 as Grid3X3, PictureInPicture2, RefreshCw, Upload, CheckCircle, AlertCircle, Mic, Image, Layers, Trash2, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { uploadFile } from '../lib/storage';
import Footer from '../components/Footer';
import QuickAccess from '../components/QuickAccess';
import GrokChat from '../components/GrokChat';

interface PageProps {
  onNavigate: (page: number) => void;
}

interface TrackClip {
  id: string;
  name: string;
  trackType: 'video' | 'voice' | 'music' | 'effects';
  created_at: string;
}

interface StagedFile {
  id: string;
  name: string;
  trackType: 'video' | 'voice' | 'music' | 'effects';
  created_at: string;
  source: 'asset' | 'ai_output';
}

const VOICE_KEYWORDS = ['voice','narration','speech','speak','narrator','dialogue','voiceover','voice-over','tts','james','narrate'];
const MUSIC_KEYWORDS = ['music','track','soundtrack','background','score','beat','song','instrumental','bgm'];

function detectTrackType(name: string, assetType?: string, fileType?: string): TrackClip['trackType'] {
  if (assetType === 'video') return 'video';
  if (assetType === 'image') return 'effects';
  const lower = (name + ' ' + (fileType || '')).toLowerCase();
  if (VOICE_KEYWORDS.some(k => lower.includes(k))) return 'voice';
  if (MUSIC_KEYWORDS.some(k => lower.includes(k))) return 'music';
  if (assetType === 'audio') return 'music';
  return 'video';
}

const TRACK_META: Record<TrackClip['trackType'], { label: string; icon: React.ReactNode; bg: string; border: string; text: string; dim: string }> = {
  video:   { label: 'VIDEO',   icon: <Film className="w-3.5 h-3.5" />,  bg: 'bg-blue-700/70',   border: 'border-blue-400',   text: 'text-blue-300',   dim: 'text-blue-400/60' },
  voice:   { label: 'VOICE',   icon: <Mic className="w-3.5 h-3.5" />,   bg: 'bg-emerald-700/70',border: 'border-emerald-400', text: 'text-emerald-300', dim: 'text-emerald-400/60' },
  music:   { label: 'MUSIC',   icon: <Music className="w-3.5 h-3.5" />, bg: 'bg-amber-700/70',  border: 'border-amber-400',  text: 'text-amber-300',  dim: 'text-amber-400/60' },
  effects: { label: 'EFFECTS', icon: <Image className="w-3.5 h-3.5" />, bg: 'bg-pink-700/70',   border: 'border-pink-400',   text: 'text-pink-300',   dim: 'text-pink-400/60' },
};

const TRACK_ORDER: TrackClip['trackType'][] = ['video', 'voice', 'music', 'effects'];

export default function Page12({ onNavigate }: PageProps) {
  const { user } = useAuth();

  // Staged files at the bottom (loaded from DB, waiting to be synced into tracks)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [loadingStaged, setLoadingStaged] = useState(false);

  // Timeline tracks
  const [tracks, setTracks] = useState<Record<TrackClip['trackType'], TrackClip[]>>({
    video: [], voice: [], music: [], effects: [],
  });

  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [_syncCount, setSyncCount] = useState(0);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Playback / settings
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(100);
  const [ratio, setRatio] = useState('16:9');
  const [size, setSize] = useState('1080p');
  const [speed, setSpeed] = useState(1);
  const [reverseVideo, setReverseVideo] = useState(false);
  const [stabilization, setStabilization] = useState(false);

  useEffect(() => {
    loadStagedFiles();
  }, [user]);

  // Load all user media from DB into the bottom staging area
  const loadStagedFiles = async () => {
    setLoadingStaged(true);
    const files: StagedFile[] = [];

    if (user) {
      const [{ data: assets }, { data: outputs }] = await Promise.all([
        supabase
          .from('assets')
          .select('id, file_name, file_type, asset_type, title, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('ai_tool_outputs')
          .select('id, tool_name, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
      ]);

      (assets || []).forEach(a => {
        files.push({
          id: `asset-${a.id}`,
          name: a.title || a.file_name,
          trackType: detectTrackType(a.file_name, a.asset_type, a.file_type),
          created_at: a.created_at,
          source: 'asset',
        });
      });

      (outputs || []).forEach(o => {
        files.push({
          id: `ai-${o.id}`,
          name: o.tool_name,
          trackType: detectTrackType(o.tool_name),
          created_at: o.created_at,
          source: 'ai_output',
        });
      });

      // Sort chronologically so order is visible in staging area
      files.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    setStagedFiles(files);
    setLoadingStaged(false);
  };

  // Merge all DB files into tracks — preserves clips already on tracks, only adds new ones
  const syncTimeline = async () => {
    setSyncing(true);
    setSyncDone(false);

    const files: StagedFile[] = [];
    if (user) {
      const [{ data: assets }, { data: outputs }] = await Promise.all([
        supabase
          .from('assets')
          .select('id, file_name, file_type, asset_type, title, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('ai_tool_outputs')
          .select('id, tool_name, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
      ]);

      (assets || []).forEach(a => {
        files.push({
          id: `asset-${a.id}`,
          name: a.title || a.file_name,
          trackType: detectTrackType(a.file_name, a.asset_type, a.file_type),
          created_at: a.created_at,
          source: 'asset',
        });
      });

      (outputs || []).forEach(o => {
        files.push({
          id: `ai-${o.id}`,
          name: o.tool_name,
          trackType: detectTrackType(o.tool_name),
          created_at: o.created_at,
          source: 'ai_output',
        });
      });

      files.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    setStagedFiles(files);

    // Merge into existing tracks — keep clips already on track, append new ones in order
    setTracks(prev => {
      const merged: Record<TrackClip['trackType'], TrackClip[]> = {
        video: [...prev.video],
        voice: [...prev.voice],
        music: [...prev.music],
        effects: [...prev.effects],
      };

      // Build a set of ids already on any track so we don't duplicate
      const alreadyOnTrack = new Set<string>(
        TRACK_ORDER.flatMap(k => merged[k].map(c => c.id))
      );

      let added = 0;
      files.forEach(f => {
        if (!alreadyOnTrack.has(f.id)) {
          merged[f.trackType].push({ id: f.id, name: f.name, trackType: f.trackType, created_at: f.created_at });
          alreadyOnTrack.add(f.id);
          added++;
        }
      });

      // Re-sort each track by created_at so order stays correct after merge
      TRACK_ORDER.forEach(k => {
        merged[k].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });

      setSyncCount(TRACK_ORDER.reduce((s, k) => s + merged[k].length, 0));
      return merged;
    });

    setSyncing(false);
    setSyncDone(true);
    setTimeout(() => setSyncDone(false), 4000);
  };

  const removeFromTrack = (trackType: TrackClip['trackType'], clipId: string) => {
    setTracks(prev => ({ ...prev, [trackType]: prev[trackType].filter(c => c.id !== clipId) }));
  };

  const clearTrack = (trackType: TrackClip['trackType']) => {
    setTracks(prev => ({ ...prev, [trackType]: [] }));
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
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (user) {
        const result = await uploadFile(file, user.id, (p) => {
          setUploadProgress(Math.round(((i / fileList.length) + (p / 100) / fileList.length) * 100));
        });
        if (!result.success) {
          setUploadStatus('error');
          setUploadError(result.error || 'Upload failed');
          setUploading(false);
          setTimeout(() => setUploadStatus('idle'), 3000);
          return;
        }
      }
    }

    setUploading(false);
    setUploadStatus('success');
    await loadStagedFiles();
    setTimeout(() => setUploadStatus('idle'), 2000);
  };

  const formatTime = (m: number) => `${Math.floor(m)}:${String(Math.floor((m - Math.floor(m)) * 60)).padStart(2, '0')}`;
  const totalInTracks = Object.values(tracks).reduce((s, t) => s + t.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-black to-purple-900/20 text-white flex flex-col">
      <div className="flex-1 flex flex-col px-4 py-6 pb-2">
        <div className="max-w-full w-full mx-auto flex-1 flex flex-col gap-3">
          <h1 className="text-3xl font-black text-purple-400 text-center">DOXY THE SCHOOL BULLY — Timeline Editor</h1>

          {/* ── TOP ROW: Media Box | Timeline Tracks | Editing Tools ── */}
          <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">

            {/* LEFT: Media Box */}
            <div className="col-span-3 bg-black/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-4 flex flex-col overflow-hidden">
              <h2 className="text-lg font-bold mb-3 text-purple-400">MEDIA BOX</h2>

              {/* Upload */}
              <input ref={fileInputRef} type="file" multiple accept="video/*,audio/*,image/*" onChange={handleUpload} style={{ display: 'none' }} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 disabled:opacity-60 border rounded-lg p-2.5 mb-2 font-bold text-xs relative overflow-hidden transition-all"
                style={{
                  background: uploadStatus === 'error' ? '#7f1d1d' : uploadStatus === 'success' ? '#14532d' : '#7c3aed',
                  borderColor: uploadStatus === 'error' ? '#ef4444' : uploadStatus === 'success' ? '#22c55e' : '#a78bfa',
                }}
              >
                {uploadStatus === 'uploading' && <div className="absolute inset-0 bg-purple-400/30" style={{ width: `${uploadProgress}%` }} />}
                <span className="relative flex items-center gap-1.5">
                  {uploadStatus === 'uploading' ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> :
                   uploadStatus === 'success' ? <CheckCircle className="w-3 h-3 text-green-400" /> :
                   uploadStatus === 'error' ? <AlertCircle className="w-3 h-3 text-red-400" /> :
                   <Upload className="w-3 h-3" />}
                  {uploadStatus === 'uploading' ? `UPLOADING ${uploadProgress}%` :
                   uploadStatus === 'success' ? 'SAVED TO LIBRARY!' :
                   uploadStatus === 'error' ? 'UPLOAD FAILED' : 'UPLOAD MEDIA'}
                </span>
              </button>
              {uploadStatus === 'error' && <p className="text-red-400 text-xs mb-1 px-1">{uploadError}</p>}

              {/* File list */}
              <div className="flex-1 overflow-y-auto space-y-1">
                {loadingStaged ? (
                  <div className="text-center py-6">
                    <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Loading...</p>
                  </div>
                ) : stagedFiles.length === 0 ? (
                  <div className="text-center py-6">
                    <Layers className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-xs text-slate-400">No media yet</p>
                    <p className="text-xs text-slate-500 mt-1">Upload above or generate on Page 8</p>
                  </div>
                ) : stagedFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-1.5 rounded px-2 py-1 border border-purple-500/20 bg-purple-900/10">
                    <span className={TRACK_META[f.trackType].text + ' shrink-0'}>{TRACK_META[f.trackType].icon}</span>
                    <span className="text-xs text-slate-300 truncate flex-1">{f.name}</span>
                    <span className={`text-xs font-black shrink-0 ${TRACK_META[f.trackType].text}`}>{f.trackType.slice(0,3).toUpperCase()}</span>
                  </div>
                ))}
              </div>

              <div className="mt-2 pt-2 border-t border-purple-500/20 text-xs text-slate-500 text-center">
                {stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''} ready
              </div>
            </div>

            {/* CENTRE: Timeline Tracks */}
            <div className="col-span-6 bg-black/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-4 flex flex-col gap-3">
              {/* Playback bar */}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setIsPlaying(!isPlaying)} className="p-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg transition-all shrink-0">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <span className="text-xs text-slate-400 w-10 shrink-0">{formatTime(currentTime)}</span>
                <input
                  type="range" min="0" max={duration} step="0.1" value={currentTime}
                  onChange={e => setCurrentTime(parseFloat(e.target.value))}
                  className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right,#9333ea ${(currentTime/duration)*100}%,rgba(147,51,234,.2) ${(currentTime/duration)*100}%)` }}
                />
                <span className="text-xs text-slate-500 shrink-0">{duration}m</span>
              </div>

              {/* 4 Tracks */}
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
                {TRACK_ORDER.map(key => {
                  const meta = TRACK_META[key];
                  const clips = tracks[key];
                  return (
                    <div key={key} className="flex items-start gap-2">
                      {/* Label */}
                      <div className={`shrink-0 w-16 flex flex-col items-center gap-0.5 pt-2`}>
                        <span className={`${meta.text} flex items-center gap-1 text-xs font-black`}>{meta.icon}{meta.label}</span>
                        {clips.length > 0 && (
                          <button onClick={() => clearTrack(key)} className="text-slate-600 hover:text-red-400 transition-colors" title="Clear track">
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                      {/* Clip lane */}
                      <div className={`flex-1 min-h-[40px] rounded-lg border ${clips.length > 0 ? meta.border + '/40' : 'border-purple-500/15'} bg-black/40 p-1.5 flex flex-wrap gap-1.5 overflow-x-auto transition-colors`}>
                        {clips.length === 0 ? (
                          <span className={`text-xs italic self-center px-1 ${meta.dim}`}>empty — sync to populate</span>
                        ) : clips.map((clip, idx) => (
                          <div
                            key={clip.id}
                            className={`group flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold text-white max-w-[150px] ${meta.bg} ${meta.border}`}
                          >
                            <span className="text-slate-400 shrink-0 text-xs">{idx + 1}</span>
                            <span className="truncate">{clip.name}</span>
                            <button
                              onClick={() => removeFromTrack(key, clip.id)}
                              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                              title="Remove"
                            >
                              <Trash2 className="w-2 h-2 text-white/60 hover:text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stats + Duration + Render */}
              {totalInTracks > 0 && (
                <div className="shrink-0 flex flex-wrap gap-x-3 gap-y-0.5 text-xs border-t border-purple-500/20 pt-2">
                  {TRACK_ORDER.map(k => (
                    <span key={k} className={TRACK_META[k].text}>{TRACK_META[k].label}: {tracks[k].length}</span>
                  ))}
                  <span className="text-slate-500 ml-auto">{totalInTracks} clips total</span>
                </div>
              )}

              <div className="shrink-0 flex items-center gap-2 pt-1">
                <span className="text-xs text-slate-400 shrink-0">Duration:</span>
                {[60, 90, 120, 180].map(d => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`px-2.5 py-1 text-xs rounded border transition-all ${duration === d ? 'bg-purple-600 border-purple-400 text-white' : 'bg-purple-900/20 border-purple-500/30 text-slate-300 hover:bg-purple-900/40'}`}
                  >{d}m</button>
                ))}
                <button
                  onClick={() => onNavigate(16)}
                  className="ml-auto flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2 rounded-lg border border-purple-400 transition-all"
                >
                  <Film className="w-3.5 h-3.5" /> RENDER
                </button>
              </div>
            </div>

            {/* RIGHT: Editing Tools */}
            <div className="col-span-3 bg-black/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-4 overflow-y-auto">
              <h2 className="text-lg font-bold mb-3 text-purple-400">EDITING TOOLS</h2>
              <div className="space-y-2">
                {[
                  [<Scissors className="w-4 h-4 text-purple-400" />, 'Trim'],
                  [<Crop className="w-4 h-4 text-purple-400" />, 'Crop'],
                  [<Film className="w-4 h-4 text-purple-400" />, 'Combine'],
                  [<Music className="w-4 h-4 text-purple-400" />, 'Add Music'],
                  [<FileText className="w-4 h-4 text-purple-400" />, 'Subtitles'],
                  [<Sparkles className="w-4 h-4 text-purple-400" />, 'Chroma Key'],
                  [<Target className="w-4 h-4 text-purple-400" />, 'Motion Tracking'],
                  [<Key className="w-4 h-4 text-purple-400" />, 'Keyframe Animation'],
                  [<Grid3X3 className="w-4 h-4 text-purple-400" />, 'Split Screen'],
                  [<PictureInPicture2 className="w-4 h-4 text-purple-400" />, 'Picture-in-Picture'],
                ].map(([icon, label]) => (
                  <button key={label as string} className="w-full flex items-center gap-2 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg p-2 transition-all text-sm font-semibold">
                    {icon as React.ReactNode}<span>{label as string}</span>
                  </button>
                ))}

                <div className="pt-2 border-t border-purple-500/30">
                  <label className="text-xs font-semibold mb-1 block text-slate-300">Speed</label>
                  <div className="grid grid-cols-5 gap-1">
                    {[0.25, 0.5, 1, 2, 4].map(s => (
                      <button key={s} onClick={() => setSpeed(s)} className={`py-1 text-xs rounded border border-purple-500/30 transition-all ${speed === s ? 'bg-purple-600' : 'bg-purple-900/30 hover:bg-purple-900/50'}`}>{s}x</button>
                    ))}
                  </div>
                </div>

                <button onClick={() => setReverseVideo(!reverseVideo)} className={`w-full flex items-center gap-2 border rounded-lg p-2 text-sm font-semibold transition-all ${reverseVideo ? 'bg-purple-600 border-purple-400' : 'bg-purple-900/30 border-purple-500/30'}`}>
                  <RotateCcw className="w-4 h-4 text-purple-400" /> Reverse Video
                </button>
                <button onClick={() => setStabilization(!stabilization)} className={`w-full flex items-center gap-2 border rounded-lg p-2 text-sm font-semibold transition-all ${stabilization ? 'bg-purple-600 border-purple-400' : 'bg-purple-900/30 border-purple-500/30'}`}>
                  <Shield className="w-4 h-4 text-purple-400" /> Stabilization
                </button>

                <div className="pt-2 border-t border-purple-500/30">
                  <label className="flex items-center gap-1 text-xs font-semibold mb-1 text-slate-300"><Volume2 className="w-3 h-3 text-purple-400" />Volume</label>
                  <input type="range" min="0" max="100" value={volume} onChange={e => setVolume(+e.target.value)} className="w-full h-1.5 rounded-full appearance-none cursor-pointer" />
                  <div className="text-right text-xs text-slate-400">{volume}%</div>
                </div>

                <div>
                  <label className="flex items-center gap-1 text-xs font-semibold mb-1 text-slate-300"><Maximize className="w-3 h-3 text-purple-400" />Ratio</label>
                  <select value={ratio} onChange={e => setRatio(e.target.value)} className="w-full px-2 py-1 bg-black border border-purple-500/50 rounded text-white text-xs focus:outline-none">
                    {['16:9','4:3','21:9','1:1'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block text-slate-300">Resolution</label>
                  <select value={size} onChange={e => setSize(e.target.value)} className="w-full px-2 py-1 bg-black border border-purple-500/50 rounded text-white text-xs focus:outline-none">
                    {['720p','1080p','1440p','4K'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ── BOTTOM STAGING STRIP + SYNC BUTTON ── */}
          <div className="shrink-0 bg-black/50 border border-purple-500/40 rounded-2xl overflow-hidden">
            {/* Header row */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-purple-500/20 bg-purple-900/10">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-purple-300">
                  STAGING AREA — {stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''} loaded
                  {loadingStaged && <span className="ml-2 text-xs text-slate-400 animate-pulse">refreshing...</span>}
                </span>
              </div>

              {/* SYNC TIMELINE BUTTON */}
              <button
                onClick={syncTimeline}
                disabled={syncing || stagedFiles.length === 0}
                className="flex items-center gap-2 font-black text-sm px-5 py-2 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: syncDone ? 'linear-gradient(135deg,#14532d,#166534)' : 'linear-gradient(135deg,#5b21b6,#7c3aed)',
                  borderColor: syncDone ? '#22c55e' : '#a78bfa',
                  color: syncDone ? '#86efac' : '#fff',
                  boxShadow: syncDone ? '0 0 20px rgba(34,197,94,.3)' : '0 0 20px rgba(139,92,246,.3)',
                }}
              >
                {syncing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : syncDone ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {syncing ? 'SYNCING...' : syncDone ? `${totalInTracks} CLIPS ON TIMELINE!` : 'SYNC TIMELINE'}
              </button>
            </div>

            {/* Staged file chips */}
            <div className="px-4 py-2 flex flex-wrap gap-2 min-h-[52px] max-h-[96px] overflow-y-auto">
              {stagedFiles.length === 0 && !loadingStaged && (
                <span className="text-xs text-slate-500 italic self-center">No files yet — upload media or generate scenes on Page 8, then press SYNC TIMELINE</span>
              )}
              {stagedFiles.map((f, idx) => {
                const meta = TRACK_META[f.trackType];
                return (
                  <div key={f.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold text-white ${meta.bg} ${meta.border} opacity-90`}>
                    <span className="text-white/50 text-xs">{idx + 1}</span>
                    {meta.icon}
                    <span className="max-w-[100px] truncate">{f.name}</span>
                    <ChevronRight className="w-2.5 h-2.5 text-white/40" />
                    <span className="text-white/70 font-black">{meta.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      <div className="flex gap-4 justify-center py-4">
        <button onClick={() => onNavigate(11)} className="flex items-center gap-2 bg-black text-white font-bold px-8 py-4 rounded-lg text-lg hover:bg-purple-900 transition-all border border-purple-500">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <button onClick={() => onNavigate(13)} className="flex items-center gap-2 bg-purple-600 text-white font-bold px-8 py-4 rounded-lg text-lg hover:bg-purple-500 transition-all">
          Next <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      <QuickAccess onNavigate={onNavigate} />
      <GrokChat onNavigate={onNavigate} />
      <Footer />
    </div>
  );
}
