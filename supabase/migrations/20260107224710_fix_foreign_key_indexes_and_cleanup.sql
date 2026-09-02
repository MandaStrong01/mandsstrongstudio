/*
  # Fix Foreign Key Indexes and Remove Unused Indexes

  ## Summary
  This migration addresses critical performance and security issues by adding missing 
  indexes on foreign keys and removing unused indexes to reduce maintenance overhead.

  ## Changes Made

  ### 1. Add Missing Foreign Key Indexes
  Foreign keys without indexes can cause severe performance degradation on queries and 
  DELETE operations. Adding indexes for:
  
  - `ai_tool_results.user_id` - Index for user-based queries
  - `media_assets.project_id` - Index for project-based asset queries  
  - `media_assets.user_id` - Index for user-based asset queries
  - `page_content.project_id` - Index for project content lookups
  - `projects.user_id` - Index for user's projects queries
  - `render_jobs.user_id` - Index for user's render jobs
  - `render_scenes.render_job_id` - Index for render job scenes
  - `team_members.user_id` - Index for user's team memberships
  - `teams.created_by` - Index for team creator lookups

  ### 2. Remove Unused Indexes
  These indexes are not being utilized by query planner and consume unnecessary storage:
  
  - `idx_assets_team_id` on `assets` table
  - `idx_chat_messages_team_id` on `chat_messages` table
  - `idx_movie_projects_team_id` on `movie_projects` table
  - `idx_render_jobs_team_id` on `render_jobs` table

  ## Performance Impact
  - Improved JOIN and WHERE clause performance on foreign key columns
  - Faster DELETE operations on parent tables
  - Reduced storage overhead from unused indexes
  - Better query plan optimization

  ## Security Impact
  - Prevents query timeouts that could lead to denial of service
  - Improves database responsiveness under load
*/

-- Add missing foreign key indexes
-- These indexes improve query performance and are essential for foreign key operations

-- Index for ai_tool_results.user_id
CREATE INDEX IF NOT EXISTS idx_ai_tool_results_user_id 
  ON public.ai_tool_results(user_id);

-- Index for media_assets.project_id  
CREATE INDEX IF NOT EXISTS idx_media_assets_project_id 
  ON public.media_assets(project_id);

-- Index for media_assets.user_id
CREATE INDEX IF NOT EXISTS idx_media_assets_user_id 
  ON public.media_assets(user_id);

-- Index for page_content.project_id
CREATE INDEX IF NOT EXISTS idx_page_content_project_id 
  ON public.page_content(project_id);

-- Index for projects.user_id
CREATE INDEX IF NOT EXISTS idx_projects_user_id 
  ON public.projects(user_id);

-- Index for render_jobs.user_id
CREATE INDEX IF NOT EXISTS idx_render_jobs_user_id 
  ON public.render_jobs(user_id);

-- Index for render_scenes.render_job_id
CREATE INDEX IF NOT EXISTS idx_render_scenes_render_job_id 
  ON public.render_scenes(render_job_id);

-- Index for team_members.user_id
CREATE INDEX IF NOT EXISTS idx_team_members_user_id 
  ON public.team_members(user_id);

-- Index for teams.created_by
CREATE INDEX IF NOT EXISTS idx_teams_created_by 
  ON public.teams(created_by);

-- Remove unused indexes to reduce storage overhead and maintenance cost
-- These indexes exist but are not being used by the query planner

DROP INDEX IF EXISTS public.idx_assets_team_id;
DROP INDEX IF EXISTS public.idx_chat_messages_team_id;
DROP INDEX IF EXISTS public.idx_movie_projects_team_id;
DROP INDEX IF EXISTS public.idx_render_jobs_team_id;
