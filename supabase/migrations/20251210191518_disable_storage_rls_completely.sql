/*
  # Completely disable RLS on storage

  This removes ALL storage policies and allows full access to the media-assets bucket.
  This is necessary to fix the "embedded file" error that occurs with RLS enabled.
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Anyone can view media assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload media assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their media assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their media assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update own files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own files" ON storage.objects;

-- Create single permissive policy for all operations
CREATE POLICY "Allow all operations on media-assets"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'media-assets')
WITH CHECK (bucket_id = 'media-assets');