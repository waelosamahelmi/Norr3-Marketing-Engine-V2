import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Campaign, MediaCost } from '../types';
import { Search, Calendar, Download, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Bar } from 'react-chartjs-2';

const MediaCosts = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [mediaCosts, setMediaCosts] = useState<MediaCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [chartView, setChartView] = useState<'campaign' | 'channel'>('campaign');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to view media costs');
        return;
      }
      
      // Check if user is admin or manager
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();
      
      if (userError) {
        console.error('Error fetching user role:', userError);
        toast.error('Failed to verify permissions');
        return;
      }
      
      if (!userData || (userData.role !== 'admin' && userData.role !== 'manager')) {
        toast.error('You must be an admin or manager to view media costs');
        return;
      }
      
      setUserRole(userData.role);
      
      // Fetch campaigns
      let campaignQuery = supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      
      // If user is a manager, they can only see their campaigns or all campaigns if data is not tied to user
      // For simplicity, we're allowing managers to see all campaigns here
      
      const { data: campaignsData, error: campaignsError } = await campaignQuery;
      
      if (campaignsError) throw campaignsError;
      
      setCampaigns(campaignsData as Campaign[]);
      
      // Fetch media costs
      const { data: costsData, error: costsError } = await supabase
        .from('media_costs')
        .select('*')
        .order('date', { ascending: false });
      
      if (costsError) throw costsError;
      
      setMediaCosts(costsData as MediaCost[]);
      
      // Log activity
      try {
        await supabase.from('activity_logs').insert({
          user_id: session.user.id,
          user_email: session.user.email,
          action: 'view_media_costs',
          details: 'User viewed media costs data',
        });
      } catch (logError) {
        console.error('Error logging activity:', logError);
        // Continue even if logging fails
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load media costs data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    try {
      // Create CSV content
      const headers = [
        'Campaign',
        'Agent',
        'Channel',
        'Budget',
        'Actual Spend',
        'Difference',
      ];
      
      const rows = campaignSummary.map(item => [
        item.campaignId,
        item.agent,
        'All Channels',
        `€${item.budget.toFixed(2)}`,
        `€${item.spend.toFixed(2)}`,
        `€${(item.budget - item.spend).toFixed(2)}`,
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `media_costs_${monthFilter}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Export completed');
    } catch (error) {
      console.error('Error exporting media costs:', error);
      toast.error('Failed to export media costs');
    }
  };

  // Calculate campaign summary for the selected month
  const campaignSummary = campaigns
    .filter(campaign => {
      // Filter campaigns active in the selected month
      const startDate = parseISO(campaign.campaign_start_date);
      const endDate = campaign.campaign_end_date ? parseISO(campaign.campaign_end_date) : new Date(2099, 11, 31);
      const monthStart = parseISO(`${monthFilter}-01`);
      const monthEnd = endOfMonth(monthStart);
      
      return campaign.active && startDate <= monthEnd && endDate >= monthStart;
    })
    .map(campaign => {
      // Calculate budget for the month
      const budget = campaign.budget_meta + campaign.budget_display + campaign.budget_pdooh;
      
      // Calculate actual spend for the month
      const spend = mediaCosts
        .filter(cost => 
          cost.campaign_id === campaign.id && 
          cost.date.startsWith(monthFilter)
        )
        .reduce((sum, cost) => sum + cost.spend, 0);
      
      return {
        campaignId: campaign.id,
        agent: campaign.agent,
        budget,
        spend,
      };
    })
    .filter(item => 
      item.campaignId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.agent.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // Calculate channel summary for the selected month
  const channelSummary = {
    meta: {
      budget: campaigns
        .filter(campaign => {
          const startDate = parseISO(campaign.campaign_start_date);
          const endDate = campaign.campaign_end_date ? parseISO(campaign.campaign_end_date) : new Date(2099, 11, 31);
          const monthStart = parseISO(`${monthFilter}-01`);
          const monthEnd = endOfMonth(monthStart);
          
          return campaign.active && startDate <= monthEnd && endDate >= monthStart;
        })
        .reduce((sum, campaign) => sum + campaign.budget_meta, 0),
      spend: mediaCosts
        .filter(cost => 
          cost.date.startsWith(monthFilter) && 
          cost.channel === 'meta'
        )
        .reduce((sum, cost) => sum + cost.spend, 0),
    },
    display: {
      budget: campaigns
        .filter(campaign => {
          const startDate = parseISO(campaign.campaign_start_date);
          const endDate = campaign.campaign_end_date ? parseISO(campaign.campaign_end_date) : new Date(2099, 11, 31);
          const monthStart = parseISO(`${monthFilter}-01`);
          const monthEnd = endOfMonth(monthStart);
          
          return campaign.active && startDate <= monthEnd && endDate >= monthStart;
        })
        .reduce((sum, campaign) => sum + campaign.budget_display, 0),
      spend: mediaCosts
        .filter(cost => 
          cost.date.startsWith(monthFilter) && 
          cost.channel === 'display'
        )
        .reduce((sum, cost) => sum + cost.spend, 0),
    },
    pdooh: {
      budget: campaigns
        .filter(campaign => {
          const startDate = parseISO(campaign.campaign_start_date);
          const endDate = campaign.campaign_end_date ? parseISO(campaign.campaign_end_date) : new Date(2099, 11, 31);
          const monthStart = parseISO(`${monthFilter}-01`);
          const monthEnd = endOfMonth(monthStart);
          
          return campaign.active && startDate <= monthEnd && endDate >= monthStart;
        })
        .reduce((sum, campaign) => sum + campaign.budget_pdooh, 0),
      spend: mediaCosts
        .filter(cost => 
          cost.date.startsWith(monthFilter) && 
          cost.channel === 'pdooh'
        )
        .reduce((sum, cost) => sum + cost.spend, 0),
    },
  };

  // Prepare chart data for campaigns
  const campaignChartData = {
    labels: campaignSummary.map(item => item.campaignId.substring(0, 8) + '...'),
    datasets: [
      {
        label: 'Budget',
        data: campaignSummary.map(item => item.budget),
        backgroundColor: 'rgba(106, 27, 154, 0.5)',
        borderColor: 'rgba(106, 27, 154, 1)',
        borderWidth: 1,
      },
      {
        label: 'Actual Spend',
        data: campaignSummary.map(item => item.spend),
        backgroundColor: 'rgba(186, 104, 200, 0.5)',
        borderColor: 'rgba(186, 104, 200, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Prepare chart data for channels
  const channelChartData = {
    labels: ['Meta', 'Display', 'PDOOH'],
    datasets: [
      {
        label: 'Budget',
        data: [
          channelSummary.meta.budget,
          channelSummary.display.budget,
          channelSummary.pdooh.budget,
        ],
        backgroundColor: 'rgba(106, 27, 154, 0.5)',
        borderColor: 'rgba(106, 27, 154, 1)',
        borderWidth: 1,
      },
      {
        label: 'Actual Spend',
        data: [
          channelSummary.meta.spend,
          channelSummary.display.spend,
          channelSummary.pdooh.spend,
        ],
        backgroundColor: 'rgba(186, 104, 200, 0.5)',
        borderColor: 'rgba(186, 104, 200, 1)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: chartView === 'campaign' 
          ? `Campaign Spend for ${format(parseISO(`${monthFilter}-01`), 'MMMM yyyy')}`
          : `Channel Spend for ${format(parseISO(`${monthFilter}-01`), 'MMMM yyyy')}`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Amount (€)',
        },
      },
    },
  };

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
        <h1 className="text-2xl font-bold text-gray-800">Media Costs</h1>
        
        <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Download size={18} className="mr-2" />
            Export
          </button>
        </div>
      </div>
      
      {/* Channel Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-6 rounded-lg shadow-sm border border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-blue-800">Meta</h3>
              <p className="text-2xl font-semibold text-blue-900">€{channelSummary.meta.spend.toFixed(2)}</p>
              <p className="text-sm text-blue-700">
                Budget: €{channelSummary.meta.budget.toFixed(2)}
                <span className="ml-2">
                  ({channelSummary.meta.budget > 0 
                    ? ((channelSummary.meta.spend / channelSummary.meta.budget) * 100).toFixed(1) 
                    : '0.0'}%)
                </span>
              </p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <BarChart3 size={24} className="text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 p-6 rounded-lg shadow-sm border border-green-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-green-800">Display</h3>
              <p className="text-2xl font-semibold text-green-900">€{channelSummary.display.spend.toFixed(2)}</p>
              <p className="text-sm text-green-700">
                Budget: €{channelSummary.display.budget.toFixed(2)}
                <span className="ml-2">
                  ({channelSummary.display.budget > 0 
                    ? ((channelSummary.display.spend / channelSummary.display.budget) * 100).toFixed(1) 
                    : '0.0'}%)
                </span>
              </p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <BarChart3 size={24} className="text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 p-6 rounded-lg shadow-sm border border-purple-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-purple-800">PDOOH</h3>
              <p className="text-2xl font-semibold text-purple-900">€{channelSummary.pdooh.spend.toFixed(2)}</p>
              <p className="text-sm text-purple-700">
                Budget: €{channelSummary.pdooh.budget.toFixed(2)}
                <span className="ml-2">
                  ({channelSummary.pdooh.budget > 0 
                    ? ((channelSummary.pdooh.spend / channelSummary.pdooh.budget) * 100).toFixed(1) 
                    : '0.0'}%)
                </span>
              </p>
            </div>
            <div className="p-3 rounded-full bg-purple-100">
              <BarChart3 size={24} className="text-purple-600" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Chart Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Media Spend Analysis</h2>
          
          <div className="flex space-x-2 mt-2 sm:mt-0">
            <button
              onClick={() => setChartView('campaign')}
              className={`px-3 py-1 text-sm rounded-md ${
                chartView === 'campaign'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              By Campaign
            </button>
            
            <button
              onClick={() => setChartView('channel')}
              className={`px-3 py-1 text-sm rounded-md ${
                chartView === 'channel'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              By Channel
            </button>
          </div>
        </div>
        
        <div className="h-64">
          {chartView === 'campaign' ? (
            campaignSummary.length > 0 ? (
              <Bar
                data={campaignChartData}
                options={chartOptions}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No campaign data available for the selected month</p>
              </div>
            )
          ) : (
            <Bar
              data={channelChartData}
              options={chartOptions}
            />
          )}
        </div>
      </div>
      
      {/* Campaign Spend Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actual Spend
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Difference
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % of Budget
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaignSummary.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    No campaign data found for the selected month
                  </td>
                </tr>
              ) : (
                campaignSummary.map((item) => {
                  const difference = item.budget - item.spend;
                  const percentOfBudget = item.budget > 0 ? (item.spend / item.budget) * 100 : 0;
                  
                  return (
                    <tr key={item.campaignId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.campaignId.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.agent}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        €{item.budget.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        €{item.spend.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                        difference >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {difference >= 0 ? '+' : ''}€{difference.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-sm text-gray-500 mr-2">
                            {percentOfBudget.toFixed(1)}%
                          </span>
                          <div className="w-24 bg-gray-200 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full ${
                                percentOfBudget <= 85 
                                  ? 'bg-green-600' 
                                  : percentOfBudget <= 100 
                                  ? 'bg-yellow-500' 
                                  : 'bg-red-600'
                              }`}
                              style={{ width: `${Math.min(percentOfBudget, 100)}%` }}
                            ></div>
                          </div>
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
    </div>
  );
};

export default MediaCosts;