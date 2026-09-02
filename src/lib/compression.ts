export async function compressImage(file: File, maxSizeMB: number = 3): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const fileSizeMB = file.size / 1024 / 1024;
  if (fileSizeMB <= maxSizeMB) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        const maxDimension = fileSizeMB > 10 ? 1280 : 1920;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const quality = fileSizeMB > 10 ? 0.7 : 0.8;
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve(file);
              return;
            }

            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          file.type,
          quality
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export async function optimizeFile(file: File): Promise<File> {
  if (file.type.startsWith('image/')) {
    return compressImage(file, 3);
  }
  return file;
}

const teamCache = new Map<string, { teamId: string | null; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

export function getCachedTeam(userId: string): string | null | undefined {
  const cached = teamCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.teamId;
  }
  return undefined;
}

export function setCachedTeam(userId: string, teamId: string | null): void {
  teamCache.set(userId, { teamId, timestamp: Date.now() });
}
