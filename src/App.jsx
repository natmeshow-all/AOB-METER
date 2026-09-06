import React, { useState, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { KPICards } from './components/KPICards';
import { WaterMeterView } from './components/WaterMeterView';
import { ElectricityMeterView } from './components/ElectricityMeterView';
import { SolarView } from './components/SolarView';
import { MonthlySummaryTable } from './components/MonthlySummaryTable';
import { MeterScannerModal } from './components/MeterScannerModal';
import { LineBotSimulator } from './components/LineBotSimulator';
import { SettingsModal } from './components/SettingsModal';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { 
  generateMonthlyData, 
  calculateMonthlyTotals, 
  WATER_METERS, 
  ELECTRICITY_METERS,
  COMPANY_INFO 
} from './data/mockData';

export function App() {
  const [activeTab, setActiveTab] = useState('water'); // 'water' | 'electricity' | 'solar' | 'monthly-sheet'
  const [timeframe, setTimeframe] = useState('daily'); // 'daily' | 'monthly' | 'yearly'
  const [currentDate, setCurrentDate] = useState('2026-09-01');

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
    return monthlyDays.find(d => d.day === dayNum) || monthlyDays[0];
  }, [currentDate, monthlyDays]);

  // Daily totals calculation
  const waterSummary = useMemo(() => {
    let sum = 0;
    WATER_METERS.forEach(m => {
      sum += (currentDayData.water[m.id]?.consumption || (m.readingSep01 - m.baselineAug31));
    });
    return {
      totalDayUsage: Number(sum.toFixed(1)),
    };
  }, [currentDayData]);

  const elecSummary = useMemo(() => {
    let sum = 0;
    ELECTRICITY_METERS.forEach(m => {
      sum += (currentDayData.electricity[m.id]?.consumption || (m.readingSep01 - m.baselineAug31));
    });
    return {
      totalDayUsage: sum,
    };
  }, [currentDayData]);

  // Total sums for the monthly totals
  const totalWaterMonthly = useMemo(() => {
    let sum = 0;
    Object.values(monthlyTotals.water).forEach(w => sum += w.totalConsumption);
    return Number(sum.toFixed(1));
  }, [monthlyTotals]);

  const totalElecMonthly = useMemo(() => {
    let sum = 0;
    Object.values(monthlyTotals.electricity).forEach(e => sum += e.totalConsumption);
    return sum;
  }, [monthlyTotals]);

  const handleSaveReadings = (readings, targetDay) => {
    setMonthlyDays(prevDays => {
      return prevDays.map(dayRow => {
        if (dayRow.day !== targetDay) return dayRow;

        const updatedWater = { ...dayRow.water };
        const updatedElec = { ...dayRow.electricity };

        readings.forEach(item => {
          if (item.isIgnored) return;

          const numVal = parseFloat(item.rawReading || 0);

          // Update Water
          if (item.meterType === 'WATER' || item.meterId?.startsWith('WATER')) {
            const meterId = item.meterId || 'WATER-MAIN';
            const prevVal = dayRow.day === 1 
              ? (WATER_METERS.find(m => m.id === meterId)?.baselineAug31 || numVal)
              : (prevDays.find(d => d.day === dayRow.day - 1)?.water[meterId]?.current || numVal);
            
            const consumption = Number((numVal - prevVal).toFixed(1));
            updatedWater[meterId] = {
              current: numVal,
              consumption: consumption >= 0 ? consumption : 0
            };
          }

          // Update Electricity
          if (item.meterType === 'ELECTRICITY' || item.tag) {
            const elecMeter = ELECTRICITY_METERS.find(m => m.id === item.meterId || m.tag === item.tag);
            if (elecMeter) {
              const kwhVal = item.convertedKWh ? parseFloat(item.convertedKWh) : numVal;
              const prevVal = dayRow.day === 1 
                ? elecMeter.baselineAug31 
                : (prevDays.find(d => d.day === dayRow.day - 1)?.electricity[elecMeter.id]?.current || kwhVal);
              
              const consumption = kwhVal - prevVal;
              updatedElec[elecMeter.id] = {
                current: kwhVal,
                consumption: consumption >= 0 ? consumption : 0
              };
            }
          }
        });

        return {
          ...dayRow,
          water: updatedWater,
          electricity: updatedElec,
          recordedBy: 'AI Verified (Web)',
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Cards (Always visible or in tabs) */}
        {activeTab !== 'monthly-sheet' && (
          <KPICards
            timeframe={timeframe}
            waterSummary={waterSummary}
            elecSummary={elecSummary}
            solarSummary={currentDayData.solar}
            monthlyTotals={{
              ...monthlyTotals,
              waterTotal: totalWaterMonthly,
              elecTotal: totalElecMonthly,
            }}
          />
        )}

        {/* Tab 1: Water Meters (3 Points) */}
        {activeTab === 'water' && (
          <div className="space-y-6">
            <WaterMeterView
              currentDayData={currentDayData}
              timeframe={timeframe}
            />
            <AnalyticsCharts
              timeframe={timeframe}
              monthlyDays={monthlyDays}
            />
          </div>
        )}

        {/* Tab 2: Electricity Meters (14 Points) */}
        {activeTab === 'electricity' && (
          <div className="space-y-6">
            <ElectricityMeterView
              currentDayData={currentDayData}
              timeframe={timeframe}
            />
            <AnalyticsCharts
              timeframe={timeframe}
              monthlyDays={monthlyDays}
            />
          </div>
        )}

        {/* Tab 3: Solar Rooftop */}
        {activeTab === 'solar' && (
          <div className="space-y-6">
            <SolarView
              currentDayData={currentDayData}
            />
            <AnalyticsCharts
              timeframe={timeframe}
              monthlyDays={monthlyDays}
            />
          </div>
        )}

        {/* Tab 4: Full Monthly 1-31 Sheet & Monthly Totals */}
        {activeTab === 'monthly-sheet' && (
          <MonthlySummaryTable
            monthlyDays={monthlyDays}
            monthlyTotals={{
              ...monthlyTotals,
              waterTotal: totalWaterMonthly,
              elecTotal: totalElecMonthly,
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800/80 py-4 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © 2026 {COMPANY_INFO.name} — ระบบบริหารจัดการพลังงานและบันทึกมิเตอร์อัจฉริยะ (AI Meter Vision)
          </span>
          <div className="flex items-center gap-4 text-slate-500">
            <span>เชื่อมต่อ Google Sheets API</span>
            <span>•</span>
            <span>LINE Messaging API</span>
            <span>•</span>
            <span>Gemini Flash Vision</span>
          </div>
        </div>
      </footer>

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
    </div>
  );
}

export default App;
