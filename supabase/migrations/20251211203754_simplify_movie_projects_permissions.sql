/*
  # Simplify Movie Projects Table Permissions
  
  1. Purpose
    - Fix "permission denied" errors for movie_projects table
    - Simplify RLS policies to avoid complex team queries
    - Allow users to easily create and manage their own movie projects
  
  2. Changes
    - Drop existing complex policies
    - Create simple policies for authenticated users
    - Users can manage their own projects without team complications
  
  3. Security
    - Users can only access their own projects (user_id = auth.uid())
    - All operations require authentication
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own or team projects" ON movie_projects;
DROP POLICY IF EXISTS "Users can insert projects" ON movie_projects;
DROP POLICY IF EXISTS "Users can update own or team projects" ON movie_projects;
DROP POLICY IF EXISTS "Users can delete own or team projects" ON movie_projects;

-- Create simple, working policies

-- Users can view their own projects
CREATE POLICY "Users can view own projects"
  ON movie_projects
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own projects
CREATE POLICY "Users can insert own projects"
  ON movie_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own projects
CREATE POLICY "Users can update own projects"
  ON movie_projects
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects"
  ON movie_projects
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
