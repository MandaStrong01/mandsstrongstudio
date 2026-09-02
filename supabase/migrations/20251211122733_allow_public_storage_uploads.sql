/*
  # Allow Public Storage Uploads

  ## Changes
  - Remove authentication requirement for storage uploads
  - Allow anyone to upload, update, and delete files
  - Keep public read access

  ## Security Note
  - This allows anonymous uploads for demo/development purposes
  - Files are organized by user/guest folders
*/

-- Drop existing authenticated-only policies
DROP POLICY IF EXISTS "Authenticated users can upload to media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files in media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files in media-assets" ON storage.objects;

-- Create public access policies for all operations
CREATE POLICY "Anyone can upload to media-assets"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'media-assets');

CREATE POLICY "Anyone can update files in media-assets"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'media-assets')
WITH CHECK (bucket_id = 'media-assets');

CREATE POLICY "Anyone can delete files in media-assets"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'media-assets');

-- Also check for movie-assets bucket
DROP POLICY IF EXISTS "Authenticated users can upload to movie-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files in movie-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files in movie-assets" ON storage.objects;

CREATE POLICY "Anyone can upload to movie-assets"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'movie-assets');

CREATE POLICY "Anyone can update files in movie-assets"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'movie-assets')
WITH CHECK (bucket_id = 'movie-assets');

CREATE POLICY "Anyone can delete files in movie-assets"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'movie-assets');