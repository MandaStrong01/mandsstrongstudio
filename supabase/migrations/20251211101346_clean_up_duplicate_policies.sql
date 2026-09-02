/*
  # Clean Up Duplicate Policies

  ## Problem
  - Multiple tables have duplicate or conflicting policies
  - This can cause permission issues and confusion
  - Examples: movie_projects, chat_messages have duplicate insert/update/delete policies

  ## Solution
  - Remove older duplicate policies
  - Keep only the most permissive and correct policies
  - Ensure team access is properly configured

  ## Tables Fixed
  - movie_projects: Remove old individual policies, keep team-aware policies
  - chat_messages: Remove old individual policies, keep team-aware policies
*/

-- Clean up movie_projects duplicate policies
DROP POLICY IF EXISTS "Users can insert own movie projects" ON movie_projects;
DROP POLICY IF EXISTS "Users can update own movie projects" ON movie_projects;
DROP POLICY IF EXISTS "Users can delete own movie projects" ON movie_projects;
DROP POLICY IF EXISTS "Users can view own movie projects" ON movie_projects;

-- Clean up chat_messages duplicate policies  
DROP POLICY IF EXISTS "Users can insert messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can view own chat messages" ON chat_messages;
