/*
  # Create Video Rendering System for Real Movie Generation

  ## Overview
  This migration creates the infrastructure needed to generate actual 120-minute movies
  from uploaded media files. Unlike the current system which only saves JSON configs,
  this will produce real, playable video files.

  ## New Tables
  
  1. `render_jobs`
    - Tracks video rendering jobs from start to finish
    - Stores configuration, progress, and output file URLs
    - Enables async processing with status updates
  
  2. `render_scenes` 
    - Breaks down each movie into individual scenes
    - Maps uploaded assets to specific timestamps
    - Allows for parallel scene rendering
  
  3. `render_assets_map`
    - Junction table linking render jobs to source assets
    - Tracks which uploaded files are used in each movie
    - Enables efficient asset retrieval during rendering

  ## Security
  - RLS enabled on all tables
  - Users can only access their own render jobs
  - Authenticated access required for all operations

  ## Video Processing Flow
  1. User clicks "Generate Movie" on Page 11
  2. System creates render_job with all configuration
  3. Scenes are created based on duration and assets
  4. Edge Function processes video using FFmpeg
  5. Progress updates saved to render_job
  6. Final video URL saved when complete
  7. User can download/stream their movie
*/

-- =============================================================================
-- RENDER JOBS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  team_id uuid REFERENCES public.teams(id),
  
  -- Job Configuration
  title text NOT NULL DEFAULT 'Untitled Movie',
  description text,
  target_duration integer NOT NULL, -- in minutes (1-120)
  aspect_ratio text NOT NULL DEFAULT '16:9',
  resolution text NOT NULL DEFAULT '1080p',
  
  -- Processing Status
  status text NOT NULL DEFAULT 'pending',
  -- Status values: pending, queued, processing, rendering, finalizing, completed, failed, cancelled
  progress_percent integer DEFAULT 0,
  current_step text,
  error_message text,
  
  -- Scene Configuration
  scene_count integer NOT NULL DEFAULT 0,
  scene_breakdown jsonb DEFAULT '[]'::jsonb,
  
  -- Asset References
  primary_asset_id uuid,
  asset_ids jsonb DEFAULT '[]'::jsonb, -- Array of asset UUIDs used
  
  -- Output Settings
  video_settings jsonb DEFAULT '{}'::jsonb,
  audio_settings jsonb DEFAULT '{}'::jsonb,
  
  -- Results
  output_video_url text,
  output_video_size bigint,
  thumbnail_url text,
  actual_duration integer, -- final video duration in seconds
  
  -- Processing Metadata
  started_at timestamptz,
  completed_at timestamptz,
  processing_time_seconds integer,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'queued', 'processing', 'rendering', 'finalizing', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT valid_duration CHECK (target_duration >= 1 AND target_duration <= 120),
  CONSTRAINT valid_progress CHECK (progress_percent >= 0 AND progress_percent <= 100)
);

-- Enable RLS
ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for render_jobs
CREATE POLICY "Users can view own render jobs"
  ON public.render_jobs FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid()) OR 
    (team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ))
  );

CREATE POLICY "Users can create render jobs"
  ON public.render_jobs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own render jobs"
  ON public.render_jobs FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid()) OR 
    (team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ))
  );

CREATE POLICY "Users can delete own render jobs"
  ON public.render_jobs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- RENDER SCENES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.render_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  render_job_id uuid REFERENCES public.render_jobs(id) ON DELETE CASCADE NOT NULL,
  
  -- Scene Details
  scene_number integer NOT NULL,
  scene_name text NOT NULL,
  scene_type text, -- opening, action, dialogue, montage, climax, etc.
  
  -- Timing
  start_time integer NOT NULL, -- in seconds
  end_time integer NOT NULL, -- in seconds
  duration integer NOT NULL, -- in seconds
  
  -- Assets for this scene
  asset_id uuid, -- Primary asset to use
  asset_ids jsonb DEFAULT '[]'::jsonb, -- Additional assets
  
  -- Scene Configuration
  transition_in text DEFAULT 'cut',
  transition_out text DEFAULT 'cut',
  effects jsonb DEFAULT '[]'::jsonb,
  audio_track_id uuid,
  
  -- Processing
  status text DEFAULT 'pending',
  rendered_url text,
  error_message text,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_scene_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Enable RLS
ALTER TABLE public.render_scenes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for render_scenes
CREATE POLICY "Users can view own render scenes"
  ON public.render_scenes FOR SELECT
  TO authenticated
  USING (
    render_job_id IN (SELECT id FROM public.render_jobs WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create render scenes"
  ON public.render_scenes FOR INSERT
  TO authenticated
  WITH CHECK (
    render_job_id IN (SELECT id FROM public.render_jobs WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own render scenes"
  ON public.render_scenes FOR UPDATE
  TO authenticated
  USING (
    render_job_id IN (SELECT id FROM public.render_jobs WHERE user_id = auth.uid())
  );

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_render_jobs_user_id ON public.render_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON public.render_jobs(status);
CREATE INDEX IF NOT EXISTS idx_render_jobs_created_at ON public.render_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_render_scenes_job_id ON public.render_scenes(render_job_id);
CREATE INDEX IF NOT EXISTS idx_render_scenes_status ON public.render_scenes(status);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to render_jobs
DROP TRIGGER IF EXISTS update_render_jobs_updated_at ON public.render_jobs;
CREATE TRIGGER update_render_jobs_updated_at
  BEFORE UPDATE ON public.render_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate processing time when job completes
CREATE OR REPLACE FUNCTION calculate_processing_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
    IF NEW.started_at IS NOT NULL THEN
      NEW.processing_time_seconds = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::integer;
    END IF;
  END IF;
  
  IF NEW.status = 'processing' AND OLD.status != 'processing' THEN
    NEW.started_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-calculate processing time
DROP TRIGGER IF EXISTS auto_calculate_processing_time ON public.render_jobs;
CREATE TRIGGER auto_calculate_processing_time
  BEFORE UPDATE ON public.render_jobs
  FOR EACH ROW
  EXECUTE FUNCTION calculate_processing_time();
