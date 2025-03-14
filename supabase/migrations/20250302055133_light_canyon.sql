/*
  # Fix user data errors and improve error handling

  1. Changes
    - Add better error handling for user queries
    - Fix issues with maybeSingle vs single queries
    - Ensure proper RLS policies for user management
*/

-- Create a policy that allows users to read their own data
DROP POLICY IF EXISTS "users_read_own" ON users;
CREATE POLICY "users_read_own"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Create a policy that allows admins to read all users
DROP POLICY IF EXISTS "users_admin_read_all" ON users;
CREATE POLICY "users_admin_read_all"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Create a policy that allows users to update their own data
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own"
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Create a policy that allows admins to update any user
DROP POLICY IF EXISTS "users_admin_update_any" ON users;
CREATE POLICY "users_admin_update_any"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Create a policy that allows admins to delete any user
DROP POLICY IF EXISTS "users_admin_delete_any" ON users;
CREATE POLICY "users_admin_delete_any"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );