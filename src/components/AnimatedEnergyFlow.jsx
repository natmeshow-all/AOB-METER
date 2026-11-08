import React, { useState, useMemo } from 'react';
import {
  Sun,
  BatteryCharging,
  Battery,
  Zap,
  Home,
  Clock,
  Sparkles,
  ChevronRight,
  Thermometer,
  Layers,
  Activity,
  ShieldCheck
} from 'lucide-react';

/**
 * AnimatedEnergyFlow
 * Ultra-Realistic Live Energy Flow & 3D Hardware Digital Twin:
 * 1. 3D Smart Home View (Authentic SAJ eSolar 3D Isometric View with flowing neon conduits)
 * 2. 3D Inverter Hardware View (Authentic SAJ H2 Front View with floating sensor callout pins)
 * 3. Schematic Fluid Flow Diagram (With animated SVG directional energy particles)
 */
export function AnimatedEnergyFlow({
  pvPowerW = 0,
  gridPowerW = 0,
  batteryPowerW = 1840,
  batterySOC = 59,
  loadPowerW = 1900,
  inverterTempC = 60.1,
  batteryTempC = 28.5,
  todayGenKWh = 20.69,
  isHomeSolar = true
}) {
  // Visual Mode: '3d_home' | '3d_inverter' | 'schematic'
  const [viewMode, setViewMode] = useState('3d_home');

  // Scenario toggle: 'live' or manual preview
  const [selectedScenario, setSelectedScenario] = useState('live');

  // Compute effective power & directional physics
  const flowState = useMemo(() => {
    let pv = Number(pvPowerW) || 0;
    let grid = Number(gridPowerW) || 0;
    let bat = Number(batteryPowerW) || 0;
    let soc = Number(batterySOC) || 59;
    let load = Number(loadPowerW) || 1900;
    let temp = Number(inverterTempC) || 60.1;

    if (selectedScenario === 'night_battery') {
      pv = 0;
      grid = 0;
      load = 1580;
      bat = -1580; // Discharging to feed load
      soc = 59;
      temp = 60.1;
    } else if (selectedScenario === 'day_solar') {
      pv = 5400;
      load = 1800;
      bat = 2600; // Charging
      grid = -1000; // Exporting
      soc = 75;
      temp = 54.2;
    } else if (selectedScenario === 'night_grid') {
      pv = 0;
      bat = 0;
      soc = 20; // Cutoff
      grid = 1950; // Import from PEA
      load = 1950;
      temp = 48.0;
    } else {
      // LIVE MODE AUTO PHYSICS DETECTION:
      // When PV = 0 and Grid = 0, yet Load > 100W -> Battery MUST BE discharging to feed the house!
      if (pv < 80 && Math.abs(grid) < 80 && load > 100) {
        bat = -Math.abs(bat > 0 ? bat : load);
      }
    }

    const isPvActive = pv > 80;
    const isExportingGrid = grid < -80;
    const isImportingGrid = grid > 80;

    const isDischargingBat = bat < -50;
    const isChargingBat = bat > 50;
    const isBatActive = isDischargingBat || isChargingBat;
    const isLoadActive = load > 50;

    // Narrative Summary Generator
    let narrative = '';
    let narrativeTone = 'emerald';

    if (isDischargingBat && !isPvActive && !isImportingGrid) {
      narrative = `🔋 ไร้แดด: แบตเตอรี่คายประจุ ${(Math.abs(bat) / 1000).toFixed(2)} kW จ่ายตรงเลี้ยงบ้าน 100% (ค่าไฟ ฿0 บาท/ชม.)`;
      narrativeTone = 'emerald';
    } else if (isPvActive && isChargingBat && isExportingGrid) {
      narrative = `☀️ แดดจัด: โซลาร์ผลิต ${(pv / 1000).toFixed(2)} kW → เลี้ยงบ้าน + ชาร์จแบตเตอรี่ + ขายไฟคืน กฟภ. ${(Math.abs(grid) / 1000).toFixed(2)} kW`;
      narrativeTone = 'amber';
    } else if (isPvActive && isChargingBat) {
      narrative = `☀️ โซลาร์ผลิต ${(pv / 1000).toFixed(2)} kW จ่ายโหลดบ้าน ${(load / 1000).toFixed(2)} kW และชาร์จแบตเต็มที่`;
      narrativeTone = 'amber';
    } else if (isImportingGrid && isDischargingBat) {
      narrative = `⚡ โหลดบ้านสูง ${(load / 1000).toFixed(2)} kW: ดึงแบตเตอรี่ร่วมกับไฟหลวง PEA เพื่อเสถียรภาพสูงสุด`;
      narrativeTone = 'sky';
    } else if (isImportingGrid) {
      narrative = `🏢 แบตเตอรี่แตะจุดต่ำสุด: สลับดึงไฟหลวงจากการไฟฟ้า (PEA) ${(grid / 1000).toFixed(2)} kW เลี้ยงบ้าน`;
      narrativeTone = 'slate';
    } else {
      narrative = `⚡ ระบบทำงานปกติ: แบตเตอรี่ ${soc}% สแตนด์บายพร้อมจ่ายไฟสำรองตลอด 24 ชม.`;
      narrativeTone = 'emerald';
    }

    return {
      pv,
      grid,
      bat,
      soc,
      load,
      temp,
      isPvActive,
      isExportingGrid,
      isImportingGrid,
      isDischargingBat,
      isChargingBat,
      isBatActive,
      isLoadActive,
      narrative,
      narrativeTone
    };
  }, [pvPowerW, gridPowerW, batteryPowerW, batterySOC, loadPowerW, inverterTempC, selectedScenario]);

  return (
    <div className="bg-gradient-to-b from-[#0b1220] via-[#070c17] to-[#040710] border border-slate-800/90 rounded-[32px] p-4 sm:p-6 shadow-2xl relative overflow-hidden space-y-4">
      {/* CSS Animations for Fluid Energy Streams */}
      <style>{`
        @keyframes flowBeamForward {
          0% { stroke-dashoffset: 32; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes flowBeamReverse {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 32; }
        }
        @keyframes pulseIndicatorDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
      `}</style>

      {/* Header with View Mode Switcher and Scenario Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-300">วันนี้</span>
            <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              ⚡ {todayGenKWh.toFixed(2)} kWh
            </span>
            <span className="text-[11px] text-slate-500">• อัปเดตสด 16 วินาทีที่แล้ว</span>
            <span className="text-[11px] text-amber-300/90 ml-auto md:ml-2">🌙 29°C</span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2 mt-0.5">
            ระบบจำลองสายธารพลังงานแบบมีชีวิต (Live Energy Flow)
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold">
              3D Digital Twin
            </span>
          </h3>
        </div>

        {/* View Mode Switcher Tabs */}
        <div className="flex items-center gap-1.5 self-start md:self-auto bg-slate-900/90 p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('3d_home')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === '3d_home'
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>3D บ้านอัจฉริยะ</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('3d_inverter')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === '3d_inverter'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>อินเวอร์เตอร์ SAJ H2</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('schematic')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'schematic'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>ผังท่อพลังงาน</span>
          </button>
        </div>
      </div>

      {/* Quick Scenario Pills for Testing & Client Demos */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[11px] text-slate-400 shrink-0 font-medium hidden sm:inline">
          จำลองทิศทางพลังงาน:
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
          {[
            { id: 'live', label: '🔴 ค่าสดจริงหน้างาน' },
            { id: 'night_battery', label: '🔋 กลางคืน: ดึงแบตจ่ายโหลดบ้าน' },
            { id: 'day_solar', label: '☀️ กลางวัน: โซลาร์ชาร์จแบต+ขายไฟ' },
            { id: 'night_grid', label: '⚡ ดึกมาก: แบตหมด ดึงไฟหลวง' }
          ].map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => setSelectedScenario(sc.id)}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedScenario === sc.id
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: AUTHENTIC 3D ISOMETRIC SMART HOME VIEW (ตามรูปที่ 2 ของ SAJ eSolar) */}
      {/* ========================================================================= */}
      {viewMode === '3d_home' && (
        <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-[#070c17] shadow-inner">
          {/* Authentic 3D Isometric Home Scene Image */}
          <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] max-h-[460px] flex items-center justify-center overflow-hidden">
            <img
              src="/saj_house_3d.jpg"
              alt="SAJ eSolar 3D Smart Home"
              className="w-full h-full object-cover sm:object-contain object-center transition-transform duration-700 hover:scale-102"
              onError={(e) => {
                // Graceful fallback if image is missing
                e.target.style.display = 'none';
              }}
            />

            {/* Ambient Dark-Vignette Overlay for Clean Contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#040710]/90 via-transparent to-black/40 pointer-events-none" />

            {/* LIVE DYNAMIC CALLOUT LABELS ON TOP OF 3D HOUSE */}

            {/* Callout 1: การไฟฟ้า (PEA Grid) - Left Column */}
            <div className="absolute top-4 left-3 sm:top-6 sm:left-6 text-left animate-in fade-in duration-300">
              <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                {flowState.isExportingGrid
                  ? `-${(Math.abs(flowState.grid) / 1000).toFixed(2)} kW`
                  : `${(Math.abs(flowState.grid) / 1000).toFixed(2)} kW`}
              </div>
              <div className="text-xs font-bold text-slate-300 flex items-center gap-1">
                การไฟฟ้า
                {flowState.isExportingGrid ? (
                  <span className="text-[10px] text-emerald-400 font-normal">(ขายไฟคืน)</span>
                ) : flowState.isImportingGrid ? (
                  <span className="text-[10px] text-sky-400 font-normal">(ดึงไฟ)</span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-normal">(0 W)</span>
                )}
              </div>
              {/* Leader guide line pointing to power pole */}
              <div className="w-0.5 h-16 sm:h-24 bg-gradient-to-b from-sky-400/80 to-transparent ml-2 mt-1 hidden sm:block" />
            </div>

            {/* Callout 2: โซลาร์เซลล์ (PV 6 kWp) - Top Center */}
            <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 text-center animate-in fade-in duration-300">
              <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                {flowState.pv >= 1000
                  ? `${(flowState.pv / 1000).toFixed(2)} kW`
                  : `${flowState.pv} W`}
              </div>
              <div className="text-xs font-bold text-amber-300 flex items-center justify-center gap-1">
                <span>6 kWp PV</span>
                {flowState.isPvActive && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </div>
              {/* Leader line pointing down to roof panels */}
              <div className="w-0.5 h-12 sm:h-16 bg-gradient-to-b from-amber-400/80 to-transparent mx-auto mt-1 hidden sm:block" />
            </div>

            {/* Callout 3: โหลดในบ้าน (Home Load) - Top Right */}
            <div className="absolute top-4 right-3 sm:top-6 sm:right-6 text-right animate-in fade-in duration-300">
              <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                {(flowState.load / 1000).toFixed(2)} kW
              </div>
              <div className="text-xs font-bold text-rose-300 flex items-center justify-end gap-1">
                <span>โหลดในบ้าน</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
              {/* Leader line pointing down to home living space */}
              <div className="w-0.5 h-16 sm:h-24 bg-gradient-to-b from-rose-400/80 to-transparent ml-auto mr-2 mt-1 hidden sm:block" />
            </div>

            {/* Callout 4: แบตเตอรี่สำรอง (Battery & Inverter H2) - Bottom Left */}
            <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-12 text-left bg-slate-950/80 backdrop-blur-md p-3 rounded-2xl border border-slate-800/80 shadow-2xl animate-in slide-in-from-bottom duration-300">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                  {flowState.soc}%
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  flowState.isDischargingBat
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
                    : flowState.isChargingBat
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {flowState.isDischargingBat
                    ? 'การคายประจุ'
                    : flowState.isChargingBat
                    ? 'การชาร์จเข้า'
                    : 'สแตนด์บาย'}
                </span>
              </div>

              <div className="text-sm font-black font-mono text-white mt-0.5">
                {(Math.abs(flowState.bat) / 1000).toFixed(2)} kW
              </div>
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                <span>SAJ H2 Series</span>
                <ChevronRight className="w-3 h-3 text-slate-500" />
              </div>
            </div>

            {/* ANIMATED FLUID PULSE BEAMS OVERLAY (DYNAMIC ENERGY FLOWING FROM BATTERY TO HOME) */}
            <svg
              viewBox="0 0 600 400"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {/* Dynamic Path 1: From Battery/Inverter -> Into the Home Living Room */}
              {flowState.isDischargingBat && (
                <path
                  d="M 230 260 L 360 260 L 440 240"
                  stroke="#10b981"
                  strokeWidth="5"
                  strokeDasharray="10 10"
                  strokeLinecap="round"
                  fill="none"
                  style={{ animation: 'flowBeamForward 0.7s linear infinite' }}
                  filter="drop-shadow(0 0 8px #10b981)"
                />
              )}

              {/* Dynamic Path 2: Solar Roof -> Into Inverter */}
              {flowState.isPvActive && (
                <path
                  d="M 270 160 L 230 220"
                  stroke="#f59e0b"
                  strokeWidth="4"
                  strokeDasharray="8 8"
                  strokeLinecap="round"
                  fill="none"
                  style={{ animation: 'flowBeamForward 0.8s linear infinite' }}
                  filter="drop-shadow(0 0 6px #f59e0b)"
                />
              )}

              {/* Dynamic Path 3: Power Pole -> Into Inverter */}
              {flowState.isImportingGrid && (
                <path
                  d="M 60 240 L 220 250"
                  stroke="#38bdf8"
                  strokeWidth="4"
                  strokeDasharray="8 8"
                  strokeLinecap="round"
                  fill="none"
                  style={{ animation: 'flowBeamForward 0.9s linear infinite' }}
                  filter="drop-shadow(0 0 6px #38bdf8)"
                />
              )}
            </svg>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: AUTHENTIC 3D HARDWARE INVERTER VIEW (ตามรูปที่ 1 ของ SAJ H2 Inverter) */}
      {/* ========================================================================= */}
      {viewMode === '3d_inverter' && (
        <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-[#060a14] p-4 sm:p-8 flex flex-col items-center justify-center min-h-[420px]">
          {/* Ambient center spotlight */}
          <div className="absolute w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 w-full max-w-lg flex flex-col items-center">
            {/* INVERTER HARDWARE CHASSIS RENDER */}
            <div className="relative w-52 sm:w-64 aspect-[3/4] flex items-center justify-center">
              <img
                src="/saj_inverter_3d.jpg"
                alt="SAJ H2 Inverter 3D Hardware"
                className="w-full h-full object-contain filter drop-shadow-[0_20px_35px_rgba(0,0,0,0.8)] transition-transform duration-500 hover:scale-105"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />

              {/* LED Ring Ping on Center Display */}
              <span className="absolute top-[37%] left-[49.5%] -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-emerald-400 opacity-75 animate-ping pointer-events-none" />

              {/* Sensor Pin 1 (Top Left): Inverter Temperature & Production */}
              <div className="absolute -left-20 sm:-left-36 top-10 sm:top-14 text-right">
                <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-3 rounded-2xl shadow-2xl text-left w-36 sm:w-44">
                  <div className="text-[11px] text-slate-400 font-semibold">การผลิตไฟฟ้า</div>
                  <div className="text-base sm:text-lg font-black font-mono text-white">
                    {flowState.pv >= 1000
                      ? `${(flowState.pv / 1000).toFixed(2)} kW`
                      : `${flowState.pv} W`}
                  </div>
                  <div className="text-[11px] text-slate-400 font-semibold mt-1">อุณหภูมิอินเวอร์เตอร์</div>
                  <div className="text-sm sm:text-base font-black font-mono text-emerald-400">
                    {flowState.temp}°C
                  </div>
                </div>
                {/* Pointer Line */}
                <div className="absolute right-[-18px] top-7 w-5 h-0.5 bg-emerald-400 shadow-[0_0_8px_#10b981]" />
                <div className="absolute right-[-22px] top-6 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-950 animate-pulse" />
              </div>

              {/* Sensor Pin 2 (Bottom Right): Battery Discharge Status & SOC */}
              <div className="absolute -right-20 sm:-right-36 bottom-10 sm:bottom-16 text-left">
                {/* Pointer Line */}
                <div className="absolute left-[-22px] top-6 w-2.5 h-2.5 rounded-full bg-cyan-400 border border-slate-950 animate-pulse" />
                <div className="absolute left-[-18px] top-7 w-5 h-0.5 bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />

                <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-3 rounded-2xl shadow-2xl text-left w-36 sm:w-44">
                  <div className="text-[11px] text-slate-400 font-semibold">แบตเตอรี่</div>
                  <div className="text-xs sm:text-sm font-bold text-cyan-300">
                    {flowState.isDischargingBat
                      ? 'ในการปลดปล่อย'
                      : flowState.isChargingBat
                      ? 'ในการชาร์จเข้า'
                      : 'สแตนด์บาย'}
                  </div>
                  <div className="text-sm sm:text-base font-black font-mono text-white mt-1">
                    SOC {flowState.soc.toFixed(1)}%
                  </div>
                  <div className="text-[10px] font-mono text-emerald-400 mt-0.5">
                    กำลังจ่าย: {(Math.abs(flowState.bat) / 1000).toFixed(2)} kW
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: SCHEMATIC FLUID CONDUITS VIEW (แผนผังท่อทางเดินพลังงานแบบเรืองแสง) */}
      {/* ========================================================================= */}
      {viewMode === 'schematic' && (
        <div className="relative max-w-xl mx-auto py-2">
          <svg viewBox="0 0 540 360" className="w-full h-auto pointer-events-none overflow-visible">
            {/* Base pipes */}
            <path d="M 120 85 L 220 170" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M 420 85 L 320 170" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M 120 275 L 220 190" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M 320 190 L 420 275" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" fill="none" />

            {/* Active flowing beams */}
            {flowState.isPvActive && (
              <path
                d="M 120 85 L 220 170"
                stroke="#f59e0b"
                strokeWidth="4"
                strokeDasharray="8 8"
                strokeLinecap="round"
                fill="none"
                style={{ animation: 'flowBeamForward 0.8s linear infinite' }}
              />
            )}
            {flowState.isDischargingBat && (
              <path
                d="M 120 275 L 220 190"
                stroke="#10b981"
                strokeWidth="5"
                strokeDasharray="8 8"
                strokeLinecap="round"
                fill="none"
                style={{ animation: 'flowBeamForward 0.7s linear infinite' }}
              />
            )}
            {flowState.isLoadActive && (
              <path
                d="M 320 190 L 420 275"
                stroke="#f43f5e"
                strokeWidth="5"
                strokeDasharray="8 8"
                strokeLinecap="round"
                fill="none"
                style={{ animation: 'flowBeamForward 0.8s linear infinite' }}
              />
            )}
          </svg>

          {/* Node Cards */}
          <div className="absolute inset-0 flex flex-col justify-between p-1 sm:p-2">
            <div className="flex justify-between items-start">
              <div className="flex flex-col items-center w-28 sm:w-32">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-500/20 border-2 border-amber-500/60 flex flex-col items-center justify-center text-amber-400">
                  <Sun className="w-7 h-7" />
                  <span className="text-[10px] font-bold mt-1 text-amber-200">โซลาร์ PV</span>
                </div>
                <span className="text-sm font-black font-mono text-amber-300 mt-1">
                  {(flowState.pv / 1000).toFixed(2)} kW
                </span>
              </div>

              <div className="flex flex-col items-center w-28 sm:w-32">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-sky-500/20 border-2 border-sky-500/60 flex flex-col items-center justify-center text-sky-400">
                  <Zap className="w-7 h-7" />
                  <span className="text-[10px] font-bold mt-1">ไฟหลวง PEA</span>
                </div>
                <span className="text-sm font-black font-mono text-sky-300 mt-1">
                  {(Math.abs(flowState.grid) / 1000).toFixed(2)} kW
                </span>
              </div>
            </div>

            {/* Inverter Center */}
            <div className="flex justify-center my-auto -mt-4">
              <div className="bg-slate-900 border-2 border-sky-400/50 rounded-2xl px-5 py-3 shadow-xl flex items-center gap-3">
                <img src="/inverter_real.jpg" alt="SAJ" className="w-12 h-12 rounded-xl object-cover" />
                <div>
                  <div className="text-xs font-bold text-white">SAJ H2-6K-LS2</div>
                  <div className="text-[10px] text-emerald-400 font-mono">ประสิทธิภาพ: 97.6%</div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-end pt-2">
              <div className="flex flex-col items-center w-28 sm:w-32">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/60 flex flex-col items-center justify-center text-emerald-400">
                  <Battery className="w-7 h-7" />
                  <span className="text-[10px] font-bold mt-1 text-emerald-200">
                    แบต {flowState.soc}%
                  </span>
                </div>
                <span className="text-sm font-black font-mono text-emerald-300 mt-1">
                  {(Math.abs(flowState.bat) / 1000).toFixed(2)} kW
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">
                  {flowState.isDischargingBat ? '⚡ จ่ายเลี้ยงบ้าน' : 'ชาร์จเข้า'}
                </span>
              </div>

              <div className="flex flex-col items-center w-28 sm:w-32">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-rose-500/20 border-2 border-rose-500/60 flex flex-col items-center justify-center text-rose-400">
                  <Home className="w-7 h-7" />
                  <span className="text-[10px] font-bold mt-1 text-rose-200">โหลดในบ้าน</span>
                </div>
                <span className="text-sm font-black font-mono text-rose-300 mt-1">
                  {(flowState.load / 1000).toFixed(2)} kW
                </span>
                <span className="text-[10px] text-slate-400">บริโภคไฟฟ้า</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Narrative Banner */}
      <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-2 shadow-inner ${
        flowState.narrativeTone === 'emerald'
          ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-200'
          : flowState.narrativeTone === 'amber'
          ? 'bg-amber-950/40 border-amber-600/40 text-amber-200'
          : 'bg-sky-950/40 border-sky-600/40 text-sky-200'
      }`}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0 text-amber-400 animate-pulse" />
          <span className="font-semibold">{flowState.narrative}</span>
        </div>
        <div className="text-[10px] font-mono text-slate-400 shrink-0 hidden sm:block">
          Auto Synchronized
        </div>
      </div>
    </div>
  );
}
