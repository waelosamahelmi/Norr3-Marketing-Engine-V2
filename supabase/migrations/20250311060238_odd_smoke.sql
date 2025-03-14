/*
  # Update campaign_apartments RLS policies for managers

  1. Changes
     - Add policy for managers to select all campaign_apartments
     - Add policy for managers to insert campaign_apartments
     - Add policy for managers to update campaign_apartments
     - Add policy for managers to delete campaign_apartments
  
  2. Security
     - Enable managers to manage all campaign apartments (same as admins)
     - These policies allow managers to have the same level of access to campaign apartments as admins
*/

-- Add policies for managers to manage all campaign apartments
CREATE POLICY "managers_select_all_campaign_apartments"
  ON public.campaign_apartments
  FOR SELECT
  TO authenticated
  USING (
    ( SELECT users.role
      FROM users
      WHERE (users.id = auth.uid())
    ) = 'manager'
  );

CREATE POLICY "managers_insert_campaign_apartments"
  ON public.campaign_apartments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ( SELECT users.role
      FROM users
      WHERE (users.id = auth.uid())
    ) = 'manager'
  );

CREATE POLICY "managers_update_campaign_apartments"
  ON public.campaign_apartments
  FOR UPDATE
  TO authenticated
  USING (
    ( SELECT users.role
      FROM users
      WHERE (users.id = auth.uid())
    ) = 'manager'
  )
  WITH CHECK (
    ( SELECT users.role
      FROM users
      WHERE (users.id = auth.uid())
    ) = 'manager'
  );

CREATE POLICY "managers_delete_campaign_apartments"
  ON public.campaign_apartments
  FOR DELETE
  TO authenticated
  USING (
    ( SELECT users.role
      FROM users
      WHERE (users.id = auth.uid())
    ) = 'manager'
  );