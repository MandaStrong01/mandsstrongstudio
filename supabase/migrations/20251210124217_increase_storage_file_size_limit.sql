/*
  # Increase Storage File Size Limit

  1. Changes
    - Increase file size limit from 500MB to 5GB (5368709120 bytes)
    - This allows users to upload large video files and other media assets
  
  2. Purpose
    - Support larger file uploads for video production workflows
    - Remove previous 500MB constraint
*/

UPDATE storage.buckets
SET file_size_limit = 5368709120
WHERE id = 'media-assets';
