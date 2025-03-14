/*
  # Fix user policies for signup and login

  1. Changes
    - Simplify RLS policies to fix infinite recursion issues
    - Add explicit policy for unauthenticated users to insert into users table
    - Fix activity logs policies to allow proper logging
*/

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "Anyone can insert users" ON users;
DROP POLICY IF EXISTS "anyone_can_insert_users" ON users;

-- Create a policy that allows anyone (including unauthenticated users) to insert into users table
-- This is needed for the signup process
CREATE POLICY "anyone_can_insert_users"
  ON users
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Make sure the policy for activity logs is correct
DROP POLICY IF EXISTS "anyone_can_insert_activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "Anyone can insert activity logs" ON activity_logs;

-- Create a policy that allows all users to insert activity logs
CREATE POLICY "anyone_can_insert_activity_logs"
  ON activity_logs
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);