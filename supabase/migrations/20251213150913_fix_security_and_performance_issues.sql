/*
  # Fix Security and Performance Issues

  ## Security Improvements
  1. Enable leaked password protection for enhanced auth security
  2. Configure auth DB connection strategy to use percentage-based allocation

  ## Performance Optimizations
  1. Add missing indexes for foreign keys to improve query performance
     - ai_tool_results.user_id
     - assets.team_id
     - media_assets.project_id
     - media_assets.user_id
     - movie_projects.team_id
     - page_content.project_id
     - render_jobs.user_id
     - render_scenes.render_job_id
     - team_members.user_id
  
  2. Remove unused indexes to reduce storage overhead
     - idx_chat_messages_team_id
     - idx_projects_user_id
     - idx_render_jobs_team_id
     - idx_teams_created_by

  ## Impact
  - Improved query performance for foreign key lookups
  - Reduced index maintenance overhead
  - Enhanced authentication security
  - Better connection pool management

  ## Manual Configuration Required
  1. Enable leaked password protection in Supabase Dashboard:
     Authentication > Settings > Enable "Check for leaked passwords"
  
  2. Set Auth DB connection strategy to percentage-based:
     Database Settings > Connection Pooling > Auth: Use percentage (e.g., 10%)
*/

-- Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_ai_tool_results_user_id ON public.ai_tool_results(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_team_id ON public.assets(team_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_project_id ON public.media_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_user_id ON public.media_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_movie_projects_team_id ON public.movie_projects(team_id);
CREATE INDEX IF NOT EXISTS idx_page_content_project_id ON public.page_content(project_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_user_id ON public.render_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_render_scenes_render_job_id ON public.render_scenes(render_job_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);

-- Remove unused indexes to reduce storage and maintenance overhead
DROP INDEX IF EXISTS idx_chat_messages_team_id;
DROP INDEX IF EXISTS idx_projects_user_id;
DROP INDEX IF EXISTS idx_render_jobs_team_id;
DROP INDEX IF EXISTS idx_teams_created_by;