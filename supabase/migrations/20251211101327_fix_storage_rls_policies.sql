/*
  # Fix Storage RLS Policies - Complete Solution

  ## Problem
  - RLS is enabled on storage.objects but NO policies exist
  - This blocks ALL uploads and downloads
  - Users cannot access files even though bucket is public

  ## Solution
  - Create comprehensive policies for all storage operations
  - Allow public read access for all files
  - Allow authenticated users to upload, update, and delete files
  - No restrictions - full access for authenticated users

  ## Security
  - Public bucket for media sharing
  - Anyone can view files (public read)
  - Only authenticated users can upload/modify
  - Suitable for production media platform
*/

-- Drop any existing policies (in case some exist)
DROP POLICY IF EXISTS "Public access to media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow all operations on media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete" ON storage.objects;

-- Create policies for all operations
CREATE POLICY "Public can view all files in media-assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media-assets');

CREATE POLICY "Authenticated users can upload to media-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media-assets');

CREATE POLICY "Authenticated users can update files in media-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'media-assets')
WITH CHECK (bucket_id = 'media-assets');

CREATE POLICY "Authenticated users can delete files in media-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'media-assets');
