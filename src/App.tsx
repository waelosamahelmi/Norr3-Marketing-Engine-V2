import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { User } from './types';
import toast from 'react-hot-toast';
import { applyMigration } from './lib/applyMigration';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import UserManagement from './pages/UserManagement';
import ContactList from './pages/ContactList';
import AgencyManagement from './pages/AgencyManagement';
import ActivityLog from './pages/ActivityLog';
import MediaCosts from './pages/MediaCosts';
import EnvManagement from './pages/EnvManagement';
import AdCreatives from './pages/AdCreatives';
import NotFound from './pages/NotFound';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Separate component for routes to use hooks
function AppRoutes() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const authInitialized = useRef(false);
  const authCheckInProgress = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we're returning from an impersonation
    const checkImpersonation = async () => {
      const isImpersonating = localStorage.getItem('impersonating');
      const adminSessionData = localStorage.getItem('adminSession');
      
      if (isImpersonating === 'true' && location.pathname === '/') {
        // Show a banner that we're impersonating
        toast((t) => (
          <div>
            <span>You are impersonating a user. </span>
            <button 
              className="bg-blue-600 text-white px-2 py-1 rounded text-xs ml-2"
              onClick={async () => {
                toast.dismiss(t.id);
                
                // Sign out the impersonated user
                await supabase.auth.signOut();
                
                // Remove impersonation flags
                localStorage.removeItem('impersonating');
                localStorage.removeItem('impersonatedUser');
                
                if (adminSessionData) {
                  // Redirect to login with page refresh
                  window.location.href = '/login';
                }
              }}
            >
              Exit Impersonation
            </button>
          </div>
        ), { duration: 10000 });
      }
    };
    
    checkImpersonation();
  }, [location.pathname, navigate]);

  useEffect(() => {
    // Prevent multiple simultaneous auth checks
    if (authCheckInProgress.current) return;

    const checkAuth = async () => {
      try {
        authCheckInProgress.current = true;
        console.log('App: Checking authentication status...');

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          await supabase.auth.signOut();
          setUser(null);
          if (location.pathname !== '/login') {
            navigate('/login');
          }
          setLoading(false);
          return;
        }

        if (!session) {
          console.log('No active session');
          await supabase.auth.signOut();
          setUser(null);
          if (location.pathname !== '/login') {
            navigate('/login');
          }
          setLoading(false);
          return;
        }

        // Get user profile data
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (userError || !userData) {
          console.error('Error fetching user data:', userError);
          await supabase.auth.signOut();
          setUser(null);
          if (location.pathname !== '/login') {
            navigate('/login');
          }
          setLoading(false);
          return;
        } else {
          setUser(userData);
          if (location.pathname === '/login' && userData) {
            navigate('/');
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('App: Auth check error:', error);
        await supabase.auth.signOut();
        setUser(null);
        if (location.pathname !== '/login') {
          navigate('/login');
        }
        setLoading(false);
      } finally {
        authCheckInProgress.current = false;
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (authCheckInProgress.current) return;
      console.log('Auth state change event:', event);

      if (event === 'SIGNED_IN' && session) {
        try {
          // Get user profile data
          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
          
          if (error) {
            console.error('Error fetching user data on auth change:', error);
            await supabase.auth.signOut();
            setUser(null);
            if (location.pathname !== '/login') {
              navigate('/login');
            }
            return;
          }

          if (userData) {
            console.log('Auth state change: User found in database');
            setUser(userData as User);
            console.log('Auth state change: User set from database');
            if (location.pathname === '/login') {
              navigate('/');
            }
          } else {
            console.log('Auth state change: User not found in database');
            setUser(null);
            await supabase.auth.signOut();
            if (location.pathname !== '/login') {
              navigate('/login');
            }
          }
        } catch (error) {
          console.error('Error handling auth state change:', error);
          setUser(null);
          await supabase.auth.signOut();
          if (location.pathname !== '/login') {
            navigate('/login');
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        await supabase.auth.signOut();
        if (location.pathname !== '/login') {
          navigate('/login');
        }
        console.log('Auth state change: User signed out');
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, location]);
  
  // Show loading spinner only during initial load
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 to-purple-400">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      {!loading && (
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          
          <Route element={<ProtectedRoute user={user} />}>
            <Route element={<Layout user={user} />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="/agencies" element={<AgencyManagement />} />
              <Route path="/contacts" element={<ContactList />} />
              <Route path="/activity-log" element={<ActivityLog />} />
              <Route path="/media-costs" element={<MediaCosts />} />
              <Route path="/env-management" element={<EnvManagement />} />
              <Route path="/ad-creatives" element={<AdCreatives />} />
            </Route>
          </Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      )}
    </>
  );
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;