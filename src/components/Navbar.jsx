import React from 'react';
import { 
  Building2, 
  Droplet, 
  Zap, 
  Sun, 
  Camera, 
  Bell, 
  Settings, 
  FileSpreadsheet, 
  Calendar,
  CheckCircle2,
  Activity,
  User,
  ChevronDown
} from 'lucide-react';
import { COMPANY_INFO } from '../data/mockData';
import { useAuth } from '../context/AuthContext';

export const Navbar = ({ 
  activeTab, 
  setActiveTab, 
  timeframe, 
  setTimeframe, 
  onOpenScanner, 
  onOpenLineSimulator, 
  onOpenSettings,
  currentDate,
  setCurrentDate
}) => {
  const { 
    currentUser, 
    activeOrganization, 
    activeOrgId, 
    allOrganizations, 
    isSuperAdmin, 
    switchOrganization, 
    setIsAuthModalOpen 
  } = useAuth();
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-2.5 rounded-xl shadow-lg shadow-orange-950/40">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-xl font-bold text-white tracking-tight">
                  {activeOrganization?.name || COMPANY_INFO.name}
                </h1>
                <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Live
                </span>

                {/* Tenant Switcher Dropdown for Super Admin */}
                {isSuperAdmin && (
                  <div className="flex items-center gap-1 bg-slate-800/90 border border-amber-500/40 rounded-lg px-2 py-0.5 text-xs">
                    <span className="text-[10px] text-amber-400 font-bold hidden sm:inline">สลับโรงงาน:</span>
                    <select
                      value={activeOrgId}
                      onChange={(e) => switchOrganization(e.target.value)}
                      className="bg-transparent text-amber-300 font-bold font-mono focus:outline-none cursor-pointer text-xs"
                      title="สลับมุมมองลูกค้าแต่ละเจ้า"
                    >
                      {allOrganizations.map((org) => (
                        <option key={org.id} value={org.id} className="bg-slate-900 text-white">
                          🏢 {org.shortName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400">
                ระบบบริหารจัดการพลังงาน Multi-Tenant | หม้อแปลง: <span className="text-amber-300 font-mono font-bold">{activeOrganization?.transformerKVA || 1600} kVA</span> | รหัส: <span className="text-slate-300 font-mono">{activeOrganization?.code || 'AOB'}</span>
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-medium rounded-lg shadow-md transition-all cursor-pointer"
              title="ทดสอบอ่านรูปมิเตอร์ด้วย AI"
            >
              <Camera className="w-4 h-4 text-yellow-300" />
              <span className="hidden sm:inline">สแกนรูปมิเตอร์ (AI)</span>
              <span className="sm:hidden">สแกน AI</span>
            </button>

            <button
              onClick={onOpenLineSimulator}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs sm:text-sm font-medium rounded-lg transition-all cursor-pointer"
              title="ทดสอบระบบเตือน 06:30 น. และส่งรายงาน 08:00 น."
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">LINE Bot & เตือน 06:30 น.</span>
              <span className="sm:hidden">LINE Bot</span>
            </button>

            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/30 hover:to-teal-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer"
              title="สลับบัญชีผู้ใช้ หรือ เชื่อมต่อ Supabase Auth"
            >
              <User className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="hidden md:inline font-bold text-white max-w-[120px] truncate">
                {currentUser ? currentUser.fullName.split(' ')[0] : 'เข้าสู่ระบบ'}
              </span>
              {currentUser && (
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-emerald-500/20 text-emerald-300 hidden lg:inline border border-emerald-500/30">
                  {currentUser.role === 'SUPER_ADMIN' ? '👑 Admin' : currentUser.role === 'PLANT_MANAGER' ? '👔 Manager' : '🔧 Tech'}
                </span>
              )}
            </button>

            <button
              onClick={onOpenSettings}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-all cursor-pointer"
              title="ตั้งค่า Google Sheet & LINE Token"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs & Period Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between py-2 gap-2 sm:gap-4">
          {/* Main Category Tabs */}
          <nav className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            <button
              onClick={() => setActiveTab('water')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'water'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Droplet className="w-4 h-4 text-blue-400 shrink-0" />
              <span><span className="hidden sm:inline">มิเตอร์</span>น้ำ (3)</span>
            </button>

            <button
              onClick={() => setActiveTab('realtime')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'realtime'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
              <span>⚡ ออนไลน์ (IoT)</span>
            </button>

            <button
              onClick={() => setActiveTab('electricity')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'electricity'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span><span className="hidden sm:inline">มิเตอร์</span>ไฟฟ้า (14)</span>
            </button>

            <button
              onClick={() => setActiveTab('solar')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'solar'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sun className="w-4 h-4 text-yellow-400 shrink-0" />
              <span>โซลาร์</span>
            </button>

            <button
              onClick={() => setActiveTab('monthly-sheet')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'monthly-sheet'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-400 shrink-0" />
              <span><span className="hidden sm:inline">ตารางรวม </span>1-31 วัน</span>
            </button>
          </nav>

          {/* Timeframe Selector & Date Controls */}
          <div className="flex items-center gap-3">
            {activeTab !== 'monthly-sheet' && (
              <div className="flex items-center bg-slate-800/90 p-1 rounded-lg border border-slate-700/60">
                <button
                  onClick={() => setTimeframe('daily')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    timeframe === 'daily'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  รายวัน
                </button>
                <button
                  onClick={() => setTimeframe('monthly')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    timeframe === 'monthly'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  รายเดือน
                </button>
                <button
                  onClick={() => setTimeframe('yearly')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    timeframe === 'yearly'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  รายปี
                </button>
              </div>
            )}

            {timeframe === 'daily' && activeTab !== 'monthly-sheet' && (
              <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>วันที่:</span>
                <select
                  value={currentDate}
                  onChange={(e) => setCurrentDate(e.target.value)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="2026-09-01" className="bg-slate-800">1 ก.ย. 2569 (บันทึกเมื่อวาน)</option>
                  <option value="2026-09-02" className="bg-slate-800">2 ก.ย. 2569</option>
                  <option value="2026-09-03" className="bg-slate-800">3 ก.ย. 2569 (วันนี้)</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
