/*
  # Partner Campaign Access

  1. Changes
     - Add policies to allow partners to view, update, and create campaigns with their agency_id
     - Partners can only access campaigns that share their agency_id

  2. Security
     - Partners can only access campaigns in their own agency
     - Campaign data is isolated between different agencies
*/

-- Allow partners to view campaigns in their agency
CREATE POLICY "partners_view_own_agency_campaigns"
ON public.campaigns
FOR SELECT
TO authenticated
USING (
  (
    -- User is a partner
    (SELECT role FROM users WHERE id = auth.uid()) = 'partner'
    -- And their agency_id matches the campaign's agency_id
    AND (SELECT agency_id FROM users WHERE id = auth.uid()) = agency_id
    -- Only if their agency_id is not null
    AND (SELECT agency_id FROM users WHERE id = auth.uid()) IS NOT NULL
  )
);

-- Allow partners to create campaigns for their agency
CREATE POLICY "partners_create_own_agency_campaigns"
ON public.campaigns
FOR INSERT
TO authenticated
WITH CHECK (
  (
    -- User is a partner
    (SELECT role FROM users WHERE id = auth.uid()) = 'partner'
    -- And they're setting their own agency_id
    AND agency_id = (SELECT agency_id FROM users WHERE id = auth.uid())
    -- And their agency_id is not null
    AND (SELECT agency_id FROM users WHERE id = auth.uid()) IS NOT NULL
    -- And they're setting themselves as the user_id
    AND user_id = auth.uid()
  )
);

-- Allow partners to update campaigns in their agency
CREATE POLICY "partners_update_own_agency_campaigns"
ON public.campaigns
FOR UPDATE
TO authenticated
USING (
  (
    -- User is a partner
    (SELECT role FROM users WHERE id = auth.uid()) = 'partner'
    -- And their agency_id matches the campaign's agency_id
    AND (SELECT agency_id FROM users WHERE id = auth.uid()) = agency_id
    -- Only if their agency_id is not null
    AND (SELECT agency_id FROM users WHERE id = auth.uid()) IS NOT NULL
  )
)
WITH CHECK (
  -- Prevent changing agency_id to a different agency
  agency_id = (SELECT agency_id FROM users WHERE id = auth.uid())
);

-- Add corresponding policy for campaign_apartments table
-- Partners need access to campaign apartments for campaigns in their agency

-- View campaign_apartments for campaigns in their agency
CREATE POLICY "partners_view_own_agency_campaign_apartments"
ON public.campaign_apartments
FOR SELECT
TO authenticated
USING (
  (
    -- User is a partner
    (SELECT role FROM users WHERE id = auth.uid()) = 'partner'
    -- Campaign belongs to their agency
    AND EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND campaigns.agency_id = (SELECT agency_id FROM users WHERE id = auth.uid())
    )
    -- Only if their agency_id is not null
    AND (SELECT agency_id FROM users WHERE id = auth.uid()) IS NOT NULL
  )
);

-- Insert campaign_apartments for campaigns in their agency
CREATE POLICY "partners_create_own_agency_campaign_apartments"
ON public.campaign_apartments
FOR INSERT
TO authenticated
WITH CHECK (
  (
    -- User is a partner
    (SELECT role FROM users WHERE id = auth.uid()) = 'partner'
    -- Campaign belongs to their agency
    AND EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_id
      AND campaigns.agency_id = (SELECT agency_id FROM users WHERE id = auth.uid())
    )
    -- Only if their agency_id is not null
    AND (SELECT agency_id FROM users WHERE id = auth.uid()) IS NOT NULL
  )
);

-- Update campaign_apartments for campaigns in their agency
CREATE POLICY "partners_update_own_agency_campaign_apartments"
ON public.campaign_apartments
FOR UPDATE
TO authenticated
USING (
  (
    -- User is a partner
    (SELECT role FROM users WHERE id = auth.uid()) = 'partner'
    -- Campaign belongs to their agency
    AND EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND campaigns.agency_id = (SELECT agency_id FROM users WHERE id = auth.uid())
    )
    -- Only if their agency_id is not null
    AND (SELECT agency_id FROM users WHERE id = auth.uid()) IS NOT NULL
  )
);

-- Delete campaign_apartments for campaigns in their agency
CREATE POLICY "partners_delete_own_agency_campaign_apartments"
ON public.campaign_apartments
FOR DELETE
TO authenticated
USING (
  (
    -- User is a partner
    (SELECT role FROM users WHERE id = auth.uid()) = 'partner'
    -- Campaign belongs to their agency
    AND EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND campaigns.agency_id = (SELECT agency_id FROM users WHERE id = auth.uid())
    )
    -- Only if their agency_id is not null
    AND (SELECT agency_id FROM users WHERE id = auth.uid()) IS NOT NULL
  )
);