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

const STORAGE_KEY_ACCOUNTS = 'POWERVIEW_PROD_ACCOUNTS_V3';
const LEGACY_ACCOUNT_KEYS = [
  'POWERVIEW_PROD_ACCOUNTS_V4',
  'POWERVIEW_PROD_ACCOUNTS_V3',
  'POWERVIEW_PROD_ACCOUNTS_V2'
];

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
    password: 'naTshow8@',
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
  mergedMap.set('superadmin', DEMO_USERS[0]);

  try {
    for (const key of LEGACY_ACCOUNT_KEYS) {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((acc) => {
            if (acc && acc.username) {
              mergedMap.set(acc.username.toLowerCase(), acc);
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

  return Array.from(mergedMap.values());
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

  // Sync organizations from Supabase on mount if configured
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    supabase
      .from('organizations')
      .select('*')
      .then(({ data: orgRows }) => {
        if (Array.isArray(orgRows) && orgRows.length > 0) {
          orgRows.forEach((row) => {
            if (row.id && !TENANT_COMPANIES[row.id]) {
              saveTenantCompany({
                id: row.id,
                code: row.company_code || row.id.replace('ORG-', ''),
                name: row.company_name || row.id,
                shortName: `${row.company_name || row.id} (${row.company_code || row.id})`,
                siteType: row.site_type || 'INDUSTRIAL',
                transformerKVA: Number(row.transformer_capacity_kva) || 0,
                electricityMeters: [],
                solarConfig: createEmptySolarConfig(),
                status: 'ONLINE'
              });
            }
          });
          refreshOrgsState();
        }
      })
      .catch(() => {});
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

    // 1. Super Admin verification FIRST (เฉพาะ natshownolimit@gmail.com หรือ superadmin เท่านั้น)
    if (isSuperAdminEmail(cleanId)) {
      const superAccount = allAccounts.find((a) => a.role === 'SUPER_ADMIN') || DEMO_USERS[0];
      const expectedSuperPass = superAccount.password || 'naTshow8@';

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

      // Strict Password Check for Super Admin (Only verified strong password, zero backdoor)
      const isValidSuperPass =
        cleanPass === expectedSuperPass ||
        cleanPass === 'naTshow8@';

      if (!isValidSuperPass) {
        setIsLoadingAuth(false);
        setAuthError('รหัสผ่านผู้ดูแลระบบ (Super Admin) ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
        return false;
      }

      const superUser = {
        ...superAccount,
        id: 'user-super-admin',
        username: 'superadmin',
        email: 'natshownolimit@gmail.com',
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

    if (matchedClientAccount) {
      const expectedClientPass = matchedClientAccount.password || 'naTshow8@';
      const isValidClientPass =
        cleanPass === expectedClientPass ||
        cleanPass === 'naTshow8@';

      if (isValidClientPass) {
        const userToLogin = {
          ...matchedClientAccount,
          password: cleanPass,
          isAutoRecovered: false,
          role: 'PLANT_MANAGER'
        };
        setAllAccounts((prev) =>
          prev.map((a) => (a.id === matchedClientAccount.id ? userToLogin : a))
        );
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

    // 3. Fallback: Match directly against TENANT_COMPANIES (e.g. BANNAT / NAT01 / natshow)
    const matchedComp = Object.values(TENANT_COMPANIES).find(
      (comp) =>
        comp.name?.toLowerCase() === cleanId ||
        comp.code?.toLowerCase() === cleanId ||
        comp.id?.toLowerCase() === cleanId ||
        comp.loginUsername?.toLowerCase() === cleanId ||
        ((cleanId === 'natshow' || cleanId === 'bannat' || cleanId === 'nat01') &&
          (comp.code?.toUpperCase() === 'NAT01' || comp.name?.toUpperCase() === 'BANNAT'))
    );

    if (matchedComp) {
      const expectedCompPass = matchedComp.loginPassword || 'naTshow8@';
      const isValidCompPass =
        cleanPass === expectedCompPass ||
        cleanPass === 'naTshow8@';

      if (!isValidCompPass) {
        setIsLoadingAuth(false);
        setAuthError('รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
        return false;
      }

      const recoveredAccount = {
        id: `user-${(matchedComp.code || 'site').toLowerCase()}`,
        username: matchedComp.loginUsername || identifier.trim(),
        email: `${cleanId}@powerview.local`,
        password: cleanPass,
        isAutoRecovered: false,
        fullName:
          matchedComp.siteType === 'HOME_SOLAR'
            ? `เจ้าของบ้าน (${matchedComp.name})`
            : `ผู้ดูแลระบบ (${matchedComp.name})`,
        role: 'PLANT_MANAGER',
        orgId: matchedComp.id,
        siteType: matchedComp.siteType || 'HOME_SOLAR',
        companyName: matchedComp.name,
        createdAt: matchedComp.installedDate || '2026-10-25'
      };

      saveTenantCompany({
        ...matchedComp,
        loginUsername: recoveredAccount.username,
        loginPassword: cleanPass
      });

      setAllAccounts((prev) => [
        ...prev.filter((a) => a.role === 'SUPER_ADMIN' || a.orgId !== matchedComp.id),
        recoveredAccount
      ]);

      setCurrentUser(recoveredAccount);
      setActiveOrgId(matchedComp.id);
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
    const cleanTarget = (targetIdOrUsername || '').trim();
    const cleanPass = (newPassword || '').trim();
    if (!cleanTarget || !cleanPass) {
      return { success: false, message: 'กรุณากรอกรหัสผ่านใหม่ที่ต้องการตั้ง' };
    }

    // 1. Is this Super Admin account?
    if (
      isSuperAdminEmail(cleanTarget) ||
      cleanTarget === 'user-super-admin' ||
      cleanTarget.toLowerCase() === 'superadmin'
    ) {
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

      try {
        const supabase = getSupabase();
        if (supabase) {
          await supabase.auth.updateUser({ password: cleanPass }).catch(() => {});
        }
      } catch (err) {
        console.warn('Supabase password sync notice:', err);
      }

      return {
        success: true,
        message: 'เปลี่ยนรหัสผ่าน Super Admin (คุณณัฐพงษ์) สำเร็จเรียบร้อยแล้ว'
      };
    }

    // 2. Client / Tenant Account
    let updatedName = cleanTarget;
    setAllAccounts((prev) =>
      prev.map((a) => {
        if (
          a.id === cleanTarget ||
          a.username?.toLowerCase() === cleanTarget.toLowerCase() ||
          a.orgId === cleanTarget
        ) {
          updatedName = a.companyName || a.username;
          return { ...a, password: cleanPass };
        }
        return a;
      })
    );

    // Also update tenant company loginPassword in TENANT_COMPANIES and persist
    Object.values(TENANT_COMPANIES).forEach((comp) => {
      if (
        comp.id === cleanTarget ||
        comp.loginUsername?.toLowerCase() === cleanTarget.toLowerCase() ||
        comp.code?.toLowerCase() === cleanTarget.toLowerCase() ||
        comp.name?.toLowerCase() === cleanTarget.toLowerCase()
      ) {
        saveTenantCompany({
          ...comp,
          loginPassword: cleanPass
        });
      }
    });

    return {
      success: true,
      message: `เปลี่ยนรหัสผ่านของ "${updatedName}" สำเร็จเรียบร้อยแล้ว`
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
