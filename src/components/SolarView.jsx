import React from 'react';
import { Sun, BatteryCharging, DollarSign, Activity, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { COMPANY_INFO } from '../data/mockData';

export const SolarView = ({ currentDayData }) => {
  const solar = currentDayData?.solar || {
    dailyYield: 3850,
    peakPower: 645,
    savingsTHB: 16170,
    inverterStatus: 'Normal (8/8 Online)',
  };

  const inverters = [
    { id: 'INV-01', name: 'Inverter 01 (Building A Roof)', power: '78.5 kW', yield: '495 kWh', status: 'Normal' },
    { id: 'INV-02', name: 'Inverter 02 (Building A Roof)', power: '81.2 kW', yield: '512 kWh', status: 'Normal' },
    { id: 'INV-03', name: 'Inverter 03 (Building B Warehouse)', power: '80.1 kW', yield: '488 kWh', status: 'Normal' },
    { id: 'INV-04', name: 'Inverter 04 (Building B Warehouse)', power: '79.4 kW', yield: '490 kWh', status: 'Normal' },
    { id: 'INV-05', name: 'Inverter 05 (Cold Storage Roof)', power: '82.0 kW', yield: '520 kWh', status: 'Normal' },
    { id: 'INV-06', name: 'Inverter 06 (Cold Storage Roof)', power: '81.5 kW', yield: '515 kWh', status: 'Normal' },
    { id: 'INV-07', name: 'Inverter 07 (Office Building)', power: '42.0 kW', yield: '260 kWh', status: 'Normal' },
    { id: 'INV-08', name: 'Inverter 08 (Packaging Plant)', power: '89.0 kW', yield: '570 kWh', status: 'Normal' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-yellow-500/20 text-yellow-400 rounded-lg">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              ระบบพลังงานแสงอาทิตย์ โซลาร์เซลล์ (Solar Rooftop System)
            </h2>
            <p className="text-xs text-slate-400">
              กำลังการผลิตรวมติดตั้ง 800 kWp | อัตราประหยัดค่าไฟ 4.20 บาท/หน่วย
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 rounded-md flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> อินเวอร์เตอร์ทำงานปกติ (8/8)
          </span>
        </div>
      </div>

      {/* KPI Cards for Solar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>☀️ ไฟฟ้าที่ผลิตได้วันนี้</span>
            <BatteryCharging className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{solar.dailyYield.toLocaleString()}</span>
            <span className="text-xs text-yellow-400">kWh</span>
          </div>
          <span className="text-xs text-slate-400 mt-2 block">ช่วยลดการซื้อไฟจากการไฟฟ้า</span>
        </div>

        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>⚡ กำลังผลิตสูงสุด (Peak Power)</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{solar.peakPower.toLocaleString()}</span>
            <span className="text-xs text-amber-400">kW</span>
          </div>
          <span className="text-xs text-slate-400 mt-2 block">ช่วงเวลาพีค 11:30 - 13:30 น.</span>
        </div>

        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>💰 ประหยัดค่าไฟวันนี้</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400 font-mono">+{solar.savingsTHB.toLocaleString()}</span>
            <span className="text-xs text-emerald-300">บาท</span>
          </div>
          <span className="text-xs text-slate-400 mt-2 block">คิดที่อัตรา 4.20 บ./kWh</span>
        </div>

        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>🌱 ลดการปล่อยคาร์บอน</span>
            <ShieldCheck className="w-4 h-4 text-teal-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{(solar.dailyYield * 0.0005).toFixed(2)}</span>
            <span className="text-xs text-teal-400">Ton CO₂</span>
          </div>
          <span className="text-xs text-slate-400 mt-2 block">สอดคล้องนโยบาย ESG โรงงาน</span>
        </div>
      </div>

      {/* Inverter Status Table */}
      <div className="bg-slate-800/80 rounded-xl border border-slate-700/60 overflow-hidden shadow-lg">
        <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between bg-slate-900/40">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span>สถานะเครื่องแปลงไฟ Inverters (8 เครื่อง)</span>
          </h3>
          <span className="text-xs text-emerald-400 font-mono">Status: All Active</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
          {inverters.map((inv) => (
            <div key={inv.id} className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 hover:border-yellow-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-yellow-400 font-mono">{inv.id}</span>
                <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  {inv.status}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-1 truncate" title={inv.name}>
                {inv.name}
              </p>
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">กำลัง: <strong className="text-slate-200 font-mono">{inv.power}</strong></span>
                <span className="text-slate-400">ผลิต: <strong className="text-yellow-300 font-mono">{inv.yield}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
