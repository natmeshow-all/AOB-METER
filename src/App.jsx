import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewMetersView } from './components/OverviewMetersView';
import { MeterDetailView } from './components/MeterDetailView';
import { ProductionReportView } from './components/ProductionReportView';
import { HomeInverterView } from './components/HomeInverterView';
import { SuperAdminConsole } from './components/SuperAdminConsole';
import { LoginPortal } from './components/LoginPortal';
import { useAuth } from './context/AuthContext';
import { TENANT_COMPANIES } from './data/tenantData';
import {
  Activity,
  Gauge,
  BarChart3,
  ShieldCheck,
  ArrowLeft,
  LogOut,
  Sun,
  Sliders,
  RefreshCw
} from 'lucide-react';

export function App() {
  const {
    currentUser,
    isSuperAdmin,
    activeOrganization,
    activeOrgId,
    logout
  } = useAuth();

  const [activeTab, setActiveTab] = useState(() =>
    currentUser?.role === 'SUPER_ADMIN' ? 'super-admin' : 'overview'
  );

  const [selectedMeterId, setSelectedMeterId] = useState(null);
  const [isMobileSyncing, setIsMobileSyncing] = useState(false);

  useEffect(() => {
    const handleSyncStatus = (e) => {
      setIsMobileSyncing(Boolean(e.detail?.isSyncing));
    };
    window.addEventListener('SOLAR_SYNC_STATUS', handleSyncStatus);
    return () => window.removeEventListener('SOLAR_SYNC_STATUS', handleSyncStatus);
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (isSuperAdmin) {
        setActiveTab('super-admin');
      } else {
        setActiveTab('overview');
      }
    }
  }, [currentUser?.id, isSuperAdmin]);

  useEffect(() => {
    const comp = TENANT_COMPANIES[activeOrgId] || Object.values(TENANT_COMPANIES)[0];
    const firstMeter = comp?.electricityMeters?.[0];
    if (firstMeter) {
      setSelectedMeterId(firstMeter.id);
    }
  }, [activeOrgId]);

  if (!currentUser) {
    return <LoginPortal />;
  }

  const isHomeSolarSite =
    activeOrganization?.siteType === 'HOME_SOLAR' ||
    currentUser?.siteType === 'HOME_SOLAR' ||
    activeOrganization?.code === 'NAT01' ||
    activeOrganization?.name?.toUpperCase() === 'BANNAT';

  const handleInspectMeter = (meterId) => {
    setSelectedMeterId(meterId);
    setActiveTab('meter-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMobileSettings = () => {
    window.dispatchEvent(new CustomEvent('OPEN_SOLAR_SETTINGS'));
  };

  const handleTriggerMobileSync = () => {
    window.dispatchEvent(new CustomEvent('TRIGGER_SOLAR_SYNC'));
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top App Header */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-3 sm:py-5 pb-24 sm:pb-10 space-y-4">
        {/* SUPER ADMIN ALL-IN-ONE CONSOLE */}
        {isSuperAdmin && activeTab === 'super-admin' && (
          <SuperAdminConsole onInspectTenant={() => setActiveTab('overview')} />
        )}

        {/* CUSTOMER DASHBOARD: AUTOMATICALLY RENDERS BY USER TYPE (HOME_SOLAR vs INDUSTRIAL) */}
        {activeTab !== 'super-admin' && isHomeSolarSite && <HomeInverterView />}

        {activeTab !== 'super-admin' && !isHomeSolarSite && (
          <>
            {activeTab === 'overview' && (
              <OverviewMetersView onSelectMeter={handleInspectMeter} />
            )}
            {activeTab === 'meter-detail' && (
              <MeterDetailView
                selectedMeterId={selectedMeterId}
                onSelectMeter={(id) => setSelectedMeterId(id)}
                onBackToOverview={() => setActiveTab('overview')}
              />
            )}
            {activeTab === 'report' && (
              <ProductionReportView onSelectMeter={handleInspectMeter} />
            )}
          </>
        )}
      </main>

      {/* Mobile App Native Sticky Bottom Navigation Bar (Single Unified Command Hub) */}
      <nav
        role="navigation"
        aria-label="Mobile Navigation"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070b14]/95 backdrop-blur-2xl border-t border-slate-800/80 px-2 py-1.5 shadow-[0_-10px_35px_rgba(0,0,0,0.85)] pb-[calc(env(safe-area-inset-bottom,0px)+8px)]"
      >
        <div
          className={`grid ${
            isSuperAdmin ? 'grid-cols-5' : 'grid-cols-4'
          } items-center gap-1 max-w-md mx-auto`}
        >
          {isSuperAdmin && (
            <button
              onClick={() => {
                setActiveTab('super-admin');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl text-[10px] font-semibold transition-all cursor-pointer ${
                activeTab === 'super-admin'
                  ? 'text-amber-300 bg-amber-500/20 font-bold border border-amber-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
            >
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span className="truncate">แอดมิน</span>
            </button>
          )}

          {isHomeSolarSite ? (
            <>
              <button
                onClick={() => {
                  if (activeTab === 'super-admin') setActiveTab('overview');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl text-[10px] font-semibold transition-all cursor-pointer ${
                  activeTab !== 'super-admin'
                    ? 'text-emerald-300 bg-emerald-500/20 font-bold border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 active:scale-95'
                }`}
              >
                <Sun className="w-5 h-5 shrink-0" />
                <span className="truncate">โซลาร์</span>
              </button>

              <button
                onClick={handleTriggerMobileSync}
                className="flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl text-[10px] font-semibold text-sky-400 hover:text-sky-300 active:scale-95 transition-all cursor-pointer"
              >
                <RefreshCw
                  className={`w-5 h-5 shrink-0 ${
                    isMobileSyncing ? 'animate-spin text-emerald-400' : ''
                  }`}
                />
                <span className="truncate">{isMobileSyncing ? 'ซิงก์...' : 'ซิงก์ข้อมูล'}</span>
              </button>

              <button
                onClick={handleOpenMobileSettings}
                className="flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl text-[10px] font-semibold text-slate-300 hover:text-white active:scale-95 transition-all cursor-pointer"
              >
                <Sliders className="w-5 h-5 shrink-0 text-slate-300" />
                <span className="truncate">ตั้งค่า</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setActiveTab('overview');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl text-[10px] font-semibold transition-all cursor-pointer ${
                  activeTab === 'overview'
                    ? 'text-blue-300 bg-blue-500/20 font-bold border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 active:scale-95'
                }`}
              >
                <Activity className="w-5 h-5 shrink-0" />
                <span className="truncate">ภาพรวม</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('meter-detail');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl text-[10px] font-semibold transition-all cursor-pointer ${
                  activeTab === 'meter-detail'
                    ? 'text-blue-300 bg-blue-500/20 font-bold border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 active:scale-95'
                }`}
              >
                <Gauge className="w-5 h-5 shrink-0" />
                <span className="truncate">เจาะลึก</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('report');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl text-[10px] font-semibold transition-all cursor-pointer ${
                  activeTab === 'report'
                    ? 'text-blue-300 bg-blue-500/20 font-bold border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 active:scale-95'
                }`}
              >
                <BarChart3 className="w-5 h-5 shrink-0" />
                <span className="truncate">รายงาน</span>
              </button>
            </>
          )}

          <button
            onClick={logout}
            className="flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl text-[10px] font-semibold text-rose-400 hover:text-rose-300 active:bg-rose-500/15 active:scale-95 transition-all cursor-pointer"
            title="ออกจากระบบ"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="truncate">ออกจากระบบ</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
