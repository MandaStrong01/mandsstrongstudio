/*
  # Simplify Assets Table Permissions
  
  1. Purpose
    - Fix "permission denied" errors when users try to access assets table
    - Simplify RLS policies to be more straightforward
    - Remove complex team queries that might be causing issues
  
  2. Changes
    - Drop existing complex policies
    - Create simple policies for authenticated users to manage their own assets
    - Allow users to read, insert, update, and delete their own assets
  
  3. Security
    - Users can only access their own assets (user_id = auth.uid())
    - All operations require authentication
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own or team assets" ON assets;
DROP POLICY IF EXISTS "Users can insert assets" ON assets;
DROP POLICY IF EXISTS "Users can update own or team assets" ON assets;
DROP POLICY IF EXISTS "Users can delete own or team assets" ON assets;

-- Create simple, working policies

-- Users can view their own assets
CREATE POLICY "Users can view own assets"
  ON assets
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own assets
CREATE POLICY "Users can insert own assets"
  ON assets
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own assets
CREATE POLICY "Users can update own assets"
  ON assets
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own assets
CREATE POLICY "Users can delete own assets"
  ON assets
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
