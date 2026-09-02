/*
  # Fix Chat Messages Policy

  ## Problem
  Chat messages policy queries auth.users causing permission errors

  ## Solution
  Drop the policy with auth.users dependency and create a clean one
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view own or team messages" ON chat_messages;

-- Create clean policy without auth.users dependency
CREATE POLICY "chat_messages_select"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
