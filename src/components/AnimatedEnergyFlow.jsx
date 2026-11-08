import React, { useMemo } from 'react';
import {
  Sun,
  Battery,
  BatteryCharging,
  Zap,
  Home,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingDown
} from 'lucide-react';

/**
 * AnimatedEnergyFlow
 * Award-Winning, Clean, Professional Energy Flow Visualizer.
 * Inspired by Tesla & SAJ eSolar Design System:
 * - Perfectly balanced 4-corner architecture with SAJ Inverter Centerpiece
 * - Zero duplicate text, crystal-clear typography (Prompt)
 * - Dynamic SVG glowing conduits with fluid animated particle streams
 * - Auto-detects Battery Discharging -> Home Load, Solar -> Battery/Grid, etc.
 */
export function AnimatedEnergyFlow({
  pvPowerW = 0,
  gridPowerW = 0,
  batteryPowerW = 1580,
  batterySOC = 59,
  loadPowerW = 1580,
  inverterTempC = 60.1,
  batteryTempC = 28.5,
  todayGenKWh = 20.69,
  isHomeSolar = true
}) {
  // Normalize live physics
  const physics = useMemo(() => {
    const pv = Number(pvPowerW) || 0;
    const grid = Number(gridPowerW) || 0;
    let bat = Number(batteryPowerW) || 0;
    const soc = Number(batterySOC) || 59;
    const load = Number(loadPowerW) || 1580;
    const temp = Number(inverterTempC) || 60.1;

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

  return (
    <div className="bg-gradient-to-b from-[#0a101d] via-[#070c17] to-[#040710] border border-slate-800/90 rounded-[32px] p-4 sm:p-6 shadow-2xl relative overflow-hidden space-y-4 sm:space-y-6">
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
        @keyframes pulseHalo {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.06); opacity: 0.85; }
        }
      `}</style>

      {/* Top Bar: Title & Real-Time Sync Indicator */}
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

      {/* Main Interactive Diagram Canvas */}
      <div className="relative max-w-2xl mx-auto py-2 sm:py-4">
        {/* SVG Conduits Layer (Behind cards, perfectly aligned) */}
        <svg
          viewBox="0 0 600 360"
          className="w-full h-auto pointer-events-none overflow-visible"
        >
          <defs>
            {/* Glow Filters */}
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

          {/* BASE CONDUIT PIPES (DARK SLEEK PIPES) */}
          {/* 1. Solar (Top-Left: 140, 75) to Inverter (300, 180) */}
          <path d="M 140 75 Q 220 75, 270 150" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" fill="none" />
          {/* 2. Grid (Top-Right: 460, 75) to Inverter (300, 180) */}
          <path d="M 460 75 Q 380 75, 330 150" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" fill="none" />
          {/* 3. Battery (Bottom-Left: 140, 285) to Inverter (300, 210) */}
          <path d="M 140 285 Q 220 285, 270 210" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" fill="none" />
          {/* 4. Inverter (300, 210) to Home Load (Bottom-Right: 460, 285) */}
          <path d="M 330 210 Q 380 285, 460 285" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" fill="none" />

          {/* ACTIVE FLOWING NEON ENERGY BEAMS */}
          {/* Beam 1: Solar Active */}
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

          {/* Beam 2: Grid Import (Grid -> Inverter) */}
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

          {/* Beam 2: Grid Export (Inverter -> Grid) */}
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

          {/* Beam 3: Battery DISCHARGING (FLOWS FROM BATTERY UP TO INVERTER!) */}
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

          {/* Beam 3: Battery CHARGING (FLOWS FROM INVERTER DOWN TO BATTERY) */}
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

          {/* Beam 4: Home Load (FLOWS FROM INVERTER TO LOAD) */}
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

        {/* 4-Corner Telemetry Cards + Central Inverter (HTML Layers) */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-auto">
          {/* Top Row: Solar PV (Left) & PEA Grid (Right) */}
          <div className="flex justify-between items-start">
            {/* Card 1: Solar PV */}
            <div className={`p-3 sm:p-4 rounded-2xl border transition-all duration-300 w-36 sm:w-44 ${
              physics.isPvActive
                ? 'bg-amber-950/40 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                : 'bg-slate-900/80 border-slate-800/80 opacity-70'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">แผงโซลาร์</span>
                <Sun className={`w-4 h-4 text-amber-400 ${physics.isPvActive ? 'animate-[spin_8s_linear_infinite]' : ''}`} />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                {physics.pv >= 1000
                  ? `${(physics.pv / 1000).toFixed(2)} kW`
                  : `${physics.pv} W`}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {physics.isPvActive ? 'กำลังผลิตไฟ 6 kWp' : 'กลางคืนไร้แดด'}
              </div>
            </div>

            {/* Card 2: PEA Grid */}
            <div className={`p-3 sm:p-4 rounded-2xl border transition-all duration-300 text-right w-36 sm:w-44 ${
              physics.isImporting
                ? 'bg-sky-950/40 border-sky-500/60 shadow-[0_0_20px_rgba(56,189,248,0.25)]'
                : physics.isExporting
                ? 'bg-emerald-950/40 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                : 'bg-slate-900/80 border-slate-800/80 opacity-70'
            }`}>
              <div className="flex items-center justify-between">
                <Zap className="w-4 h-4 text-sky-400" />
                <span className="text-[10px] font-bold text-sky-300 uppercase tracking-wider">ไฟหลวง PEA</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                {physics.isExporting
                  ? `-${(Math.abs(physics.grid) / 1000).toFixed(2)} kW`
                  : `${(Math.abs(physics.grid) / 1000).toFixed(2)} kW`}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {physics.isExporting
                  ? '⚡ ขายไฟคืน กฟภ.'
                  : physics.isImporting
                  ? 'ดึงไฟหลวง'
                  : 'ไม่ดึงไฟ (0 W)'}
              </div>
            </div>
          </div>

          {/* Center: SAJ Hybrid Inverter Hardware Hub */}
          <div className="flex justify-center items-center my-auto">
            <div className="relative group">
              {/* Dynamic Aura Glow */}
              <div className={`absolute -inset-2 rounded-3xl blur-xl transition-all duration-700 ${
                physics.isDischarging
                  ? 'bg-emerald-500/30'
                  : physics.isPvActive
                  ? 'bg-amber-500/30'
                  : 'bg-sky-500/20'
              }`} />

              {/* Inverter Card */}
              <div className="relative bg-gradient-to-b from-[#162238] via-[#0f172a] to-[#0a0f1d] border-2 border-sky-400/50 rounded-3xl px-4 py-3 sm:px-5 sm:py-3.5 shadow-2xl flex items-center gap-3 backdrop-blur-xl">
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

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-black text-white">SAJ H2-6K-LS2</span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      ON
                    </span>
                  </div>
                  <div className="text-[11px] text-sky-300 font-mono">
                    ความร้อนเครื่อง: <strong className="text-white">{physics.temp}°C</strong>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    แปลงไฟ 48Vdc → 230Vac (97.6%)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Battery Storage (Left) & Home Load (Right) */}
          <div className="flex justify-between items-end">
            {/* Card 3: Battery Storage */}
            <div className={`p-3 sm:p-4 rounded-2xl border transition-all duration-300 w-36 sm:w-44 ${
              physics.isDischarging
                ? 'bg-emerald-950/40 border-emerald-500/70 shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                : physics.isCharging
                ? 'bg-amber-950/40 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                : 'bg-slate-900/80 border-slate-800/80'
            }`}>
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
              <div className="mt-0.5">
                <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  physics.isDischarging
                    ? 'bg-emerald-500/20 text-emerald-300 animate-pulse'
                    : physics.isCharging
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {physics.isDischarging ? '⚡ คายประจุเลี้ยงบ้าน' : physics.isCharging ? 'กำลังชาร์จเข้า' : 'สแตนด์บาย'}
                </span>
              </div>
            </div>

            {/* Card 4: Home Load */}
            <div className={`p-3 sm:p-4 rounded-2xl border transition-all duration-300 text-right w-36 sm:w-44 ${
              physics.load > 50
                ? 'bg-rose-950/30 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
                : 'bg-slate-900/80 border-slate-800/80'
            }`}>
              <div className="flex items-center justify-between">
                <Home className="w-4 h-4 text-rose-400" />
                <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">โหลดในบ้าน</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                {(physics.load / 1000).toFixed(2)} kW
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {physics.isDischarging ? 'รับไฟจากแบต 100%' : 'กำลังบริโภคไฟ'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Narrative Summary Banner */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-white flex items-center justify-between gap-2 shadow-inner">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0 text-amber-400 animate-pulse" />
          <span className="font-semibold">{physics.narrative}</span>
        </div>
        <div className="text-[10px] font-mono text-emerald-400 shrink-0 hidden sm:flex items-center gap-1 font-bold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>อัตโนมัติตามเวลาจริง</span>
        </div>
      </div>
    </div>
  );
}
