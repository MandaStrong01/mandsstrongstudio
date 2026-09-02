/*
  # Update Duration Constraints to Support 5-180 Minute Videos

  ## Overview
  This migration updates the duration constraints to match the UI slider which allows
  users to create videos from 5 minutes up to 180 minutes (3 hours).

  ## Changes
  1. Updates render_jobs table constraint to allow 5-180 minute durations
  2. Updates movie_projects table to support longer durations
  
  ## Important Notes
  - The frontend slider in Page11.tsx allows 5-180 minutes
  - This ensures database validation matches the UI expectations
  - Longer videos will require more processing time and storage
*/

-- Drop the old constraint on render_jobs
ALTER TABLE public.render_jobs 
  DROP CONSTRAINT IF EXISTS valid_duration;

-- Add new constraint allowing 5-180 minutes
ALTER TABLE public.render_jobs 
  ADD CONSTRAINT valid_duration CHECK (target_duration >= 5 AND target_duration <= 180);

-- Update the default duration for movie_projects to 30 minutes (matches slider default)
ALTER TABLE public.movie_projects 
  ALTER COLUMN duration SET DEFAULT 30;

-- Add constraint to movie_projects if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_movie_duration'
  ) THEN
    ALTER TABLE public.movie_projects 
      ADD CONSTRAINT valid_movie_duration CHECK (duration >= 5 AND duration <= 180);
  END IF;
END $$;
