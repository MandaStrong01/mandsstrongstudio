-- Create Assets and AI Tools Schema
-- 
-- Overview:
-- This migration creates the database structure for storing uploaded media assets
-- and AI tool data for the MandaStrong movie creation platform.
-- 
-- New Tables:
-- 
-- 1. assets - Stores all uploaded media assets (images, videos, audio) from Page 10
--    - id (uuid, primary key) - Unique identifier
--    - user_id (uuid) - References auth.users
--    - file_name (text) - Original filename
--    - file_type (text) - MIME type
--    - file_url (text) - Storage URL for the asset
--    - thumbnail_url (text, nullable) - Optional thumbnail for videos
--    - file_size (bigint) - File size in bytes
--    - asset_type (text) - Category: 'image', 'video', 'audio', 'other'
--    - title (text, nullable) - Optional custom title
--    - description (text, nullable) - Optional description
--    - created_at (timestamptz) - Upload timestamp
--    - updated_at (timestamptz) - Last modified timestamp
-- 
-- 2. ai_tool_outputs - Stores outputs from AI tools on Pages 4-9
--    - id (uuid, primary key) - Unique identifier
--    - user_id (uuid) - References auth.users
--    - tool_page (integer) - Page number (4-9)
--    - tool_name (text) - Name of the AI tool
--    - input_data (jsonb) - User inputs to the tool
--    - output_data (jsonb) - Generated results
--    - created_at (timestamptz) - Creation timestamp
--    - updated_at (timestamptz) - Last modified timestamp
-- 
-- Security:
-- - RLS enabled on all tables
-- - Users can only access their own data
-- - INSERT policies check authenticated users
-- - SELECT/UPDATE/DELETE policies verify ownership

-- Create assets table
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_url text NOT NULL,
  thumbnail_url text,
  file_size bigint DEFAULT 0,
  asset_type text NOT NULL CHECK (asset_type IN ('image', 'video', 'audio', 'other')),
  title text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create AI tool outputs table
CREATE TABLE IF NOT EXISTS ai_tool_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tool_page integer NOT NULL CHECK (tool_page BETWEEN 4 AND 9),
  tool_name text NOT NULL,
  input_data jsonb DEFAULT '{}'::jsonb,
  output_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_outputs ENABLE ROW LEVEL SECURITY;

-- Assets policies
CREATE POLICY "Users can view own assets"
  ON assets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets"
  ON assets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets"
  ON assets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets"
  ON assets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- AI tool outputs policies
CREATE POLICY "Users can view own AI outputs"
  ON ai_tool_outputs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI outputs"
  ON ai_tool_outputs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AI outputs"
  ON ai_tool_outputs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own AI outputs"
  ON ai_tool_outputs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tool_outputs_user_id ON ai_tool_outputs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_outputs_tool_page ON ai_tool_outputs(tool_page);