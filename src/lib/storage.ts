import { supabase } from './supabase';
import { optimizeFile, getCachedTeam, setCachedTeam } from './compression';

export interface UploadResult {
  success: boolean;
  fileUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  assetId?: string;
}

export interface UploadProgress {
  progress: number;
  fileName: string;
}

export async function getUserTeam(userId: string): Promise<string | null> {
  const cached = getCachedTeam(userId);
  if (cached !== undefined) {
    return cached;
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.email) return null;

  const { data, error } = await supabase
    .from('team_members')
    .select('team_id')
    .or(`user_id.eq.${userId},email.eq.${userData.user.email}`)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    setCachedTeam(userId, null);
    return null;
  }

  const teamId = data.team_id;
  setCachedTeam(userId, teamId);
  return teamId;
}

export async function uploadFile(
  file: File,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  try {
    if (onProgress) onProgress(5);

    const [optimizedFile, teamId] = await Promise.all([
      optimizeFile(file),
      getUserTeam(userId)
    ]);

    if (onProgress) onProgress(35);

    const timestamp = Date.now();
    const fileName = `${userId}/${timestamp}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('media-assets')
      .upload(fileName, optimizedFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (onProgress) onProgress(75);

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('media-assets')
      .getPublicUrl(fileName);

    const assetType = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('audio/')
      ? 'audio'
      : 'other';

    if (onProgress) onProgress(90);

    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .insert({
        user_id: userId,
        team_id: teamId,
        file_name: file.name,
        file_type: file.type,
        file_url: publicUrl,
        file_size: optimizedFile.size,
        asset_type: assetType,
        title: file.name,
      })
      .select()
      .single();

    if (onProgress) onProgress(100);

    if (assetError) {
      return { success: false, error: assetError.message };
    }

    return {
      success: true,
      fileUrl: publicUrl,
      assetId: assetData.id,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function uploadFiles(
  files: File[],
  userId: string,
  onProgress?: (fileName: string, progress: number) => void
): Promise<UploadResult[]> {
  const uploadPromises = files.map(file =>
    uploadFile(file, userId, onProgress ? (p) => onProgress(file.name, p) : undefined)
  );

  return Promise.all(uploadPromises);
}

export async function deleteFile(assetId: string, filePath: string): Promise<boolean> {
  try {
    const { error: storageError } = await supabase.storage
      .from('media-assets')
      .remove([filePath]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      return false;
    }

    const { error: dbError } = await supabase
      .from('assets')
      .delete()
      .eq('id', assetId);

    if (dbError) {
      console.error('DB delete error:', dbError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Delete exception:', err);
    return false;
  }
}

export async function getAssets(userId: string) {
  const teamId = await getUserTeam(userId);

  let query = supabase
    .from('assets')
    .select('*')
    .order('created_at', { ascending: false });

  if (teamId) {
    query = query.or(`user_id.eq.${userId},team_id.eq.${teamId}`);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Get assets error:', error);
    return [];
  }

  return data || [];
}
