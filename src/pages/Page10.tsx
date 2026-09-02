import { ArrowLeft, ArrowRight, Play, Pause, SkipBack, SkipForward, Upload } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { uploadFile, getAssets } from '../lib/storage';
import Footer from '../components/Footer';
import QuickAccess from '../components/QuickAccess';
import GrokChat from '../components/GrokChat';

interface PageProps {
  onNavigate: (page: number) => void;
}

interface Asset {
  id: string;
  file_name: string;
  file_url: string;
  asset_type: string;
}

export default function Page10({ onNavigate }: PageProps) {
  const { user } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Asset | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (user) {
      loadAssets();
    }
  }, [user]);

  const loadAssets = async () => {
    if (!user) return;

    try {
      const allAssets = await getAssets(user.id);
      const videoAssets = allAssets.filter(a => a.asset_type === 'video');
      setAssets(videoAssets);
      if (videoAssets.length > 0 && !selectedVideo) {
        setSelectedVideo(videoAssets[0]);
      }
    } catch (error) {
      console.error('Error loading assets:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(file => uploadFile(file, user.id));
      const results = await Promise.all(uploadPromises);

      const successCount = results.filter(r => r.success).length;
      if (successCount > 0) {
        await loadAssets();
      }

      if (results.some(r => !r.success)) {
        alert(`${successCount} of ${files.length} files uploaded successfully`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload files');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const skipBackward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime -= 10;
    }
  };

  const skipForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime += 10;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-black to-purple-900/20 text-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-6xl w-full">
          <h1 className="text-2xl md:text-4xl font-black text-purple-400 mb-2 text-center">Timeline Editor</h1>
          <p className="text-xl font-semibold text-purple-300 mb-6 text-center">Editor's Choice</p>

          <div className="mb-6 text-center">
            <button
              onClick={() => document.getElementById('video-upload')?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition-all"
            >
              <Upload className="w-5 h-5" />
              {uploading ? 'Uploading...' : 'Admin Upload'}
            </button>
            <input
              id="video-upload"
              type="file"
              multiple
              accept="video/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {assets.length > 1 && (
            <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => {
                    setSelectedVideo(asset);
                    setIsPlaying(false);
                  }}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all ${
                    selectedVideo?.id === asset.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-900/30 text-purple-300 hover:bg-purple-900/50'
                  }`}
                >
                  {asset.file_name}
                </button>
              ))}
            </div>
          )}

          <div className="bg-black/30 backdrop-blur-sm p-6 rounded-2xl border border-purple-500/30 mb-6">
            <div className="aspect-video bg-black rounded-lg overflow-hidden border border-purple-500/30 mb-4 flex items-center justify-center">
              {selectedVideo ? (
                <video
                  key={selectedVideo.id}
                  ref={videoRef}
                  className="w-full h-full"
                  src={selectedVideo.file_url}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              ) : (
                <div className="text-center p-8">
                  <Upload className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                  <p className="text-slate-400">No videos uploaded yet</p>
                  <p className="text-sm text-slate-500 mt-2">Click "Upload Video" to get started</p>
                </div>
              )}
            </div>

            {selectedVideo && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={skipBackward}
                  className="p-3 bg-purple-900/50 hover:bg-purple-900/70 rounded-lg transition-all border border-purple-500/30"
                >
                  <SkipBack className="w-6 h-6" />
                </button>

                <button
                  onClick={togglePlay}
                  className="p-4 bg-purple-600 hover:bg-purple-500 rounded-lg transition-all"
                >
                  {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
                </button>

                <button
                  onClick={skipForward}
                  className="p-3 bg-purple-900/50 hover:bg-purple-900/70 rounded-lg transition-all border border-purple-500/30"
                >
                  <SkipForward className="w-6 h-6" />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => onNavigate(9)}
              className="flex items-center justify-center gap-2 bg-black text-white font-bold px-6 sm:px-8 py-4 rounded-lg text-base sm:text-lg hover:bg-purple-900 transition-all border border-purple-500"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <button
              onClick={() => onNavigate(11)}
              className="flex items-center justify-center gap-2 bg-purple-600 text-white font-bold px-6 sm:px-8 py-4 rounded-lg text-base sm:text-lg hover:bg-purple-500 transition-all"
            >
              Next
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      <QuickAccess onNavigate={onNavigate} />
      <GrokChat onNavigate={onNavigate} />
      <Footer showDoxyCredit={true} />
    </div>
  );
}
