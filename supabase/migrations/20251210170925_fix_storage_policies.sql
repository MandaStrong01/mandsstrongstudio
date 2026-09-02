/*
  # Fix Storage Upload Policies
  
  1. Problem
    - Conflicting INSERT policies on storage.objects
    - One policy references non-existent 'assets' bucket
    - This causes upload failures with "embedded file" errors
  
  2. Solution
    - Drop all existing storage policies
    - Recreate clean policies for 'media-assets' bucket only
    - Ensure uploads work for authenticated users
*/

-- Drop all existing storage.objects policies
DROP POLICY IF EXISTS "Authenticated users can upload own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own or team files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read public files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own or team files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own or team files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;

-- Create clean, working policies for media-assets bucket
CREATE POLICY "Allow authenticated uploads to media-assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'media-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Allow public reads from media-assets"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'media-assets');

CREATE POLICY "Allow authenticated deletes from media-assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'media-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Allow authenticated updates to media-assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'media-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'media-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
