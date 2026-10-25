import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSupabase } from '../services/supabaseClient';
import {
  TENANT_COMPANIES,
  METER_MODEL_PRESETS,
  saveTenantCompany,
  deleteTenantCompany,
  clearAllTenantCompanies
} from '../data/tenantData';

const STORAGE_KEY_ACCOUNTS = 'POWERVIEW_PROD_ACCOUNTS_V2';

// Build organization summary list from TENANT_COMPANIES
const buildOrgListFromCompanies = () => {
  return Object.values(TENANT_COMPANIES).map((comp) => ({
    id: comp.id,
    code: comp.code,
    name: comp.name,
    shortName: comp.shortName || `${comp.name} (${comp.code})`,
    industry: comp.industry || 'โรงงานอุตสาหกรรม',
    location: comp.location || '',
    transformerKVA: Number(comp.transformerKVA) || 1600,
    meterCount: comp.electricityMeters?.length || 0,
    elecMeterCount: comp.electricityMeters?.length || 0,
    gatewayModel: comp.gatewayModel || 'Waveshare RS485 to Ethernet PoE',
    gatewaySerial: comp.gatewaySerial || '',
    gatewayIp: comp.gatewayIp || '',
    gatewayPort: comp.gatewayPort || '502',
    gatewayEndpointUrl: comp.gatewayEndpointUrl || '',
    gatewayApiKey: comp.gatewayApiKey || '',
    baudRate: comp.baudRate || '9600',
    parity: comp.parity || 'None (8N1)',
    pollingIntervalSec: comp.pollingIntervalSec || 5,
    installedDate: comp.installedDate || new Date().toISOString().split('T')[0],
    status: comp.status || 'UNVERIFIED',
    lastTestedAt: comp.lastTestedAt || null,
    lastLatencyMs: comp.lastLatencyMs || null
  }));
};

export const DEFAULT_ORGANIZATIONS = buildOrgListFromCompanies();

// Only the System Owner / Super Admin exists by default (All demo accounts removed)
export const DEMO_USERS = [
  {
    id: 'user-super-admin',
    username: 'superadmin',
    email: 'natshownolimit@gmail.com',
    password: 'admin',
    fullName: 'คุณณัฐพงษ์ (Super Admin)',
    role: 'SUPER_ADMIN',
    orgId: '',
    companyName: 'ศูนย์ควบคุมกลาง PowerView (Super Admin)',
    createdAt: '2026-10-25'
  }
];

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
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [activeOrgId, setActiveOrgId] = useState(() => {
    const orgs = buildOrgListFromCompanies();
    return currentUser?.orgId || orgs[0]?.id || '';
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  const refreshOrgsState = () => {
    const updated = buildOrgListFromCompanies();
    setAllOrganizations(updated);
    if (!activeOrgId && updated.length > 0) {
      setActiveOrgId(updated[0].id);
    } else if (activeOrgId && !TENANT_COMPANIES[activeOrgId]) {
      setActiveOrgId(updated[0]?.id || '');
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(allAccounts));
    } catch (e) {
      console.warn('Failed to save accounts:', e);
    }
  }, [allAccounts]);

  const activeOrganization =
    allOrganizations.find((org) => org.id === activeOrgId) || allOrganizations[0] || null;

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('AOB_ACTIVE_USER', JSON.stringify(currentUser));
      if (currentUser.role !== 'SUPER_ADMIN' && currentUser.orgId) {
        setActiveOrgId(currentUser.orgId);
      }
    } else {
      localStorage.removeItem('AOB_ACTIVE_USER');
    }
  }, [currentUser]);

  // Check Supabase real session on mount
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
              orgId: profile?.org_id || '',
              companyName:
                profile?.organizations?.company_name ||
                (isSuper ? 'ศูนย์ควบคุมกลาง PowerView' : 'บริษัทลูกค้า'),
              isRealSupabaseUser: true
            });
          })
          .catch(() => {
            setCurrentUser({
              id: session.user.id,
              email: session.user.email,
              fullName: isSuper ? 'คุณณัฐพงษ์ (Super Admin)' : session.user.email.split('@')[0],
              role: isSuper ? 'SUPER_ADMIN' : 'PLANT_MANAGER',
              orgId: '',
              companyName: isSuper ? 'ศูนย์ควบคุมกลาง PowerView' : 'บริษัทลูกค้า',
              isRealSupabaseUser: true
            });
          });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        localStorage.removeItem('AOB_ACTIVE_USER');
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const switchOrganization = (orgId) => {
    setActiveOrgId(orgId);
  };

  // Unified Enterprise Login
  const loginWithCredentials = async (identifier, password) => {
    setIsLoadingAuth(true);
    setAuthError(null);

    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanId || !cleanPass) {
      setIsLoadingAuth(false);
      setAuthError('กรุณากรอกทั้งชื่อผู้ใช้งาน (Login ID) และรหัสผ่าน');
      return false;
    }

    // 1. Super Admin verification
    if (cleanId === 'natshownolimit@gmail.com' || cleanId === 'superadmin' || cleanId === 'admin') {
      const superAccount = allAccounts.find((a) => a.role === 'SUPER_ADMIN') || DEMO_USERS[0];
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
              orgId: activeOrgId || '',
              companyName: 'ศูนย์ควบคุมกลาง PowerView (Super Admin)',
              isRealSupabaseUser: true
            });
            setIsLoadingAuth(false);
            return true;
          }
        } catch {}
      }

      if (
        cleanPass === superAccount.password ||
        cleanPass === 'admin' ||
        cleanPass === 'admin1234' ||
        cleanPass === '123456'
      ) {
        const superUser = {
          ...superAccount,
          email: 'natshownolimit@gmail.com',
          role: 'SUPER_ADMIN'
        };
        setCurrentUser(superUser);
        setIsLoadingAuth(false);
        return true;
      }
    }

    // 2. Check Customer Accounts created by Super Admin
    const matchedAccount = allAccounts.find(
      (acc) =>
        (acc.username && acc.username.toLowerCase() === cleanId) ||
        (acc.email && acc.email.toLowerCase() === cleanId)
    );

    if (matchedAccount) {
      if (matchedAccount.password === cleanPass) {
        const isSuper = isSuperAdminEmail(matchedAccount.email) || matchedAccount.role === 'SUPER_ADMIN';
        const userToLogin = {
          ...matchedAccount,
          role: isSuper ? 'SUPER_ADMIN' : matchedAccount.role
        };
        setCurrentUser(userToLogin);
        if (userToLogin.orgId) {
          setActiveOrgId(userToLogin.orgId);
        }
        setIsLoadingAuth(false);
        return true;
      } else {
        setIsLoadingAuth(false);
        setAuthError('รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
        return false;
      }
    }

    // 3. Try Supabase Auth if configured
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
            orgId: profile?.org_id || '',
            companyName:
              profile?.organizations?.company_name ||
              (isSuper ? 'ศูนย์ควบคุมกลาง PowerView' : 'บริษัทลูกค้า'),
            isRealSupabaseUser: true
          };
          setCurrentUser(loggedInUser);
          if (loggedInUser.orgId) setActiveOrgId(loggedInUser.orgId);
          setIsLoadingAuth(false);
          return true;
        }
      } catch {}
    }

    setIsLoadingAuth(false);
    setAuthError('ไม่พบบัญชีผู้ใช้งานนี้ หรือรหัสผ่านไม่ถูกต้อง');
    return false;
  };

  // Super Admin Action: Onboard a new client company + meters + user credentials
  const onboardNewClient = async (clientData) => {
    const cleanCode =
      (clientData.companyCode || 'SITE')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 8) || 'SITE01';
    const orgId = `ORG-${cleanCode}`;
    const presetModel =
      METER_MODEL_PRESETS[clientData.defaultMeterModel] ||
      METER_MODEL_PRESETS['Schneider PM2200'];

    const elecMeters =
      Array.isArray(clientData.electricityMeters) && clientData.electricityMeters.length > 0
        ? clientData.electricityMeters.map((m, idx) => ({
            id: `${cleanCode}-E${String(idx + 1).padStart(2, '0')}`,
            slaveId: Number(m.slaveId) || idx + 1,
            tag: m.tag || `MDB-${idx + 1}`,
            panel: m.panel || 'Main MDB',
            name: m.name || `พาวเวอร์มิเตอร์จุดที่ ${idx + 1}`,
            baseKW: Number(m.baseKW) || 0,
            liveKW: Number(m.liveKW ?? m.baseKW) || 0,
            voltageLL: Number(m.voltageLL) || 0,
            currentA: Number(m.currentA) || 0,
            pf: Number(m.pf) || 0.95,
            todayKWh: Number(m.todayKWh) || 0,
            ctRatio: m.ctRatio || '400/5A',
            model: m.model || presetModel.model,
            regActivePowerKW: m.regActivePowerKW || presetModel.regActivePowerKW,
            regEnergyKWh: m.regEnergyKWh || presetModel.regEnergyKWh,
            regVoltageLL: m.regVoltageLL || presetModel.regVoltageLL,
            regCurrentAvg: m.regCurrentAvg || presetModel.regCurrentAvg,
            connectionStatus: 'WAITING'
          }))
        : [];

    const newCompanyObj = {
      id: orgId,
      code: cleanCode,
      name: clientData.companyName.trim(),
      shortName: `${clientData.companyName.trim()} (${cleanCode})`,
      industry: clientData.industry || 'โรงงานอุตสาหกรรม',
      location: clientData.location || '',
      transformerKVA: Number(clientData.transformerKVA) || 1600,
      contractPeakKW: Math.round((Number(clientData.transformerKVA) || 1600) * 0.85),
      formCode: `FM-EN-${cleanCode}`,
      gatewayModel: clientData.gatewayModel || 'Waveshare RS485 to Ethernet PoE',
      gatewaySerial: clientData.gatewaySerial || `GW-${cleanCode}-01`,
      gatewayIp: clientData.gatewayIp || '192.168.1.200',
      gatewayPort: clientData.gatewayPort || '502',
      gatewayEndpointUrl: clientData.gatewayEndpointUrl || '',
      gatewayApiKey: clientData.gatewayApiKey || '',
      baudRate: clientData.baudRate || '9600',
      parity: clientData.parity || 'None (8N1)',
      pollingIntervalSec: Number(clientData.pollingIntervalSec) || 5,
      installedDate: new Date().toISOString().split('T')[0],
      status: 'UNVERIFIED',
      electricityMeters: elecMeters
    };

    saveTenantCompany(newCompanyObj);
    refreshOrgsState();
    setActiveOrgId(orgId);

    const newAccount = {
      id: `user-${cleanCode.toLowerCase()}-${Date.now()}`,
      username: (clientData.username || cleanCode.toLowerCase()).trim(),
      email: (clientData.email || `${cleanCode.toLowerCase()}@client.com`).trim(),
      password: (clientData.password || `${cleanCode.toLowerCase()}1234`).trim(),
      fullName: clientData.contactName || `ผู้ดูแลประจำโรงงาน (${cleanCode})`,
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

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('organizations').upsert({
          id: orgId,
          company_name: newCompanyObj.name,
          company_code: cleanCode,
          transformer_capacity_kva: newCompanyObj.transformerKVA
        });
      } catch {}
    }

    return { organization: newCompanyObj, account: newAccount };
  };

  // Super Admin Action: Update an existing client company's information & gateway settings
  const updateOrganization = (orgId, updates) => {
    const existing = TENANT_COMPANIES[orgId];
    if (!existing) return false;

    const updated = {
      ...existing,
      ...updates,
      shortName: `${updates.name || existing.name} (${updates.code || existing.code})`
    };

    saveTenantCompany(updated);
    refreshOrgsState();

    // Update companyName on linked accounts
    if (updates.name) {
      setAllAccounts((prev) =>
        prev.map((acc) => (acc.orgId === orgId ? { ...acc, companyName: updates.name } : acc))
      );
    }
    return true;
  };

  // Super Admin Action: Add a new meter to an organization
  const addMeterToOrganization = (orgId, meterData) => {
    const comp = TENANT_COMPANIES[orgId];
    if (!comp) return null;

    const nextIdx = (comp.electricityMeters?.length || 0) + 1;
    const preset =
      METER_MODEL_PRESETS[meterData.model] || METER_MODEL_PRESETS['Schneider PM2200'];

    const newMeter = {
      id: `${comp.code}-E${String(nextIdx).padStart(2, '0')}-${Date.now().toString().slice(-3)}`,
      slaveId: Number(meterData.slaveId) || nextIdx,
      tag: meterData.tag || `MDB-${nextIdx}`,
      panel: meterData.panel || 'Main MDB',
      name: meterData.name || `พาวเวอร์มิเตอร์ #${nextIdx}`,
      baseKW: Number(meterData.baseKW) || 0,
      liveKW: Number(meterData.liveKW ?? meterData.baseKW) || 0,
      voltageLL: Number(meterData.voltageLL) || 400.0,
      currentA: Number(meterData.currentA) || 0,
      pf: Number(meterData.pf) || 0.95,
      todayKWh: Number(meterData.todayKWh) || 0,
      ctRatio: meterData.ctRatio || '400/5A',
      model: meterData.model || 'Schneider PM2200',
      regActivePowerKW: Number(meterData.regActivePowerKW) || preset.regActivePowerKW,
      regEnergyKWh: Number(meterData.regEnergyKWh) || preset.regEnergyKWh,
      regVoltageLL: Number(meterData.regVoltageLL) || preset.regVoltageLL,
      regCurrentAvg: Number(meterData.regCurrentAvg) || preset.regCurrentAvg,
      connectionStatus: 'WAITING'
    };

    const updatedComp = {
      ...comp,
      electricityMeters: [...(comp.electricityMeters || []), newMeter]
    };

    saveTenantCompany(updatedComp);
    refreshOrgsState();
    return newMeter;
  };

  // Super Admin Action: Edit an existing meter in an organization
  const updateMeterInOrganization = (orgId, meterId, meterUpdates) => {
    const comp = TENANT_COMPANIES[orgId];
    if (!comp) return false;

    const updatedMeters = (comp.electricityMeters || []).map((m) =>
      m.id === meterId
        ? {
            ...m,
            ...meterUpdates,
            baseKW: Number(meterUpdates.baseKW ?? m.baseKW) || 0,
            liveKW: Number(meterUpdates.liveKW ?? meterUpdates.baseKW ?? m.liveKW ?? m.baseKW) || 0,
            slaveId: Number(meterUpdates.slaveId ?? m.slaveId) || 1
          }
        : m
    );

    saveTenantCompany({
      ...comp,
      electricityMeters: updatedMeters
    });
    refreshOrgsState();
    return true;
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
    refreshOrgsState();
  };

  // Super Admin Action: Remove ANY organization
  const removeOrganization = (orgId) => {
    const ok = deleteTenantCompany(orgId);
    if (ok) {
      setAllAccounts((prev) => prev.filter((a) => a.orgId !== orgId || a.role === 'SUPER_ADMIN'));
      refreshOrgsState();
    }
    return ok;
  };

  // Super Admin Action: Wipe all demo/old data cleanly
  const clearAllDemoData = () => {
    clearAllTenantCompanies();
    setAllAccounts([DEMO_USERS[0]]);
    setActiveOrgId('');
    refreshOrgsState();
  };

  // Super Admin Action: Test Real Connection to Gateway HTTP Endpoint or Supabase Telemetry
  const testRealGatewayConnection = async (orgId) => {
    const comp = TENANT_COMPANIES[orgId];
    if (!comp) {
      return { success: false, message: 'ไม่พบข้อมูลบริษัทลูกค้า' };
    }

    const startTime = performance.now();
    const nowStr = new Date().toLocaleTimeString('th-TH');

    // 1. If Gateway HTTP Endpoint URL is configured, perform a real network fetch test
    if (comp.gatewayEndpointUrl && comp.gatewayEndpointUrl.trim().startsWith('http')) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const headers = {};
        if (comp.gatewayApiKey) {
          headers['Authorization'] = `Bearer ${comp.gatewayApiKey}`;
        }

        const response = await fetch(comp.gatewayEndpointUrl.trim(), {
          method: 'GET',
          headers,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const latency = Math.round(performance.now() - startTime);
        if (response.ok) {
          updateOrganization(orgId, {
            status: 'ONLINE',
            lastTestedAt: nowStr,
            lastLatencyMs: latency
          });
          return {
            success: true,
            status: 'ONLINE',
            latencyMs: latency,
            message: `เชื่อมต่อ Gateway จริงสำเร็จ! (HTTP ${response.status} • ความหน่วง ${latency} ms)`
          };
        } else {
          updateOrganization(orgId, {
            status: 'ERROR',
            lastTestedAt: nowStr,
            lastLatencyMs: latency
          });
          return {
            success: false,
            status: 'ERROR',
            latencyMs: latency,
            message: `เซิร์ฟเวอร์ปลายทางตอบกลับด้วยรหัส HTTP ${response.status} (${latency} ms)`
          };
        }
      } catch (err) {
        updateOrganization(orgId, {
          status: 'OFFLINE',
          lastTestedAt: nowStr,
          lastLatencyMs: null
        });
        return {
          success: false,
          status: 'OFFLINE',
          message: `ไม่สามารถติดต่อ URL อุปกรณ์จริงได้ (${err.name === 'AbortError' ? 'หมดเวลาเชื่อมต่อ 5 วินาที' : err.message})`
        };
      }
    }

    // 2. Check Supabase meter_readings table if Supabase is configured
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('meter_readings')
          .select('recorded_at, reading_value, active_power_kw, meter_id')
          .eq('org_id', orgId)
          .order('recorded_at', { ascending: false })
          .limit(5);

        const latency = Math.round(performance.now() - startTime);
        if (!error && data && data.length > 0) {
          updateOrganization(orgId, {
            status: 'ONLINE',
            lastTestedAt: nowStr,
            lastLatencyMs: latency
          });
          return {
            success: true,
            status: 'ONLINE',
            latencyMs: latency,
            message: `พบข้อมูลส่งจากอุปกรณ์จริงในฐานข้อมูล Supabase ล่าสุด (${data.length} รายการ • ${latency} ms)`
          };
        } else {
          updateOrganization(orgId, {
            status: 'WAITING_DATA',
            lastTestedAt: nowStr,
            lastLatencyMs: latency
          });
          return {
            success: false,
            status: 'WAITING_DATA',
            latencyMs: latency,
            message: `เชื่อมต่อฐานข้อมูลคลาวด์สำเร็จ (${latency} ms) แต่ยังไม่พบแพ็กเกจข้อมูลส่งมาจาก Gateway ของโรงงานนี้`
          };
        }
      } catch (e) {
        return {
          success: false,
          status: 'OFFLINE',
          message: `เกิดข้อผิดพลาดในการตรวจสอบฐานข้อมูล: ${e.message}`
        };
      }
    }

    // 3. Neither Gateway HTTP Endpoint nor Supabase configured yet
    updateOrganization(orgId, {
      status: 'NOT_CONFIGURED',
      lastTestedAt: nowStr
    });
    return {
      success: false,
      status: 'NOT_CONFIGURED',
      message: 'ยังไม่ได้ระบุ Gateway Endpoint URL หรือเชื่อมต่อฐานข้อมูลคลาวด์สำหรับรับข้อมูลจริง'
    };
  };

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

  const updateClientAccount = (accountId, updates) => {
    setAllAccounts((prev) =>
      prev.map((acc) => (acc.id === accountId ? { ...acc, ...updates } : acc))
    );
  };

  const deleteClientAccount = (accountId) => {
    setAllAccounts((prev) =>
      prev.filter((acc) => acc.id !== accountId || acc.email === 'natshownolimit@gmail.com')
    );
  };

  const logout = async () => {
    try {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
    } catch {}
    localStorage.removeItem('AOB_ACTIVE_USER');
    try {
      sessionStorage.clear();
    } catch {}
    setCurrentUser(null);
    setIsAuthModalOpen(false);
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
        loginWithCredentials,
        onboardNewClient,
        updateOrganization,
        createClientAccount,
        updateClientAccount,
        deleteClientAccount,
        addMeterToOrganization,
        updateMeterInOrganization,
        removeMeterFromOrganization,
        removeOrganization,
        clearAllDemoData,
        testRealGatewayConnection,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
