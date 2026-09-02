/*
  # Remove Unused Indexes and Optimize Database

  1. Performance Improvements
    - Drop unused indexes that consume storage and slow down writes:
      - `idx_ai_tool_results_user_id` on ai_tool_results
      - `idx_assets_team_id` on assets
      - `idx_media_assets_project_id` on media_assets
      - `idx_media_assets_user_id` on media_assets
      - `idx_movie_projects_team_id` on movie_projects
      - `idx_page_content_project_id` on page_content
      - `idx_render_jobs_user_id` on render_jobs
      - `idx_render_scenes_render_job_id` on render_scenes
      - `idx_team_members_user_id` on team_members
      - `idx_chat_messages_team_id` on chat_messages
      - `idx_projects_user_id` on projects
      - `idx_render_jobs_team_id` on render_jobs
      - `idx_teams_created_by` on teams

  2. Important Notes
    - Foreign key indexes are automatically created and maintained by PostgreSQL
    - These custom indexes were not being used by the query planner
    - Removing them will free up storage and improve write performance
*/

-- Drop unused indexes (only if they exist)
DROP INDEX IF EXISTS idx_ai_tool_results_user_id;
DROP INDEX IF EXISTS idx_assets_team_id;
DROP INDEX IF EXISTS idx_media_assets_project_id;
DROP INDEX IF EXISTS idx_media_assets_user_id;
DROP INDEX IF EXISTS idx_movie_projects_team_id;
DROP INDEX IF EXISTS idx_page_content_project_id;
DROP INDEX IF EXISTS idx_render_jobs_user_id;
DROP INDEX IF EXISTS idx_render_scenes_render_job_id;
DROP INDEX IF EXISTS idx_team_members_user_id;
DROP INDEX IF EXISTS idx_chat_messages_team_id;
DROP INDEX IF EXISTS idx_projects_user_id;
DROP INDEX IF EXISTS idx_render_jobs_team_id;
DROP INDEX IF EXISTS idx_teams_created_by;
