/*
  # Fix admin permissions

  This migration adds a new function to check if a user is an admin and updates
  the RLS policies to ensure admins have full access to all resources.
*/

-- Create a function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update users table policies to ensure admins have full access
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

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

-- Update campaigns table policies
DROP POLICY IF EXISTS "Users can read own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can insert own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON campaigns;

CREATE POLICY "Users can read own campaigns"
  ON campaigns
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert own campaigns"
  ON campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can update own campaigns"
  ON campaigns
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can delete own campaigns"
  ON campaigns
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- Update campaign_apartments table policies
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
      AND (campaigns.user_id = auth.uid() OR is_admin())
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
      AND (campaigns.user_id = auth.uid() OR is_admin())
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
      AND (campaigns.user_id = auth.uid() OR is_admin())
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
      AND (campaigns.user_id = auth.uid() OR is_admin())
    )
  );

-- Update activity_logs table policies
DROP POLICY IF EXISTS "Admins can read all activity logs" ON activity_logs;

CREATE POLICY "Admins can read all activity logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Update media_costs table policies
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