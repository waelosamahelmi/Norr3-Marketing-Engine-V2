/*
  # Fix duplicate activity logs table

  This migration is a corrected version that checks if the table and policies exist
  before trying to create them to avoid conflicts with the original migration.
*/

-- Check if activity_logs table exists before creating it
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'activity_logs') THEN
    CREATE TABLE IF NOT EXISTS activity_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id),
      user_email text NOT NULL,
      action text NOT NULL,
      details text,
      created_at timestamptz DEFAULT now()
    );

    ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Check if policies exist before creating them
DO $$ 
BEGIN
  -- Check for admin read policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activity_logs' 
    AND policyname = 'Admins can read all activity logs'
  ) THEN
    CREATE POLICY "Admins can read all activity logs"
      ON activity_logs
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      );
  END IF;

  -- Check for insert policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activity_logs' 
    AND policyname = 'Authenticated users can insert activity logs'
  ) THEN
    CREATE POLICY "Authenticated users can insert activity logs"
      ON activity_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;