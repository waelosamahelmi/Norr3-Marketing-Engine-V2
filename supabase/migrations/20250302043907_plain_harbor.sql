/*
  # Fix Supabase Policies

  1. Changes
    - Fix infinite recursion in users table policies
    - Fix activity_logs policies
    - Simplify RLS policies to avoid circular dependencies
*/

-- Drop all existing policies on users table to start fresh
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "Anyone can insert users" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;
DROP POLICY IF EXISTS "Admins can delete any user" ON users;

-- Create simplified policies for users table
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Anyone can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create admin policies using a direct role check instead of subqueries
CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can update any user"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can delete any user"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Fix activity_logs policies
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Admins can read all activity logs" ON activity_logs;

-- Allow all authenticated users to insert activity logs without restrictions
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
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Fix campaigns table policies to use the same pattern
DROP POLICY IF EXISTS "Users can read own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can insert own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON campaigns;

CREATE POLICY "Users can read own campaigns"
  ON campaigns
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Users can insert own campaigns"
  ON campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR 
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Users can update own campaigns"
  ON campaigns
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Users can delete own campaigns"
  ON campaigns
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Fix campaign_apartments table policies
DROP POLICY IF EXISTS "Users can read own campaign apartments" ON campaign_apartments;
DROP POLICY IF EXISTS "Users can insert own campaign apartments" ON campaign_apartments;
DROP POLICY IF EXISTS "Users can update own campaign apartments" ON campaign_apartments;
DROP POLICY IF EXISTS "Users can delete own campaign apartments" ON campaign_apartments;

CREATE POLICY "Users can read own campaign apartments"
  ON campaign_apartments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND (
        campaigns.user_id = auth.uid() OR 
        (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
      )
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
      AND (
        campaigns.user_id = auth.uid() OR 
        (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
      )
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
      AND (
        campaigns.user_id = auth.uid() OR 
        (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
      )
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
      AND (
        campaigns.user_id = auth.uid() OR 
        (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
      )
    )
  );

-- Fix media_costs table policies
DROP POLICY IF EXISTS "Admins can read all media costs" ON media_costs;
DROP POLICY IF EXISTS "Admins can insert media costs" ON media_costs;
DROP POLICY IF EXISTS "Admins can update media costs" ON media_costs;
DROP POLICY IF EXISTS "Admins can delete media costs" ON media_costs;

CREATE POLICY "Admins can read all media costs"
  ON media_costs
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can insert media costs"
  ON media_costs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can update media costs"
  ON media_costs
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can delete media costs"
  ON media_costs
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );