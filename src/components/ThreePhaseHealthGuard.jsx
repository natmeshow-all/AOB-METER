import React, { useMemo } from 'react';
import { ShieldCheck, AlertTriangle, Activity, Zap, CheckCircle2, Flame, HelpCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * ThreePhaseHealthGuard
 * Professional Power Quality & 3-Phase Unbalance Guardian + PEA PF Fine Watchdog.
 * Formulated to NEMA MG-1 and Provincial Electricity Authority (PEA) Tariffs.
 */
export function ThreePhaseHealthGuard({
  v12 = 382.4,
  v23 = 380.8,
  v31 = 381.9,
  i1 = 142.5,
  i2 = 138.2,
  i3 = 145.8,
  pf = 0.94,
  peakKW = 250,
  transformerKVA = 500
}) {
  const { t } = useLanguage();

  const metrics = useMemo(() => {
    // 1. Voltage Unbalance Rate (NEMA Standard)
    const vAvg = (v12 + v23 + v31) / 3 || 380;
    const maxVDev = Math.max(Math.abs(v12 - vAvg), Math.abs(v23 - vAvg), Math.abs(v31 - vAvg));
    const vUnbalancePct = Number(((maxVDev / vAvg) * 100).toFixed(2));

    // 2. Current Unbalance Rate
    const iAvg = (i1 + i2 + i3) / 3 || 1;
    const maxIDev = Math.max(Math.abs(i1 - iAvg), Math.abs(i2 - iAvg), Math.abs(i3 - iAvg));
    const iUnbalancePct = Number(((maxIDev / iAvg) * 100).toFixed(1));

    // 3. PEA Power Factor Penalty Watchdog
    // PEA Requirement: PF >= 0.85. Fine: 56.07 THB per excess kVAR above 0.6197 * Peak kW
    const isPfPenalized = pf < 0.85;
    let excessKVAR = 0;
    let estimatedPfFineTHB = 0;

    if (isPfPenalized && pf > 0.3) {
      const tanActual = Math.sqrt(1 - pf * pf) / pf;
      const tanAllowable = 0.6197; // tan(arccos(0.85))
      excessKVAR = Math.max(0, peakKW * (tanActual - tanAllowable));
      estimatedPfFineTHB = Math.round(excessKVAR * 56.07);
    }

    // Status classifications
    const vStatus = vUnbalancePct < 1.5 ? 'SAFE' : vUnbalancePct < 3.0 ? 'WARN' : 'DANGER';
    const iStatus = iUnbalancePct < 8.0 ? 'SAFE' : iUnbalancePct < 15.0 ? 'WARN' : 'DANGER';
    const pfStatus = pf >= 0.90 ? 'EXCELLENT' : pf >= 0.85 ? 'NORMAL' : 'PENALTY';

    return {
      vAvg: vAvg.toFixed(1),
      vUnbalancePct,
      vStatus,
      iAvg: iAvg.toFixed(1),
      iUnbalancePct,
      iStatus,
      isPfPenalized,
      excessKVAR: excessKVAR.toFixed(1),
      estimatedPfFineTHB,
      pfStatus
    };
  }, [v12, v23, v31, i1, i2, i3, pf, peakKW]);

  return (
    <div className="bg-gradient-to-br from-[#0c1424] via-[#080d1a] to-[#050811] border border-slate-800/80 rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden space-y-5">
      {/* Ambient glow accent */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-inner">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              3-Phase Health & Power Quality Guardian
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-950/70 text-sky-400 border border-sky-800/40">
                NEMA & PEA Audit
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              วิเคราะห์ความสมดุลไฟฟ้า 3 เฟส ป้องกันหม้อแปลงระเบิด & เฝ้าระวังค่าปรับ กฟภ.
            </p>
          </div>
        </div>

        {/* Global Health Badge */}
        <div className="flex items-center gap-2">
          {metrics.vStatus === 'SAFE' && metrics.iStatus === 'SAFE' && !metrics.isPfPenalized ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" /> คุณภาพไฟสมบูรณ์ 100%
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" /> ตรวจพบจุดที่ต้องปรับปรุง
            </span>
          )}
        </div>
      </div>

      {/* 3 Core Inspection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1: Voltage Unbalance */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/70 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Zap className="w-4 h-4 text-amber-400" /> สมดุลแรงดัน (Voltage)
            </span>
            <span className="text-[10px] font-mono text-slate-500">เกณฑ์: &lt; 2.0%</span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-black font-mono text-white tracking-tight">
              {metrics.vUnbalancePct}%
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                metrics.vStatus === 'SAFE'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : metrics.vStatus === 'WARN'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {metrics.vStatus === 'SAFE' ? 'สมดุลดีเยี่ยม' : metrics.vStatus === 'WARN' ? 'เตือน: โวลต์ต่างกัน' : 'อันตรายต่อมอเตอร์'}
            </span>
          </div>

          {/* Phase Line-to-Line values mini breakdown */}
          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-800/60 text-center font-mono text-[11px]">
            <div className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/40">
              <div className="text-[9px] text-slate-500">V12</div>
              <div className="font-bold text-slate-300">{v12} V</div>
            </div>
            <div className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/40">
              <div className="text-[9px] text-slate-500">V23</div>
              <div className="font-bold text-slate-300">{v23} V</div>
            </div>
            <div className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/40">
              <div className="text-[9px] text-slate-500">V31</div>
              <div className="font-bold text-slate-300">{v31} V</div>
            </div>
          </div>
        </div>

        {/* Card 2: Current Unbalance */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/70 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Activity className="w-4 h-4 text-sky-400" /> สมดุลกระแสโหลด (Current)
            </span>
            <span className="text-[10px] font-mono text-slate-500">เกณฑ์: &lt; 10%</span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-black font-mono text-white tracking-tight">
              {metrics.iUnbalancePct}%
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                metrics.iStatus === 'SAFE'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : metrics.iStatus === 'WARN'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {metrics.iStatus === 'SAFE' ? 'กระจายโหลดสม่ำเสมอ' : metrics.iStatus === 'WARN' ? 'โหลดเฟสเริ่มเอียง' : 'เสี่ยงสสายนิวทรัลไหม้'}
            </span>
          </div>

          {/* Phase Current values mini breakdown */}
          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-800/60 text-center font-mono text-[11px]">
            <div className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/40">
              <div className="text-[9px] text-slate-500">I_A</div>
              <div className="font-bold text-sky-300">{i1} A</div>
            </div>
            <div className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/40">
              <div className="text-[9px] text-slate-500">I_B</div>
              <div className="font-bold text-sky-300">{i2} A</div>
            </div>
            <div className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/40">
              <div className="text-[9px] text-slate-500">I_C</div>
              <div className="font-bold text-sky-300">{i3} A</div>
            </div>
          </div>
        </div>

        {/* Card 3: Power Factor & PEA Fine Watchdog */}
        <div
          className={`p-4 rounded-2xl border space-y-3 ${
            metrics.isPfPenalized
              ? 'bg-rose-950/30 border-rose-700/60'
              : 'bg-slate-900/70 border-slate-800/70'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Flame className="w-4 h-4 text-emerald-400" /> Power Factor (กฟภ.)
            </span>
            <span className="text-[10px] font-mono text-slate-500">เกณฑ์: &ge; 0.85</span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-black font-mono text-white tracking-tight">
              {pf.toFixed(2)}
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                !metrics.isPfPenalized
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/30 text-rose-300 border border-rose-500/50 animate-pulse'
              }`}
            >
              {!metrics.isPfPenalized ? 'ปลอดภัย ไม่มีค่าปรับ' : `โดนปรับ ~฿${metrics.estimatedPfFineTHB.toLocaleString()}/ด.`}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-800/60 text-xs text-slate-400 flex items-center justify-between">
            <span>{metrics.isPfPenalized ? `ส่วนเกิน kVAR:` : `ค่าปรับสะสม:`}</span>
            <span className="font-mono font-bold text-white">
              {metrics.isPfPenalized ? `${metrics.excessKVAR} kVAR` : '฿0.00 บาท'}
            </span>
          </div>
        </div>
      </div>

      {/* Advisory Note */}
      <div className="p-3 rounded-2xl bg-sky-950/30 border border-sky-800/40 text-xs text-slate-300 flex items-start gap-2.5">
        <HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>คำแนะนำวิศวกรไฟฟ้า:</strong> หาก Current Unbalance &gt; 10% ให้จัดสลับเบรกเกอร์เฟส A/B/C ใหม่ให้เท่าๆ กัน เพื่อยืดอายุหม้อแปลงและลดความร้อนสะสมในสายไฟ และหากค่า PF &lt; 0.85 ควรตรวจเช็ค Capacitor Bank เพื่อตัดค่าปรับ 56.07 บาท/kVAR
        </p>
      </div>
    </div>
  );
}
