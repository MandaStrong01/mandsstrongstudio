/*
  # Create Movie Projects Schema

  ## Overview
  This migration creates the core schema for the MandaStrong Studio movie-making application.
  Users can create and manage movie projects with multi-phase workflows.

  ## New Tables
  
  ### `movie_projects`
  Main table for storing user movie projects
  - `id` (uuid, primary key) - Unique identifier for each project
  - `user_id` (uuid, foreign key) - Links to auth.users table
  - `title` (text) - Movie project title
  - `description` (text) - Project description
  - `duration` (integer) - Target duration in minutes (default 120-150 mins)
  - `current_phase` (integer) - Current phase in the creation process (1-3)
  - `phase_1_data` (jsonb) - Data for phase 1 (story/concept)
  - `phase_2_data` (jsonb) - Data for phase 2 (development)
  - `phase_3_data` (jsonb) - Data for phase 3 (production)
  - `completed` (boolean) - Whether the project is completed
  - `created_at` (timestamptz) - Timestamp of creation
  - `updated_at` (timestamptz) - Timestamp of last update

  ## Security
  
  ### Row Level Security (RLS)
  - Enable RLS on `movie_projects` table
  - Users can only view their own projects
  - Users can only insert their own projects
  - Users can only update their own projects
  - Users can only delete their own projects
  
  ### Important Notes
  1. All policies restrict access to authenticated users only
  2. Projects are owned by the user who created them
  3. No public access to any project data
*/

-- Create movie_projects table
CREATE TABLE IF NOT EXISTS movie_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Project',
  description text DEFAULT '',
  duration integer DEFAULT 120,
  current_phase integer DEFAULT 1,
  phase_1_data jsonb DEFAULT '{}'::jsonb,
  phase_2_data jsonb DEFAULT '{}'::jsonb,
  phase_3_data jsonb DEFAULT '{}'::jsonb,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE movie_projects ENABLE ROW LEVEL SECURITY;

-- Create policies for movie_projects
CREATE POLICY "Users can view own movie projects"
  ON movie_projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own movie projects"
  ON movie_projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own movie projects"
  ON movie_projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own movie projects"
  ON movie_projects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_movie_projects_user_id ON movie_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_movie_projects_created_at ON movie_projects(created_at DESC);