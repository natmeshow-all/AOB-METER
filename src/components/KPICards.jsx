import React from 'react';
import { Droplet, Zap, Sun, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { COMPANY_INFO } from '../data/mockData';

export const KPICards = ({ 
  timeframe, 
  waterSummary, 
  elecSummary, 
  solarSummary, 
  monthlyTotals 
}) => {
  const isDaily = timeframe === 'daily';
  const isMonthly = timeframe === 'monthly';

  // Calculate values based on selected timeframe
  let waterVal = isDaily ? waterSummary.totalDayUsage : monthlyTotals.waterTotal;
  let elecVal = isDaily ? elecSummary.totalDayUsage : monthlyTotals.elecTotal;
  let solarVal = isDaily ? (solarSummary?.dailyYield || 3850) : monthlyTotals.solar.totalYield;
  let costVal = isDaily 
    ? Math.round(elecVal * COMPANY_INFO.electricityRatePerUnit + waterVal * COMPANY_INFO.waterRatePerUnit)
    : Math.round(elecVal * COMPANY_INFO.electricityRatePerUnit + waterVal * COMPANY_INFO.waterRatePerUnit);

  let solarSavingsVal = isDaily
    ? Math.round(solarVal * COMPANY_INFO.electricityRatePerUnit)
    : monthlyTotals.solar.totalSavingsTHB;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Water KPI */}
      <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 shadow-lg relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">
            {isDaily ? '💧 ปริมาณน้ำประปารวม (วันนี้)' : isMonthly ? '💧 ปริมาณน้ำรวม (เดือนนี้)' : '💧 ปริมาณน้ำรวม (ปีนี้)'}
          </span>
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
            <Droplet className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tracking-tight">
            {waterVal?.toLocaleString()}
          </span>
          <span className="text-xs text-slate-400 font-medium">ลูกบาศก์เมตร (m³)</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-xs border-t border-slate-700/40 pt-2 text-slate-400">
          <span>รวมทั้ง 3 จุดหลัก</span>
          <span className="text-blue-400 font-medium">~{(waterVal * COMPANY_INFO.waterRatePerUnit).toLocaleString()} บาท</span>
        </div>
      </div>

      {/* 2. Electricity KPI */}
      <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 shadow-lg relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">
            {isDaily ? '⚡ ไฟฟ้ารวม (MDB-1 + MDB-2)' : isMonthly ? '⚡ ไฟฟ้ารวม (สะสมเดือนนี้)' : '⚡ ไฟฟ้ารวม (สะสมปีนี้)'}
          </span>
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tracking-tight">
            {elecVal?.toLocaleString()}
          </span>
          <span className="text-xs text-slate-400 font-medium">กิโลวัตต์-ชั่วโมง (kWh)</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-xs border-t border-slate-700/40 pt-2 text-slate-400">
          <span>MDB-1 (8 จุด) + MDB-2 (6 จุด)</span>
          <span className="text-amber-400 font-medium">~{(elecVal * COMPANY_INFO.electricityRatePerUnit).toLocaleString()} บาท</span>
        </div>
      </div>

      {/* 3. Solar Cell KPI */}
      <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 shadow-lg relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-yellow-500/5 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">
            {isDaily ? '☀️ โซลาร์เซลล์ผลิตได้ (รายวัน)' : '☀️ พลังงานแสงอาทิตย์รวม'}
          </span>
          <div className="p-2 bg-yellow-500/10 text-yellow-400 rounded-lg">
            <Sun className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tracking-tight">
            {solarVal?.toLocaleString()}
          </span>
          <span className="text-xs text-slate-400 font-medium">kWh</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-xs border-t border-slate-700/40 pt-2 text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" /> ประหยัดเงินได้
          </span>
          <span className="text-emerald-400 font-semibold">{solarSavingsVal?.toLocaleString()} บาท</span>
        </div>
      </div>

      {/* 4. Total Cost Impact */}
      <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 shadow-lg relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">
            {isDaily ? '💰 ประมาณการค่าสาธารณูปโภค' : '💰 รวมค่าสาธารณูปโภค'}
          </span>
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tracking-tight">
            {costVal?.toLocaleString()}
          </span>
          <span className="text-xs text-slate-400 font-medium">บาท (THB)</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-xs border-t border-slate-700/40 pt-2 text-slate-400">
          <span>อัตราไฟ 4.20 บ. / น้ำ 18.50 บ.</span>
          <span className="text-slate-300">สุทธิหลังหักโซลาร์</span>
        </div>
      </div>
    </div>
  );
};
