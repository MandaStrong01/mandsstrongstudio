/*
  # Create Chat Messages Schema

  ## Overview
  This migration creates the database structure for the Agent Grok chat system.
  Users can send messages and receive AI-generated responses.

  ## New Tables
  
  ### `chat_messages`
  Stores all chat conversation messages
  - `id` (uuid, primary key) - Unique message identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `message` (text) - The message content
  - `is_user` (boolean) - true if sent by user, false if from AI
  - `created_at` (timestamptz) - Message timestamp
  
  ## Security
  
  ### Row Level Security (RLS)
  - Enable RLS on `chat_messages` table
  - Users can only view their own chat messages
  - Users can only insert their own messages
  - No one can update or delete messages (chat history is immutable)
  
  ### Important Notes
  1. All policies restrict access to authenticated users only
  2. Chat messages are owned by the user who created them
  3. Messages cannot be edited or deleted to maintain chat history
*/

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  is_user boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own chat messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at ASC);