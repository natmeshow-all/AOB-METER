import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewMetersView } from './components/OverviewMetersView';
import { MeterDetailView } from './components/MeterDetailView';
import { ProductionReportView } from './components/ProductionReportView';
import { HomeInverterView } from './components/HomeInverterView';
import { SuperAdminConsole } from './components/SuperAdminConsole';
import { LoginPortal } from './components/LoginPortal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './context/LanguageContext';
import { TENANT_COMPANIES } from './data/tenantData';
import {
  Activity,
  Gauge,
  BarChart3,
  ShieldCheck,
  LogOut,
  Sliders,
  RefreshCw,
  Zap,
  TrendingUp,
  FileText,
  X
} from 'lucide-react';

export function App() {
  const {
    currentUser,
    isSuperAdmin,
    activeOrganization,
    activeOrgId,
    logout
  } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState(() =>
    currentUser?.role === 'SUPER_ADMIN' ? 'super-admin' : 'overview'
  );

  const [selectedMeterId, setSelectedMeterId] = useState(null);
  const [isMobileSyncing, setIsMobileSyncing] = useState(false);
  const [solarSection, setSolarSection] = useState('summary'); // 'summary' | 'curve' | 'billing'
  const [isManageSheetOpen, setIsManageSheetOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          if (currentScrollY < 40) {
            setIsNavVisible(true);
          } else if (currentScrollY > lastScrollY + 8) {
            // Scrolling down (reading content downwards) -> hide bar
            setIsNavVisible(false);
          } else if (currentScrollY < lastScrollY - 8) {
            // Scrolling up (returning upward) -> show bar
            setIsNavVisible(true);
          }
          setLastScrollY(currentScrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

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
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col font-sans selection:bg-sky-500/25 selection:text-white">
      {/* Top App Header */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-3 sm:py-5 pb-24 sm:pb-10 space-y-4">
        {/* SUPER ADMIN ALL-IN-ONE CONSOLE */}
        {isSuperAdmin && activeTab === 'super-admin' && (
          <SuperAdminConsole onInspectTenant={() => setActiveTab('overview')} />
        )}

        {/* CUSTOMER DASHBOARD: AUTOMATICALLY RENDERS BY USER TYPE (HOME_SOLAR vs INDUSTRIAL) */}
        {activeTab !== 'super-admin' && isHomeSolarSite && (
          <ErrorBoundary>
            <HomeInverterView
              activeSection={solarSection}
              onSectionChange={setSolarSection}
            />
          </ErrorBoundary>
        )}

        {activeTab !== 'super-admin' && !isHomeSolarSite && (
          <ErrorBoundary>
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
          </ErrorBoundary>
        )}
      </main>

      {/* Mobile Action Bottom Sheet for Managing Solar & Inverter */}
      {isManageSheetOpen && (
        <div className="fixed inset-0 z-50 sm:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setIsManageSheetOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
          />

          {/* Sheet Panel */}
          <div className="relative bg-gradient-to-b from-[#131b2e] to-[#0c1220] border-t border-slate-700/60 rounded-t-[32px] p-5 pb-8 shadow-[0_-16px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl space-y-4 max-w-lg mx-auto w-full animate-in slide-in-from-bottom duration-200">
            {/* Drag indicator handle */}
            <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto -mt-1 mb-2" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-sky-400" /> {t('manageTitle')}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t('manageSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsManageSheetOpen(false)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Items List */}
            <div className="space-y-2">
              {/* Sync Button */}
              <button
                type="button"
                onClick={() => {
                  handleTriggerMobileSync();
                  setIsManageSheetOpen(false);
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-sky-950/40 hover:bg-sky-900/50 border border-sky-800/40 text-left transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <RefreshCw className={`w-5 h-5 ${isMobileSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">
                      {isMobileSyncing ? t('syncingCloud') : t('syncCloudNow')}
                    </div>
                    <div className="text-[11px] text-sky-300/80">{t('syncDesc')}</div>
                  </div>
                </div>
                <span className="text-xs font-mono text-sky-400 font-bold">{t('syncAction')}</span>
              </button>

              {/* Settings Button */}
              <button
                type="button"
                onClick={() => {
                  handleOpenMobileSettings();
                  setIsManageSheetOpen(false);
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-left transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{t('systemPanelSpecs')}</div>
                    <div className="text-[11px] text-slate-400">{t('systemPanelDesc')}</div>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-400 font-bold">{t('openAction')}</span>
              </button>

              {/* PEA Replica Modal Trigger */}
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('OPEN_PEA_MODAL'));
                  setIsManageSheetOpen(false);
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-purple-950/30 hover:bg-purple-900/40 border border-purple-800/40 text-left transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{t('peaBillOfficial')}</div>
                    <div className="text-[11px] text-purple-300/80">{t('peaBillDesc')}</div>
                  </div>
                </div>
                <span className="text-xs font-mono text-purple-300 font-bold">{t('openBillAction')}</span>
              </button>

              {/* Super Admin Console Jump (if Super Admin) */}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(activeTab === 'super-admin' ? 'overview' : 'super-admin');
                    setIsManageSheetOpen(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-amber-950/30 hover:bg-amber-900/40 border border-amber-800/40 text-left transition-all cursor-pointer active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        {activeTab === 'super-admin' ? t('adminReturnSolar') : t('adminConsole')}
                      </div>
                      <div className="text-[11px] text-amber-300/80">{t('adminConsoleDesc')}</div>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-amber-300 font-bold">
                    {activeTab === 'super-admin' ? t('navOverview') : t('navAdmin')}
                  </span>
                </button>
              )}

              {/* Logout Button */}
              <button
                type="button"
                onClick={() => {
                  setIsManageSheetOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/40 text-left transition-all cursor-pointer active:scale-98 mt-2"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-rose-200">{t('logoutAction')}</div>
                    <div className="text-[11px] text-rose-300/70">{t('logoutDesc')}</div>
                  </div>
                </div>
                <span className="text-xs font-mono text-rose-400 font-bold">{t('exitAction')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile App Native Sticky Bottom Navigation Bar (Single Unified Command Hub) */}
      <nav
        role="navigation"
        aria-label="Mobile Navigation"
        className={`sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070b14]/95 backdrop-blur-2xl border-t border-slate-800/80 px-2 py-1.5 shadow-[0_-10px_35px_rgba(0,0,0,0.85)] pb-[calc(env(safe-area-inset-bottom,0px)+8px)] transition-transform duration-300 ease-in-out ${
          isNavVisible ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        }`}
      >
        {isHomeSolarSite ? (
          /* HOME SOLAR 4-BUTTON NATIVE MOBILE BOTTOM BAR */
          <div className="grid grid-cols-4 items-center gap-1 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'super-admin') setActiveTab('overview');
                setSolarSection('summary');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl text-[10px] font-semibold transition-all cursor-pointer ${
                activeTab !== 'super-admin' && solarSection === 'summary'
                  ? 'text-sky-300 bg-sky-500/20 font-bold border border-sky-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
            >
              <Zap className="w-5 h-5 shrink-0" />
              <span className="truncate">{t('navOverview')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeTab === 'super-admin') setActiveTab('overview');
                setSolarSection('curve');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl text-[10px] font-semibold transition-all cursor-pointer ${
                activeTab !== 'super-admin' && solarSection === 'curve'
                  ? 'text-sky-300 bg-sky-500/20 font-bold border border-sky-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
            >
              <TrendingUp className="w-5 h-5 shrink-0" />
              <span className="truncate">{t('navCurve')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeTab === 'super-admin') setActiveTab('overview');
                setSolarSection('billing');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl text-[10px] font-semibold transition-all cursor-pointer ${
                activeTab !== 'super-admin' && solarSection === 'billing'
                  ? 'text-purple-300 bg-purple-500/20 font-bold border border-purple-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
            >
              <FileText className="w-5 h-5 shrink-0" />
              <span className="truncate">{t('navBilling')}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsManageSheetOpen(true)}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl text-[10px] font-semibold transition-all cursor-pointer ${
                isManageSheetOpen
                  ? 'text-amber-300 bg-amber-500/20 font-bold border border-amber-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
            >
              <Sliders className="w-5 h-5 shrink-0" />
              <span className="truncate">{t('navManage')}</span>
            </button>
          </div>
        ) : (
          /* INDUSTRIAL 3-MENU MULTI-METER MOBILE BOTTOM BAR */
          <div
            className={`grid ${
              isSuperAdmin ? 'grid-cols-5' : 'grid-cols-4'
            } items-center gap-1 max-w-md mx-auto`}
          >
            {isSuperAdmin && (
              <button
                type="button"
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
                <span className="truncate">{t('navAdmin')}</span>
              </button>
            )}

            <button
              type="button"
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
              <span className="truncate">{t('navIndustrialOverview')}</span>
            </button>

            <button
              type="button"
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
              <span className="truncate">{t('navIndustrialDetail')}</span>
            </button>

            <button
              type="button"
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
              <span className="truncate">{t('navIndustrialReport')}</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl text-[10px] font-semibold text-rose-400 hover:text-rose-300 active:bg-rose-500/15 active:scale-95 transition-all cursor-pointer"
              title={t('logout')}
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span className="truncate">{t('logout')}</span>
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}

export default App;
