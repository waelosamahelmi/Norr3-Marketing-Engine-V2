/*
  # Agency integration for users

  1. Changes
    - Add reference to agency_id in users table if it doesn't exist
    - Update any existing users with agency information based on agent_key
  
  2. Security
    - Keep existing RLS policies
*/

-- Check if agency_id column exists in users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'agency_id'
  ) THEN
    -- Add agency_id column to users table
    ALTER TABLE users ADD COLUMN agency_id text;
    
    -- Add comment to explain the purpose
    COMMENT ON COLUMN users.agency_id IS 'The agency ID this user belongs to, used for apartment filtering';
  END IF;
END $$;