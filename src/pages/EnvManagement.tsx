import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Save, Check, X, RefreshCw, Plus, Trash, Edit, Eye, EyeOff, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

// Group environment variables by category
interface EnvGroup {
  name: string;
  description: string;
  variables: EnvVariable[];
  isOpen?: boolean;
}

interface EnvVariable {
  key: string;
  value: string;
  description: string;
  isSecret?: boolean;
  isEditing?: boolean;
  originalValue?: string;
}

const EnvManagement = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [envGroups, setEnvGroups] = useState<EnvGroup[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [newVariable, setNewVariable] = useState<{ group: string; key: string; value: string; description: string }>({
    group: '',
    key: '',
    value: '',
    description: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    checkAdminAndFetchEnv();
  }, []);

  const checkAdminAndFetchEnv = async () => {
    try {
      setLoading(true);
      
      // Check if user is admin
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to view this page');
        return;
      }
      
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
      
      if (!userData || userData.role !== 'admin') {
        toast.error('You do not have permission to access this page');
        setIsAdmin(false);
        return;
      }
      
      setIsAdmin(true);
      
      // Fetch env variables from the server
      await fetchEnvVariables();
      
      setLoading(false);
    } catch (error) {
      console.error('Error checking admin status:', error);
      toast.error('Failed to load environment variables');
      setLoading(false);
    }
  };

  const fetchEnvVariables = async () => {
    try {
      // In a real environment, we'd make an API call to fetch the variables
      // Since we can't directly access .env on the client, we'll mock this with
      // a call to a backend endpoint that would handle this securely
      
      // For now, we'll populate with the known env variables from .env.example
      const mockEnvGroups: EnvGroup[] = [
        {
          name: 'Supabase',
          description: 'Database and authentication configuration',
          isOpen: true,
          variables: [
            { key: 'VITE_SUPABASE_URL', value: import.meta.env.VITE_SUPABASE_URL || '', description: 'Supabase project URL' },
            { key: 'VITE_SUPABASE_ANON_KEY', value: import.meta.env.VITE_SUPABASE_ANON_KEY || '', description: 'Supabase anonymous key', isSecret: true }
          ]
        },
        {
          name: 'Google',
          description: 'Google API integrations',
          isOpen: true,
          variables: [
            { key: 'VITE_GOOGLE_MAPS_API_KEY', value: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '', description: 'Google Maps API key', isSecret: true },
            { key: 'VITE_GOOGLE_SHEET_ID', value: import.meta.env.VITE_GOOGLE_SHEET_ID || '', description: 'Google Sheet ID for campaign data' },
            { key: 'VITE_GOOGLE_CLIENT_ID', value: import.meta.env.VITE_GOOGLE_CLIENT_ID || '', description: 'Google API client ID', isSecret: true },
            { key: 'VITE_GOOGLE_CLIENT_SECRET', value: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '', description: 'Google API client secret', isSecret: true },
            { key: 'VITE_GOOGLE_REFRESH_TOKEN', value: import.meta.env.VITE_GOOGLE_REFRESH_TOKEN || '', description: 'Google API refresh token', isSecret: true },
            { key: 'VITE_GOOGLE_REDIRECT_URI', value: import.meta.env.VITE_GOOGLE_REDIRECT_URI || '', description: 'Google API redirect URI' }
          ]
        },
        {
          name: 'BidTheatre',
          description: 'BidTheatre API configuration for display and PDOOH campaigns',
          isOpen: true,
          variables: [
            { key: 'VITE_BIDTHEATRE_API_URL', value: import.meta.env.VITE_BIDTHEATRE_API_URL || '', description: 'BidTheatre API URL' },
            { key: 'VITE_BIDTHEATRE_NETWORK_ID', value: import.meta.env.VITE_BIDTHEATRE_NETWORK_ID || '', description: 'BidTheatre network ID' },
            { key: 'VITE_BIDTHEATRE_API_KEY', value: import.meta.env.VITE_BIDTHEATRE_API_KEY || '', description: 'BidTheatre API key', isSecret: true },
            { key: 'VITE_BIDTHEATRE_DISPLAY_MEDIA_LIST_ID', value: import.meta.env.VITE_BIDTHEATRE_DISPLAY_MEDIA_LIST_ID || '', description: 'BidTheatre display media list ID' },
            { key: 'VITE_BIDTHEATRE_DOOH_MEDIA_LIST_ID', value: import.meta.env.VITE_BIDTHEATRE_DOOH_MEDIA_LIST_ID || '', description: 'BidTheatre DOOH media list ID' }
          ]
        },
        {
          name: 'Creatopy',
          description: 'Creatopy API configuration for ad creatives',
          isOpen: true,
          variables: [
            { key: 'VITE_CREATOPY_API_KEY', value: import.meta.env.VITE_CREATOPY_API_KEY || '', description: 'Creatopy API key', isSecret: true },
            { key: 'VITE_CREATOPY_API_URL', value: import.meta.env.VITE_CREATOPY_API_URL || '', description: 'Creatopy API URL' }
          ]
        },
        {
          name: 'External',
          description: 'External API endpoints',
          isOpen: true,
          variables: [
            { key: 'VITE_JSON_FEED_URL', value: import.meta.env.VITE_JSON_FEED_URL || '', description: 'Apartment feed JSON URL' }
          ]
        }
      ];
      
      setEnvGroups(mockEnvGroups);
    } catch (error) {
      console.error('Error fetching environment variables:', error);
      toast.error('Failed to load environment variables');
    }
  };

  const toggleGroupOpen = (groupIndex: number) => {
    setEnvGroups(prevGroups => 
      prevGroups.map((group, idx) => 
        idx === groupIndex ? { ...group, isOpen: !group.isOpen } : group
      )
    );
  };

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEditToggle = (groupIndex: number, variableIndex: number) => {
    setEnvGroups(prevGroups => {
      const newGroups = [...prevGroups];
      const variable = {...newGroups[groupIndex].variables[variableIndex]};
      
      // Toggle editing state
      variable.isEditing = !variable.isEditing;
      
      // If entering edit mode, save original value
      if (variable.isEditing) {
        variable.originalValue = variable.value;
      }
      
      newGroups[groupIndex].variables[variableIndex] = variable;
      return newGroups;
    });
  };

  const handleValueChange = (groupIndex: number, variableIndex: number, value: string) => {
    setEnvGroups(prevGroups => {
      const newGroups = [...prevGroups];
      newGroups[groupIndex].variables[variableIndex].value = value;
      return newGroups;
    });
  };

  const handleCancelEdit = (groupIndex: number, variableIndex: number) => {
    setEnvGroups(prevGroups => {
      const newGroups = [...prevGroups];
      const variable = newGroups[groupIndex].variables[variableIndex];
      
      // Revert to original value and exit edit mode
      variable.value = variable.originalValue || '';
      variable.isEditing = false;
      
      return newGroups;
    });
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      
      // In a real implementation, we would save the changes to .env on the server
      // For this demo, we'll simulate success after a delay
      
      // Collect all variables to save
      const allVariables: { key: string; value: string }[] = [];
      
      envGroups.forEach(group => {
        group.variables.forEach(variable => {
          allVariables.push({
            key: variable.key,
            value: variable.value
          });
        });
      });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Log the activity
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        await supabase.from('activity_logs').insert({
          user_id: session.user.id,
          user_email: session.user.email,
          action: 'update_env_variables',
          details: `Updated ${allVariables.length} environment variables`
        });
      }
      
      // Exit edit mode for all variables
      setEnvGroups(prevGroups => {
        return prevGroups.map(group => ({
          ...group,
          variables: group.variables.map(variable => ({
            ...variable,
            isEditing: false
          }))
        }));
      });
      
      toast.success('Environment variables saved successfully');
    } catch (error) {
      console.error('Error saving environment variables:', error);
      toast.error('Failed to save environment variables');
    } finally {
      setSaving(false);
    }
  };

  const handleRestartServices = async () => {
    try {
      setRestarting(true);
      
      // In a real implementation, this would trigger a server restart or redeploy
      // For this demo, we'll simulate success after a delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Log the activity
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        await supabase.from('activity_logs').insert({
          user_id: session.user.id,
          user_email: session.user.email,
          action: 'restart_services',
          details: 'Restarted services after environment variable changes'
        });
      }
      
      toast.success('Services restarted successfully');
    } catch (error) {
      console.error('Error restarting services:', error);
      toast.error('Failed to restart services');
    } finally {
      setRestarting(false);
    }
  };

  const handleAddVariable = () => {
    // Validate new variable
    if (!newVariable.key || !newVariable.group) {
      toast.error('Group and key are required');
      return;
    }
    
    // Format the key if needed
    let formattedKey = newVariable.key.toUpperCase();
    if (!formattedKey.startsWith('VITE_')) {
      formattedKey = `VITE_${formattedKey}`;
    }
    
    // Add the new variable to the appropriate group
    setEnvGroups(prevGroups => {
      const newGroups = [...prevGroups];
      const groupIndex = newGroups.findIndex(g => g.name === newVariable.group);
      
      if (groupIndex !== -1) {
        // Check if the key already exists in this group
        const existingIndex = newGroups[groupIndex].variables.findIndex(v => v.key === formattedKey);
        
        if (existingIndex !== -1) {
          toast.error(`Variable ${formattedKey} already exists in ${newVariable.group}`);
          return prevGroups;
        }
        
        // Add the new variable
        newGroups[groupIndex].variables.push({
          key: formattedKey,
          value: newVariable.value,
          description: newVariable.description,
          isSecret: formattedKey.includes('KEY') || formattedKey.includes('SECRET') || formattedKey.includes('TOKEN')
        });
      } else {
        // Create a new group
        newGroups.push({
          name: newVariable.group,
          description: `${newVariable.group} configuration`,
          isOpen: true,
          variables: [{
            key: formattedKey,
            value: newVariable.value,
            description: newVariable.description,
            isSecret: formattedKey.includes('KEY') || formattedKey.includes('SECRET') || formattedKey.includes('TOKEN')
          }]
        });
      }
      
      return newGroups;
    });
    
    // Reset the form
    setNewVariable({
      group: '',
      key: '',
      value: '',
      description: ''
    });
    
    setShowAddForm(false);
    toast.success('New environment variable added');
  };

  const handleCopyValue = (value: string) => {
    navigator.clipboard.writeText(value)
      .then(() => toast.success('Value copied to clipboard'))
      .catch(() => toast.error('Failed to copy value'));
  };

  const handleDeleteVariable = (groupIndex: number, variableIndex: number) => {
    const group = envGroups[groupIndex];
    const variable = group.variables[variableIndex];
    
    if (confirm(`Are you sure you want to delete ${variable.key}?`)) {
      setEnvGroups(prevGroups => {
        const newGroups = [...prevGroups];
        newGroups[groupIndex].variables.splice(variableIndex, 1);
        
        // Remove the group if it's empty
        if (newGroups[groupIndex].variables.length === 0) {
          newGroups.splice(groupIndex, 1);
        }
        
        return newGroups;
      });
      
      toast.success(`Variable ${variable.key} deleted`);
    }
  };

  const anyVariableEditing = envGroups.some(group => 
    group.variables.some(variable => variable.isEditing)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-900"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
        <AlertCircle size={24} className="text-red-500 mr-2" />
        <p className="text-red-700">You do not have permission to access this page. Please contact an administrator if you need access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Environment Variables</h1>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors"
          >
            <Plus size={18} className="mr-2 inline-block" />
            Add Variable
          </button>
          
          <button
            onClick={handleSaveChanges}
            disabled={saving || !anyVariableEditing}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center ${
              saving || !anyVariableEditing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {saving ? (
              <>
                <RefreshCw size={18} className="mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} className="mr-2" />
                Save Changes
              </>
            )}
          </button>
          
          <button
            onClick={handleRestartServices}
            disabled={restarting}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center ${
              restarting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {restarting ? (
              <>
                <RefreshCw size={18} className="mr-2 animate-spin" />
                Restarting...
              </>
            ) : (
              <>
                <RefreshCw size={18} className="mr-2" />
                Apply & Restart
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <p className="text-yellow-700 text-sm">
          <AlertCircle size={16} className="inline-block mr-2" />
          <strong>Warning:</strong> Changing environment variables will affect the entire application. 
          After saving changes, you may need to restart services for changes to take effect.
        </p>
      </div>
      
      {/* Add New Variable Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-800">Add New Environment Variable</h2>
            <button 
              onClick={() => setShowAddForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Group
              </label>
              <select
                value={newVariable.group}
                onChange={(e) => setNewVariable(prev => ({ ...prev, group: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select a group</option>
                {envGroups.map(group => (
                  <option key={group.name} value={group.name}>{group.name}</option>
                ))}
                <option value="NEW">+ Create New Group</option>
              </select>
            </div>
            
            {newVariable.group === 'NEW' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Group Name
                </label>
                <input
                  type="text"
                  value={newVariable.group === 'NEW' ? '' : newVariable.group}
                  onChange={(e) => setNewVariable(prev => ({ ...prev, group: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Paypal, Stripe, etc."
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Key
              </label>
              <input
                type="text"
                value={newVariable.key}
                onChange={(e) => setNewVariable(prev => ({ ...prev, key: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., API_KEY (VITE_ will be added automatically)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value
              </label>
              <input
                type="text"
                value={newVariable.value}
                onChange={(e) => setNewVariable(prev => ({ ...prev, value: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter value"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={newVariable.description}
                onChange={(e) => setNewVariable(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Brief description of what this variable is used for"
              />
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 mr-2"
            >
              Cancel
            </button>
            
            <button
              onClick={handleAddVariable}
              disabled={!newVariable.key || !newVariable.group}
              className="px-4 py-2 bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:bg-purple-300 disabled:cursor-not-allowed"
            >
              Add Variable
            </button>
          </div>
        </div>
      )}
      
      {/* Environment Variables by Group */}
      <div className="space-y-6">
        {envGroups.map((group, groupIndex) => (
          <div key={group.name} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
            <div 
              className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer"
              onClick={() => toggleGroupOpen(groupIndex)}
            >
              <div>
                <h2 className="text-lg font-medium text-gray-800">{group.name}</h2>
                <p className="text-sm text-gray-500">{group.description}</p>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">
                  {group.variables.length} variable{group.variables.length !== 1 ? 's' : ''}
                </span>
                <button className="text-gray-400">
                  {group.isOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            
            {group.isOpen && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Key
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {group.variables.map((variable, variableIndex) => (
                      <tr key={variable.key}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {variable.key}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {variable.isEditing ? (
                            <input
                              type={variable.isSecret && !showSecrets[variable.key] ? 'password' : 'text'}
                              value={variable.value}
                              onChange={(e) => handleValueChange(groupIndex, variableIndex, e.target.value)}
                              className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span className="font-mono">
                                {variable.isSecret && !showSecrets[variable.key] 
                                  ? '••••••••••••••••' 
                                  : variable.value || '(not set)'}
                              </span>
                              {variable.isSecret && (
                                <button 
                                  onClick={() => toggleSecretVisibility(variable.key)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  {showSecrets[variable.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                              )}
                              <button 
                                onClick={() => handleCopyValue(variable.value)}
                                className="text-gray-400 hover:text-gray-600"
                                title="Copy value"
                              >
                                <Copy size={16} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {variable.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            {variable.isEditing ? (
                              <>
                                <button
                                  onClick={() => handleCancelEdit(groupIndex, variableIndex)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <X size={18} />
                                </button>
                                <button
                                  onClick={() => handleEditToggle(groupIndex, variableIndex)}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  <Check size={18} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEditToggle(groupIndex, variableIndex)}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  <Edit size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeleteVariable(groupIndex, variableIndex)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <Trash size={18} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Empty State */}
      {envGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-md border border-gray-200">
          <div className="text-center">
            <h2 className="text-xl font-medium text-gray-800 mb-2">No Environment Variables Found</h2>
            <p className="text-gray-500 mb-4">Add your first environment variable to get started.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors"
            >
              <Plus size={18} className="inline-block mr-2" />
              Add Variable
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnvManagement;