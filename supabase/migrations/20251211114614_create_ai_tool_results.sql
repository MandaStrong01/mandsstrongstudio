/*
  # Create AI Tool Results Table

  1. New Tables
    - `ai_tool_results`
      - `id` (uuid, primary key) - Unique identifier for each result
      - `user_id` (uuid, foreign key) - References auth.users
      - `tool_name` (text) - Name of the AI tool used
      - `input_file_url` (text) - URL of the uploaded file
      - `input_prompt` (text, nullable) - Optional user prompt
      - `status` (text) - Status: pending, processing, completed, error
      - `result` (text, nullable) - Processing result
      - `error_message` (text, nullable) - Error details if failed
      - `metadata` (jsonb) - Additional metadata (file info, etc.)
      - `created_at` (timestamptz) - When the processing started
      - `completed_at` (timestamptz, nullable) - When processing finished
      
  2. Security
    - Enable RLS on `ai_tool_results` table
    - Add policies for authenticated users to:
      - Insert their own results
      - View their own results
      - Update their own results
      - Delete their own results
      
  3. Indexes
    - Add index on user_id for faster queries
    - Add index on status for filtering
    - Add index on created_at for sorting
*/

CREATE TABLE IF NOT EXISTS ai_tool_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tool_name text NOT NULL,
  input_file_url text NOT NULL,
  input_prompt text,
  status text NOT NULL DEFAULT 'pending',
  result text,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE ai_tool_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own results"
  ON ai_tool_results
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own results"
  ON ai_tool_results
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own results"
  ON ai_tool_results
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own results"
  ON ai_tool_results
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_tool_results_user_id ON ai_tool_results(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_results_status ON ai_tool_results(status);
CREATE INDEX IF NOT EXISTS idx_ai_tool_results_created_at ON ai_tool_results(created_at DESC);
