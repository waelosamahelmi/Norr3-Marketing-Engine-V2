/*
  # Add Ad Creatives Table

  1. New Tables
    - `ad_creatives`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, references campaigns)
      - `apartment_key` (text)
      - `target_id` (text)
      - `name` (text)
      - `size` (text)
      - `hash` (text)
      - `width` (integer)
      - `height` (integer)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for admins and managers
*/

CREATE TABLE IF NOT EXISTS ad_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  apartment_key text NOT NULL,
  target_id text NOT NULL,
  name text NOT NULL,
  size text NOT NULL,
  hash text NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admins_manage_ad_creatives"
ON ad_creatives
FOR ALL
TO authenticated
USING (check_is_admin())
WITH CHECK (check_is_admin());

-- Managers can view all creatives
CREATE POLICY "managers_view_ad_creatives"
ON ad_creatives
FOR SELECT
TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'manager');

-- Partners can view their own creatives
CREATE POLICY "partners_view_own_creatives"
ON ad_creatives
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = ad_creatives.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);