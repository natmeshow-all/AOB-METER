import React from 'react';
import {
  Zap,
  CheckCircle2,
  Activity,
  Gauge,
  BarChart3,
  LogOut,
  ShieldCheck,
  Sun
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar = ({ activeTab, setActiveTab }) => {
  const {
    currentUser,
    activeOrganization,
    activeOrgId,
    allOrganizations,
    isSuperAdmin,
    switchOrganization,
    logout
  } = useAuth();

  const isHomeSolarSite = activeOrganization?.siteType === 'HOME_SOLAR';

  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Top Row: Identity & Logout */}
        <div className="flex items-center justify-between py-3 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${
                isSuperAdmin && activeTab === 'super-admin'
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                  : isHomeSolarSite
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                  : 'bg-gradient-to-br from-blue-600 to-indigo-600'
              }`}
            >
              {isSuperAdmin && activeTab === 'super-admin' ? (
                <ShieldCheck className="w-5 h-5 text-white" />
              ) : isHomeSolarSite ? (
                <Sun className="w-5 h-5 text-white" />
              ) : (
                <Zap className="w-5 h-5 text-yellow-300" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white truncate">
                  {isSuperAdmin && activeTab === 'super-admin'
                    ? 'ศูนย์ตั้งค่าระบบและจัดการผู้ใช้งาน (Super Admin)'
                    : activeOrganization?.name || 'ยังไม่ได้เลือกผู้ใช้งาน'}
                </h1>

                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> Online
                </span>
              </div>

              {/* Super Admin Switcher */}
              {isSuperAdmin ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-amber-400 font-semibold">
                    ผู้ใช้งานที่เลือกดู:
                  </span>
                  {allOrganizations.length === 0 ? (
                    <span className="text-[11px] text-slate-400">ยังไม่มีรายการ</span>
                  ) : (
                    <select
                      value={activeOrgId}
                      onChange={(e) => {
                        switchOrganization(e.target.value);
                        if (activeTab === 'super-admin') {
                          setActiveTab('overview');
                        }
                      }}
                      className="bg-slate-800 border border-amber-500/40 rounded-lg px-2 py-0.5 text-[11px] text-amber-300 font-bold font-mono outline-none cursor-pointer"
                    >
                      {allOrganizations.map((org) => (
                        <option key={org.id} value={org.id} className="bg-slate-900 text-white">
                          {org.siteType === 'HOME_SOLAR' ? '🏠 ' : '🏢 '}
                          {org.shortName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 truncate">
                  {isHomeSolarSite
                    ? 'ระบบติดตามพลังงานโซลาร์ไฮบริดและแบตเตอรี่ประจำบ้าน'
                    : `พิกัดหม้อแปลง ${activeOrganization?.transformerKVA || 1600} kVA • ระบบติดตามการใช้ไฟฟ้าอัจฉริยะ`}
                </p>
              )}
            </div>
          </div>

          {/* Right: Super Admin Toggle (if Super Admin) & Logout Button */}
          {currentUser && (
            <div className="flex items-center gap-2 shrink-0">
              {isSuperAdmin && (
                <button
                  onClick={() =>
                    setActiveTab(activeTab === 'super-admin' ? 'overview' : 'super-admin')
                  }
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'super-admin'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {activeTab === 'super-admin' ? 'ดูหน้าแดชบอร์ด' : 'ตั้งค่าระบบ (Admin)'}
                  </span>
                </button>
              )}
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-2 text-rose-300 hover:text-white bg-rose-950/50 hover:bg-rose-900/70 rounded-xl border border-rose-800/60 transition-all cursor-pointer text-xs font-bold shrink-0"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">ออกจากระบบ</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Bar: Only shown for 3-Menu Industrial Sites (Home Solar is a clean single-screen cockpit) */}
        {!isHomeSolarSite && activeTab !== 'super-admin' && (
          <nav className="hidden sm:grid sm:grid-cols-3 lg:flex items-center gap-2 pb-3 pt-1">
            {/* Menu 1: Overview of All Company Meters */}
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>1. ภาพรวมมิเตอร์ทั้งหมด</span>
            </button>

            {/* Menu 2: Specific Meter Deep-Dive */}
            <button
              onClick={() => setActiveTab('meter-detail')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'meter-detail'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Gauge className="w-4 h-4" />
              <span>2. เจาะลึกรายมิเตอร์</span>
            </button>

            {/* Menu 3: Daily / Monthly / Yearly Report & Production Planning */}
            <button
              onClick={() => setActiveTab('report')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'report'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>3. รายงาน & ปรับแผนการผลิต</span>
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};
