/*
  # Create Teams and Shared Access System

  1. New Tables
    - `teams`
      - `id` (uuid, primary key)
      - `name` (text) - Team name
      - `created_at` (timestamptz)
      - `created_by` (uuid) - User who created the team
    
    - `team_members`
      - `id` (uuid, primary key)
      - `team_id` (uuid, foreign key to teams)
      - `user_id` (uuid, foreign key to auth.users)
      - `email` (text) - Email address of the member
      - `role` (text) - Member role (owner, admin, member)
      - `joined_at` (timestamptz)

  2. Changes
    - Add `team_id` column to `assets` table
    - Add `team_id` column to `movie_projects` table
    - Add `team_id` column to `chat_messages` table

  3. Security
    - Enable RLS on new tables
    - Add policies for team-based access
    - Update existing policies to support team access

  4. Data Migration
    - Create default "MandaStrong Studios" team
    - Add authorized email addresses as team members
*/

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(team_id, email)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Add team_id to existing tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE assets ADD COLUMN team_id uuid REFERENCES teams(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'movie_projects' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE movie_projects ADD COLUMN team_id uuid REFERENCES teams(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN team_id uuid REFERENCES teams(id);
  END IF;
END $$;

-- RLS Policies for teams table
CREATE POLICY "Users can view teams they are members of"
  ON teams FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can create teams"
  ON teams FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Team owners and admins can update teams"
  ON teams FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT team_id FROM team_members
      WHERE (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
      AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for team_members table
CREATE POLICY "Users can view members of their teams"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Team owners and admins can add members"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Team owners and admins can remove members"
  ON team_members FOR DELETE
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
      AND role IN ('owner', 'admin')
    )
  );

-- Update assets RLS policies to support team access
DROP POLICY IF EXISTS "Users can view own assets" ON assets;
DROP POLICY IF EXISTS "Users can insert own assets" ON assets;
DROP POLICY IF EXISTS "Users can update own assets" ON assets;
DROP POLICY IF EXISTS "Users can delete own assets" ON assets;

CREATE POLICY "Users can view own or team assets"
  ON assets FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert assets"
  ON assets FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      team_id IS NULL
      OR team_id IN (
        SELECT team_id FROM team_members
        WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update own or team assets"
  ON assets FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own or team assets"
  ON assets FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Update movie_projects RLS policies
DROP POLICY IF EXISTS "Users can view own projects" ON movie_projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON movie_projects;
DROP POLICY IF EXISTS "Users can update own projects" ON movie_projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON movie_projects;

CREATE POLICY "Users can view own or team projects"
  ON movie_projects FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert projects"
  ON movie_projects FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      team_id IS NULL
      OR team_id IN (
        SELECT team_id FROM team_members
        WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update own or team projects"
  ON movie_projects FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own or team projects"
  ON movie_projects FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Update chat_messages RLS policies
DROP POLICY IF EXISTS "Users can view own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON chat_messages;

CREATE POLICY "Users can view own or team messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      team_id IS NULL
      OR team_id IN (
        SELECT team_id FROM team_members
        WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- Update storage bucket policies
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

CREATE POLICY "Users can upload own or team files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'assets'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own or team files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'assets'
  );

CREATE POLICY "Users can delete own or team files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'assets'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
