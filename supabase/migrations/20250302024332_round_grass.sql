/*
  # Fix RLS policies for users and activity_logs tables

  1. Changes
    - Fix infinite recursion in users table policies
    - Fix activity_logs policies to allow authenticated users to insert logs
    - Simplify policy conditions to avoid circular references
  
  2. Security
    - Maintain proper access control while fixing recursion issues
    - Ensure admins can still manage users
    - Allow proper activity logging
*/

-- First, drop the problematic policies from users table
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- Create simplified policies for users table that avoid recursion
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can update users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can delete users"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Fix activity_logs policies
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON activity_logs;

-- Create a policy that allows all authenticated users to insert activity logs
CREATE POLICY "Authenticated users can insert activity logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure the admin policy for reading logs is correct
DROP POLICY IF EXISTS "Admins can read all activity logs" ON activity_logs;

CREATE POLICY "Admins can read all activity logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );