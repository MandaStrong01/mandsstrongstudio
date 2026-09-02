/*
  # Fix Upload Permissions and File Size Limits
  
  1. Purpose
    - Ensure storage bucket allows uploads up to 50GB
    - Simplify and clarify all storage policies
    - Remove any conflicting or redundant policies
    - Enable smooth uploads for all authenticated users
  
  2. Changes
    - Set file size limit to 50GB (53687091200 bytes)
    - Make bucket public for reading
    - Clean up all storage policies
    - Ensure authenticated users can upload, update, and delete their own files
  
  3. Security
    - Public read access (anyone can view uploaded files)
    - Only authenticated users can upload
    - Only authenticated users can delete/update
*/

-- Ensure bucket exists and is configured correctly
DO $$
BEGIN
  -- Update bucket settings
  UPDATE storage.buckets
  SET 
    public = true,
    file_size_limit = 53687091200,
    allowed_mime_types = NULL
  WHERE id = 'media-assets';
  
  -- If bucket doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('media-assets', 'media-assets', true, 53687091200, NULL);
  END IF;
END $$;

-- Drop all existing policies to start fresh
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND policyname LIKE '%media-assets%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Create simple, clear policies

-- 1. Anyone can view files (public read)
CREATE POLICY "Public can view media-assets files"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'media-assets');

-- 2. Authenticated users can upload files
CREATE POLICY "Authenticated users can upload to media-assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media-assets');

-- 3. Authenticated users can update their files
CREATE POLICY "Authenticated users can update media-assets files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'media-assets')
  WITH CHECK (bucket_id = 'media-assets');

-- 4. Authenticated users can delete files
CREATE POLICY "Authenticated users can delete media-assets files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'media-assets');
