/*
  # Create media_costs table

  1. New Tables
    - `media_costs`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, references campaigns.id)
      - `channel` (text) - 'meta', 'display', or 'pdooh'
      - `spend` (numeric)
      - `date` (date)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  2. Security
    - Enable RLS on `media_costs` table
    - Add policy for admins to read all media costs
    - Add policy for admins to insert/update media costs
*/

CREATE TABLE IF NOT EXISTS media_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  channel text NOT NULL CHECK (channel IN ('meta', 'display', 'pdooh')),
  spend numeric NOT NULL DEFAULT 0,
  date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE media_costs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can read all media costs
CREATE POLICY "Admins can read all media costs"
  ON media_costs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Policy: Admins can insert media costs
CREATE POLICY "Admins can insert media costs"
  ON media_costs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Policy: Admins can update media costs
CREATE POLICY "Admins can update media costs"
  ON media_costs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Policy: Admins can delete media costs
CREATE POLICY "Admins can delete media costs"
  ON media_costs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );