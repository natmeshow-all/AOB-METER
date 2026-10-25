import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewMetersView } from './components/OverviewMetersView';
import { MeterDetailView } from './components/MeterDetailView';
import { ProductionReportView } from './components/ProductionReportView';
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
  LogOut
} from 'lucide-react';

export function App() {
  const {
    currentUser,
    isSuperAdmin,
    activeOrganization,
    activeOrgId,
    logout
  } = useAuth();

  // Core 3-menu navigation for customers ('overview' | 'meter-detail' | 'report'), plus 'super-admin' for Super Admin
  const [activeTab, setActiveTab] = useState(() =>
    currentUser?.role === 'SUPER_ADMIN' ? 'super-admin' : 'overview'
  );

  // Selected Meter ID for Menu 2 (Meter Detail View)
  const [selectedMeterId, setSelectedMeterId] = useState(null);

  // Reset default view on login or user switch
  useEffect(() => {
    if (currentUser) {
      if (isSuperAdmin) {
        setActiveTab('super-admin');
      } else {
        setActiveTab('overview');
      }
    }
  }, [currentUser?.id, isSuperAdmin]);

  // Keep selectedMeterId synced with active company's first meter when switching company
  useEffect(() => {
    const comp = TENANT_COMPANIES[activeOrgId] || Object.values(TENANT_COMPANIES)[0];
    const firstMeter = comp?.electricityMeters?.[0];
    if (firstMeter) {
      setSelectedMeterId(firstMeter.id);
    }
  }, [activeOrgId]);

  // Gate: If not logged in, show clean Enterprise Login Portal
  if (!currentUser) {
    return <LoginPortal />;
  }

  const handleInspectMeter = (meterId) => {
    setSelectedMeterId(meterId);
    setActiveTab('meter-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Clean Top App Header */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6 pb-24 sm:pb-10 space-y-4">
        {/* Super Admin Inspection Banner when inspecting a client's dashboard */}
        {isSuperAdmin && activeTab !== 'super-admin' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-200">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                กำลังดูแดชบอร์ดของลูกค้า:{' '}
                <strong className="text-white">{activeOrganization?.name}</strong>
              </span>
            </div>
            <button
              onClick={() => setActiveTab('super-admin')}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>กลับหน้าจัดการลูกค้า (Super Admin)</span>
            </button>
          </div>
        )}

        {/* SUPER ADMIN CONSOLE */}
        {isSuperAdmin && activeTab === 'super-admin' && (
          <SuperAdminConsole
            onInspectClientDashboard={() => setActiveTab('overview')}
          />
        )}

        {/* MENU 1: OVERVIEW OF ALL ELECTRICITY METERS */}
        {activeTab === 'overview' && (
          <OverviewMetersView onSelectMeter={handleInspectMeter} />
        )}

        {/* MENU 2: SPECIFIC METER DEEP-DIVE */}
        {activeTab === 'meter-detail' && (
          <MeterDetailView
            selectedMeterId={selectedMeterId}
            onSelectMeter={(id) => setSelectedMeterId(id)}
            onBackToOverview={() => setActiveTab('overview')}
          />
        )}

        {/* MENU 3: DAILY / MONTHLY / YEARLY REPORT & PRODUCTION PLANNING */}
        {activeTab === 'report' && (
          <ProductionReportView onSelectMeter={handleInspectMeter} />
        )}
      </main>

      {/* Mobile App Sticky Bottom Navigation Bar (1-Thumb Ergonomics) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl">
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('super-admin')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl text-[10px] font-semibold transition-all cursor-pointer ${
              activeTab === 'super-admin'
                ? 'text-amber-400 bg-amber-500/10 font-bold'
                : 'text-slate-400'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span>ลูกค้า</span>
          </button>
        )}

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
