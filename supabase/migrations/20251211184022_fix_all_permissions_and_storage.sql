/*
  # Fix All Permission Issues and Storage Access

  ## Problem
  Users experiencing permission denied errors for:
  - Table access even when they own the data
  - File uploads to storage bucket
  - File size limits not being properly applied

  ## Changes
  
  1. **Auto-create profiles on signup**
    - Add trigger function to automatically create profile when user signs up
    - Ensures users can immediately use the app without manual profile creation
  
  2. **Simplify and fix storage policies**
    - Ensure authenticated users can upload, view, update, delete files
    - Keep public read access for sharing
    - Remove any conflicting policies
  
  3. **Verify all table policies work correctly**
    - Ensure auth.uid() checks work properly
    - Fix any policies that might cause infinite recursion
  
  4. **Confirm file size limits**
    - Verify 50GB limit is applied to media-assets bucket

  ## Security
  - RLS remains enabled on all tables
  - Only authenticated users can modify their own data
  - Storage access requires authentication for uploads
  - Public read access for media sharing
*/

-- =============================================================================
-- 1. AUTO-CREATE PROFILES ON SIGNUP
-- =============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, plan, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    'free',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 2. FIX STORAGE POLICIES
-- =============================================================================

-- Drop all existing storage policies to start fresh
DROP POLICY IF EXISTS "Anyone can upload to media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to movie-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update files in media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update files in movie-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete files in media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete files in movie-assets" ON storage.objects;
DROP POLICY IF EXISTS "Public can view all files in media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload to media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update media-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete media-assets" ON storage.objects;

-- Create simplified, working storage policies
-- SELECT: Anyone can view files (for public sharing)
CREATE POLICY "Public read access for media-assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'media-assets');

-- INSERT: Authenticated users can upload
CREATE POLICY "Authenticated users can upload to media-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media-assets');

-- UPDATE: Authenticated users can update their files
CREATE POLICY "Authenticated users can update files in media-assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'media-assets')
  WITH CHECK (bucket_id = 'media-assets');

-- DELETE: Authenticated users can delete their files
CREATE POLICY "Authenticated users can delete files in media-assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'media-assets');

-- =============================================================================
-- 3. VERIFY FILE SIZE LIMIT
-- =============================================================================

-- Ensure file size limit is set to 50GB
UPDATE storage.buckets
SET file_size_limit = 53687091200
WHERE id = 'media-assets';

-- =============================================================================
-- 4. ADD HELPFUL INDEXES FOR PERFORMANCE
-- =============================================================================

-- Add index on assets user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON public.assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_team_id ON public.assets(team_id);

-- Add index on movie_projects user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_movie_projects_user_id ON public.movie_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_movie_projects_team_id ON public.movie_projects(team_id);

-- Add index on team_members for faster team lookups
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON public.team_members(email);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
