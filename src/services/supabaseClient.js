import { createClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://lzzzbdvrgfrrkgajxfmt.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_wP4Kny7nNTyQaA9n0DthaQ_MeVsVtrs';

// Get config from localStorage, Environment variables, or Production Cloud Defaults
export const getSupabaseConfig = () => {
  try {
    const saved = localStorage.getItem('AOB_SUPABASE_CONFIG');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.url && parsed.anonKey) {
        return { url: parsed.url.trim(), anonKey: parsed.anonKey.trim(), isConfigured: true };
      }
    }
  } catch (e) {
    console.warn("Failed to read Supabase config from localStorage:", e);
  }

  const envUrl = import.meta.env?.VITE_SUPABASE_URL;
  const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envKey && !envUrl.includes('placeholder')) {
    return { url: envUrl.trim(), anonKey: envKey.trim(), isConfigured: true };
  }

  // Production Built-in Cloud Database (Auto-connect across all mobile and desktop devices)
  return {
    url: DEFAULT_SUPABASE_URL,
    anonKey: DEFAULT_SUPABASE_ANON_KEY,
    isConfigured: true
  };
};

// Create dynamic Supabase client
let supabaseInstance = null;

export const getSupabase = () => {
  const config = getSupabaseConfig();
  if (config.isConfigured) {
    if (!supabaseInstance || supabaseInstance.supabaseUrl !== config.url) {
      try {
        supabaseInstance = createClient(config.url, config.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          }
        });
      } catch (err) {
        console.error("Error creating Supabase client:", err);
        supabaseInstance = null;
      }
    }
    return supabaseInstance;
  }
  return null;
};

// Save Supabase Configuration in browser
export const saveSupabaseConfig = (url, anonKey) => {
  const cleanUrl = (url || '').trim();
  const cleanKey = (anonKey || '').trim();
  if (!cleanUrl || !cleanKey) {
    localStorage.removeItem('AOB_SUPABASE_CONFIG');
    supabaseInstance = null;
    return false;
  }
  localStorage.setItem('AOB_SUPABASE_CONFIG', JSON.stringify({ url: cleanUrl, anonKey: cleanKey }));
  supabaseInstance = null;
  return true;
};

// Test connection to Supabase instance
export const testSupabaseConnection = async (url, anonKey) => {
  try {
    const client = createClient(url.trim(), anonKey.trim());
    // Try querying a public endpoint or auth health check
    const { error } = await client.from('organizations').select('id').limit(1);
    if (error && error.code !== 'PGRST116' && !error.message.includes('permission')) {
      // If error is table not found, connection itself still worked
      if (error.message.includes('relation "public.organizations" does not exist')) {
        return { success: true, message: 'เชื่อมต่อสำเร็จ! (ยังไม่ได้รัน SQL Schema)' };
      }
      return { success: false, message: `การเชื่อมต่อขัดข้อง: ${error.message}` };
    }
    return { success: true, message: 'เชื่อมต่อฐานข้อมูล Supabase สำเร็จสมบูรณ์!' };
  } catch (err) {
    return { success: false, message: `เชื่อมต่อไม่สำเร็จ: ${err.message}` };
  }
};
