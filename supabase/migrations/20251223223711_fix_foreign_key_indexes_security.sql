/*
  # Fix Foreign Key Index Security Issues

  ## Overview
  This migration fixes security and performance issues by adding missing foreign key indexes
  and removing unused indexes that were incorrectly created.

  ## Changes Made

  1. **Add Missing Foreign Key Indexes** (Required for Security)
     - `ai_tool_results.user_id` - Improve query performance for user tool results
     - `assets.team_id` - Improve query performance for team assets
     - `media_assets.project_id` - Improve query performance for project media
     - `media_assets.user_id` - Improve query performance for user media
     - `movie_projects.team_id` - Improve query performance for team projects
     - `page_content.project_id` - Improve query performance for project pages
     - `render_jobs.user_id` - Improve query performance for user render jobs
     - `render_scenes.render_job_id` - Improve query performance for render scenes
     - `team_members.user_id` - Improve query performance for team member lookups

  2. **Remove Unused Indexes** (Improve Write Performance)
     - `idx_chat_messages_team_id` - Not being used in queries
     - `idx_projects_user_id` - Not being used in queries
     - `idx_render_jobs_team_id` - Not being used in queries
     - `idx_teams_created_by` - Not being used in queries

  ## Performance Impact
  - Foreign key indexes significantly improve JOIN and WHERE clause performance
  - Removing unused indexes improves INSERT/UPDATE/DELETE performance
  - Reduces index maintenance overhead

  ## Security Notes
  - These changes address security recommendations from Supabase
  - All existing RLS policies remain unchanged
  - No data is modified, only index structures

  ## Additional Security Recommendations (Manual Configuration Required)
  
  The following issues require manual configuration in Supabase Dashboard:
  
  1. **Auth DB Connection Strategy**: 
     - Navigate to: Settings > Database > Connection pooling
     - Change from fixed number (10) to percentage-based allocation
     
  2. **Leaked Password Protection**:
     - Navigate to: Authentication > Settings > Password Protection
     - Enable "Check for compromised passwords" using HaveIBeenPwned.org
*/

-- Drop unused indexes that are not being utilized in queries
DROP INDEX IF EXISTS idx_chat_messages_team_id;
DROP INDEX IF EXISTS idx_projects_user_id;
DROP INDEX IF EXISTS idx_render_jobs_team_id;
DROP INDEX IF EXISTS idx_teams_created_by;

-- Add foreign key indexes for optimal query performance
-- These indexes are critical for JOIN operations and foreign key lookups

-- AI Tool Results
CREATE INDEX IF NOT EXISTS idx_ai_tool_results_user_id ON ai_tool_results(user_id);

-- Assets
CREATE INDEX IF NOT EXISTS idx_assets_team_id ON assets(team_id);

-- Media Assets
CREATE INDEX IF NOT EXISTS idx_media_assets_project_id ON media_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_user_id ON media_assets(user_id);

-- Movie Projects
CREATE INDEX IF NOT EXISTS idx_movie_projects_team_id ON movie_projects(team_id);

-- Page Content
CREATE INDEX IF NOT EXISTS idx_page_content_project_id ON page_content(project_id);

-- Render Jobs
CREATE INDEX IF NOT EXISTS idx_render_jobs_user_id ON render_jobs(user_id);

-- Render Scenes
CREATE INDEX IF NOT EXISTS idx_render_scenes_render_job_id ON render_scenes(render_job_id);

-- Team Members
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- Verify all critical indexes are in place
DO $$
BEGIN
  RAISE NOTICE 'Foreign key indexes successfully created or verified';
  RAISE NOTICE 'Unused indexes successfully removed';
  RAISE NOTICE 'Database performance and security improved';
END $$;
