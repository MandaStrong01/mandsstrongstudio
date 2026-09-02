import { useState, useRef } from 'react';
import { X, Upload, Sparkles, ImagePlus, Send, Loader2, Download, RefreshCw } from 'lucide-react';

interface AIToolModalProps {
  toolName: string;
  onClose: () => void;
  onOpenAssetPage: (mode: 'upload' | 'create') => void;
}

const GENERATION_MODES: Record<string, string> = {
  video: 'video',
  image: 'image',
  audio: 'audio',
  text: 'text',
};

function detectMode(toolName: string): keyof typeof GENERATION_MODES {
  const n = toolName.toLowerCase();
  if (n.includes('video') || n.includes('scene') || n.includes('film') || n.includes('motion') || n.includes('animator') || n.includes('reel') || n.includes('trailer') || n.includes('cut') || n.includes('editor') || n.includes('switcher') || n.includes('compiler') || n.includes('assembler') || n.includes('builder') || n.includes('creator') && (n.includes('visual') || n.includes('cam') || n.includes('footage'))) return 'video';
  if (n.includes('image') || n.includes('photo') || n.includes('art') || n.includes('storyboard') || n.includes('concept') || n.includes('design') || n.includes('poster') || n.includes('thumbnail') || n.includes('frame') || n.includes('look') || n.includes('grade') || n.includes('color') || n.includes('lut') || n.includes('grain') || n.includes('blur') || n.includes('glow') || n.includes('effect')) return 'image';
  if (n.includes('audio') || n.includes('sound') || n.includes('music') || n.includes('voice') || n.includes('speech') || n.includes('foley') || n.includes('mix') || n.includes('eq') || n.includes('reverb') || n.includes('score') || n.includes('composer')) return 'audio';
  return 'text';
}

function getPlaceholder(toolName: string): string {
  const n = toolName.toLowerCase();
  if (n.includes('real human') || n.includes('performance') || n.includes('actor') || n.includes('face')) return 'Describe the person, their appearance, emotion, setting, and what they are doing...';
  if (n.includes('video') || n.includes('scene')) return 'Describe the scene, mood, camera movement, lighting, and any subjects...';
  if (n.includes('music video')) return 'Describe the artist, genre, visual style, locations, and performance details...';
  if (n.includes('image') || n.includes('art') || n.includes('design')) return 'Describe the visual — style, colours, composition, subjects, atmosphere...';
  if (n.includes('script') || n.includes('story') || n.includes('dialogue')) return 'Describe the genre, tone, characters, and story beats you want...';
  if (n.includes('voice') || n.includes('speech') || n.includes('narrat')) return 'Enter the text to speak, or describe the voice style and content...';
  if (n.includes('sound') || n.includes('audio') || n.includes('music') || n.includes('score')) return 'Describe the mood, instruments, tempo, genre, and feeling you want...';
  return `Describe exactly what you want ${toolName} to generate...`;
}

function getMockResult(toolName: string, prompt: string, mode: string): string {
  const short = prompt.length > 60 ? prompt.slice(0, 60) + '...' : prompt;
  switch (mode) {
    case 'video': return `[VIDEO PREVIEW]\n\nGenerated video for: "${short}"\n\nTool: ${toolName}\n\nIn a full integration this would render a real AI-generated video clip based on your prompt. The system accepts text-only prompts — no image upload required. Reference images are optional enhancements.`;
    case 'image': return `[IMAGE PREVIEW]\n\nGenerated image for: "${short}"\n\nTool: ${toolName}\n\nIn a full integration this would render a real AI-generated image. Your text prompt drives the full generation — uploading a reference image is always optional.`;
    case 'audio': return `[AUDIO PREVIEW]\n\nGenerated audio for: "${short}"\n\nTool: ${toolName}\n\nIn a full integration this would produce a real AI-generated audio clip. No media upload is required — just your prompt.`;
    default: return generateTextResult(toolName, prompt);
  }
}

function generateTextResult(toolName: string, prompt: string): string {
  const n = toolName.toLowerCase();
  if (n.includes('script') || n.includes('story') || n.includes('dialogue')) {
    return `GENERATED OUTPUT — ${toolName.toUpperCase()}\n\n${prompt}\n\n---\nINT. LOCATION — DAY\n\nA scene unfolds based on your direction. Characters breathe life into the world you described. The dialogue flows naturally, driven by the emotional truth of the moment.\n\nCHARACTER A\nThis is exactly what you asked for — a full creative output built from your prompt alone.\n\nCHARACTER B\nNo uploads needed. Just your words, your vision.`;
  }
  return `GENERATED OUTPUT — ${toolName.toUpperCase()}\n\nPrompt: ${prompt}\n\nThis tool processed your request and produced a detailed result. In a live integration this would be powered by the AI engine specific to "${toolName}", delivering professional-grade output based solely on your text description. Reference media is always optional.`;
}

export default function AIToolModal({ toolName, onClose, onOpenAssetPage }: AIToolModalProps) {
  const [view, setView] = useState<'options' | 'generate'>('options');
  const [prompt, setPrompt] = useState('');
  const [refImage, setRefImage] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const mode = detectMode(toolName);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setRefImage(f);
    setRefPreview(URL.createObjectURL(f));
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setResult('');
    await new Promise(r => setTimeout(r, 1800 + Math.random() * 1200));
    setResult(getMockResult(toolName, prompt, mode));
    setGenerating(false);
  };

  const handleReset = () => {
    setPrompt('');
    setRefImage(null);
    setRefPreview('');
    setResult('');
  };

  if (view === 'options') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-amber-500/40 rounded-2xl max-w-2xl w-full">
          <div className="border-b border-amber-500/20 p-4 sm:p-6 flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-amber-400">{toolName}</h2>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors p-2">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-4 sm:p-8">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Generate with AI */}
              <button
                onClick={() => setView('generate')}
                className="bg-gradient-to-br from-amber-900/40 to-black/60 border-2 border-amber-500/50 hover:border-amber-400 rounded-xl p-6 transition-all group flex flex-col items-center gap-3"
              >
                <Sparkles className="w-12 h-12 text-amber-400 group-hover:scale-110 transition-transform" />
                <div>
                  <h4 className="text-lg font-bold text-white">Generate</h4>
                  <p className="text-xs text-white/50 mt-1">Text prompt — no upload needed</p>
                </div>
              </button>

              {/* Upload existing */}
              <button
                onClick={() => onOpenAssetPage('upload')}
                className="bg-gradient-to-br from-gray-900/60 to-black/60 border-2 border-white/20 hover:border-white/40 rounded-xl p-6 transition-all group flex flex-col items-center gap-3"
              >
                <Upload className="w-12 h-12 text-white/60 group-hover:text-white transition-colors group-hover:scale-110 transition-transform" />
                <div>
                  <h4 className="text-lg font-bold text-white">Upload</h4>
                  <p className="text-xs text-white/50 mt-1">Use existing media</p>
                </div>
              </button>

              {/* Create in studio */}
              <button
                onClick={() => onOpenAssetPage('create')}
                className="bg-gradient-to-br from-gray-900/60 to-black/60 border-2 border-white/20 hover:border-white/40 rounded-xl p-6 transition-all group flex flex-col items-center gap-3"
              >
                <ImagePlus className="w-12 h-12 text-white/60 group-hover:text-white transition-colors group-hover:scale-110 transition-transform" />
                <div>
                  <h4 className="text-lg font-bold text-white">Create</h4>
                  <p className="text-xs text-white/50 mt-1">Open asset studio</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Generate view
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-amber-500/40 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-amber-500/20 p-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-amber-400">{toolName}</h2>
            <p className="text-xs text-white/40 mt-0.5">AI Generation — image upload is optional</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setView('options'); handleReset(); }} className="text-white/40 hover:text-white/80 text-xs px-3 py-1.5 border border-white/20 rounded-lg transition-colors">Back</button>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors p-1.5">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4 sm:p-6 flex flex-col gap-4">
          {/* Prompt */}
          <div>
            <label className="block text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-2">
              Your Prompt <span className="text-amber-500">*</span>
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={getPlaceholder(toolName)}
              rows={4}
              className="w-full bg-black/60 border border-white/20 focus:border-amber-500/60 rounded-xl p-3 text-white text-sm placeholder-white/30 outline-none resize-none transition-colors"
            />
          </div>

          {/* Optional reference image */}
          <div>
            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
              Reference Image <span className="text-white/30 font-normal normal-case">(optional — not required)</span>
            </label>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleImagePick} />
            {refPreview ? (
              <div className="relative inline-block">
                <img src={refPreview} alt="reference" className="h-28 rounded-lg object-cover border border-white/20" />
                <button
                  onClick={() => { setRefImage(null); setRefPreview(''); }}
                  className="absolute -top-2 -right-2 bg-black border border-white/30 rounded-full p-0.5 text-white/70 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <p className="text-xs text-white/40 mt-1">{refImage?.name}</p>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-white/20 hover:border-white/40 rounded-xl text-white/40 hover:text-white/70 text-sm transition-colors"
              >
                <ImagePlus className="w-4 h-4" />
                Add reference image or video (optional)
              </button>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="bg-black/50 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider">Result</span>
                <button onClick={handleReset} className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors">
                  <RefreshCw className="w-3 h-3" /> Reset
                </button>
              </div>
              <pre className="text-sm text-white/80 whitespace-pre-wrap font-sans leading-relaxed">{result}</pre>
              <button className="mt-3 flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition-colors border border-amber-500/30 hover:border-amber-400/50 px-3 py-1.5 rounded-lg">
                <Download className="w-3.5 h-3.5" /> Save to Assets
              </button>
            </div>
          )}
        </div>

        {/* Footer / Generate button */}
        <div className="shrink-0 border-t border-white/10 p-4 flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
            className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-white/10 disabled:text-white/30 text-black font-bold py-3 rounded-xl transition-all text-sm"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Send className="w-4 h-4" /> Generate with AI</>
            )}
          </button>
          {result && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 border border-white/20 hover:border-white/40 text-white/60 hover:text-white px-4 py-3 rounded-xl transition-all text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Regenerate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
