/*
  # Remove Unused Indexes

  1. Overview
    - Removes 12 unused indexes that are consuming resources without providing value
    - Improves database performance by reducing index maintenance overhead
    - Reduces storage usage

  2. Indexes Removed
    - `idx_ai_tool_results_user_id` on `ai_tool_results` table
    - `idx_assets_team_id` on `assets` table
    - `idx_chat_messages_team_id` on `chat_messages` table
    - `idx_media_assets_project_id` on `media_assets` table
    - `idx_media_assets_user_id` on `media_assets` table
    - `idx_movie_projects_team_id` on `movie_projects` table
    - `idx_page_content_project_id` on `page_content` table
    - `idx_projects_user_id` on `projects` table
    - `idx_render_jobs_team_id` on `render_jobs` table
    - `idx_render_jobs_user_id` on `render_jobs` table
    - `idx_team_members_user_id` on `team_members` table
    - `idx_teams_created_by` on `teams` table

  3. Impact
    - Reduces write overhead on these tables
    - Frees up storage space
    - Maintains all necessary indexes for query performance
*/

-- Drop unused indexes safely
DROP INDEX IF EXISTS idx_ai_tool_results_user_id;
DROP INDEX IF EXISTS idx_assets_team_id;
DROP INDEX IF EXISTS idx_chat_messages_team_id;
DROP INDEX IF EXISTS idx_media_assets_project_id;
DROP INDEX IF EXISTS idx_media_assets_user_id;
DROP INDEX IF EXISTS idx_movie_projects_team_id;
DROP INDEX IF EXISTS idx_page_content_project_id;
DROP INDEX IF EXISTS idx_projects_user_id;
DROP INDEX IF EXISTS idx_render_jobs_team_id;
DROP INDEX IF EXISTS idx_render_jobs_user_id;
DROP INDEX IF EXISTS idx_team_members_user_id;
DROP INDEX IF EXISTS idx_teams_created_by;