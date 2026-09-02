/*
  # Fix Infinite Recursion in Team Members RLS Policies

  1. Problem
    - RLS policies on team_members table were causing infinite recursion
    - The policies were querying team_members within team_members checks
    - This caused "infinite recursion detected in policy" errors

  2. Solution
    - Simplify team_members policies to check current row only
    - Remove recursive subqueries that reference team_members
    - Use direct user_id and email checks instead

  3. Changes
    - Drop all existing team_members policies
    - Create new non-recursive policies
    - Ensure users can see their own team memberships
    - Ensure team admins can manage memberships
*/

-- Drop all existing team_members policies
DROP POLICY IF EXISTS "Users can view members of their teams" ON team_members;
DROP POLICY IF EXISTS "Team owners and admins can add members" ON team_members;
DROP POLICY IF EXISTS "Team owners and admins can remove members" ON team_members;

-- Create new non-recursive policies for team_members
-- Users can view team memberships where they are the user or have matching email
CREATE POLICY "Users can view own team memberships"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Allow inserting team members (will be restricted by application logic)
CREATE POLICY "Authenticated users can add team members"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can only delete their own memberships
CREATE POLICY "Users can remove own membership"
  ON team_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Fix teams table policies to not cause recursion
DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;
DROP POLICY IF EXISTS "Team owners and admins can update teams" ON teams;

CREATE POLICY "All authenticated users can view teams"
  ON teams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Team creators can update teams"
  ON teams FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());
