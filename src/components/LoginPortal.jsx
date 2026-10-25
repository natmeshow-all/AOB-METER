import React, { useState } from 'react';
import {
  Zap,
  Lock,
  User,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowRight,
  Cpu,
  Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPortal = () => {
  const { loginWithCredentials, isLoadingAuth, authError, setAuthError } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) return;
    await loginWithCredentials(identifier, password);
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col justify-between relative overflow-hidden select-none sm:select-auto">
      {/* Subtle Enterprise Grid & Ambient Glow */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[560px] h-[320px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[280px] bg-indigo-600/10 rounded-full blur-[110px] pointer-events-none" />

      {/* Minimal Top Bar */}
      <header className="w-full max-w-6xl mx-auto px-5 py-5 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/25 border border-blue-400/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white">
                PowerView
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                Enterprise Cloud
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Industrial IoT Power Monitoring & Energy Analytics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/80 border border-slate-800/80 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Cloud Telemetry Online</span>
        </div>
      </header>

      {/* Centered Clean Authentication Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 z-10">
        <div className="w-full max-w-[420px]">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60">
            {/* Portal Icon & Title */}
            <div className="text-center mb-7">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Lock className="w-6 h-6 text-blue-400" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                ลงชื่อเข้าใช้งานระบบ
              </h1>
              <p className="text-xs text-slate-400 mt-1.5">
                กรุณากรอกชื่อผู้ใช้งาน (Login ID) และรหัสผ่านของหน่วยงานท่าน
              </p>
            </div>

            {/* Error Alert */}
            {authError && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2.5 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{authError}</div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  ชื่อผู้ใช้งาน หรือ อีเมล (Login / Username)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (authError) setAuthError(null);
                    }}
                    placeholder="กรอกชื่อผู้ใช้งาน หรือ อีเมล"
                    className="w-full bg-slate-950/90 border border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  รหัสผ่าน (Password)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (authError) setAuthError(null);
                    }}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/90 border border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder-slate-600 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 cursor-pointer"
                    tabIndex={-1}
                    aria-label="แสดงหรือซ่อนรหัสผ่าน"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoadingAuth}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoadingAuth ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังตรวจสอบสิทธิ์...</span>
                    </>
                  ) : (
                    <>
                      <span>เข้าสู่ระบบ (Sign In)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Security Notice */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>แยกสิทธิ์ข้อมูลเฉพาะองค์กร (RLS)</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <span>Modbus Cloud v3.0</span>
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] text-slate-500 mt-4">
            หากยังไม่มีรหัสผู้ใช้งานหลังติดตั้งอุปกรณ์ กรุณาติดต่อวิศวกรผู้ดูแลระบบ
          </p>
        </div>
      </main>

      {/* Minimal Enterprise Footer */}
      <footer className="py-4 px-5 text-center text-[11px] text-slate-600 z-10">
        © 2026 PowerView Industrial Energy Intelligence. All Rights Reserved.
      </footer>
    </div>
  );
};
