-- Add campaign_coordinates column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'campaign_coordinates'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN campaign_coordinates JSONB;
  END IF;
END $$;

-- Add formatted_address column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'formatted_address'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN formatted_address TEXT;
  END IF;
END $$;

-- Update existing campaigns to have default coordinates if needed
UPDATE campaigns
SET campaign_coordinates = '{"lat": 0, "lng": 0}'
WHERE campaign_coordinates IS NULL;