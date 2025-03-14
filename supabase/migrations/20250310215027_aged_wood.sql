/*
  # Add CASCADE delete to activity logs

  1. Changes
    - Modify the foreign key constraint on activity_logs.user_id to CASCADE on delete
    - This ensures that when a user is deleted, their activity logs are also deleted

  2. Security
    - No changes to RLS policies
    - Maintains data integrity while allowing user deletion
*/

-- Drop the existing foreign key constraint
ALTER TABLE activity_logs
DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;

-- Add the new constraint with ON DELETE CASCADE
ALTER TABLE activity_logs
ADD CONSTRAINT activity_logs_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE CASCADE;