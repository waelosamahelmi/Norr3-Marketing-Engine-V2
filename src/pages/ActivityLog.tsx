import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ActivityLog } from '../types';
import { Search, Calendar, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

const ActivityLogPage = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetchActivityLogs();
  }, []);

  const fetchActivityLogs = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to view activity logs');
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
        toast.error('You must be an admin or manager to view activity logs');
        return;
      }
      
      setUserRole(userData.role);
      
      // Fetch activity logs
      let query = supabase
        .from('activity_logs')
        .select('*');
      
      // If user is a manager, exclude logs from norr3.fi and helmies.fi email domains
      if (userData.role === 'manager') {
        query = query
          .not('user_email', 'ilike', '%@norr3.fi')
          .not('user_email', 'ilike', '%@helmies.fi');
      }
      
      // Order by created_at desc
      query = query.order('created_at', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setLogs(data);
      
      // Log activity
      try {
        await supabase.from('activity_logs').insert({
          user_id: session.user.id,
          user_email: session.user.email,
          action: 'view_activity_logs',
          details: 'User viewed activity logs',
        });
      } catch (logError) {
        console.error('Error logging activity:', logError);
        // Continue even if logging fails
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    try {
      // Create CSV content
      const headers = [
        'Date',
        'User',
        'Action',
        'Details',
      ];
      
      const rows = filteredLogs.map(log => [
        format(parseISO(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.user_email,
        log.action,
        log.details,
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
      link.setAttribute('download', `activity_log_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Export completed');
    } catch (error) {
      console.error('Error exporting activity logs:', error);
      toast.error('Failed to export activity logs');
    }
  };

  // Filter logs based on search term and date filter
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = 
      !dateFilter || 
      log.created_at.startsWith(dateFilter);
    
    return matchesSearch && matchesDate;
  });

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
        <h1 className="text-2xl font-bold text-gray-800">Activity Log</h1>
        
        <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
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
      
      
      {/* Activity Log Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    No activity logs found
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(parseISO(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.user_email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        log.action.includes('create') 
                          ? 'bg-green-100 text-green-800'
                          : log.action.includes('update') || log.action.includes('edit')
                          ? 'bg-blue-100 text-blue-800'
                          : log.action.includes('delete')
                          ? 'bg-red-100 text-red-800'
                          : log.action.includes('login') || log.action.includes('logout')
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogPage;