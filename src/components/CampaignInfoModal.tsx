import { useState } from 'react';
import { Campaign, CampaignApartment, Apartment } from '../types';
import { X, ExternalLink, MapPin, RefreshCw, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useEffect, useRef } from 'react';
import { initializeMap, addMarker, addRadiusCircle } from '../lib/maps';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { getBidTheatreCampaign } from '../lib/bidTheatre';

interface CampaignInfoModalProps {
  campaign: Campaign;
  onClose: () => void;
  apartments: Apartment[];
  campaignApartments: CampaignApartment[];
  onApartmentsUpdate?: (updatedApartments: Apartment[]) => void;
}

const CampaignInfoModal = ({ 
  campaign, 
  onClose, 
  apartments, 
  campaignApartments,
  onApartmentsUpdate
}: CampaignInfoModalProps) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [agencyName, setAgencyName] = useState<string>(campaign.agent);
  const [apartmentData, setApartmentData] = useState<Record<string, any>>({});
  const [soldApartments, setSoldApartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [bidTheatreDetails, setBidTheatreDetails] = useState<any>(null);
  const [loadingBidTheatreDetails, setLoadingBidTheatreDetails] = useState(false);

  // Check if BidTheatre API is configured
  const isBidTheatreConfigured = !!import.meta.env.VITE_BIDTHEATRE_API_URL &&
                                 !!import.meta.env.VITE_BIDTHEATRE_NETWORK_ID;

  // Check if Creatopy API is configured                               
  const isCreatopyConfigured = !!import.meta.env.VITE_CREATOPY_API_KEY;

  // Function to fetch all apartment data and check availability
  const fetchApartmentData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/apartments');
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format');
      }
      
      // Create a map of available apartments
      const availableApts = new Map(data.map((apt: any) => [apt.key.toString(), apt]));
      
      // Check which campaign apartments are no longer in the feed (sold/removed)
      const soldKeys = campaignApartments
        .map(ca => ca.apartment_key)
        .filter(key => !availableApts.has(key.toString()));
      
      setSoldApartments(soldKeys);
      
      // Update apartment data for all campaign apartments
      const newApartmentData: Record<string, any> = {};
      campaignApartments.forEach(ca => {
        const apt = availableApts.get(ca.apartment_key.toString());
        if (apt) {
          newApartmentData[ca.apartment_key] = {
            address: apt.address || '',
            postcode: apt.postcode || '',
            city: apt.city || '',
            images: apt.images || [],
            agentEmail: apt.agent?.email?.toLowerCase().trim() || '',
            agencyEmail: apt.agencyEmail || '',
            agency: apt.agency || '',
            available: true,
            coordinates: {
              lat: apt.latitude || 0,
              lng: apt.longitude || 0
            }
          };
        } else {
          // Apartment is sold/removed
          newApartmentData[ca.apartment_key] = {
            address: 'Apartment no longer available',
            postcode: '',
            city: '',
            images: [],
            available: false
          };
        }
      });
      
      setApartmentData(newApartmentData);
      
      // If any apartments are sold, pause the campaign
      if (soldKeys.length > 0) {
        await pauseCampaign();
      }
    } catch (error) {
      console.error('Error fetching apartment data:', error);
      toast.error('Failed to sync apartment data');
    } finally {
      setLoading(false);
    }
  };

  // Function to pause campaign when apartments are sold
  const pauseCampaign = async () => {
    try {
      setUpdatingStatus(true);
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }
      
      // Update campaign status
      const { error } = await supabase
        .from('campaigns')
        .update({ 
          active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaign.id);
      
      if (error) {
        throw error;
      }
      
      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: session.user.id,
        user_email: session.user.email,
        action: 'pause_campaign',
        details: `Campaign ${campaign.id} paused - apartments no longer available: ${soldApartments.join(', ')}`
      });
      
      toast.warning(`Campaign paused - ${soldApartments.length} apartment(s) no longer available`);
    } catch (error) {
      console.error('Error pausing campaign:', error);
      toast.error('Failed to pause campaign');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Function to fetch BidTheatre campaign details
  const fetchBidTheatreDetails = async () => {
    if (campaign.bt_campaign_id && isBidTheatreConfigured) {
      try {
        setLoadingBidTheatreDetails(true);
        const result = await getBidTheatreCampaign(campaign.bt_campaign_id);
        
        if (result.success && result.campaign) {
          console.log('Successfully fetched BidTheatre campaign details:', result.campaign);
          setBidTheatreDetails(result.campaign);
        } else {
          console.error('Error fetching BidTheatre campaign:', result.error);
        }
      } catch (error) {
        console.error('Error fetching BidTheatre details:', error);
      } finally {
        setLoadingBidTheatreDetails(false);
      }
    }
  };

  // Fetch data for all apartment keys when component mounts
  useEffect(() => {
    fetchApartmentData();
    
    if (campaign.bt_campaign_id) {
      fetchBidTheatreDetails();
    }
    
    // Set up interval to check for updates every 5 minutes
    const intervalId = setInterval(fetchApartmentData, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [campaignApartments]);
  
  // Get apartment details for this campaign
  const campaignApts = campaignApartments.map(ca => {
    // Use fetched data if available, otherwise fall back to apartments array
    const apartmentDetails = apartmentData[ca.apartment_key] || apartments.find(a => a.key === ca.apartment_key);
    return {
      key: ca.apartment_key,
      address: apartmentDetails?.address || 'Address not available',
      postcode: apartmentDetails?.postcode || '',
      city: apartmentDetails?.city || '',
      images: apartmentDetails?.images || [],
      active: ca.active,
      coordinates: apartmentDetails?.coordinates,
      agentEmail: apartmentDetails?.agentEmail || '',
      agencyEmail: apartmentDetails?.agencyEmail || '',
      agency: apartmentDetails?.agency || '',
    };
  });
  
  // Calculate total budget
  const totalBudget = (
    campaign.budget_meta + 
    campaign.budget_display + 
    campaign.budget_pdooh
  ).toFixed(2);
  
  // Format dates (MM/YYYY)
  const startDate = campaign.campaign_start_date;
  const endDate = campaign.campaign_end_date || 'Ongoing';
  
  // Initialize map when component mounts
  useEffect(() => {
    if (!mapContainerRef.current || !campaign.campaign_coordinates) return;
    
    const initMap = async () => {
      try {
        if (campaign.campaign_coordinates && 
            campaign.campaign_coordinates.lat !== 0 && 
            campaign.campaign_coordinates.lng !== 0) {
          
          const map = await initializeMap(
            'campaign-map',
            campaign.campaign_coordinates,
            13
          );
          
          mapRef.current = map;
          
          // Add marker for campaign location
          await addMarker(
            map,
            campaign.campaign_coordinates,
            campaign.campaign_address
          );
          
          // Add circle for campaign radius
          await addRadiusCircle(
            map,
            campaign.campaign_coordinates,
            campaign.campaign_radius
          );
          
          // Add markers for apartments if they have coordinates
          for (const apt of campaignApts) {
            if (apt.coordinates && apt.coordinates.lat !== 0 && apt.coordinates.lng !== 0) {
              await addMarker(
                map,
                apt.coordinates,
                apt.address
              );
            }
          }
        }
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };
    
    initMap();
  }, [campaign, campaignApts]);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">
            Campaign Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 max-h-[calc(90vh-130px)] overflow-y-auto">
          {/* Left Column: Campaign Details */}
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Campaign Information</h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Campaign ID</p>
                  <p className="text-base text-gray-800">{campaign.id}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Partner</p>
                  <p className="text-base text-gray-800">{campaign.partner_name}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Agent</p>
                  <p className="text-base text-gray-800">{agencyName}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Agent Key</p>
                  <p className="text-base text-gray-800">{campaign.agent_key}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <p className={`text-base ${campaign.active ? 'text-green-600' : 'text-red-600'}`}>
                    {updatingStatus ? 'Updating...' : campaign.active ? 'Active' : 'Paused'}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Campaign Period</p>
                  <p className="text-base text-gray-800">{startDate} to {endDate}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Campaign Location</p>
                  {campaign.formatted_address ? (
                    <p className="text-base text-gray-800">{campaign.formatted_address}</p>
                  ) : (
                    <p className="text-base text-gray-800">
                      {campaign.campaign_address}, {campaign.campaign_postal_code} {campaign.campaign_city}
                    </p>
                  )}
                  <p className="text-sm text-gray-600">Radius: {campaign.campaign_radius} meters</p>
                  
                  {campaign.campaign_coordinates && 
                   campaign.campaign_coordinates.lat !== 0 && 
                   campaign.campaign_coordinates.lng !== 0 && (
                    <div className="flex items-center mt-1">
                      <MapPin size={14} className="text-gray-500 mr-1" />
                      <p className="text-xs text-gray-500">
                        Coordinates: {campaign.campaign_coordinates.lat.toFixed(6)}, {campaign.campaign_coordinates.lng.toFixed(6)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Budget Information</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {campaign.channel_meta ? (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-blue-800">Meta</p>
                      <p className="text-xl font-semibold text-blue-900">€{campaign.budget_meta.toFixed(2)}</p>
                      <p className="text-xs text-blue-700">€{campaign.budget_meta_daily.toFixed(2)} daily</p>
                    </div>
                  ) : null}
                  
                  {campaign.channel_display ? (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-green-800">Display</p>
                      <p className="text-xl font-semibold text-green-900">€{campaign.budget_display.toFixed(2)}</p>
                      <p className="text-xs text-green-700">€{campaign.budget_display_daily.toFixed(2)} daily</p>
                    </div>
                  ) : null}
                  
                  {campaign.channel_pdooh ? (
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-purple-800">PDOOH</p>
                      <p className="text-xl font-semibold text-purple-900">€{campaign.budget_pdooh.toFixed(2)}</p>
                      <p className="text-xs text-purple-700">€{campaign.budget_pdooh_daily.toFixed(2)} daily</p>
                    </div>
                  ) : null}
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">Total Budget</p>
                  <p className="text-xl font-semibold text-gray-900">€{totalBudget}</p>
                </div>
              </div>
            </div>
            
            {/* BidTheatre Integration Status */}
            {(campaign.channel_display === 1 || campaign.channel_pdooh === 1) && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Coming soon</h3>
                <div className="p-4 bg-blue-50 rounded-lg">
                  {campaign.bt_campaign_id ? (
                    <div>
                      <div className="flex items-center mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          campaign.bt_sync_status === 'synced' 
                            ? 'bg-green-100 text-green-800' 
                            : campaign.bt_sync_status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {campaign.bt_sync_status === 'synced' 
                            ? 'Synced' 
                            : campaign.bt_sync_status === 'pending'
                            ? 'Pending'
                            : 'Failed'}
                        </span>
                        {campaign.bt_last_sync && (
                          <span className="ml-2 text-xs text-gray-500">
                            Last sync: {format(new Date(campaign.bt_last_sync), 'yyyy-MM-dd HH:mm')}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-blue-800 mb-2">BidTheatre Campaign ID: {campaign.bt_campaign_id}</p>
                      
                      {loadingBidTheatreDetails ? (
                        <div className="flex items-center text-sm text-blue-700">
                          <RefreshCw size={16} className="mr-2 animate-spin" />
                          Loading BidTheatre details...
                        </div>
                      ) : bidTheatreDetails ? (
                        <div className="space-y-2 mt-3">
                          <div>
                            <p className="text-xs font-semibold text-blue-700">BidTheatre Campaign Name</p>
                            <p className="text-sm text-blue-800">{bidTheatreDetails.name}</p>
                          </div>
                          
                          <div>
                            <p className="text-xs font-semibold text-blue-700">BidTheatre Status</p>
                            <p className="text-sm text-blue-800">{bidTheatreDetails.status || 'Unknown'}</p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs font-semibold text-blue-700">BT Start Date</p>
                              <p className="text-sm text-blue-800">
                                {bidTheatreDetails.startDate ? 
                                 bidTheatreDetails.startDate : 
                                 'Not set'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-blue-700">BT End Date</p>
                              <p className="text-sm text-blue-800">
                                {bidTheatreDetails.endDate ? 
                                 bidTheatreDetails.endDate : 
                                 'Ongoing'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs font-semibold text-blue-700">BT Budget</p>
                              <p className="text-sm text-blue-800">
                                €{bidTheatreDetails.budget?.toFixed(2) || '0.00'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-blue-700">BT Daily Budget</p>
                              <p className="text-sm text-blue-800">
                                €{bidTheatreDetails.dailyBudget?.toFixed(2) || '0.00'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Display other BidTheatre properties as they're discovered */}
                          {bidTheatreDetails.mediaListId && (
                            <div>
                              <p className="text-xs font-semibold text-blue-700">Media List ID</p>
                              <p className="text-sm text-blue-800">{bidTheatreDetails.mediaListId}</p>
                            </div>
                          )}
                          
                          {bidTheatreDetails.geoTargeting && (
                            <div>
                              <p className="text-xs font-semibold text-blue-700">Geo Targeting</p>
                              <p className="text-sm text-blue-800">
                                {bidTheatreDetails.geoTargeting.latitude?.toFixed(6)}, 
                                {bidTheatreDetails.geoTargeting.longitude?.toFixed(6)} 
                                (Radius: {bidTheatreDetails.geoTargeting.radius}m)
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center mt-2">
                          <AlertCircle size={16} className="text-yellow-500 mr-2" />
                          <p className="text-sm text-yellow-700">
                            BidTheatre details not available
                          </p>
                        </div>
                      )}
                      
                      {campaign.bt_sync_status === 'failed' && campaign.bt_sync_error && (
                        <div className="mt-2 p-2 bg-red-50 rounded border border-red-100">
                          <p className="text-xs font-medium text-red-700">Error Message:</p>
                          <p className="text-xs text-red-600 mt-1">{campaign.bt_sync_error}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <AlertCircle size={16} className="text-yellow-500 mr-2" />
                      <p className="text-sm text-yellow-700">
                        PDOOH / Display campaigns tracking.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Creatopy Ad Tag Status */}
            {(campaign.channel_display === 1 || campaign.channel_pdooh === 1) && campaign.cr_ad_tags && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Creatopy Ad Creative</h3>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                    {campaign.cr_last_updated && (
                      <span className="ml-2 text-xs text-gray-500">
                        Last updated: {format(new Date(campaign.cr_last_updated), 'yyyy-MM-dd HH:mm')}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-green-800 mt-2">Ad tag is synced with BidTheatre</p>
                  
                  <div className="mt-3 p-2 bg-white rounded border border-green-100">
                    <p className="text-xs font-mono text-gray-700 break-all">
                      {campaign.cr_ad_tags}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Map */}
            {campaign.campaign_coordinates && 
             campaign.campaign_coordinates.lat !== 0 && 
             campaign.campaign_coordinates.lng !== 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Campaign Location</h3>
                <div 
                  id="campaign-map" 
                  ref={mapContainerRef}
                  className="w-full h-64 rounded-lg border border-gray-200"
                ></div>
              </div>
            )}
          </div>
          
          {/* Right Column: Apartments */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-800">
                Included Apartments ({campaignApts.length})
              </h3>
            </div>
            
            <div className="border rounded-md overflow-hidden">
              {campaignApts.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No apartments included in this campaign.
                </div>
              ) : (
                <div className="max-h-[calc(90vh-250px)] overflow-y-auto">
                  {campaignApts.map((apt) => {
                    // Find the apartment details from the feed
                    const apartmentDetails = apartments.find(a => a.key === apt.key);
                    
                    return (
                      <div 
                        key={apt.key}
                        className={`flex items-start p-4 border-b last:border-b-0 bg-white ${
                          soldApartments.includes(apt.key) ? 'bg-red-50' : apt.active ? '' : 'bg-gray-50 opacity-75'
                        }`}
                      >
                        {apt.images?.length > 0 ? (
                          <img 
                            src={apt.images[0].url}
                            alt={apt.address}
                            className="w-24 h-24 object-cover rounded-md flex-shrink-0"
                          />
                        ) : (
                          <div className="w-24 h-24 bg-gray-200 rounded-md flex items-center justify-center flex-shrink-0">
                            <span className="text-gray-400 text-xs">No image available</span>
                          </div>
                        )}
                        
                        <div className="ml-4 flex-1 min-w-0">
                          <div className="flex justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-800 truncate">{apt.address}</p>
                              {soldApartments.includes(apt.key) ? (
                                <p className="text-xs font-medium text-red-600">Apartment no longer available</p>
                              ) : (
                                <p className="text-xs text-gray-500 truncate">{apt.postcode} {apt.city}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500">Key:</span>
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                                  {apt.key}
                                </code>
                              </div>
                              {apt.agency && (
                                <p className="text-xs text-gray-500">Agency: {apt.agency}</p>
                              )}
                              {apt.agentEmail && (
                                <p className="text-xs text-gray-500">Agent: {apt.agentEmail}</p>
                              )}
                              
                              {apt.coordinates && apt.coordinates.lat !== 0 && apt.coordinates.lng !== 0 && (
                                <div className="flex items-center mt-1">
                                  <MapPin size={12} className="text-gray-400 mr-1" />
                                  <p className="text-xs text-gray-400 font-mono">
                                    {apt.coordinates.lat.toFixed(6)}, {apt.coordinates.lng.toFixed(6)}
                                  </p>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-shrink-0 ml-4">
                              <a
                                href={`https://www.kiinteistomaailma.fi/${apt.key}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 hover:text-purple-800 transition-colors"
                              >
                                <ExternalLink size={18} />
                              </a>
                            </div>
                          </div>
                          
                          <div className="mt-2 flex items-center">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              soldApartments.includes(apt.key)
                                ? 'bg-red-100 text-red-800'
                                : apt.active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {soldApartments.includes(apt.key) ? 'Sold' : apt.active ? 'Active' : 'Paused'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end p-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignInfoModal;