import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';
import { Plus, Edit, Trash, Search, X, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Agency {
  id: string;
  agency_id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

const AgencyManagement = () => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    agency_id: '',
    name: '',
    email: '',
  });
  const [refreshing, setRefreshing] = useState(false);
  const [jsonAgencies, setJsonAgencies] = useState<any[]>([]);

  useEffect(() => {
    checkAdminAndFetchData();
  }, []);

  const checkAdminAndFetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to view agencies');
        return;
      }
      
      // Check if user is admin
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();
      
      if (!userData || userData.role !== 'admin') {
        toast.error('You must be an admin to view agencies');
        return;
      }
      
      await fetchAgencies();
      await fetchJsonAgencies();
    } catch (error) {
      console.error('Error checking admin status:', error);
      toast.error('Failed to verify permissions');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      setAgencies(data);
    } catch (error) {
      console.error('Error fetching agencies:', error);
      toast.error('Failed to load agencies');
    }
  };

  const fetchJsonAgencies = async () => {
    try {
      const response = await fetch('/api/apartments');
      const data = await response.json();
      
      // Extract unique agencies from the JSON feed
      const uniqueAgencies = Array.from(
        new Set(
          data
            .filter((apt: any) => apt.agency)
            .map((apt: any) => ({
              id: apt.agency,
              name: apt.agency,
              email: apt.agencyEmail || ''
            }))
        )
      );
      
      setJsonAgencies(uniqueAgencies);
    } catch (error) {
      console.error('Error fetching JSON agencies:', error);
      toast.error('Failed to load agencies from JSON feed');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddAgency = () => {
    setFormData({
      agency_id: '',
      name: '',
      email: '',
    });
    setShowAddModal(true);
  };

  const handleEditAgency = (agency: Agency) => {
    setSelectedAgency(agency);
    setFormData({
      agency_id: agency.agency_id,
      name: agency.name,
      email: agency.email || '',
    });
    setShowEditModal(true);
  };

  const handleDeleteAgency = async (agency: Agency) => {
    if (!confirm(`Are you sure you want to delete agency ${agency.name}?`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('agencies')
        .delete()
        .eq('id', agency.id);
      
      if (error) throw error;
      
      setAgencies(agencies.filter(a => a.id !== agency.id));
      toast.success('Agency deleted successfully');
    } catch (error) {
      console.error('Error deleting agency:', error);
      toast.error('Failed to delete agency');
    }
  };

  const handleSaveAgency = async () => {
    try {
      if (!formData.agency_id || !formData.name) {
        toast.error('Agency ID and name are required');
        return;
      }
      
      if (showAddModal) {
        const { error } = await supabase
          .from('agencies')
          .insert({
            agency_id: formData.agency_id,
            name: formData.name,
            email: formData.email,
          });
        
        if (error) throw error;
        
        toast.success('Agency added successfully');
      } else if (showEditModal && selectedAgency) {
        const { error } = await supabase
          .from('agencies')
          .update({
            agency_id: formData.agency_id,
            name: formData.name,
            email: formData.email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedAgency.id);
        
        if (error) throw error;
        
        toast.success('Agency updated successfully');
      }
      
      await fetchAgencies();
      setShowAddModal(false);
      setShowEditModal(false);
      setSelectedAgency(null);
    } catch (error) {
      console.error('Error saving agency:', error);
      toast.error('Failed to save agency');
    }
  };

  const handleAutoFill = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/apartments');
      const data = await response.json();
      
      const uniqueAgencies = new Map();
      
      data.forEach((apt: any) => {
        if (apt.agency) {
          let agencyName;
          
          if (apt.agencyEmail) {
            const emailParts = apt.agencyEmail.split('@');
            if (emailParts.length === 2 && emailParts[1] === 'kiinteistomaailma.fi') {
              // Extract location from email (e.g., "malmi@kiinteistomaailma.fi" -> "Malmi")
              const location = emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1);
              // Create full name (e.g., "Kiinteistömaailma Malmi")
              agencyName = `Kiinteistömaailma ${location}`;
            } else {
              agencyName = apt.agency;
            }
          } else {
            agencyName = apt.agency;
          }
          
          uniqueAgencies.set(apt.agency, {
            agency_id: apt.agency,
            name: agencyName,
            email: apt.agencyEmail || '',
          });
        }
      });
      
      // Get existing agency IDs to avoid duplicates
      const existingIds = new Set(agencies.map(a => a.agency_id));
      
      // Convert Map to array and filter out existing agencies
      const newAgencies = Array.from(uniqueAgencies.values())
        .filter(a => !existingIds.has(a.agency_id));
      
      if (newAgencies.length === 0) {
        toast.info('No new agencies found to add');
        return;
      }
      
      // Insert new agencies with their actual names
      const { error } = await supabase
        .from('agencies')
        .insert(newAgencies);
      
      if (error) throw error;
      
      await fetchAgencies();
      
      // Show success message with count
      const count = newAgencies.length;
      toast.success(
        count === 1
          ? 'Added 1 new agency'
          : `Added ${count} new agencies`
      );
    } catch (error) {
      console.error('Error auto-filling agencies:', error);
      toast.error('Failed to auto-fill agencies');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedAgencies(filteredAgencies.map(agency => agency.id));
    } else {
      setSelectedAgencies([]);
    }
  };

  const handleSelectAgency = (id: string) => {
    setSelectedAgencies(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedAgencies.length === 0) {
      toast.error('No agencies selected');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedAgencies.length} selected agencies?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('agencies')
        .delete()
        .in('id', selectedAgencies);

      if (error) throw error;

      setAgencies(agencies.filter(a => !selectedAgencies.includes(a.id)));
      setSelectedAgencies([]);
      toast.success(`${selectedAgencies.length} agencies deleted successfully`);
    } catch (error) {
      console.error('Error deleting agencies:', error);
      toast.error('Failed to delete agencies');
    }
  };

  const filteredAgencies = agencies.filter(agency =>
    agency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agency.agency_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (agency.email && agency.email.toLowerCase().includes(searchTerm.toLowerCase()))
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
        <h1 className="text-2xl font-bold text-gray-800">Agency Management</h1>
        
        <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search agencies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={handleAutoFill}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw size={18} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Auto Fill
          </button>
          
          {selectedAgencies.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash size={18} className="mr-2" />
              Delete Selected ({selectedAgencies.length})
            </button>
          )}
          
          <button
            onClick={handleAddAgency}
            className="flex items-center px-4 py-2 bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors"
          >
            <Plus size={18} className="mr-2" />
            Add Agency
          </button>
        </div>
      </div>
      
      {/* Agencies Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedAgencies.length === filteredAgencies.length && filteredAgencies.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agency ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAgencies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    No agencies found
                  </td>
                </tr>
              ) : (
                filteredAgencies.map((agency) => (
                  <tr key={agency.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedAgencies.includes(agency.id)}
                        onChange={() => handleSelectAgency(agency.id)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {agency.agency_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {agency.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {agency.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditAgency(agency)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Edit size={18} />
                        </button>
                        
                        <button
                          onClick={() => handleDeleteAgency(agency)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Add/Edit Agency Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">
                {showAddModal ? 'Add New Agency' : 'Edit Agency'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Agency ID
                  </label>
                  <input
                    type="text"
                    name="agency_id"
                    value={formData.agency_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter agency ID"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter agency name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter email address"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end p-6 border-t">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 mr-2"
              >
                Cancel
              </button>
              
              <button
                onClick={handleSaveAgency}
                className="px-4 py-2 bg-purple-700 text-white rounded-md hover:bg-purple-800 transition-colors"
              >
                {showAddModal ? 'Add Agency' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgencyManagement;