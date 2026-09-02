/*
  # Fix Database Performance and Security Issues

  ## Changes Made
  
  1. **Add Missing Indexes on Foreign Keys**
     - `chat_messages.team_id` - Index for team-based message queries
     - `projects.user_id` - Index for user project lookups
     - `render_jobs.team_id` - Index for team render job queries
     - `teams.created_by` - Index for team creator lookups
  
  2. **Optimize RLS Policy Performance**
     - Fix `teams` table policy to use `(select auth.uid())` instead of `auth.uid()`
     - This prevents re-evaluation of auth function for each row
     - Significantly improves query performance at scale
  
  3. **Clean Up Unused Indexes**
     - Remove indexes that haven't been used and may cause overhead
     - Keeps database lean and maintenance efficient

  ## Performance Impact
  - Foreign key queries will be significantly faster
  - RLS policy evaluation will be more efficient
  - Reduced index maintenance overhead
*/

-- Add missing indexes on foreign keys
CREATE INDEX IF NOT EXISTS idx_chat_messages_team_id ON chat_messages(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_team_id ON render_jobs(team_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);

-- Fix the inefficient RLS policy on teams table
DROP POLICY IF EXISTS "Authenticated users can view their teams" ON teams;

CREATE POLICY "Authenticated users can view their teams"
  ON teams FOR SELECT
  TO authenticated
  USING (
    (EXISTS ( 
      SELECT 1
      FROM team_members
      WHERE (team_members.team_id = teams.id) 
        AND (team_members.user_id = (select auth.uid()))
    )) OR (created_by = (select auth.uid()))
  );

-- Drop unused indexes to reduce overhead
DROP INDEX IF EXISTS idx_ai_tool_results_user_id;
DROP INDEX IF EXISTS idx_assets_team_id;
DROP INDEX IF EXISTS idx_media_assets_project_id;
DROP INDEX IF EXISTS idx_media_assets_user_id;
DROP INDEX IF EXISTS idx_movie_projects_team_id;
DROP INDEX IF EXISTS idx_page_content_project_id;
DROP INDEX IF EXISTS idx_render_jobs_user_id;
DROP INDEX IF EXISTS idx_render_scenes_render_job_id;
DROP INDEX IF EXISTS idx_team_members_user_id;
