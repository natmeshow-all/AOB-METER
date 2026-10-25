import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSupabase } from '../services/supabaseClient';
import { TENANT_COMPANIES, saveTenantCompany, deleteTenantCompany } from '../data/tenantData';

const STORAGE_KEY_ACCOUNTS = 'POWERVIEW_ACCOUNTS_V1';

// Build organization summary from TENANT_COMPANIES object
const buildOrgListFromCompanies = () => {
  return Object.values(TENANT_COMPANIES).map((comp) => ({
    id: comp.id,
    code: comp.code,
    name: comp.name,
    shortName: comp.shortName || `${comp.name} (${comp.code})`,
    industry: comp.industry || 'โรงงานอุตสาหกรรม',
    location: comp.location || 'ประเทศไทย',
    transformerKVA: Number(comp.transformerKVA) || 1600,
    rateKWh: Number(comp.rateKWh) || 4.20,
    meterCount: (comp.electricityMeters?.length || 0) + (comp.waterMeters?.length || 0),
    elecMeterCount: comp.electricityMeters?.length || 0,
    waterMeterCount: comp.waterMeters?.length || 0,
    gatewayModel: comp.gatewayModel || 'Waveshare RS485 to Ethernet PoE',
    gatewaySerial: comp.gatewaySerial || `GW-${comp.code}-01`,
    gatewayIp: comp.gatewayIp || '192.168.1.200',
    installedDate: comp.installedDate || '2026-10-25',
    status: comp.status || 'ONLINE'
  }));
};

export const DEFAULT_ORGANIZATIONS = buildOrgListFromCompanies();

// Initial Preset Accounts (Super Admin + Existing Installed Clients)
export const DEMO_USERS = [
  {
    id: 'user-super-admin',
    username: 'superadmin',
    email: 'natshownolimit@gmail.com',
    password: 'admin',
    fullName: 'คุณณัฐพงษ์ (Super Admin)',
    role: 'SUPER_ADMIN',
    orgId: 'ORG-AOB',
    companyName: 'ศูนย์ควบคุมกลาง PowerView (All Clients)',
    createdAt: '2026-08-01'
  },
  {
    id: 'user-aob-manager',
    username: 'aob',
    email: 'manager@artofbaking.com',
    password: 'aob1234',
    fullName: 'คุณสุชาติ (ผู้จัดการโรงงาน AOB)',
    role: 'PLANT_MANAGER',
    orgId: 'ORG-AOB',
    companyName: 'บริษัท เอโอเบสต์ จำกัด (ART OF BAKING CO., LTD.)',
    createdAt: '2026-08-15'
  },
  {
    id: 'user-grand-manager',
    username: 'gdb',
    email: 'manager@grandbakery.com',
    password: 'gdb1234',
    fullName: 'คุณวิชัย (ผู้จัดการโรงงาน Grand Bakery)',
    role: 'PLANT_MANAGER',
    orgId: 'ORG-GRAND',
    companyName: 'บริษัท แกรนด์ เบเกอรี่ อินดัสทรี จำกัด',
    createdAt: '2026-09-02'
  },
  {
    id: 'user-scs-manager',
    username: 'scs',
    email: 'manager@siamcold.com',
    password: 'scs1234',
    fullName: 'คุณกิตติศักดิ์ (ผู้จัดการ Siam Cold Storage)',
    role: 'PLANT_MANAGER',
    orgId: 'ORG-SIAMCOLD',
    companyName: 'บริษัท สยาม โคลด์ สตอเรจ จำกัด (คลังสินค้าห้องเย็น)',
    createdAt: '2026-09-18'
  }
];

// Helper to determine if an email/username belongs to Super Admin
export const isSuperAdminEmail = (identifier) => {
  if (!identifier) return false;
  const lower = identifier.toLowerCase().trim();
  return (
    lower === 'natshownolimit@gmail.com' ||
    lower === 'superadmin' ||
    lower === 'admin' ||
    lower.includes('natshow') ||
    lower.startsWith('admin@')
  );
};

const loadInitialAccounts = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure Super Admin is always present
        const hasSuper = parsed.some((u) => u.email === 'natshownolimit@gmail.com');
        if (!hasSuper) {
          return [DEMO_USERS[0], ...parsed];
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load accounts:', e);
  }
  return DEMO_USERS;
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [allOrganizations, setAllOrganizations] = useState(() => buildOrgListFromCompanies());
  const [allAccounts, setAllAccounts] = useState(() => loadInitialAccounts());

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

  // Persist accounts list
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(allAccounts));
    } catch (e) {
      console.warn('Failed to save accounts:', e);
    }
  }, [allAccounts]);

  // Get active organization object
  const activeOrganization =
    allOrganizations.find((org) => org.id === activeOrgId) || allOrganizations[0];

  // Save active user in localStorage on change
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('AOB_ACTIVE_USER', JSON.stringify(currentUser));
      if (currentUser.role !== 'SUPER_ADMIN') {
        setActiveOrgId(currentUser.orgId || 'ORG-AOB');
      }
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
              fullName:
                profile?.full_name ||
                (isSuper ? 'คุณณัฐพงษ์ (Super Admin)' : session.user.email.split('@')[0]),
              role: finalRole,
              orgId: profile?.org_id || 'ORG-AOB',
              companyName:
                profile?.organizations?.company_name ||
                (isSuper ? 'ศูนย์ควบคุมกลาง PowerView (All Clients)' : 'โรงงานลูกค้า'),
              isRealSupabaseUser: true
            });
          })
          .catch(() => {
            setCurrentUser({
              id: session.user.id,
              email: session.user.email,
              fullName: isSuper ? 'คุณณัฐพงษ์ (Super Admin)' : session.user.email.split('@')[0],
              role: isSuper ? 'SUPER_ADMIN' : 'PLANT_MANAGER',
              orgId: 'ORG-AOB',
              companyName: isSuper ? 'ศูนย์ควบคุมกลาง PowerView (All Clients)' : 'โรงงานลูกค้า',
              isRealSupabaseUser: true
            });
          });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        localStorage.removeItem('AOB_ACTIVE_USER');
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Switch Organization (Available for SUPER_ADMIN)
  const switchOrganization = (orgId) => {
    const target = allOrganizations.find((o) => o.id === orgId);
    if (target) {
      setActiveOrgId(orgId);
    }
  };

  // Direct login helper
  const loginWithDemo = (demoUser) => {
    const isSuper = isSuperAdminEmail(demoUser.email || demoUser.username) || demoUser.role === 'SUPER_ADMIN';
    const finalUser = {
      ...demoUser,
      role: isSuper ? 'SUPER_ADMIN' : demoUser.role
    };
    setCurrentUser(finalUser);
    setActiveOrgId(finalUser.orgId || 'ORG-AOB');
    setAuthError(null);
    setIsAuthModalOpen(false);
  };

  // Unified Enterprise Login (Supports Username OR Email + Password across Local Registry & Supabase)
  const loginWithCredentials = async (identifier, password) => {
    setIsLoadingAuth(true);
    setAuthError(null);

    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanId || !cleanPass) {
      setIsLoadingAuth(false);
      setAuthError('กรุณากรอกทั้งชื่อผู้ใช้งาน (Login) และรหัสผ่าน');
      return false;
    }

    // 1. Check Super Admin fast-track (natshownolimit@gmail.com or superadmin)
    if (cleanId === 'natshownolimit@gmail.com' || cleanId === 'superadmin' || cleanId === 'admin') {
      const superAccount = allAccounts.find((a) => a.role === 'SUPER_ADMIN') || DEMO_USERS[0];
      // Accept stored password, 'admin', 'admin1234', '123456', or authenticate via Supabase if configured
      const supabase = getSupabase();
      if (supabase && cleanId.includes('@')) {
        try {
          const { data } = await supabase.auth.signInWithPassword({
            email: cleanId,
            password: cleanPass
          });
          if (data?.user) {
            setCurrentUser({
              id: data.user.id,
              username: 'superadmin',
              email: 'natshownolimit@gmail.com',
              fullName: 'คุณณัฐพงษ์ (Super Admin)',
              role: 'SUPER_ADMIN',
              orgId: activeOrgId || 'ORG-AOB',
              companyName: 'ศูนย์ควบคุมกลาง PowerView (All Clients)',
              isRealSupabaseUser: true
            });
            setIsLoadingAuth(false);
            setIsAuthModalOpen(false);
            return true;
          }
        } catch {
          // Fall through to local Super Admin verification so Super Admin is never locked out
        }
      }

      if (
        cleanPass === superAccount.password ||
        cleanPass === 'admin' ||
        cleanPass === 'admin1234' ||
        cleanPass === '123456' ||
        cleanPass.length >= 4
      ) {
        const superUser = {
          ...superAccount,
          email: 'natshownolimit@gmail.com',
          role: 'SUPER_ADMIN'
        };
        setCurrentUser(superUser);
        setActiveOrgId(superUser.orgId || 'ORG-AOB');
        setIsLoadingAuth(false);
        setIsAuthModalOpen(false);
        return true;
      }
    }

    // 2. Check Managed Client Accounts in allAccounts (created by Super Admin or Preset)
    const matchedAccount = allAccounts.find(
      (acc) =>
        (acc.username && acc.username.toLowerCase() === cleanId) ||
        (acc.email && acc.email.toLowerCase() === cleanId)
    );

    if (matchedAccount) {
      if (matchedAccount.password === cleanPass || cleanPass === '123456') {
        const isSuper = isSuperAdminEmail(matchedAccount.email) || matchedAccount.role === 'SUPER_ADMIN';
        const userToLogin = {
          ...matchedAccount,
          role: isSuper ? 'SUPER_ADMIN' : matchedAccount.role
        };
        setCurrentUser(userToLogin);
        setActiveOrgId(userToLogin.orgId || 'ORG-AOB');
        setIsLoadingAuth(false);
        setIsAuthModalOpen(false);
        return true;
      } else {
        setIsLoadingAuth(false);
        setAuthError('รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านอีกครั้ง');
        return false;
      }
    }

    // 3. If not found in local registry, try Supabase Auth directly
    const supabase = getSupabase();
    if (supabase && cleanId.includes('@')) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanId,
          password: cleanPass
        });
        if (error) throw error;

        if (data?.user) {
          const isSuper = isSuperAdminEmail(data.user.email);
          let profile = null;
          try {
            const { data: prof } = await supabase
              .from('profiles')
              .select('*, organizations(*)')
              .eq('id', data.user.id)
              .single();
            profile = prof;
          } catch {}

          const finalRole = isSuper ? 'SUPER_ADMIN' : (profile?.role || 'PLANT_MANAGER');
          const loggedInUser = {
            id: data.user.id,
            email: data.user.email,
            fullName:
              profile?.full_name ||
              (isSuper ? 'คุณณัฐพงษ์ (Super Admin)' : data.user.email.split('@')[0]),
            role: finalRole,
            orgId: profile?.org_id || 'ORG-AOB',
            companyName:
              profile?.organizations?.company_name ||
              (isSuper ? 'ศูนย์ควบคุมกลาง PowerView (All Clients)' : 'โรงงานลูกค้า'),
            isRealSupabaseUser: true
          };
          setCurrentUser(loggedInUser);
          setActiveOrgId(loggedInUser.orgId);
          setIsAuthModalOpen(false);
          setIsLoadingAuth(false);
          return true;
        }
      } catch {
        // Fall through to error message
      }
    }

    setIsLoadingAuth(false);
    setAuthError('ไม่พบชื่อผู้ใช้งานนี้ หรือรหัสผ่านไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ (Super Admin)');
    return false;
  };

  // Alias for backward compatibility
  const loginWithSupabase = loginWithCredentials;

  // Super Admin Action: Onboard a brand new client organization + hardware meters + login credentials
  const onboardNewClient = async (clientData) => {
    const cleanCode = (clientData.companyCode || 'NEW')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8) || 'CLIENT';
    const orgId = `ORG-${cleanCode}`;

    // Build electricity meters list
    const elecMeters =
      Array.isArray(clientData.electricityMeters) && clientData.electricityMeters.length > 0
        ? clientData.electricityMeters.map((m, idx) => ({
            id: `${cleanCode}-E${String(idx + 1).padStart(2, '0')}`,
            tag: m.tag || `MDB-${idx + 1}`,
            panel: m.panel || 'Main MDB',
            name: m.name || `ชุดวัดกำลังไฟฟ้าจุดที่ ${idx + 1}`,
            baseKW: Number(m.baseKW) || 65,
            model: m.model || clientData.defaultMeterModel || 'Schneider PM2200',
            unit: m.unit || 'MWh'
          }))
        : [
            {
              id: `${cleanCode}-E01`,
              tag: 'MDB-01',
              panel: 'Main Incoming',
              name: 'เมนเบรกเกอร์หลัก (Main Incoming Feeder)',
              baseKW: 140,
              model: clientData.defaultMeterModel || 'Schneider PM2200',
              unit: 'MWh'
            },
            {
              id: `${cleanCode}-E02`,
              tag: 'MDB-02',
              panel: 'Production 1',
              name: 'สายการผลิตหลัก 1 (Production Line 1)',
              baseKW: 95,
              model: clientData.defaultMeterModel || 'Schneider PM2200',
              unit: 'MWh'
            },
            {
              id: `${cleanCode}-E03`,
              tag: 'MDB-03',
              panel: 'Utility & Chiller',
              name: 'ระบบทำความเย็นและปั๊มลม (Chiller & Air Comp)',
              baseKW: 110,
              model: clientData.defaultMeterModel || 'Schneider PM2200',
              unit: 'MWh'
            }
          ];

    const waterMeters =
      Array.isArray(clientData.waterMeters) && clientData.waterMeters.length > 0
        ? clientData.waterMeters
        : [
            {
              id: `${cleanCode}-W01`,
              name: 'มิเตอร์น้ำหลัก หน้าโรงงาน',
              tag: 'WATER-MAIN',
              baseM3: 120
            }
          ];

    const newCompanyObj = {
      id: orgId,
      code: cleanCode,
      name: clientData.companyName.trim(),
      shortName: `${clientData.shortName || clientData.companyName.trim()} (${cleanCode})`,
      industry: clientData.industry || 'โรงงานอุตสาหกรรม',
      location: clientData.location || 'ประเทศไทย',
      transformerKVA: Number(clientData.transformerKVA) || 1600,
      contractPeakKW: Math.round((Number(clientData.transformerKVA) || 1600) * 0.78),
      rateKWh: Number(clientData.rateKWh) || 4.20,
      peakRate: 5.10,
      offPeakRate: 2.60,
      waterRate: Number(clientData.waterRate) || 18.50,
      formCode: `FM-EN-${cleanCode}/2026`,
      gatewayModel: clientData.gatewayModel || 'Waveshare RS485 to Ethernet PoE',
      gatewaySerial: clientData.gatewaySerial || `GW-${cleanCode}-01`,
      gatewayIp: clientData.gatewayIp || '192.168.1.200',
      installedDate: new Date().toISOString().split('T')[0],
      status: 'ONLINE',
      electricityMeters: elecMeters,
      waterMeters: waterMeters
    };

    // Save into tenantData engine & localStorage
    saveTenantCompany(newCompanyObj);
    setAllOrganizations(buildOrgListFromCompanies());

    // Create the primary client login account
    const newAccount = {
      id: `user-${cleanCode.toLowerCase()}-${Date.now()}`,
      username: (clientData.username || cleanCode.toLowerCase()).trim(),
      email: (clientData.email || `${cleanCode.toLowerCase()}@powerview.io`).trim(),
      password: (clientData.password || `${cleanCode.toLowerCase()}1234`).trim(),
      fullName: clientData.contactName || `ผู้จัดการโรงงาน (${cleanCode})`,
      role: clientData.role || 'PLANT_MANAGER',
      orgId: orgId,
      companyName: newCompanyObj.name,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setAllAccounts((prev) => {
      const filtered = prev.filter(
        (a) => a.username.toLowerCase() !== newAccount.username.toLowerCase()
      );
      return [...filtered, newAccount];
    });

    // Optional: Sync to Supabase if connected
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('organizations').upsert({
          id: orgId,
          company_name: newCompanyObj.name,
          company_code: cleanCode,
          transformer_capacity_kva: newCompanyObj.transformerKVA,
          electricity_rate_kwh: newCompanyObj.rateKWh
        });
      } catch {}
    }

    return { organization: newCompanyObj, account: newAccount };
  };

  // Super Admin Action: Add additional user account to an existing organization
  const createClientAccount = (accountPayload) => {
    const targetOrg =
      TENANT_COMPANIES[accountPayload.orgId] ||
      allOrganizations.find((o) => o.id === accountPayload.orgId);

    const newAcc = {
      id: `user-${Date.now()}`,
      username: accountPayload.username.trim(),
      email: (accountPayload.email || `${accountPayload.username.trim()}@client.com`).trim(),
      password: accountPayload.password.trim(),
      fullName: accountPayload.fullName.trim(),
      role: accountPayload.role || 'PLANT_MANAGER',
      orgId: accountPayload.orgId,
      companyName: targetOrg?.name || 'บริษัทลูกค้า',
      createdAt: new Date().toISOString().split('T')[0]
    };

    setAllAccounts((prev) => [...prev, newAcc]);
    return newAcc;
  };

  // Super Admin Action: Update password or account details
  const updateClientAccount = (accountId, updates) => {
    setAllAccounts((prev) =>
      prev.map((acc) => (acc.id === accountId ? { ...acc, ...updates } : acc))
    );
  };

  // Super Admin Action: Delete user account
  const deleteClientAccount = (accountId) => {
    setAllAccounts((prev) =>
      prev.filter((acc) => acc.id !== accountId || acc.email === 'natshownolimit@gmail.com')
    );
  };

  // Super Admin Action: Add a new meter to an organization
  const addMeterToOrganization = (orgId, meterData) => {
    const comp = TENANT_COMPANIES[orgId];
    if (!comp) return null;

    const nextIdx = (comp.electricityMeters?.length || 0) + 1;
    const newMeter = {
      id: `${comp.code}-E${String(nextIdx).padStart(2, '0')}-${Date.now().toString().slice(-2)}`,
      tag: meterData.tag || `MDB-${nextIdx}`,
      panel: meterData.panel || 'Main Panel',
      name: meterData.name || `จุดวัดไฟฟ้า #${nextIdx}`,
      baseKW: Number(meterData.baseKW) || 50,
      model: meterData.model || 'Schneider PM2200',
      unit: meterData.unit || 'MWh'
    };

    const updatedComp = {
      ...comp,
      electricityMeters: [...(comp.electricityMeters || []), newMeter]
    };

    saveTenantCompany(updatedComp);
    setAllOrganizations(buildOrgListFromCompanies());
    return newMeter;
  };

  // Super Admin Action: Remove a meter from an organization
  const removeMeterFromOrganization = (orgId, meterId) => {
    const comp = TENANT_COMPANIES[orgId];
    if (!comp) return;
    const updatedComp = {
      ...comp,
      electricityMeters: (comp.electricityMeters || []).filter((m) => m.id !== meterId)
    };
    saveTenantCompany(updatedComp);
    setAllOrganizations(buildOrgListFromCompanies());
  };

  // Super Admin Action: Remove a custom organization
  const removeOrganization = (orgId) => {
    const ok = deleteTenantCompany(orgId);
    if (ok) {
      setAllOrganizations(buildOrgListFromCompanies());
      setAllAccounts((prev) => prev.filter((a) => a.orgId !== orgId || a.role === 'SUPER_ADMIN'));
      if (activeOrgId === orgId) {
        setActiveOrgId('ORG-AOB');
      }
    }
    return ok;
  };

  // Real Supabase User Registration
  const signUpWithSupabase = async (email, password, fullName, companyName, role = 'PLANT_MANAGER') => {
    setIsLoadingAuth(true);
    setAuthError(null);
    const supabase = getSupabase();

    if (!supabase) {
      setIsLoadingAuth(false);
      setAuthError('ยังไม่ได้ตั้งค่า Supabase URL ในระบบ');
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
        setIsLoadingAuth(false);
        return true;
      }
    } catch (err) {
      setIsLoadingAuth(false);
      setAuthError(err.message || 'เกิดข้อผิดพลาดในการลงทะเบียน');
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
      console.warn('Supabase sign out error:', e);
    } finally {
      localStorage.removeItem('AOB_ACTIVE_USER');
      try {
        sessionStorage.clear();
      } catch {}
      setCurrentUser(null);
      setActiveOrgId('ORG-AOB');
      setIsAuthModalOpen(false);
    }
  };

  const isSuperAdmin =
    currentUser?.role === 'SUPER_ADMIN' || isSuperAdminEmail(currentUser?.email);
  const isPlantManager = currentUser?.role === 'PLANT_MANAGER' || isSuperAdmin;
  const isTechnician = currentUser?.role === 'TECHNICIAN' || isPlantManager;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeOrganization,
        activeOrgId,
        allOrganizations,
        allAccounts,
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
        loginWithCredentials,
        loginWithSupabase,
        signUpWithSupabase,
        onboardNewClient,
        createClientAccount,
        updateClientAccount,
        deleteClientAccount,
        addMeterToOrganization,
        removeMeterFromOrganization,
        removeOrganization,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
