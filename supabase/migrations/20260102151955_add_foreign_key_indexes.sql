/*
  # Add Foreign Key Indexes for Performance

  1. Performance Improvements
    - Add indexes for all foreign key columns to optimize:
      - JOIN operations between related tables
      - CASCADE operations on updates/deletes
      - Query performance when filtering by foreign keys
    
  2. Indexes Added
    - ai_tool_results(user_id)
    - assets(team_id)
    - chat_messages(team_id)
    - media_assets(project_id, user_id)
    - movie_projects(team_id)
    - page_content(project_id)
    - projects(user_id)
    - render_jobs(team_id, user_id)
    - render_scenes(render_job_id)
    - team_members(user_id)
    - teams(created_by)

  3. Important Notes
    - Foreign key indexes are essential for query performance
    - Without these indexes, JOINs and lookups can be slow
    - These indexes significantly improve queries with WHERE, JOIN, and CASCADE operations
*/

-- Add foreign key indexes
CREATE INDEX IF NOT EXISTS idx_ai_tool_results_user_id ON public.ai_tool_results(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_team_id ON public.assets(team_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_team_id ON public.chat_messages(team_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_project_id ON public.media_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_user_id ON public.media_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_movie_projects_team_id ON public.movie_projects(team_id);
CREATE INDEX IF NOT EXISTS idx_page_content_project_id ON public.page_content(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_team_id ON public.render_jobs(team_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_user_id ON public.render_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_render_scenes_render_job_id ON public.render_scenes(render_job_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON public.teams(created_by);
