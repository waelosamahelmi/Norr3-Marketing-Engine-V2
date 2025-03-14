import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Campaign, CampaignApartment, Apartment, User } from '../types';
import { X, Plus, Trash, Check, RefreshCw, MapPin, AlertCircle, ChevronRight, ChevronLeft, Calendar, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import AddressAutocomplete from './AddressAutocomplete';
import { format, addMonths, parse, differenceInDays } from 'date-fns';
import { geocodeAddress, initializeMap, addMarker, addRadiusCircle } from '../lib/maps';
import { createBidTheatreCampaign, updateBidTheatreCampaign, uploadCreativeToBidTheatre } from '../lib/bidTheatreApi';
import { addCampaignToSheet, updateCampaignInSheet } from '../lib/googleSheets';
import { sendSlackNotification } from '../lib/notifications';

interface CampaignModalProps {
  campaign?: Campaign | null;
  onClose: () => void;
  onSave: () => void;
  apartments: Apartment[];
  campaignApartments: CampaignApartment[];
}

const CREATIVE_SIZES = [
  { width: 300, height: 431, hash: 'g3jo2pn' },
  { width: 300, height: 600, hash: '11jp13n' },
  { width: 620, height: 891, hash: 'mqopyyq' },
  { width: 980, height: 400, hash: '58z5ylw' },
  { width: 1080, height: 1920, hash: 'x8x7e3x' }
];

const CampaignModal = ({
  campaign,
  onClose,
  onSave,
  apartments,
  campaignApartments
}: CampaignModalProps) => {
  const [formData, setFormData] = useState({
    partner_id: '',
    partner_name: '',
    agent: '',
    agent_key: '',
    agency_id: '',
    campaign_address: '',
    campaign_postal_code: '',
    campaign_city: '',
    campaign_radius: 1500,
    campaign_start_date: format(new Date(), '01/MM/yyyy'),
    campaign_end_date: format(addMonths(new Date(), 1), '01/MM/yyyy'),
    channel_meta: false,
    channel_display: false,
    channel_pdooh: false,
    budget_meta: '',
    budget_display: '',
    budget_pdooh: '',
    budget_meta_daily: 0,
    budget_display_daily: 0,
    budget_pdooh_daily: 0,
    active: true,
    bidding_strategy: 'even', // Added for BidTheatre
    max_cpm_display: 5,       // Added for BidTheatre
    max_cpm_pdooh: 5          // Added for BidTheatre
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [agencyList, setAgencyList] = useState<{ id: string, name: string }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedApartmentKeys, setSelectedApartmentKeys] = useState<string[]>([]);
  const [filteredApartments, setFilteredApartments] = useState<Apartment[]>([]);
  const [selectedTab, setSelectedTab] = useState<'info' | 'apartments' | 'budget'>('info');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredAgencyApartments, setFilteredAgencyApartments] = useState<Apartment[]>([]);
  const [loadingGeocode, setLoadingGeocode] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [bidTheatreLoading, setBidTheatreLoading] = useState(false);
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [campaignAddressValid, setCampaignAddressValid] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isOngoing, setIsOngoing] = useState(false);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [userAgency, setUserAgency] = useState<{ id: string, name: string } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const budgetMetaRef = useRef<HTMLInputElement>(null);
  const budgetDisplayRef = useRef<HTMLInputElement>(null);
  const budgetPdoohRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUserAndAgencies = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (error) throw error;
          setCurrentUser(userData);
          setIsAdmin(userData.role === 'admin');
          setIsManager(userData.role === 'manager');
          setIsPartner(userData.role === 'partner');

          const { data: agencies, error: agencyError } = await supabase
            .from('agencies')
            .select('agency_id, name')
            .order('name', { ascending: true });
          if (agencyError) throw agencyError;
          setAgencyList(agencies.map(a => ({ id: a.agency_id, name: a.name })));

          if (!campaign) {
            setFormData(prev => ({
              ...prev,
              partner_id: userData.partner_id || userData.id,
              partner_name: userData.partner_name || '',
              agent: userData.name || '',
              agent_key: userData.agent_key || '',
              agency_id: userData.agency_id || ''
            }));
          }

          if (userData.agency_id) {
            const agencyInfo = agencies.find(a => a.agency_id === userData.agency_id);
            if (agencyInfo) {
              setUserAgency({ id: agencyInfo.agency_id, name: agencyInfo.name });
              if (!campaign) {
                setFormData(prev => ({
                  ...prev,
                  agent_key: userData.agent_key || '',
                  agency_id: userData.agency_id,
                  partner_name: agencyInfo.name
                }));
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error('Failed to load user data');
      }
    };
    fetchUserAndAgencies();
  }, [campaign, apartments]);

  useEffect(() => {
    if (campaign) {
      setFormData({
        ...campaign,
        channel_meta: campaign.channel_meta === 1,
        channel_display: campaign.channel_display === 1,
        channel_pdooh: campaign.channel_pdooh === 1,
        budget_meta: campaign.budget_meta === 0 ? '' : campaign.budget_meta,
        budget_display: campaign.budget_display === 0 ? '' : campaign.budget_display,
        budget_pdooh: campaign.budget_pdooh === 0 ? '' : campaign.budget_pdooh,
        bidding_strategy: campaign.bidding_strategy || 'even',
        max_cpm_display: campaign.max_cpm_display || 5,
        max_cpm_pdooh: campaign.max_cpm_pdooh || 5
      });
      setIsOngoing(!campaign.campaign_end_date);
      const selectedKeys = campaignApartments
        .filter(ca => ca.campaign_id === campaign.id)
        .map(ca => ca.apartment_key);
      setSelectedApartmentKeys(selectedKeys);
    }
  }, [campaign, campaignApartments]);

  useEffect(() => {
    if (!mapContainerRef.current || !formData.campaign_coordinates || formData.campaign_coordinates.lat === 0 || formData.campaign_coordinates.lng === 0 || selectedTab !== 'info') {
      return;
    }
    const initMap = async () => {
      try {
        const map = await initializeMap('campaign-map', formData.campaign_coordinates!, 13);
        setMapInstance(map);
        setMapLoaded(true);
        await addMarker(map, formData.campaign_coordinates!, formData.campaign_address);
        await addRadiusCircle(map, formData.campaign_coordinates!, formData.campaign_radius);
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };
    initMap();
  }, [formData.campaign_coordinates, formData.campaign_radius, selectedTab]);

  useEffect(() => {
    if (!mapInstance || !formData.campaign_coordinates || formData.campaign_coordinates.lat === 0 || formData.campaign_coordinates.lng === 0) {
      return;
    }
    try {
      mapInstance.data.forEach((feature) => mapInstance.data.remove(feature));
      addRadiusCircle(mapInstance, formData.campaign_coordinates, formData.campaign_radius);
    } catch (error) {
      console.error('Error updating map radius:', error);
    }
  }, [formData.campaign_radius, mapInstance]);

  useEffect(() => {
    if (!currentUser) return;
    let agencyApts: Apartment[] = [];
    if (isAdmin) {
      agencyApts = formData.agency_id ? apartments.filter(apt => apt.agency === formData.agency_id) : apartments;
    } else if (isManager) {
      agencyApts = formData.agency_id ? apartments.filter(apt => apt.agency === formData.agency_id) : apartments;
    } else if (isPartner) {
      agencyApts = currentUser.agency_id ? apartments.filter(apt => apt.agency === currentUser.agency_id) : apartments.filter(apt => apt.agentEmail?.toLowerCase() === currentUser.email.toLowerCase());
    }
    setFilteredAgencyApartments(agencyApts);
  }, [apartments, currentUser, isAdmin, isManager, isPartner, formData.agency_id]);

  useEffect(() => {
    setFilteredApartments(
      searchTerm.trim() === ''
        ? filteredAgencyApartments
        : filteredAgencyApartments.filter(apt =>
            apt.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
            apt.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
            apt.postcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(apt.key).toLowerCase().includes(searchTerm.toLowerCase())
          )
    );
  }, [searchTerm, filteredAgencyApartments]);

  useEffect(() => {
    let campaignDays = 30;
    if (!isOngoing && formData.campaign_start_date && formData.campaign_end_date) {
      try {
        const startParts = formData.campaign_start_date.split('/');
        const endParts = formData.campaign_end_date.split('/');
        if (startParts.length === 3 && endParts.length === 3) {
          const startDate = new Date(parseInt(startParts[2]), parseInt(startParts[1]) - 1, parseInt(startParts[0]));
          const endDate = new Date(parseInt(endParts[2]), parseInt(endParts[1]) - 1, parseInt(endParts[0]));
          campaignDays = differenceInDays(endDate, startDate) + 1;
          campaignDays = Math.max(campaignDays, 1);
        }
      } catch (error) {
        console.error('Error calculating campaign days:', error);
        campaignDays = 30;
      }
    }
    setFormData(prev => ({
      ...prev,
      budget_meta_daily: prev.budget_meta && prev.channel_meta ? Math.round((parseFloat(prev.budget_meta.toString()) / campaignDays) * 100) / 100 : 0,
      budget_display_daily: prev.budget_display && prev.channel_display ? Math.round((parseFloat(prev.budget_display.toString()) / campaignDays) * 100) / 100 : 0,
      budget_pdooh_daily: prev.budget_pdooh && prev.channel_pdooh ? Math.round((parseFloat(prev.budget_pdooh.toString()) / campaignDays) * 100) / 100 : 0
    }));
  }, [formData.budget_meta, formData.budget_display, formData.budget_pdooh, formData.campaign_start_date, formData.campaign_end_date, isOngoing, formData.channel_meta, formData.channel_display, formData.channel_pdooh]);

  useEffect(() => {
    const isValid =
      formData.partner_id !== '' &&
      formData.partner_name !== '' &&
      formData.agent !== '' &&
      formData.agent_key !== '' &&
      formData.agency_id !== '' &&
      formData.campaign_address !== '' &&
      formData.campaign_postal_code !== '' &&
      formData.campaign_city !== '' &&
      formData.campaign_radius > 0 &&
      formData.campaign_start_date !== '' &&
      (formData.channel_meta || formData.channel_display || formData.channel_pdooh) &&
      selectedApartmentKeys.length > 0 &&
      campaignAddressValid &&
      (!formData.channel_display || (formData.budget_display !== '' && formData.max_cpm_display > 0)) &&
      (!formData.channel_pdooh || (formData.budget_pdooh !== '' && formData.max_cpm_pdooh > 0));

    const hasBudget =
      (formData.channel_meta ? formData.budget_meta !== '' : true) &&
      (formData.channel_display ? formData.budget_display !== '' : true) &&
      (formData.channel_pdooh ? formData.budget_pdooh !== '' : true);

    setIsFormValid(isValid && hasBudget);
    setHasUnsavedChanges(true);
  }, [formData, selectedApartmentKeys, campaignAddressValid]);

  const handleNavigateTabs = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
      if (selectedTab === 'info') setSelectedTab('apartments');
      else if (selectedTab === 'apartments') setSelectedTab('budget');
    } else {
      if (selectedTab === 'budget') setSelectedTab('apartments');
      else if (selectedTab === 'apartments') setSelectedTab('info');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? '' : parseFloat(value) }));
    } else if (name === 'campaign_radius') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value, 10) || 0 }));
    } else if (name === 'agency_id') {
      const selectedAgency = agencyList.find(agency => agency.id === value);
      setFormData(prev => ({
        ...prev,
        agency_id: value,
        partner_name: selectedAgency ? selectedAgency.name : prev.partner_name
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleMonthSelection = (e: React.ChangeEvent<HTMLInputElement>, isStart: boolean) => {
    const selectedDate = e.target.value;
    if (selectedDate) {
      const [year, month] = selectedDate.split('-');
      const formattedDate = `01/${month}/${year}`;
      setFormData(prev => ({
        ...prev,
        [isStart ? 'campaign_start_date' : 'campaign_end_date']: formattedDate
      }));
    }
  };

  const handleOngoingToggle = () => {
    const newIsOngoing = !isOngoing;
    setIsOngoing(newIsOngoing);
    setFormData(prev => ({
      ...prev,
      campaign_end_date: newIsOngoing ? '' : format(addMonths(new Date(), 1), '01/MM/yyyy')
    }));
  };

  const handleAddressSelect = async (address: { formattedAddress: string; streetAddress: string; postalCode: string; city: string; coordinates: { lat: number; lng: number } }) => {
    setLoadingGeocode(true);
    try {
      setFormData(prev => ({
        ...prev,
        campaign_address: address.streetAddress,
        campaign_postal_code: address.postalCode,
        campaign_city: address.city,
        formatted_address: address.formattedAddress,
        campaign_coordinates: address.coordinates
      }));
      setCampaignAddressValid(true);
    } catch (error) {
      console.error('Error handling address selection:', error);
      toast.error('Failed to process address');
      setCampaignAddressValid(false);
    } finally {
      setLoadingGeocode(false);
    }
  };

  const handleGeocodeAddress = async () => {
    if (!formData.campaign_address || !formData.campaign_postal_code || !formData.campaign_city) {
      toast.error('Please enter a complete address');
      return;
    }
    setLoadingGeocode(true);
    try {
      const result = await geocodeAddress(formData.campaign_address, formData.campaign_postal_code, formData.campaign_city);
      if (result.success) {
        setFormData(prev => ({
          ...prev,
          formatted_address: result.formatted_address,
          campaign_coordinates: result.coordinates
        }));
        setCampaignAddressValid(true);
        toast.success('Address geocoded successfully');
      } else {
        toast.error(result.error || 'Failed to geocode address');
        setCampaignAddressValid(false);
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
      toast.error('Failed to geocode address');
      setCampaignAddressValid(false);
    } finally {
      setLoadingGeocode(false);
    }
  };

  const handleSelectApartment = (key: string) => {
    setSelectedApartmentKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleOpenApartmentLink = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://www.kiinteistomaailma.fi/${key}`, '_blank');
  };

  const handleChannelToggle = (channel: 'meta' | 'display' | 'pdooh') => {
    setFormData(prev => ({
      ...prev,
      [`channel_${channel}`]: !prev[`channel_${channel}`],
      [`budget_${channel}`]: prev[`channel_${channel}`] ? '' : prev[`budget_${channel}`]
    }));
  };

  const getCreativeHtml = (creative: { campaign_id: string; apartment_key: string; width: number; height: number; hash: string }) => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${formData.partner_name}-${creative.apartment_key}-${creative.width}x${creative.height}</title>
  <style>
    body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
    .creative-container { width: ${creative.width}px; height: ${creative.height}px; background: white; overflow: hidden; }
  </style>
</head>
<body>
  <div class="creative-container">
    <script type="text/javascript">
      var embedConfig = {
        "hash": "${creative.hash}",
        "width": ${creative.width},
        "height": ${creative.height},
        "t": Date.now(),
        "userId": 762652,
        "network": "BTT",
        "type": "html5",
        "targetId": "${creative.campaign_id}-${creative.apartment_key}"
      };
    </script>
    <script type="text/javascript" src="https://live-tag.creatopy.net/embed/embed.js"></script>
  </div>
</body>
</html>`;
  };

  const handleSaveCampaign = async () => {
    if (!isFormValid) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaveInProgress(true);

    try {
      const budgetMeta = formData.budget_meta === '' ? 0 : parseFloat(formData.budget_meta.toString());
      const budgetDisplay = formData.budget_display === '' ? 0 : parseFloat(formData.budget_display.toString());
      const budgetPdooh = formData.budget_pdooh === '' ? 0 : parseFloat(formData.budget_pdooh.toString());

      const campaignData = {
        ...formData,
        budget_meta: budgetMeta,
        budget_display: budgetDisplay,
        budget_pdooh: budgetPdooh,
        channel_meta: formData.channel_meta ? 1 : 0,
        channel_display: formData.channel_display ? 1 : 0,
        channel_pdooh: formData.channel_pdooh ? 1 : 0,
        campaign_end_date: isOngoing ? null : formData.campaign_end_date
      };

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('You must be logged in to save campaigns');
        return;
      }

      // Generate creatives if needed
      const creativesToInsert = [];
      for (const apartmentKey of selectedApartmentKeys) {
        const { data: existing } = await supabase
          .from('ad_creatives')
          .select('id')
          .eq('campaign_id', campaign?.id || 'new')
          .eq('apartment_key', apartmentKey);
        if (!existing?.length) {
          CREATIVE_SIZES.forEach(size => {
            creativesToInsert.push({
              campaign_id: campaign?.id || 'temp',
              apartment_key: apartmentKey,
              target_id: `${campaign?.id || 'temp'}-${apartmentKey}`,
              name: `${formData.partner_name}-${apartmentKey}-${size.width}x${size.height}`,
              size: `${size.width}x${size.height}`,
              hash: size.hash,
              width: size.width,
              height: size.height
            });
          });
        }
      }

      let newCampaign;
      if (campaign) {
        const { error } = await supabase
          .from('campaigns')
          .update({ ...campaignData, updated_at: new Date().toISOString() })
          .eq('id', campaign.id);
        if (error) throw error;

        await supabase.from('campaign_apartments').delete().eq('campaign_id', campaign.id);
        const apartmentData = selectedApartmentKeys.map(key => ({
          campaign_id: campaign.id,
          apartment_key: key,
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        const { error: insertError } = await supabase.from('campaign_apartments').insert(apartmentData);
        if (insertError) throw insertError;

        if (creativesToInsert.length > 0) {
          creativesToInsert.forEach(c => (c.campaign_id = campaign.id));
          await supabase.from('ad_creatives').insert(creativesToInsert);
        }

        if ((campaignData.channel_display || campaignData.channel_pdooh) && campaignData.active) {
          setBidTheatreLoading(true);
          const creativeIds = await Promise.all(
            creativesToInsert.map(async creative => {
              const html = getCreativeHtml(creative);
              const { creative_id } = await uploadCreativeToBidTheatre(html, creative);
              await supabase.from('ad_creatives').update({ bt_creative_id: creative_id }).eq('target_id', creative.target_id);
              return creative_id;
            })
          );

          const btCampaignData = {
            name: `${formData.partner_name} - ${formData.campaign_start_date} to ${formData.campaign_end_date || 'ongoing'}`,
            advertiser_id: formData.agency_id,
            start_date: format(parse(formData.campaign_start_date, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd'),
            end_date: formData.campaign_end_date ? format(parse(formData.campaign_end_date, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd') : null,
            budgets: { display: budgetDisplay, pdooh: budgetPdooh },
            daily_budgets: { display: formData.budget_display_daily, pdooh: formData.budget_pdooh_daily },
            ad_formats: [...(formData.channel_display ? ['banner'] : []), ...(formData.channel_pdooh ? ['dooh'] : [])],
            creative_ids: creativeIds,
            targeting: {
              geo: {
                latitude: formData.campaign_coordinates.lat,
                longitude: formData.campaign_coordinates.lng,
                radius: formData.campaign_radius,
                unit: 'meters'
              }
            },
            bidding_strategy: formData.bidding_strategy,
            bid_amounts: { display: formData.max_cpm_display, pdooh: formData.max_cpm_pdooh },
            status: formData.active ? 'active' : 'paused'
          };

          if (campaign.bt_campaign_id) {
            const { success, error: btError } = await updateBidTheatreCampaign(btCampaignData, campaign.bt_campaign_id);
            await supabase
              .from('campaigns')
              .update({
                bt_sync_status: success ? 'synced' : 'failed',
                bt_sync_error: btError,
                bt_last_sync: new Date().toISOString()
              })
              .eq('id', campaign.id);
            if (!success) toast.error('Failed to update BidTheatre campaign');
          } else {
            const { success, btCampaignId, error: btError } = await createBidTheatreCampaign(btCampaignData);
            await supabase
              .from('campaigns')
              .update({
                bt_campaign_id: btCampaignId,
                bt_sync_status: success ? 'synced' : 'failed',
                bt_sync_error: btError,
                bt_last_sync: new Date().toISOString()
              })
              .eq('id', campaign.id);
            if (!success) toast.error('Failed to create BidTheatre campaign');
          }
          setBidTheatreLoading(false);
        }

        try {
          const selectedApts = selectedApartmentKeys.map(key => ({
            campaign_id: campaign.id,
            apartment_key: key,
            active: true
          }));
          await updateCampaignInSheet(campaignData as Campaign, selectedApts, apartments);
        } catch (sheetsError) {
          console.error('Error syncing with Google Sheets:', sheetsError);
        }

        await supabase.from('activity_logs').insert({
          user_id: session.user.id,
          user_email: session.user.email,
          action: 'update_campaign',
          details: `Updated campaign: ${campaign.id}`
        });

        try {
          await sendSlackNotification('updated', { ...campaignData, id: campaign.id } as Campaign, session.user.email);
        } catch (slackError) {
          console.error('Error sending Slack notification for update:', slackError);
        }

        toast.success('Campaign updated successfully');
      } else {
        const { data: newCampaignData, error } = await supabase
          .from('campaigns')
          .insert({
            ...campaignData,
            created_by: session.user.email,
            user_id: session.user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        if (error) throw error;
        newCampaign = newCampaignData;

        const apartmentData = selectedApartmentKeys.map(key => ({
          campaign_id: newCampaign.id,
          apartment_key: key,
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        const { error: insertError } = await supabase.from('campaign_apartments').insert(apartmentData);
        if (insertError) throw insertError;

        if (creativesToInsert.length > 0) {
          creativesToInsert.forEach(c => (c.campaign_id = newCampaign.id));
          await supabase.from('ad_creatives').insert(creativesToInsert);
        }

        if ((campaignData.channel_display || campaignData.channel_pdooh) && campaignData.active) {
          setBidTheatreLoading(true);
          const creativeIds = await Promise.all(
            creativesToInsert.map(async creative => {
              const html = getCreativeHtml(creative);
              const { creative_id } = await uploadCreativeToBidTheatre(html, creative);
              await supabase.from('ad_creatives').update({ bt_creative_id: creative_id }).eq('target_id', creative.target_id);
              return creative_id;
            })
          );

          const btCampaignData = {
            name: `${formData.partner_name} - ${formData.campaign_start_date} to ${formData.campaign_end_date || 'ongoing'}`,
            advertiser_id: formData.agency_id,
            start_date: format(parse(formData.campaign_start_date, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd'),
            end_date: formData.campaign_end_date ? format(parse(formData.campaign_end_date, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd') : null,
            budgets: { display: budgetDisplay, pdooh: budgetPdooh },
            daily_budgets: { display: formData.budget_display_daily, pdooh: formData.budget_pdooh_daily },
            ad_formats: [...(formData.channel_display ? ['banner'] : []), ...(formData.channel_pdooh ? ['dooh'] : [])],
            creative_ids: creativeIds,
            targeting: {
              geo: {
                latitude: formData.campaign_coordinates.lat,
                longitude: formData.campaign_coordinates.lng,
                radius: formData.campaign_radius,
                unit: 'meters'
              }
            },
            bidding_strategy: formData.bidding_strategy,
            bid_amounts: { display: formData.max_cpm_display, pdooh: formData.max_cpm_pdooh },
            status: formData.active ? 'active' : 'paused'
          };

          const { success, btCampaignId, error: btError } = await createBidTheatreCampaign(btCampaignData);
          await supabase
            .from('campaigns')
            .update({
              bt_campaign_id: btCampaignId,
              bt_sync_status: success ? 'synced' : 'failed',
              bt_sync_error: btError,
              bt_last_sync: new Date().toISOString()
            })
            .eq('id', newCampaign.id);
          setBidTheatreLoading(false);
          if (!success) toast.error('Failed to create BidTheatre campaign');
        }

        try {
          const selectedApts = selectedApartmentKeys.map(key => ({
            campaign_id: newCampaign.id,
            apartment_key: key,
            active: true
          }));
          await addCampaignToSheet(newCampaign as Campaign, selectedApts, apartments);
        } catch (sheetsError) {
          console.error('Error syncing with Google Sheets:', sheetsError);
        }

        await supabase.from('activity_logs').insert({
          user_id: session.user.id,
          user_email: session.user.email,
          action: 'create_campaign',
          details: `Created campaign: ${newCampaign.id}`
        });

        try {
          await sendSlackNotification('created', newCampaign as Campaign, session.user.email);
        } catch (slackError) {
          console.error('Error sending Slack notification for creation:', slackError);
        }

        toast.success('Campaign created successfully');
      }

      onSave();
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast.error('Failed to save campaign');
    } finally {
      setSaveInProgress(false);
    }
  };

  const getMonthInputValue = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '';
    return `${parts[2]}-${parts[1]}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">{campaign ? 'Edit Campaign' : 'Create New Campaign'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
        </div>
        <div className="flex border-b">
          <button onClick={() => setSelectedTab('info')} className={`px-5 py-3 font-medium text-sm ${selectedTab === 'info' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>Campaign Info</button>
          <button onClick={() => setSelectedTab('apartments')} className={`px-5 py-3 font-medium text-sm ${selectedTab === 'apartments' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>Apartments ({selectedApartmentKeys.length})</button>
          <button onClick={() => setSelectedTab('budget')} className={`px-5 py-3 font-medium text-sm ${selectedTab === 'budget' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>Channels & Budget</button>
        </div>
        <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
          {selectedTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-4">Agency Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Agency</label>
                    <select name="agency_id" value={formData.agency_id} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500">
                      <option value="">Select Agency</option>
                      {agencyList.map(agency => (
                        <option key={agency.id} value={agency.id}>{agency.name} ({agency.id})</option>
                      ))}
                    </select>
                    {isPartner && userAgency && <p className="mt-1 text-xs text-gray-500">Your default agency is {userAgency.name} ({userAgency.id})</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Partner Name</label>
                    <input type="text" name="partner_name" value={formData.partner_name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500" placeholder="Enter partner name" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
                    <input type="text" name="agent" value={formData.agent} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500" placeholder="Enter agent name" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Agent Key</label>
                    <input type="text" name="agent_key" value={formData.agent_key} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500" placeholder="Enter agent key" required />
                  </div>
                </div>
                <h3 className="text-lg font-medium text-gray-800 mt-6 mb-4">Campaign Period</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><Calendar size={16} className="mr-1" /> Start Date</label>
                    <input type="month" value={getMonthInputValue(formData.campaign_start_date)} onChange={(e) => handleMonthSelection(e, true)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500" required />
                    <p className="mt-1 text-xs text-gray-500">Selected: {formData.campaign_start_date || 'Not set'}</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><Calendar size={16} className="mr-1" /> End Date</label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Ongoing</span>
                        <button type="button" onClick={handleOngoingToggle} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isOngoing ? 'bg-purple-600' : 'bg-gray-200'}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isOngoing ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>
                    {!isOngoing && (
                      <input type="month" value={getMonthInputValue(formData.campaign_end_date || '')} onChange={(e) => handleMonthSelection(e, false)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500" />
                    )}
                    <p className="mt-1 text-xs text-gray-500">{isOngoing ? 'Campaign has no end date' : `Selected: ${formData.campaign_end_date || 'Not set'}`}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="active_status" name="active" checked={formData.active} onChange={handleInputChange} className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded" />
                    <label htmlFor="active_status" className="text-sm font-medium text-gray-700">Campaign Active</label>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-4">Location Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Address</label>
                    <AddressAutocomplete onAddressSelect={handleAddressSelect} initialAddress={formData.campaign_address} initialPostalCode={formData.campaign_postal_code} initialCity={formData.campaign_city} className="mb-2" placeholder="Search for an address" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                      <input type="text" name="campaign_address" value={formData.campaign_address} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500" placeholder="Enter street address" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                      <input type="text" name="campaign_postal_code" value={formData.campaign_postal_code} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500" placeholder="Enter postal code" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input type="text" name="campaign_city" value={formData.campaign_city} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500" placeholder="Enter city" required />
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Radius</label>
                        <span className="text-sm text-gray-500">{formData.campaign_radius} meters</span>
                      </div>
                      <div className="flex gap-2">
                        <input type="range" name="campaign_radius" min="500" max="5000" step="100" value={formData.campaign_radius} onChange={handleInputChange} className="w-2/3 h-10" />
                        <input type="number" name="campaign_radius" value={formData.campaign_radius} onChange={handleInputChange} className="w-1/3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500" min="100" max="10000" step="100" />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={handleGeocodeAddress} disabled={loadingGeocode || !formData.campaign_address || !formData.campaign_postal_code || !formData.campaign_city} className={`flex items-center px-4 py-2 rounded-md ${loadingGeocode ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : campaignAddressValid ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                      {loadingGeocode ? <><RefreshCw size={18} className="mr-2 animate-spin" />Geocoding...</> : campaignAddressValid ? <><Check size={18} className="mr-2" />Address Verified</> : <><MapPin size={18} className="mr-2" />Verify Address</>}
                    </button>
                  </div>
                  {campaignAddressValid && (
                    <div className="mt-4">
                      <div id="campaign-map" ref={mapContainerRef} className="w-full h-64 rounded-lg border border-gray-200"></div>
                      <p className="mt-1 text-xs text-gray-500 text-center">This map shows the campaign location with a {formData.campaign_radius} meter radius</p>
                    </div>
                  )}
                  {(!formData.campaign_coordinates || formData.campaign_coordinates.lat === 0 || formData.campaign_coordinates.lng === 0) && (
                    <div className="mt-2 text-sm text-amber-600 flex items-center"><AlertCircle size={14} className="mr-1" /><span>Please verify the address to set coordinates</span></div>
                  )}
                </div>
              </div>
            </div>
          )}
          {selectedTab === 'apartments' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-800">Available Apartments</h3>
                </div>
                <div className="mb-4">
                  <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search apartments..." className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500" ref={searchInputRef} />
                </div>
                <div className="border rounded-md overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b text-sm font-medium text-gray-500 flex">
                    <div className="w-8"></div>
                    <div className="w-16"></div>
                    <div className="flex-1">Address</div>
                    <div className="w-8"></div>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto">
                    {filteredApartments.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">No apartments found</div>
                    ) : (
                      filteredApartments.map((apt) => {
                        const isSelected = selectedApartmentKeys.includes(apt.key);
                        return (
                          <div key={apt.key} className={`px-4 py-3 flex items-center border-b last:border-b-0 ${isSelected ? 'bg-purple-50' : 'bg-white hover:bg-gray-50'} cursor-pointer`} onClick={() => handleSelectApartment(apt.key)}>
                            <div className="w-8">
                              <input type="checkbox" checked={isSelected} onChange={() => {}} className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded" />
                            </div>
                            <div className="w-16">
                              {apt.images?.length > 0 ? (
                                <img src={apt.images[0].url} alt={apt.address} className="w-12 h-12 object-cover rounded-md" />
                              ) : (
                                <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center"><span className="text-gray-400 text-xs">No image</span></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 ml-2">
                              <p className="text-sm font-medium text-gray-800 truncate">{apt.address}</p>
                              <p className="text-xs text-gray-500 truncate">{apt.postcode} {apt.city}</p>
                              <p className="text-xs text-gray-400 truncate">{apt.key}</p>
                            </div>
                            <div className="w-8 text-center">
                              <button onClick={(e) => handleOpenApartmentLink(apt.key, e)} className="text-blue-600 hover:text-blue-800" title="View apartment details"><ExternalLink size={16} /></button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-4">Selected Apartments ({selectedApartmentKeys.length})</h3>
                <div className="border rounded-md overflow-hidden">
                  <div className="max-h-[550px] overflow-y-auto">
                    {selectedApartmentKeys.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">No apartments selected</div>
                    ) : (
                      selectedApartmentKeys.map(key => {
                        const apt = apartments.find(a => a.key === key);
                        if (!apt) {
                          return (
                            <div key={key} className="px-4 py-3 border-b last:border-b-0 bg-red-50">
                              <p className="text-sm font-medium text-red-600">Invalid apartment key: {key}</p>
                              <button onClick={() => handleSelectApartment(key)} className="mt-1 text-xs text-red-600 hover:text-red-800">Remove</button>
                            </div>
                          );
                        }
                        return (
                          <div key={apt.key} className="px-4 py-3 flex items-center border-b last:border-b-0 hover:bg-gray-50">
                            <div className="w-16 mr-2">
                              {apt.images?.length > 0 ? (
                                <img src={apt.images[0].url} alt={apt.address} className="w-12 h-12 object-cover rounded-md" />
                              ) : (
                                <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center"><span className="text-gray-400 text-xs">No image</span></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{apt.address}</p>
                              <p className="text-xs text-gray-500 truncate">{apt.postcode} {apt.city}</p>
                              <p className="text-xs text-gray-400 truncate">{apt.key}</p>
                            </div>
                            <div className="flex items-center">
                              <button onClick={(e) => handleOpenApartmentLink(apt.key, e)} className="mr-2 text-blue-600 hover:text-blue-800" title="View apartment details"><ExternalLink size={16} /></button>
                              <button onClick={() => handleSelectApartment(apt.key)} className="p-1 text-red-600 hover:text-red-800 rounded-full hover:bg-red-50"><Trash size={16} /></button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {selectedTab === 'budget' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-4">Channel Selection</h3>
                <div className="space-y-6">
                  <div className={`border rounded-lg p-4 ${formData.channel_meta ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
                    <div className="flex items-center mb-4">
                      <input type="checkbox" id="channel_meta" checked={formData.channel_meta} onChange={() => handleChannelToggle('meta')} className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                      <label htmlFor="channel_meta" className="ml-2 text-lg font-medium text-gray-700">Meta</label>
                      {formData.channel_meta && <div className="ml-auto"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">Enabled</span></div>}
                    </div>
                    {formData.channel_meta && (
                      <div className="space-y-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Total Budget (€)</label>
                          <input type="number" name="budget_meta" value={formData.budget_meta} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Enter total budget" min="0" step="50" ref={budgetMetaRef} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Daily Budget (€)</label>
                          <input type="number" name="budget_meta_daily" value={formData.budget_meta_daily} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-100" placeholder="Calculated automatically" disabled />
                          <p className="mt-1 text-xs text-gray-500">Daily budget is calculated automatically from total budget</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={`border rounded-lg p-4 ${formData.channel_display ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                    <div className="flex items-center mb-4">
                      <input type="checkbox" id="channel_display" checked={formData.channel_display} onChange={() => handleChannelToggle('display')} className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
                      <label htmlFor="channel_display" className="ml-2 text-lg font-medium text-gray-700">Display</label>
                      {formData.channel_display && <div className="ml-auto"><span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">Enabled</span></div>}
                    </div>
                    {formData.channel_display && (
                      <div className="space-y-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Total Budget (€)</label>
                          <input type="number" name="budget_display" value={formData.budget_display} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500" placeholder="Enter total budget" min="0" step="50" ref={budgetDisplayRef} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Daily Budget (€)</label>
                          <input type="number" name="budget_display_daily" value={formData.budget_display_daily} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 bg-gray-100" placeholder="Calculated automatically" disabled />
                          <p className="mt-1 text-xs text-gray-500">Daily budget is calculated automatically from total budget</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Max CPM (€)</label>
                          <input type="number" name="max_cpm_display" value={formData.max_cpm_display} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500" placeholder="Enter max CPM" min="1" step="0.1" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={`border rounded-lg p-4 ${formData.channel_pdooh ? 'border-purple-300 bg-purple-50' : 'border-gray-200'}`}>
                    <div className="flex items-center mb-4">
                      <input type="checkbox" id="channel_pdooh" checked={formData.channel_pdooh} onChange={() => handleChannelToggle('pdooh')} className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded" />
                      <label htmlFor="channel_pdooh" className="ml-2 text-lg font-medium text-gray-700">PDOOH</label>
                      {formData.channel_pdooh && <div className="ml-auto"><span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">Enabled</span></div>}
                    </div>
                    {formData.channel_pdooh && (
                      <div className="space-y-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Total Budget (€)</label>
                          <input type="number" name="budget_pdooh" value={formData.budget_pdooh} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500" placeholder="Enter total budget" min="0" step="50" ref={budgetPdoohRef} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Daily Budget (€)</label>
                          <input type="number" name="budget_pdooh_daily" value={formData.budget_pdooh_daily} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-gray-100" placeholder="Calculated automatically" disabled />
                          <p className="mt-1 text-xs text-gray-500">Daily budget is calculated automatically from total budget</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Max CPM (€)</label>
                          <input type="number" name="max_cpm_pdooh" value={formData.max_cpm_pdooh} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500" placeholder="Enter max CPM" min="1" step="0.1" />
                        </div>
                      </div>
                    )}
                  </div>
                  {(formData.channel_display || formData.channel_pdooh) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bidding Strategy</label>
                      <select name="bidding_strategy" value={formData.bidding_strategy} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500">
                        <option value="even">Even</option>
                        <option value="asap">ASAP</option>
                        <option value="frontloaded">Frontloaded</option>
                        <option value="guaranteed">Guaranteed</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-4">Budget Summary</h3>
                <div className="bg-white border rounded-lg shadow-sm p-6 mb-6">
                  <h4 className="text-xl font-semibold text-gray-800 mb-4">Total Campaign Budget</h4>
                  <div className="space-y-4">
                    {formData.channel_meta && (
                      <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                        <span className="text-gray-600">Meta</span>
                        <span className="text-lg font-medium">€{formData.budget_meta ? parseFloat(formData.budget_meta.toString()).toFixed(2) : '0.00'}</span>
                      </div>
                    )}
                    {formData.channel_display && (
                      <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                        <span className="text-gray-600">Display</span>
                        <span className="text-lg font-medium">€{formData.budget_display ? parseFloat(formData.budget_display.toString()).toFixed(2) : '0.00'}</span>
                      </div>
                    )}
                    {formData.channel_pdooh && (
                      <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                        <span className="text-gray-600">PDOOH</span>
                        <span className="text-lg font-medium">€{formData.budget_pdooh ? parseFloat(formData.budget_pdooh.toString()).toFixed(2) : '0.00'}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-gray-800 font-medium">Total Budget</span>
                      <span className="text-2xl font-bold text-purple-700">€{((formData.channel_meta ? (formData.budget_meta ? parseFloat(formData.budget_meta.toString()) : 0) : 0) + (formData.channel_display ? (formData.budget_display ? parseFloat(formData.budget_display.toString()) : 0) : 0) + (formData.channel_pdooh ? (formData.budget_pdooh ? parseFloat(formData.budget_pdooh.toString()) : 0) : 0)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white border rounded-lg shadow-sm p-6">
                  <h4 className="text-xl font-semibold text-gray-800 mb-4">Daily Budget</h4>
                  <div className="space-y-4">
                    {formData.channel_meta && (
                      <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                        <span className="text-gray-600">Meta</span>
                        <span className="text-lg font-medium">€{formData.budget_meta_daily.toFixed(2)}</span>
                      </div>
                    )}
                    {formData.channel_display && (
                      <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                        <span className="text-gray-600">Display</span>
                        <span className="text-lg font-medium">€{formData.budget_display_daily.toFixed(2)}</span>
                      </div>
                    )}
                    {formData.channel_pdooh && (
                      <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                        <span className="text-gray-600">PDOOH</span>
                        <span className="text-lg font-medium">€{formData.budget_pdooh_daily.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-gray-800 font-medium">Total Daily Budget</span>
                      <span className="text-2xl font-bold text-purple-700">€{((formData.channel_meta ? formData.budget_meta_daily : 0) + (formData.channel_display ? formData.budget_display_daily : 0) + (formData.channel_pdooh ? formData.budget_pdooh_daily : 0)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div className="mt-6 bg-gray-50 border rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-2">Integration Status</h4>
                    {(formData.channel_display || formData.channel_pdooh) && (
                      <div className="text-sm text-gray-600">
                        <p>BidTheatre integration is {campaign?.bt_campaign_id ? 'active' : 'pending'}. {campaign?.bt_campaign_id && <span className="text-green-600 font-medium ml-1">Campaign ID: {campaign.bt_campaign_id}</span>}</p>
                        <p className="mt-1">Creatopy ad tags will be {campaign?.cr_ad_tags ? 'updated' : 'generated'} after saving.</p>
                      </div>
                    )}
                    {!formData.channel_display && !formData.channel_pdooh && (
                      <p className="text-sm text-gray-500">BidTheatre and Creatopy integrations are only available for Display or PDOOH channels.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-between p-6 border-t">
          <div>
            {selectedTab !== 'info' && (
              <button onClick={() => handleNavigateTabs('prev')} className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                <ChevronLeft size={18} className="mr-2" /> Previous
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
            {selectedTab === 'budget' ? (
              <button onClick={handleSaveCampaign} disabled={!isFormValid || saveInProgress} className={`px-4 py-2 rounded-md transition-colors ${!isFormValid || saveInProgress ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-purple-700 text-white hover:bg-purple-800'}`}>
                {saveInProgress ? <span className="flex items-center"><RefreshCw size={18} className="mr-2 animate-spin" />Saving...</span> : campaign ? 'Update Campaign' : 'Create Campaign'}
              </button>
            ) : (
              <button onClick={() => handleNavigateTabs('next')} className="flex items-center px-4 py-2 bg-purple-700 text-white rounded-md hover:bg-purple-800">
                Next <ChevronRight size={18} className="ml-2" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignModal;