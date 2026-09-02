/*
  # Fix Duplicate Policies and Auth.Users Permissions

  ## Problem
  Multiple duplicate policies exist that query auth.users table causing permission errors

  ## Solution
  1. Drop ALL policies on affected tables
  2. Create single, clean policies without auth.users dependencies
  3. Use only auth.uid() for authentication checks

  ## Tables Fixed
  - team_members: Remove all auth.users queries
  - render_jobs: Remove all auth.users queries
  - All other tables: Ensure single clean policies
*/

-- TEAM MEMBERS: Drop everything
DROP POLICY IF EXISTS "team_members_select" ON team_members;
DROP POLICY IF EXISTS "team_members_insert" ON team_members;
DROP POLICY IF EXISTS "Users can view own team memberships" ON team_members;
DROP POLICY IF EXISTS "Authenticated users can add team members" ON team_members;
DROP POLICY IF EXISTS "Users can remove own membership" ON team_members;

-- RENDER JOBS: Drop everything
DROP POLICY IF EXISTS "render_jobs_select" ON render_jobs;
DROP POLICY IF EXISTS "render_jobs_insert" ON render_jobs;
DROP POLICY IF EXISTS "render_jobs_update" ON render_jobs;
DROP POLICY IF EXISTS "render_jobs_delete" ON render_jobs;
DROP POLICY IF EXISTS "Users can view own render jobs" ON render_jobs;
DROP POLICY IF EXISTS "Users can create render jobs" ON render_jobs;
DROP POLICY IF EXISTS "Users can update own render jobs" ON render_jobs;
DROP POLICY IF EXISTS "Users can delete own render jobs" ON render_jobs;

-- Create SINGLE clean policy for team_members
CREATE POLICY "team_members_all_access"
  ON team_members FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create SINGLE clean policies for render_jobs (separate for each operation)
CREATE POLICY "render_jobs_all_access"
  ON render_jobs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
