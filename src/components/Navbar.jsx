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
  TrendingUp,
  LogOut,
  ShieldCheck
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
    logout
  } = useAuth();

  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between py-3 border-b border-slate-800/80 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-xl shadow-lg shrink-0 ${
                isSuperAdmin && activeTab === 'super-admin'
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-950/40'
                  : 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-950/40'
              }`}
            >
              {isSuperAdmin && activeTab === 'super-admin' ? (
                <ShieldCheck className="w-6 h-6 text-white" />
              ) : (
                <Building2 className="w-6 h-6 text-white" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm sm:text-lg font-bold text-white tracking-tight truncate">
                  {isSuperAdmin && activeTab === 'super-admin'
                    ? 'PowerView Super Admin Command Center'
                    : activeOrganization?.name || COMPANY_INFO.name}
                </h1>

                <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> Online
                </span>

                {/* Tenant Switcher Dropdown (Strictly visible ONLY for Super Admin) */}
                {isSuperAdmin && (
                  <div className="flex items-center gap-1.5 bg-slate-800/90 border border-amber-500/40 rounded-lg px-2.5 py-0.5 text-xs">
                    <span className="text-[10px] text-amber-400 font-bold hidden sm:inline">
                      กำลังดูบริษัท:
                    </span>
                    <select
                      value={activeOrgId}
                      onChange={(e) => {
                        switchOrganization(e.target.value);
                        if (activeTab === 'super-admin') {
                          setActiveTab('realtime');
                        }
                      }}
                      className="bg-transparent text-amber-300 font-bold font-mono focus:outline-none cursor-pointer text-xs"
                      title="สลับดูแดชบอร์ดของบริษัทลูกค้า"
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

              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {isSuperAdmin && activeTab === 'super-admin' ? (
                  <span>
                    ผู้ดูแลระบบสูงสุด: <strong className="text-amber-300">{currentUser?.email}</strong> • ควบคุมลูกค้าทั้งหมด {allOrganizations.length} บริษัท
                  </span>
                ) : (
                  <span>
                    หม้อแปลง: <strong className="text-amber-300 font-mono">{activeOrganization?.transformerKVA || 1600} kVA</strong> • รหัสไซต์: <strong className="text-slate-300 font-mono">{activeOrganization?.code || 'AOB'}</strong> • มิเตอร์ออนไลน์ <strong className="text-emerald-400 font-mono">{activeOrganization?.meterCount || 17} จุด</strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right Quick Actions & User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-medium rounded-lg shadow-md transition-all cursor-pointer"
              title="สแกนรูปมิเตอร์ด้วย AI"
            >
              <Camera className="w-4 h-4 text-yellow-300" />
              <span className="hidden md:inline">สแกนมิเตอร์ (AI)</span>
            </button>

            <button
              onClick={onOpenLineSimulator}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-medium rounded-lg transition-all cursor-pointer"
              title="ระบบแจ้งเตือน LINE Bot"
            >
              <Bell className="w-4 h-4" />
              <span className="hidden lg:inline">LINE แจ้งเตือน</span>
            </button>

            {/* Active User Badge */}
            {currentUser && (
              <div
                onClick={() => {
                  if (isSuperAdmin) setActiveTab('super-admin');
                }}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
                  isSuperAdmin
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 cursor-pointer hover:bg-amber-500/20'
                    : 'bg-slate-800/90 border-slate-700 text-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="font-semibold max-w-[130px] truncate">
                  {currentUser.fullName?.split(' ')[0] || currentUser.username}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-black/30">
                  {isSuperAdmin ? 'SUPER ADMIN' : 'CLIENT'}
                </span>
              </div>
            )}

            <button
              onClick={onOpenSettings}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-all cursor-pointer"
              title="ตั้งค่าระบบ"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Logout Button */}
            {currentUser && (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-rose-300 hover:text-white bg-rose-950/50 hover:bg-rose-900/70 rounded-lg border border-rose-800/60 transition-all cursor-pointer text-xs font-semibold"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">ออกจากระบบ</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between py-2 gap-2">
          <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {/* Super Admin Dedicated Management Tab */}
            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('super-admin')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'super-admin'
                    ? 'bg-gradient-to-r from-amber-500/25 to-orange-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-amber-400/80 hover:text-amber-300 bg-amber-950/20 border border-amber-500/20'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>👑 จัดการลูกค้า & เพิ่มผู้ใช้ (Super Admin)</span>
              </button>
            )}

            {/* 1. Realtime IoT Tab */}
            <button
              onClick={() => setActiveTab('realtime')}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'realtime'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
              <span>⚡ สดเรียลไทม์ (IoT)</span>
            </button>

            {/* 2. Historical Analytics Tab */}
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>📈 วิเคราะห์ & กราฟย้อนหลัง</span>
            </button>

            {/* 3. Electricity Meters Tab */}
            <button
              onClick={() => setActiveTab('electricity')}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'electricity'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>มิเตอร์ไฟฟ้า</span>
            </button>

            {/* 4. Water Meters Tab */}
            <button
              onClick={() => setActiveTab('water')}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'water'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Droplet className="w-4 h-4 text-blue-400 shrink-0" />
              <span>มิเตอร์น้ำ</span>
            </button>

            {/* 5. Solar Tab */}
            <button
              onClick={() => setActiveTab('solar')}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'solar'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sun className="w-4 h-4 text-yellow-400 shrink-0" />
              <span>โซลาร์</span>
            </button>

            {/* 6. Monthly Sheet */}
            <button
              onClick={() => setActiveTab('monthly-sheet')}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'monthly-sheet'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>ตารางรวม 1-31 วัน</span>
            </button>
          </nav>

          {/* Timeframe Selector (Hidden when on Super Admin tab or Monthly Sheet) */}
          {activeTab !== 'super-admin' && activeTab !== 'monthly-sheet' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-800/90 p-1 rounded-lg border border-slate-700/60">
                <button
                  onClick={() => setTimeframe('daily')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    timeframe === 'daily'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  รายวัน
                </button>
                <button
                  onClick={() => setTimeframe('monthly')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    timeframe === 'monthly'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  รายเดือน
                </button>
                <button
                  onClick={() => setTimeframe('yearly')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    timeframe === 'yearly'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  รายปี
                </button>
              </div>

              {timeframe === 'daily' && (
                <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={currentDate}
                    onChange={(e) => setCurrentDate(e.target.value)}
                    className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="2026-09-01" className="bg-slate-800">1 ก.ย. 2569</option>
                    <option value="2026-09-02" className="bg-slate-800">2 ก.ย. 2569</option>
                    <option value="2026-09-03" className="bg-slate-800">3 ก.ย. 2569 (วันนี้)</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
