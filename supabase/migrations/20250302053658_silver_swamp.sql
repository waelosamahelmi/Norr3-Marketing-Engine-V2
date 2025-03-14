-- Drop policies if they exist (using IF EXISTS to avoid errors)
DROP POLICY IF EXISTS "activity_logs_insert" ON activity_logs;
DROP POLICY IF EXISTS "Anyone can insert activity logs" ON activity_logs;
DROP POLICY IF EXISTS "anyone_can_insert_activity_logs" ON activity_logs;

-- Create a policy that allows all authenticated users to insert activity logs
-- Only create if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activity_logs' 
    AND policyname = 'anyone_can_insert_activity_logs'
  ) THEN
    CREATE POLICY "anyone_can_insert_activity_logs"
      ON activity_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Make sure the policy for reading activity logs is correct
DROP POLICY IF EXISTS "activity_logs_admin_read_all" ON activity_logs;
DROP POLICY IF EXISTS "Admins can read all activity logs" ON activity_logs;
DROP POLICY IF EXISTS "admins_can_read_activity_logs" ON activity_logs;

-- Create the admin read policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activity_logs' 
    AND policyname = 'admins_can_read_activity_logs'
  ) THEN
    CREATE POLICY "admins_can_read_activity_logs"
      ON activity_logs
      FOR SELECT
      TO authenticated
      USING (user_is_admin());
  END IF;
END $$;