import React, { useMemo } from 'react';
import { Gauge, AlertTriangle, TrendingDown, Clock, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * PeakDemandCeiling
 * Enterprise Peak Demand Limiter & Predictive Load-Shedding Advisor.
 * Helps commercial and industrial users avoid expensive PEA Demand Charges (132.93 THB/kW).
 */
export function PeakDemandCeiling({
  currentKW = 620,
  targetCeilingKW = 800,
  maxTransformerKW = 1280, // e.g. 1600 kVA * 0.8 PF
  monthlyPeakKW = 740,
  demandRateTHB = 132.93
}) {
  const { t } = useLanguage();

  // Determine current Thai time & On-Peak status (Mon-Fri 09:00-22:00)
  const isCurrentlyOnPeak = useMemo(() => {
    const now = new Date();
    const bkkTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const day = bkkTime.getDay(); // 0 is Sunday, 6 is Saturday
    const hour = bkkTime.getHours();
    return day >= 1 && day <= 5 && hour >= 9 && hour < 22;
  }, []);

  const metrics = useMemo(() => {
    const pctOfTarget = Number(((currentKW / targetCeilingKW) * 100).toFixed(1));
    const pctOfTransformer = Number(((currentKW / maxTransformerKW) * 100).toFixed(1));
    const remainingHeadroomKW = Math.max(0, targetCeilingKW - currentKW);

    // Potential savings if we cap monthly peak at target
    const avoidedPenaltyKW = Math.max(0, monthlyPeakKW - targetCeilingKW);
    const monthlySavedBaht = Math.round(avoidedPenaltyKW * demandRateTHB);

    let status = 'SAFE';
    if (pctOfTarget >= 95) status = 'CRITICAL';
    else if (pctOfTarget >= 85) status = 'WARNING';
    else if (pctOfTarget >= 75) status = 'ELEVATED';

    return {
      pctOfTarget,
      pctOfTransformer,
      remainingHeadroomKW: remainingHeadroomKW.toFixed(1),
      avoidedPenaltyKW: avoidedPenaltyKW.toFixed(1),
      monthlySavedBaht,
      status
    };
  }, [currentKW, targetCeilingKW, maxTransformerKW, monthlyPeakKW, demandRateTHB]);

  return (
    <div className="bg-gradient-to-br from-[#0d1527] via-[#090e1a] to-[#060a14] border border-slate-800/80 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-5 relative overflow-hidden">
      {/* Background glow when warning */}
      {metrics.status === 'CRITICAL' && (
        <div className="absolute inset-0 bg-rose-500/10 animate-pulse pointer-events-none" />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-inner ${
            metrics.status === 'CRITICAL'
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
              : metrics.status === 'WARNING'
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
          }`}>
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              หลอดแก้วคุมพีคดีมานด์ (Peak Demand Ceiling Guard)
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${
                isCurrentlyOnPeak
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {isCurrentlyOnPeak ? '⚡ ช่วง On-Peak (เฝ้าระวัง)' : '🌙 ช่วง Off-Peak (ค่าไฟถูก)'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              ควบคุมกำลังไฟฟ้าสูงสุดไม่ให้เกินเป้าหมาย เพื่อตัดค่า Peak Demand 132.93 ฿/kW ของ กฟภ.
            </p>
          </div>
        </div>

        {/* Status Alert Badge */}
        <div>
          {metrics.status === 'SAFE' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" /> อยู่ในเกณฑ์ปลอดภัย
            </span>
          )}
          {metrics.status === 'ELEVATED' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
              โหลด 75% เริ่มใกล้เพดาน
            </span>
          )}
          {metrics.status === 'WARNING' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" /> ใกล้ชนเป้าหมาย 85%
            </span>
          )}
          {metrics.status === 'CRITICAL' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-bounce">
              <ShieldAlert className="w-3.5 h-3.5" /> เกิน 95% เสี่ยงค่าไฟพุ่ง!
            </span>
          )}
        </div>
      </div>

      {/* Main Gauge Visualizer */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-3xl font-black font-mono text-white tracking-tight">
              {currentKW.toLocaleString()}
            </span>
            <span className="text-sm font-bold text-slate-400 ml-1.5">kW</span>
            <span className="text-xs text-slate-500 ml-2">
              (เป้าหมายเพดาน: {targetCeilingKW.toLocaleString()} kW)
            </span>
          </div>
          <div className="text-right">
            <span className="text-lg font-black font-mono text-white">
              {metrics.pctOfTarget}%
            </span>
            <span className="text-xs text-slate-400 ml-1">ของเพดาน</span>
          </div>
        </div>

        {/* Visual Tube / Progress Bar with color zones */}
        <div className="relative h-6 rounded-full bg-slate-900 border border-slate-700/60 p-0.5 overflow-hidden shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out relative ${
              metrics.status === 'CRITICAL'
                ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.5)]'
                : metrics.status === 'WARNING'
                ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                : 'bg-gradient-to-r from-sky-500 via-emerald-400 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
            }`}
            style={{ width: `${Math.min(100, metrics.pctOfTarget)}%` }}
          >
            {/* Gloss reflection line */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/20 rounded-full" />
          </div>
        </div>

        {/* Reference markers */}
        <div className="flex justify-between text-[10px] font-mono text-slate-500 px-1 pt-1">
          <span>0 kW</span>
          <span>75% (ปลอดภัย)</span>
          <span className="text-amber-400 font-bold">85% (จุดเตือน)</span>
          <span className="text-rose-400 font-bold">เพดาน {targetCeilingKW} kW</span>
        </div>
      </div>

      {/* 3 Metric Insight HUDs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/60">
          <div className="text-[11px] text-slate-400">เหลือช่องว่างเดินเครื่องเพิ่ม (Headroom)</div>
          <div className="text-xl font-black font-mono text-emerald-400 mt-1">
            +{metrics.remainingHeadroomKW} <span className="text-xs font-normal">kW</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">ก่อนชนเพดานที่ตั้งไว้</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/60">
          <div className="text-[11px] text-slate-400">พีคสูงสุดที่บันทึกได้ในเดือนนี้</div>
          <div className="text-xl font-black font-mono text-amber-300 mt-1">
            {monthlyPeakKW.toLocaleString()} <span className="text-xs font-normal">kW</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">คิดตามอัตรา กฟภ. 132.93 ฿/kW</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/60">
          <div className="text-[11px] text-slate-400">มูลค่าที่ประหยัดได้หากคุมพีคอยู่</div>
          <div className="text-xl font-black font-mono text-sky-400 mt-1">
            ~฿{(monthlyPeakKW * demandRateTHB).toLocaleString()} <span className="text-xs font-normal">/ด.</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">ลดต้นทุนค่าความต้องการพลังไฟฟ้า</div>
        </div>
      </div>

      {/* Actionable Advice Footer */}
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          {isCurrentlyOnPeak ? (
            <span>
              <strong>คำแนะนำสำหรับกะ On-Peak:</strong> หากโหลดแตะเกิน 85% แนะนำให้สลับรอบเครื่องจักรหนัก (เช่น เครื่องบด ชิลเลอร์ หรือหลีกเลี่ยงการชาร์จรถยกไฟฟ้า) ไปเดินเครื่องหลังเวลา <strong>22:00 น. (Off-Peak)</strong> เพื่อรักษาเพดาน Demand Charge ให้ต่ำที่สุด
            </span>
          ) : (
            <span>
              <strong>คำแนะนำช่วง Off-Peak (หลัง 22:00 น.):</strong> ไฟฟ้าช่วงนี้ราคาถูกสุด (~2.60 บาท/kWh) เหมาะสำหรับการเดินเครื่องจักรหนักเต็มกำลัง การเตรียมวัตถุดิบ และการชาร์จแบตเตอรี่สำรอง
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
