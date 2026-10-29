import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSupabase } from '../services/supabaseClient';
import {
  TENANT_COMPANIES,
  METER_MODEL_PRESETS,
  createEmptySolarConfig,
  saveTenantCompany,
  deleteTenantCompany,
  clearAllTenantCompanies
} from '../data/tenantData';

const STORAGE_KEY_ACCOUNTS = 'POWERVIEW_PROD_ACCOUNTS_V5';
const LEGACY_ACCOUNT_KEYS = [
  'POWERVIEW_PROD_ACCOUNTS_V4',
  'POWERVIEW_PROD_ACCOUNTS_V3',
  'POWERVIEW_PROD_ACCOUNTS_V2'
];

export const DEFAULT_SUPER_PASSWORD = 'naTshow8@';
export const STORAGE_KEY_SUPER_PASSWORD = 'POWERVIEW_SUPER_PASSWORD_V1';

export const getActiveSuperAdminPassword = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SUPER_PASSWORD);
    if (saved && saved.trim() && saved.trim() !== 'admin') {
      return saved.trim();
    }
  } catch {}
  return DEFAULT_SUPER_PASSWORD;
};

export const setActiveSuperAdminPassword = (newPass) => {
  const clean = (newPass || '').trim();
  if (clean && clean !== 'admin') {
    try {
      localStorage.setItem(STORAGE_KEY_SUPER_PASSWORD, clean);
    } catch {}
  }
};

// Build organization summary list from TENANT_COMPANIES
const buildOrgListFromCompanies = () => {
  return Object.values(TENANT_COMPANIES).map((comp) => ({
    id: comp.id,
    code: comp.code,
    name: comp.name,
    shortName: comp.shortName || `${comp.name} (${comp.code})`,
    siteType: comp.siteType || 'INDUSTRIAL', // 'INDUSTRIAL' | 'HOME_SOLAR'
    industry:
      comp.industry ||
      (comp.siteType === 'HOME_SOLAR' ? 'ผู้ใช้งานตามบ้าน (Solar Hybrid)' : 'โรงงานอุตสาหกรรม'),
    location: comp.location || '',
    transformerKVA: Number(comp.transformerKVA) || 0,
    meterCount: comp.electricityMeters?.length || 0,
    elecMeterCount: comp.electricityMeters?.length || 0,
    gatewayModel: comp.gatewayModel || '',
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
    lastLatencyMs: comp.lastLatencyMs || null,
    solarConfig: comp.solarConfig || createEmptySolarConfig()
  }));
};

export const DEFAULT_ORGANIZATIONS = buildOrgListFromCompanies();

// Only the System Owner / Super Admin exists by default (All demo accounts removed)
export const DEMO_USERS = [
  {
    id: 'user-super-admin',
    username: 'superadmin',
    email: 'natshownolimit@gmail.com',
    password: getActiveSuperAdminPassword(),
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
  return lower === 'natshownolimit@gmail.com' || lower === 'superadmin';
};

const loadInitialAccounts = () => {
  const mergedMap = new Map();
  const currentSuperPass = getActiveSuperAdminPassword();
  mergedMap.set('superadmin', { ...DEMO_USERS[0], password: currentSuperPass });

  try {
    for (const key of LEGACY_ACCOUNT_KEYS) {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((acc) => {
            if (acc && acc.username) {
              // Never restore old or legacy passwords for Super Admin
              if (
                acc.role === 'SUPER_ADMIN' ||
                acc.username.toLowerCase() === 'superadmin' ||
                acc.email?.toLowerCase() === 'natshownolimit@gmail.com'
              ) {
                mergedMap.set('superadmin', {
                  ...acc,
                  password: currentSuperPass,
                  role: 'SUPER_ADMIN'
                });
              } else {
                mergedMap.set(acc.username.toLowerCase(), acc);
              }
            }
          });
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load accounts:', e);
  }

  // Ensure every company in TENANT_COMPANIES has a client login account
  Object.values(TENANT_COMPANIES).forEach((comp) => {
    const uname = (comp.loginUsername || (comp.code === 'NAT01' ? 'natshow' : comp.code) || '').toLowerCase();
    if (!uname) return;
    const existingForOrg = Array.from(mergedMap.values()).find(
      (a) => a.role !== 'SUPER_ADMIN' && (a.orgId === comp.id || a.username?.toLowerCase() === uname)
    );
    if (!existingForOrg) {
      mergedMap.set(uname, {
        id: `user-${(comp.code || 'site').toLowerCase()}`,
        username: comp.loginUsername || (comp.code === 'NAT01' ? 'natshow' : comp.code),
        email: `${uname}@powerview.local`,
        password: comp.loginPassword || '',
        isAutoRecovered: !comp.loginPassword,
        fullName:
          comp.siteType === 'HOME_SOLAR'
            ? `เจ้าของบ้าน (${comp.name})`
            : `ผู้ดูแลระบบ (${comp.name})`,
        role: 'PLANT_MANAGER',
        orgId: comp.id,
        siteType: comp.siteType || 'HOME_SOLAR',
        companyName: comp.name,
        createdAt: comp.installedDate || '2026-10-25'
      });
    }
  });

  // Strictly filter out any legacy simulated demo accounts (aob, gdb)
  const cleanAccounts = Array.from(mergedMap.values()).filter(
    (a) =>
      a.orgId !== 'ORG-AOB' &&
      a.orgId !== 'ORG-GRAND' &&
      a.username?.toLowerCase() !== 'aob' &&
      a.username?.toLowerCase() !== 'gdb'
  );

  return cleanAccounts;
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [allOrganizations, setAllOrganizations] = useState(() => buildOrgListFromCompanies());
  const [allAccounts, setAllAccounts] = useState(() => loadInitialAccounts());

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('AOB_ACTIVE_USER');
      if (!savedUser) return null;
      const parsed = JSON.parse(savedUser);
      // If a non-superadmin username (e.g. 'natshow') was previously given SUPER_ADMIN by mistake, fix it automatically
      if (
        parsed &&
        parsed.username &&
        parsed.username.toLowerCase() !== 'superadmin' &&
        parsed.email?.toLowerCase() !== 'natshownolimit@gmail.com'
      ) {
        const accounts = loadInitialAccounts();
        const clientAcc = accounts.find(
          (a) =>
            a.role !== 'SUPER_ADMIN' &&
            a.username?.toLowerCase() === parsed.username.toLowerCase()
        );
        if (clientAcc) {
          return { ...clientAcc, role: 'PLANT_MANAGER' };
        }
        return { ...parsed, role: 'PLANT_MANAGER' };
      }
      return parsed;
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

  // Sync organizations & keep Supabase session active on mount
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    // Check if cloud session exists or silently authenticate for Super Admin
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session && currentUser && (currentUser.role === 'SUPER_ADMIN' || isSuperAdminEmail(currentUser.email))) {
        const pass = currentUser.password || getActiveSuperAdminPassword();
        await supabase.auth.signInWithPassword({
          email: 'natshownolimit@gmail.com',
          password: pass
        }).catch(() => {});
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        localStorage.removeItem('AOB_ACTIVE_USER');
      }
    });

    // 1. Fetch cloud-synchronized credentials & solar configurations from /api/auth-vault
    fetch('/api/auth-vault?action=get-credentials')
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && data?.credentials) {
          Object.values(data.credentials).forEach((cred) => {
            if (cred.orgId) {
              const comp = TENANT_COMPANIES[cred.orgId];
              if (comp) {
                const updates = {};
                if (cred.loginPassword && comp.loginPassword !== cred.loginPassword) {
                  updates.loginPassword = cred.loginPassword;
                }
                if (cred.loginUsername && comp.loginUsername !== cred.loginUsername) {
                  updates.loginUsername = cred.loginUsername;
                }
                if (cred.solarConfig && typeof cred.solarConfig === 'object') {
                  updates.solarConfig = {
                    ...(comp.solarConfig || {}),
                    ...cred.solarConfig
                  };
                }
                if (Object.keys(updates).length > 0) {
                  saveTenantCompany({
                    ...comp,
                    ...updates
                  });
                }
              }
              if (cred.loginPassword) {
                setAllAccounts((prev) =>
                  prev.map((a) =>
                    a.orgId === cred.orgId || a.username?.toLowerCase() === cred.loginUsername?.toLowerCase()
                      ? { ...a, password: cred.loginPassword }
                      : a
                  )
                );
              }
            }
          });
          refreshOrgsState();
        }
      })
      .catch(() => {});

    // 2. Sync organizations from Supabase directly
    supabase
      .from('organizations')
      .select('*')
      .then(({ data: orgRows }) => {
        if (Array.isArray(orgRows) && orgRows.length > 0) {
          orgRows.forEach((row) => {
            let cloudPassword = null;
            let cloudUsername = null;
            let cloudSolarConfig = null;
            if (row.line_notify_token && row.line_notify_token.startsWith('{')) {
              try {
                const parsed = JSON.parse(row.line_notify_token);
                if (parsed.loginPassword) cloudPassword = parsed.loginPassword;
                if (parsed.loginUsername) cloudUsername = parsed.loginUsername;
                if (parsed.solarConfig) cloudSolarConfig = parsed.solarConfig;
              } catch {}
            }

            if (row.id) {
              const existing = TENANT_COMPANIES[row.id];
              if (existing) {
                const updates = {};
                if (cloudPassword && existing.loginPassword !== cloudPassword) {
                  updates.loginPassword = cloudPassword;
                  updates.loginUsername = cloudUsername || existing.loginUsername;
                }
                if (cloudSolarConfig && typeof cloudSolarConfig === 'object') {
                  updates.solarConfig = {
                    ...(existing.solarConfig || {}),
                    ...cloudSolarConfig
                  };
                }
                if (Object.keys(updates).length > 0) {
                  saveTenantCompany({
                    ...existing,
                    ...updates
                  });
                }
              } else {
                saveTenantCompany({
                  id: row.id,
                  code: row.company_code || row.id.replace('ORG-', ''),
                  name: row.company_name || row.id,
                  shortName: `${row.company_name || row.id} (${row.company_code || row.id})`,
                  siteType: row.site_type || 'INDUSTRIAL',
                  transformerKVA: Number(row.transformer_capacity_kva) || 0,
                  loginPassword: cloudPassword || 'naTshow8@',
                  loginUsername: cloudUsername || (row.company_code || 'client').toLowerCase(),
                  electricityMeters: [],
                  solarConfig: createEmptySolarConfig(),
                  status: 'ONLINE'
                });
              }

              if (cloudPassword) {
                setAllAccounts((prev) =>
                  prev.map((a) =>
                    a.orgId === row.id || a.username?.toLowerCase() === cloudUsername?.toLowerCase()
                      ? { ...a, password: cloudPassword }
                      : a
                  )
                );
              }
            }
          });
          refreshOrgsState();
        }
      })
      .catch(() => {});

    return () => {
      subscription?.unsubscribe();
    };
  }, [currentUser]);

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

    // 1. Super Admin Cloud Authentication (เฉพาะ natshownolimit@gmail.com หรือ superadmin เท่านั้น)
    if (isSuperAdminEmail(cleanId)) {
      const superEmail = 'natshownolimit@gmail.com';
      const supabase = getSupabase();

      if (supabase) {
        try {
          // Always authenticate directly against the Supabase Cloud single source of truth
          const { data, error } = await supabase.auth.signInWithPassword({
            email: superEmail,
            password: cleanPass
          });

          if (data?.user && data?.session) {
            // Live Cloud Authentication Verified 100%!
            setActiveSuperAdminPassword(cleanPass);
            const superUser = {
              id: data.user.id,
              username: 'superadmin',
              email: superEmail,
              fullName: 'คุณณัฐพงษ์ (Super Admin)',
              role: 'SUPER_ADMIN',
              orgId: activeOrgId || '',
              companyName: 'ศูนย์ควบคุมกลาง PowerView (Super Admin)',
              password: cleanPass,
              isRealSupabaseUser: true
            };
            setCurrentUser(superUser);
            setIsLoadingAuth(false);
            return true;
          }

          // If Supabase returned an explicit auth error (e.g. invalid credentials):
          if (error) {
            setIsLoadingAuth(false);
            setAuthError('รหัสผ่านผู้ดูแลระบบ (Super Admin) ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
            return false;
          }
        } catch (netErr) {
          console.warn('Supabase auth network error, checking local fallback:', netErr);
        }
      }

      // Offline / network failure fallback ONLY if Supabase connection was not reachable
      const currentActivePass = getActiveSuperAdminPassword();
      if (cleanPass !== currentActivePass) {
        setIsLoadingAuth(false);
        setAuthError('รหัสผ่านผู้ดูแลระบบ (Super Admin) ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
        return false;
      }

      const superUser = {
        id: 'user-super-admin',
        username: 'superadmin',
        email: superEmail,
        fullName: 'คุณณัฐพงษ์ (Super Admin)',
        role: 'SUPER_ADMIN',
        password: cleanPass
      };

      setCurrentUser(superUser);
      setIsLoadingAuth(false);
      return true;
    }

    // 2. Check Customer / Home Accounts (Matches by Username, Company Name e.g. BANNAT, or Site Code e.g. NAT01)
    const matchedClientAccount = allAccounts.find(
      (acc) =>
        acc.role !== 'SUPER_ADMIN' &&
        ((acc.username && acc.username.toLowerCase() === cleanId) ||
          (acc.companyName && acc.companyName.toLowerCase() === cleanId) ||
          (acc.orgId && acc.orgId.toLowerCase() === cleanId) ||
          (acc.orgId && acc.orgId.toLowerCase() === `org-${cleanId}`) ||
          (acc.email &&
            acc.email.toLowerCase() === cleanId &&
            acc.email.toLowerCase() !== 'natshownolimit@gmail.com'))
    );

    // 3. Match against TENANT_COMPANIES (e.g. BANNAT / NAT01 / natshow)
    const matchedComp = Object.values(TENANT_COMPANIES).find(
      (comp) =>
        comp.name?.toLowerCase() === cleanId ||
        comp.code?.toLowerCase() === cleanId ||
        comp.id?.toLowerCase() === cleanId ||
        comp.loginUsername?.toLowerCase() === cleanId ||
        ((cleanId === 'natshow' || cleanId === 'bannat' || cleanId === 'nat01') &&
          (comp.code?.toUpperCase() === 'NAT01' || comp.name?.toUpperCase() === 'BANNAT'))
    );

    if (matchedClientAccount || matchedComp) {
      const compForAccount = matchedComp || (matchedClientAccount?.orgId ? TENANT_COMPANIES[matchedClientAccount.orgId] : null);
      let expectedClientPass = matchedClientAccount?.password || compForAccount?.loginPassword || 'naTshow8@';

      let isValidClientPass = cleanPass === expectedClientPass;

      // If local check failed, query centralized cloud vault /api/auth-vault
      if (!isValidClientPass) {
        try {
          const verifyRes = await fetch('/api/auth-vault', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'verify-login',
              identifier: cleanId,
              password: cleanPass
            })
          });
          const verifyData = await verifyRes.json();
          if (verifyData?.success) {
            isValidClientPass = true;
            expectedClientPass = cleanPass;
          }
        } catch {}
      }

      if (!isValidClientPass) {
        setIsLoadingAuth(false);
        setAuthError('รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
        return false;
      }

      // Successful Client Login
      const targetOrg = compForAccount || {
        id: matchedClientAccount?.orgId || `ORG-${cleanId.toUpperCase()}`,
        name: matchedClientAccount?.companyName || cleanId,
        siteType: matchedClientAccount?.siteType || 'INDUSTRIAL'
      };

      const userToLogin = {
        id: matchedClientAccount?.id || `user-${(targetOrg.code || cleanId).toLowerCase()}`,
        username: matchedClientAccount?.username || targetOrg.loginUsername || cleanId,
        email: matchedClientAccount?.email || `${cleanId}@powerview.local`,
        password: cleanPass,
        isAutoRecovered: false,
        fullName:
          targetOrg.siteType === 'HOME_SOLAR'
            ? `เจ้าของบ้าน (${targetOrg.name})`
            : `ผู้ดูแลระบบ (${targetOrg.name})`,
        role: 'PLANT_MANAGER',
        orgId: targetOrg.id,
        siteType: targetOrg.siteType || 'INDUSTRIAL',
        companyName: targetOrg.name,
        createdAt: targetOrg.installedDate || '2026-10-25'
      };

      // Persist active password in TENANT_COMPANIES
      if (compForAccount) {
        saveTenantCompany({
          ...compForAccount,
          loginPassword: cleanPass
        });
      }

      setAllAccounts((prev) => [
        ...prev.filter((a) => a.id !== userToLogin.id && (a.role === 'SUPER_ADMIN' || a.orgId !== userToLogin.orgId)),
        userToLogin
      ]);

      setCurrentUser(userToLogin);
      if (userToLogin.orgId) {
        setActiveOrgId(userToLogin.orgId);
      }
      setIsLoadingAuth(false);
      return true;
    }

    setIsLoadingAuth(false);
    setAuthError('ไม่พบบัญชีผู้ใช้งานนี้ หรือรหัสผ่านไม่ถูกต้อง');
    return false;
  };

  // All-in-One Save & Database Sync Function (Supports both INDUSTRIAL and HOME_SOLAR)
  const saveFullClientSetup = async (clientData) => {
    const cleanCode =
      (clientData.companyCode || clientData.code || 'SITE')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 10) || 'SITE01';
    const orgId = clientData.id || `ORG-${cleanCode}`;
    const siteType = clientData.siteType === 'HOME_SOLAR' ? 'HOME_SOLAR' : 'INDUSTRIAL';

    const presetModel =
      METER_MODEL_PRESETS[clientData.defaultMeterModel] ||
      METER_MODEL_PRESETS[
        siteType === 'HOME_SOLAR' ? 'SAJ H2-6K-LS2 (Hybrid Inverter)' : 'Schneider PM2200'
      ];

    const elecMeters =
      Array.isArray(clientData.electricityMeters) && clientData.electricityMeters.length > 0
        ? clientData.electricityMeters.map((m, idx) => ({
            id: m.id || `${cleanCode}-E${String(idx + 1).padStart(2, '0')}`,
            slaveId: Number(m.slaveId) || idx + 1,
            tag: m.tag || `M-${idx + 1}`,
            panel: m.panel || (siteType === 'HOME_SOLAR' ? 'ตู้ไฟบ้าน' : 'Main MDB'),
            name:
              m.name ||
              (siteType === 'HOME_SOLAR'
                ? `Solar Inverter #${idx + 1}`
                : `Power Meter #${idx + 1}`),
            baseKW: Number(m.liveKW ?? m.baseKW) || 0,
            liveKW: Number(m.liveKW ?? m.baseKW) || 0,
            voltageLL: Number(m.voltageLL) || 0,
            currentA: Number(m.currentA) || 0,
            pf: Number(m.pf) || 0,
            todayKWh: Number(m.todayKWh) || 0,
            ctRatio: m.ctRatio || (siteType === 'HOME_SOLAR' ? 'Direct/CT' : '400/5A'),
            model: m.model || presetModel.model,
            regActivePowerKW: Number(m.regActivePowerKW) || presetModel.regActivePowerKW,
            regEnergyKWh: Number(m.regEnergyKWh) || presetModel.regEnergyKWh,
            regVoltageLL: Number(m.regVoltageLL) || presetModel.regVoltageLL,
            regCurrentAvg: Number(m.regCurrentAvg) || presetModel.regCurrentAvg,
            connectionStatus: m.connectionStatus || 'WAITING'
          }))
        : [];

    const solarConfig =
      siteType === 'HOME_SOLAR'
        ? {
            ...createEmptySolarConfig(),
            ...(clientData.solarConfig || {}),
            inverterIp: clientData.gatewayIp || clientData.solarConfig?.inverterIp || '',
            inverterPort: clientData.gatewayPort || clientData.solarConfig?.inverterPort || '502',
            baudRate: clientData.baudRate || clientData.solarConfig?.baudRate || '9600'
          }
        : createEmptySolarConfig();

    const companyObj = {
      id: orgId,
      code: cleanCode,
      name: (clientData.companyName || clientData.name || cleanCode).trim(),
      shortName: `${(clientData.companyName || clientData.name || cleanCode).trim()} (${cleanCode})`,
      siteType,
      industry:
        clientData.industry ||
        (siteType === 'HOME_SOLAR' ? 'ผู้ใช้งานตามบ้าน (Solar Inverter)' : 'โรงงานอุตสาหกรรม'),
      location: clientData.location || '',
      transformerKVA: Number(clientData.transformerKVA) || 0,
      contractPeakKW: Math.round((Number(clientData.transformerKVA) || 0) * 0.85),
      gatewayModel:
        clientData.gatewayModel ||
        (siteType === 'HOME_SOLAR' ? 'SAJ AIO3 WiFi / RS485' : 'Waveshare RS485 to WIFI/ETH'),
      gatewaySerial: clientData.gatewaySerial || '',
      gatewayIp: clientData.gatewayIp || '',
      gatewayPort: clientData.gatewayPort || '502',
      gatewayEndpointUrl: clientData.gatewayEndpointUrl || '',
      gatewayApiKey: clientData.gatewayApiKey || '',
      baudRate: clientData.baudRate || '9600',
      parity: clientData.parity || 'None (8N1)',
      pollingIntervalSec: Number(clientData.pollingIntervalSec) || 15,
      installedDate: clientData.installedDate || new Date().toISOString().split('T')[0],
      status: clientData.status || 'SAVED',
      loginUsername: (clientData.username || '').trim(),
      loginPassword: (clientData.password || '').trim(),
      electricityMeters: elecMeters,
      solarConfig
    };

    saveTenantCompany(companyObj);
    refreshOrgsState();
    setActiveOrgId(orgId);

    // Save or update client login account
    let savedAccount = null;
    if (clientData.username && clientData.password) {
      savedAccount = {
        id: clientData.accountId || `user-${cleanCode.toLowerCase()}`,
        username: clientData.username.trim(),
        email: (clientData.email || `${clientData.username.trim()}@powerview.local`).trim(),
        password: clientData.password.trim(),
        fullName:
          clientData.contactName ||
          (siteType === 'HOME_SOLAR'
            ? `เจ้าของบ้าน (${companyObj.name})`
            : `ผู้ดูแลระบบ (${companyObj.name})`),
        role: 'PLANT_MANAGER',
        orgId: orgId,
        siteType,
        companyName: companyObj.name,
        createdAt: new Date().toISOString().split('T')[0]
      };

      setAllAccounts((prev) => {
        const filtered = prev.filter(
          (a) =>
            a.role === 'SUPER_ADMIN' ||
            (a.orgId !== orgId && a.username.toLowerCase() !== savedAccount.username.toLowerCase())
        );
        return [...filtered, savedAccount];
      });
    }

    // Persist directly to Supabase Database if configured
    let dbSynced = false;
    let dbMessage = 'บันทึกข้อมูลลงระบบสำเร็จ';
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error: orgErr } = await supabase.from('organizations').upsert({
          id: orgId,
          company_name: companyObj.name,
          company_code: cleanCode,
          transformer_capacity_kva: companyObj.transformerKVA || 0
        });

        if (!orgErr) {
          dbSynced = true;
          dbMessage = 'บันทึกข้อมูลลงฐานข้อมูล Supabase Cloud และซิงค์ระบบสำเร็จ 100%';
        }

        // Also upsert meters into Supabase if meters table exists
        if (elecMeters.length > 0) {
          const meterRows = elecMeters.map((m) => ({
            id: m.id,
            org_id: orgId,
            meter_type: 'ELECTRICITY',
            meter_code: m.tag,
            meter_name: m.name,
            panel_name: m.panel,
            modbus_slave_id: m.slaveId
          }));
          await supabase.from('meters').upsert(meterRows).catch(() => {});
        }
      } catch (e) {
        dbMessage = `บันทึกในระบบแล้ว (หมายเหตุ Cloud: ${e.message})`;
      }
    }

    return {
      organization: companyObj,
      account: savedAccount,
      dbSynced,
      dbMessage
    };
  };

  const onboardNewClient = saveFullClientSetup;

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

    if (updates.name) {
      setAllAccounts((prev) =>
        prev.map((acc) => (acc.orgId === orgId ? { ...acc, companyName: updates.name } : acc))
      );
    }

    // Cloud Sync: Broadcast solarConfig to Supabase Cloud & all devices worldwide
    if (updates.solarConfig) {
      fetch('/api/auth-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-solar-config',
          orgId,
          solarConfig: updates.solarConfig
        })
      }).catch((err) => console.warn('Cloud solar config sync warning:', err));
    }

    return true;
  };

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
      baseKW: Number(meterData.liveKW ?? meterData.baseKW) || 0,
      liveKW: Number(meterData.liveKW ?? meterData.baseKW) || 0,
      voltageLL: Number(meterData.voltageLL) || 0,
      currentA: Number(meterData.currentA) || 0,
      pf: Number(meterData.pf) || 0,
      todayKWh: Number(meterData.todayKWh) || 0,
      ctRatio: meterData.ctRatio || '400/5A',
      model: meterData.model || 'Schneider PM2200',
      regActivePowerKW: Number(meterData.regActivePowerKW) || preset.regActivePowerKW,
      regEnergyKWh: Number(meterData.regEnergyKWh) || preset.regEnergyKWh,
      regVoltageLL: Number(meterData.regVoltageLL) || preset.regVoltageLL,
      regCurrentAvg: Number(meterData.regCurrentAvg) || preset.regCurrentAvg,
      connectionStatus: 'WAITING'
    };

    saveTenantCompany({
      ...comp,
      electricityMeters: [...(comp.electricityMeters || []), newMeter]
    });
    refreshOrgsState();
    return newMeter;
  };

  const updateMeterInOrganization = (orgId, meterId, meterUpdates) => {
    const comp = TENANT_COMPANIES[orgId];
    if (!comp) return false;

    const updatedMeters = (comp.electricityMeters || []).map((m) =>
      m.id === meterId
        ? {
            ...m,
            ...meterUpdates,
            baseKW: Number(meterUpdates.liveKW ?? meterUpdates.baseKW ?? m.liveKW ?? m.baseKW) || 0,
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

  const removeMeterFromOrganization = (orgId, meterId) => {
    const comp = TENANT_COMPANIES[orgId];
    if (!comp) return;
    saveTenantCompany({
      ...comp,
      electricityMeters: (comp.electricityMeters || []).filter((m) => m.id !== meterId)
    });
    refreshOrgsState();
  };

  const removeOrganization = async (orgId) => {
    const ok = deleteTenantCompany(orgId);
    if (ok) {
      setAllAccounts((prev) => prev.filter((a) => a.orgId !== orgId || a.role === 'SUPER_ADMIN'));
      refreshOrgsState();
      const supabase = getSupabase();
      if (supabase) {
        try {
          await supabase.from('organizations').delete().eq('id', orgId);
        } catch {}
      }
    }
    return ok;
  };

  const clearAllDemoData = () => {
    clearAllTenantCompanies();
    setAllAccounts([DEMO_USERS[0]]);
    setActiveOrgId('');
    refreshOrgsState();
  };

  // Real Gateway / Device Connection Test
  const testRealGatewayConnection = async (orgId, customUrl = '') => {
    const comp = TENANT_COMPANIES[orgId];
    const targetUrl = (customUrl || comp?.gatewayEndpointUrl || '').trim();
    const startTime = performance.now();
    const nowStr = new Date().toLocaleTimeString('th-TH');

    // 1. Test HTTP Endpoint URL if provided
    if (targetUrl && targetUrl.startsWith('http')) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const headers = {};
        if (comp?.gatewayApiKey) {
          headers['Authorization'] = `Bearer ${comp.gatewayApiKey}`;
        }

        const response = await fetch(targetUrl, {
          method: 'GET',
          headers,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const latency = Math.round(performance.now() - startTime);
        if (response.ok) {
          if (orgId && comp) {
            updateOrganization(orgId, {
              status: 'ONLINE',
              lastTestedAt: nowStr,
              lastLatencyMs: latency
            });
          }
          return {
            success: true,
            status: 'ONLINE',
            latencyMs: latency,
            message: `เชื่อมต่ออุปกรณ์จริงสำเร็จ! (HTTP ${response.status} • ความหน่วง ${latency} ms)`
          };
        } else {
          if (orgId && comp) {
            updateOrganization(orgId, {
              status: 'ERROR',
              lastTestedAt: nowStr,
              lastLatencyMs: latency
            });
          }
          return {
            success: false,
            status: 'ERROR',
            latencyMs: latency,
            message: `อุปกรณ์ปลายทางตอบกลับด้วยรหัส HTTP ${response.status} (${latency} ms)`
          };
        }
      } catch (err) {
        if (orgId && comp) {
          updateOrganization(orgId, {
            status: 'OFFLINE',
            lastTestedAt: nowStr,
            lastLatencyMs: null
          });
        }
        return {
          success: false,
          status: 'OFFLINE',
          message: `ไม่สามารถติดต่อ URL อุปกรณ์ได้ (${err.name === 'AbortError' ? 'หมดเวลาเชื่อมต่อ 5 วินาที' : err.message})`
        };
      }
    }

    // 2. Check Supabase meter_readings table if Supabase is configured
    const supabase = getSupabase();
    if (supabase) {
      try {
        const query = supabase
          .from('meter_readings')
          .select('recorded_at, reading_value, active_power_kw, meter_id')
          .order('recorded_at', { ascending: false })
          .limit(5);

        if (orgId) {
          query.eq('org_id', orgId);
        }

        const { data, error } = await query;
        const latency = Math.round(performance.now() - startTime);

        if (!error && data && data.length > 0) {
          if (orgId && comp) {
            updateOrganization(orgId, {
              status: 'ONLINE',
              lastTestedAt: nowStr,
              lastLatencyMs: latency
            });
          }
          return {
            success: true,
            status: 'ONLINE',
            latencyMs: latency,
            message: `เชื่อมต่อฐานข้อมูล Supabase สำเร็จ และพบข้อมูลจากอุปกรณ์จริงล่าสุด (${data.length} รายการ • ${latency} ms)`
          };
        } else {
          if (orgId && comp) {
            updateOrganization(orgId, {
              status: 'WAITING_DATA',
              lastTestedAt: nowStr,
              lastLatencyMs: latency
            });
          }
          return {
            success: true,
            status: 'WAITING_DATA',
            latencyMs: latency,
            message: `เชื่อมต่อฐานข้อมูล Supabase สำเร็จ (${latency} ms) พร้อมรอรับค่าจริงจากตัวอุปกรณ์`
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

    return {
      success: false,
      status: 'NOT_CONFIGURED',
      message: 'กรุณาระบุ Gateway Endpoint URL หรือเชื่อมต่อ Supabase Cloud หรือเสียบสาย USB-to-RS485 เพื่อทดสอบอ่านค่าจริง'
    };
  };

  const createClientAccount = (accountPayload) => {
    const targetOrg =
      TENANT_COMPANIES[accountPayload.orgId] ||
      allOrganizations.find((o) => o.id === accountPayload.orgId);

    const newAcc = {
      id: `user-${Date.now()}`,
      username: accountPayload.username.trim(),
      email: (accountPayload.email || `${accountPayload.username.trim()}@powerview.local`).trim(),
      password: accountPayload.password.trim(),
      fullName: accountPayload.fullName.trim(),
      role: accountPayload.role || 'PLANT_MANAGER',
      orgId: accountPayload.orgId,
      siteType: targetOrg?.siteType || 'INDUSTRIAL',
      companyName: targetOrg?.name || 'ผู้ใช้งาน',
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

  // Professional Super Admin Password Management Engine
  const changeUserPassword = async (targetIdOrUsername, newPassword) => {
    const isTargetObj = typeof targetIdOrUsername === 'object' && targetIdOrUsername !== null;
    const targetObj = isTargetObj ? targetIdOrUsername : null;
    const rawTarget = isTargetObj
      ? (targetObj.username || targetObj.orgId || targetObj.id || '')
      : (targetIdOrUsername || '');
    const cleanTarget = String(rawTarget).trim();
    const cleanPass = (newPassword || '').trim();

    if (!cleanTarget || !cleanPass) {
      return { success: false, message: 'กรุณากรอกรหัสผ่านใหม่ที่ต้องการตั้ง' };
    }

    // 1. Is this Super Admin account?
    if (
      isSuperAdminEmail(cleanTarget) ||
      cleanTarget === 'user-super-admin' ||
      cleanTarget.toLowerCase() === 'superadmin' ||
      targetObj?.role === 'SUPER_ADMIN'
    ) {
      const supabase = getSupabase();
      if (!supabase) {
        return { success: false, message: 'ไม่พบการเชื่อมต่อฐานข้อมูลคลาวด์ Supabase' };
      }

      // 1. Ensure an active session exists in Supabase Auth
      let session = (await supabase.auth.getSession())?.data?.session;

      if (!session) {
        // Re-authenticate with current active password to establish valid cloud session
        const currentPass = currentUser?.password || getActiveSuperAdminPassword();
        const signInRes = await supabase.auth.signInWithPassword({
          email: 'natshownolimit@gmail.com',
          password: currentPass
        });
        session = signInRes?.data?.session;

        // If currentPass didn't work, try DEFAULT_SUPER_PASSWORD
        if (!session && currentPass !== DEFAULT_SUPER_PASSWORD) {
          const fallbackRes = await supabase.auth.signInWithPassword({
            email: 'natshownolimit@gmail.com',
            password: DEFAULT_SUPER_PASSWORD
          });
          session = fallbackRes?.data?.session;
        }
      }

      if (!session) {
        return {
          success: false,
          message: 'เซสชันการเชื่อมต่อคลาวด์หมดอายุ กรุณาออกจากระบบและเข้าสู่ระบบใหม่อีกครั้งก่อนเปลี่ยนรหัสผ่าน'
        };
      }

      // 2. Update password directly in Supabase Cloud
      const { error: updateError } = await supabase.auth.updateUser({
        password: cleanPass
      });

      if (updateError) {
        return {
          success: false,
          message: `ไม่สามารถอัปเดตรหัสผ่านบนระบบคลาวด์ได้: ${updateError.message}`
        };
      }

      // 3. Update profiles table and metadata in Supabase
      try {
        await supabase.auth.updateUser({
          data: {
            passwordUpdatedAt: new Date().toISOString()
          }
        });
        await supabase.from('profiles').upsert([{
          id: session.user.id,
          email: 'natshownolimit@gmail.com',
          full_name: 'คุณณัฐพงษ์ (Super Admin)',
          role: 'SUPER_ADMIN',
          updated_at: new Date().toISOString()
        }]);
      } catch (e) {
        console.warn('Profile sync warning:', e);
      }

      // 4. Update local storage and in-memory accounts
      setActiveSuperAdminPassword(cleanPass);
      setAllAccounts((prev) =>
        prev.map((a) =>
          a.role === 'SUPER_ADMIN' ||
          a.username === 'superadmin' ||
          a.email === 'natshownolimit@gmail.com'
            ? { ...a, password: cleanPass }
            : a
        )
      );

      if (
        currentUser &&
        (currentUser.role === 'SUPER_ADMIN' || isSuperAdminEmail(currentUser.email))
      ) {
        const updatedSuper = { ...currentUser, password: cleanPass };
        setCurrentUser(updatedSuper);
        try {
          localStorage.setItem('AOB_ACTIVE_USER', JSON.stringify(updatedSuper));
        } catch {}
      }

      return {
        success: true,
        message: 'เปลี่ยนรหัสผ่าน Super Admin บนระบบคลาวด์สำเร็จ! มีผลทันทีกับทุกอุปกรณ์ และรหัสผ่านเดิมถูกยกเลิกถาวร'
      };
    }

    // 2. Client / Tenant Account
    const targetId = targetObj?.id || cleanTarget;
    const targetOrgId = targetObj?.orgId || (cleanTarget.startsWith('ORG-') ? cleanTarget : null);
    const targetUsername = targetObj?.username || cleanTarget;
    const targetCode = targetObj?.code || null;

    let updatedName = targetObj?.companyName || targetUsername || cleanTarget;
    let resolvedOrgId = targetOrgId;

    // A. Update in-memory allAccounts
    setAllAccounts((prev) =>
      prev.map((a) => {
        const isMatch =
          a.id === targetId ||
          (resolvedOrgId && a.orgId === resolvedOrgId) ||
          (targetUsername && a.username?.toLowerCase() === targetUsername.toLowerCase()) ||
          a.id === cleanTarget ||
          a.username?.toLowerCase() === cleanTarget.toLowerCase() ||
          a.orgId?.toLowerCase() === cleanTarget.toLowerCase() ||
          (cleanTarget.toLowerCase().includes('nat01') && a.orgId === 'ORG-NAT01') ||
          (cleanTarget.toLowerCase().includes('natshow') && a.username?.toLowerCase() === 'natshow');

        if (isMatch) {
          updatedName = a.companyName || a.username;
          if (a.orgId) resolvedOrgId = a.orgId;
          return { ...a, password: cleanPass };
        }
        return a;
      })
    );

    // B. Update in TENANT_COMPANIES and persist to localStorage
    Object.values(TENANT_COMPANIES).forEach((comp) => {
      const isCompMatch =
        (resolvedOrgId && comp.id === resolvedOrgId) ||
        comp.id === targetId ||
        comp.id === cleanTarget ||
        comp.loginUsername?.toLowerCase() === targetUsername.toLowerCase() ||
        comp.code?.toLowerCase() === cleanTarget.toLowerCase() ||
        comp.name?.toLowerCase() === cleanTarget.toLowerCase() ||
        (targetCode && comp.code?.toLowerCase() === targetCode.toLowerCase()) ||
        ((cleanTarget.toLowerCase().includes('nat01') || cleanTarget.toLowerCase().includes('natshow')) && comp.id === 'ORG-NAT01');

      if (isCompMatch) {
        if (!resolvedOrgId) resolvedOrgId = comp.id;
        saveTenantCompany({
          ...comp,
          loginPassword: cleanPass
        });
      }
    });

    // C. Sync to Supabase Cloud (organizations table) & /api/auth-vault
    const finalOrgId = resolvedOrgId || (cleanTarget.startsWith('ORG-') ? cleanTarget : 'ORG-NAT01');
    const supabase = getSupabase();
    if (supabase && finalOrgId) {
      try {
        const payload = JSON.stringify({
          loginUsername: targetUsername,
          loginPassword: cleanPass,
          updatedAt: new Date().toISOString()
        });
        await supabase
          .from('organizations')
          .update({ line_notify_token: payload })
          .eq('id', finalOrgId);
      } catch (e) {
        console.warn('Direct Supabase cloud update note:', e);
      }
    }

    try {
      fetch('/api/auth-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-client-password',
          orgId: finalOrgId,
          username: targetUsername,
          newPassword: cleanPass
        })
      }).catch(() => {});
    } catch {}

    return {
      success: true,
      message: `เปลี่ยนรหัสผ่านของ "${updatedName}" สำเร็จเรียบร้อยแล้ว (มีผลทันทีบนทุกอุปกรณ์)`
    };
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
        saveFullClientSetup,
        onboardNewClient,
        updateOrganization,
        createClientAccount,
        updateClientAccount,
        deleteClientAccount,
        changeUserPassword,
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
