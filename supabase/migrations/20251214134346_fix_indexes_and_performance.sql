/*
  # Fix Database Indexes and Performance Issues
  
  ## Changes Made
  
  1. **Add Missing Foreign Key Indexes**
     - Add index on `chat_messages.team_id` for faster team message queries
     - Add index on `projects.user_id` for faster user project lookups
     - Add index on `render_jobs.team_id` for faster team render job queries
     - Add index on `teams.created_by` for faster creator lookups
  
  2. **Remove Unused Indexes**
     - Drop `idx_ai_tool_results_user_id` (not being used in queries)
     - Drop `idx_assets_team_id` (not being used in queries)
     - Drop `idx_media_assets_project_id` (not being used in queries)
     - Drop `idx_media_assets_user_id` (not being used in queries)
     - Drop `idx_movie_projects_team_id` (not being used in queries)
     - Drop `idx_page_content_project_id` (not being used in queries)
     - Drop `idx_render_jobs_user_id` (not being used in queries)
     - Drop `idx_render_scenes_render_job_id` (not being used in queries)
     - Drop `idx_team_members_user_id` (not being used in queries)
  
  ## Performance Impact
  - Adding foreign key indexes will significantly improve JOIN query performance
  - Removing unused indexes will improve INSERT/UPDATE/DELETE performance
  - Overall database efficiency will be enhanced
  
  ## Security Notes
  - These changes do not affect RLS policies
  - All existing security measures remain in place
*/

-- Add missing foreign key indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_team_id ON chat_messages(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_team_id ON render_jobs(team_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);

-- Remove unused indexes to improve write performance
DROP INDEX IF EXISTS idx_ai_tool_results_user_id;
DROP INDEX IF EXISTS idx_assets_team_id;
DROP INDEX IF EXISTS idx_media_assets_project_id;
DROP INDEX IF EXISTS idx_media_assets_user_id;
DROP INDEX IF EXISTS idx_movie_projects_team_id;
DROP INDEX IF EXISTS idx_page_content_project_id;
DROP INDEX IF EXISTS idx_render_jobs_user_id;
DROP INDEX IF EXISTS idx_render_scenes_render_job_id;
DROP INDEX IF EXISTS idx_team_members_user_id;
