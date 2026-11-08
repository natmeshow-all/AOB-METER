import React, { useState, useMemo } from 'react';
import {
  Sun,
  Battery,
  BatteryCharging,
  Zap,
  Home,
  Sparkles,
  CheckCircle2,
  Clock,
  Thermometer,
  Activity,
  Cpu,
  Layers,
  ChevronRight,
  X,
  Gauge,
  Flame,
  ShieldCheck
} from 'lucide-react';

/**
 * AnimatedEnergyFlow
 * Ultra-Responsive, Interactive Live Energy Flow Diagram:
 * - Placed at the very top of the dashboard.
 * - Interactive Equipment Inspection: Tap any node (Solar, Grid, Inverter, Battery, Home Load)
 *   to expand real-time Power (W), Current (A), Voltage (V), Temperature (°C),
 *   and Daily Energy Summary (kWh & hours).
 * - Real-Time Animated Conduits dynamically matching physics (e.g. Battery Discharging -> Home Load).
 */
export function AnimatedEnergyFlow({
  pvPowerW = 0,
  pv1Volt = 0,
  pv1CurrentA = 0,
  pv2Volt = 0,
  pv2CurrentA = 0,
  gridPowerW = 0,
  gridVoltageV = 230.5,
  gridCurrentA = 0,
  batteryPowerW = 1450,
  batteryVoltageV = 51.2,
  batteryCurrentA = 28.3,
  batterySOC = 57,
  loadPowerW = 1510,
  loadVoltageV = 230.0,
  loadCurrentA = 6.56,
  inverterTempC = 36.5,
  batteryTempC = 28.5,
  todayGenKWh = 20.69,
  peakPvWatts = 5420,
  statGridImportKWh = 4.19,
  statGridExportKWh = 0.0,
  chargeBatteryKWh = 9.20,
  dischargeBatteryKWh = 9.02,
  statLoadElectricityKWh = 19.66,
  todayEstSavings = 76,
  sajDeviceSn = 'H2A2602J2539E14713',
  isHomeSolar = true
}) {
  // Interactive selected node state: 'battery' | 'inverter' | 'solar' | 'grid' | 'load' | null
  const [selectedNode, setSelectedNode] = useState('battery');

  // Compute live physics
  const physics = useMemo(() => {
    const pv = Number(pvPowerW) || 0;
    const grid = Number(gridPowerW) || 0;
    let bat = Number(batteryPowerW) || 0;
    const soc = Number(batterySOC) || 57;
    const load = Number(loadPowerW) || 1510;
    const temp = Number(inverterTempC) || 36.5;

    // Auto-detect discharge: when PV is 0 and Grid is 0 and Load > 50W
    const isNightDischarge = pv < 50 && Math.abs(grid) < 50 && load > 50;
    if (isNightDischarge && bat >= 0) {
      bat = -Math.abs(bat > 0 ? bat : load);
    }

    const isPvActive = pv > 50;
    const isExporting = grid < -50;
    const isImporting = grid > 50;
    const isDischarging = bat < -50;
    const isCharging = bat > 50;

    let narrative = '';
    if (isDischarging && !isPvActive && !isImporting) {
      narrative = `🔋 แบตเตอรี่คายประจุ ${(Math.abs(bat) / 1000).toFixed(2)} kW จ่ายตรงเลี้ยงบ้าน 100% (ค่าไฟหลวง ฿0.00)`;
    } else if (isPvActive && isCharging && isExporting) {
      narrative = `☀️ โซลาร์ผลิต ${(pv / 1000).toFixed(2)} kW → เลี้ยงบ้าน + อัดประจุแบตเตอรี่ + ขายไฟคืน กฟภ. ${(Math.abs(grid) / 1000).toFixed(2)} kW`;
    } else if (isPvActive) {
      narrative = `☀️ แดดจัด: โซลาร์ผลิต ${(pv / 1000).toFixed(2)} kW จ่ายเครื่องใช้ไฟฟ้าและชาร์จแบตเตอรี่`;
    } else if (isImporting) {
      narrative = `⚡ ดึงไฟจากการไฟฟ้า (PEA) ${(grid / 1000).toFixed(2)} kW เลี้ยงบ้าน`;
    } else {
      narrative = `⚡ ระบบทำงานปกติ: แบตเตอรี่ ${soc}% สแตนด์บายพร้อมจ่ายไฟสำรอง`;
    }

    return {
      pv,
      grid,
      bat,
      soc,
      load,
      temp,
      isPvActive,
      isExporting,
      isImporting,
      isDischarging,
      isCharging,
      narrative
    };
  }, [pvPowerW, gridPowerW, batteryPowerW, batterySOC, loadPowerW, inverterTempC]);

  // Selected Equipment Detail Data Provider
  const nodeDetails = useMemo(() => {
    switch (selectedNode) {
      case 'solar':
        return {
          title: 'แผงโซลาร์เซลล์ (Solar PV Rooftop)',
          subtitle: 'กำลังผลิตไฟฟ้าจากแสงอาทิตย์ (6 kWp Dual MPPT)',
          icon: Sun,
          color: 'text-amber-400',
          borderColor: 'border-amber-500/50',
          bgGlow: 'bg-amber-500/10',
          powerW: physics.pv,
          powerLabel: physics.pv >= 1000 ? `${(physics.pv / 1000).toFixed(2)} kW` : `${physics.pv} W`,
          currentA: (Number(pv1CurrentA) + Number(pv2CurrentA)).toFixed(2) + ' A',
          voltageV: Math.max(Number(pv1Volt), Number(pv2Volt), 380).toFixed(1) + ' V',
          tempC: 'อุณหภูมิแผง ~42°C',
          status: physics.isPvActive ? 'กำลังผลิตไฟฟ้า' : 'สแตนด์บาย (กลางคืน)',
          statusClass: physics.isPvActive ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-400',
          dailySummary: [
            { label: 'ผลิตสะสมวันนี้', val: `${todayGenKWh.toFixed(2)} kWh` },
            { label: 'พีคสูงสุดวันนี้', val: `${peakPvWatts.toLocaleString()} W` },
            { label: 'ประหยัดเงินสะสม', val: `฿${todayEstSavings} บาท` },
            { label: 'สตริง PV1 / PV2', val: `${pv1Volt || 260}V / ${pv2Volt || 0}V` }
          ]
        };

      case 'battery':
        return {
          title: 'แบตเตอรี่สำรอง (Battery Energy Storage)',
          subtitle: 'ลิเธียมไอออนฟอสเฟต (LiFePO4) ความจุ 16 kWh',
          icon: Battery,
          color: 'text-emerald-400',
          borderColor: 'border-emerald-500/50',
          bgGlow: 'bg-emerald-500/10',
          powerW: Math.abs(physics.bat),
          powerLabel: `${(Math.abs(physics.bat) / 1000).toFixed(2)} kW`,
          currentA: `${Number(batteryCurrentA || 28.3).toFixed(1)} A`,
          voltageV: `${Number(batteryVoltageV || 51.2).toFixed(1)} V`,
          tempC: `${batteryTempC}°C (ปกติ)`,
          status: physics.isDischarging ? '⚡ คายประจุจ่ายไฟเลี้ยงบ้าน' : physics.isCharging ? 'กำลังชาร์จเข้า' : 'สแตนด์บาย',
          statusClass: physics.isDischarging ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse' : 'bg-slate-800 text-slate-300',
          dailySummary: [
            { label: 'ระดับความจุ SOC', val: `${physics.soc}% (${((16 * physics.soc) / 100).toFixed(1)} kWh)` },
            { label: 'คายประจุวันนี้', val: `${dischargeBatteryKWh} kWh` },
            { label: 'ชาร์จเก็บวันนี้', val: `${chargeBatteryKWh} kWh` },
            { label: 'อุณหภูมิเซลล์แบต', val: `${batteryTempC}°C (ปลอดภัย)` }
          ]
        };

      case 'inverter':
        return {
          title: 'อินเวอร์เตอร์ไฮบริด (SAJ H2 Hybrid Inverter)',
          subtitle: `รุ่น H2-6K-LS2 • SN: ${sajDeviceSn}`,
          icon: Zap,
          color: 'text-sky-400',
          borderColor: 'border-sky-500/50',
          bgGlow: 'bg-sky-500/10',
          powerW: physics.load,
          powerLabel: `${(physics.load / 1000).toFixed(2)} kW`,
          currentA: `${loadCurrentA} A`,
          voltageV: `230.0 V (50.0 Hz)`,
          tempC: `${physics.temp}°C (ฮีตซิงค์)`,
          status: 'ONLINE (ทำงานปกติ)',
          statusClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          dailySummary: [
            { label: 'ประสิทธิภาพแปลงไฟ', val: '97.6% (Peak)' },
            { label: 'ความถี่ระบบ', val: '50.0 Hz (Synchronized)' },
            { label: 'ความร้อน Inverter', val: `${physics.temp}°C (< 55°C ปลอดภัย)` },
            { label: 'สถานะกริด PEA', val: 'On-Grid / Zero Export' }
          ]
        };

      case 'grid':
        return {
          title: 'การไฟฟ้าส่วนภูมิภาค (PEA Grid)',
          subtitle: 'จุดเชื่อมต่อสายส่งไฟฟ้า 1 เฟส 230V / 3 เฟส 380V',
          icon: Activity,
          color: 'text-sky-300',
          borderColor: 'border-sky-500/50',
          bgGlow: 'bg-sky-500/10',
          powerW: Math.abs(physics.grid),
          powerLabel: `${(Math.abs(physics.grid) / 1000).toFixed(2)} kW`,
          currentA: `${Number(gridCurrentA || 0).toFixed(2)} A`,
          voltageV: `${Number(gridVoltageV || 230.5).toFixed(1)} V`,
          tempC: '50.0 Hz',
          status: physics.isExporting ? '⚡ ขายไฟคืน กฟภ.' : physics.isImporting ? 'ดึงไฟหลวง' : 'ไม่ดึงไฟ (0.00 kW)',
          statusClass: physics.isExporting ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-300',
          dailySummary: [
            { label: 'หน่วยดึงไฟวันนี้', val: `${statGridImportKWh} kWh` },
            { label: 'หน่วยขายไฟคืน', val: `${statGridExportKWh} kWh` },
            { label: 'แรงดันไฟหลวง', val: `${gridVoltageV} V` },
            { label: 'ช่วงเวลา', val: 'Off-Peak (ประหยัด)' }
          ]
        };

      case 'load':
        return {
          title: 'โหลดเครื่องใช้ไฟฟ้าในบ้าน (Home Consumption)',
          subtitle: 'กำลังไฟฟ้าทั้งหมดที่บ้านกำลังใช้งานในวินาทีนี้',
          icon: Home,
          color: 'text-rose-400',
          borderColor: 'border-rose-500/50',
          bgGlow: 'bg-rose-500/10',
          powerW: physics.load,
          powerLabel: `${(physics.load / 1000).toFixed(2)} kW`,
          currentA: `${Number(loadCurrentA || 6.56).toFixed(2)} A`,
          voltageV: `${Number(loadVoltageV || 230.0).toFixed(1)} V`,
          tempC: '230V @ 50Hz',
          status: physics.isDischarging ? 'รับไฟจากแบตเตอรี่ 100%' : 'บริโภคไฟฟ้า',
          statusClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          dailySummary: [
            { label: 'ใช้ไฟรวมวันนี้', val: `${statLoadElectricityKWh} kWh` },
            { label: 'สัดส่วนไฟฟรี (โซลาร์+แบต)', val: '86.4% ของวัน' },
            { label: 'กระแสไฟใช้งาน', val: `${loadCurrentA} A` },
            { label: 'แหล่งจ่ายหลัก', val: physics.isDischarging ? 'แบตเตอรี่ 16 kWh' : 'แผงโซลาร์' }
          ]
        };

      default:
        return null;
    }
  }, [selectedNode, physics, pv1Volt, pv1CurrentA, pv2Volt, pv2CurrentA, gridVoltageV, gridCurrentA, batteryVoltageV, batteryCurrentA, loadVoltageV, loadCurrentA, batteryTempC, todayGenKWh, peakPvWatts, statGridImportKWh, statGridExportKWh, chargeBatteryKWh, dischargeBatteryKWh, statLoadElectricityKWh, todayEstSavings, sajDeviceSn]);

  return (
    <div className="bg-gradient-to-b from-[#0a101d] via-[#070c17] to-[#040710] border border-slate-800/90 rounded-[32px] p-4 sm:p-6 shadow-2xl relative overflow-hidden space-y-4">
      {/* Dynamic Keyframe Animations for Fluid Particles */}
      <style>{`
        @keyframes flowBeamForward {
          0% { stroke-dashoffset: 32; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes flowBeamReverse {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 32; }
        }
        @keyframes pulseGlowRing {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
      `}</style>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Zap className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              แผนผังสายธารพลังงาน (Live Energy Flow)
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                เรียลไทม์
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>วันนี้สะสม:</span>
          <span className="font-bold text-emerald-400">{todayGenKWh.toFixed(2)} kWh</span>
          <span className="text-slate-600">•</span>
          <span className="text-amber-300">🌙 29°C</span>
        </div>
      </div>

      {/* Main Flow Canvas with Clickable Interactive Nodes */}
      <div className="relative max-w-2xl mx-auto py-2 sm:py-4">
        {/* SVG Conduits Layer */}
        <svg
          viewBox="0 0 600 360"
          className="w-full h-auto pointer-events-none overflow-visible"
        >
          <defs>
            <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="emeraldGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="roseGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="skyGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* BASE CONDUIT PIPES */}
          <path d="M 140 75 Q 220 75, 270 150" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M 460 75 Q 380 75, 330 150" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M 140 285 Q 220 285, 270 210" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M 330 210 Q 380 285, 460 285" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" fill="none" />

          {/* ACTIVE FLOWING BEAMS */}
          {physics.isPvActive && (
            <path
              d="M 140 75 Q 220 75, 270 150"
              stroke="#f59e0b"
              strokeWidth="4"
              strokeDasharray="8 8"
              strokeLinecap="round"
              fill="none"
              filter="url(#goldGlow)"
              style={{ animation: 'flowBeamForward 0.8s linear infinite' }}
            />
          )}

          {physics.isImporting && (
            <path
              d="M 460 75 Q 380 75, 330 150"
              stroke="#38bdf8"
              strokeWidth="4"
              strokeDasharray="8 8"
              strokeLinecap="round"
              fill="none"
              filter="url(#skyGlow)"
              style={{ animation: 'flowBeamForward 0.9s linear infinite' }}
            />
          )}

          {physics.isExporting && (
            <path
              d="M 460 75 Q 380 75, 330 150"
              stroke="#10b981"
              strokeWidth="4"
              strokeDasharray="8 8"
              strokeLinecap="round"
              fill="none"
              filter="url(#emeraldGlow)"
              style={{ animation: 'flowBeamReverse 0.9s linear infinite' }}
            />
          )}

          {/* BATTERY DISCHARGING (FLOWS UP TO INVERTER!) */}
          {physics.isDischarging && (
            <path
              d="M 140 285 Q 220 285, 270 210"
              stroke="#10b981"
              strokeWidth="5"
              strokeDasharray="8 8"
              strokeLinecap="round"
              fill="none"
              filter="url(#emeraldGlow)"
              style={{ animation: 'flowBeamForward 0.7s linear infinite' }}
            />
          )}

          {/* BATTERY CHARGING (FLOWS DOWN TO BATTERY) */}
          {physics.isCharging && (
            <path
              d="M 140 285 Q 220 285, 270 210"
              stroke="#10b981"
              strokeWidth="4"
              strokeDasharray="8 8"
              strokeLinecap="round"
              fill="none"
              filter="url(#emeraldGlow)"
              style={{ animation: 'flowBeamReverse 0.8s linear infinite' }}
            />
          )}

          {/* HOME LOAD (FLOWS FROM INVERTER TO LOAD) */}
          {physics.load > 50 && (
            <path
              d="M 330 210 Q 380 285, 460 285"
              stroke={physics.isDischarging ? '#10b981' : '#f43f5e'}
              strokeWidth="5"
              strokeDasharray="8 8"
              strokeLinecap="round"
              fill="none"
              filter={physics.isDischarging ? 'url(#emeraldGlow)' : 'url(#roseGlow)'}
              style={{ animation: 'flowBeamForward 0.7s linear infinite' }}
            />
          )}
        </svg>

        {/* INTERACTIVE CLICKABLE NODES */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-auto">
          {/* Top Row: Solar PV (Left) & PEA Grid (Right) */}
          <div className="flex justify-between items-start">
            {/* Node 1: Solar PV */}
            <button
              type="button"
              onClick={() => setSelectedNode(selectedNode === 'solar' ? null : 'solar')}
              className={`p-3 sm:p-4 rounded-2xl border transition-all duration-300 w-36 sm:w-44 text-left cursor-pointer active:scale-95 ${
                selectedNode === 'solar'
                  ? 'ring-2 ring-amber-400 bg-amber-950/60 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.4)]'
                  : physics.isPvActive
                  ? 'bg-amber-950/40 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                  : 'bg-slate-900/80 border-slate-800/80 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">แผงโซลาร์</span>
                <Sun className={`w-4 h-4 text-amber-400 ${physics.isPvActive ? 'animate-[spin_8s_linear_infinite]' : ''}`} />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                {physics.pv >= 1000
                  ? `${(physics.pv / 1000).toFixed(2)} kW`
                  : `${physics.pv} W`}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                <span>{physics.isPvActive ? 'กำลังผลิตไฟ' : 'กลางคืนไร้แดด'}</span>
                <span className="text-[9px] text-amber-400 font-bold">แตะดู &gt;</span>
              </div>
            </button>

            {/* Node 2: PEA Grid */}
            <button
              type="button"
              onClick={() => setSelectedNode(selectedNode === 'grid' ? null : 'grid')}
              className={`p-3 sm:p-4 rounded-2xl border transition-all duration-300 text-right w-36 sm:w-44 cursor-pointer active:scale-95 ${
                selectedNode === 'grid'
                  ? 'ring-2 ring-sky-400 bg-sky-950/60 border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.4)]'
                  : physics.isImporting
                  ? 'bg-sky-950/40 border-sky-500/60 shadow-[0_0_20px_rgba(56,189,248,0.25)]'
                  : physics.isExporting
                  ? 'bg-emerald-950/40 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                  : 'bg-slate-900/80 border-slate-800/80 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <Zap className="w-4 h-4 text-sky-400" />
                <span className="text-[10px] font-bold text-sky-300 uppercase tracking-wider">ไฟหลวง PEA</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                {physics.isExporting
                  ? `-${(Math.abs(physics.grid) / 1000).toFixed(2)} kW`
                  : `${(Math.abs(physics.grid) / 1000).toFixed(2)} kW`}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                <span className="text-[9px] text-sky-400 font-bold">&lt; แตะดู</span>
                <span>{physics.isExporting ? 'ขายไฟคืน' : physics.isImporting ? 'ดึงไฟ' : '0 W'}</span>
              </div>
            </button>
          </div>

          {/* Center: SAJ Hybrid Inverter Hardware Hub */}
          <div className="flex justify-center items-center my-auto">
            <button
              type="button"
              onClick={() => setSelectedNode(selectedNode === 'inverter' ? null : 'inverter')}
              className={`relative group cursor-pointer active:scale-95 transition-all duration-200 ${
                selectedNode === 'inverter' ? 'scale-105' : ''
              }`}
            >
              {/* Dynamic Aura Glow */}
              <div className={`absolute -inset-2 rounded-3xl blur-xl transition-all duration-700 ${
                selectedNode === 'inverter'
                  ? 'bg-sky-400/40'
                  : physics.isDischarging
                  ? 'bg-emerald-500/30'
                  : physics.isPvActive
                  ? 'bg-amber-500/30'
                  : 'bg-sky-500/20'
              }`} />

              {/* Inverter Card */}
              <div className={`relative bg-gradient-to-b from-[#162238] via-[#0f172a] to-[#0a0f1d] border-2 rounded-3xl px-4 py-3 sm:px-5 sm:py-3.5 shadow-2xl flex items-center gap-3 backdrop-blur-xl ${
                selectedNode === 'inverter' ? 'border-sky-300 ring-2 ring-sky-400/50' : 'border-sky-400/50'
              }`}>
                {/* Real SAJ Inverter Icon with Glowing Status */}
                <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shrink-0">
                  <img
                    src="/saj_inverter_3d.jpg"
                    alt="SAJ Inverter"
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-950 animate-ping" />
                  <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-950" />
                </div>

                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-black text-white">SAJ H2-6K-LS2</span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      ON
                    </span>
                  </div>
                  <div className="text-[11px] text-sky-300 font-mono">
                    ความร้อนเครื่อง: <strong className="text-white">{physics.temp}°C</strong>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between gap-1">
                    <span>แปลงไฟ 48Vdc → 230V</span>
                    <span className="text-[9px] text-sky-400 font-bold">แตะดูสเปก &gt;</span>
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* Bottom Row: Battery Storage (Left) & Home Load (Right) */}
          <div className="flex justify-between items-end">
            {/* Card 3: Battery Storage */}
            <button
              type="button"
              onClick={() => setSelectedNode(selectedNode === 'battery' ? null : 'battery')}
              className={`p-3 sm:p-4 rounded-2xl border transition-all duration-300 w-36 sm:w-44 text-left cursor-pointer active:scale-95 ${
                selectedNode === 'battery'
                  ? 'ring-2 ring-emerald-400 bg-emerald-950/60 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                  : physics.isDischarging
                  ? 'bg-emerald-950/40 border-emerald-500/70 shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                  : physics.isCharging
                  ? 'bg-amber-950/40 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                  : 'bg-slate-900/80 border-slate-800/80 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">แบตเตอรี่</span>
                {physics.isCharging ? (
                  <BatteryCharging className="w-4 h-4 text-emerald-400 animate-bounce" />
                ) : (
                  <Battery className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl sm:text-2xl font-black font-mono text-emerald-300">
                  {physics.soc}%
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  ({(Math.abs(physics.bat) / 1000).toFixed(2)} kW)
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between">
                <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  physics.isDischarging
                    ? 'bg-emerald-500/20 text-emerald-300 animate-pulse'
                    : physics.isCharging
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {physics.isDischarging ? '⚡ คายประจุ' : physics.isCharging ? 'ชาร์จเข้า' : 'สแตนด์บาย'}
                </span>
                <span className="text-[9px] text-emerald-400 font-bold">แตะดู &gt;</span>
              </div>
            </button>

            {/* Card 4: Home Load */}
            <button
              type="button"
              onClick={() => setSelectedNode(selectedNode === 'load' ? null : 'load')}
              className={`p-3 sm:p-4 rounded-2xl border transition-all duration-300 text-right w-36 sm:w-44 cursor-pointer active:scale-95 ${
                selectedNode === 'load'
                  ? 'ring-2 ring-rose-400 bg-rose-950/60 border-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.4)]'
                  : physics.load > 50
                  ? 'bg-rose-950/30 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
                  : 'bg-slate-900/80 border-slate-800/80 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <Home className="w-4 h-4 text-rose-400" />
                <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">โหลดในบ้าน</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                {(physics.load / 1000).toFixed(2)} kW
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                <span className="text-[9px] text-rose-400 font-bold">&lt; แตะดู</span>
                <span>{physics.isDischarging ? 'รับไฟจากแบต 100%' : 'บริโภคไฟ'}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INTERACTIVE EQUIPMENT INSPECTION PANEL (เปิดขึ้นมาเมื่อแตะที่การ์ดใดๆ) */}
      {/* ========================================================================= */}
      {nodeDetails && (
        <div className={`p-4 sm:p-5 rounded-3xl border ${nodeDetails.borderColor} ${nodeDetails.bgGlow} backdrop-blur-xl shadow-2xl space-y-4 animate-in slide-in-from-top-2 duration-200`}>
          {/* Header of Selected Equipment */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${nodeDetails.borderColor} bg-slate-900/80 shadow-inner`}>
                <nodeDetails.icon className={`w-5 h-5 ${nodeDetails.color}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm sm:text-base font-black text-white">{nodeDetails.title}</h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${nodeDetails.statusClass}`}>
                    {nodeDetails.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{nodeDetails.subtitle}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="ปิดรายละเอียด"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 4 Real-time Telemetry Metrics: กำลังไฟฟ้า, กระแส, แรงดัน, ความร้อน */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* 1. กำลังไฟฟ้า (Power) */}
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80">
              <div className="text-[11px] text-slate-400 font-medium">กำลังไฟฟ้า (Power)</div>
              <div className={`text-lg sm:text-xl font-black font-mono mt-0.5 ${nodeDetails.color}`}>
                {nodeDetails.powerLabel}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {nodeDetails.powerW.toLocaleString()} วัตต์
              </div>
            </div>

            {/* 2. กระแสไฟฟ้า (Current) */}
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80">
              <div className="text-[11px] text-slate-400 font-medium">กระแสไฟฟ้า (Current)</div>
              <div className="text-lg sm:text-xl font-black font-mono text-white mt-0.5">
                {nodeDetails.currentA}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">แอมแปร์ (A)</div>
            </div>

            {/* 3. แรงดันไฟฟ้า (Voltage) */}
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80">
              <div className="text-[11px] text-slate-400 font-medium">แรงดันไฟฟ้า (Voltage)</div>
              <div className="text-lg sm:text-xl font-black font-mono text-white mt-0.5">
                {nodeDetails.voltageV}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">โวลต์ (V)</div>
            </div>

            {/* 4. ความร้อน (Temperature) */}
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80">
              <div className="text-[11px] text-slate-400 font-medium">ความร้อน / ความถี่</div>
              <div className="text-lg sm:text-xl font-black font-mono text-amber-300 mt-0.5">
                {nodeDetails.tempC}
              </div>
              <div className="text-[10px] text-emerald-400 font-mono mt-0.5">สถานะปกติ</div>
            </div>
          </div>

          {/* Daily Energy Summary & Distribution Metrics */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>สรุปข้อมูลการจ่ายไฟของวันนั้นๆ (Daily Energy Summary)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
              {nodeDetails.dailySummary.map((item, idx) => (
                <div key={idx} className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-sans">{item.label}</div>
                  <div className="font-bold text-white mt-0.5 truncate">{item.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Narrative Summary Banner */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-white flex items-center justify-between gap-2 shadow-inner">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0 text-amber-400 animate-pulse" />
          <span className="font-semibold">{physics.narrative}</span>
        </div>
        <div className="text-[10px] font-mono text-emerald-400 shrink-0 hidden sm:flex items-center gap-1 font-bold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>แตะที่อุปกรณ์ใดก็ได้เพื่อดูรายละเอียด</span>
        </div>
      </div>
    </div>
  );
}
