/*
  # Alternative fix for RLS policies

  1. Changes
    - Use a completely different approach to fix infinite recursion in users table policies
    - Create a function to check admin status without recursion
    - Rewrite all policies to use this function
  
  2. Security
    - Maintain proper access control while fixing recursion issues
    - Ensure admins can still manage users
    - Allow proper activity logging
*/

-- Create a function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Direct query to the users table without using policies
  RETURN EXISTS (
    SELECT 1 
    FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- Create new policies using the function
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete users"
  ON users
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Fix activity_logs policies
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Admins can read all activity logs" ON activity_logs;

-- Create a policy that allows all authenticated users to insert activity logs
CREATE POLICY "Authenticated users can insert activity logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create a policy that allows admins to read all activity logs
CREATE POLICY "Admins can read all activity logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Fix policies for other tables that might use the same pattern
DROP POLICY IF EXISTS "Admins can read all media costs" ON media_costs;
DROP POLICY IF EXISTS "Admins can insert media costs" ON media_costs;
DROP POLICY IF EXISTS "Admins can update media costs" ON media_costs;
DROP POLICY IF EXISTS "Admins can delete media costs" ON media_costs;

CREATE POLICY "Admins can read all media costs"
  ON media_costs
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert media costs"
  ON media_costs
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update media costs"
  ON media_costs
  FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can delete media costs"
  ON media_costs
  FOR DELETE
  TO authenticated
  USING (is_admin());