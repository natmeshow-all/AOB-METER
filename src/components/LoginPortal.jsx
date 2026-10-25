import React, { useState } from 'react';
import { 
  Building2, 
  Zap, 
  Lock, 
  Mail, 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  Activity, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Layers,
  ChevronRight
} from 'lucide-react';
import { useAuth, DEMO_USERS } from '../context/AuthContext';
import { TENANT_COMPANIES } from '../data/tenantData';

export const LoginPortal = () => {
  const { loginWithDemo, loginWithSupabase, isLoadingAuth, authError, setAuthError } = useAuth();
  const [activeTab, setActiveTab] = useState('select-company'); // 'select-company' | 'email-login'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    await loginWithSupabase(email, password);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background Decorative Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Brand Header */}
      <header className="p-4 sm:p-6 max-w-6xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
            <Zap className="w-6 h-6 text-yellow-300" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              PowerView IoT Energy Platform
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                Multi-Tenant v2.5
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              ระบบศูนย์กลางบริหารจัดการพลังงานและวิเคราะห์มิเตอร์อัจฉริยะ
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>ระบบแยกข้อมูลโรงงานด้วย RLS 100%</span>
        </div>
      </header>

      {/* Main Login Box */}
      <main className="max-w-4xl mx-auto w-full px-4 py-4 sm:py-6 z-10 flex-1 flex flex-col justify-center">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md">
          {/* Headline */}
          <div className="text-center max-w-xl mx-auto mb-6 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold border border-indigo-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>เข้าสู่ระบบเพื่อดูข้อมูลพลังงานของบริษัทท่าน</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              ระบบตรวจสอบและวิเคราะห์การใช้ไฟฟ้าอัจฉริยะ
            </h2>
            <p className="text-xs text-slate-400">
              กรุณาเลือกโรงงานของท่านเพื่อเข้าดูข้อมูลเรียลไทม์ กราฟย้อนหลัง และสรุปค่าไฟเฉพาะบริษัทของตนเอง
            </p>
          </div>

          {/* Login Mode Tabs */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('select-company')}
                className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'select-company'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>🏢 เลือกโรงงานลูกค้า (1-Click Login)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('email-login')}
                className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'email-login'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>🔐 ล็อกอินด้วย Email / Supabase</span>
              </button>
            </div>
          </div>

          {/* Auth Error Notification */}
          {authError && (
            <div className="mb-4 p-3 bg-rose-950/70 border border-rose-600 rounded-xl text-xs text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* TAB 1: 1-CLICK COMPANY SELECTION (The cleanest, fastest way for users & executives) */}
          {activeTab === 'select-company' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* 1. ART OF BAKING (AOB) */}
                <button
                  type="button"
                  onClick={() => loginWithDemo(DEMO_USERS[1])} // AOB Manager
                  className="p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/60 transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer shadow-lg hover:shadow-amber-500/10"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-sm border border-amber-500/30">
                        AOB
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-mono border border-emerald-500/20">
                        17 จุดมิเตอร์
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors">
                      บ. เอโอเบสต์ จำกัด
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                      {TENANT_COMPANIES['ORG-AOB'].industry}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">หม้อแปลง 1,600 kVA</span>
                    <span className="text-amber-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      เข้าใช้งาน ➔
                    </span>
                  </div>
                </button>

                {/* 2. GRAND BAKERY (GDB) */}
                <button
                  type="button"
                  onClick={() => loginWithDemo(DEMO_USERS[3])} // Grand Bakery Manager
                  className="p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/60 transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer shadow-lg hover:shadow-cyan-500/10"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-sm border border-cyan-500/30">
                        GDB
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-mono border border-cyan-500/20">
                        12 จุดมิเตอร์
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors">
                      บ. แกรนด์ เบเกอรี่ จำกัด
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                      {TENANT_COMPANIES['ORG-GRAND'].industry}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">หม้อแปลง 2,000 kVA</span>
                    <span className="text-cyan-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      เข้าใช้งาน ➔
                    </span>
                  </div>
                </button>

                {/* 3. SIAM COLD STORAGE (SCS) */}
                <button
                  type="button"
                  onClick={() => loginWithDemo({
                    id: 'user-scs-manager',
                    email: 'manager@siamcold.com',
                    fullName: 'คุณกิตติศักดิ์ (ผู้จัดการ Siam Cold Storage)',
                    role: 'PLANT_MANAGER',
                    orgId: 'ORG-SIAMCOLD',
                    companyName: 'บริษัท สยาม โคลด์ สตอเรจ จำกัด'
                  })}
                  className="p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/60 transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer shadow-lg hover:shadow-blue-500/10"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-500/30">
                        SCS
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-mono border border-blue-500/20">
                        14 จุดมิเตอร์
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-sm group-hover:text-blue-300 transition-colors">
                      บ. สยาม โคลด์ สตอเรจ
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                      {TENANT_COMPANIES['ORG-SIAMCOLD'].industry}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">หม้อแปลง 2,500 kVA</span>
                    <span className="text-blue-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      เข้าใช้งาน ➔
                    </span>
                  </div>
                </button>
              </div>

              {/* Super Admin Bar */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => loginWithDemo(DEMO_USERS[0])} // Super Admin
                  className="w-full p-3 rounded-2xl bg-gradient-to-r from-indigo-950/70 to-slate-900 border border-indigo-500/40 hover:border-indigo-400 transition-all flex items-center justify-between text-xs cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">👑</span>
                    <div className="text-left">
                      <span className="font-bold text-indigo-300 block">
                        เข้าสู่ระบบในฐานะ Super Admin (ผู้ดูแลระบบกลาง)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        สิทธิ์สูงสุด สามารถสลับดูทุกโรงงานลูกค้า และจัดการเชื่อมต่อ Gateway
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    เข้าสู่ระบบ ➔
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SUPABASE AUTH LOGIN FORM */}
          {activeTab === 'email-login' && (
            <form onSubmit={handleEmailSubmit} className="max-w-md mx-auto space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  อีเมลผู้ใช้งาน (Email):
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="manager@yourcompany.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  รหัสผ่าน (Password):
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoadingAuth}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoadingAuth ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{isLoadingAuth ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบด้วย Supabase'}</span>
              </button>

              <p className="text-[11px] text-slate-500 text-center">
                * ข้อมูลผู้ใช้จะถูกตรวจเช็คกับฐานข้อมูล Supabase และโหลดแดชบอร์ดเฉพาะของโรงงานที่ผู้ใช้นั้นสังกัดอยู่
              </p>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-slate-500 z-10">
        © 2026 PowerView Cloud Energy Intelligence System • Multi-Tenant Architecture with Row Level Security (RLS)
      </footer>
    </div>
  );
};
