import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Campaign, CampaignApartment, Apartment, User } from '../types';
import { 
  LayoutDashboard, 
  Users, 
  Contact,
  Building2,
  Clock, 
  BarChart3, 
  LogOut, 
  Menu, 
  X, 
  ChevronDown,
  UserCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Database,
  UserCheck,
  Palette
} from 'lucide-react';
import toast from 'react-hot-toast';
import UserProfileModal from './UserProfileModal';
import NotificationCenter from './NotificationCenter';

interface LayoutProps {
  user: User | null;
}

const Layout = ({ user }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignApartments, setCampaignApartments] = useState<CampaignApartment[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const location = useLocation();
  const navigate = useNavigate();
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCampaignData();
      setIsAdmin(user.role === 'admin');
      setIsManager(user.role === 'manager');
    }
    
    // Check if we're impersonating
    const impersonating = localStorage.getItem('impersonating') === 'true';
    setIsImpersonating(impersonating);
  }, [user]);

  const fetchCampaignData = async () => {
    try {
      // Fetch campaigns
      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (campaignsData) {
        setCampaigns(campaignsData);
      }

      // Fetch campaign apartments
      const { data: campaignApartmentsData } = await supabase
        .from('campaign_apartments')
        .select('*');

      if (campaignApartmentsData) {
        setCampaignApartments(campaignApartmentsData);
      }

      // Fetch apartments from API
      const response = await fetch('/api/apartments');
      const apartmentsData = await response.json();
      
      if (Array.isArray(apartmentsData)) {
        setApartments(apartmentsData);
      }
    } catch (error) {
      console.error('Error fetching campaign data:', error);
    }
  };

  // Save sidebar state to localStorage
  const toggleSidebarCollapse = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
  };

  const handleSignOut = async () => {
    try {
      // If impersonating, restore the admin session
      if (isImpersonating) {
        const adminData = localStorage.getItem('adminSession');
        localStorage.removeItem('impersonating');
        localStorage.removeItem('impersonatedUser');
        
        await supabase.auth.signOut();
        
        // Redirect to login with page refresh
        window.location.href = '/login';
        return;
      }
      
      await supabase.auth.signOut();
      
      // Redirect to login with page refresh
      window.location.href = '/login';
    } catch (error) {
      toast.error('Error signing out');
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleUserMenu = () => {
    setUserMenuOpen(!userMenuOpen);
  };

  const handleProfileUpdate = async () => {
    // Refresh user data after profile update
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (userData) {
          // Force page refresh to get fresh data
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const exitImpersonation = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('impersonating');
      localStorage.removeItem('impersonatedUser');
      
      // Redirect to login page with page refresh
      window.location.href = '/login';
      
      toast.success('Exited impersonation mode');
    } catch (error) {
      console.error('Error exiting impersonation:', error);
      toast.error('Failed to exit impersonation mode');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-16' : 'w-60'} bg-gradient-to-b from-purple-900 to-purple-700 text-white transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 lg:relative`}
      >
        <div className="flex flex-col items-center h-14 px-1.5 border-b border-purple-800">
          <Link to="/" className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''} w-full h-full`}>
            <img 
              src={sidebarCollapsed ? "https://norr3.fi/wp-content/uploads/2025/03/icon.png" : "https://norr3.fi/wp-content/uploads/2023/06/logo_valk-web.png"}
              alt="NØRR3 Logo" 
              className={`${sidebarCollapsed ? 'h-9' : 'h-8'} w-auto transition-all duration-300`}
            />
            <span className={`ml-2 text-xl font-semibold transition-opacity duration-300 ${sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
            </span>
          </Link>
          <div className="flex items-center relative">
            <button 
              className="md:hidden text-white focus:outline-none mr-2" 
              onClick={toggleSidebar}
            >
              <X size={24} />
            </button>
          </div>
        </div>
        
        {/* Impersonation banner */}
        {isImpersonating && (
          <div className={`bg-amber-600 px-2 py-1 text-center ${sidebarCollapsed ? 'text-xs' : 'text-sm'}`}>
            {sidebarCollapsed ? (
              <span title="Impersonating">
                <UserCheck size={16} />
              </span>
            ) : (
              <>
                <span className="font-semibold">Impersonating</span>
                <button 
                  onClick={exitImpersonation}
                  className="ml-2 px-2 py-0.5 bg-white text-amber-600 rounded text-xs hover:bg-amber-100 transition-colors"
                >
                  Exit
                </button>
              </>
            )}
          </div>
        )}
        
        <nav className="mt-6 px-2">
          <ul className="space-y-1">
            <li>
              <Link 
                to="/" 
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''} px-3 py-2.5 rounded-lg transition-colors ${
                  location.pathname === '/' 
                    ? 'bg-purple-800 text-white' 
                    : 'text-purple-100 hover:bg-purple-800'
                }`}
              >
                <LayoutDashboard size={24} className={sidebarCollapsed ? '' : 'mr-3'} />
                <span className={`transition-opacity duration-300 ${sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                  Dashboard
                </span>
              </Link>
            </li>
            
            {/* Show user management link for both admins and managers */}
            {(isAdmin || isManager) && (
              <li>
                <Link 
                  to="/users" 
                  className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''} px-3 py-3 rounded-lg transition-colors ${
                    location.pathname === '/users' 
                      ? 'bg-purple-800 text-white' 
                      : 'text-purple-100 hover:bg-purple-800'
                  }`}
                >
                  <Users size={24} className={sidebarCollapsed ? '' : 'mr-3'} />
                  <span className={`transition-opacity duration-300 ${sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                    User Management
                  </span>
                </Link>
              </li>
            )}
            
            {isAdmin && (
              <li>
                <Link 
                  to="/contacts" 
                  className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''} px-3 py-3 rounded-lg transition-colors ${
                    location.pathname === '/contacts' 
                      ? 'bg-purple-800 text-white' 
                      : 'text-purple-100 hover:bg-purple-800'
                  }`}
                >
                  <Contact size={24} className={sidebarCollapsed ? '' : 'mr-3'} />
                  <span className={`transition-opacity duration-300 ${sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                    Contact List
                  </span>
                </Link>
              </li>
            )}
            
            {isAdmin && (
              <li>
                <Link 
                  to="/agencies" 
                  className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''} px-3 py-3 rounded-lg transition-colors ${
                    location.pathname === '/agencies' 
                      ? 'bg-purple-800 text-white' 
                      : 'text-purple-100 hover:bg-purple-800'
                  }`}
                >
                  <Building2 size={24} className={sidebarCollapsed ? '' : 'mr-3'} />
                  <span className={`transition-opacity duration-300 ${sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                    Agency Management
                  </span>
                </Link>
              </li>
            )}
            
            {(isAdmin || isManager) && (
              <li>
                <Link 
                  to="/media-costs" 
                  className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''} px-3 py-3 rounded-lg transition-colors ${
                    location.pathname === '/media-costs' 
                      ? 'bg-purple-800 text-white' 
                      : 'text-purple-100 hover:bg-purple-800'
                  }`}
                >
                  <BarChart3 size={24} className={sidebarCollapsed ? '' : 'mr-3'} />
                  <span className={`transition-opacity duration-300 ${sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                    Media Costs
                  </span>
                </Link>
              </li>
            )}
            
            {(isAdmin || isManager) && (
              <li>
                <Link 
                  to="/activity-log" 
                  className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''} px-3 py-3 rounded-lg transition-colors ${
                    location.pathname === '/activity-log' 
                      ? 'bg-purple-800 text-white' 
                      : 'text-purple-100 hover:bg-purple-800'
                  }`}
                >
                  <Clock size={24} className={sidebarCollapsed ? '' : 'mr-3'} />
                  <span className={`transition-opacity duration-300 ${sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                    Activity Log
                  </span>
                </Link>
              </li>
            )}
            
            {isAdmin && (
              <>
                <li>
                  <Link 
                    to="/ad-creatives" 
                    className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''} px-3 py-3 rounded-lg transition-colors ${
                      location.pathname === '/ad-creatives' 
                        ? 'bg-purple-800 text-white' 
                        : 'text-purple-100 hover:bg-purple-800'
                    }`}
                  >
                    <Palette size={24} className={sidebarCollapsed ? '' : 'mr-3'} />
                    <span className={`transition-opacity duration-300 ${sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                      Ad Creatives
                    </span>
                  </Link>
                </li>
                
                <li>
                  <Link 
                    to="/env-management" 
                    className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''} px-3 py-3 rounded-lg transition-colors ${
                      location.pathname === '/env-management' 
                        ? 'bg-purple-800 text-white' 
                        : 'text-purple-100 hover:bg-purple-800'
                    }`}
                  >
                    <Database size={24} className={sidebarCollapsed ? '' : 'mr-3'} />
                    <span className={`transition-opacity duration-300 ${sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                      Environment
                    </span>
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
        
        <div className={`absolute bottom-0 w-full p-2 border-t border-purple-800 ${sidebarCollapsed ? 'text-center' : ''}`}>
          {/* Settings Button */}
          <button
            onClick={() => setShowProfileModal(true)}
            className={`mb-4 flex items-center ${sidebarCollapsed ? 'justify-center' : ''} w-full px-3 py-3 text-purple-100 hover:bg-purple-800 transition-colors rounded-lg`}
          >
            <Settings size={24} />
            <span className={`ml-3 transition-opacity duration-300 ${sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
              Settings
            </span>
          </button>

          <div className="flex items-center">
            <div className="flex-shrink-0">
              {user?.image_url ? (
                <img 
                  src={user.image_url} 
                  alt={user.name} 
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-purple-500 flex items-center justify-center">
                  <span className="text-white text-lg font-medium">
                    {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
                  </span>
                </div>
              )}
            </div>
            <div className={`ml-3 flex-1 ${sidebarCollapsed ? 'hidden' : ''}`}>
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-purple-200">{user?.role}</p>
            </div>
          </div>
          <button 
            onClick={handleSignOut}
            className={`mt-4 w-full flex items-center justify-center px-3 py-3 text-sm text-white bg-purple-800 rounded-lg hover:bg-purple-600 transition-colors ${sidebarCollapsed ? 'px-0' : ''}`}
          >
            <LogOut size={24} className={sidebarCollapsed ? '' : 'mr-2'} />
            <span className={`${sidebarCollapsed ? 'hidden' : ''}`}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Collapse Toggle Button */}
      <button
        onClick={toggleSidebarCollapse}
        className={`fixed left-0 top-1/2 transform -translate-y-1/2 z-50 hidden lg:flex items-center justify-center w-6 h-12 bg-purple-800 hover:bg-purple-700 text-white rounded-r-lg shadow-lg transition-all duration-300 ${
          sidebarCollapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-16'
      }`}>
        {/* Top Navigation */}
        <header className="bg-white shadow-sm z-30 sticky top-0">
          <div className="flex items-center justify-between h-16 px-4 max-w-[100vw]">
            <button 
              className="lg:hidden text-gray-600 focus:outline-none p-2 -ml-2" 
              onClick={toggleSidebar}
            >
              <Menu size={24} />
            </button>
            
            {isImpersonating && (
              <div className="lg:hidden bg-amber-100 border border-amber-300 px-3 py-1 rounded-full text-amber-800 text-sm font-medium flex items-center">
                <UserCheck size={16} className="mr-1" />
                Impersonating
                <button 
                  onClick={exitImpersonation}
                  className="ml-2 px-2 py-0.5 bg-amber-600 text-white rounded-full text-xs hover:bg-amber-700 transition-colors"
                >
                  Exit
                </button>
              </div>
            )}
            
            <div className="flex items-center gap-1 sm:gap-2 ml-auto">
              {/* Notification Center */}
              <NotificationCenter
                isAdmin={isAdmin}
                campaigns={campaigns}
                campaignApartments={campaignApartments}
                apartments={apartments}
              />

              {/* Mobile User Menu */}
              <div className="relative lg:hidden">
                <button 
                  onClick={toggleUserMenu}
                  className="flex items-center text-gray-700 focus:outline-none p-2"
                >
                  <span className="mr-2 text-sm hidden sm:block">{user?.name}</span>
                  <ChevronDown size={16} />
                </button>
                
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1">
                    <button 
                      onClick={() => setShowProfileModal(true)}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <UserCircle size={16} className="inline mr-2" />
                      Profile
                    </button>
                    <button 
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut size={16} className="inline mr-2" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5 bg-gray-50">
          <Outlet />
        </main>
      </div>
      
      {/* User Profile Modal */}
      {showProfileModal && user && (
        <UserProfileModal 
          user={user} 
          onClose={() => setShowProfileModal(false)} 
          onUpdate={handleProfileUpdate}
        />
      )}
    </div>
  );
};

export default Layout;