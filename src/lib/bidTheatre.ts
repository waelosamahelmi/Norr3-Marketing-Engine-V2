import axios from 'axios';
import { Campaign } from '../types';
import { generateAdTag } from './creatopy';

// Environment variables
const BT_API_URL = import.meta.env.VITE_BIDTHEATRE_API_URL || 'https://asx-api.bidtheatre.com/v2.0/api';
const BT_NETWORK_ID = import.meta.env.VITE_BIDTHEATRE_NETWORK_ID || '716'; // Default to 716 from auth response
const BT_API_KEY = import.meta.env.VITE_BIDTHEATRE_API_KEY;
const BT_DISPLAY_MEDIA_LIST_ID = import.meta.env.VITE_BIDTHEATRE_DISPLAY_MEDIA_LIST_ID;
const BT_DOOH_MEDIA_LIST_ID = import.meta.env.VITE_BIDTHEATRE_DOOH_MEDIA_LIST_ID;

// BidTheatre credentials (consider moving to env vars in production)
const BT_USERNAME = 'wael@helmies.fi';
const BT_PASSWORD = 'Weezy@1996';

// Function to authenticate and get token
async function getBidTheatreToken() {
  try {
    console.log('Attempting BidTheatre authentication...');

    const response = await axios.post(
      `${BT_API_URL}/auth`,
      {
        username: BT_USERNAME,
        password: BT_PASSWORD,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    console.log('Auth response:', response.data);

    // Extract token from auth object
    const token = response.data.auth?.token;
    if (!token) {
      throw new Error('No token received from BidTheatre auth');
    }

    return token;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('BidTheatre auth error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    } else {
      console.error('BidTheatre auth error:', error);
    }
    throw error;
  }
}

// Set up axios instance for BidTheatre API
const bidTheatreApi = axios.create({
  baseURL: BT_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interface for BidTheatre campaign
export interface BidTheatreCampaign {
  id?: string;
  name: string;
  startDate: string; // ISO date format YYYY-MM-DD
  endDate?: string; // ISO date format YYYY-MM-DD
  budget: number;
  dailyBudget: number;
  mediaListId: string;
  geoTargeting?: {
    latitude: number;
    longitude: number;
    radius: number; // In meters
  };
  cpm?: number;
  adTagUrl?: string;
  status?: 'active' | 'paused' | 'ended';
  frequencyCapping?: {
    impressions: number;
    timeWindow: string; // e.g., "day", "week", "month"
  };
  targeting?: Record<string, any>;
}

// Create a campaign in BidTheatre
export const createBidTheatreCampaign = async (
  campaign: Campaign
): Promise<{ success: boolean; btCampaignId?: string; error?: string }> => {
  try {
    if (!BT_API_URL || !BT_NETWORK_ID) {
      console.error('BidTheatre API credentials are not configured');
      return { success: false, error: 'BidTheatre API credentials are not configured' };
    }

    // Determine media list ID and channel type
    let mediaListId = '';
    let channelType: 'display' | 'pdooh';

    if (campaign.channel_pdooh === 1) {
      mediaListId = BT_DOOH_MEDIA_LIST_ID;
      channelType = 'pdooh';
    } else if (campaign.channel_display === 1) {
      mediaListId = BT_DISPLAY_MEDIA_LIST_ID;
      channelType = 'display';
    } else {
      return { success: false, error: 'Campaign does not have Display or PDOOH channels enabled' };
    }

    // Parse dates - convert MM/YYYY to YYYY-MM-DD
    const startParts = campaign.campaign_start_date.split('/');
    if (startParts.length < 2) {
      return { success: false, error: 'Invalid start date format' };
    }
    const startMonth = startParts[0].padStart(2, '0');
    const startYear = startParts.length > 1 ? startParts[1] : new Date().getFullYear().toString();
    const startDate = `${startYear}-${startMonth}-01`;

    let endDate: string | undefined;
    if (campaign.campaign_end_date) {
      const endParts = campaign.campaign_end_date.split('/');
      if (endParts.length < 2) {
        return { success: false, error: 'Invalid end date format' };
      }
      const endMonth = endParts[0].padStart(2, '0');
      const endYear = endParts.length > 1 ? endParts[1] : new Date().getFullYear().toString();
      const lastDay = new Date(parseInt(endYear), parseInt(endMonth), 0).getDate();
      endDate = `${endYear}-${endMonth}-${lastDay}`;
    }

    // Calculate budget
    const budget = campaign.channel_pdooh === 1 ? campaign.budget_pdooh : campaign.budget_display;
    const dailyBudget = campaign.channel_pdooh === 1
      ? campaign.budget_pdooh_daily
      : campaign.budget_display_daily;

    // Generate ad tag
    const adTagResult = await generateAdTag(campaign, channelType);
    const adTag = adTagResult.success ? adTagResult.adTag : undefined;

    // Prepare campaign data
    const btCampaign: BidTheatreCampaign = {
      name: `${campaign.partner_name} - ${campaign.campaign_address.substring(0, 30)}`,
      startDate,
      endDate,
      budget,
      dailyBudget,
      mediaListId,
      status: campaign.active ? 'active' : 'paused',
      adTagUrl: adTag,
    };

    if (
      campaign.campaign_coordinates &&
      campaign.campaign_coordinates.lat !== 0 &&
      campaign.campaign_coordinates.lng !== 0
    ) {
      btCampaign.geoTargeting = {
        latitude: campaign.campaign_coordinates.lat,
        longitude: campaign.campaign_coordinates.lng,
        radius: campaign.campaign_radius,
      };
    }

    console.log('BidTheatre request payload:', btCampaign);

    // Get token and make request
    const token = await getBidTheatreToken();
    const response = await bidTheatreApi.post(`/${BT_NETWORK_ID}/campaign`, btCampaign, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('BidTheatre create response:', response.data);

    if (!response.data || typeof response.data.id !== 'string') {
      return {
        success: false,
        error: 'Invalid response format from BidTheatre - no campaign ID returned',
      };
    }

    return {
      success: true,
      btCampaignId: response.data.id,
    };
  } catch (error) {
    console.error('Error creating BidTheatre campaign:', error);

    if (axios.isAxiosError(error)) {
      const errorData = {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      };
      console.error('Axios error details:', errorData);
      return {
        success: false,
        error: JSON.stringify(errorData),
      };
    }

    const errorData = {
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    return {
      success: false,
      error: JSON.stringify(errorData),
    };
  }
};

// Update a campaign in BidTheatre
export const updateBidTheatreCampaign = async (
  campaign: Campaign,
  btCampaignId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!btCampaignId) {
      return { success: false, error: 'No BidTheatre campaign ID provided' };
    }

    const budget = campaign.channel_pdooh === 1 ? campaign.budget_pdooh : campaign.budget_display;
    const dailyBudget = campaign.channel_pdooh === 1
      ? campaign.budget_pdooh_daily
      : campaign.budget_display_daily;

    const startParts = campaign.campaign_start_date.split('/');
    const startMonth = startParts[0].padStart(2, '0');
    const startYear = startParts.length > 1 ? startParts[1] : new Date().getFullYear().toString();
    const startDate = `${startYear}-${startMonth}-01`;

    let endDate: string | undefined;
    if (campaign.campaign_end_date) {
      const endParts = campaign.campaign_end_date.split('/');
      const endMonth = endParts[0].padStart(2, '0');
      const endYear = endParts.length > 1 ? endParts[1] : new Date().getFullYear().toString();
      const lastDay = new Date(parseInt(endYear), parseInt(endMonth), 0).getDate();
      endDate = `${endYear}-${endMonth}-${lastDay}`;
    }

    const channelType: 'display' | 'pdooh' = campaign.channel_pdooh === 1 ? 'pdooh' : 'display';
    let adTagUrl;
    if (!campaign.cr_ad_tags || !campaign.cr_last_updated) {
      const adTagResult = await generateAdTag(campaign, channelType);
      adTagUrl = adTagResult.success ? adTagResult.adTag : undefined;
    }

    const updateData: Partial<BidTheatreCampaign> = {
      name: `${campaign.partner_name} - ${campaign.campaign_address.substring(0, 30)}`,
      startDate,
      endDate,
      budget,
      dailyBudget,
      status: campaign.active ? 'active' : 'paused',
    };

    if (adTagUrl) {
      updateData.adTagUrl = adTagUrl;
    }

    if (
      campaign.campaign_coordinates &&
      campaign.campaign_coordinates.lat !== 0 &&
      campaign.campaign_coordinates.lng !== 0
    ) {
      updateData.geoTargeting = {
        latitude: campaign.campaign_coordinates.lat,
        longitude: campaign.campaign_coordinates.lng,
        radius: campaign.campaign_radius,
      };
    }

    console.log('BidTheatre update request payload:', updateData);

    const token = await getBidTheatreToken();
    const response = await bidTheatreApi.put(`/${BT_NETWORK_ID}/campaign/${btCampaignId}`, updateData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('BidTheatre update response:', response.data);

    if (response.status >= 200 && response.status < 300) {
      return { success: true };
    } else {
      return {
        success: false,
        error: `Failed to update BidTheatre campaign: Unexpected response status ${response.status}`,
      };
    }
  } catch (error) {
    console.error('Error updating BidTheatre campaign:', error);

    if (axios.isAxiosError(error)) {
      const errorData = {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      };
      console.error('Axios error details:', errorData);
      return {
        success: false,
        error: JSON.stringify(errorData),
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to update BidTheatre campaign: ${errorMessage}`,
    };
  }
};

// Get campaign details from BidTheatre
export const getBidTheatreCampaign = async (
  btCampaignId: string
): Promise<{ success: boolean; campaign?: BidTheatreCampaign; error?: string }> => {
  try {
    if (!btCampaignId) {
      return { success: false, error: 'No BidTheatre campaign ID provided' };
    }

    const token = await getBidTheatreToken();
    const response = await bidTheatreApi.get(`/${BT_NETWORK_ID}/campaign/${btCampaignId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('BidTheatre get campaign response:', response.data);

    if (!response.data) {
      return {
        success: false,
        error: 'Failed to get BidTheatre campaign: Empty response',
      };
    }

    return {
      success: true,
      campaign: response.data,
    };
  } catch (error) {
    console.error('Error getting BidTheatre campaign:', error);

    if (axios.isAxiosError(error)) {
      const errorData = {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      };
      console.error('Axios error details:', errorData);
      return {
        success: false,
        error: JSON.stringify(errorData),
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to get BidTheatre campaign: ${errorMessage}`,
    };
  }
};