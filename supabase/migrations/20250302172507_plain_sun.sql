-- Create a migration to ensure campaign dates are stored as text
-- This fixes the "invalid input syntax for type date" error

-- Check if campaign_start_date and campaign_end_date are already text type
DO $$
DECLARE
  start_date_type text;
  end_date_type text;
BEGIN
  -- Get the current column types
  SELECT data_type INTO start_date_type
  FROM information_schema.columns
  WHERE table_name = 'campaigns' AND column_name = 'campaign_start_date';
  
  SELECT data_type INTO end_date_type
  FROM information_schema.columns
  WHERE table_name = 'campaigns' AND column_name = 'campaign_end_date';
  
  -- If they're not text type, convert them
  IF start_date_type != 'text' THEN
    -- First, create temporary columns with text type
    ALTER TABLE campaigns ADD COLUMN campaign_start_date_text TEXT;
    
    -- Copy data from date columns to text columns in YYYY-MM format
    UPDATE campaigns 
    SET campaign_start_date_text = to_char(campaign_start_date::date, 'YYYY-MM');
    
    -- Drop the original date column
    ALTER TABLE campaigns DROP COLUMN campaign_start_date;
    
    -- Rename the text column to the original column name
    ALTER TABLE campaigns RENAME COLUMN campaign_start_date_text TO campaign_start_date;
    
    -- Add NOT NULL constraint to campaign_start_date
    ALTER TABLE campaigns ALTER COLUMN campaign_start_date SET NOT NULL;
  END IF;
  
  IF end_date_type != 'text' THEN
    -- First, create temporary column with text type
    ALTER TABLE campaigns ADD COLUMN campaign_end_date_text TEXT;
    
    -- Copy data from date column to text column in YYYY-MM format
    UPDATE campaigns 
    SET campaign_end_date_text = CASE 
      WHEN campaign_end_date IS NOT NULL THEN to_char(campaign_end_date::date, 'YYYY-MM')
      ELSE NULL
    END;
    
    -- Drop the original date column
    ALTER TABLE campaigns DROP COLUMN campaign_end_date;
    
    -- Rename the text column to the original column name
    ALTER TABLE campaigns RENAME COLUMN campaign_end_date_text TO campaign_end_date;
  END IF;
END $$;