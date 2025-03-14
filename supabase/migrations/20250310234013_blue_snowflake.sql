/*
  # Add agency_id field to users table

  1. Changes
    - Add agency_id column to users table to track which agency a user belongs to
    
  2. Background
    - This separates agency information from agent_key
    - Allows better filtering of apartments by agency
*/

-- Add agency_id column to users table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'agency_id'
  ) THEN
    ALTER TABLE users ADD COLUMN agency_id text;
  END IF;
END $$;

-- Update comment to explain the purpose of the column
COMMENT ON COLUMN users.agency_id IS 'The agency ID this user belongs to, used for apartment filtering';