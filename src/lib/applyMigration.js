import { supabase } from './supabase';

// Function to apply the migration manually
export const applyMigration = async () => {
  try {
    // Read the migration file content
    const migrationSQL = `
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
    `;

    // Execute the SQL directly using Supabase's rpc function
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('Error applying migration:', error);
      return { success: false, error };
    }
    
    console.log('Migration applied successfully');
    return { success: true };
  } catch (error) {
    console.error('Error in applyMigration function:', error);
    return { success: false, error };
  }
};