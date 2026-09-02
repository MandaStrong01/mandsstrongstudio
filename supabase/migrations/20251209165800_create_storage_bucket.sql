/*
  # Create Storage Bucket for Media Assets

  1. Storage Setup
    - Creates `media-assets` bucket for storing user uploaded files
    - Sets bucket to public for easy access
    - Configures file size limits and allowed MIME types
  
  2. Security
    - Enable RLS on storage.objects
    - Add policies for authenticated users to:
      - Upload their own files
      - Read all public files
      - Delete only their own files
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media-assets',
  'media-assets',
  true,
  524288000,
  ARRAY[
    'image/*',
    'video/*',
    'audio/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload own files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'media-assets' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Anyone can read public files"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'media-assets');

CREATE POLICY "Users can delete own files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'media-assets' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'media-assets' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'media-assets' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );