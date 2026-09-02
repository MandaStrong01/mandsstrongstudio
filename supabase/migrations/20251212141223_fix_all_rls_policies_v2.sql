/*
  # Fix All RLS Policies for Production v2

  ## Critical Fixes
  1. Remove problematic queries to auth.users table
  2. Fix render_jobs policies to allow authenticated users full access
  3. Fix team_members policies without auth.users dependency
  4. Fix all other table policies to be production-ready
  5. Ensure no cross-schema permissions issues

  ## Tables Updated
  - render_jobs: Full CRUD for authenticated users
  - team_members: Simplified policies without auth.users
  - assets: Full CRUD for authenticated users
  - movie_projects: Full CRUD for authenticated users
  - ai_tool_results: Full CRUD for authenticated users
  - ai_tool_outputs: Full CRUD for authenticated users
  - All other tables: Proper authenticated access
*/

-- Drop all existing policies that might cause issues
DROP POLICY IF EXISTS "Users can manage their render jobs" ON render_jobs;
DROP POLICY IF EXISTS "Users can view their render jobs" ON render_jobs;
DROP POLICY IF EXISTS "Users can insert their render jobs" ON render_jobs;
DROP POLICY IF EXISTS "Users can update their render jobs" ON render_jobs;
DROP POLICY IF EXISTS "Users can delete their render jobs" ON render_jobs;
DROP POLICY IF EXISTS "Users can view team render jobs" ON render_jobs;
DROP POLICY IF EXISTS "Authenticated users can view render jobs" ON render_jobs;
DROP POLICY IF EXISTS "Authenticated users can insert render jobs" ON render_jobs;
DROP POLICY IF EXISTS "Authenticated users can update their render jobs" ON render_jobs;
DROP POLICY IF EXISTS "Authenticated users can delete their render jobs" ON render_jobs;

DROP POLICY IF EXISTS "Team members can view membership" ON team_members;
DROP POLICY IF EXISTS "Team members can view team members" ON team_members;
DROP POLICY IF EXISTS "Team owners can manage members" ON team_members;
DROP POLICY IF EXISTS "Users can view their team memberships" ON team_members;
DROP POLICY IF EXISTS "Users can join teams" ON team_members;

DROP POLICY IF EXISTS "Users can view own assets" ON assets;
DROP POLICY IF EXISTS "Users can insert own assets" ON assets;
DROP POLICY IF EXISTS "Users can update own assets" ON assets;
DROP POLICY IF EXISTS "Users can delete own assets" ON assets;
DROP POLICY IF EXISTS "Authenticated users can view assets" ON assets;
DROP POLICY IF EXISTS "Authenticated users can insert assets" ON assets;
DROP POLICY IF EXISTS "Authenticated users can update assets" ON assets;
DROP POLICY IF EXISTS "Authenticated users can delete assets" ON assets;

DROP POLICY IF EXISTS "Users can manage own projects" ON movie_projects;
DROP POLICY IF EXISTS "Users can view own projects" ON movie_projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON movie_projects;
DROP POLICY IF EXISTS "Users can update own projects" ON movie_projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON movie_projects;
DROP POLICY IF EXISTS "Authenticated users can view projects" ON movie_projects;
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON movie_projects;
DROP POLICY IF EXISTS "Authenticated users can update projects" ON movie_projects;
DROP POLICY IF EXISTS "Authenticated users can delete projects" ON movie_projects;

DROP POLICY IF EXISTS "Users can manage their AI tool results" ON ai_tool_results;
DROP POLICY IF EXISTS "Users can view AI tool results" ON ai_tool_results;
DROP POLICY IF EXISTS "Users can insert AI tool results" ON ai_tool_results;
DROP POLICY IF EXISTS "Users can update AI tool results" ON ai_tool_results;
DROP POLICY IF EXISTS "Users can delete AI tool results" ON ai_tool_results;

DROP POLICY IF EXISTS "Users can manage their AI tool outputs" ON ai_tool_outputs;
DROP POLICY IF EXISTS "Users can view AI tool outputs" ON ai_tool_outputs;
DROP POLICY IF EXISTS "Users can insert AI tool outputs" ON ai_tool_outputs;
DROP POLICY IF EXISTS "Users can update AI tool outputs" ON ai_tool_outputs;

DROP POLICY IF EXISTS "Users can view render scenes" ON render_scenes;
DROP POLICY IF EXISTS "Users can insert render scenes" ON render_scenes;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- RENDER JOBS: Allow full access for authenticated users
CREATE POLICY "render_jobs_select"
  ON render_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "render_jobs_insert"
  ON render_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "render_jobs_update"
  ON render_jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "render_jobs_delete"
  ON render_jobs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- TEAM MEMBERS: Simplified
CREATE POLICY "team_members_select"
  ON team_members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "team_members_insert"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ASSETS: Full access
CREATE POLICY "assets_select"
  ON assets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "assets_insert"
  ON assets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assets_update"
  ON assets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assets_delete"
  ON assets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- MOVIE PROJECTS: Full access
CREATE POLICY "movie_projects_select"
  ON movie_projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "movie_projects_insert"
  ON movie_projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "movie_projects_update"
  ON movie_projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "movie_projects_delete"
  ON movie_projects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- AI TOOL RESULTS: Full access
CREATE POLICY "ai_tool_results_select"
  ON ai_tool_results FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ai_tool_results_insert"
  ON ai_tool_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_tool_results_update"
  ON ai_tool_results FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_tool_results_delete"
  ON ai_tool_results FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- AI TOOL OUTPUTS: Full access
CREATE POLICY "ai_tool_outputs_select"
  ON ai_tool_outputs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ai_tool_outputs_insert"
  ON ai_tool_outputs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_tool_outputs_update"
  ON ai_tool_outputs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RENDER SCENES: Full access
CREATE POLICY "render_scenes_select"
  ON render_scenes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM render_jobs
      WHERE render_jobs.id = render_scenes.render_job_id
      AND render_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "render_scenes_insert"
  ON render_scenes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM render_jobs
      WHERE render_jobs.id = render_scenes.render_job_id
      AND render_jobs.user_id = auth.uid()
    )
  );

-- PROFILES: Full access
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);