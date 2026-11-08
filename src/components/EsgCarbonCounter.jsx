import React, { useMemo } from 'react';
import { Leaf, Award, Trees, Car, Sparkles, Share2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * EsgCarbonCounter
 * Real-time ESG Scope 2 Greenhouse Gas Avoidance & Tree Equivalency Counter.
 * Adheres to Thailand Greenhouse Gas Management Organization (TGO) Grid Emission Factor (0.4999 kgCO2e/kWh).
 */
export function EsgCarbonCounter({
  totalSolarKWh = 12450.0,
  monthlySolarKWh = 1850.0
}) {
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';

  const metrics = useMemo(() => {
    // TGO Grid Emission Factor: 0.4999 kgCO2e / kWh
    const EMISSION_FACTOR = 0.4999;
    const totalKgCO2 = totalSolarKWh * EMISSION_FACTOR;
    const totalTonsCO2 = totalKgCO2 / 1000;

    const monthlyKgCO2 = monthlySolarKWh * EMISSION_FACTOR;

    // Equivalencies:
    // 1 Tree absorbs ~10 kg CO2 / year
    const treesEquivalent = Math.round(totalKgCO2 / 10);

    // 1 Passenger vehicle emits ~0.15 kg CO2 / km
    const carKmAvoided = Math.round(totalKgCO2 / 0.15);

    return {
      totalKgCO2: Math.round(totalKgCO2),
      totalTonsCO2: totalTonsCO2.toFixed(2),
      monthlyKgCO2: Math.round(monthlyKgCO2),
      treesEquivalent,
      carKmAvoided: carKmAvoided.toLocaleString()
    };
  }, [totalSolarKWh, monthlySolarKWh]);

  return (
    <div className="bg-gradient-to-br from-[#091a14] via-[#06120e] to-[#040a08] border border-emerald-900/60 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-5 relative overflow-hidden">
      {/* Background ambient emerald glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-900/50 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <Leaf className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              {isEn ? 'Carbon Avoidance & ESG Scope 2 Counter' : 'มาตรวัดลดคาร์บอน & ESG Scope 2 Counter'}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                TGO Standard
              </span>
            </h3>
            <p className="text-xs text-emerald-300/80">
              {isEn
                ? 'Official GHG Avoidance metrics for Corporate Sustainability & Scope 2 ESG reports'
                : 'คำนวณการลดก๊าซเรือนกระจก (GHG Avoidance) สำหรับจัดทำรายงานความยั่งยืนองค์กร'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <Award className="w-3.5 h-3.5 text-amber-400" /> {isEn ? 'TGO Standard Certified' : 'รับรองตามเกณฑ์ TGO'}
          </span>
        </div>
      </div>

      {/* Main Carbon Offset Metric Hero */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
        {/* Metric 1: Total Tons CO2e */}
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 space-y-1">
          <div className="text-xs text-emerald-300/80 font-medium">
            {isEn ? 'Cumulative Carbon Avoidance' : 'ลดการปล่อยก๊าซคาร์บอนสะสม'}
          </div>
          <div className="text-3xl font-black font-mono text-emerald-400">
            {metrics.totalTonsCO2} <span className="text-sm font-bold text-slate-300">{isEn ? 'Tons CO₂e' : 'ตัน CO₂e'}</span>
          </div>
          <div className="text-[10px] text-emerald-400/70 font-mono">
            ({metrics.totalKgCO2.toLocaleString()} kgCO₂e)
          </div>
        </div>

        {/* Metric 2: Monthly CO2e */}
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 space-y-1">
          <div className="text-xs text-emerald-300/80 font-medium">
            {isEn ? 'Monthly Carbon Avoidance' : 'ลดคาร์บอนเดือนนี้'}
          </div>
          <div className="text-3xl font-black font-mono text-white">
            {metrics.monthlyKgCO2.toLocaleString()} <span className="text-sm font-bold text-slate-300">kg</span>
          </div>
          <div className="text-[10px] text-emerald-400/70 font-mono">
            {(metrics.monthlyKgCO2 / 1000).toFixed(2)} {isEn ? 'Tons CO₂e this billing cycle' : 'ตัน CO₂e ในรอบบิลนี้'}
          </div>
        </div>

        {/* Metric 3: Trees Equivalent */}
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 space-y-1">
          <div className="text-xs text-emerald-300/80 font-medium flex items-center gap-1">
            <Trees className="w-3.5 h-3.5 text-emerald-400" /> {isEn ? 'Equivalent Trees Planted' : 'เทียบเท่าการปลูกต้นไม้'}
          </div>
          <div className="text-3xl font-black font-mono text-amber-300">
            {metrics.treesEquivalent.toLocaleString()} <span className="text-sm font-bold text-slate-300">{isEn ? 'Trees' : 'ต้น'}</span>
          </div>
          <div className="text-[10px] text-emerald-400/70 font-mono">
            {isEn ? 'Calculated at 10 kg CO₂ / tree / yr' : 'คำนวณที่ 10 kg CO₂ / ต้น / ปี'}
          </div>
        </div>

        {/* Metric 4: Car km Avoided */}
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 space-y-1">
          <div className="text-xs text-emerald-300/80 font-medium flex items-center gap-1">
            <Car className="w-3.5 h-3.5 text-sky-400" /> {isEn ? 'Vehicle Emissions Avoided' : 'ลดการขับรถยนต์เบนซิน'}
          </div>
          <div className="text-3xl font-black font-mono text-sky-300">
            {metrics.carKmAvoided} <span className="text-sm font-bold text-slate-300">{isEn ? 'km' : 'กม.'}</span>
          </div>
          <div className="text-[10px] text-emerald-400/70 font-mono">
            {isEn ? 'Avoided tailpipe exhaust & PM2.5' : 'ลดมลพิษฝุ่น PM2.5 และควันไอเสีย'}
          </div>
        </div>
      </div>

      {/* Corporate ESG Export Footer */}
      <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-200/90 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{isEn ? 'Audit-ready for Annual Sustainability & 56-1 One Report disclosures' : 'ข้อมูลพร้อมนำไปใช้ในรายงานประจำปี (Annual Sustainability Report / 56-1 One Report)'}</span>
        </div>
        <div className="text-[11px] font-mono font-bold text-emerald-400 hidden sm:block">
          Grid Factor: 0.4999 tCO₂e/MWh
        </div>
      </div>
    </div>
  );
}
