/*
  # Fix Storage Bucket to Allow All Media Formats
  
  1. Updates
    - Update media-assets bucket to explicitly allow all video, image, audio, and document formats
    - Ensure MP4, MOV, AVI, WebM, and all other video formats are allowed
    - Set file size limit to 10GB per file
  
  2. Notes
    - This ensures users can upload any media format without restrictions
    - Critical for video editing platform functionality
*/

-- Update the media-assets bucket to explicitly allow all media types
UPDATE storage.buckets
SET 
  allowed_mime_types = ARRAY[
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/webm',
    'video/x-flv',
    'video/x-ms-wmv',
    'video/mpeg',
    'video/3gpp',
    'video/3gpp2',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/flac',
    'audio/aac',
    'audio/mp4',
    'audio/x-ms-wma',
    'audio/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-rar-compressed',
    'application/octet-stream'
  ],
  file_size_limit = 10737418240
WHERE name = 'media-assets';
