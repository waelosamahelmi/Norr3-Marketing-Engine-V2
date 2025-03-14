import { Navigate, Outlet } from 'react-router-dom';
import { User } from '../types';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ProtectedRouteProps {
  user: User | null;
}

const ProtectedRoute = ({ user }: ProtectedRouteProps) => {
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('ProtectedRoute: Checking session...', session ? 'Session exists' : 'No session');
        
        if (error) {
          console.error('Error checking session:', error);
          await supabase.auth.signOut();
          return;
        }

        if (!session) {
          console.log('No session found but user exists, signing out');
          await supabase.auth.signOut();
          return;
        }

        // Verify user data exists
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userError || !userData) {
          console.error('Error verifying user data:', userError);
          await supabase.auth.signOut();
        }
      } catch (error) {
        console.error('Error in session check:', error);
        await supabase.auth.signOut();
      }
    };
    
    checkSession();

    // Set up auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        console.log('Auth state change in ProtectedRoute: SIGNED_OUT');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  if (!user) {
    console.log('No user in ProtectedRoute, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute