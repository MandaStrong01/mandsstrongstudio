import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, File as FileIcon, Sparkles, Volume2, Maximize, Play, Pause, X, Upload, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { uploadFile } from '../lib/storage';
import { initializeGoogleDrive, openGooglePicker, downloadGoogleDriveFile } from '../lib/googleDrive';
import Footer from '../components/Footer';
import QuickAccess from '../components/QuickAccess';
import GrokChat from '../components/GrokChat';
import { Asset, isMediaAsset } from '../types/ai-tools';

interface PageProps {
  onNavigate: (page: number) => void;
}

export default function Page11({ onNavigate }: PageProps) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [googleDriveReady, setGoogleDriveReady] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(100);
  const [ratio, setRatio] = useState('16:9');
  const [size, setSize] = useState('1080p');
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState<any>(null);
  const [showAIDurationModal, setShowAIDurationModal] = useState(false);
  const [aiCalculating, setAiCalculating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    if (user) {
      loadAssets();
    }
  }, [user]);

  useEffect(() => {
    initializeGoogleDrive().then((ready) => {
      setGoogleDriveReady(ready);
    }).catch(() => {
      setGoogleDriveReady(false);
    });
  }, []);

  const loadAssets = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [aiAssetsResult, mediaAssetsResult] = await Promise.all([
        supabase
          .from('ai_tool_outputs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('assets')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ]);

      const aiAssets = aiAssetsResult.data || [];
      const mediaAssets = mediaAssetsResult.data || [];

      const allAssets = [...mediaAssets, ...aiAssets].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setAssets(allAssets);
      if (allAssets.length > 0) {
        setSelectedAsset(allAssets[0]);
      }
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    setUploadProgress({});

    try {
      const uploadPromises = Array.from(files).map(file =>
        uploadFile(file, user.id, (progress) => {
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
        })
      );
      const results = await Promise.all(uploadPromises);

      const successCount = results.filter(r => r.success).length;
      if (successCount > 0) {
        await loadAssets();
      }

      if (results.some(r => !r.success)) {
        alert(`${successCount} of ${files.length} files uploaded successfully`);
      }
    } catch (error) {
      alert('Failed to upload files');
    } finally {
      setUploading(false);
      setUploadProgress({});
      e.target.value = '';
    }
  };

  const handleGoogleDriveUpload = async () => {
    if (!googleDriveReady) {
      alert('Google Drive is loading. Please wait a moment and try again.');
      return;
    }

    if (!user) {
      alert('Please sign in to upload files.');
      return;
    }

    openGooglePicker(async (files) => {
      setUploading(true);
      setUploadProgress({});

      try {
        let successCount = 0;
        let failCount = 0;

        for (const file of files) {
          try {
            const blob = await downloadGoogleDriveFile(file.id, file.name, file.mimeType);
            const newFile = new File([blob], file.name, { type: file.mimeType });
            const result = await uploadFile(newFile, user.id, (progress) => {
              setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
            });

            if (result.success) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (error) {
            console.error('Error uploading file:', file.name, error);
            failCount++;
          }
        }

        if (successCount > 0) {
          await loadAssets();
        }

        if (failCount > 0) {
          alert(`Uploaded ${successCount} of ${files.length} files successfully`);
        }
      } catch (error) {
        console.error('Google Drive upload error:', error);
        alert('Failed to upload files from Google Drive');
      } finally {
        setUploading(false);
        setUploadProgress({});
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0 || !user) return;

    setUploading(true);
    setUploadProgress({});

    try {
      const uploadPromises = Array.from(files).map(file =>
        uploadFile(file, user.id, (progress) => {
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
        })
      );
      const results = await Promise.all(uploadPromises);

      const successCount = results.filter(r => r.success).length;
      if (successCount > 0) {
        await loadAssets();
      }

      if (results.some(r => !r.success)) {
        alert(`${successCount} of ${files.length} files uploaded successfully`);
      }
    } catch (error) {
      alert('Failed to upload files');
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  };

  const formatTime = (minutes: number) => {
    const mins = Math.floor(minutes);
    const secs = Math.floor((minutes - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDurationChange = (newDuration: number) => {
    setDuration(newDuration);
    setShowScriptModal(true);
  };

  const handleScriptResponse = (_confirmed?: boolean) => {
    setShowScriptModal(false);
  };

  const handleDeleteAsset = async (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this asset?')) {
      return;
    }

    try {
      if (isMediaAsset(asset)) {
        const { error } = await supabase
          .from('assets')
          .delete()
          .eq('id', asset.id);

        if (error) throw error;

        const fileName = asset.file_url.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('media-assets')
            .remove([`${user?.id}/${fileName}`]);
        }
      } else {
        const { error } = await supabase
          .from('ai_tool_outputs')
          .delete()
          .eq('id', asset.id);

        if (error) throw error;
      }

      if (selectedAsset?.id === asset.id) {
        setSelectedAsset(null);
      }

      await loadAssets();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete asset. Please try again.');
    }
  };

  const handleAIDuration = async () => {
    setShowAIDurationModal(true);
  };

  const calculateAIDuration = async () => {
    setAiCalculating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const assetCount = assets.length;
      const avgDurationPerAsset = 5;
      const suggestedDuration = Math.min(assetCount * avgDurationPerAsset, 120);

      setDuration(suggestedDuration);
      setShowAIDurationModal(false);
    } catch (error) {
      console.error('AI calculation error:', error);
      alert('Failed to calculate duration. Please try again.');
    } finally {
      setAiCalculating(false);
    }
  };

  const handleGenerate = async () => {
    if (!user) {
      alert('Please sign in to generate content.');
      return;
    }

    if (!selectedAsset) {
      alert('Please select an asset to generate from.');
      return;
    }

    setGenerating(true);
    try {
      const generationConfig = {
        asset: selectedAsset,
        settings: {
          duration,
          ratio,
          size,
          volume,
          timestamp: new Date().toISOString()
        },
        projectName: isMediaAsset(selectedAsset)
          ? `Generated from ${selectedAsset.file_name}`
          : `Generated from ${selectedAsset.tool_name}`
      };

      await new Promise(resolve => setTimeout(resolve, 2000));

      const { data, error } = await supabase
        .from('ai_tool_outputs')
        .insert({
          user_id: user.id,
          tool_name: 'Editor Generate',
          output_data: generationConfig
        })
        .select()
        .single();

      if (error) throw error;

      setGeneratedOutput(data);
      setShowSuccessModal(true);
      await loadAssets();
    } catch (error) {
      console.error('Generation error:', error);
      alert('Failed to generate content. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-black to-purple-900/20 text-white flex flex-col">
      <div className="flex-1 flex flex-col px-4 py-6">
        <div className="max-w-full w-full mx-auto flex-1 flex flex-col">
          <h1 className="text-2xl md:text-3xl font-black text-purple-400 mb-4 text-center">Editor Dashboard</h1>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
            <div
              className={`relative lg:col-span-3 bg-black/30 backdrop-blur-sm rounded-2xl border p-4 transition-all ${
                isDragging
                  ? 'border-purple-400 border-4 bg-purple-900/40'
                  : 'border-purple-500/30'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="mb-4">
                <h2 className="text-xl font-bold text-purple-400 mb-2">MEDIA BOX</h2>
                <div className="bg-purple-900/30 border border-purple-400/40 rounded-lg p-3 mb-2">
                  <p className="text-sm text-purple-200 font-semibold mb-1">Select Asset / Drag & Drop</p>
                  <p className="text-xs text-white/80 leading-relaxed">
                    Click any asset below to preview it, or drag files directly into this box to upload.
                  </p>
                </div>
                <div className="bg-gradient-to-r from-purple-900/40 to-purple-800/40 border border-purple-300/50 rounded-lg p-3">
                  <p className="text-sm text-purple-100 font-bold text-center animate-pulse">
                    Have I Missed A Thing?
                  </p>
                  <p className="text-xs text-white/70 text-center mt-1">
                    Double-check you've added all your needed assets before moving to the next step!
                  </p>
                </div>
              </div>

              {isDragging && (
                <div className="absolute inset-4 bg-purple-900/60 backdrop-blur-sm border-4 border-dashed border-purple-400 rounded-2xl flex items-center justify-center z-10 pointer-events-none">
                  <div className="text-center">
                    <Upload className="w-16 h-16 mx-auto mb-3 text-purple-400 animate-bounce" />
                    <p className="text-xl font-bold text-purple-400">Drop files here</p>
                    <p className="text-sm text-purple-300 mt-2">Images auto-compress for faster uploads</p>
                  </div>
                </div>
              )}

              {uploading && (
                <div className="absolute inset-0 bg-gradient-to-br from-black/95 via-purple-900/90 to-black/95 backdrop-blur-md rounded-2xl flex items-center justify-center z-20 p-8">
                  <div className="w-full max-w-lg">
                    <div className="text-center mb-6">
                      <Loader2 className="w-16 h-16 mx-auto mb-3 text-purple-400 animate-spin" />
                      <p className="text-2xl font-bold text-white mb-1">Fast Upload in Progress</p>
                      <p className="text-sm text-purple-300">Optimizing and uploading your files</p>
                    </div>
                    {Object.keys(uploadProgress).length > 0 ? (
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                        {Object.entries(uploadProgress).map(([fileName, progress]) => (
                          <div key={fileName} className="bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm text-white/95 font-medium truncate flex-1 mr-3">{fileName}</p>
                              <p className="text-sm font-bold text-purple-400 min-w-[45px] text-right">{Math.round(progress)}%</p>
                            </div>
                            <div className="w-full bg-purple-950/50 rounded-full h-2.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-purple-600 via-purple-500 to-purple-400 h-2.5 rounded-full transition-all duration-200 ease-out shadow-lg shadow-purple-500/50"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-purple-300 animate-pulse">Preparing files...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3 mb-4">
                <button
                  onClick={() => {
                    document.getElementById('files-upload')?.click();
                  }}
                  disabled={uploading}
                  className="w-full bg-gradient-to-br from-purple-900/30 to-black/50 backdrop-blur-xl border-2 border-purple-500/60 hover:border-purple-400 hover:from-purple-900/40 hover:to-black/60 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-4 rounded-xl transition-all text-white font-semibold"
                >
                  <div className="flex items-center justify-center gap-2">
                    {uploading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                    {uploading ? 'Uploading...' : 'Open Files'}
                  </div>
                </button>

                <button
                  onClick={() => {
                    document.getElementById('photos-upload')?.click();
                  }}
                  disabled={uploading}
                  className="w-full bg-gradient-to-br from-purple-900/30 to-black/50 backdrop-blur-xl border-2 border-purple-500/60 hover:border-purple-400 hover:from-purple-900/40 hover:to-black/60 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-4 rounded-xl transition-all text-white font-semibold"
                >
                  <div className="flex items-center justify-center gap-2">
                    {uploading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                    {uploading ? 'Uploading...' : 'Open Photos/Videos'}
                  </div>
                </button>

                <button
                  onClick={handleGoogleDriveUpload}
                  disabled={uploading || !googleDriveReady}
                  className="w-full bg-gradient-to-br from-purple-900/30 to-black/50 backdrop-blur-xl border-2 border-purple-500/60 hover:border-purple-400 hover:from-purple-900/40 hover:to-black/60 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-4 rounded-xl transition-all text-white font-semibold"
                >
                  <div className="flex items-center justify-center gap-2">
                    {uploading || !googleDriveReady ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                    {uploading ? 'Uploading...' : !googleDriveReady ? 'Loading Drive...' : 'Open Google Drive'}
                  </div>
                </button>
              </div>

              <input
                id="files-upload"
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
              <input
                id="photos-upload"
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileUpload}
              />

              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 mb-4">
                <p className="text-xs text-purple-200 leading-relaxed">
                  <span className="font-semibold block mb-1">Permissions Needed:</span>
                  Upload images, videos, and audio files from your device or connect your Google Drive to access your cloud files directly.
                </p>
              </div>

              <div className="space-y-2 overflow-y-auto max-h-[40vh] lg:max-h-[70vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-sm text-slate-400">Loading...</p>
                  </div>
                ) : assets.length === 0 ? (
                  <div className="text-center py-8">
                    <FileIcon className="w-12 h-12 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm text-slate-400">No assets yet</p>
                  </div>
                ) : (
                  assets.map((asset) => {
                    const isMedia = isMediaAsset(asset);
                    return (
                      <div key={asset.id} className="relative group">
                        <button
                          onClick={() => setSelectedAsset(asset)}
                          className={`w-full bg-purple-900/20 border rounded-lg p-3 text-left transition-all hover:bg-purple-900/40 ${
                            selectedAsset?.id === asset.id ? 'border-purple-400 bg-purple-900/40' : 'border-purple-500/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {isMedia ? (
                              <FileIcon className="w-4 h-4 text-purple-400" />
                            ) : (
                              <Sparkles className="w-4 h-4 text-purple-400" />
                            )}
                            <h3 className="font-semibold text-sm truncate pr-6">
                              {isMedia ? asset.file_name : asset.tool_name}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-400">
                            {new Date(asset.created_at).toLocaleDateString()}
                          </p>
                        </button>
                        <button
                          onClick={(e) => handleDeleteAsset(asset, e)}
                          className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete asset"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="lg:col-span-6 bg-black/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-4 flex flex-col">
              <h2 className="text-xl font-bold mb-4 text-purple-400">VIEWER</h2>
              <div className="flex-1 flex flex-col">
                <div className="aspect-video bg-black rounded-lg border border-purple-500/30 mb-4 flex items-center justify-center overflow-hidden">
                  {selectedAsset ? (
                    isMediaAsset(selectedAsset) ? (
                      selectedAsset.asset_type === 'image' ? (
                        <img
                          src={selectedAsset.file_url}
                          alt={selectedAsset.file_name}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : selectedAsset.asset_type === 'video' ? (
                        <video
                          src={selectedAsset.file_url}
                          controls
                          className="max-w-full max-h-full"
                        />
                      ) : selectedAsset.asset_type === 'audio' ? (
                        <div className="text-center p-8">
                          <Volume2 className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                          <h3 className="text-lg font-bold mb-4">{selectedAsset.file_name}</h3>
                          <audio src={selectedAsset.file_url} controls className="w-full" />
                        </div>
                      ) : (
                        <div className="text-center p-8">
                          <FileIcon className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                          <h3 className="text-lg font-bold mb-2">{selectedAsset.file_name}</h3>
                          <p className="text-sm text-slate-400">{selectedAsset.file_type}</p>
                        </div>
                      )
                    ) : (
                      <div className="text-center p-8">
                        <Sparkles className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                        <h3 className="text-lg font-bold mb-2">{selectedAsset.tool_name}</h3>
                        <pre className="text-sm text-slate-300 font-sans max-h-48 overflow-y-auto text-left">
                          {JSON.stringify(selectedAsset.output_data, null, 2)}
                        </pre>
                      </div>
                    )
                  ) : (
                    <div className="text-center">
                      <FileIcon className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                      <p className="text-slate-400">Select an asset to preview</p>
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
                      <span>120:00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 bg-black/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-4">
              <h2 className="text-xl font-bold mb-4 text-purple-400">CONTROLS</h2>
              <div className="space-y-6">
                <div>
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
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Maximize className="w-4 h-4 text-purple-400" />
                    Ratio
                  </label>
                  <select
                    value={ratio}
                    onChange={(e) => setRatio(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-purple-500/50 rounded-lg text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value="16:9">16:9</option>
                    <option value="4:3">4:3</option>
                    <option value="21:9">21:9</option>
                    <option value="1:1">1:1</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Size</label>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-purple-500/50 rounded-lg text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                    <option value="1440p">1440p</option>
                    <option value="4K">4K</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold">Duration</label>
                    <button
                      onClick={handleAIDuration}
                      className="flex items-center gap-1 text-xs bg-purple-600 hover:bg-purple-500 px-2 py-1 rounded transition-all"
                    >
                      <Sparkles className="w-3 h-3" />
                      AI Help
                    </button>
                  </div>
                  <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400">{formatTime(currentTime)}</div>
                      <div className="text-xs text-slate-400 mt-1">/ {formatTime(duration)}</div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="120"
                      value={duration}
                      onChange={(e) => handleDurationChange(parseInt(e.target.value))}
                      className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer mt-3"
                    />
                    <div className="text-xs text-slate-400 mt-1 text-center">Max: 120 minutes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
            <button
              onClick={() => onNavigate(10)}
              className="flex items-center justify-center gap-2 bg-black text-white font-bold px-6 sm:px-8 py-4 rounded-lg text-base sm:text-lg hover:bg-purple-900 transition-all border border-purple-500"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || !selectedAsset}
              className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold px-6 sm:px-8 py-4 rounded-lg text-base sm:text-lg hover:bg-green-500 transition-all disabled:bg-green-800 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate
                </>
              )}
            </button>
            <button
              onClick={() => onNavigate(12)}
              className="flex items-center justify-center gap-2 bg-purple-600 text-white font-bold px-6 sm:px-8 py-4 rounded-lg text-base sm:text-lg hover:bg-purple-500 transition-all"
            >
              Next
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {showScriptModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-gradient-to-br from-purple-900/90 to-black/90 border-2 border-purple-400 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="text-center mb-6">
              <Sparkles className="w-16 h-16 mx-auto mb-4 text-purple-400" />
              <h2 className="text-2xl font-bold text-white mb-3">Create Scenes & Script?</h2>
              <p className="text-white/80 text-lg">
                Do You Wish App To Create Scenes And Script?
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => handleScriptResponse(false)}
                className="flex-1 bg-black hover:bg-gray-900 text-white font-bold py-4 px-6 rounded-lg text-lg transition-all border border-purple-500/50"
              >
                NO
              </button>
              <button
                onClick={() => handleScriptResponse(true)}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-6 rounded-lg text-lg transition-all"
              >
                YES
              </button>
            </div>
          </div>
        </div>
      )}

      {showAIDurationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-gradient-to-br from-purple-900/90 to-black/90 border-2 border-purple-400 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="text-center mb-6">
              <Sparkles className="w-16 h-16 mx-auto mb-4 text-purple-400" />
              <h2 className="text-2xl font-bold text-white mb-3">AI Duration Assistant</h2>
              <p className="text-white/80 text-lg">
                Let AI calculate the optimal film duration based on your uploaded assets?
              </p>
              <div className="mt-4 bg-purple-900/30 border border-purple-500/30 rounded-lg p-3">
                <p className="text-sm text-purple-200">
                  <span className="font-bold">Assets:</span> {assets.length} items
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setShowAIDurationModal(false)}
                disabled={aiCalculating}
                className="flex-1 bg-black hover:bg-gray-900 text-white font-bold py-4 px-6 rounded-lg text-lg transition-all border border-purple-500/50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={calculateAIDuration}
                disabled={aiCalculating}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-6 rounded-lg text-lg transition-all disabled:bg-purple-800 flex items-center justify-center gap-2"
              >
                {aiCalculating ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                    Calculating...
                  </>
                ) : (
                  'Calculate'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-gradient-to-br from-green-900/90 to-black/90 border-2 border-green-400 rounded-2xl p-8 max-w-lg w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-green-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">Generation Complete!</h2>
              <p className="text-white/80 text-lg mb-4">
                Your content has been successfully generated and saved.
              </p>
              {generatedOutput && (
                <div className="bg-black/50 border border-green-500/30 rounded-lg p-4 mb-4 text-left">
                  <p className="text-sm text-green-300 mb-2">
                    <span className="font-bold">Project:</span>{' '}
                    {generatedOutput.output_data.projectName}
                  </p>
                  <p className="text-sm text-green-300 mb-2">
                    <span className="font-bold">Settings:</span> {generatedOutput.output_data.settings.size},{' '}
                    {generatedOutput.output_data.settings.ratio}, {generatedOutput.output_data.settings.duration} min
                  </p>
                  <p className="text-xs text-green-400/70">
                    Generated at {new Date(generatedOutput.created_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-6 rounded-lg text-lg transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <QuickAccess onNavigate={onNavigate} />
      <GrokChat onNavigate={onNavigate} />
      <Footer />
    </div>
  );
}
