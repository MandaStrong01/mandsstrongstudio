/*
  # Increase Storage File Size Limit to 50GB

  1. Changes
    - Increase file size limit from 5GB to 50GB (53687091200 bytes)
    - This allows users to upload very large video files and complete movie projects
  
  2. Purpose
    - Support feature-length films and high-resolution video uploads
    - Enable users to work with large production files
    - Remove file size constraints for professional filmmaking
*/

UPDATE storage.buckets
SET file_size_limit = 53687091200
WHERE id = 'media-assets';
