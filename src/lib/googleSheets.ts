import axios from 'axios';
import { Campaign, CampaignApartment, Apartment } from '../types';

// Google Sheets API endpoint
const SHEETS_API_ENDPOINT = 'https://sheets.googleapis.com/v4/spreadsheets';
const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = import.meta.env.VITE_GOOGLE_REFRESH_TOKEN;

// Function to get a new access token using the refresh token
async function getAccessToken() {
  try {
    // Check if all required credentials are present
    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
      console.debug('Google Sheets sync disabled - missing credentials');
      return null;
    }

    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    if (!response.data.access_token) {
      console.warn('No access token received from Google OAuth');
      return null;
    }
    
    return response.data.access_token;
  } catch (error) {
    // Handle specific error cases
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        console.debug('Google Sheets sync disabled - invalid or expired credentials');
      } else {
        console.error('Error refreshing Google access token:', error.message);
      }
    } else {
      console.error('Unexpected error getting access token:', error);
    }
    return null;
  }
}

// Function to find existing campaign rows in the sheet
export async function findCampaignRows(campaignId: string) {
  try {
    const accessToken = await getAccessToken();
    
    // If no access token, cannot proceed
    if (!accessToken) {
      console.debug('Google Sheets sync skipped - no access token');
      return [];
    }
    
    // Get all values from the sheet
    const response = await axios.get(
      `${SHEETS_API_ENDPOINT}/${SHEET_ID}/values/LIVE!A:W`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    const rows = response.data.values || [];
    const campaignRows = [];
    
    // Find rows with matching campaign ID (assuming campaign ID is in column A)
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][0] === campaignId) {
        campaignRows.push({
          rowIndex: i + 1, // 1-based index for the API
          data: rows[i],
        });
      }
    }
    
    return campaignRows;
  } catch (error) {
    console.error('Error finding campaign rows:', error);
    return [];
  }
}

// Function to add campaign data to Google Sheet
export async function addCampaignToSheet(
  campaign: Campaign, 
  campaignApartments: CampaignApartment[],
  apartments: Apartment[]
) {
  try {
    const accessToken = await getAccessToken();
    
    // If no access token, cannot proceed but don't cause campaign creation to fail
    if (!accessToken) {
      console.debug('Google Sheets sync skipped - no access token');
      return true; // Return true to indicate the campaign was created successfully even if sheet sync failed
    }
    
    // Prepare rows for each apartment in the campaign
    const rows = campaignApartments.map(ca => {
      const apt = apartments.find(a => a.key === ca.apartment_key);
      
      // Ensure all values are strings or numbers to prevent serialization issues
      return [
        campaign.id, // campaign_id
        campaign.partner_id, // partner_id
        campaign.partner_name, // partner_name
        campaign.agency_id, // agency_id
        campaign.agent_key, // agent_key
        ca.apartment_key, // key
        `https://www.kiinteistomaailma.fi/${ca.apartment_key}`, // url - always include the URL
        campaign.campaign_address, // campaign_address
        campaign.campaign_postal_code, // campaign_postal_code
        campaign.campaign_city, // campaign_city
        campaign.campaign_radius.toString(), // campaign_radius
        campaign.channel_meta ? 'Yes' : 'No', // channel_meta
        campaign.channel_display ? 'Yes' : 'No', // channel_display
        campaign.channel_pdooh ? 'Yes' : 'No', // channel_pdooh
        campaign.budget_meta.toString(), // budget_meta
        campaign.budget_meta_daily.toString(), // budget_meta_daily
        campaign.budget_display.toString(), // budget_display
        campaign.budget_display_daily.toString(), // budget_display_daily
        campaign.budget_pdooh.toString(), // budget_pdooh
        campaign.budget_pdooh_daily.toString(), // budget_pdooh_daily
        campaign.campaign_start_date, // campaign_start_date
        campaign.campaign_end_date || 'Ongoing', // campaign_end_date
        campaign.active ? 'Active' : 'Paused', // active
      ];
    });
    
    if (rows.length === 0) {
      console.debug('No apartment rows to add to sheet for campaign:', campaign.id);
      return true; // Still return true even if there are no rows to add
    }
    
    // Append rows to the sheet
    await axios.post(
      `${SHEETS_API_ENDPOINT}/${SHEET_ID}/values/LIVE!A:W:append?valueInputOption=USER_ENTERED`,
      {
        values: rows,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log(`Successfully added ${rows.length} rows to Google Sheet for campaign ${campaign.id}`);
    return true;
  } catch (error) {
    console.error('Error adding campaign to sheet:', error instanceof Error ? error.message : 'Unknown error');
    // Don't throw, just return false to indicate failure
    return false;
  }
}

// Function to update campaign data in Google Sheet
export async function updateCampaignInSheet(
  campaign: Campaign, 
  campaignApartments: CampaignApartment[],
  apartments: Apartment[]
) {
  try {
    // First, find existing rows for this campaign
    const existingRows = await findCampaignRows(campaign.id);
    
    // If rows exist, delete them
    if (existingRows.length > 0) {
      await deleteCampaignFromSheet(campaign.id);
    }
    
    // Then add the updated campaign data
    return await addCampaignToSheet(campaign, campaignApartments, apartments);
  } catch (error) {
    console.error('Error updating campaign in sheet:', error);
    // Don't throw, just return false to indicate failure
    return false;
  }
}

// Function to delete campaign data from Google Sheet
export async function deleteCampaignFromSheet(campaignId: string) {
  try {
    const accessToken = await getAccessToken();
    
    // If no access token, cannot proceed
    if (!accessToken) {
      console.debug('Google Sheets sync skipped - no access token');
      return true; // Return true because the campaign was successfully deleted from the database
    }
    
    // Find existing rows for this campaign
    const existingRows = await findCampaignRows(campaignId);
    
    if (existingRows.length === 0) {
      return true; // Nothing to delete, return success
    }
    
    // Sort row indices in descending order to avoid shifting issues when deleting
    const rowIndices = existingRows.map(row => row.rowIndex).sort((a, b) => b - a);
    
    // Delete each row individually, starting from the bottom
    for (const rowIndex of rowIndices) {
      await axios.post(
        `${SHEETS_API_ENDPOINT}/${SHEET_ID}:batchUpdate`,
        {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: 0, // Assuming LIVE has ID 0
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1, // 0-based index for the API
                  endIndex: rowIndex, // exclusive end index
                },
              },
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting campaign from sheet:', error);
    // Don't throw, just return false to indicate failure
    return false;
  }
}

// Function to update campaign status in Google Sheet
export async function updateCampaignStatusInSheet(campaignId: string, active: boolean) {
  try {
    const accessToken = await getAccessToken();
    
    // If no access token, cannot proceed
    if (!accessToken) {
      console.debug('Google Sheets sync skipped - no access token');
      return true; // Return true because the campaign status was updated successfully in the database
    }
    
    // Find existing rows for this campaign
    const existingRows = await findCampaignRows(campaignId);
    
    if (existingRows.length === 0) {
      return false; // No rows to update
    }
    
    // Update the status column (column W, index 22) for each row
    const status = active ? 'Active' : 'Paused';
    
    for (const row of existingRows) {
      await axios.put(
        `${SHEETS_API_ENDPOINT}/${SHEET_ID}/values/LIVE!W${row.rowIndex}?valueInputOption=USER_ENTERED`,
        {
          values: [[status]],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    return true;
  } catch (error) {
    console.error('Error updating campaign status in sheet:', error);
    // Don't throw, just return false to indicate failure
    return false;
  }
}

// Function to check for deleted apartments and update campaigns
export async function checkForDeletedApartments(
  campaigns: Campaign[],
  campaignApartments: CampaignApartment[],
  apartments: Apartment[]
) {
  try {
    // Create a set of all apartment keys from the feed
    const availableApartmentKeys = new Set(apartments.map(apt => apt.key));
    
    // Find campaign apartments that no longer exist in the feed
    const deletedApartments = campaignApartments.filter(
      ca => !availableApartmentKeys.has(ca.apartment_key)
    );
    
    if (deletedApartments.length === 0) {
      return []; // No deleted apartments
    }
    
    // Group deleted apartments by campaign ID
    const campaignMap = new Map<string, CampaignApartment[]>();
    
    for (const ca of deletedApartments) {
      if (!campaignMap.has(ca.campaign_id)) {
        campaignMap.set(ca.campaign_id, []);
      }
      campaignMap.get(ca.campaign_id)?.push(ca);
    }
    
    // Return the list of affected campaigns and their deleted apartments
    return Array.from(campaignMap.entries()).map(([campaignId, deletedApts]) => {
      const campaign = campaigns.find(c => c.id === campaignId);
      return {
        campaign,
        deletedApartments: deletedApts,
      };
    });
  } catch (error) {
    console.error('Error checking for deleted apartments:', error);
    // Return empty array instead of throwing
    return [];
  }
}