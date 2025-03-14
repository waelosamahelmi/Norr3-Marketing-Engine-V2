import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Campaign, CampaignApartment, Apartment, User } from '../types';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Edit, 
  Info, 
  ToggleLeft, 
  ToggleRight, 
  Trash,
  BarChart3,
  Calendar,
  MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import CampaignModal from '../components/CampaignModal';
import CampaignInfoModal from '../components/CampaignInfoModal';
import DashboardCharts from '../components/DashboardCharts';
import { 
  updateCampaignStatusInSheet, 
  deleteCampaignFromSheet
} from '../lib/googleSheets';
import { updateBidTheatreCampaign } from '../lib/bidTheatre';
import { sendSlackNotification } from '../lib/notifications';


const Dashboard = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignApartments, setCampaignApartments] = useState<CampaignApartment[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [fetchingApartments, setFetchingApartments] = useState(false);
  const [agencyNames, setAgencyNames] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  
  // Ref to track if a fetch is in progress to prevent multiple simultaneous fetches
  const fetchInProgressRef = useRef(false);
  // Ref to store the interval ID for cleanup
  const fetchIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchUserAndData = async () => {
      try {
        // Get current user
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (userData) {
            setUser(userData as User);
            setUserRole(userData.role);
          }
        }
        
        await fetchCampaigns();
        await fetchAgencyNames();
        await fetchApartments();
      } catch (error) {
        console.error('Error fetching initial data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndData();
    
    // Clean up any existing interval when component mounts
    if (fetchIntervalRef.current) {
      clearInterval(fetchIntervalRef.current);
    }
    
    return () => {
      // Clean up interval when component unmounts
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
        fetchIntervalRef.current = null;
      }
    };
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;
      
      let query = supabase.from('campaigns').select('*');
      
      // Fetch user data including role
      const { data: userData } = await supabase
        .from('users')
        .select('role, agent_key, agency_id')
        .eq('id', session.user.id)
        .single();
      
      if (userData) {
        // Managers have the same access as admins - no filtering needed
        if (userData.role === 'partner') {
          // For partner agents, filter campaigns by their agency_id
          if (userData.agency_id) {
            query = query.eq('agency_id', userData.agency_id);
          } else {
            console.warn('No agency_id found for user:', session.user.id);
            setCampaigns([]); // No agency association, show no campaigns
            return;
          }
        }
        // Admins and managers see all campaigns, no filter applied
      }
      
      const { data: campaignsData, error: campaignsError } = await query.order('created_at', { ascending: false });
      
      if (campaignsError) throw campaignsError;
      
      setCampaigns(campaignsData as Campaign[]);
      
      // Fetch campaign apartments
      const { data: campaignApartmentsData, error: campaignApartmentsError } = await supabase
        .from('campaign_apartments')
        .select('*');
      
      if (campaignApartmentsError) throw campaignApartmentsError;
      
      setCampaignApartments(campaignApartmentsData as CampaignApartment[]);
      
      // Log activity
      if (session) {
        try {
          await supabase.from('activity_logs').insert({
            user_id: session.user.id,
            user_email: session.user.email,
            action: 'fetch_campaigns',
            details: 'User fetched campaign data'
          });
        } catch (logError) {
          console.error('Error logging activity:', logError);
          // Don't fail the whole operation if logging fails
        }
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error instanceof Error ? error.message : error);
      toast.error('Failed to load campaigns');
    }
  };

  const fetchApartments = useCallback(async () => {
    // If a fetch is already in progress, don't start another one
    if (fetchInProgressRef.current) {
      console.log('Apartment fetch already in progress, skipping');
      return;
    }
    
    fetchInProgressRef.current = true;
    setFetchingApartments(true);
    
    try {
      const baseUrl = import.meta.env.DEV 
        ? '/api/apartments' // Use proxy in development
        : '/api/apartments'; // Use Netlify proxy in production
      
      const response = await fetch(baseUrl, {
        headers: {
          'Accept': 'application/json',
          'X-Client-Info': 'norr3-marketing-dashboard'
        },
        mode: 'cors',
        credentials: 'omit'
      });
        
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
          
      const data = await response.json();
          
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format: expected an array');
      }
          
      const mappedApartments = data.map((apt: any) => ({
        key: apt.key || '',
        address: apt.address || '',
        postcode: apt.postcode || '',
        city: apt.city || '',
        images: apt.images || [],
        agentEmail: apt.agent?.email?.toLowerCase().trim() || '',
        agencyEmail: apt.agencyEmail || '',
        agentKey: apt.agent?.key || '',
        agency: apt.agency || '',
        coordinates: {
          lat: apt.latitude || 0,
          lng: apt.longitude || 0
        }
      }));
          
      setApartments(mappedApartments);
          
      // Log successful fetch to activity log
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('activity_logs').insert({
            user_id: session.user.id,
            user_email: session.user.email,
            action: 'fetch_apartments',
            details: `Successfully fetched ${mappedApartments.length} apartments from feed`
          });
        }
      } catch (logError) {
        console.error('Error logging apartment fetch:', logError);
        // Don't fail the whole operation if logging fails
      }
    } catch (error) {
      console.error('Error fetching apartments:', error instanceof Error ? error.message : error);
      // Log the full error for debugging
      console.debug('Detailed fetch error:', error);
      
      // Use mock data as fallback
      setApartments([
        {
          key: 'mock-1',
          address: 'Mannerheimintie 10',
          postcode: '00100',
          city: 'Helsinki',
          images: [{ url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914', type: 'image' }],
          agentEmail: 'agent@kiinteistomaailma.fi',
          agencyEmail: 'agency@kiinteistomaailma.fi',
          agentKey: 'km-agent-1',
          agency: 'Kiinteistömaailma Helsinki',
          coordinates: { lat: 60.1699, lng: 24.9384 }
        },
        {
          key: 'mock-2',
          address: 'Aleksanterinkatu 15',
          postcode: '00100',
          city: 'Helsinki',
          images: [{ url: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994', type: 'image' }],
          agentEmail: 'agent@kiinteistomaailma.fi',
          agencyEmail: 'agency@kiinteistomaailma.fi',
          agentKey: 'km-agent-1',
          agency: 'Kiinteistömaailma Helsinki',
          coordinates: { lat: 60.1675, lng: 24.9414 }
        }
      ]);
      toast.warning('Using mock apartment data. Could not fetch from external source.');
    } finally {
      setFetchingApartments(false);
      fetchInProgressRef.current = false;
    }
  }, []);

  // Set up periodic apartment fetching (every 30 minutes)
  useEffect(() => {
    // Clear any existing interval first
    if (fetchIntervalRef.current) {
      clearInterval(fetchIntervalRef.current);
    }
    
    // Set up a new interval
    const intervalId = window.setInterval(() => {
      console.log('30-minute interval triggered, checking if fetch is needed');
      fetchApartments();
    }, 30 * 60 * 1000); // 30 minutes in milliseconds
    
    // Store the interval ID in the ref
    fetchIntervalRef.current = intervalId;
    
    return () => {
      // Clean up interval when component unmounts or effect re-runs
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
        fetchIntervalRef.current = null;
      }
    };
  }, [fetchApartments]);

  const fetchAgencyNames = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('agency_id, name');
      
      if (error) throw error;
      
      const nameMap = (data || []).reduce((acc, agency) => ({
        ...acc,
        [agency.agency_id]: agency.name
      }), {} as Record<string, string>);
      
      setAgencyNames(nameMap);
    } catch (error) {
      console.error('Error fetching agency names:', error);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return; // Prevent multiple clicks
    
    setRefreshing(true);
    try {
      await fetchCampaigns();
      await fetchApartments();
      toast.success('Data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error instanceof Error ? error.message : error);
      toast.error('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = () => {
    try {
      // Create CSV content
      const headers = [
        'Campaign ID',
        'Partner',
        'Agent',
        'Apartment Keys',
        'Start Date',
        'End Date',
        'Channels',
        'Total Budget',
        'Status',
        'Location',
        'Coordinates'
      ];
      
      const rows = filteredCampaigns.map(campaign => {
        const apartmentKeys = campaignApartments
          .filter(ca => ca.campaign_id === campaign.id)
          .map(ca => ca.apartment_key)
          .join(', ');
        
        const channels = [
          campaign.channel_meta === 1 ? 'Meta' : '',
          campaign.channel_display === 1 ? 'Display' : '',
          campaign.channel_pdooh === 1 ? 'PDOOH' : '',
        ].filter(Boolean).join(', ');
        
        const totalBudget = (
          campaign.budget_meta + 
          campaign.budget_display + 
          campaign.budget_pdooh
        ).toFixed(2);
        
        const location = campaign.formatted_address || 
          `${campaign.campaign_address}, ${campaign.campaign_postal_code} ${campaign.campaign_city}`;
        
        const coordinates = campaign.campaign_coordinates ? 
          `${campaign.campaign_coordinates.lat},${campaign.campaign_coordinates.lng}` : 
          '';
        
        return [
          campaign.id,
          campaign.partner_name,
          campaign.agent,
          apartmentKeys,
          campaign.campaign_start_date,
          campaign.campaign_end_date || 'Ongoing',
          channels,
          `€${totalBudget}`,
          campaign.active ? 'Active' : 'Paused',
          location,
          coordinates
        ];
      });
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `campaigns_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Export completed');
    } catch (error) {
      console.error('Error exporting campaigns:', error instanceof Error ? error.message : error);
      toast.error('Failed to export campaigns');
    }
  };

  const handleToggleStatus = async (campaign: Campaign) => {
    try {
      // Only allow deactivating campaigns, not reactivating
      if (!campaign.active) {
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to perform this action');
        return;
      }
      
      const newStatus = !campaign.active;
      
      const { error } = await supabase
        .from('campaigns')
        .update({ active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', campaign.id);
      
      if (error) throw error;
      
      // Update local state
      setCampaigns(campaigns.map(c => 
        c.id === campaign.id ? { ...c, active: newStatus } : c
      ));
      
      // Log activity
      try {
        await supabase.from('activity_logs').insert({
          user_id: session.user.id,
          user_email: session.user.email,
          action: newStatus ? 'activate_campaign' : 'deactivate_campaign',
          details: `User ${newStatus ? 'activated' : 'deactivated'} campaign: ${campaign.id}`
        });
      } catch (logError) {
        console.error('Error logging activity:', logError instanceof Error ? logError.message : logError);
        // Don't fail the whole operation if logging fails
      }
      
      // Sync to Google Sheets
      await updateCampaignStatusInSheet(campaign.id, newStatus);
      
      toast.success(`Campaign ${newStatus ? 'activated' : 'paused'} successfully`);
      await sendSlackNotification(
  newStatus ? 'activated' : 'paused', 
  campaign, 
  session.user.email
);
    } catch (error) {
      console.error('Error toggling campaign status:', error instanceof Error ? error.message : error);
      toast.error('Failed to update campaign status');
    }
  };

  const handleDeleteCampaign = async (campaign: Campaign) => {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to perform this action');
        return;
      }
      
      // First delete related campaign apartments
      const { error: apartmentsError } = await supabase
        .from('campaign_apartments')
        .delete()
        .eq('campaign_id', campaign.id);
      
      if (apartmentsError) throw apartmentsError;
      
      // Then delete the campaign
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaign.id);
      
      if (error) throw error;
      
      // Update local state
      setCampaigns(campaigns.filter(c => c.id !== campaign.id));
      setCampaignApartments(campaignApartments.filter(ca => ca.campaign_id !== campaign.id));
      
      // Log activity
      try {
        await supabase.from('activity_logs').insert({
          user_id: session.user.id,
          user_email: session.user.email,
          action: 'delete_campaign',
          details: `User deleted campaign: ${campaign.id}`
        });
      } catch (logError) {
        console.error('Error logging activity:', logError instanceof Error ? logError.message : logError);
        // Don't fail the whole operation if logging fails
      }
      
      // Delete from Google Sheets
      const sheetDeleteSuccess = await deleteCampaignFromSheet(campaign.id);
      if (!sheetDeleteSuccess) {
        toast.error('Campaign deleted from database but failed to sync with Google Sheet');
      } else {
        toast.success('Campaign deleted successfully');
      }
      
    } catch (error) {
      console.error('Error deleting campaign:', error instanceof Error ? error.message : error);
      toast.error('Failed to delete campaign');
    }
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowCreateModal(true);
  };

  const handleViewCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowInfoModal(true);
  };

  const handleCreateCampaign = () => {
    // Only proceed if apartments are loaded
    if (fetchingApartments) {
      toast.info("Loading apartment data. Please wait...");
      return;
    }
    
    setSelectedCampaign(null);
    setShowCreateModal(true);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setShowInfoModal(false);
    setSelectedCampaign(null);
  };

  const onCampaignSaved = async () => {
    closeModal();
    await fetchCampaigns();
    toast.success('Campaign saved successfully');
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    switch (name) {
      case 'searchTerm':
        setSearchTerm(value);
        break;
      case 'statusFilter':
        setStatusFilter(value);
        break;
      default:
        break;
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
  };

  // Filter campaigns based on search term and status filter
  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = 
      campaign.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      campaign.agent.toLowerCase().includes(searchTerm.toLowerCase()) ||
      campaign.partner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (campaign.formatted_address && campaign.formatted_address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      campaign.campaign_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      campaign.campaign_city.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === '' || 
      (statusFilter === 'on' && campaign.active) || 
      (statusFilter === 'off' && !campaign.active);
    
    return matchesSearch && matchesStatus;
  });

  // Calculate metrics
  const activeCampaigns = campaigns.filter(c => c.active).length;
  const pausedCampaigns = campaigns.filter(c => !c.active).length;
  const totalBudget = campaigns.reduce((sum, campaign) => 
    sum + campaign.budget_meta + campaign.budget_display + campaign.budget_pdooh, 0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Campaign Management</h1>
        
        <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              name="searchTerm"
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={handleFilterChange}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Filter size={18} className="mr-2" />
            Filters {showFilters ? '▲' : '▼'}
          </button>
          
          <button
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Download size={18} className="mr-2" />
            Export
          </button>
          
          <button
            onClick={handleCreateCampaign}
            disabled={fetchingApartments}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              fetchingApartments
                ? 'bg-purple-400 text-white cursor-wait'
                : 'bg-purple-700 text-white hover:bg-purple-800'
            }`}
          >
            {fetchingApartments ? (
              <>
                <RefreshCw size={18} className="mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Plus size={18} className="mr-2" />
                Create Campaign
              </>
            )}
          </button>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing || fetchingApartments}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              refreshing || fetchingApartments
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <RefreshCw size={18} className={`mr-2 ${refreshing || fetchingApartments ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>
      </div>
      
      {/* Advanced Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-800">Advanced Filters</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-purple-600 hover:text-purple-800"
            >
              Clear All
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="statusFilter"
                value={statusFilter}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Statuses</option>
                <option value="on">Active</option>
                <option value="off">Paused</option>
              </select>
            </div>
          </div>
        </div>
      )}
      
      {/* Dashboard Charts */}
      <DashboardCharts campaigns={campaigns} />
      
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <ToggleRight size={24} />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Active Campaigns</h3>
              <p className="text-2xl font-semibold text-gray-800">{activeCampaigns}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100 text-red-600">
              <ToggleLeft size={24} />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Paused Campaigns</h3>
              <p className="text-2xl font-semibold text-gray-800">{pausedCampaigns}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <BarChart3 size={24} />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Total Budget</h3>
              <p className="text-2xl font-semibold text-gray-800">€{totalBudget.toFixed(2)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <Calendar size={24} />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Current Month</h3>
              <p className="text-lg font-semibold text-gray-800">{format(new Date(), 'MM/yyyy')}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Campaigns Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent Key
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agency ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Apartments
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Start
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  End
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Channels
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created By
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-4 text-center text-sm text-gray-500">
                    No campaigns found
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((campaign) => {
                  const campaignApts = campaignApartments.filter(ca => ca.campaign_id === campaign.id);
                  const totalBudget = (
                    campaign.budget_meta + 
                    campaign.budget_display + 
                    campaign.budget_pdooh
                  ).toFixed(2);
                  
                  return (
                    <tr key={campaign.id} className={campaign.active ? '' : 'opacity-50 bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {campaign.id.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {campaign.agent_key}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" title={agencyNames[campaign.agency_id] || ''}>
                        <span className="font-mono">{campaign.agency_id || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {campaignApts.length} keys
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {campaign.campaign_start_date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {campaign.campaign_end_date || 'Ongoing'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          {campaign.channel_meta === 1 && (
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                              Meta
                            </span>
                          )}
                          
                          {campaign.channel_display === 1 && (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                              Display
                            </span>
                          )}
                          
                          {campaign.channel_pdooh === 1 && (
                            <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                              PDOOH
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        €{totalBudget}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <MapPin size={14} className="text-gray-400 mr-1 flex-shrink-0" />
                          <span className="truncate max-w-[150px]" title={campaign.formatted_address || `${campaign.campaign_address}, ${campaign.campaign_city}`}>
                            {campaign.formatted_address || `${campaign.campaign_address}, ${campaign.campaign_city}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          campaign.active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {campaign.active ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" title={campaign.created_by_name || campaign.created_by}>
                        {campaign.created_by}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewCampaign(campaign)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Info size={18} />
                          </button>
                          
                          <button
                            onClick={() => handleEditCampaign(campaign)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <Edit size={18} />
                          </button>
                          
                          <button
                            onClick={() => handleToggleStatus(campaign)}
                            disabled={!campaign.active}
                            className={campaign.active 
                              ? "text-amber-600 hover:text-amber-900" 
                              : "text-gray-400 cursor-not-allowed"
                            }
                          >
                            {campaign.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>
                          {!campaign.active && (
                          <button
                            onClick={() => handleDeleteCampaign(campaign)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash size={18} />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Campaign Create/Edit Modal */}
      {showCreateModal && (
        <CampaignModal
          campaign={selectedCampaign}
          onClose={closeModal}
          onSave={onCampaignSaved}
          apartments={apartments}
          campaignApartments={campaignApartments}
        />
      )}
      
      {/* Campaign Info Modal */}
      {showInfoModal && selectedCampaign && (
        <CampaignInfoModal
          campaign={selectedCampaign}
          onClose={closeModal}
          apartments={apartments}
          campaignApartments={campaignApartments.filter(ca => ca.campaign_id === selectedCampaign.id)}
          onApartmentsUpdate={setApartments}
        />
      )}
      
      {/* Apartment Fetching Status */}
      {fetchingApartments && (
        <div className="fixed bottom-4 right-4 bg-blue-50 border border-blue-200 rounded-lg shadow-md p-3 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600 mr-2"></div>
          <span className="text-sm text-blue-700">Fetching apartments...</span>
        </div>
      )}
    </div>
  );
};

export default Dashboard;