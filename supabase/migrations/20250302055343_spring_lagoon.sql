/*
  # Fix infinite recursion in user policies

  1. Changes
    - Replace recursive policies with non-recursive alternatives
    - Fix user authentication and signup flow
    - Implement direct role checking without recursion
    - Add public access for user creation during signup
*/

-- First, drop all policies on users table that might be causing recursion
DROP POLICY IF EXISTS "users_read_own" ON users;
DROP POLICY IF EXISTS "users_admin_read_all" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_admin_update_any" ON users;
DROP POLICY IF EXISTS "users_admin_delete_any" ON users;
DROP POLICY IF EXISTS "anyone_can_insert_users" ON users;

-- Create a security definer function to safely check admin status
CREATE OR REPLACE FUNCTION check_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Direct query to avoid policy recursion
  RETURN EXISTS (
    SELECT 1 
    FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create simplified policies for users table
-- Allow users to read their own data
CREATE POLICY "users_read_own"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Allow admins to read all users using the security definer function
CREATE POLICY "admins_read_all_users"
  ON users
  FOR SELECT
  TO authenticated
  USING (check_is_admin());

-- Allow users to update their own data
CREATE POLICY "users_update_own"
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Allow admins to update any user
CREATE POLICY "admins_update_any_user"
  ON users
  FOR UPDATE
  TO authenticated
  USING (check_is_admin());

-- Allow admins to delete any user
CREATE POLICY "admins_delete_any_user"
  ON users
  FOR DELETE
  TO authenticated
  USING (check_is_admin());

-- Allow anyone to insert users (needed for signup)
CREATE POLICY "anyone_insert_users"
  ON users
  FOR INSERT
  WITH CHECK (true);

-- Fix activity_logs policies
DROP POLICY IF EXISTS "anyone_can_insert_activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "admins_can_read_activity_logs" ON activity_logs;

-- Allow all authenticated users to insert activity logs
CREATE POLICY "anyone_insert_activity_logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow admins to read all activity logs
CREATE POLICY "admins_read_all_activity_logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (check_is_admin());

-- Update campaigns table policies to use the safe function
DROP POLICY IF EXISTS "campaigns_read_own_or_admin" ON campaigns;
DROP POLICY IF EXISTS "campaigns_insert_own_or_admin" ON campaigns;
DROP POLICY IF EXISTS "campaigns_update_own_or_admin" ON campaigns;
DROP POLICY IF EXISTS "campaigns_delete_own_or_admin" ON campaigns;

CREATE POLICY "campaigns_read_own_or_admin"
  ON campaigns
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR check_is_admin());

CREATE POLICY "campaigns_insert_own_or_admin"
  ON campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR check_is_admin());

CREATE POLICY "campaigns_update_own_or_admin"
  ON campaigns
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR check_is_admin());

CREATE POLICY "campaigns_delete_own_or_admin"
  ON campaigns
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR check_is_admin());

-- Update campaign_apartments table policies
DROP POLICY IF EXISTS "campaign_apartments_read" ON campaign_apartments;
DROP POLICY IF EXISTS "campaign_apartments_insert" ON campaign_apartments;
DROP POLICY IF EXISTS "campaign_apartments_update" ON campaign_apartments;
DROP POLICY IF EXISTS "campaign_apartments_delete" ON campaign_apartments;

CREATE POLICY "campaign_apartments_read"
  ON campaign_apartments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND (campaigns.user_id = auth.uid() OR check_is_admin())
    )
  );

CREATE POLICY "campaign_apartments_insert"
  ON campaign_apartments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND (campaigns.user_id = auth.uid() OR check_is_admin())
    )
  );

CREATE POLICY "campaign_apartments_update"
  ON campaign_apartments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND (campaigns.user_id = auth.uid() OR check_is_admin())
    )
  );

CREATE POLICY "campaign_apartments_delete"
  ON campaign_apartments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND (campaigns.user_id = auth.uid() OR check_is_admin())
    )
  );

-- Update media_costs table policies
DROP POLICY IF EXISTS "media_costs_admin_read" ON media_costs;
DROP POLICY IF EXISTS "media_costs_admin_insert" ON media_costs;
DROP POLICY IF EXISTS "media_costs_admin_update" ON media_costs;
DROP POLICY IF EXISTS "media_costs_admin_delete" ON media_costs;

CREATE POLICY "media_costs_admin_read"
  ON media_costs
  FOR SELECT
  TO authenticated
  USING (check_is_admin());

CREATE POLICY "media_costs_admin_insert"
  ON media_costs
  FOR INSERT
  TO authenticated
  WITH CHECK (check_is_admin());

CREATE POLICY "media_costs_admin_update"
  ON media_costs
  FOR UPDATE
  TO authenticated
  USING (check_is_admin());

CREATE POLICY "media_costs_admin_delete"
  ON media_costs
  FOR DELETE
  TO authenticated
  USING (check_is_admin());