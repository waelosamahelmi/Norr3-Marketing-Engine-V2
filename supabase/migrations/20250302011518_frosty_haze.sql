/*
  # Create activity_logs table

  1. New Tables
    - `activity_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users.id)
      - `user_email` (text)
      - `action` (text)
      - `details` (text)
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `activity_logs` table
    - Add policy for admins to read all activity logs
    - Add policy for authenticated users to insert activity logs
*/

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  user_email text NOT NULL,
  action text NOT NULL,
  details text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can read all activity logs
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

-- Policy: Authenticated users can insert activity logs
CREATE POLICY "Authenticated users can insert activity logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);