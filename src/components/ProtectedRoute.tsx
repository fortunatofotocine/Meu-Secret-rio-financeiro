import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase, Profile } from '../lib/supabase';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const [isActivated, setIsActivated] = useState(false);
    const [profile, setProfile] = useState<Profile | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session) {
                    setAuthenticated(true);
                    
                    // Fetch full profile in one go
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .maybeSingle();
                    
                    if (profileData) {
                        setProfile(profileData as any);
                        setIsActivated(!!profileData.whatsapp_number);
                    }
                } else {
                    setAuthenticated(false);
                }
            } catch (err) {
                console.error("ProtectedRoute Error:", err);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setAuthenticated(!!session);
            if (!session) {
                setProfile(null);
                setIsActivated(false);
                setLoading(false);
            } else {
                // Re-check profile if session changed
                checkAuth();
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    if (!authenticated) {
        return <Navigate to="/login" replace />;
    }

    // 1. Activation Check (Now Optional - Link is handled inside the UI)
    // Removed mandatory redirect to /activate

    // 2. Already Activated but on /activate? Go home.
    if (isActivated && window.location.pathname === '/activate') {
        return <Navigate to="/" replace />;
    }

    // 3. Trial / Subscription Check (Only if already activated)
    if (profile && isActivated && window.location.pathname !== '/subscription-expired' && window.location.pathname !== '/access-denied') {
        const trialEnded = profile.trial_ends_at ? new Date(profile.trial_ends_at) < new Date() : false;
        const notActive = profile.subscription_status !== 'active';
        
        // 3.1 Hard block / Soft delete check
        if (profile.is_blocked || profile.deleted_at) {
          return <Navigate to="/access-denied" replace />;
        }

        if (trialEnded && notActive) {
            return <Navigate to="/subscription-expired" replace />;
        }
    }

    return <>{children}</>;
};

export default ProtectedRoute;
