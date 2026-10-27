import React, { useState, useMemo } from 'react';
import {
  Lock,
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  Shuffle,
  Search,
  Sparkles,
  X,
  User,
  Building2,
  Home,
  AlertCircle,
  CheckCircle2,
  Cpu,
  RefreshCw
} from 'lucide-react';
import { useAuth, getActiveSuperAdminPassword } from '../context/AuthContext';

// Password Strength Evaluator
const evaluatePasswordStrength = (pass = '') => {
  if (!pass) return { score: 0, label: 'กรุณากรอกรหัสผ่าน', color: 'bg-slate-700', text: 'text-slate-500' };
  if (pass.length < 6) return { score: 1, label: 'สั้นเกินไป (อย่างน้อย 6 ตัวอักษร)', color: 'bg-rose-500', text: 'text-rose-400' };
  
  let score = 2;
  const hasLetters = /[a-zA-Z]/.test(pass);
  const hasNumbers = /[0-9]/.test(pass);
  const hasSymbols = /[^a-zA-Z0-9]/.test(pass);

  if (hasLetters && hasNumbers) score = 3;
  if (pass.length >= 8 && hasLetters && hasNumbers) score = 4;
  if (pass.length >= 10 && hasLetters && hasNumbers && hasSymbols) score = 5;

  if (score <= 2) return { score: 2, label: 'ระดับพอใช้', color: 'bg-amber-500', text: 'text-amber-400' };
  if (score <= 3) return { score: 3, label: 'ความปลอดภัยปานกลาง', color: 'bg-sky-500', text: 'text-sky-400' };
  return { score: 4, label: 'ความปลอดภัยสูงมาก (Strong)', color: 'bg-emerald-500', text: 'text-emerald-400' };
};

// Generate Strong & Memorable Random Password
const generateSecurePassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  let result = '';
  // Ensure at least 1 uppercase, 1 lowercase, 1 number, 1 symbol
  result += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)];
  result += 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 24)];
  result += '23456789'[Math.floor(Math.random() * 8)];
  result += '!@#$%&*'[Math.floor(Math.random() * 7)];
  
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

export const PasswordManagementModal = ({ isOpen, onClose, defaultSelectedOrgId = null }) => {
  const { allAccounts, currentUser, changeUserPassword } = useAuth();

  const [activeTab, setActiveTab] = useState(() => (defaultSelectedOrgId ? 'clients' : 'superadmin')); // 'superadmin' | 'clients'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Super Admin Password Form State
  const [superNewPassword, setSuperNewPassword] = useState('');
  const [superConfirmPassword, setSuperConfirmPassword] = useState('');
  const [showSuperNewPass, setShowSuperNewPass] = useState(false);
  const [showSuperConfirmPass, setShowSuperConfirmPass] = useState(false);
  const [superCurrentPassVisible, setSuperCurrentPassVisible] = useState(false);

  // Client Accounts Password Editing State: Map of accountId -> { isEditing, newPass, showPass }
  const [clientEditMap, setClientEditMap] = useState(() => {
    const map = {};
    if (defaultSelectedOrgId) {
      map[defaultSelectedOrgId] = { isEditing: true, newPass: '', showPass: true };
    }
    return map;
  });

  // Client view password visibility toggle map
  const [visibleClientPasswords, setVisibleClientPasswords] = useState({});

  // Global Toast Notification in Modal
  const [toastNotice, setToastNotice] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const showToast = (type, message) => {
    setToastNotice({ type, message });
    setTimeout(() => setToastNotice(null), 4000);
  };

  const copyToClipboard = async (text, idKey) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(idKey);
      showToast('success', `📋 คัดลอก "${text}" เรียบร้อยแล้ว`);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      showToast('error', 'ไม่สามารถคัดลอกลง Clipboard ได้ กรุณาคัดลอกด้วยตนเอง');
    }
  };

  // Find Super Admin Account
  const superAccount = useMemo(() => {
    return (
      allAccounts.find((a) => a.role === 'SUPER_ADMIN') || {
        id: 'user-super-admin',
        username: 'superadmin',
        email: 'natshownolimit@gmail.com',
        fullName: 'คุณณัฐพงษ์ (Super Admin)',
        role: 'SUPER_ADMIN',
        password: currentUser?.password || 'naTshow8@'
      }
    );
  }, [allAccounts, currentUser]);

  // Filtered Client Accounts
  const clientAccounts = useMemo(() => {
    const list = allAccounts.filter((a) => a.role !== 'SUPER_ADMIN');
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (a) =>
        a.username?.toLowerCase().includes(q) ||
        a.companyName?.toLowerCase().includes(q) ||
        a.orgId?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q)
    );
  }, [allAccounts, searchQuery]);

  // Handle Save Super Admin Password
  const handleSaveSuperAdminPassword = async (e) => {
    e.preventDefault();
    if (!superNewPassword.trim()) {
      showToast('error', 'กรุณากรอกรหัสผ่านใหม่');
      return;
    }
    if (superNewPassword.length < 5) {
      showToast('error', 'รหัสผ่านควรมีความยาวอย่างน้อย 5 ตัวอักษร');
      return;
    }
    if (superNewPassword !== superConfirmPassword) {
      showToast('error', 'รหัสผ่านยืนยันไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
      return;
    }

    setIsSaving(true);
    const res = await changeUserPassword('user-super-admin', superNewPassword.trim());
    setIsSaving(false);

    if (res.success) {
      showToast('success', res.message);
      setSuperNewPassword('');
      setSuperConfirmPassword('');
    } else {
      showToast('error', res.message);
    }
  };

  // Handle Save Client Account Password
  const handleSaveClientPassword = async (account) => {
    const editState = clientEditMap[account.id] || clientEditMap[account.orgId] || {};
    const newPass = (editState.newPass || '').trim();

    if (!newPass) {
      showToast('error', `กรุณากรอกรหัสผ่านใหม่สำหรับ ${account.companyName || account.username}`);
      return;
    }

    setIsSaving(true);
    const res = await changeUserPassword(account, newPass);
    setIsSaving(false);

    if (res.success) {
      showToast('success', res.message);
      // Close editing for this account
      setClientEditMap((prev) => ({
        ...prev,
        [account.id]: { isEditing: false, newPass: '', showPass: false },
        [account.orgId]: { isEditing: false, newPass: '', showPass: false }
      }));
    } else {
      showToast('error', res.message);
    }
  };

  if (!isOpen) return null;

  const superStrength = evaluatePasswordStrength(superNewPassword);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn select-none sm:select-auto">
      <div className="relative w-full max-w-3xl bg-[#090d18] border border-blue-500/40 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Modal Top Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-800 p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 border border-blue-400/40 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <Key className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>จัดการรหัสผ่านผู้ใช้งาน (Super Admin Password Vault)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  สิทธิ์ผู้ดูแลระบบสูงสุด
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                ดู จัดการ และเปลี่ยนรหัสผ่านสำหรับ Super Admin และบัญชีผู้ใช้งานลูกค้าทุกแห่ง
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Floating Toast Notification Inside Modal */}
        {toastNotice && (
          <div
            className={`mx-4 sm:mx-6 mt-4 p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 shadow-lg animate-fadeIn ${
              toastNotice.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toastNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{toastNotice.message}</span>
            </div>
            <button
              onClick={() => setToastNotice(null)}
              className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Tab Navigation Controls */}
        <div className="px-4 sm:px-6 pt-4 pb-2 border-b border-slate-800/80 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('superadmin')}
            className={`flex-1 sm:flex-initial py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'superadmin'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-300" />
            <span>👑 รหัสผ่าน Super Admin (คุณณัฐพงษ์)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clients')}
            className={`flex-1 sm:flex-initial py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'clients'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4 text-sky-400" />
            <span>👥 รหัสผ่านบัญชีลูกค้า ({clientAccounts.length} แห่ง)</span>
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs font-sans">

          {/* ================================================================= */}
          {/* TAB 1: SUPER ADMIN PASSWORD MANAGEMENT                            */}
          {/* ================================================================= */}
          {activeTab === 'superadmin' && (
            <div className="space-y-4">
              {/* Super Admin Info Card */}
              <div className="bg-[#0e1424] border border-blue-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-black text-lg">
                    👑
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-bold text-white">
                        {superAccount.fullName || 'คุณณัฐพงษ์ (Super Admin)'}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        SUPER_ADMIN
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5 flex flex-wrap items-center gap-2">
                      <span>Login ID: <strong className="text-sky-300">{superAccount.email || 'natshownolimit@gmail.com'}</strong></span>
                      <span>(หรือชื่อ: <strong className="text-sky-300">{superAccount.username || 'superadmin'}</strong>)</span>
                    </div>
                  </div>
                </div>

                {/* Current Super Admin Password Viewer & Quick Copy */}
                <div className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between sm:justify-end gap-3 font-mono">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">รหัสผ่านปัจจุบัน</span>
                    <span className="text-xs font-bold text-amber-300">
                      {superCurrentPassVisible
                        ? getActiveSuperAdminPassword()
                        : '••••••••'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSuperCurrentPassVisible(!superCurrentPassVisible)}
                      className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
                      title={superCurrentPassVisible ? 'ซ่อนรหัส' : 'ดูรหัส'}
                    >
                      {superCurrentPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(getActiveSuperAdminPassword(), 'super-current')}
                      className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
                      title="คัดลอกรหัสผ่าน"
                    >
                      {copiedId === 'super-current' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Form: Change Super Admin Password */}
              <form onSubmit={handleSaveSuperAdminPassword} className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-400" />
                    <span>ตั้งรหัสผ่านใหม่สำหรับ Super Admin</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const gen = generateSecurePassword();
                      setSuperNewPassword(gen);
                      setSuperConfirmPassword(gen);
                      setShowSuperNewPass(true);
                      showToast('success', `🎲 สุ่มรหัสผ่านปลอดภัยสำเร็จ: ${gen}`);
                    }}
                    className="text-xs text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1.5 cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30 transition-all active:scale-95"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>🎲 สุ่มรหัสผ่านปลอดภัย</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* New Password Input */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-300 font-bold text-xs">
                      1. รหัสผ่านใหม่ (New Password) *
                    </label>
                    <div className="relative">
                      <input
                        type={showSuperNewPass ? 'text' : 'password'}
                        value={superNewPassword}
                        onChange={(e) => setSuperNewPassword(e.target.value)}
                        placeholder="กรอกรหัสผ่านใหม่ที่คุณต้องการ"
                        className="w-full bg-[#0a0f1d] border border-slate-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs pr-10 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSuperNewPass(!showSuperNewPass)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                      >
                        {showSuperNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password Strength Meter */}
                    {superNewPassword && (
                      <div className="space-y-1 pt-1">
                        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden flex">
                          <div
                            className={`h-full transition-all duration-300 ${superStrength.color}`}
                            style={{ width: `${(superStrength.score / 4) * 100}%` }}
                          />
                        </div>
                        <div className={`text-[10px] font-bold ${superStrength.text}`}>
                          ความแข็งแรง: {superStrength.label}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password Input */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-300 font-bold text-xs">
                      2. ยืนยันรหัสผ่านใหม่อีกครั้ง (Confirm Password) *
                    </label>
                    <div className="relative">
                      <input
                        type={showSuperConfirmPass ? 'text' : 'password'}
                        value={superConfirmPassword}
                        onChange={(e) => setSuperConfirmPassword(e.target.value)}
                        placeholder="กรอกรหัสผ่านใหม่อีกครั้งให้ตรงกัน"
                        className="w-full bg-[#0a0f1d] border border-slate-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs pr-10 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSuperConfirmPass(!showSuperConfirmPass)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                      >
                        {showSuperConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {superConfirmPassword && superNewPassword !== superConfirmPassword && (
                      <div className="text-[10px] text-rose-400 font-bold pt-1">
                        ⚠️ รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-400">
                    * เมื่อเปลี่ยนรหัสผ่านแล้ว คุณสามารถใช้รหัสผ่านใหม่นี้เข้าสู่ระบบได้ทันทีในทุกเครื่อง
                  </span>
                  <button
                    type="submit"
                    disabled={isSaving || !superNewPassword || superNewPassword !== superConfirmPassword}
                    className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-40 transition-all active:scale-95 flex items-center gap-2"
                  >
                    {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />}
                    <span>💾 บันทึกเปลี่ยนรหัสผ่าน Super Admin</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: CLIENT ACCOUNTS PASSWORD MANAGEMENT                        */}
          {/* ================================================================= */}
          {activeTab === 'clients' && (
            <div className="space-y-4">
              {/* Search & Overview Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาตามชื่อบริษัท, รหัสไซต์ (เช่น BANNAT, NAT01), หรือ Username..."
                    className="w-full bg-[#0a0f1d] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="text-xs text-slate-400 font-mono bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-center">
                  พบบัญชีลูกค้า: <strong className="text-indigo-400">{clientAccounts.length}</strong> ราย
                </div>
              </div>

              {/* Client Accounts List */}
              <div className="space-y-3">
                {clientAccounts.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/70 border border-dashed border-slate-800 rounded-2xl text-slate-500">
                    ไม่พบบัญชีลูกค้าที่ตรงกับคำค้นหา
                  </div>
                ) : (
                  clientAccounts.map((acc) => {
                    const editState = clientEditMap[acc.id] || clientEditMap[acc.orgId] || {
                      isEditing: false,
                      newPass: '',
                      showPass: false
                    };
                    const isVisible = visibleClientPasswords[acc.id] || false;
                    const isHome = acc.siteType === 'HOME_SOLAR';

                    return (
                      <div
                        key={acc.id || acc.orgId}
                        className={`rounded-2xl border transition-all p-4 space-y-3 ${
                          editState.isEditing
                            ? 'bg-slate-900 border-indigo-500/60 shadow-lg'
                            : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        {/* Client Row Summary */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center shrink-0">
                              {isHome ? (
                                <Home className="w-5 h-5 text-emerald-400" />
                              ) : (
                                <Building2 className="w-5 h-5 text-blue-400" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs sm:text-sm">
                                  {acc.companyName || acc.username}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
                                  {acc.orgId || 'CLIENT'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                Login Username: <strong className="text-amber-300">{acc.username}</strong>
                              </div>
                            </div>
                          </div>

                          {/* Current Password Display & Action Buttons */}
                          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-850">
                            {/* Current Password Box */}
                            <div className="bg-[#050812] border border-slate-800 rounded-xl px-2.5 py-1.5 flex items-center gap-2 font-mono text-xs">
                              <span className="text-[10px] text-slate-500">รหัส:</span>
                              <span className="font-bold text-slate-200">
                                {isVisible ? acc.password || 'admin' : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setVisibleClientPasswords((prev) => ({
                                    ...prev,
                                    [acc.id]: !isVisible
                                  }))
                                }
                                className="p-1 text-slate-500 hover:text-white"
                                title={isVisible ? 'ซ่อนรหัส' : 'ดูรหัส'}
                              >
                                {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(acc.password || 'admin', `acc-${acc.id}`)}
                                className="p-1 text-slate-500 hover:text-white"
                                title="คัดลอกรหัสส่งให้ลูกค้า"
                              >
                                {copiedId === `acc-${acc.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>

                            {/* Toggle Edit Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setClientEditMap((prev) => ({
                                  ...prev,
                                  [acc.id]: {
                                    isEditing: !editState.isEditing,
                                    newPass: editState.newPass || '',
                                    showPass: true
                                  }
                                }));
                              }}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                                editState.isEditing
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                              }`}
                            >
                              {editState.isEditing ? 'ยกเลิก' : '✏️ เปลี่ยนรหัส'}
                            </button>
                          </div>
                        </div>

                        {/* Inline Password Change Panel */}
                        {editState.isEditing && (
                          <div className="bg-[#050812] border border-indigo-500/40 rounded-xl p-3.5 space-y-3 animate-fadeIn">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-indigo-300 text-xs flex items-center gap-1.5">
                                <Key className="w-3.5 h-3.5" />
                                <span>ตั้งรหัสผ่านใหม่สำหรับ: <strong>{acc.username}</strong></span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const gen = generateSecurePassword();
                                  setClientEditMap((prev) => ({
                                    ...prev,
                                    [acc.id]: { ...editState, newPass: gen, showPass: true }
                                  }));
                                  showToast('success', `🎲 สุ่มรหัสใหม่ให้ ${acc.username}: ${gen}`);
                                }}
                                className="text-[11px] text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1 bg-amber-500/15 px-2 py-0.5 rounded-lg border border-amber-500/30"
                              >
                                <Shuffle className="w-3 h-3" />
                                <span>สุ่มรหัสผ่าน</span>
                              </button>
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <div className="relative flex-1">
                                <input
                                  type={editState.showPass ? 'text' : 'password'}
                                  value={editState.newPass || ''}
                                  onChange={(e) =>
                                    setClientEditMap((prev) => ({
                                      ...prev,
                                      [acc.id]: { ...editState, newPass: e.target.value }
                                    }))
                                  }
                                  placeholder="กรอกรหัสผ่านใหม่สำหรับลูกค้ารายนี้"
                                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white pr-10 outline-none focus:border-indigo-400"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setClientEditMap((prev) => ({
                                      ...prev,
                                      [acc.id]: { ...editState, showPass: !editState.showPass }
                                    }))
                                  }
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                                >
                                  {editState.showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleSaveClientPassword(acc)}
                                disabled={isSaving || !(editState.newPass || '').trim()}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-40 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                              >
                                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                <span>บันทึกรหัสใหม่</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-[#060a14] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>ความปลอดภัยระดับ Enterprise • บันทึกลงฐานข้อมูลทันทีแบบ Real-Time</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 cursor-pointer active:scale-95 transition-all"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
