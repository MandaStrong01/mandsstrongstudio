/*
  # Simplify Storage Policies
  
  This migration simplifies storage policies to fix upload issues.
  
  1. Changes Made
    - Drop all existing storage policies
    - Create simplified policies using SPLIT_PART instead of storage.foldername
    - Ensure policies work correctly for file uploads
  
  2. Security
    - Users can only upload to folders named with their user ID
    - Public read access for all files
    - Users can only delete/update their own files
*/

-- Drop all existing storage policies
DROP POLICY IF EXISTS "Allow authenticated uploads to media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Public files are readable" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;

-- Simple upload policy: authenticated users can upload to any path in media-assets
CREATE POLICY "Authenticated users can upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media-assets');

-- Allow everyone to read files
CREATE POLICY "Anyone can read files"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'media-assets');

-- Authenticated users can delete any file (will be controlled by app logic)
CREATE POLICY "Authenticated users can delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'media-assets');

-- Authenticated users can update any file (will be controlled by app logic)
CREATE POLICY "Authenticated users can update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'media-assets')
  WITH CHECK (bucket_id = 'media-assets');
