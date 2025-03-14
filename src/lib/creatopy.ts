import axios from 'axios';
import { Campaign } from '../types';

const CREATOPY_API_KEY = import.meta.env.VITE_CREATOPY_API_KEY;
const CREATOPY_API_URL = import.meta.env.VITE_CREATOPY_API_URL || 'https://api.creatopy.com/v1';

// Set up axios instance for Creatopy API
const creatopyApi = axios.create({
  baseURL: CREATOPY_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CREATOPY_API_KEY}`
  }
});

// Interface for Creatopy templates
export interface CreatopyTemplate {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  thumbnail: string;
}

// Interface for Creatopy banners
export interface CreatopyBanner {
  id: string;
  name: string;
  templateId: string;
  url: string;
  thumbnailUrl: string;
  htmlTag: string;
  width: number;
  height: number;
}

// Get available templates for Display or PDOOH ads
export const getCreatopyTemplates = async (): Promise<{
  success: boolean;
  templates?: CreatopyTemplate[];
  error?: string;
}> => {
  try {
    if (!CREATOPY_API_KEY) {
      console.error('Creatopy API key is not configured');
      return { success: false, error: 'Creatopy API key is not configured' };
    }

    // Get templates with filters for real estate ads
    const response = await creatopyApi.get('/templates', {
      params: {
        category: 'real_estate',
        limit: 10
      }
    });

    if (response.data && Array.isArray(response.data.data)) {
      return {
        success: true,
        templates: response.data.data.map((template: any) => ({
          id: template.id,
          name: template.name,
          type: template.type,
          width: template.width,
          height: template.height,
          thumbnail: template.thumbnail
        }))
      };
    } else {
      return {
        success: false,
        error: 'Failed to get Creatopy templates: Invalid response format'
      };
    }
  } catch (error) {
    console.error('Error getting Creatopy templates:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to get Creatopy templates: ${errorMessage}`
    };
  }
};

// Generate a banner for a campaign using a template
export const generateCreatopyBanner = async (
  campaign: Campaign,
  templateId: string,
  customText?: {
    headline?: string;
    description?: string;
    callToAction?: string;
  }
): Promise<{
  success: boolean;
  banner?: CreatopyBanner;
  error?: string;
}> => {
  try {
    if (!CREATOPY_API_KEY) {
      console.error('Creatopy API key is not configured');
      return { success: false, error: 'Creatopy API key is not configured' };
    }

    // Prepare data for the banner creation
    const bannerData = {
      templateId,
      name: `${campaign.partner_name} - ${campaign.campaign_address.substring(0, 20)}`,
      customProperties: {
        headline: customText?.headline || `${campaign.partner_name} Properties`,
        description: customText?.description || `Real estate in ${campaign.campaign_city}`,
        callToAction: customText?.callToAction || 'View Properties',
        address: campaign.formatted_address || `${campaign.campaign_address}, ${campaign.campaign_postal_code} ${campaign.campaign_city}`
      }
    };

    // Make API call to create banner
    const response = await creatopyApi.post('/banners', bannerData);

    if (response.data && response.data.id) {
      return {
        success: true,
        banner: {
          id: response.data.id,
          name: response.data.name,
          templateId: response.data.templateId,
          url: response.data.url,
          thumbnailUrl: response.data.thumbnailUrl,
          htmlTag: response.data.htmlTag,
          width: response.data.width,
          height: response.data.height
        }
      };
    } else {
      return {
        success: false,
        error: 'Failed to create Creatopy banner: Invalid response format'
      };
    }
  } catch (error) {
    console.error('Error creating Creatopy banner:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to create Creatopy banner: ${errorMessage}`
    };
  }
};

// Generate an ad tag that can be used in BidTheatre
export const generateAdTag = async (
  campaign: Campaign,
  channelType: 'display' | 'pdooh'
): Promise<{
  success: boolean;
  adTag?: string;
  error?: string;
}> => {
  try {
    if (!CREATOPY_API_KEY) {
      // If no Creatopy API key, return a sample ad tag for testing
      return {
        success: true,
        adTag: `<script src="https://cdn.creatopy.com/ad-tag/sample-${channelType}-${campaign.id.substring(0, 8)}.js"></script>`
      };
    }

    // Get templates
    const templatesResult = await getCreatopyTemplates();
    if (!templatesResult.success || !templatesResult.templates || templatesResult.templates.length === 0) {
      return {
        success: false,
        error: templatesResult.error || 'No templates available'
      };
    }

    // Select a template based on channel type
    let selectedTemplate: CreatopyTemplate;
    if (channelType === 'display') {
      // For display, prefer standard banner sizes (300x250, 728x90, etc.)
      selectedTemplate = templatesResult.templates.find(t => t.width === 300 && t.height === 250) || 
                         templatesResult.templates[0];
    } else {
      // For PDOOH, prefer larger formats
      selectedTemplate = templatesResult.templates.find(t => t.width === 1080 && t.height === 1920) || 
                         templatesResult.templates[0];
    }

    // Generate banner using the selected template
    const bannerResult = await generateCreatopyBanner(campaign, selectedTemplate.id, {
      headline: `${campaign.partner_name} Real Estate`,
      description: `Properties in ${campaign.campaign_city}`,
      callToAction: 'View Properties'
    });

    if (!bannerResult.success || !bannerResult.banner) {
      return {
        success: false,
        error: bannerResult.error || 'Failed to generate banner'
      };
    }

    return {
      success: true,
      adTag: bannerResult.banner.htmlTag
    };
  } catch (error) {
    console.error('Error generating ad tag:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to generate ad tag: ${errorMessage}`
    };
  }
};