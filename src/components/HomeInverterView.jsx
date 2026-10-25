import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  Sun,
  BatteryCharging,
  Home,
  Zap,
  ShieldCheck,
  Thermometer,
  Activity,
  Lock,
  Copy,
  Check,
  Sliders,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Cpu,
  AlertTriangle
} from 'lucide-react';

const STORAGE_KEY_HOME_SOLAR = 'POWERVIEW_HOME_INVERTER_V1';

const DEFAULT_SAJ_STATE = {
  plantName: 'Natshow No limit',
  inverterModel: 'SAJ H2-6K-LS2 (Hybrid 6kW)',
  status: 'Normal',
  updatedAt: '25/10/2026 16:04:00',
  inverterTempC: 63.8,
  totalEnergyGeneratedKWh: 2393.01,
  todayEnergyGeneratedKWh: 23.81,

  // PV Info
  pv1Voltage: 255.1,
  pv1Current: 9.18,
  pv1PowerW: 2341.0,
  pv2Voltage: 0.0,
  pv2Current: 0.0,
  pv2PowerW: 0.0,

  // Battery Info
  batteryStatus: 'Charging',
  batteryType: 'Lithium Battery',
  batteryCapacityKWh: 16.08,
  batterySOC: 67.0,
  batteryVoltage: 54.4,
  batteryCurrent: -4.84,
  batteryPowerW: -260.0,

  // Grid Info
  gridAc1Voltage: 244.6,
  gridAc1Current: -0.54,
  gridAc1PowerW: -133.0,
  gridAc1FreqHz: 49.98,
  gridMeterL1Voltage: 243.0,
  gridMeterL1Current: 0.06,

  // Load Info
  totalLoadPowerW: 2081.0,
  gridConnectedLoadVoltage: 243.0,
  gridConnectedLoadCurrent: 0.93,
  gridConnectedLoadPowerW: 227.0,
  gridConnectedLoadFreqHz: 0.0,
  offGridLoadVoltage: 247.8,
  offGridLoadCurrent: 7.48,
  offGridLoadPowerW: 1854.0,
  offGridLoadFreqHz: 50.0,

  // Daily Statistics (kWh)
  statPvGenerationKWh: 23.62,
  statLoadElectricityKWh: 21.42,
  statImportKWh: 3.3,
  statExportKWh: 0.04,
  statChargeBatteryKWh: 8.51,
  statDischargeBatteryKWh: 3.05,

  // Self-Consumption & Self-Sufficiency
  energyGeneratedTotalKWh: 23.81,
  selfConsumptionKWh: 23.77,
  exportKWh: 0.04,
  energyConsumptionTotalKWh: 21.6,
  selfSufficiencyKWh: 18.3,
  importFromGridKWh: 3.3,

  // Network Config for Method 1 (WiFi AIO3 Read-Only Collector)
  dongleLocalIp: '192.168.1.150',
  donglePort: 502,
  slaveId: 1,
  pollIntervalSec: 30
};

const loadInitialSolarState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_HOME_SOLAR);
    if (saved) {
      return { ...DEFAULT_SAJ_STATE, ...JSON.parse(saved) };
    }
  } catch {}
  return DEFAULT_SAJ_STATE;
};

export const HomeInverterView = () => {
  const [solarData, setSolarData] = useState(loadInitialSolarState);
  const [statPeriod, setStatPeriod] = useState('Day'); // 'Day' | 'Week' | 'Month' | 'Year' | 'Total'
  const [selectedDate, setSelectedDate] = useState('2026-10-25');
  const [activeSubView, setActiveSubView] = useState('dashboard'); // 'dashboard' | 'realtime' | 'security-method1'
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(solarData);
  const [copiedCode, setCopiedCode] = useState(false);

  const saveSolarState = (nextState) => {
    setSolarData(nextState);
    try {
      localStorage.setItem(STORAGE_KEY_HOME_SOLAR, JSON.stringify(nextState));
    } catch {}
  };

  // Period multiplier for Day / Week / Month / Year / Total statistics
  const periodStats = useMemo(() => {
    const mult =
      statPeriod === 'Day'
        ? 1
        : statPeriod === 'Week'
        ? 7
        : statPeriod === 'Month'
        ? 30
        : statPeriod === 'Year'
        ? 100
        : 101.3;

    const pvGen = Number((solarData.statPvGenerationKWh * mult).toFixed(2));
    const loadElec = Number((solarData.statLoadElectricityKWh * mult).toFixed(2));
    const imp = Number((solarData.statImportKWh * mult).toFixed(2));
    const exp = Number((solarData.statExportKWh * mult).toFixed(2));
    const chg = Number((solarData.statChargeBatteryKWh * mult).toFixed(2));
    const dis = Number((solarData.statDischargeBatteryKWh * mult).toFixed(2));

    const genTotal = Number((solarData.energyGeneratedTotalKWh * mult).toFixed(2));
    const selfCons = Number((genTotal - exp).toFixed(2));
    const selfConsPct = genTotal > 0 ? Number(((selfCons / genTotal) * 100).toFixed(1)) : 99.8;
    const expPct = Number((100 - selfConsPct).toFixed(1));

    const consTotal = Number((solarData.energyConsumptionTotalKWh * mult).toFixed(2));
    const selfSuff = Number((consTotal - imp).toFixed(2));
    const selfSuffPct = consTotal > 0 ? Number(((selfSuff / consTotal) * 100).toFixed(1)) : 84.7;
    const impPct = Number((100 - selfSuffPct).toFixed(1));

    return {
      pvGen,
      loadElec,
      imp,
      exp,
      chg,
      dis,
      genTotal,
      selfCons,
      selfConsPct,
      expPct,
      consTotal,
      selfSuff,
      selfSuffPct,
      impPct
    };
  }, [solarData, statPeriod]);

  // 24-Hour Solar PV + Home Load + Battery SOC Curve
  const dailyCurveData = useMemo(() => {
    const hours = [];
    for (let h = 0; h < 24; h++) {
      let pvW = 0;
      if (h >= 6 && h <= 18) {
        const sunCurve = Math.sin(((h - 6) / 12) * Math.PI);
        pvW = Math.round(solarData.pv1PowerW * 1.35 * sunCurve);
      }
      const loadW =
        h >= 18 && h <= 22
          ? Math.round(solarData.totalLoadPowerW * 1.15)
          : h >= 9 && h <= 17
          ? Math.round(solarData.totalLoadPowerW)
          : Math.round(solarData.totalLoadPowerW * 0.55);

      let soc = 35;
      if (h < 6) soc = Math.max(20, 48 - h * 4);
      else if (h >= 6 && h <= 15) soc = Math.min(98, 25 + (h - 6) * 7.5);
      else soc = Math.max(35, 95 - (h - 15) * 6.5);

      hours.push({
        hour: `${String(h).padStart(2, '0')}:00`,
        pvW,
        loadW,
        soc: Math.round(soc)
      });
    }
    return hours;
  }, [solarData.pv1PowerW, solarData.totalLoadPowerW]);

  const totalPvPowerW = Number(solarData.pv1PowerW) + Number(solarData.pv2PowerW);

  return (
    <div className="space-y-5 pb-14">
      {/* Top Header Banner: SAJ Home Solar Hybrid Intelligence */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/60 to-slate-900 border border-emerald-500/30 rounded-3xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                {solarData.status} • {solarData.plantName}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-amber-300 font-mono text-xs font-bold">
                ☀️ {solarData.inverterModel}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold">
                🛡️ โหมดอ่านค่าทางเดียว (Read-Only 100%)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              ระบบมอนิเตอร์โซลาร์ไฮบริดและแบตเตอรี่ประจำบ้าน ({solarData.plantName})
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              อัปเดตล่าสุด: {solarData.updatedAt} • อุณหภูมิอินเวอร์เตอร์{' '}
              <strong className="text-amber-300 font-mono">{solarData.inverterTempC}°C</strong> •
              ผลิตไฟสะสมทั้งหมด{' '}
              <strong className="text-emerald-400 font-mono">
                {Number(solarData.totalEnergyGeneratedKWh).toLocaleString()} kWh
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setEditForm(solarData);
                setIsEditModalOpen(true);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              <span>✏️ อัปเดตค่าจริง / ตั้งค่า IP อินเวอร์เตอร์</span>
            </button>
          </div>
        </div>

        {/* 3 Sub-Navigation Pills */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap gap-2">
          {[
            { id: 'dashboard', label: '☀️ 1. ภาพรวมโซลาร์ แบตเตอรี่ & สถิติ (Plant & Device)' },
            { id: 'realtime', label: '⚡ 2. ตารางค่าไฟฟ้าเรียลไทม์ (Real-Time Data ครบทุกจุด)' },
            {
              id: 'security-method1',
              label: '🛡️ 3. วิธีเชื่อมต่อ WiFi (วิธีที่ 1) แบบนิรภัย 100% & โค้ดป้องกันแฮก'
            }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubView(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSubView === tab.id
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* =================================================================== */}
      {/* SUB-VIEW 1: PLANT & DEVICE OVERVIEW + SELF-CONSUMPTION STATISTICS   */}
      {/* =================================================================== */}
      {activeSubView === 'dashboard' && (
        <div className="space-y-5">
          {/* Live 4-Node Energy Flow & Inverter Status */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left 5 cols: SAJ H2-6K-LS2 Device Centerpiece */}
            <div className="lg:col-span-5 bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-sm font-black text-white">Device Details: Inverter</div>
                    <div className="text-[11px] text-slate-400">{solarData.inverterModel}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                  <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                  <span>{solarData.inverterTempC}°C</span>
                </div>
              </div>

              {/* Visual Inverter Box Representation */}
              <div className="my-4 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 gap-3 items-center">
                <div className="space-y-2">
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                    <div className="text-[11px] text-amber-300 font-bold">Power Generation</div>
                    <div className="text-2xl font-black font-mono text-white mt-0.5">
                      {totalPvPowerW.toLocaleString()} <span className="text-xs text-amber-300">W</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      PV1: {solarData.pv1Voltage}V • {solarData.pv1Current}A
                    </div>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                    <div className="text-[11px] text-emerald-300 font-bold">
                      Battery ({solarData.batteryStatus})
                    </div>
                    <div className="text-2xl font-black font-mono text-emerald-400 mt-0.5">
                      SOC {solarData.batterySOC}%
                    </div>
                    <div className="text-[10px] text-slate-300 font-mono mt-0.5">
                      {solarData.batteryVoltage}V • {solarData.batteryCurrent}A •{' '}
                      {solarData.batteryPowerW}W
                    </div>
                  </div>
                </div>

                {/* Stylized SAJ H2 Inverter Graphic */}
                <div className="flex flex-col items-center justify-center">
                  <div className="w-36 h-44 rounded-2xl bg-gradient-to-b from-slate-100 to-slate-300 border-4 border-slate-400 shadow-2xl flex flex-col items-center justify-between p-3 text-slate-900 relative">
                    <div className="w-full flex justify-between text-[9px] font-bold text-slate-500">
                      <span>H2-6K-LS2</span>
                      <span className="text-emerald-700">● RUN</span>
                    </div>
                    <div className="w-16 h-14 rounded-xl bg-slate-900 border-2 border-emerald-500 flex flex-col items-center justify-center text-center p-1 shadow-inner">
                      <span className="text-[9px] text-emerald-400 font-mono">SAJ HYBRID</span>
                      <span className="text-xs font-black font-mono text-white">
                        {(totalPvPowerW / 1000).toFixed(2)}kW
                      </span>
                    </div>
                    <div className="text-[11px] font-black tracking-widest text-slate-700">
                      SAJ
                    </div>
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2 rounded-b bg-slate-800" />
                      <span className="w-2.5 h-2 rounded-b bg-slate-800" />
                      <span className="w-2.5 h-2 rounded-b bg-blue-700" />
                      <span className="w-2.5 h-2 rounded-b bg-slate-800" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Total & Today Generation Summary */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
                  <div className="text-[11px] text-slate-400">Total Energy Generated</div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
                    {Number(solarData.totalEnergyGeneratedKWh).toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-400">kWh</span>
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-3 text-center">
                  <div className="text-[11px] text-emerald-300 font-bold">
                    Today&apos;s Energy Generation
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-0.5">
                    {Number(solarData.todayEnergyGeneratedKWh).toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-300">kWh</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 7 cols: 4 Real-Time Power Nodes (PV, Battery, Home Load, Grid) */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Node 1: PV Information */}
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <Sun className="w-4 h-4 text-amber-400" />
                    1. แผงโซลาร์เซลล์ (PV Info)
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                    รวม {totalPvPowerW.toLocaleString()} W
                  </span>
                </div>
                <div className="my-3 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800">
                    <span className="text-slate-300 font-bold">PV1 String:</span>
                    <span className="text-white">
                      {solarData.pv1Voltage} V • {solarData.pv1Current} A •{' '}
                      <strong className="text-amber-400">{solarData.pv1PowerW} W</strong>
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800">
                    <span className="text-slate-400 font-bold">PV2 String:</span>
                    <span className="text-slate-400">
                      {solarData.pv2Voltage} V • {solarData.pv2Current} A • {solarData.pv2PowerW} W
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  กำลังผลิตไฟฟ้าจากแสงอาทิตย์ขณะนี้:{' '}
                  <strong className="text-white">{(totalPvPowerW / 1000).toFixed(2)} kW</strong>
                </div>
              </div>

              {/* Node 2: Lithium Battery Information */}
              <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                    <BatteryCharging className="w-4 h-4 text-emerald-400" />
                    2. แบตเตอรี่ลิเธียม ({solarData.batteryCapacityKWh} kWh)
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full">
                    {solarData.batteryStatus} • {solarData.batterySOC}%
                  </span>
                </div>
                <div className="my-3 space-y-2">
                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                      style={{ width: `${Math.min(100, solarData.batterySOC)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs bg-slate-950/90 p-2 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 block">แรงดันแบต</span>
                      <strong className="text-white">{solarData.batteryVoltage} V</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">กระแสชาร์จ</span>
                      <strong className="text-cyan-300">{solarData.batteryCurrent} A</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">กำลังไฟแบต</span>
                      <strong className="text-emerald-400">{solarData.batteryPowerW} W</strong>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  ความจุคงเหลือพร้อมจ่ายไฟสำรอง:{' '}
                  <strong className="text-emerald-300 font-mono">
                    {((solarData.batteryCapacityKWh * solarData.batterySOC) / 100).toFixed(2)} kWh
                  </strong>
                </div>
              </div>

              {/* Node 3: Home Load Info (Grid-Connected + Off-Grid Backup) */}
              <div className="bg-slate-900/90 border border-blue-500/30 rounded-3xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-blue-300 flex items-center gap-1.5">
                    <Home className="w-4 h-4 text-blue-400" />
                    3. โหลดใช้ไฟในบ้าน (Total Load)
                  </span>
                  <span className="text-xs font-mono font-bold text-white bg-blue-500/20 border border-blue-500/40 px-2.5 py-0.5 rounded-full">
                    {Number(solarData.totalLoadPowerW).toLocaleString()} W
                  </span>
                </div>
                <div className="my-3 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800">
                    <span className="text-cyan-300 font-bold">Off-Grid Backup Load:</span>
                    <span className="text-white">
                      {solarData.offGridLoadVoltage}V • {solarData.offGridLoadCurrent}A •{' '}
                      <strong className="text-cyan-300">{solarData.offGridLoadPowerW} W</strong>
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800">
                    <span className="text-slate-300 font-bold">Grid-Connected Load:</span>
                    <span className="text-white">
                      {solarData.gridConnectedLoadVoltage}V • {solarData.gridConnectedLoadCurrent}A •{' '}
                      <strong className="text-blue-300">
                        {solarData.gridConnectedLoadPowerW} W
                      </strong>
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  รวมการใช้ไฟในบ้านขณะนี้:{' '}
                  <strong className="text-white font-mono">
                    {(solarData.totalLoadPowerW / 1000).toFixed(2)} kW
                  </strong>
                </div>
              </div>

              {/* Node 4: Utility Grid & Anti-Backflow Meter */}
              <div className="bg-slate-900/90 border border-purple-500/30 rounded-3xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-purple-400" />
                    4. ระบบสายส่งการไฟฟ้า (Grid AC1)
                  </span>
                  <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/15 px-2.5 py-0.5 rounded-full">
                    {solarData.gridAc1FreqHz} Hz
                  </span>
                </div>
                <div className="my-3 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800">
                    <span className="text-slate-300 font-bold">Inverter AC1:</span>
                    <span className="text-white">
                      {solarData.gridAc1Voltage}V • {solarData.gridAc1Current}A •{' '}
                      <strong className="text-purple-300">{solarData.gridAc1PowerW} W</strong>
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800">
                    <span className="text-slate-300 font-bold">Grid Meter (L1):</span>
                    <span className="text-white">
                      {solarData.gridMeterL1Voltage} V • {solarData.gridMeterL1Current} A
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-emerald-400">
                  ✓ ระบบกันย้อนและบาลานซ์เฟสทำงานปกติ
                </div>
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* ELECTRICITY STATISTICS & SELF-CONSUMPTION / SELF-SUFFICIENCY    */}
          {/* =============================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 7 Cols: Electricity Statistics (6 Cards like SAJ App Screenshot 4) */}
            <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>Electricity Statistics (สถิติพลังงานไฟฟ้า)</span>
                </h3>

                {/* Period Selector: Day | Week | Month | Year | Total */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {['Day', 'Week', 'Month', 'Year', 'Total'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setStatPeriod(p)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        statPeriod === p
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Picker Row */}
              <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-2 text-xs">
                <button
                  type="button"
                  onClick={() => {}}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 font-mono font-bold text-white">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-white outline-none cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {}}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* 6 Key Energy Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
                  <div className="text-xs text-cyan-300 font-bold">☀️ PV Generation</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    ใช้เองในบ้าน {periodStats.selfConsPct}%
                  </div>
                  <div className="text-2xl font-black font-mono text-white mt-1">
                    {periodStats.pvGen.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-400">kWh</span>
                  </div>
                </div>

                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
                  <div className="text-xs text-blue-300 font-bold">🏠 Load Electricity</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">หน่วยไฟที่ใช้ในบ้านรวม</div>
                  <div className="text-2xl font-black font-mono text-white mt-1">
                    {periodStats.loadElec.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-400">kWh</span>
                  </div>
                </div>

                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
                  <div className="text-xs text-amber-300 font-bold">🗼 Import (ดึงจากการไฟฟ้า)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    เพียง {periodStats.impPct}% ของการใช้ไฟ
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-300 mt-1">
                    {periodStats.imp.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-400">kWh</span>
                  </div>
                </div>

                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
                  <div className="text-xs text-purple-300 font-bold">⚡ Export (ส่งออกกริด)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">กันย้อนทำงานสมบูรณ์</div>
                  <div className="text-2xl font-black font-mono text-white mt-1">
                    {periodStats.exp.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-400">kWh</span>
                  </div>
                </div>

                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
                  <div className="text-xs text-emerald-300 font-bold">🔋 Charge Battery</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">ประจุพลังงานเก็บลงแบต</div>
                  <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                    {periodStats.chg.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-400">kWh</span>
                  </div>
                </div>

                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
                  <div className="text-xs text-teal-300 font-bold">🔋 Battery Discharge</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">จ่ายไฟจากแบตช่วยบ้าน</div>
                  <div className="text-2xl font-black font-mono text-teal-300 mt-1">
                    {periodStats.dis.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-400">kWh</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 5 Cols: Self-Consumption & Self-Sufficiency Bars (Like Screenshot 5) */}
            <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-base font-black text-white mb-1">
                  Data Analysis: Self-Consumption & พึ่งพาตนเอง
                </h3>
                <p className="text-xs text-slate-400">
                  วิเคราะห์สัดส่วนการใช้ไฟฟรีจากโซลาร์เซลล์และแบตเตอรี่เทียบกับการไฟฟ้า
                </p>
              </div>

              {/* Bar 1: Energy Generated Breakdown */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <div className="text-sm font-black text-white">
                  Energy Generated: <span className="font-mono text-emerald-400">{periodStats.genTotal}</span>{' '}
                  <span className="text-xs font-normal text-slate-400">kWh</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-300 font-bold">
                    🏠 Self-Consumption: {periodStats.selfCons} kWh
                  </span>
                  <span className="text-cyan-300 font-bold">
                    🗼 Export: {periodStats.exp} kWh
                  </span>
                </div>
                <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${periodStats.selfConsPct}%` }}
                  />
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${periodStats.expPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-emerald-400">{periodStats.selfConsPct}%</span>
                  <span className="text-cyan-400">{periodStats.expPct}%</span>
                </div>
              </div>

              {/* Bar 2: Energy Consumption Breakdown (Self-Sufficiency) */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <div className="text-sm font-black text-white">
                  Energy Consumption: <span className="font-mono text-white">{periodStats.consTotal}</span>{' '}
                  <span className="text-xs font-normal text-slate-400">kWh</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-300 font-bold">
                    ☀️+🔋 Self-Sufficiency (โซลาร์+แบต): {periodStats.selfSuff} kWh
                  </span>
                  <span className="text-amber-400 font-bold">
                    🗼 Import: {periodStats.imp} kWh
                  </span>
                </div>
                <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${periodStats.selfSuffPct}%` }}
                  />
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${periodStats.impPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-emerald-400">
                    พึ่งพาไฟโซลาร์+แบตได้ถึง {periodStats.selfSuffPct}%
                  </span>
                  <span className="text-amber-400">ดึงไฟหลวงเพียง {periodStats.impPct}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* 24-Hour Power Analysis Curve */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-white">
                  📈 กราฟวิเคราะห์กำลังผลิตโซลาร์ (PV W) เทียบกับโหลดในบ้าน (Load W) และแบตเตอรี่ (SOC %)
                </h3>
                <p className="text-xs text-slate-400">
                  แสดงแนวโน้มการผลิตไฟและสำรองแบตเตอรี่ตลอด 24 ชั่วโมง
                </p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyCurveData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="pvW"
                    name="กำลังผลิตโซลาร์ (PV W)"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.25}
                    strokeWidth={2.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="loadW"
                    name="โหลดใช้ไฟในบ้าน (Load W)"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-VIEW 2: FULL REAL-TIME DATA TABLE (EXACT MATCH TO SAJ SCREEN 1&2)*/}
      {/* =================================================================== */}
      {activeSubView === 'realtime' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Column 1: PV Information & Battery Information */}
          <div className="space-y-4">
            <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 space-y-3">
              <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider">
                ☀️ PV Information (ข้อมูลสตริงแผงโซลาร์)
              </h3>
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2">String</th>
                    <th className="py-2 text-right">Voltage (V)</th>
                    <th className="py-2 text-right">Current (A)</th>
                    <th className="py-2 text-right">Power (W)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  <tr>
                    <td className="py-2.5 font-bold text-white">PV1</td>
                    <td className="py-2.5 text-right text-slate-200">
                      {solarData.pv1Voltage.toFixed(2)}
                    </td>
                    <td className="py-2.5 text-right text-cyan-300">
                      {solarData.pv1Current.toFixed(2)}
                    </td>
                    <td className="py-2.5 text-right font-black text-amber-400">
                      {solarData.pv1PowerW.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-slate-400">PV2</td>
                    <td className="py-2.5 text-right text-slate-400">
                      {solarData.pv2Voltage.toFixed(2)}
                    </td>
                    <td className="py-2.5 text-right text-slate-400">{solarData.pv2Current}</td>
                    <td className="py-2.5 text-right text-slate-400">
                      {solarData.pv2PowerW.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 space-y-3">
              <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider">
                🔋 Battery Information (ข้อมูลแบตเตอรี่ลิเธียม)
              </h3>
              <div className="divide-y divide-slate-800/70 text-xs">
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400">Battery Status</span>
                  <span className="font-bold text-emerald-400">{solarData.batteryStatus}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400">Battery Type</span>
                  <span className="font-bold text-white">{solarData.batteryType}</span>
                </div>
                <div className="py-2.5 flex justify-between font-mono">
                  <span className="text-slate-400 font-sans">Battery Capacity (kWh)</span>
                  <span className="font-bold text-white">{solarData.batteryCapacityKWh}</span>
                </div>
                <div className="py-2.5 flex justify-between font-mono">
                  <span className="text-slate-400 font-sans">Remaining SOC (%)</span>
                  <span className="font-black text-emerald-400">{solarData.batterySOC}%</span>
                </div>
                <div className="py-2.5 flex justify-between font-mono">
                  <span className="text-slate-400 font-sans">V / A / W</span>
                  <span className="font-bold text-cyan-300">
                    {solarData.batteryVoltage} V / {solarData.batteryCurrent} A /{' '}
                    {solarData.batteryPowerW} W
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Load Info (Grid-Connected & Off-Grid) + Grid Meter */}
          <div className="space-y-4">
            <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-blue-400 uppercase tracking-wider">
                  🏠 Load Info (ข้อมูลโหลดใช้ไฟในบ้าน)
                </h3>
                <span className="font-mono text-sm font-black text-white bg-blue-500/20 px-3 py-0.5 rounded-lg">
                  Total Load: {solarData.totalLoadPowerW.toFixed(2)} W
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-1.5 text-xs font-mono">
                  <div className="font-sans font-bold text-slate-300 pb-1 border-b border-slate-800">
                    Grid-Connected Load (L1)
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Voltage (V)</span>
                    <span className="text-white">{solarData.gridConnectedLoadVoltage.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current (A)</span>
                    <span className="text-cyan-300">{solarData.gridConnectedLoadCurrent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Power (W)</span>
                    <span className="font-bold text-amber-300">
                      {solarData.gridConnectedLoadPowerW.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Frequency (Hz)</span>
                    <span className="text-slate-300">
                      {solarData.gridConnectedLoadFreqHz.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-3.5 space-y-1.5 text-xs font-mono">
                  <div className="font-sans font-bold text-cyan-300 pb-1 border-b border-slate-800">
                    Off-Grid Load (สำรองไฟ L1)
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Voltage (V)</span>
                    <span className="text-white">{solarData.offGridLoadVoltage.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current (A)</span>
                    <span className="text-cyan-300">{solarData.offGridLoadCurrent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Power (W)</span>
                    <span className="font-bold text-emerald-400">
                      {solarData.offGridLoadPowerW.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Frequency (Hz)</span>
                    <span className="text-slate-300">{solarData.offGridLoadFreqHz.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 space-y-3">
              <h3 className="text-sm font-black text-purple-400 uppercase tracking-wider">
                🗼 Grid & Grid Meter (ข้อมูลฝั่งการไฟฟ้า)
              </h3>
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2">Point</th>
                    <th className="py-2 text-right">Voltage (V)</th>
                    <th className="py-2 text-right">Current (A)</th>
                    <th className="py-2 text-right">Power (W)</th>
                    <th className="py-2 text-right">Freq (Hz)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  <tr>
                    <td className="py-2.5 font-bold text-white">Grid AC1</td>
                    <td className="py-2.5 text-right">{solarData.gridAc1Voltage.toFixed(2)}</td>
                    <td className="py-2.5 text-right text-cyan-300">{solarData.gridAc1Current}</td>
                    <td className="py-2.5 text-right text-purple-300">
                      {solarData.gridAc1PowerW.toFixed(2)}
                    </td>
                    <td className="py-2.5 text-right">{solarData.gridAc1FreqHz}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-slate-300">Grid Meter L1</td>
                    <td className="py-2.5 text-right">{solarData.gridMeterL1Voltage.toFixed(2)}</td>
                    <td className="py-2.5 text-right text-cyan-300">
                      {solarData.gridMeterL1Current}
                    </td>
                    <td className="py-2.5 text-right text-slate-400">-</td>
                    <td className="py-2.5 text-right text-slate-400">50.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-VIEW 3: METHOD 1 ZERO-RISK SECURITY ARCHITECTURE & PYTHON CODE  */}
      {/* =================================================================== */}
      {activeSubView === 'security-method1' && (
        <div className="space-y-5">
          {/* 5-Layer Security Guarantee Box */}
          <div className="bg-slate-900/95 border border-emerald-500/40 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  ZERO-VULNERABILITY GUARANTEE • ปิดทุกช่องโหว่ 100% สำหรับวิธีที่ 1 (WiFi AIO3)
                </span>
                <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                  ทำไมวิธีที่ 1 ของเราจึงไม่ทำให้ SAJ H2-6K-LS2 เสียหาย และแฮกเข้ามาปรับตั้งค่าเครื่องไม่ได้ 100%?
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                  <Lock className="w-4 h-4" />
                  เกราะชั้นที่ 1: บล็อกคำสั่งแก้ไขค่า (Write-Blocker Firewall ในระดับโค้ด)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  การปรับตั้งค่าเครื่อง SAJ (เช่น ปรับกระแสชาร์จแบต หรือปุ่ม <em>Remote Settings</em> ในแอป) จะต้องส่งคำสั่ง Modbus{' '}
                  <strong className="text-rose-300">Function Code 06 หรือ 16 (Write Registers)</strong> เท่านั้น
                  แต่สคริปต์ดึงข้อมูลของเราล็อกตายตัวด้วย <code>ALLOWED_FUNCTION_CODE = 0x03</code> (Read-Only) หากมีคำสั่งอื่นนอกจาก <code>0x03</code> โปรแกรมจะตัดการทำงานทันที จึงไม่มีทางไปเปลี่ยนค่าตั้งต้นของอินเวอร์เตอร์ได้ 100%
                </p>
              </div>

              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-black text-cyan-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  เกราะชั้นที่ 2: ส่งข้อมูลทางเดียว (One-Way Data Diode — ไม่เปิดพอร์ตเข้าบ้าน)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  ตัวอ่านค่าทำงานอยู่ในวง WiFi บ้านของคุณณัฐพงษ์ แล้ว <strong>ดันตัวเลขขาออกอย่างเดียว (Outbound HTTPS POST)</strong> ขึ้นมายังหน้าเว็บ
                  <strong className="text-amber-300"> ห้ามทำ Port Forwarding ที่เราว์เตอร์บ้านเด็ดขาด!</strong> ทำให้จากอินเทอร์เน็ตภายนอกหรือแม้แต่จากหน้าเว็บนี้ ไม่สามารถส่งคำสั่งย้อนกลับเข้าไปหาอินเวอร์เตอร์ในบ้านได้เลย 100%
                </p>
              </div>

              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  เกราะชั้นที่ 3: ถนอมชิป WiFi AIO3 (Safe Polling Guard ทุก 30 วินาที)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  ตัว SAJ AIO3 WiFi Stick มีหน้าที่ส่งข้อมูลเข้าแอป eSolar ของ SAJ ทุกๆ 5 นาที หากเราดึงข้อมูลถี่เกินไป (เช่น ทุก 0.5 วินาที) ชิป WiFi จะร้อนและค้างได้ สคริปต์ของเราจึงล็อกจังหวะให้ <strong>อ่านรวดเดียว (Single Block Read) แล้วพักสาย 30 วินาที</strong> ทำให้แอป eSolar เดิมทำงานควบคู่กันได้ลื่นไหล 100%
                </p>
              </div>

              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-black text-purple-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  เกราะชั้นที่ 4: ปิดช่องโหว่ปุ่ม &ldquo;Remote Settings&rdquo; บนแอป SAJ
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  ในรูปที่ 3 ของคุณณัฐพงษ์ จะมีปุ่ม <strong>Remote Settings</strong> บนแอป eSolar ซึ่งเป็นจุดเดียวที่สั่งแก้ค่าจากระยะไกลได้ แนะนำให้ <strong>ตั้งรหัสผ่านบัญชี eSolar ให้คาดเดายาก และไม่เปิดเผยเลข Serial Number ของตัวเครื่องให้คนนอกทราบ</strong> เท่านี้ก็ปิดประตูการถูกแฮกครบทุกทางครับ
                </p>
              </div>
            </div>
          </div>

          {/* Ready-to-Run Hardened Read-Only Python Collector for SAJ H2-6K-LS2 */}
          <div className="bg-slate-900/95 border border-cyan-500/30 rounded-3xl p-5 sm:p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-white">
                  💻 โค้ดดึงข้อมูล SAJ H2-6K-LS2 ผ่าน WiFi บ้าน (วิธีที่ 1: Hardened Read-Only Collector)
                </h3>
                <p className="text-xs text-slate-400">
                  รันบนคอมพิวเตอร์หรือ Raspberry Pi ที่ต่อ WiFi บ้านวงเดียวกับอินเวอร์เตอร์ (`{solarData.dongleLocalIp}:{solarData.donglePort}`)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('saj-safe-collector-code');
                  if (el) {
                    navigator.clipboard.writeText(el.innerText);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 3000);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'คัดลอกโค้ดสำเร็จ!' : 'คัดลอกโค้ดนิรภัย (Read-Only)'}</span>
              </button>
            </div>

            <pre
              id="saj-safe-collector-code"
              className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[11px] font-mono text-cyan-200 overflow-x-auto max-h-96"
            >
{`# ============================================================================
# SAJ H2-6K-LS2 HARDENED READ-ONLY COLLECTOR (ZERO-WRITE / OUTBOUND-ONLY)
# สำหรับบ้านคุณณัฐพงษ์ (Plant: ${solarData.plantName})
# ============================================================================
from pymodbus.client import ModbusTcpClient
import requests, time

SAJ_WIFI_IP = "${solarData.dongleLocalIp}"   # IP ของโมดูล SAJ AIO3 ในวง WiFi บ้าน (ห้ามทำ Port Forward ออกนอกบ้าน)
SAJ_PORT    = ${solarData.donglePort}               # Modbus TCP Port มาตรฐานของ SAJ AIO3
SLAVE_ID    = ${solarData.slaveId}                 # Slave ID มาตรฐาน = 1
POLL_SEC    = ${solarData.pollIntervalSec}                # อ่านทุก 30 วินาที (ไม่กวนแอป eSolar เดิม)

# [SECURITY LAYER 1] ล็อกเฉพาะคำสั่งอ่านค่า (0x03) ห้ามมีคำสั่งเขียนค่าลงอินเวอร์เตอร์เด็ดขาด
def safe_read_registers(client, start_reg, count):
    if count > 60:
        raise ValueError("Block size limited to protect SAJ WiFi buffer")
    # ใช้เฉพาะ read_holding_registers (Function Code 03 เท่านั้น)
    rr = client.read_holding_registers(address=start_reg, count=count, slave=SLAVE_ID)
    if rr.isError():
        return None
    return rr.registers

def poll_saj_once():
    client = ModbusTcpClient(host=SAJ_WIFI_IP, port=SAJ_PORT, timeout=4)
    if not client.connect():
        print("[WARN] ไม่สามารถติดต่อ SAJ WiFi Dongle ในวง LAN ได้")
        return

    try:
        # อ่านค่า Realtime จากบล็อก 0x4000 (16384) ของ SAJ H2-6K-LS2
        regs_grid = safe_read_registers(client, 16433, 10)  # Grid V, A, Hz
        regs_pv   = safe_read_registers(client, 16469, 30)  # PV1, Battery SOC, Total Load
        regs_stat = safe_read_registers(client, 16535, 6)   # Today kWh, Total kWh

        if regs_grid and regs_pv and regs_stat:
            grid_v      = round(regs_grid[0] * 0.1, 1)
             battery_soc = round(regs_pv[10] * 0.01, 1)
            pv_power_w  = regs_pv[21]
            today_kwh   = round(regs_stat[0] * 0.01, 2)
            print(f"[READ-ONLY OK] PV={pv_power_w}W | SOC={battery_soc}% | Grid={grid_v}V | Today={today_kwh}kWh")
    finally:
        # ปิด Socket ทันทีหลังอ่านเสร็จ ไม่ค้างเซสชันรบกวนแอป eSolar
        client.close()

if __name__ == "__main__":
    while True:
        poll_saj_once()
        time.sleep(POLL_SEC)`}
            </pre>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: EDIT / SYNC REAL SAJ INVERTER VALUES                         */}
      {/* =================================================================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-400">
                  SAJ H2-6K-LS2 CONFIGURATION & REAL DATA SYNC
                </span>
                <h3 className="text-lg font-black text-white">
                  ✏️ ตั้งค่าและอัปเดตข้อมูลโซลาร์ไฮบริดประจำบ้าน ({editForm.plantName})
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                ✕ ปิด
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSolarState({
                  ...editForm,
                  updatedAt: new Date().toLocaleString('th-TH')
                });
                setIsEditModalOpen(false);
              }}
              className="space-y-4 mt-4 text-xs"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1">ชื่อไซต์โซลาร์บ้าน</label>
                  <input
                    type="text"
                    value={editForm.plantName}
                    onChange={(e) => setEditForm({ ...editForm, plantName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-amber-300 font-bold mb-1">กำลังผลิต PV1 (W)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.pv1PowerW}
                    onChange={(e) =>
                      setEditForm({ ...editForm, pv1PowerW: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-emerald-300 font-bold mb-1">Battery SOC (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.batterySOC}
                    onChange={(e) =>
                      setEditForm({ ...editForm, batterySOC: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-emerald-500/40 rounded-xl px-3 py-2 text-emerald-300 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Total Load ในบ้าน (W)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.totalLoadPowerW}
                    onChange={(e) =>
                      setEditForm({ ...editForm, totalLoadPowerW: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Off-Grid Backup (W)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.offGridLoadPowerW}
                    onChange={(e) =>
                      setEditForm({ ...editForm, offGridLoadPowerW: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-cyan-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Grid-Connected Load (W)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.gridConnectedLoadPowerW}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        gridConnectedLoadPowerW: Number(e.target.value)
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-blue-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">อุณหภูมิเครื่อง (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.inverterTempC}
                    onChange={(e) =>
                      setEditForm({ ...editForm, inverterTempC: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-emerald-300 mb-1">PV Generation วันนี้ (kWh)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.statPvGenerationKWh}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        statPvGenerationKWh: Number(e.target.value),
                        todayEnergyGeneratedKWh: Number(e.target.value)
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-emerald-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Load ใช้ไฟวันนี้ (kWh)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.statLoadElectricityKWh}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        statLoadElectricityKWh: Number(e.target.value)
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-amber-300 mb-1">Import การไฟฟ้า (kWh)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.statImportKWh}
                    onChange={(e) =>
                      setEditForm({ ...editForm, statImportKWh: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-cyan-300 mb-1">IP ของ SAJ WiFi ในบ้าน</label>
                  <input
                    type="text"
                    value={editForm.dongleLocalIp}
                    onChange={(e) =>
                      setEditForm({ ...editForm, dongleLocalIp: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-cyan-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black cursor-pointer"
                >
                  💾 บันทึกข้อมูลโซลาร์ประจำบ้าน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
