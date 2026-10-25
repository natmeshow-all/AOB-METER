import React, { useState } from 'react';
import { 
  X, 
  LogIn, 
  UserCheck, 
  Building2, 
  ShieldCheck, 
  Key, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  Lock, 
  Mail, 
  User, 
  ArrowRight,
  ExternalLink,
  Layers
} from 'lucide-react';
import { useAuth, DEMO_USERS } from '../context/AuthContext';
import { getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection } from '../services/supabaseClient';

export const AuthModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const { 
    currentUser, 
    loginWithDemo, 
    loginWithSupabase, 
    signUpWithSupabase, 
    authError, 
    setAuthError, 
    isLoadingAuth,
    logout 
  } = useAuth();

  const [activeTab, setActiveTab] = useState('demo'); // 'demo' | 'login' | 'register' | 'config'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Supabase URL & Key Configuration State
  const initialConfig = getSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(initialConfig.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(initialConfig.anonKey);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleTestConnection = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      alert("กรุณากรอกทั้ง Supabase URL และ Anon Public Key ครับ");
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    const result = await testSupabaseConnection(supabaseUrl, supabaseAnonKey);
    setTestResult(result);
    setIsTesting(false);
  };

  const handleSaveConfig = () => {
    const success = saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
    if (success) {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const handleSubmitLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    await loginWithSupabase(email, password);
  };

  const handleSubmitRegister = async (e) => {
    e.preventDefault();
    if (!email || !password || !companyName) return;
    const ok = await signUpWithSupabase(email, password, fullName, companyName);
    if (ok) {
      setActiveTab('login');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl max-w-xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg shadow-emerald-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  ระบบล็อกอิน & จัดการสิทธิ์ลูกค้า (Supabase Auth)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Multi-Tenant
                </span>
              </div>
              <p className="text-xs text-slate-400">
                แยกข้อมูลแต่ละโรงงานด้วย Row Level Security (RLS) บน Supabase
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/60 px-4 pt-2 gap-1 overflow-x-auto no-scrollbar text-xs shrink-0">
          <button
            onClick={() => setActiveTab('demo')}
            className={`px-3 py-2 border-b-2 font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'demo'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🚀 สลับบัญชีทดสอบ (1-Click)
          </button>

          <button
            onClick={() => setActiveTab('login')}
            className={`px-3 py-2 border-b-2 font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'login'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🔐 เข้าสู่ระบบ (Supabase)
          </button>

          <button
            onClick={() => setActiveTab('register')}
            className={`px-3 py-2 border-b-2 font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'register'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📝 สมัครลูกค้าใหม่
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-2 border-b-2 font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'config'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚙️ เชื่อมต่อ Supabase API
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Current User Active Status Bar */}
          {currentUser && (
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center font-bold text-indigo-300">
                  {currentUser.fullName ? currentUser.fullName[0] : 'U'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{currentUser.fullName}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {currentUser.role}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">{currentUser.companyName || currentUser.email}</span>
                </div>
              </div>

              <button
                onClick={logout}
                className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-lg cursor-pointer transition-all"
              >
                ออกจากระบบ
              </button>
            </div>
          )}

          {/* Error Message */}
          {authError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-600 text-rose-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* ================= TAB 1: 1-CLICK DEMO ACCOUNTS ================= */}
          {activeTab === 'demo' && (
            <div className="space-y-3">
              <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-xl text-xs space-y-1">
                <p className="font-bold text-indigo-300">💡 โหมดทดสอบสิทธิ์ผู้ใช้และสลับโรงงานลูกค้าทันที:</p>
                <p className="text-slate-300 leading-relaxed">
                  คลิกเลือกบทบาทด้านล่างเพื่อทดสอบว่า เมื่อผู้บริหาร, ช่าง หรือลูกค้าแต่ละโรงงานล็อกอินเข้ามา จะเห็นหน้าจอและข้อมูลที่แยกขาดจากกันอย่างไร
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {DEMO_USERS.map((demo) => {
                  const isActive = currentUser?.id === demo.id;
                  return (
                    <button
                      key={demo.id}
                      onClick={() => loginWithDemo(demo)}
                      className={`p-3.5 rounded-xl border text-left text-xs transition-all cursor-pointer flex flex-col justify-between gap-2 relative ${
                        isActive 
                          ? 'bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-500' 
                          : 'bg-slate-800/80 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            demo.role === 'SUPER_ADMIN' 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : demo.role === 'PLANT_MANAGER'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {demo.role}
                          </span>
                          {isActive && (
                            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> ใช้งานอยู่
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-white text-sm mt-1">{demo.fullName}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">{demo.companyName}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{demo.email}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= TAB 2: SUPABASE SIGN IN ================= */}
          {activeTab === 'login' && (
            <form onSubmit={handleSubmitLogin} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">อีเมลผู้ใช้งาน (Email):</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@company.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">รหัสผ่าน (Password):</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoadingAuth}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoadingAuth ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                <span>{isLoadingAuth ? 'กำลังยืนยันตัวตน...' : 'เข้าสู่ระบบด้วย Supabase'}</span>
              </button>
            </form>
          )}

          {/* ================= TAB 3: SIGN UP NEW TENANT ================= */}
          {activeTab === 'register' && (
            <form onSubmit={handleSubmitRegister} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">ชื่อ-นามสกุล ผู้จัดการ:</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="คุณสุรศักดิ์ ใจดี"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">ชื่อบริษัท / โรงงานลูกค้า:</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="บ. สยามฟู้ดส์ โปรดักส์ จำกัด"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">อีเมลติดต่อ (ใช้เป็นชื่อผู้ใช้):</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="manager@siamfoods.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">รหัสผ่าน:</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoadingAuth}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoadingAuth ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                <span>ลงทะเบียนโรงงานลูกค้าใหม่</span>
              </button>
            </form>
          )}

          {/* ================= TAB 4: SUPABASE API CONFIGURATION ================= */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs space-y-1.5">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Key className="w-4 h-4" /> วิธีรับ Supabase URL และ Anon Key:
                </span>
                <p className="text-slate-300 leading-relaxed">
                  1. สมัครหรือเปิดโปรเจกต์ที่ <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline inline-flex items-center gap-0.5">supabase.com <ExternalLink className="w-3 h-3" /></a><br/>
                  2. เข้าเมนู <strong>Project Settings ➔ API</strong> แล้วคัดลอก <strong>Project URL</strong> และ <strong>anon public key</strong> มาวางที่นี่:
                </p>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Project URL:</label>
                  <input
                    type="text"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://xxxxxxxx.supabase.co"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Anon Public Key:</label>
                  <textarea
                    rows={2}
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>
              </div>

              {testResult && (
                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  testResult.success 
                    ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300' 
                    : 'bg-rose-950/50 border-rose-600 text-rose-300'
                }`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />}
                  <span>{isTesting ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSaved ? 'บันทึกเรียบร้อย!' : 'บันทึกการตั้งค่า'}</span>
                </button>
              </div>

              {/* SQL Schema Notice */}
              <div className="p-3 bg-indigo-950/30 rounded-xl border border-indigo-900/60 text-xs space-y-1">
                <span className="font-bold text-indigo-300">📄 ไฟล์ SQL Schema & RLS Policies:</span>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  เราได้เตรียมไฟล์สคริปต์ SQL พร้อมสร้างตารางและนโยบายความปลอดภัย RLS ไว้ให้ที่โฟลเดอร์ <code className="text-indigo-300">supabase/schema.sql</code> สามารถก๊อปปี้ไปวางในเมนู <strong>SQL Editor</strong> บนเว็บ Supabase แล้วกด Run ได้ทันทีครับ
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
