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
  Sun
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

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top App Header */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-5 pb-24 sm:pb-10 space-y-4">
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

      {/* Mobile App Sticky Bottom Navigation Bar (Adapts cleanly by User Type) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl">
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('super-admin')}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-semibold transition-all cursor-pointer ${
              activeTab === 'super-admin'
                ? 'text-amber-400 bg-amber-500/10 font-bold'
                : 'text-slate-400'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span>ตั้งค่าระบบ</span>
          </button>
        )}

        {isHomeSolarSite ? (
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[10px] font-semibold transition-all cursor-pointer ${
              activeTab !== 'super-admin'
                ? 'text-emerald-400 bg-emerald-500/10 font-bold'
                : 'text-slate-400'
            }`}
          >
            <Sun className="w-5 h-5" />
            <span>อินเวอร์เตอร์บ้าน</span>
          </button>
        ) : (
          <>
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-semibold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'text-blue-400 bg-blue-500/10 font-bold'
                  : 'text-slate-400'
              }`}
            >
              <Activity className="w-5 h-5" />
              <span>1. ภาพรวมมิเตอร์</span>
            </button>

            <button
              onClick={() => setActiveTab('meter-detail')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-semibold transition-all cursor-pointer ${
                activeTab === 'meter-detail'
                  ? 'text-blue-400 bg-blue-500/10 font-bold'
                  : 'text-slate-400'
              }`}
            >
              <Gauge className="w-5 h-5" />
              <span>2. รายมิเตอร์</span>
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-semibold transition-all cursor-pointer ${
                activeTab === 'report'
                  ? 'text-blue-400 bg-blue-500/10 font-bold'
                  : 'text-slate-400'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span>3. รายงาน</span>
            </button>
          </>
        )}

        <button
          onClick={logout}
          className="flex flex-col items-center gap-1 py-1 px-2 rounded-xl text-[10px] font-semibold text-rose-400 cursor-pointer"
          title="ออกจากระบบ"
        >
          <LogOut className="w-5 h-5" />
          <span>ออก</span>
        </button>
      </div>
    </div>
  );
}

export default App;
