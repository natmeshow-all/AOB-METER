// Vercel Serverless Function: Cloud Password Vault & Multi-Device Credential Synchronizer
// Ensures real-time password synchronization across all devices worldwide for Super Admin and Client accounts

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lzzzbdvrgfrrkgajxfmt.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_wP4Kny7nNTyQaA9n0DthaQ_MeVsVtrs';
const SUPER_EMAIL = 'natshownolimit@gmail.com';

export default async function handler(req, res) {
  // Security & CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const action = req.query?.action || req.body?.action || 'get-credentials';

    // Helper: establish authenticated session as Super Admin
    const getAuthenticatedClient = async () => {
      const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      // Try signing in using known active credentials
      const passwordsToTry = ['naTshow8@'];
      if (req.body?.adminPassword) {
        passwordsToTry.unshift(req.body.adminPassword);
      }
      for (const p of passwordsToTry) {
        const { data, error } = await authClient.auth.signInWithPassword({
          email: SUPER_EMAIL,
          password: p
        });
        if (data?.session && !error) {
          return authClient;
        }
      }
      return authClient;
    };

    // ACTION 1: Get all active client credentials synchronized from Cloud
    if (action === 'get-credentials') {
      const authClient = await getAuthenticatedClient();
      const { data: orgs, error } = await authClient
        .from('organizations')
        .select('id, company_name, company_code, line_notify_token, is_active');

      if (error) {
        return res.status(200).json({ success: true, credentials: {} });
      }

      const credentials = {};
      if (Array.isArray(orgs)) {
        orgs.forEach((org) => {
          if (org.line_notify_token && org.line_notify_token.startsWith('{')) {
            try {
              const parsed = JSON.parse(org.line_notify_token);
              if (parsed.loginPassword || parsed.solarConfig) {
                credentials[org.id] = {
                  orgId: org.id,
                  companyCode: org.company_code,
                  companyName: org.company_name,
                  loginUsername: parsed.loginUsername || org.company_code?.toLowerCase(),
                  loginPassword: parsed.loginPassword || 'naTshow8@',
                  solarConfig: parsed.solarConfig || null,
                  updatedAt: parsed.updatedAt || null
                };
                if (parsed.loginUsername) {
                  credentials[parsed.loginUsername.toLowerCase()] = credentials[org.id];
                }
                if (org.company_code) {
                  credentials[org.company_code.toLowerCase()] = credentials[org.id];
                }
              }
            } catch {}
          }
        });
      }

      return res.status(200).json({ success: true, credentials });
    }

    // ACTION 2: Verify login credentials for client or superadmin
    if (action === 'verify-login') {
      const { identifier, password } = req.body || {};
      const cleanId = (identifier || '').trim().toLowerCase();
      const cleanPass = (password || '').trim();

      if (!cleanId || !cleanPass) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' });
      }

      // 1. Super Admin
      if (cleanId === 'superadmin' || cleanId === SUPER_EMAIL) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: SUPER_EMAIL,
          password: cleanPass
        });
        if (data?.user && !error) {
          return res.status(200).json({
            success: true,
            role: 'SUPER_ADMIN',
            username: 'superadmin',
            email: SUPER_EMAIL
          });
        }
        return res.status(401).json({ success: false, message: 'รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง' });
      }

      // 2. Client Account
      const authClient = await getAuthenticatedClient();
      const { data: orgs } = await authClient
        .from('organizations')
        .select('id, company_name, company_code, line_notify_token');

      if (Array.isArray(orgs)) {
        for (const org of orgs) {
          let expectedPass = 'naTshow8@';
          let expectedUser = org.company_code?.toLowerCase();

          if (org.line_notify_token && org.line_notify_token.startsWith('{')) {
            try {
              const parsed = JSON.parse(org.line_notify_token);
              if (parsed.loginPassword) expectedPass = parsed.loginPassword;
              if (parsed.loginUsername) expectedUser = parsed.loginUsername.toLowerCase();
            } catch {}
          }

          const isMatchUser =
            cleanId === expectedUser ||
            cleanId === org.id.toLowerCase() ||
            cleanId === org.company_code?.toLowerCase() ||
            cleanId === org.company_name?.toLowerCase() ||
            ((cleanId === 'natshow' || cleanId === 'bannat') && org.id === 'ORG-NAT01');

          if (isMatchUser) {
            if (cleanPass === expectedPass) {
              return res.status(200).json({
                success: true,
                role: 'PLANT_MANAGER',
                orgId: org.id,
                companyName: org.company_name,
                username: expectedUser
              });
            } else {
              return res.status(401).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
            }
          }
        }
      }

      return res.status(404).json({ success: false, message: 'ไม่พบบัญชีผู้ใช้งานนี้' });
    }

    // ACTION 3: Cloud Password Update for Client Account
    if (action === 'update-client-password') {
      const { orgId, username, newPassword } = req.body || {};
      const cleanPass = (newPassword || '').trim();
      if (!cleanPass) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกรหัสผ่านใหม่' });
      }

      const authClient = await getAuthenticatedClient();
      const payload = JSON.stringify({
        loginUsername: username || 'client',
        loginPassword: cleanPass,
        updatedAt: new Date().toISOString()
      });

      const { error } = await authClient
        .from('organizations')
        .update({ line_notify_token: payload })
        .eq('id', orgId);

      if (error) {
        return res.status(500).json({ success: false, message: error.message });
      }

      return res.status(200).json({
        success: true,
        message: 'บันทึกรหัสผ่านใหม่ลงระบบคลาวด์สำเร็จ พร้อมใช้งานบนทุกอุปกรณ์ทันที'
      });
    }

    // ACTION 4: Cloud Solar Configuration Update for Hybrid Inverter & PV Strings
    if (action === 'update-solar-config') {
      const { orgId, solarConfig } = req.body || {};
      const targetOrgId = orgId || 'ORG-NAT01';
      if (!solarConfig || typeof solarConfig !== 'object') {
        return res.status(400).json({ success: false, message: 'Missing solarConfig payload' });
      }

      const authClient = await getAuthenticatedClient();
      const { data: org } = await authClient
        .from('organizations')
        .select('id, line_notify_token')
        .eq('id', targetOrgId)
        .maybeSingle();

      let parsed = {};
      if (org?.line_notify_token && org.line_notify_token.startsWith('{')) {
        try {
          parsed = JSON.parse(org.line_notify_token);
        } catch {}
      }

      // Preserve existing credentials and attach clean solarConfig
      parsed.solarConfig = {
        ...(parsed.solarConfig || {}),
        ...solarConfig
      };
      parsed.updatedAt = new Date().toISOString();

      const { error } = await authClient
        .from('organizations')
        .update({ line_notify_token: JSON.stringify(parsed) })
        .eq('id', targetOrgId);

      if (error) {
        return res.status(500).json({ success: false, message: error.message });
      }

      return res.status(200).json({
        success: true,
        message: 'บันทึกการตั้งค่าแผงโซลาร์ลงคลาวด์สำเร็จ ซิงก์เชื่อมโยงทุกอุปกรณ์ทันที'
      });
    }

    return res.status(400).json({ success: false, message: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
