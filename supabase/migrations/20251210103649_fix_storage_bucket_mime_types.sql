/*
  # Fix Storage Bucket MIME Types

  1. Changes
    - Update `media-assets` bucket to accept all file types
    - Remove MIME type restrictions that were preventing certain files from being uploaded
  
  2. Purpose
    - Allow users to upload any type of file without MIME type restrictions
    - Fix "unable to upload embedded file" errors
*/

UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'media-assets';
