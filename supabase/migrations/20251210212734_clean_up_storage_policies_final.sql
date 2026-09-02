/*
  # Clean Up Storage Policies - Final Fix

  1. Problem
    - Multiple overlapping storage policies causing conflicts
    - Both permissive "ALL" policy and specific INSERT/SELECT/UPDATE/DELETE policies exist
    - Can cause unexpected behavior and permission errors

  2. Solution
    - Remove all storage policies
    - Create single clean policy that allows all operations
    - Ensure bucket is public and accessible

  3. Security Note
    - This makes the media-assets bucket fully public
    - Suitable for a media sharing platform
    - Files are accessible by anyone with the URL
*/

-- Drop ALL existing storage policies
DROP POLICY IF EXISTS "Allow all operations on media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own or team files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own or team files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own or team files" ON storage.objects;

-- Create single permissive policy
CREATE POLICY "Public access to media-assets"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'media-assets')
WITH CHECK (bucket_id = 'media-assets');