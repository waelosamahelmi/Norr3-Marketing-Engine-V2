import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';
import { Plus, Edit, Trash, Search, X, RefreshCw, UserCheck, Shield, AlertTriangle, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import { jwtDecode } from 'jwt-decode';

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'partner',
    agent_key: '',
    partner_name: '',
    agency_id: '',
  });
  const [refreshing, setRefreshing] = useState(false);
  const [availableAgencies, setAvailableAgencies] = useState<Array<{agency_id: string, name: string}>>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const defaultPassword = 'Password123!';
  
  // Reference to store fetched apartment data
  const apartmentDataRef = useRef<any[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
    fetchAgencies();
    // Fetch apartment data immediately when component mounts
    fetchApartmentData();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return;
      }
      
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (error) throw error;
      
      setCurrentUser(userData);
      setIsAdmin(userData.role === 'admin');
      setIsManager(userData.role === 'manager');
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to manage users');
        setLoading(false);
        return;
      }
      
      // Fetch users
      let query = supabase.from('users').select('*');
      
      // Get the current user's role to determine what users they can see
      const { data: currentUserData, error: currentUserError } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();
      
      if (currentUserError) throw currentUserError;
      
      // If manager, don't show admin users
      if (currentUserData.role === 'manager') {
        query = query.neq('role', 'admin');
      }
      
      const { data, error } = await query.order('name');
      
      if (error) throw error;
      
      setUsers(data);
      
      // Log activity
      try {
        await supabase.from('activity_logs').insert({
          user_id: session.user.id,
          user_email: session.user.email,
          action: 'view_users',
          details: 'User viewed user management page',
        });
      } catch (logError) {
        console.error('Error logging activity:', logError);
        // Continue even if logging fails
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('agency_id, name')
        .order('name');
      
      if (error) throw error;
      
      setAvailableAgencies(data);
    } catch (error) {
      console.error('Error fetching agencies:', error);
      toast.error('Failed to load agencies');
    }
  };

  const fetchApartmentData = async () => {
    try {
      setRefreshing(true);
      
      // Fetch data from the apartments API
      const response = await fetch('/api/apartments');
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        // Store data in ref for later use
        apartmentDataRef.current = data;
        toast.success(`Loaded ${data.length} apartments data`);
      } else {
        throw new Error('Invalid data format: Expected an array');
      }
    } catch (error) {
      console.error('Error fetching apartment data:', error);
      toast.error('Failed to fetch apartment data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddUser = () => {
    setFormData({
      email: '',
      name: '',
      role: 'partner',
      agent_key: '',
      partner_name: 'Kiinteistömaailma',
      agency_id: '',
    });
    setPassword(defaultPassword);
    setShowAddModal(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      agent_key: user.agent_key,
      partner_name: user.partner_name,
      agency_id: user.agency_id || '',
    });
    setShowEditModal(true);
  };

  const handleAutoFill = () => {
    // If we have apartment data, use it to autofill fields
    if (apartmentDataRef.current.length > 0) {
      // Pick a random apartment to base the user on
      const randomIndex = Math.floor(Math.random() * apartmentDataRef.current.length);
      const apartmentData = apartmentDataRef.current[randomIndex];
      
      // Extract useful information from the apartment data
      const agentEmail = apartmentData.agent?.email || 'agent@kiinteistomaailma.fi';
      const agentKey = apartmentData.agent?.key || `agent-${Date.now()}`;
      const agencyName = apartmentData.agency || 'Kiinteistömaailma';
      const agencyId = apartmentData.agency_id || '';
      
      // Generate a name from the email
      const name = agentEmail.split('@')[0].replace('.', ' ');
      
      // Update form data
      setFormData({
        email: agentEmail,
        name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize first letter
        role: 'partner',
        agent_key: agentKey,
        partner_name: agencyName,
        agency_id: agencyId,
      });
      
      toast.success('Form auto-filled with data from apartment feed');
    } else {
      toast.error('No apartment data available for auto-fill');
      
      // Trigger a fetch attempt
      fetchApartmentData();
    }
  };

  const handleDeleteUser = async (user: User) => {
    // Don't allow deleting yourself
    if (user.id === currentUser?.id) {
      toast.error('You cannot delete your own account');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete user ${user.name}?`)) {
      return;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to perform this action');
        return;
      }
      
      // Get admin token for auth operations
      const supabaseAdmin = supabase.auth.admin;
      
      if (!supabaseAdmin) {
        // Use regular delete if admin API not available
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', user.id);
        
        if (error) throw error;
      } else {
        // Use service role API to delete the user
        const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
        
        if (serviceKey) {
          // Delete the user from auth.users using fetch with proper headers
          const deleteResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey // Add the apikey header that was missing
            }
          });
          
          if (!deleteResponse.ok) {
            const errorText = await deleteResponse.text();
            console.error('Error deleting user from auth:', errorText);
            throw new Error(`Failed to delete user: ${deleteResponse.status} ${errorText}`);
          }
          
          // The RLS policy with CASCADE delete should handle deletion from the users table
        } else {
          // Fallback to regular delete
          const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', user.id);
          
          if (error) throw error;
        }
      }
      
      // Update the users list
      setUsers(users.filter(u => u.id !== user.id));
      
      // Log activity
      try {
        await supabase.from('activity_logs').insert({
          user_id: session.user.id,
          user_email: session.user.email,
          action: 'delete_user',
          details: `User deleted: ${user.email}`,
        });
      } catch (logError) {
        console.error('Error logging activity:', logError);
        // Continue even if logging fails
      }
      
      toast.success('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(`Failed to delete user: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to perform this action');
        return;
      }
      
      if (!formData.email || !formData.name) {
        toast.error('Email and name are required');
        return;
      }
      
      // Restrict roles based on current user's role
      if (currentUser?.role === 'manager' && formData.role !== 'partner') {
        toast.error('Managers can only create partner users');
        return;
      }
      
      if (showEditModal && selectedUser) {
        // Update existing user
        const { error } = await supabase
          .from('users')
          .update({
            name: formData.name,
            role: formData.role,
            agent_key: formData.agent_key,
            partner_name: formData.partner_name,
            agency_id: formData.agency_id || null,
          })
          .eq('id', selectedUser.id);
        
        if (error) throw error;
        
        // Log activity
        try {
          await supabase.from('activity_logs').insert({
            user_id: session.user.id,
            user_email: session.user.email,
            action: 'update_user',
            details: `User updated: ${formData.email}`,
          });
        } catch (logError) {
          console.error('Error logging activity:', logError);
          // Continue even if logging fails
        }
        
        toast.success('User updated successfully');
        fetchUsers();
      } else if (showAddModal) {
        // Create new user
        
        // Check if user with same email already exists
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('email')
          .eq('email', formData.email)
          .maybeSingle();
        
        if (checkError) throw checkError;
        
        if (existingUser) {
          toast.error('User with this email already exists');
          return;
        }
        
        // Use service role key to create user auth record without affecting current session
        const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
        
        if (!serviceKey) {
          toast.error('Service role key is required to create users');
          return;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        
        // Create a new user with the service role
        const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey
          },
          body: JSON.stringify({
            email: formData.email,
            password: password || defaultPassword,
            email_confirm: true
          })
        });
        
        if (!response.ok) {
          const errorData = await response.text();
          console.error("API Error Response:", errorData);
          throw new Error(`Failed to create user: ${response.status} ${errorData}`);
        }
        
        const authData = await response.json();
        
        if (!authData || !authData.id) {
          throw new Error('Invalid response: No user ID returned from auth');
        }
        
        const newUserId = authData.id;
        
        // Now create the user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: newUserId,
            email: formData.email,
            name: formData.name,
            role: formData.role,
            agent_key: formData.agent_key,
            partner_name: formData.partner_name,
            agency_id: formData.agency_id || null,
          });
        
        if (profileError) throw profileError;
        
        // Log activity
        try {
          await supabase.from('activity_logs').insert({
            user_id: session.user.id,
            user_email: session.user.email,
            action: 'create_user',
            details: `User created: ${formData.email}`,
          });
        } catch (logError) {
          console.error('Error logging activity:', logError);
          // Continue even if logging fails
        }
        
        toast.success('User created successfully');
        fetchUsers();
      }
      
      setShowAddModal(false);
      setShowEditModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(`Failed to save user: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
  };

  const handleChangeUserPassword = async (user: User) => {
  try {
    const newPassword = prompt('Enter new password for user:');
    if (!newPassword) return;

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!serviceKey) {
      toast.error('Service role key is required to change passwords');
      return;
    }

    // Update user password using admin API
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey
      },
      body: JSON.stringify({
        password: newPassword
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update password: ${response.status} ${errorText}`);
    }

    // Log activity
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('activity_logs').insert({
        user_id: session.user.id,
        user_email: session.user.email,
        action: 'change_user_password',
        details: `Admin changed password for user: ${user.email}`,
      });
    }

    toast.success(`Password updated for ${user.email}`);
  } catch (error) {
    console.error('Error changing password:', error);
    toast.error(`Failed to change password: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
  }
};


const handleImpersonateUser = async (user: User) => {
  try {
    // Don't allow impersonating yourself
    if (user.id === currentUser?.id) {
      toast.error('You cannot impersonate yourself');
      return;
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      toast.error('You must be logged in to perform this action');
      return;
    }
    
    // Store current admin session
    localStorage.setItem('adminSession', JSON.stringify(session));
    localStorage.setItem('impersonating', 'true');
    localStorage.setItem('impersonatedUser', user.email);
    
    const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    
    if (!serviceKey) {
      toast.error('Service role key is required to impersonate users');
      return;
    }
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    // Generate a link that can be used for impersonation
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}/magiclink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey
      },
      body: JSON.stringify({
        email: user.email
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate impersonation link: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.action_link) {
      throw new Error('No action link returned from API');
    }
    
    // Extract the token from the action link
    const url = new URL(data.action_link);
    const token = url.searchParams.get('token');
    
    if (!token) {
      throw new Error('No token found in the impersonation link');
    }
    
    // Use the token to sign in as the user
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'magiclink',
    });
    
    if (error) {
      throw error;
    }
    
    // Log activity
    try {
      await supabase.from('activity_logs').insert({
        user_id: session.user.id,
        user_email: session.user.email,
        action: 'impersonate_user',
        details: `Admin impersonated user: ${user.email}`,
      });
    } catch (logError) {
      console.error('Error logging activity:', logError);
      // Continue even if logging fails
    }
    
    toast.success(`You are now impersonating ${user.name}`);
    
    // Refresh the page to ensure state is updated
    window.location.href = '/';
  } catch (error) {
    console.error('Error impersonating user:', error);
    toast.error(`Failed to impersonate user: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
  }
};


  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.agency_id && user.agency_id.toLowerCase().includes(searchTerm.toLowerCase()))
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
        <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
        
        <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={handleAddUser}
            className="flex items-center px-4 py-2 bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors"
          >
            <Plus size={18} className="mr-2" />
            Add User
          </button>
        </div>
      </div>
      
      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agency
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Partner
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {user.image_url ? (
                            <img className="h-10 w-10 rounded-full" src={user.image_url} alt={user.name} />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center">
                              <span className="text-white font-medium">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            Agent Key: {user.agent_key}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'admin' 
                          ? 'bg-red-100 text-red-800' 
                          : user.role === 'manager'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.agency_id ? (
                        availableAgencies.find(a => a.agency_id === user.agency_id)?.name || user.agency_id
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.partner_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
<div className="flex space-x-2">
  <button
    onClick={() => handleEditUser(user)}
    className="text-indigo-600 hover:text-indigo-900"
    title="Edit User"
  >
    <Edit size={18} />
  </button>
  
  {currentUser?.role === 'admin' && (
    <>
      {user.id !== currentUser.id && (
        <button
          onClick={() => handleImpersonateUser(user)}
          className="text-orange-600 hover:text-orange-900"
          title="Impersonate User"
        >
          <UserCheck size={18} />
        </button>
      )}
      <button
        onClick={() => handleChangeUserPassword(user)}
        className="text-yellow-600 hover:text-yellow-900"
        title="Change Password"
      >
        <Key size={18} />
      </button>
    </>
  )}
  
  {(currentUser?.role === 'admin' || 
    (currentUser?.role === 'manager' && user.role === 'partner')) && 
    user.id !== currentUser.id && (
    <button
      onClick={() => handleDeleteUser(user)}
      className="text-red-600 hover:text-red-900"
      title="Delete User"
    >
      <Trash size={18} />
    </button>
  )}
</div>

                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Add/Edit User Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">
                {showAddModal ? 'Add New User' : 'Edit User'}
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
            
            <form onSubmit={handleSaveUser}>
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                        showEditModal ? 'bg-gray-100' : ''
                      }`}
                      placeholder="Enter email address"
                      required
                      readOnly={showEditModal}
                    />
                  </div>
                  
                  {showAddModal && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Enter password or generate one"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600"
                        >
                          {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <span className="text-xs text-gray-500">Default: {defaultPassword}</span>
                        <button
                          type="button"
                          onClick={generatePassword}
                          className="text-xs text-purple-600 hover:text-purple-800"
                        >
                          Generate Random Password
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter full name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role *
                    </label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    >
                      <option value="partner">Partner</option>
                      {currentUser?.role === 'admin' && (
                        <>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </>
                      )}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Agent Key *
                    </label>
                    <input
                      type="text"
                      name="agent_key"
                      value={formData.agent_key}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter agent key"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Partner Name *
                    </label>
                    <input
                      type="text"
                      name="partner_name"
                      value={formData.partner_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter partner name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Agency
                    </label>
                    <select
                      name="agency_id"
                      value={formData.agency_id}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select an agency</option>
                      {availableAgencies.map(agency => (
                        <option key={agency.agency_id} value={agency.agency_id}>
                          {agency.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {showAddModal && (
                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={handleAutoFill}
                        className="flex items-center text-purple-600 hover:text-purple-800"
                      >
                        <RefreshCw size={16} className="mr-1" />
                        Auto-fill from apartment data
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end p-6 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 mr-2"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-700 text-white rounded-md hover:bg-purple-800 transition-colors"
                >
                  {showAddModal ? 'Add User' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Add missing Eye and EyeOff components
import { Eye, EyeOff } from 'lucide-react';

export default UserManagement;