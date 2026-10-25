import React, { useState, useMemo, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { KPICards } from './components/KPICards';
import { WaterMeterView } from './components/WaterMeterView';
import { ElectricityMeterView } from './components/ElectricityMeterView';
import { SolarView } from './components/SolarView';
import { MonthlySummaryTable } from './components/MonthlySummaryTable';
import { RealtimePowerView } from './components/RealtimePowerView';
import { HistoricalAnalyticsView } from './components/HistoricalAnalyticsView';
import { SuperAdminConsole } from './components/SuperAdminConsole';
import { LoginPortal } from './components/LoginPortal';
import { MeterScannerModal } from './components/MeterScannerModal';
import { LineBotSimulator } from './components/LineBotSimulator';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { useAuth } from './context/AuthContext';
import {
  generateMonthlyData,
  calculateMonthlyTotals,
  WATER_METERS,
  ELECTRICITY_METERS,
  COMPANY_INFO
} from './data/mockData';
import { Camera, ShieldCheck, ArrowLeft } from 'lucide-react';

export function App() {
  const {
    currentUser,
    isSuperAdmin,
    isAuthModalOpen,
    setIsAuthModalOpen,
    activeOrganization,
    logout
  } = useAuth();

  // Default tab: 'super-admin' for Super Admin, 'realtime' for Customer
  const [activeTab, setActiveTab] = useState(() =>
    currentUser?.role === 'SUPER_ADMIN' ? 'super-admin' : 'realtime'
  );
  const [timeframe, setTimeframe] = useState('daily');
  const [currentDate, setCurrentDate] = useState('2026-09-01');

  // Automatically direct Super Admin to 'super-admin' console on login, and Clients to 'realtime'
  useEffect(() => {
    if (currentUser) {
      if (isSuperAdmin) {
        setActiveTab('super-admin');
      } else {
        setActiveTab('realtime');
      }
    }
  }, [currentUser?.id, isSuperAdmin]);

  // Modals
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLineSimulatorOpen, setIsLineSimulatorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 31-day generated logs
  const [monthlyDays, setMonthlyDays] = useState(() => generateMonthlyData());

  // Calculate monthly totals for every meter point
  const monthlyTotals = useMemo(() => {
    return calculateMonthlyTotals(monthlyDays);
  }, [monthlyDays]);

  // Current day data
  const currentDayData = useMemo(() => {
    const dayNum = parseInt(currentDate.split('-')[2], 10);
    return monthlyDays.find((d) => d.day === dayNum) || monthlyDays[0];
  }, [currentDate, monthlyDays]);

  // Daily totals calculation
  const waterSummary = useMemo(() => {
    let sum = 0;
    WATER_METERS.forEach((m) => {
      sum +=
        currentDayData.water[m.id]?.consumption || m.readingSep01 - m.baselineAug31;
    });
    return {
      totalDayUsage: Number(sum.toFixed(1))
    };
  }, [currentDayData]);

  const elecSummary = useMemo(() => {
    let sum = 0;
    ELECTRICITY_METERS.forEach((m) => {
      sum +=
        currentDayData.electricity[m.id]?.consumption ||
        m.readingSep01 - m.baselineAug31;
    });
    return {
      totalDayUsage: sum
    };
  }, [currentDayData]);

  // Total sums for the monthly totals
  const totalWaterMonthly = useMemo(() => {
    let sum = 0;
    Object.values(monthlyTotals.water).forEach((w) => (sum += w.totalConsumption));
    return Number(sum.toFixed(1));
  }, [monthlyTotals]);

  const totalElecMonthly = useMemo(() => {
    let sum = 0;
    Object.values(monthlyTotals.electricity).forEach(
      (e) => (sum += e.totalConsumption)
    );
    return sum;
  }, [monthlyTotals]);

  // If not logged in, display the clean Enterprise Login Portal first!
  if (!currentUser) {
    return <LoginPortal />;
  }

  const handleSaveReadings = (readings, targetDay) => {
    setMonthlyDays((prevDays) => {
      return prevDays.map((dayRow) => {
        if (dayRow.day !== targetDay) return dayRow;

        const updatedWater = { ...dayRow.water };
        const updatedElec = { ...dayRow.electricity };

        readings.forEach((item) => {
          if (item.isIgnored) return;

          const numVal = parseFloat(item.rawReading || 0);

          if (item.meterType === 'WATER' || item.meterId?.startsWith('WATER')) {
            const meterId = item.meterId || 'WATER-MAIN';
            const prevVal =
              dayRow.day === 1
                ? WATER_METERS.find((m) => m.id === meterId)?.baselineAug31 || numVal
                : prevDays.find((d) => d.day === dayRow.day - 1)?.water[meterId]
                    ?.current || numVal;

            const consumption = Number((numVal - prevVal).toFixed(1));
            updatedWater[meterId] = {
              current: numVal,
              consumption: consumption >= 0 ? consumption : 0
            };
          }

          if (item.meterType === 'ELECTRICITY' || item.tag) {
            const elecMeter = ELECTRICITY_METERS.find(
              (m) => m.id === item.meterId || m.tag === item.tag
            );
            if (elecMeter) {
              const prevVal =
                dayRow.day === 1
                  ? elecMeter.baselineAug31
                  : prevDays.find((d) => d.day === dayRow.day - 1)?.electricity[
                      elecMeter.id
                    ]?.current || numVal;

              const consumption = Math.round(numVal - prevVal);
              updatedElec[elecMeter.id] = {
                current: Math.round(numVal),
                consumption: consumption >= 0 ? consumption : 0
              };
            }
          }
        });

        return {
          ...dayRow,
          water: updatedWater,
          electricity: updatedElec
        };
      });
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenLineSimulator={() => setIsLineSimulatorOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 sm:pb-8 space-y-6">
        {/* Super Admin Inspection Banner when viewing a Client Dashboard */}
        {isSuperAdmin && activeTab !== 'super-admin' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-200">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                คุณกำลังตรวจสอบแดชบอร์ดของลูกค้า:{' '}
                <strong className="text-white">{activeOrganization?.name}</strong>
              </span>
            </div>
            <button
              onClick={() => setActiveTab('super-admin')}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>กลับหน้าจัดการลูกค้าทั้งหมด (Super Admin)</span>
            </button>
          </div>
        )}

        {/* TAB 0: SUPER ADMIN COMMAND CENTER */}
        {isSuperAdmin && activeTab === 'super-admin' && (
          <SuperAdminConsole
            onInspectClientDashboard={() => setActiveTab('realtime')}
          />
        )}

        {/* KPI Cards (Visible on standard operational tabs, hidden on Super Admin & Monthly Sheet) */}
        {activeTab !== 'super-admin' && activeTab !== 'monthly-sheet' && (
          <KPICards
            timeframe={timeframe}
            waterSummary={waterSummary}
            elecSummary={elecSummary}
            solarSummary={currentDayData.solar}
            monthlyTotals={{
              ...monthlyTotals,
              waterTotal: totalWaterMonthly,
              elecTotal: totalElecMonthly
            }}
          />
        )}

        {/* Tab: Realtime Power & IoT Telemetry */}
        {activeTab === 'realtime' && <RealtimePowerView />}

        {/* Tab: Historical Analytics & Graphs (Hourly, Daily, Monthly, Yearly) */}
        {activeTab === 'analytics' && <HistoricalAnalyticsView />}

        {/* Tab: Water Meters */}
        {activeTab === 'water' && (
          <div className="space-y-6">
            <WaterMeterView currentDayData={currentDayData} timeframe={timeframe} />
            <AnalyticsCharts timeframe={timeframe} monthlyDays={monthlyDays} />
          </div>
        )}

        {/* Tab: Electricity Meters */}
        {activeTab === 'electricity' && (
          <div className="space-y-6">
            <ElectricityMeterView
              currentDayData={currentDayData}
              timeframe={timeframe}
            />
            <AnalyticsCharts timeframe={timeframe} monthlyDays={monthlyDays} />
          </div>
        )}

        {/* Tab: Solar Rooftop */}
        {activeTab === 'solar' && (
          <div className="space-y-6">
            <SolarView currentDayData={currentDayData} />
            <AnalyticsCharts timeframe={timeframe} monthlyDays={monthlyDays} />
          </div>
        )}

        {/* Tab: Full Monthly 1-31 Sheet */}
        {activeTab === 'monthly-sheet' && (
          <MonthlySummaryTable
            monthlyDays={monthlyDays}
            monthlyTotals={{
              ...monthlyTotals,
              waterTotal: totalWaterMonthly,
              elecTotal: totalElecMonthly
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800/80 py-4 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © 2026 {activeOrganization?.name || COMPANY_INFO.name} — PowerView Industrial IoT Energy Platform
          </span>
          <div className="flex items-center gap-4 text-slate-500">
            <span>RS485 Modbus Cloud</span>
            <span>•</span>
            <span>Multi-Tenant RLS</span>
            <span>•</span>
            <span>AI Meter Vision</span>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky Bottom Navigation Bar (1-Thumb Ergonomics) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl">
        {isSuperAdmin ? (
          <button
            onClick={() => setActiveTab('super-admin')}
            className={`flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium transition-all ${
              activeTab === 'super-admin' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <span className="text-base">👑</span>
            <span>จัดการลูกค้า</span>
          </button>
        ) : (
          <button
            onClick={() => setActiveTab('monthly-sheet')}
            className={`flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium transition-all ${
              activeTab === 'monthly-sheet' ? 'text-cyan-400 font-bold' : 'text-slate-400'
            }`}
          >
            <span className="text-base">📋</span>
            <span>ตารางชีต</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('realtime')}
          className={`flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium transition-all ${
            activeTab === 'realtime' ? 'text-emerald-400 font-bold' : 'text-slate-400'
          }`}
        >
          <span className="text-base">⚡</span>
          <span>สด IoT</span>
        </button>

        {/* Center Scanner Button */}
        <button
          onClick={() => setIsScannerOpen(true)}
          className="flex flex-col items-center gap-0.5 -mt-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 rounded-full shadow-lg shadow-indigo-500/40 border-2 border-slate-950 active:scale-95 transition-transform cursor-pointer"
          aria-label="ถ่ายรูปสแกนมิเตอร์"
        >
          <Camera className="w-5 h-5 text-yellow-300" />
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium transition-all ${
            activeTab === 'analytics' ? 'text-indigo-400 font-bold' : 'text-slate-400'
          }`}
        >
          <span className="text-base">📈</span>
          <span>กราฟ</span>
        </button>

        <button
          onClick={logout}
          className="flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium text-rose-400 hover:text-rose-300 transition-all cursor-pointer"
          title="ออกจากระบบ"
        >
          <span className="text-base">🚪</span>
          <span>ออกจากระบบ</span>
        </button>
      </div>

      {/* Modals */}
      <MeterScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSaveReadings={handleSaveReadings}
      />

      <LineBotSimulator
        isOpen={isLineSimulatorOpen}
        onClose={() => setIsLineSimulatorOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default App;
