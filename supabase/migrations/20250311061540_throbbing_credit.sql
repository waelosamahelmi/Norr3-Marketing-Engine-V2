/*
  # Manager Policies for Campaign Apartments

  1. Changes
     - Add conditional policy creation for managers to access campaign apartments
     - Only create policies if they don't already exist

  2. Security
     - Managers will have full access to all campaign apartments
     - Policies are created only if they don't already exist
*/

-- Create managers_select_all_campaign_apartments policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'campaign_apartments' 
    AND policyname = 'managers_select_all_campaign_apartments'
  ) THEN
    CREATE POLICY "managers_select_all_campaign_apartments"
    ON public.campaign_apartments
    FOR SELECT
    TO authenticated
    USING (
      (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
    );
  END IF;
END
$$;

-- Create managers_insert_campaign_apartments policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'campaign_apartments' 
    AND policyname = 'managers_insert_campaign_apartments'
  ) THEN
    CREATE POLICY "managers_insert_campaign_apartments"
    ON public.campaign_apartments
    FOR INSERT
    TO authenticated
    WITH CHECK (
      (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
    );
  END IF;
END
$$;

-- Create managers_update_campaign_apartments policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'campaign_apartments' 
    AND policyname = 'managers_update_campaign_apartments'
  ) THEN
    CREATE POLICY "managers_update_campaign_apartments"
    ON public.campaign_apartments
    FOR UPDATE
    TO authenticated
    USING (
      (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
    )
    WITH CHECK (
      (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
    );
  END IF;
END
$$;

-- Create managers_delete_campaign_apartments policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'campaign_apartments' 
    AND policyname = 'managers_delete_campaign_apartments'
  ) THEN
    CREATE POLICY "managers_delete_campaign_apartments"
    ON public.campaign_apartments
    FOR DELETE
    TO authenticated
    USING (
      (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
    );
  END IF;
END
$$;