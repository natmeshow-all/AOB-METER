import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSupabase, getSupabaseConfig } from '../services/supabaseClient';
import { COMPANY_INFO } from '../data/mockData';

// Available Tenant Organizations List
export const DEFAULT_ORGANIZATIONS = [
  {
    id: 'ORG-AOB',
    code: 'AOB',
    name: 'บริษัท เอโอเบสต์ จำกัด (ART OF BAKING CO., LTD.)',
    shortName: 'เอโอเบสต์ (AOB)',
    transformerKVA: 1600,
    rateKWh: 4.20,
    meterCount: 17,
    status: 'ACTIVE'
  },
  {
    id: 'ORG-GRAND',
    code: 'GDB',
    name: 'บริษัท แกรนด์ เบเกอรี่ อินดัสทรี จำกัด',
    shortName: 'แกรนด์ เบเกอรี่ (GDB)',
    transformerKVA: 2000,
    rateKWh: 4.25,
    meterCount: 12,
    status: 'ACTIVE'
  },
  {
    id: 'ORG-SIAMCOLD',
    code: 'SCS',
    name: 'บริษัท สยาม โคลด์ สตอเรจ จำกัด (คลังสินค้าห้องเย็น)',
    shortName: 'สยามโคลด์ (SCS)',
    transformerKVA: 2500,
    rateKWh: 4.15,
    meterCount: 18,
    status: 'ACTIVE'
  }
];

// Demo / Preset User Accounts
export const DEMO_USERS = [
  {
    id: 'user-super-admin',
    email: 'natshownolimit@gmail.com',
    fullName: 'คุณณัฐพงษ์ (Super Admin / ผู้พัฒนาระบบ)',
    role: 'SUPER_ADMIN',
    orgId: 'ORG-AOB',
    companyName: 'ระบบบริหารส่วนกลาง (All Tenants)'
  },
  {
    id: 'user-aob-manager',
    email: 'manager@artofbaking.com',
    fullName: 'คุณสุชาติ (ผู้จัดการโรงงาน AOB)',
    role: 'PLANT_MANAGER',
    orgId: 'ORG-AOB',
    companyName: 'บริษัท เอโอเบสต์ จำกัด'
  },
  {
    id: 'user-grand-manager',
    email: 'manager@grandbakery.com',
    fullName: 'คุณวิชัย (ผู้จัดการโรงงาน Grand Bakery)',
    role: 'PLANT_MANAGER',
    orgId: 'ORG-GRAND',
    companyName: 'บริษัท แกรนด์ เบเกอรี่ อินดัสทรี จำกัด'
  },
  {
    id: 'user-scs-manager',
    email: 'manager@siamcold.com',
    fullName: 'คุณกิตติศักดิ์ (ผู้จัดการ Siam Cold Storage)',
    role: 'PLANT_MANAGER',
    orgId: 'ORG-SIAMCOLD',
    companyName: 'บริษัท สยาม โคลด์ สตอเรจ จำกัด'
  }
];

// Helper to determine if an email belongs to Super Admin
export const isSuperAdminEmail = (email) => {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return lower === 'natshownolimit@gmail.com' || lower.includes('natshow') || lower.startsWith('admin@');
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('AOB_ACTIVE_USER');
      // Must return null if no saved user or if logged out, so LoginPortal is shown
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [activeOrgId, setActiveOrgId] = useState(() => {
    return currentUser?.orgId || 'ORG-AOB';
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  // Get active organization object
  const activeOrganization = DEFAULT_ORGANIZATIONS.find(org => org.id === activeOrgId) || DEFAULT_ORGANIZATIONS[0];

  // Save active user in localStorage on change
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('AOB_ACTIVE_USER', JSON.stringify(currentUser));
      setActiveOrgId(currentUser.orgId || 'ORG-AOB');
    } else {
      localStorage.removeItem('AOB_ACTIVE_USER');
    }
  }, [currentUser]);

  // Check Supabase real session on mount if configured
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const isSuper = isSuperAdminEmail(session.user.email);
        
        // Fetch user profile from Supabase profiles table
        supabase
          .from('profiles')
          .select('*, organizations(*)')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            const finalRole = isSuper ? 'SUPER_ADMIN' : (profile?.role || 'PLANT_MANAGER');
            setCurrentUser({
              id: session.user.id,
              email: session.user.email,
              fullName: profile?.full_name || (isSuper ? 'คุณณัฐพงษ์ (Super Admin)' : session.user.email.split('@')[0]),
              role: finalRole,
              orgId: profile?.org_id || 'ORG-AOB',
              companyName: profile?.organizations?.company_name || (isSuper ? 'ระบบบริหารส่วนกลาง (ทุกโรงงาน)' : 'โรงงานลูกค้า'),
              isRealSupabaseUser: true
            });
          })
          .catch(() => {
            // Fallback if profiles table is not yet queried
            setCurrentUser({
              id: session.user.id,
              email: session.user.email,
              fullName: isSuper ? 'คุณณัฐพงษ์ (Super Admin)' : session.user.email.split('@')[0],
              role: isSuper ? 'SUPER_ADMIN' : 'PLANT_MANAGER',
              orgId: 'ORG-AOB',
              companyName: isSuper ? 'ระบบบริหารส่วนกลาง (ทุกโรงงาน)' : 'โรงงานลูกค้า',
              isRealSupabaseUser: true
            });
          });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setCurrentUser(null);
        localStorage.removeItem('AOB_ACTIVE_USER');
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  // 1-Click Switch Organization (Available for SUPER_ADMIN)
  const switchOrganization = (orgId) => {
    const target = DEFAULT_ORGANIZATIONS.find(o => o.id === orgId);
    if (target) {
      setActiveOrgId(orgId);
    }
  };

  // 1-Click Login with Demo Accounts (Instant Test)
  const loginWithDemo = (demoUser) => {
    setCurrentUser(demoUser);
    setActiveOrgId(demoUser.orgId);
    setAuthError(null);
    setIsAuthModalOpen(false);
  };

  // Real Supabase Email/Password Login
  const loginWithSupabase = async (email, password) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    const supabase = getSupabase();

    if (!supabase) {
      setIsLoadingAuth(false);
      setAuthError("ยังไม่ได้ตั้งค่าเชื่อมต่อ Supabase URL และ Anon Key กรุณาตั้งค่าในแท็บ 'ตั้งค่า Supabase' หรือใช้โหมดทดสอบ");
      return false;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) throw error;

      if (data?.user) {
        const isSuper = isSuperAdminEmail(data.user.email);

        // Query user profile
        let profile = null;
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*, organizations(*)')
            .eq('id', data.user.id)
            .single();
          profile = prof;
        } catch {
          // If profile table not initialized yet, proceed safely
        }

        const finalRole = isSuper ? 'SUPER_ADMIN' : (profile?.role || 'PLANT_MANAGER');

        setCurrentUser({
          id: data.user.id,
          email: data.user.email,
          fullName: profile?.full_name || (isSuper ? 'คุณณัฐพงษ์ (Super Admin)' : data.user.email.split('@')[0]),
          role: finalRole,
          orgId: profile?.org_id || 'ORG-AOB',
          companyName: profile?.organizations?.company_name || (isSuper ? 'ระบบบริหารส่วนกลาง (ทุกโรงงาน)' : 'โรงงานลูกค้า'),
          isRealSupabaseUser: true
        });

        setIsAuthModalOpen(false);
        setIsLoadingAuth(false);
        return true;
      }
    } catch (err) {
      setIsLoadingAuth(false);
      setAuthError(err.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      return false;
    }
  };

  // Real Supabase User Registration
  const signUpWithSupabase = async (email, password, fullName, companyName, role = 'PLANT_MANAGER') => {
    setIsLoadingAuth(true);
    setAuthError(null);
    const supabase = getSupabase();

    if (!supabase) {
      setIsLoadingAuth(false);
      setAuthError("ยังไม่ได้ตั้งค่า Supabase URL ในระบบ");
      return false;
    }

    try {
      const isSuper = isSuperAdminEmail(email);
      const effectiveRole = isSuper ? 'SUPER_ADMIN' : role;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName,
            company_name: companyName,
            role: effectiveRole
          }
        }
      });

      if (error) throw error;

      if (data?.user) {
        alert("ลงทะเบียนสำเร็จ! สามารถเข้าสู่ระบบได้ทันที");
        setIsLoadingAuth(false);
        return true;
      }
    } catch (err) {
      setIsLoadingAuth(false);
      setAuthError(err.message || "เกิดข้อผิดพลาดในการลงทะเบียน");
      return false;
    }
  };

  // Sign out (Reliably resets state and redirects to LoginPortal)
  const logout = async () => {
    try {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
    } catch (e) {
      console.warn("Supabase sign out error:", e);
    } finally {
      localStorage.removeItem('AOB_ACTIVE_USER');
      try { sessionStorage.clear(); } catch {}
      setCurrentUser(null);
      setActiveOrgId('ORG-AOB');
      setIsAuthModalOpen(false);
    }
  };

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isPlantManager = currentUser?.role === 'PLANT_MANAGER' || isSuperAdmin;
  const isTechnician = currentUser?.role === 'TECHNICIAN' || isPlantManager;

  return (
    <AuthContext.Provider value={{
      currentUser,
      activeOrganization,
      activeOrgId,
      allOrganizations: DEFAULT_ORGANIZATIONS,
      isSuperAdmin,
      isPlantManager,
      isTechnician,
      isAuthModalOpen,
      setIsAuthModalOpen,
      authError,
      setAuthError,
      isLoadingAuth,
      switchOrganization,
      loginWithDemo,
      loginWithSupabase,
      signUpWithSupabase,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
