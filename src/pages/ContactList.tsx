import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Plus, 
  Search, 
  Download, 
  Upload,
  Edit,
  Trash,
  X,
  Check,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface Contact {
  id: string;
  company: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  type: string;
  created_at: string;
  updated_at: string;
}

interface InvitationList {
  id: string;
  name: string;
  date: string;
  created_at: string;
  updated_at: string;
}

interface InvitationListContact {
  id: string;
  list_id: string;
  contact_id: string;
  selected: boolean;
  created_at: string;
  updated_at: string;
}

const ContactList = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invitationLists, setInvitationLists] = useState<InvitationList[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [deletingEmptyCompany, setDeletingEmptyCompany] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    company: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    type: '',
  });
  const [listFormData, setListFormData] = useState({
    name: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAdminAndFetchData();
  }, []);

  const checkAdminAndFetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to view contacts');
        return;
      }
      
      // Check if user is admin
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();
      
      if (!userData || userData.role !== 'admin') {
        toast.error('You must be an admin to view contacts');
        return;
      }
      
      await Promise.all([
        fetchContacts(),
        fetchInvitationLists()
      ]);
    } catch (error) {
      console.error('Error checking admin status:', error);
      toast.error('Failed to verify permissions');
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('last_name, first_name');
      
      if (error) throw error;
      
      setContacts(data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to load contacts');
    }
  };

  const fetchInvitationLists = async () => {
    try {
      const { data, error } = await supabase
        .from('invitation_lists')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      setInvitationLists(data);
    } catch (error) {
      console.error('Error fetching invitation lists:', error);
      toast.error('Failed to load invitation lists');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleListInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setListFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddContact = () => {
    setFormData({
      company: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      type: '',
    });
    setShowAddModal(true);
  };

  const handleEditContact = (contact: Contact) => {
    setSelectedContact(contact);
    setFormData({
      company: contact.company || '',
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email || '',
      phone: contact.phone || '',
      type: contact.type || '',
    });
    setShowEditModal(true);
  };

  const handleDeleteContact = async (contact: Contact) => {
    if (!confirm(`Are you sure you want to delete ${contact.first_name} ${contact.last_name}?`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contact.id);
      
      if (error) throw error;
      
      setContacts(contacts.filter(c => c.id !== contact.id));
      toast.success('Contact deleted successfully');
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Failed to delete contact');
    }
  };

  const handleSaveContact = async () => {
    try {
      if (!formData.first_name || !formData.last_name) {
        toast.error('First name and last name are required');
        return;
      }
      
      if (showAddModal) {
        const { error } = await supabase
          .from('contacts')
          .insert({
            ...formData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        
        if (error) throw error;
        
        toast.success('Contact added successfully');
      } else if (showEditModal && selectedContact) {
        const { error } = await supabase
          .from('contacts')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedContact.id);
        
        if (error) throw error;
        
        toast.success('Contact updated successfully');
      }
      
      await fetchContacts();
      setShowAddModal(false);
      setShowEditModal(false);
      setSelectedContact(null);
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error('Failed to save contact');
    }
  };

  const handleCreateList = async () => {
    try {
      if (!listFormData.name || !listFormData.date) {
        toast.error('List name and date are required');
        return;
      }
      
      if (selectedContacts.length === 0) {
        toast.error('Please select at least one contact');
        return;
      }
      
      // Create new invitation list
      const { data: newList, error: listError } = await supabase
        .from('invitation_lists')
        .insert({
          name: listFormData.name,
          date: listFormData.date,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (listError) throw listError;
      
      // Add selected contacts to the list
      const contactInserts = selectedContacts.map(contactId => ({
        list_id: newList.id,
        contact_id: contactId,
        selected: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      
      const { error: contactsError } = await supabase
        .from('invitation_list_contacts')
        .insert(contactInserts);
      
      if (contactsError) throw contactsError;
      
      await fetchInvitationLists();
      setShowCreateListModal(false);
      setSelectedContacts([]);
      toast.success('Invitation list created successfully');
    } catch (error) {
      console.error('Error creating invitation list:', error);
      toast.error('Failed to create invitation list');
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const rows = text.split('\n');
      
      // Skip header row and filter out empty rows
      const contacts = rows
        .slice(1)
        .filter(row => row.trim())
        .map(row => {
          const [company, first_name, last_name, email, phone, type] = row.split(',').map(cell => cell.trim());
          return {
            company,
            first_name,
            last_name,
            email,
            phone,
            type,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });
      
      const { error } = await supabase
        .from('contacts')
        .insert(contacts);
      
      if (error) throw error;
      
      await fetchContacts();
      toast.success(`Imported ${contacts.length} contacts`);
    } catch (error) {
      console.error('Error importing contacts:', error);
      toast.error('Failed to import contacts');
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ['Company', 'First Name', 'Last Name', 'Email', 'Phone', 'Type'];
      
      const rows = contacts.map(contact => [
        contact.company || '',
        contact.first_name,
        contact.last_name,
        contact.email || '',
        contact.phone || '',
        contact.type || '',
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `contacts_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Contacts exported successfully');
    } catch (error) {
      console.error('Error exporting contacts:', error);
      toast.error('Failed to export contacts');
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedContacts(filteredContacts.map(contact => contact.id));
    } else {
      setSelectedContacts([]);
    }
  };

  const handleSelectContact = (id: string) => {
    setSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedContacts.length === 0) {
      toast.error('No contacts selected');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedContacts.length} selected contacts?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', selectedContacts);

      if (error) throw error;

      setContacts(contacts.filter(c => !selectedContacts.includes(c.id)));
      setSelectedContacts([]);
      toast.success(`${selectedContacts.length} contacts deleted successfully`);
    } catch (error) {
      console.error('Error deleting contacts:', error);
      toast.error('Failed to delete contacts');
    }
  };

  const handleDeleteEmptyCompany = async () => {
    if (!confirm('Are you sure you want to delete all contacts with no company? This action cannot be undone.')) {
      return;
    }
    
    try {
      setDeletingEmptyCompany(true);
      
      // Get contacts with empty company
      const { data: contactsToDelete, error: fetchError } = await supabase
        .from('contacts')
        .select('id')
        .or('company.is.null,company.eq.');
      
      if (fetchError) throw fetchError;
      
      if (!contactsToDelete || contactsToDelete.length === 0) {
        toast.info('No contacts found with empty company field');
        setDeletingEmptyCompany(false);
        return;
      }
      
      // Delete contacts
      const { error: deleteError } = await supabase
        .from('contacts')
        .delete()
        .or('company.is.null,company.eq.');
      
      if (deleteError) throw deleteError;
      
      // Refresh contacts list
      await fetchContacts();
      toast.success(`${contactsToDelete.length} contacts with empty company deleted successfully`);
    } catch (error) {
      console.error('Error deleting contacts with empty company:', error);
      toast.error('Failed to delete contacts');
    } finally {
      setDeletingEmptyCompany(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (contact.company && contact.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (contact.email && contact.email.toLowerCase().includes(searchTerm.toLowerCase()))
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
        <h1 className="text-2xl font-bold text-gray-800">Contact List</h1>
        
        <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Upload size={18} className="mr-2" />
            Import CSV
          </button>
          
          <button
            onClick={handleExportCSV}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Download size={18} className="mr-2" />
            Export CSV
          </button>
          
          <button
            onClick={handleDeleteEmptyCompany}
            disabled={deletingEmptyCompany}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash size={18} className="mr-2" />
            {deletingEmptyCompany ? 'Deleting...' : 'Delete Empty Company'}
          </button>
          
          {selectedContacts.length > 0 && (
            <>
              <button
                onClick={() => setShowCreateListModal(true)}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FileText size={18} className="mr-2" />
                Create List ({selectedContacts.length})
              </button>
              
              <button
                onClick={handleDeleteSelected}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash size={18} className="mr-2" />
                Delete Selected
              </button>
            </>
          )}
          
          <button
            onClick={handleAddContact}
            className="flex items-center px-4 py-2 bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors"
          >
            <Plus size={18} className="mr-2" />
            Add Contact
          </button>
        </div>
      </div>
      
      {/* Contacts Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  First Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                    No contacts found
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr key={contact.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(contact.id)}
                        onChange={() => handleSelectContact(contact.id)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {contact.company || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {contact.first_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {contact.last_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {contact.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {contact.phone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {contact.type || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditContact(contact)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Edit size={18} />
                        </button>
                        
                        <button
                          onClick={() => handleDeleteContact(contact)}
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
      
      {/* Add/Edit Contact Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">
                {showAddModal ? 'Add New Contact' : 'Edit Contact'}
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
                    Company
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter company name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter first name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter last name"
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
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter phone number"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <input
                    type="text"
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter contact type"
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
                onClick={handleSaveContact}
                className="px-4 py-2 bg-purple-700 text-white rounded-md hover:bg-purple-800 transition-colors"
              >
                {showAddModal ? 'Add Contact' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Create List Modal */}
      {showCreateListModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">
                Create New Invitation List
              </h2>
              <button
                onClick={() => setShowCreateListModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    List Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={listFormData.name}
                    onChange={handleListInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., AFTER WORK 16TH/Apr/2025"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={listFormData.date}
                    onChange={handleListInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">
                    Selected contacts: {selectedContacts.length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end p-6 border-t">
              <button
                onClick={() => setShowCreateListModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 mr-2"
              >
                Cancel
              </button>
              
              <button
                onClick={handleCreateList}
                className="px-4 py-2 bg-purple-700 text-white rounded-md hover:bg-purple-800 transition-colors"
              >
                Create List
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Invitation Lists Section */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Invitation Lists</h2>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contacts
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invitationLists.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                      No invitation lists found
                    </td>
                  </tr>
                ) : (
                  invitationLists.map((list) => (
                    <tr key={list.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {list.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(list.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {/* TODO: Add contact count */}
                        -
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {/* TODO: View/edit list */}}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <FileText size={18} />
                          </button>
                          
                          <button
                            onClick={() => {/* TODO: Delete list */}}
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
      </div>
    </div>
  );
};

export default ContactList;