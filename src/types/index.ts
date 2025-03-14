export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'partner' | 'manager';
  agent_key: string;
  partner_name: string;
  agency_id: string;
  image_url?: string;
  created_at: string;
  last_login?: string;
}

export interface Apartment {
  key: string;
  address: string;
  postcode: string;
  city: string;
  images: Array<{url: string; type: string}>;
  agentEmail?: string;
  agencyEmail?: string;
  agentKey?: string;
  agency?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface Campaign {
  id: string;
  partner_id: string;
  partner_name: string;
  agent: string;
  agent_key: string;
  campaign_address: string;
  campaign_postal_code: string;
  campaign_city: string;
  campaign_radius: number;
  campaign_start_date: string; // Format: MM/yyyy
  campaign_end_date: string | null; // Format: MM/yyyy
  campaign_coordinates?: {
    lat: number;
    lng: number;
  };
  active: boolean;
  channel_meta: number;
  channel_display: number;
  channel_pdooh: number;
  budget_meta: number;
  budget_display: number;
  budget_pdooh: number;
  budget_meta_daily: number;
  budget_display_daily: number;
  budget_pdooh_daily: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  user_id: string;
  formatted_address?: string;
  // BidTheatre integration fields
  bt_campaign_id?: string;
  bt_sync_status?: 'synced' | 'pending' | 'failed';
  bt_last_sync?: string;
  bt_sync_error?: string;
  // Creatopy integration fields
  cr_ad_tags?: string;
  cr_template_id?: string;
  cr_last_updated?: string;
}

export interface CampaignApartment {
  id: string;
  campaign_id: string;
  apartment_key: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  details: string;
  created_at: string;
}

export interface MediaCost {
  id: string;
  campaign_id: string;
  channel: 'meta' | 'display' | 'pdooh';
  spend: number;
  date: string;
}

export interface AdCreative {
  id: string;
  campaign_id: string;
  apartment_key: string;
  target_id: string;
  name: string;
  size: string;
  hash: string;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
}