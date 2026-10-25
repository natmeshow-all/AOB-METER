import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, 
  Activity, 
  Wifi, 
  ShieldCheck, 
  AlertTriangle, 
  Gauge, 
  Sliders, 
  RefreshCw, 
  Cpu, 
  Layers, 
  Server, 
  FileText, 
  CheckCircle2, 
  Download, 
  ChevronRight,
  TrendingUp,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { ELECTRICITY_METERS } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { TENANT_COMPANIES } from '../data/tenantData';

export const RealtimePowerView = () => {
  const { activeOrgId } = useAuth();
  const currentCompany = TENANT_COMPANIES[activeOrgId] || TENANT_COMPANIES['ORG-AOB'];

  const [activeSubTab, setActiveSubTab] = useState('live'); // 'live' | 'diagram' | 'sop' | 'budget'
  const [selectedPanelFilter, setSelectedPanelFilter] = useState('ALL');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);

  // Generate realistic simulated live Modbus telemetry for company's specific meters
  const [telemetryData, setTelemetryData] = useState(() => {
    const meters = currentCompany.electricityMeters;
    return meters.map((m, idx) => {
      const baseKW = Math.abs(m.baseKW) || 45;
      return {
        id: m.id,
        meterNo: idx + 1,
        modbusId: idx + 1,
        port: idx < 8 ? 'Port 1 (RS485-A)' : 'Port 2 (RS485-B)',
        tag: m.tag,
        panel: m.panel,
        location: m.name,
        model: m.model || 'Schneider EasyLogic PM2200',
        voltageL1: 231.2,
        voltageL2: 230.8,
        voltageL3: 231.5,
        voltageLL: 400.2,
        currentL1: Math.round(baseKW * 1.52),
        currentL2: Math.round(baseKW * 1.48),
        currentL3: Math.round(baseKW * 1.50),
        currentAvg: Math.round(baseKW * 1.5),
        activePowerKW: baseKW,
        reactivePowerKVAR: Math.round(baseKW * 0.32),
        apparentPowerKVA: Math.round(baseKW * 1.05),
        powerFactor: 0.95,
        frequency: 50.02,
        energyTotalKWh: (idx + 1) * 85000 + 12000,
        status: 'ONLINE',
        loadPercent: Math.min(92, Math.max(15, Math.round((baseKW / (baseKW * 1.4)) * 100)))
      };
    });
  });

  // Re-generate telemetry if active company switches
  useEffect(() => {
    const meters = currentCompany.electricityMeters;
    setTelemetryData(meters.map((m, idx) => {
      const baseKW = Math.abs(m.baseKW) || 45;
      return {
        id: m.id,
        meterNo: idx + 1,
        modbusId: idx + 1,
        port: idx < 8 ? 'Port 1 (RS485-A)' : 'Port 2 (RS485-B)',
        tag: m.tag,
        panel: m.panel,
        location: m.name,
        model: m.model || 'Schneider EasyLogic PM2200',
        voltageL1: 231.2,
        voltageL2: 230.8,
        voltageL3: 231.5,
        voltageLL: 400.2,
        currentL1: Math.round(baseKW * 1.52),
        currentL2: Math.round(baseKW * 1.48),
        currentL3: Math.round(baseKW * 1.50),
        currentAvg: Math.round(baseKW * 1.5),
        activePowerKW: baseKW,
        reactivePowerKVAR: Math.round(baseKW * 0.32),
        apparentPowerKVA: Math.round(baseKW * 1.05),
        powerFactor: 0.95,
        frequency: 50.02,
        energyTotalKWh: (idx + 1) * 85000 + 12000,
        status: 'ONLINE',
        loadPercent: Math.min(92, Math.max(15, Math.round((baseKW / (baseKW * 1.4)) * 100)))
      };
    }));
    setSelectedPanelFilter('ALL');
  }, [activeOrgId]);

  // Simulation timer for live Modbus polling effect (updates every 3 seconds)
  useEffect(() => {
    if (!isLiveStreaming) return;
    const interval = setInterval(() => {
      setTelemetryData(prev => prev.map(item => {
        // slight jitter to simulate live factory electrical fluctuation
        const jitter = (Math.random() - 0.48) * 0.04;
        const newKW = Math.max(5, Math.round(item.activePowerKW * (1 + jitter) * 10) / 10);
        const newCurrent = Math.round(newKW * 1.5);
        const newPF = Math.min(0.99, Math.max(0.88, Math.round((item.powerFactor + (Math.random() - 0.5) * 0.01) * 100) / 100));
        return {
          ...item,
          voltageLL: Math.round((400 + (Math.random() - 0.5) * 2.5) * 10) / 10,
          activePowerKW: newKW,
          currentAvg: newCurrent,
          powerFactor: newPF,
          loadPercent: Math.min(98, Math.max(10, Math.round((newKW / 120) * 100))),
          energyTotalKWh: item.energyTotalKWh + Math.round((newKW / 1200) * 10) / 10
        };
      }));
      setLastUpdated(new Date());
    }, 3000);

    return () => clearInterval(interval);
  }, [isLiveStreaming]);

  // Aggregate Metrics for Header
  const totalFactoryKW = useMemo(() => {
    return telemetryData.reduce((sum, item) => sum + item.activePowerKW, 0);
  }, [telemetryData]);

  const totalCurrentA = useMemo(() => {
    return telemetryData.reduce((sum, item) => sum + item.currentAvg, 0);
  }, [telemetryData]);

  const avgPowerFactor = useMemo(() => {
    const sum = telemetryData.reduce((acc, item) => acc + item.powerFactor, 0);
    return (sum / telemetryData.length).toFixed(2);
  }, [telemetryData]);

  const transformerCapacityKVA = currentCompany.transformerKVA || 1600;
  const transformerLoadPercent = Math.min(100, Math.round((totalFactoryKW / (transformerCapacityKVA * 0.95)) * 100));

  // Dynamic Panels list based on active tenant's meters
  const availablePanels = useMemo(() => {
    const panels = Array.from(new Set(telemetryData.map(m => m.panel))).filter(Boolean);
    return ['ALL', ...panels];
  }, [telemetryData]);

  const filteredMeters = telemetryData.filter(m => {
    if (selectedPanelFilter === 'ALL') return true;
    return m.panel === selectedPanelFilter || m.panel.includes(selectedPanelFilter);
  });

  return (
    <div className="space-y-6">
      {/* Top Banner: Edge Computer Connection Status */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-4 sm:p-5 rounded-2xl border border-indigo-500/30 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-3 bg-indigo-600/30 border border-indigo-400/40 rounded-xl text-indigo-300 shrink-0">
              <Cpu className="w-6 h-6 animate-pulse text-cyan-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  ระบบวิเคราะห์พลังงานเรียลไทม์ (PowerView Edge IoT)
                </h2>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  RS-485 Modbus RTU Live
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                เชื่อมต่อมิเตอร์ {currentCompany.shortName} ครบ {telemetryData.length} จุด • หม้อแปลง {transformerCapacityKVA.toLocaleString()} kVA • อัปเดตล่าสุด: {lastUpdated.toLocaleTimeString('th-TH')}
              </p>
            </div>
          </div>

          {/* Quick Sub-navigation */}
          <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-700/70 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveSubTab('live')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'live'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📊 แดชบอร์ดสด
            </button>
            <button
              onClick={() => setActiveSubTab('diagram')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'diagram'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🔌 แบบ Wiring & ผังตู้
            </button>
            <button
              onClick={() => setActiveSubTab('sop')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'sop'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📝 ขั้นตอนสั่งงานลูกน้อง
            </button>
            <button
              onClick={() => setActiveSubTab('budget')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'budget'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              💰 สรุปงบและต้นทุน
            </button>
          </div>
        </div>
      </div>

      {/* ================= TAB 1: LIVE TELEMETRY DASHBOARD ================= */}
      {activeSubTab === 'live' && (
        <div className="space-y-6">
          {/* Executive Realtime KPI Cards (Optimized for Mobile Touch) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Load kW */}
            <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">โหลดกำลังไฟฟ้ารวม (Active Power)</span>
                <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-mono font-bold text-amber-400">
                  {totalFactoryKW.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
                <span className="text-xs text-slate-400 font-semibold">kW</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                <span>คิดเป็น: {(totalFactoryKW / 1000).toFixed(2)} MW</span>
                <span className="text-emerald-400">● กำลังทำงาน</span>
              </div>
            </div>

            {/* Transformer Load % */}
            <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">ภาระหม้อแปลง TR1 1,600 kVA</span>
                <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400">
                  <Gauge className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl sm:text-3xl font-mono font-bold ${
                  transformerLoadPercent > 80 ? 'text-rose-400' : 'text-blue-400'
                }`}>
                  {transformerLoadPercent}%
                </span>
                <span className="text-xs text-slate-400 font-semibold">ของพิกัด</span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    transformerLoadPercent > 80 ? 'bg-rose-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${transformerLoadPercent}%` }}
                />
              </div>
              <div className="mt-1.5 text-[10px] text-slate-400 text-right">
                พิกัดปลอดภัย &lt; 85%
              </div>
            </div>

            {/* System Power Factor */}
            <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">เพาเวอร์แฟกเตอร์ (PF เฉลี่ย)</span>
                <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl sm:text-3xl font-mono font-bold ${
                  Number(avgPowerFactor) >= 0.85 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {avgPowerFactor}
                </span>
                <span className="text-xs text-slate-400 font-semibold">PF</span>
              </div>
              <div className="mt-2 text-[11px] flex items-center justify-between">
                <span className="text-slate-400">เกณฑ์ กฟภ. &gt;= 0.85</span>
                <span className="text-emerald-400 font-medium">✓ ปลอดค่าปรับ</span>
              </div>
            </div>

            {/* Dual Loop Online Status */}
            <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">สถานะเครือข่าย Modbus</span>
                <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
                  <Wifi className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-mono font-bold text-indigo-400">
                  14 / 14
                </span>
                <span className="text-xs text-slate-400 font-semibold">จุด ออนไลน์</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-300 flex items-center justify-between font-mono">
                <span>Port1: 8/8 • Port2: 6/6</span>
                <span className="text-emerald-400 font-bold">19,200 bps</span>
              </div>
            </div>
          </div>

          {/* Dual Port Architecture Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Port 1: MDB-1 TR1 */}
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
                  <h3 className="text-sm font-bold text-white">
                    RS-485 Port 1: หม้อแปลง MDB-1 TR1 (8 จุด)
                  </h3>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono">
                  ตู้ C2-2 & C4-2
                </span>
              </div>
              <p className="text-xs text-slate-400">
                เดินสาย Daisy-chain เส้นทาง: ตู้ C2-2 (ID: 1, 5) ➔ ตู้ C4-2 (ID: 3, 6, 7, 8) ➔ MDB1-Q1-2, Q1-4 (ID: 2, 4)
              </p>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">โหลดรวม Port 1</span>
                  <span className="font-mono font-bold text-amber-300 text-sm">
                    {telemetryData.slice(0, 8).reduce((acc, i) => acc + i.activePowerKW, 0).toFixed(1)} kW
                  </span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">แรงดันเฉลี่ย</span>
                  <span className="font-mono font-bold text-white text-sm">400.5 V</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">อัตราสื่อสาร</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">100% สำเร็จ</span>
                </div>
              </div>
            </div>

            {/* Port 2: MDB-2 */}
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-indigo-400 animate-pulse" />
                  <h3 className="text-sm font-bold text-white">
                    RS-485 Port 2: ตู้ MDB-2 & ฉุกเฉิน (6 จุด)
                  </h3>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-mono">
                  ตู้ C3-2 ดำ & C3-2 แดง
                </span>
              </div>
              <p className="text-xs text-slate-400">
                เดินสาย Daisy-chain เส้นทาง: ตู้ C3-2 ดำ (Q1-1 Refrigeration ID: 9) ➔ ตู้ C3-2 แดง (ID: 10 ถึง 14)
              </p>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">โหลดรวม Port 2</span>
                  <span className="font-mono font-bold text-amber-300 text-sm">
                    {telemetryData.slice(8).reduce((acc, i) => acc + i.activePowerKW, 0).toFixed(1)} kW
                  </span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">แรงดันเฉลี่ย</span>
                  <span className="font-mono font-bold text-white text-sm">399.8 V</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">อัตราสื่อสาร</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">100% สำเร็จ</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Pills for Mobile */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <span className="text-slate-400 text-xs font-medium mr-1 shrink-0">เลือกตู้:</span>
              {availablePanels.map(filterKey => (
                <button
                  key={filterKey}
                  onClick={() => setSelectedPanelFilter(filterKey)}
                  className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                    selectedPanelFilter === filterKey
                      ? 'bg-indigo-600 text-white font-bold shadow'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {filterKey === 'ALL' ? `ทั้งหมด (${telemetryData.length} จุด)` : filterKey}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border transition-all ${
                isLiveStreaming 
                  ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/40' 
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLiveStreaming ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isLiveStreaming ? 'กำลังสตรีมสด (3s)' : 'หยุดสตรีม'}</span>
            </button>
          </div>

          {/* Live Meter Cards Grid (Responsive 1-col on mobile, 2 on tablet, 3 on desktop) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredMeters.map(meter => {
              const isHighLoad = meter.loadPercent > 80;
              const isLowPF = meter.powerFactor < 0.85;

              return (
                <div 
                  key={meter.id}
                  className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 hover:border-slate-700 transition-all shadow-md relative"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {meter.tag}
                        </span>
                        <span className="text-xs font-semibold text-white truncate max-w-[170px]" title={meter.location}>
                          {meter.location}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span>ตู้: <strong className="text-slate-200">{meter.panel}</strong></span>
                        <span>•</span>
                        <span className="font-mono text-cyan-400">Modbus ID: {meter.modbusId}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE
                    </div>
                  </div>

                  {/* Realtime Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 my-3 text-center">
                    <div className="bg-slate-950/70 p-2 rounded-xl">
                      <span className="text-[10px] text-slate-400 block">กำลังไฟฟ้า kW</span>
                      <span className="font-mono font-bold text-amber-400 text-base">
                        {meter.activePowerKW.toFixed(1)}
                      </span>
                    </div>

                    <div className="bg-slate-950/70 p-2 rounded-xl">
                      <span className="text-[10px] text-slate-400 block">กระแสเฉลี่ย (A)</span>
                      <span className="font-mono font-bold text-white text-base">
                        {meter.currentAvg}
                      </span>
                    </div>

                    <div className="bg-slate-950/70 p-2 rounded-xl">
                      <span className="text-[10px] text-slate-400 block">Power Factor</span>
                      <span className={`font-mono font-bold text-base ${isLowPF ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {meter.powerFactor.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Load Bar & Total Energy */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">แรงดันไฟ Line-Line:</span>
                      <span className="font-mono text-slate-200 font-semibold">{meter.voltageLL} V</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">หน่วยสะสม (kWh):</span>
                      <span className="font-mono text-cyan-300 font-bold">
                        {Math.round(meter.energyTotalKWh).toLocaleString()} kWh
                      </span>
                    </div>

                    {/* Load Percentage bar */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-slate-400">ระดับโหลดใช้งาน:</span>
                        <span className={`font-mono font-bold ${isHighLoad ? 'text-rose-400' : 'text-slate-300'}`}>
                          {meter.loadPercent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            isHighLoad ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${meter.loadPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= TAB 2: WIRING DIAGRAM & SYSTEM ARCHITECTURE ================= */}
      {activeSubTab === 'diagram' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 rounded-2xl p-4 sm:p-6 border border-slate-800 shadow-xl space-y-5">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                แบบการต่อสาย Modbus RS-485 (Daisy-Chain Architecture Diagram)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                การต่อสายจาก PowerView Edge Computer (Dual Port) ไปยังมิเตอร์ Schneider EasyLogic PM2200 ครบทั้ง 14 เครื่อง
              </p>
            </div>

            {/* Visual ASCII / Architecture Box */}
            <div className="bg-slate-950 p-4 sm:p-5 rounded-xl border border-slate-800 overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed">
              <pre className="text-cyan-300 font-bold mb-2">
{`========================================================================================
                  ผังระบบการต่อสาย RS-485 DAISY-CHAIN 14 METER POINTS
========================================================================================`}
              </pre>
              <pre className="text-slate-300">
{`   [ PowerView Edge IoT Gateway ] (ติดตั้งในตู้คอนโทรลหลัก / ข้างตู้ C3-2)
          │             │
          │             └─────────── Port 2 (RS-485 COM2) ──────────┐
          │                                                         │
   Port 1 (RS-485 COM1)                                             │
          │                                                         │
  ╔═══════╧═════════════════════════════════════════════════╗       │
  ║ LOOP 1 : ตู้ MDB-1 TR1 (8 เครื่อง)                     ║       │
  ║                                                         ║       │
  ║  (Master Port 1: Pin A+, Pin B-, Shield GND)            ║       │
  ║          │                                              ║       │
  ║          ▼                                              ║       │
  ║   [ID: 1] PM2200 (ตู้ C2-2 Q1-1 Frozen Line)           ║       │
  ║          │                                              ║       │
  ║          ▼                                              ║       │
  ║   [ID: 5] PM2200 (ตู้ C2-2 Q1-5 DC-AC Air)              ║       │
  ║          │                                              ║       │
  ║          ▼ (สายร้อยท่อข้ามไปตู้ C4-2)                  ║       │
  ║   [ID: 3] PM2200 (ตู้ C4-2 Q1-3 MCC-ACP Compressor)     ║       │
  ║          │                                              ║       │
  ║          ▼                                              ║       │
  ║   [ID: 6] PM2200 (ตู้ C4-2 Q1-6 DB-PRO-1 Office)        ║       │
  ║          │                                              ║       │
  ║          ▼                                              ║       │
  ║   [ID: 7] PM2200 (ตู้ C4-2 Q1-7 DB-PRO-2 Outside)       ║       │
  ║          │                                              ║       │
  ║          ▼                                              ║       │
  ║   [ID: 8] PM2200 (ตู้ C4-2 Q1-8 MCC-SILO)               ║       │
  ║          │                                              ║       │
  ║          ▼ (สายร้อยท่อไปตู้ C3-2 ดำ)                   ║       │
  ║   [ID: 2] PM2200 (ตู้ C3-2 ดำ Q1-2 MMC-PRO-2 RTE)       ║       │
  ║          │                                              ║       │
  ║          ▼                                              ║       │
  ║   [ID: 4] PM2200 (ตู้ C3-2 ดำ Q1-4 MCC-WSP Pump) [END]  ║       │
  ║          └─► [ คร่อม R=120Ω 1/4W ขั้ว (+) กับ (-) ]     ║       │
  ╚═════════════════════════════════════════════════════════╝       │
                                                                    │
  ╔═════════════════════════════════════════════════════════════════╧═══════╗
  ║ LOOP 2 : ตู้ MDB-2 & ระบบไฟฉุกเฉิน (6 เครื่อง)                          ║
  ║                                                                         ║
  ║  (Master Port 2: Pin A+, Pin B-, Shield GND)                            ║
  ║          │                                                              ║
  ║          ▼                                                              ║
  ║   [ID: 9] PM2200 (ตู้ C3-2 ดำ Q1-1 REFRIGERATION PLANT)                 ║
  ║          │                                                              ║
  ║          ▼ (สายร้อยท่อข้ามไปตู้ C3-2 แดง)                              ║
  ║   [ID: 10] PM2200 (ตู้ C3-2 แดง Q1-2 EMCC-FP&SN Fire Alarm)             ║
  ║          │                                                              ║
  ║          ▼                                                              ║
  ║   [ID: 11] PM2200 (ตู้ C3-2 แดง Q1-3 ELP-PRO-1 Emergency)               ║
  ║          │                                                              ║
  ║          ▼                                                              ║
  ║   [ID: 12] PM2200 (ตู้ C3-2 แดง Q1-4 EDB-PRO Water Treatment)           ║
  ║          │                                                              ║
  ║          ▼                                                              ║
  ║   [ID: 13] PM2200 (ตู้ C3-2 แดง Q1-5 ELP-OFF Server Room)               ║
  ║          │                                                              ║
  ║          ▼                                                              ║
  ║   [ID: 14] PM2200 (ตู้ C3-2 แดง Q1-6 EDB-AS/RS) [END]                   ║
  ║          └─► [ คร่อม R=120Ω 1/4W ขั้ว (+) กับ (-) ]                     ║
  ╚═════════════════════════════════════════════════════════════════════════╝`}
              </pre>
            </div>

            {/* Pinout Details Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 space-y-2">
                <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  ตารางขั้วต่อด้านหลัง Schneider EasyLogic PM2200:
                </h4>
                <ul className="space-y-1.5 text-slate-300">
                  <li>• <strong className="text-white font-mono">ขั้ว D1 / (+)</strong> : ต่อเข้าสายคู่บิดเกลียวเส้นบวก (สีส้ม หรือ สีขาว-น้ำเงิน)</li>
                  <li>• <strong className="text-white font-mono">ขั้ว D0 / (-)</strong> : ต่อเข้าสายคู่บิดเกลียวเส้นลบ (สีขาว-ส้ม หรือ สีน้ำเงิน)</li>
                  <li>• <strong className="text-white font-mono">ขั้ว Shield / C</strong> : ต่อสายชีลด์ถัก (Drain Wire) ต่อพ่วงต่อเนื่องกันทุกตัว</li>
                  <li>• <strong className="text-rose-400 font-bold">ข้อห้ามเด็ดขาด:</strong> ต่อสายชีลด์ลง Ground ของตู้เพียง <strong className="underline">จุดเดียวเท่านั้น (ที่ตู้ Master)</strong> ห้ามต่อกราวด์หัวท้ายพร้อมกันเพราะจะเกิด Ground Loop!</li>
                </ul>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 space-y-2">
                <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4" />
                  การใส่ R 120 Ohm (Termination Resistor):
                </h4>
                <p className="text-slate-300 leading-relaxed">
                  คลื่นสะท้อนสัญญาณ (Signal Reflection) ในสายสัญญาณยาวๆ แก้ไขโดยการนำตัวต้านทาน <strong>120 Ohm 1/4 Watt</strong> มาคร่อมระหว่างขั้ว <strong>(+)</strong> กับ <strong>(-)</strong>:
                </p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400">
                  - ปลาย Loop 1: คร่อมที่มิเตอร์ ID: 4 (MCC-WSP ตู้ C3-2)<br/>
                  - ปลาย Loop 2: คร่อมที่มิเตอร์ ID: 14 (EDB-AS/RS ตู้ C3-2 แดง)<br/>
                  - ส่วนที่ตัว Gateway: โยกสวิตช์ DIP Switch 120Ω ไปที่ตำแหน่ง ON
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: STEP-BY-STEP SOP FOR SUBORDINATES ================= */}
      {activeSubTab === 'sop' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 rounded-2xl p-4 sm:p-6 border border-slate-800 shadow-xl space-y-5">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                ใบงานและขั้นตอนปฏิบัติการ (SOP สั่งงานช่างหน้างาน 5 ขั้นตอน)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                เอกสารนี้ปริ้นท์หรือส่ง LINE ให้ทีมช่าง/ลูกน้องปฏิบัติตามทีละขั้นตอน รับประกันงานเสร็จ ปลอดภัย 100% สื่อสารได้ทันที
              </p>
            </div>

            {/* Step 1 */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  1
                </span>
                <h4 className="text-sm font-bold text-white">
                  ขั้นตอนที่ 1: มาตรการความปลอดภัย & ตรวจสอบความพร้อมตู้ MDB
                </h4>
              </div>
              <div className="text-xs text-slate-300 space-y-1 pl-8">
                <p>• สวมหมวกนิรภัย, ถุงมือฉนวนกันไฟ (Insulated Gloves 1,000V) และรองเท้าเซฟตี้</p>
                <p>• ปลดเบรกเกอร์ Control จ่ายไฟเข้าช่อง RS-485 (มิเตอร์ไม่ต้องดับไฟตู้หลัก แต่ต้องระวังแถบ Busbar 400V ด้านหลัง)</p>
                <p>• สำรวจช่องร้อยสายระหว่างตู้ C2-2 ➔ C4-2 ➔ C3-2 ดำ ➔ C3-2 แดง เตรียมท่อ EMT หรือ Flex อ่อน</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  2
                </span>
                <h4 className="text-sm font-bold text-white">
                  ขั้นตอนที่ 2: การเดินสายสัญญาณ RS-485 (Daisy-Chain เท่านั้น)
                </h4>
              </div>
              <div className="text-xs text-slate-300 space-y-1.5 pl-8">
                <p className="text-amber-300 font-bold">
                  ⚠️ ข้อควรระวังสูงสุด: ห้ามต่อสายแบบรูปดาว (Star) หรือแตกกิ่งแยก (T-Tap) เด็ดขาด สัญญาณจะสะท้อนและหลุด!
                </p>
                <p>• ใช้สาย <strong>Belden 9841</strong> (1-Pair Shielded Twisted Pair 24 AWG 120Ω)</p>
                <p>• ปลอกสายและใส่หางปลาแบบ Pin Type (คอร์ดยึด) ยึดแน่นที่ขั้ว D1(+) และ D0(-)</p>
                <p>• ที่จุดต่อพ่วง ให้เชื่อมต่อสาย Shield (Drain wire) ถึงกันด้วย Terminal Block ปลอกหุ้มท่อหด ป้องกันแตะโครงตู้</p>
                <p>• ต่อสายดิน Shield ลง Ground ตู้เฉพาะที่หัวฝั่ง Gateway จุดเดียวเท่านั้น</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  3
                </span>
                <h4 className="text-sm font-bold text-white">
                  ขั้นตอนที่ 3: การกดตั้งค่า Modbus Address หน้าปัดมิเตอร์ Schneider PM2200
                </h4>
              </div>
              <div className="text-xs text-slate-300 space-y-2 pl-8">
                <p>ให้ช่างกดปุ่มหน้าจอมิเตอร์ทุกตัวเพื่อตั้งค่า Communication พารามิเตอร์ให้ตรงกัน:</p>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1">
                  <p className="text-cyan-300">1. กดปุ่ม [Maintenance / Setup] ➔ ใส่รหัสผ่านเริ่มต้น: <strong className="text-white">0000</strong></p>
                  <p className="text-cyan-300">2. เลือกเมนู <strong>[COMM] (Communication)</strong></p>
                  <p className="text-cyan-300">3. กำหนดค่าต่อไปนี้:</p>
                  <p className="pl-4 text-slate-300">• <strong>Protocol:</strong> Modbus RTU</p>
                  <p className="pl-4 text-slate-300">• <strong>Address (Slave ID):</strong> กำหนดตั้งแต่ 1 ถึง 14 (ห้ามซ้ำกันตามตาราง!)</p>
                  <p className="pl-4 text-slate-300">• <strong>Baud Rate:</strong> 19200 bps (หรือ 9600)</p>
                  <p className="pl-4 text-slate-300">• <strong>Parity:</strong> Even (หรือ None 1 stop bit)</p>
                  <p className="pl-4 text-slate-300">• <strong>Transmission Mode:</strong> 8-Bit</p>
                  <p className="text-emerald-400">4. กด [Save & Exit] หน้าจอจะบันทึกสถานะ</p>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  4
                </span>
                <h4 className="text-sm font-bold text-white">
                  ขั้นตอนที่ 4: การใส่ตัวต้านทานปิดหัวท้าย (End-of-Line Resistor 120Ω)
                </h4>
              </div>
              <div className="text-xs text-slate-300 space-y-1 pl-8">
                <p>• นำตัวต้านทาน <strong>120 Ohm 1/4 Watt</strong> เข้าขันยึดคร่อมขั้ว D1(+) และ D0(-)</p>
                <p>• Loop 1: ขันคร่อมที่มิเตอร์ตัวสุดท้าย [ID: 4] MCC-WSP ในตู้ C3-2 ดำ</p>
                <p>• Loop 2: ขันคร่อมที่มิเตอร์ตัวสุดท้าย [ID: 14] EDB-AS/RS ในตู้ C3-2 แดง</p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  5
                </span>
                <h4 className="text-sm font-bold text-white">
                  ขั้นตอนที่ 5: การทดสอบสัญญาณ (Commissioning & Online Testing)
                </h4>
              </div>
              <div className="text-xs text-slate-300 space-y-1 pl-8">
                <p>• จ่ายไฟ 24VDC เข้า PowerView Edge Computer ตรวจสอบไฟ LED Power (สีเขียวติดนิ่ง)</p>
                <p>• สังเกตไฟ LED <strong>RX/TX</strong> ของ Port 1 และ Port 2 จะต้องกระพริบสม่ำเสมอ แสดงว่ามีการตอบสนอง Modbus Poll</p>
                <p>• เสียบสาย LAN หรือใส่ 4G SIM Card เพื่อเชื่อมต่อ Internet ขึ้น PowerView Cloud / Web App</p>
                <p>• ตรวจเช็คค่าหน้าแดชบอร์ดบนมือถือ ตัวเลข kW, V, A, kWh ต้องขึ้นครบทั้ง 14 ตัว</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: ITEMIZED BUDGET & COST CALCULATION ================= */}
      {activeSubTab === 'budget' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 rounded-2xl p-4 sm:p-6 border border-slate-800 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  ประมาณการงบประมาณและต้นทุนทั้งหมด (Itemized BOM & Investment Plan)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  คำนวณจากจำนวนจุดมิเตอร์ 14 เครื่อง ในโรงงาน ART OF BAKING (ระยะสายประมาณ 150-200 เมตร)
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ประเมินผลตอบแทน (ROI): คืนทุนภายใน 2-3 เดือน
              </span>
            </div>

            {/* Cost Table Comparison */}
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-950/80 text-slate-300 font-semibold">
                    <th className="p-3">ลำดับ</th>
                    <th className="p-3">รายการอุปกรณ์ / งานบริการ</th>
                    <th className="p-3 text-center">จำนวน</th>
                    <th className="p-3 text-center">หน่วย</th>
                    <th className="p-3 text-right">ราคาต่อหน่วย (บาท)</th>
                    <th className="p-3 text-right">รวมเป็นเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono">1</td>
                    <td className="p-3">
                      <strong className="text-white block">PowerView Edge Computer (IoT Gateway Dual Port RS-485)</strong>
                      <span className="text-[11px] text-slate-400">รองรับ 40 มิเตอร์, Dual COM, LAN/4G, บันทึกออฟไลน์ 1 เดือน, สิทธิ์ Cloud ฟรี</span>
                    </td>
                    <td className="p-3 text-center font-mono">1</td>
                    <td className="p-3 text-center">เครื่อง</td>
                    <td className="p-3 text-right font-mono">16,500</td>
                    <td className="p-3 text-right font-mono font-bold text-white">16,500</td>
                  </tr>

                  <tr className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono">2</td>
                    <td className="p-3">
                      <strong className="text-white block">สายสัญญาณ RS-485 Belden 9841 (Shielded Twisted Pair 24 AWG 120Ω)</strong>
                      <span className="text-[11px] text-slate-400">สายเกรดอุตสาหกรรม ป้องกันคลื่นสัญญาณรบกวนในตู้ MDB ความยาว 1 ม้วน (150m)</span>
                    </td>
                    <td className="p-3 text-center font-mono">150</td>
                    <td className="p-3 text-center">เมตร</td>
                    <td className="p-3 text-right font-mono">35</td>
                    <td className="p-3 text-right font-mono font-bold text-white">5,250</td>
                  </tr>

                  <tr className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono">3</td>
                    <td className="p-3">
                      <strong className="text-white block">แหล่งจ่ายไฟ Switching Power Supply 24VDC 1.5A (DIN-Rail)</strong>
                      <span className="text-[11px] text-slate-400">Mean Well HDR-30-24 สำหรับจ่ายไฟเลี้ยง Edge Computer</span>
                    </td>
                    <td className="p-3 text-center font-mono">1</td>
                    <td className="p-3 text-center">ชุด</td>
                    <td className="p-3 text-right font-mono">850</td>
                    <td className="p-3 text-right font-mono font-bold text-white">850</td>
                  </tr>

                  <tr className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono">4</td>
                    <td className="p-3">
                      <strong className="text-white block">อุปกรณ์ไฟฟ้าเสริมในตู้ควบคุม</strong>
                      <span className="text-[11px] text-slate-400">MCB 1P 6A, Surge Protection, Terminal Block, หางปลา Pin, R 120Ω 1/4W</span>
                    </td>
                    <td className="p-3 text-center font-mono">1</td>
                    <td className="p-3 text-center">Lot</td>
                    <td className="p-3 text-right font-mono">1,800</td>
                    <td className="p-3 text-right font-mono font-bold text-white">1,800</td>
                  </tr>

                  <tr className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono">5</td>
                    <td className="p-3">
                      <strong className="text-white block">ท่อร้อยสายไฟ EMT / Flexible Conduit & ข้อต่อ</strong>
                      <span className="text-[11px] text-slate-400">ท่อเหล็กร้อยสายป้องกันสัญญาณรบกวนข้ามตู้ C2-2, C3-2, C4-2</span>
                    </td>
                    <td className="p-3 text-center font-mono">1</td>
                    <td className="p-3 text-center">Lot</td>
                    <td className="p-3 text-right font-mono">2,500</td>
                    <td className="p-3 text-right font-mono font-bold text-white">2,500</td>
                  </tr>

                  <tr className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono">6</td>
                    <td className="p-3">
                      <strong className="text-white block">ค่าแรงเดินสาย ท่อร้อยสาย และตั้งค่า Modbus Address (ทีมช่างภายใน/ภายนอก)</strong>
                      <span className="text-[11px] text-slate-400">หากใช้ทีมช่างโรงงานของท่านเอง ต้นทุนส่วนนี้ = 0 บาท (ประมาณ 1.5 วันทำงาน)</span>
                    </td>
                    <td className="p-3 text-center font-mono">1</td>
                    <td className="p-3 text-center">งาน</td>
                    <td className="p-3 text-right font-mono">6,000</td>
                    <td className="p-3 text-right font-mono font-bold text-white">6,000</td>
                  </tr>

                  {/* Summary Totals */}
                  <tr className="bg-indigo-950/40 border-t-2 border-indigo-500 font-bold">
                    <td colSpan={5} className="p-3 text-right text-sm text-indigo-200">
                      รวมงบประมาณกรณีจ้างช่างภายนอกติดตั้งเบ็ดเสร็จ (Turnkey):
                    </td>
                    <td className="p-3 text-right text-base text-amber-300 font-mono">
                      32,900 บาท
                    </td>
                  </tr>

                  <tr className="bg-emerald-950/40 border-t border-emerald-500/40 font-bold">
                    <td colSpan={5} className="p-3 text-right text-sm text-emerald-300">
                      💡 งบประมาณกรณีให้ช่างประจำโรงงานของท่านเดินสายตามคู่มือ SOP นี้:
                    </td>
                    <td className="p-3 text-right text-base text-emerald-400 font-mono">
                      26,900 บาท
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Value Justification */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-amber-400 font-bold block mb-1">
                  ⚡ ป้องกันค่าปรับ Power Factor (PF)
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  หาก PF ตกต่ำกว่า 0.85 กฟภ. คิดค่าปรับกิโลวาร์ละ 56.07 บาท (โรงงานขนาด 1,600 kVA อาจเสียค่าปรับเดือนละ 5,000 - 15,000 บาท) การมีแจ้งเตือนเรียลไทม์จะช่วยป้องกันเงินส่วนนี้ได้ทันที
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-cyan-400 font-bold block mb-1">
                  📉 ลด Peak Demand (ตัดยอดไฟช่วงพีค)
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  ค่าความต้องการพลังไฟฟ้า (Demand Charge) กฟภ. คิดประมาณ 132.93 บาท/kW การมอนิเตอร์สดทำให้เห็นว่าตู้ไหนเดินเครื่องพร้อมกัน ทำให้บริหารจัดการไม่ให้เกิด Peak ที่ไม่จำเป็น
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-emerald-400 font-bold block mb-1">
                  ⏱️ ประหยัดเวลาช่างเดินจดมิเตอร์
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  ลดเวลาการเดินจดมิเตอร์ทุกเช้า 30-45 นาที ข้อมูลวิ่งขึ้นเว็บและส่ง LINE อัตโนมัติ ป้องกัน Human Error ในการอ่านตัวเลขทศนิยมผิดพลาด 100%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
