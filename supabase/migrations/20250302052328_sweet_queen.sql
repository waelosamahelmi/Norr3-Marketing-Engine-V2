/*
  # Fix Infinite Recursion in RLS Policies

  1. Changes
     - Fix infinite recursion in users table policies
     - Fix activity_logs permissions
     - Simplify admin role checking
  
  2. Security
     - Maintain proper row-level security
     - Ensure admins have appropriate access
     - Allow activity logging for all authenticated users
*/

-- First drop all policies on users table that might depend on is_admin()
DROP POLICY IF EXISTS "Admins can read all users" ON users CASCADE;
DROP POLICY IF EXISTS "Users can update own data or admins can update any" ON users CASCADE;
DROP POLICY IF EXISTS "Admins can delete users" ON users CASCADE;

-- Then drop all other policies that depend on is_admin() function
DROP POLICY IF EXISTS "Admins can read all activity logs" ON activity_logs CASCADE;
DROP POLICY IF EXISTS "Users can read own campaigns" ON campaigns CASCADE;
DROP POLICY IF EXISTS "Users can insert own campaigns" ON campaigns CASCADE;
DROP POLICY IF EXISTS "Users can update own campaigns" ON campaigns CASCADE;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON campaigns CASCADE;
DROP POLICY IF EXISTS "Users can read own campaign apartments" ON campaign_apartments CASCADE;
DROP POLICY IF EXISTS "Users can insert own campaign apartments" ON campaign_apartments CASCADE;
DROP POLICY IF EXISTS "Users can update own campaign apartments" ON campaign_apartments CASCADE;
DROP POLICY IF EXISTS "Users can delete own campaign apartments" ON campaign_apartments CASCADE;
DROP POLICY IF EXISTS "Admins can read all media costs" ON media_costs CASCADE;
DROP POLICY IF EXISTS "Admins can insert media costs" ON media_costs CASCADE;
DROP POLICY IF EXISTS "Admins can update media costs" ON media_costs CASCADE;
DROP POLICY IF EXISTS "Admins can delete media costs" ON media_costs CASCADE;

-- Now we can safely drop the is_admin function
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- Drop all remaining policies on users table to start fresh
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Anyone can insert users" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;
DROP POLICY IF EXISTS "Admins can delete any user" ON users;

-- Create a non-recursive function to check admin status
CREATE OR REPLACE FUNCTION is_admin_safe()
RETURNS BOOLEAN AS $$
DECLARE
  user_role text;
BEGIN
  -- Direct query to the users table without using policies
  SELECT role INTO user_role FROM users WHERE id = auth.uid();
  RETURN user_role = 'admin';
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create simplified policies for users table
-- Allow users to read their own data
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow anyone to insert users (needed for signup)
CREATE POLICY "Anyone can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to update their own data
CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Allow admins to read all users
CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (is_admin_safe());

-- Allow admins to update any user
CREATE POLICY "Admins can update any user"
  ON users
  FOR UPDATE
  TO authenticated
  USING (is_admin_safe());

-- Allow admins to delete any user
CREATE POLICY "Admins can delete any user"
  ON users
  FOR DELETE
  TO authenticated
  USING (is_admin_safe());

-- Fix activity_logs policies
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Anyone can insert activity logs" ON activity_logs;

-- Allow all authenticated users to insert activity logs
CREATE POLICY "Anyone can insert activity logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow admins to read all activity logs
CREATE POLICY "Admins can read all activity logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (is_admin_safe());

-- Update campaigns table policies to use the safe function
CREATE POLICY "Users can read own campaigns"
  ON campaigns
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin_safe());

CREATE POLICY "Users can insert own campaigns"
  ON campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR is_admin_safe());

CREATE POLICY "Users can update own campaigns"
  ON campaigns
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_admin_safe());

CREATE POLICY "Users can delete own campaigns"
  ON campaigns
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR is_admin_safe());

-- Update campaign_apartments table policies
CREATE POLICY "Users can read own campaign apartments"
  ON campaign_apartments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND (campaigns.user_id = auth.uid() OR is_admin_safe())
    )
  );

CREATE POLICY "Users can insert own campaign apartments"
  ON campaign_apartments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND (campaigns.user_id = auth.uid() OR is_admin_safe())
    )
  );

CREATE POLICY "Users can update own campaign apartments"
  ON campaign_apartments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND (campaigns.user_id = auth.uid() OR is_admin_safe())
    )
  );

CREATE POLICY "Users can delete own campaign apartments"
  ON campaign_apartments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND (campaigns.user_id = auth.uid() OR is_admin_safe())
    )
  );

-- Update media_costs table policies
CREATE POLICY "Admins can read all media costs"
  ON media_costs
  FOR SELECT
  TO authenticated
  USING (is_admin_safe());

CREATE POLICY "Admins can insert media costs"
  ON media_costs
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_safe());

CREATE POLICY "Admins can update media costs"
  ON media_costs
  FOR UPDATE
  TO authenticated
  USING (is_admin_safe());

CREATE POLICY "Admins can delete media costs"
  ON media_costs
  FOR DELETE
  TO authenticated
  USING (is_admin_safe());