import React, { useState, useEffect } from 'react';
import {
  Zap,
  Activity,
  Gauge,
  BarChart3,
  LogOut,
  ShieldCheck,
  Sun,
  Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

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

  const { lang, setLang, t } = useLanguage();

  // Live Bangkok / Telemetry Clock (UTC+7)
  const [liveTime, setLiveTime] = useState(() => {
    const d = new Date(Date.now() + 7 * 3600 * 1000);
    return d.toISOString().substring(11, 19);
  });
  const [colonBlink, setColonBlink] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date(Date.now() + 7 * 3600 * 1000);
      setLiveTime(d.toISOString().substring(11, 19));
      setColonBlink((prev) => !prev);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isHomeSolarSite = activeOrganization?.siteType === 'HOME_SOLAR';

  return (
    <header className="bg-gradient-to-b from-[#0e1628]/95 via-[#09101e]/90 to-[#070b16]/95 backdrop-blur-2xl border-b border-slate-800/60 sticky top-0 z-40 transition-colors">
      <div className="max-w-6xl mx-auto px-3 sm:px-6">
        {/* Top Command Bar: Station Identity, Live Telemetry, Flag Switcher & Actions */}
        <div className="flex items-center justify-between py-2.5 sm:py-3 gap-2">
          {/* Left: Station Identity & Live Telemetry Icon */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ring-1 ring-white/10 ${
                isSuperAdmin && activeTab === 'super-admin'
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20'
                  : isHomeSolarSite
                  ? 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 shadow-emerald-500/20'
                  : 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/20'
              }`}
            >
              {isSuperAdmin && activeTab === 'super-admin' ? (
                <ShieldCheck className="w-5 h-5 text-white" />
              ) : isHomeSolarSite ? (
                <Sun className="w-5 h-5 text-white animate-spin-slow" />
              ) : (
                <Zap className="w-5 h-5 text-yellow-300" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xs sm:text-base font-bold text-white truncate tracking-tight">
                  {isSuperAdmin && activeTab === 'super-admin'
                    ? t('superAdminPortal')
                    : activeOrganization?.name || t('noTenantSelected')}
                </h1>

                {/* Live Radar Ping Status Beacon */}
                <span className="hidden xs:inline-flex items-center gap-1 px-2 py-0.5 text-[9px] sm:text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full shrink-0">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span>{t('online')}</span>
                </span>
              </div>

              {/* Super Admin Switcher or Mission Subtitle */}
              {isSuperAdmin ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] sm:text-[11px] text-amber-400 font-semibold truncate">
                    {t('activeUser')}
                  </span>
                  {allOrganizations.length === 0 ? (
                    <span className="text-[10px] text-slate-400">ยังไม่มีรายการ</span>
                  ) : (
                    <select
                      value={activeOrgId}
                      onChange={(e) => {
                        switchOrganization(e.target.value);
                        if (activeTab === 'super-admin') {
                          setActiveTab('overview');
                        }
                      }}
                      className="bg-slate-900 border border-amber-500/40 rounded-lg px-2 py-0.5 text-[10px] sm:text-[11px] text-amber-300 font-bold font-mono outline-none cursor-pointer hover:border-amber-400 transition-colors"
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
                <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                  {isHomeSolarSite
                    ? t('homeSolarDesc')
                    : t('industrialDesc', { kva: activeOrganization?.transformerKVA || 1600 })}
                </p>
              )}
            </div>
          </div>

          {/* Right: Dual-Flag Capsule Language Selector & Live Telemetry Clock */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Live UTC+7 Digital Telemetry Clock (Desktop & Tablet) */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] font-mono font-semibold text-slate-300">
              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
              <span>
                {liveTime.substring(0, 2)}
                <span className={colonBlink ? 'opacity-100' : 'opacity-30'}>:</span>
                {liveTime.substring(3, 5)}
                <span className={colonBlink ? 'opacity-100' : 'opacity-30'}>:</span>
                {liveTime.substring(6, 8)}
              </span>
              <span className="text-[9px] text-cyan-400 font-bold ml-0.5">BKK</span>
            </div>

            {/* INTERACTIVE DUAL-FLAG SLIDING CAPSULE SWITCHER (ไทย 🇹🇭 / อังกฤษ 🇬🇧) */}
            <div
              className="relative flex items-center bg-[#070d1a] p-0.5 rounded-full border border-slate-700/60 shadow-inner"
              role="radiogroup"
              aria-label="Language selector"
            >
              {/* Sliding Subtle Highlight Pill */}
              <div
                className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-slate-700/90 to-slate-800/90 border border-slate-600/60 shadow-sm ${
                  lang === 'th' ? 'left-0.5' : 'left-[calc(50%+1px)]'
                }`}
              />

              {/* Thai Flag Button */}
              <button
                type="button"
                onClick={() => setLang('th')}
                className={`relative z-10 px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  lang === 'th'
                    ? 'text-white font-extrabold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="เปลี่ยนภาษาเป็นไทย (Thai)"
                aria-checked={lang === 'th'}
                role="radio"
              >
                <span className="text-sm leading-none drop-shadow-sm">🇹🇭</span>
                <span className="text-[10px] font-mono tracking-wider">TH</span>
              </button>

              {/* English Flag Button */}
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`relative z-10 px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  lang === 'en'
                    ? 'text-white font-extrabold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Switch to English"
                aria-checked={lang === 'en'}
                role="radio"
              >
                <span className="text-sm leading-none drop-shadow-sm">🇬🇧</span>
                <span className="text-[10px] font-mono tracking-wider">EN</span>
              </button>
            </div>

            {/* Desktop-Only Super Admin Toggle & Logout */}
            {currentUser && (
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                {isSuperAdmin && (
                  <button
                    onClick={() =>
                      setActiveTab(activeTab === 'super-admin' ? 'overview' : 'super-admin')
                    }
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'super-admin'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {activeTab === 'super-admin'
                        ? t('viewDashboard')
                        : t('systemSettingsAdmin')}
                    </span>
                  </button>
                )}
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 rounded-xl border border-rose-800/60 transition-all cursor-pointer text-xs font-bold shrink-0"
                  title={t('logout')}
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>{t('logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Bar: Shown on desktop for Industrial 3-Menu sites */}
        {!isHomeSolarSite && activeTab !== 'super-admin' && (
          <nav className="hidden sm:grid sm:grid-cols-3 lg:flex items-center gap-2 pb-3 pt-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>1. {t('navIndustrialOverview')}</span>
            </button>

            <button
              onClick={() => setActiveTab('meter-detail')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'meter-detail'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Gauge className="w-4 h-4" />
              <span>2. {t('navIndustrialDetail')}</span>
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'report'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>3. {t('navIndustrialReport')}</span>
            </button>
          </nav>
        )}
      </div>

      {/* Subtle Ambient Depth Line under Navbar */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-slate-700/50 via-sky-500/20 to-transparent" />
    </header>
  );
};
