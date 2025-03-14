-- First, drop all existing policies and functions that might be causing issues
DO $$
BEGIN
  -- Drop all policies on users table
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON users CASCADE;', E'\n')
    FROM pg_policies
    WHERE tablename = 'users'
  );
  
  -- Drop all policies on activity_logs table
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON activity_logs CASCADE;', E'\n')
    FROM pg_policies
    WHERE tablename = 'activity_logs'
  );
  
  -- Drop all policies on campaigns table
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON campaigns CASCADE;', E'\n')
    FROM pg_policies
    WHERE tablename = 'campaigns'
  );
  
  -- Drop all policies on campaign_apartments table
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON campaign_apartments CASCADE;', E'\n')
    FROM pg_policies
    WHERE tablename = 'campaign_apartments'
  );
  
  -- Drop all policies on media_costs table
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON media_costs CASCADE;', E'\n')
    FROM pg_policies
    WHERE tablename = 'media_costs'
  );
  
  -- Drop any existing admin check functions
  DROP FUNCTION IF EXISTS is_admin() CASCADE;
  DROP FUNCTION IF EXISTS is_admin_safe() CASCADE;
END
$$;

-- Create a completely new approach for checking admin status
-- This function directly queries auth.users metadata to avoid recursion
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- First try to get the role from a direct query to users table
  -- without using any policies (using a security definer context)
  SELECT role INTO user_role FROM users WHERE id = auth.uid();
  RETURN user_role;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a simple function to check if current user is admin
CREATE OR REPLACE FUNCTION public.user_is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a simple function to check if current user owns a record or is admin
CREATE OR REPLACE FUNCTION public.user_owns_record_or_is_admin(record_user_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (record_user_id = auth.uid()) OR user_is_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policies for users table
-- Allow users to read their own data
CREATE POLICY "users_read_own"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Allow admins to read all users
CREATE POLICY "users_admin_read_all"
  ON users
  FOR SELECT
  TO authenticated
  USING (user_is_admin());

-- Allow users to update their own data
CREATE POLICY "users_update_own"
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Allow admins to update any user
CREATE POLICY "users_admin_update_any"
  ON users
  FOR UPDATE
  TO authenticated
  USING (user_is_admin());

-- Allow admins to delete any user
CREATE POLICY "users_admin_delete_any"
  ON users
  FOR DELETE
  TO authenticated
  USING (user_is_admin());

-- Allow anyone to insert users (needed for signup)
CREATE POLICY "users_insert"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create new policies for activity_logs table
-- Allow all authenticated users to insert activity logs
CREATE POLICY "activity_logs_insert"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow admins to read all activity logs
CREATE POLICY "activity_logs_admin_read_all"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (user_is_admin());

-- Create new policies for campaigns table
-- Allow users to read their own campaigns or if they're admin
CREATE POLICY "campaigns_read_own_or_admin"
  ON campaigns
  FOR SELECT
  TO authenticated
  USING (user_owns_record_or_is_admin(user_id));

-- Allow users to insert campaigns for themselves or if they're admin
CREATE POLICY "campaigns_insert_own_or_admin"
  ON campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (user_owns_record_or_is_admin(user_id));

-- Allow users to update their own campaigns or if they're admin
CREATE POLICY "campaigns_update_own_or_admin"
  ON campaigns
  FOR UPDATE
  TO authenticated
  USING (user_owns_record_or_is_admin(user_id));

-- Allow users to delete their own campaigns or if they're admin
CREATE POLICY "campaigns_delete_own_or_admin"
  ON campaigns
  FOR DELETE
  TO authenticated
  USING (user_owns_record_or_is_admin(user_id));

-- Create new policies for campaign_apartments table
-- Allow users to read campaign apartments for campaigns they own or if they're admin
CREATE POLICY "campaign_apartments_read"
  ON campaign_apartments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND user_owns_record_or_is_admin(campaigns.user_id)
    )
  );

-- Allow users to insert campaign apartments for campaigns they own or if they're admin
CREATE POLICY "campaign_apartments_insert"
  ON campaign_apartments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND user_owns_record_or_is_admin(campaigns.user_id)
    )
  );

-- Allow users to update campaign apartments for campaigns they own or if they're admin
CREATE POLICY "campaign_apartments_update"
  ON campaign_apartments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND user_owns_record_or_is_admin(campaigns.user_id)
    )
  );

-- Allow users to delete campaign apartments for campaigns they own or if they're admin
CREATE POLICY "campaign_apartments_delete"
  ON campaign_apartments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND user_owns_record_or_is_admin(campaigns.user_id)
    )
  );

-- Create new policies for media_costs table
-- Allow admins to read all media costs
CREATE POLICY "media_costs_admin_read"
  ON media_costs
  FOR SELECT
  TO authenticated
  USING (user_is_admin());

-- Allow admins to insert media costs
CREATE POLICY "media_costs_admin_insert"
  ON media_costs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_is_admin());

-- Allow admins to update media costs
CREATE POLICY "media_costs_admin_update"
  ON media_costs
  FOR UPDATE
  TO authenticated
  USING (user_is_admin());

-- Allow admins to delete media costs
CREATE POLICY "media_costs_admin_delete"
  ON media_costs
  FOR DELETE
  TO authenticated
  USING (user_is_admin());