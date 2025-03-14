/*
  # Create campaign_apartments table

  1. New Tables
    - `campaign_apartments`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, references campaigns.id)
      - `apartment_key` (text)
      - `active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  2. Security
    - Enable RLS on `campaign_apartments` table
    - Add policy for authenticated users to read their own campaign apartments
    - Add policy for admins to read all campaign apartments
    - Add policy for users to update their own campaign apartments
    - Add policy for admins to update all campaign apartments
*/

CREATE TABLE IF NOT EXISTS campaign_apartments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  apartment_key text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE campaign_apartments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read campaign apartments for their campaigns
CREATE POLICY "Users can read own campaign apartments"
  ON campaign_apartments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND (campaigns.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM users
             WHERE users.id = auth.uid() AND users.role = 'admin'
           ))
    )
  );

-- Policy: Users can insert campaign apartments for their campaigns
CREATE POLICY "Users can insert own campaign apartments"
  ON campaign_apartments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND (campaigns.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM users
             WHERE users.id = auth.uid() AND users.role = 'admin'
           ))
    )
  );

-- Policy: Users can update campaign apartments for their campaigns
CREATE POLICY "Users can update own campaign apartments"
  ON campaign_apartments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND (campaigns.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM users
             WHERE users.id = auth.uid() AND users.role = 'admin'
           ))
    )
  );

-- Policy: Users can delete campaign apartments for their campaigns
CREATE POLICY "Users can delete own campaign apartments"
  ON campaign_apartments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_apartments.campaign_id
      AND (campaigns.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM users
             WHERE users.id = auth.uid() AND users.role = 'admin'
           ))
    )
  );