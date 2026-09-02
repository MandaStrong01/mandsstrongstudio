/*
  # Fix AI Tool Outputs Table Constraint

  ## Changes
  - Remove the restrictive CHECK constraint on tool_page (was limited to pages 4-9)
  - Make tool_page nullable since tool_name already identifies the source
  - This allows Page 11 (Editor Dashboard) and other pages to save data

  ## Details
  The original constraint `CHECK (tool_page BETWEEN 4 AND 9)` was preventing
  Page 11 from saving enhanced media projects and generated movies to the database.
*/

-- Drop the old constraint
ALTER TABLE ai_tool_outputs 
DROP CONSTRAINT IF EXISTS ai_tool_outputs_tool_page_check;

-- Make tool_page nullable
ALTER TABLE ai_tool_outputs 
ALTER COLUMN tool_page DROP NOT NULL;

-- Set default value for backwards compatibility
ALTER TABLE ai_tool_outputs 
ALTER COLUMN tool_page SET DEFAULT NULL;
