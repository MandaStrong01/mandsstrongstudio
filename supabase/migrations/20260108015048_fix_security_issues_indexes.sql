/*
  # Fix Security Issues - Indexes and Performance

  ## Changes Made
  
  1. **Add Missing Foreign Key Indexes**
     - `idx_assets_team_id` on `assets(team_id)` - improves team-based queries
     - `idx_chat_messages_team_id` on `chat_messages(team_id)` - improves team chat queries
     - `idx_movie_projects_team_id` on `movie_projects(team_id)` - improves team project queries
     - `idx_render_jobs_team_id` on `render_jobs(team_id)` - improves team render queries
  
  2. **Remove Unused Indexes**
     - Drop `idx_ai_tool_results_user_id` - not being used
     - Drop `idx_media_assets_project_id` - not being used
     - Drop `idx_media_assets_user_id` - not being used
     - Drop `idx_page_content_project_id` - not being used
     - Drop `idx_projects_user_id` - not being used
     - Drop `idx_render_jobs_user_id` - not being used
     - Drop `idx_render_scenes_render_job_id` - not being used
     - Drop `idx_team_members_user_id` - not being used
     - Drop `idx_teams_created_by` - not being used
  
  ## Security Impact
  - Improves query performance on foreign key columns
  - Reduces database overhead from unused indexes
  - Enhances overall database performance
*/

-- Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_assets_team_id ON assets(team_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_team_id ON chat_messages(team_id);
CREATE INDEX IF NOT EXISTS idx_movie_projects_team_id ON movie_projects(team_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_team_id ON render_jobs(team_id);

-- Remove unused indexes (check existence first to avoid errors)
DROP INDEX IF EXISTS idx_ai_tool_results_user_id;
DROP INDEX IF EXISTS idx_media_assets_project_id;
DROP INDEX IF EXISTS idx_media_assets_user_id;
DROP INDEX IF EXISTS idx_page_content_project_id;
DROP INDEX IF EXISTS idx_projects_user_id;
DROP INDEX IF EXISTS idx_render_jobs_user_id;
DROP INDEX IF EXISTS idx_render_scenes_render_job_id;
DROP INDEX IF EXISTS idx_team_members_user_id;
DROP INDEX IF EXISTS idx_teams_created_by;