import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Droplet, 
  Zap, 
  Download, 
  Calendar, 
  Calculator, 
  CheckCircle2,
  TrendingUp
} from 'lucide-react';
import { WATER_METERS, ELECTRICITY_METERS, COMPANY_INFO } from '../data/mockData';

export const MonthlySummaryTable = ({ monthlyDays, monthlyTotals }) => {
  const [activeSheetTab, setActiveSheetTab] = useState('water'); // 'water' | 'electricity'

  // Export to CSV
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    
    if (activeSheetTab === 'water') {
      csvContent += "วันที่,มิเตอร์น้ำหลัก (เลข),มิเตอร์น้ำหลัก (Q รวม),มิเตอร์น้ำ Soft (เลข),มิเตอร์น้ำ Soft (Q รวม),มิเตอร์น้ำ EVAP (เลข),มิเตอร์น้ำ EVAP (Q รวม),ผู้บันทึก,ผู้ตรวจสอบ\n";
      monthlyDays.forEach(d => {
        const wMain = d.water['WATER-MAIN'] || {};
        const wSoft = d.water['WATER-SOFT'] || {};
        const wEvap = d.water['WATER-EVAP'] || {};
        csvContent += `${d.day},${wMain.current || ''},${wMain.consumption || ''},${wSoft.current || ''},${wSoft.consumption || ''},${wEvap.current || ''},${wEvap.consumption || ''},${d.recordedBy},${d.reviewer}\n`;
      });
      // Add Total row
      csvContent += `รวมรอบเดือน (1-31),-,${monthlyTotals.water['WATER-MAIN']?.totalConsumption},-,${monthlyTotals.water['WATER-SOFT']?.totalConsumption},-,${monthlyTotals.water['WATER-EVAP']?.totalConsumption},-,-\n`;
    } else {
      csvContent += "No,รหัสมิเตอร์,ตำแหน่ง / แผนก,กลุ่ม,เลข 31 ส.ค.,เลข 1 ก.ย.,หน่วยที่ใช้ 1 ก.ย.,รวมรอบเดือน (1-31 kWh),คิดเป็นเงิน (บาท)\n";
      ELECTRICITY_METERS.forEach((m, idx) => {
        const tot = monthlyTotals.electricity[m.id] || {};
        csvContent += `${idx + 1},${m.tag},"${m.location}","${m.group}",${m.baselineAug31},${m.readingSep01},${m.readingSep01 - m.baselineAug31},${tot.totalConsumption},${tot.costTHB}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `รายงาน_${activeSheetTab === 'water' ? 'ค่าน้ำ' : 'ค่าไฟฟ้า'}_กันยายน_2569.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">
                {COMPANY_INFO.sheetTitle}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                {COMPANY_INFO.period}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              แสดงตารางวันที่ 1 - 31 พร้อม <strong className="text-amber-300 font-medium">"ยอดรวมรอบเดือนของมิเตอร์ทุกตัว"</strong> ตามแบบฟอร์ม Google Sheets จริง
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Tab Toggle: ค่าน้ำ vs ค่าไฟฟ้า */}
          <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-700/80">
            <button
              onClick={() => setActiveSheetTab('water')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeSheetTab === 'water'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Droplet className="w-3.5 h-3.5" />
              <span>Tab ค่าน้ำ (3 จุด)</span>
            </button>
            <button
              onClick={() => setActiveSheetTab('electricity')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeSheetTab === 'electricity'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Tab ค่าไฟฟ้า (14 จุด)</span>
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-all cursor-pointer"
            title="ดาวน์โหลดไฟล์ CSV สำหรับเปิดใน Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          TAB 1: ค่าน้ำ (WATER CONSUMPTION 31 DAYS + MONTHLY TOTAL)
          ======================================================== */}
      {activeSheetTab === 'water' && (
        <div className="space-y-4">
          {/* Monthly Totals Header Cards for Each Water Meter */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {WATER_METERS.map((meter) => {
              const tot = monthlyTotals.water[meter.id] || { totalConsumption: 0, costTHB: 0 };
              return (
                <div key={meter.id} className="bg-blue-950/20 border border-blue-800/40 rounded-xl p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{meter.name}</span>
                    <span className="text-cyan-400 font-mono text-[11px]">S/N: {meter.serialNumber}</span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block">รวมรอบเดือน (1-31 ก.ย.)</span>
                      <span className="text-xl font-bold text-white font-mono">
                        {tot.totalConsumption.toLocaleString()} <span className="text-xs text-blue-300 font-sans">m³</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">เกณฑ์ปกติเฉลี่ย</span>
                      <span className="text-xs font-semibold text-emerald-400 font-mono">
                        {meter.expectedMin}-{meter.expectedMax} m³/วัน
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full 31-Day Table */}
          <div className="bg-slate-800/80 rounded-xl border border-slate-700/60 overflow-hidden shadow-xl">
            <div className="overflow-x-auto max-h-[550px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900/90 text-slate-300 sticky top-0 z-10">
                  <tr className="border-b border-slate-800">
                    <th className="p-3 w-16 text-center font-semibold">วันที่</th>
                    <th colSpan="2" className="p-3 text-center border-l border-slate-800 bg-blue-950/30 text-blue-300">
                      มิเตอร์น้ำหลัก (หน้าโรงงาน)
                    </th>
                    <th colSpan="2" className="p-3 text-center border-l border-slate-800 bg-cyan-950/30 text-cyan-300">
                      มิเตอร์น้ำ ระบบ Soft
                    </th>
                    <th colSpan="2" className="p-3 text-center border-l border-slate-800 bg-indigo-950/30 text-indigo-300">
                      มิเตอร์น้ำ ระบบ EVAP.
                    </th>
                    <th className="p-3 text-center border-l border-slate-800">ผู้บันทึก</th>
                    <th className="p-3 text-center border-l border-slate-800">ผู้ตรวจสอบ</th>
                  </tr>
                  <tr className="border-b border-slate-700 text-[11px] text-slate-400 bg-slate-900">
                    <th className="p-2 text-center">Day (1-31)</th>
                    <th className="p-2 text-right border-l border-slate-800">เลขมิเตอร์หลัก</th>
                    <th className="p-2 text-right bg-blue-950/20 text-blue-300 font-medium">Q รวมหลัก (m³)</th>
                    <th className="p-2 text-right border-l border-slate-800">เลขมิเตอร์ Soft</th>
                    <th className="p-2 text-right bg-cyan-950/20 text-cyan-300 font-medium">Q รวม Soft (m³)</th>
                    <th className="p-2 text-right border-l border-slate-800">เลขมิเตอร์ EVAP.</th>
                    <th className="p-2 text-right bg-indigo-950/20 text-indigo-300 font-medium">Q รวม EVAP (m³)</th>
                    <th className="p-2 text-center border-l border-slate-800">LINE Bot</th>
                    <th className="p-2 text-center border-l border-slate-800">Sign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {monthlyDays.map((row) => {
                    const wMain = row.water['WATER-MAIN'] || {};
                    const wSoft = row.water['WATER-SOFT'] || {};
                    const wEvap = row.water['WATER-EVAP'] || {};

                    return (
                      <tr 
                        key={row.day}
                        className={`hover:bg-slate-700/30 transition-colors ${
                          row.day === 1 ? 'bg-blue-500/10 font-semibold' : ''
                        }`}
                      >
                        <td className="p-2.5 text-center text-slate-300 font-semibold">
                          {row.day} {row.day === 1 && <span className="text-[10px] text-blue-400 font-sans block">(วานนี้)</span>}
                        </td>
                        <td className="p-2.5 text-right border-l border-slate-800 text-slate-300">
                          {wMain.current?.toLocaleString(undefined, { minimumFractionDigits: 1 }) || '-'}
                        </td>
                        <td className="p-2.5 text-right bg-blue-950/15 text-blue-300 font-bold">
                          {wMain.consumption ? `+${wMain.consumption.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-2.5 text-right border-l border-slate-800 text-slate-300">
                          {wSoft.current?.toLocaleString(undefined, { minimumFractionDigits: 1 }) || '-'}
                        </td>
                        <td className="p-2.5 text-right bg-cyan-950/15 text-cyan-300 font-bold">
                          {wSoft.consumption ? `+${wSoft.consumption.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-2.5 text-right border-l border-slate-800 text-slate-300">
                          {wEvap.current?.toLocaleString(undefined, { minimumFractionDigits: 1 }) || '-'}
                        </td>
                        <td className="p-2.5 text-right bg-indigo-950/15 text-indigo-300 font-bold">
                          {wEvap.consumption ? `+${wEvap.consumption.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-2.5 text-center border-l border-slate-800 text-slate-400 font-sans text-[11px]">
                          {row.recordedBy}
                        </td>
                        <td className="p-2.5 text-center border-l border-slate-800 text-slate-400 font-sans text-[11px]">
                          {row.reviewer}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* MONTHLY TOTAL SUMMARY ROW (Crucial User Requirement) */}
                <tfoot className="bg-slate-900 border-t-2 border-blue-500 sticky bottom-0 z-10 text-xs font-semibold">
                  <tr className="text-white">
                    <td className="p-3 text-center font-bold bg-slate-900 text-amber-300">
                      รวมรอบเดือน (1-31)
                    </td>
                    <td className="p-3 text-right border-l border-slate-800 text-slate-400 font-sans text-[11px]">
                      ยอดสะสมทั้งเดือน
                    </td>
                    <td className="p-3 text-right bg-blue-900/40 text-blue-200 font-mono text-sm font-bold">
                      +{monthlyTotals.water['WATER-MAIN']?.totalConsumption.toLocaleString()} m³
                    </td>
                    <td className="p-3 text-right border-l border-slate-800 text-slate-400 font-sans text-[11px]">
                      ยอดสะสมทั้งเดือน
                    </td>
                    <td className="p-3 text-right bg-cyan-900/40 text-cyan-200 font-mono text-sm font-bold">
                      +{monthlyTotals.water['WATER-SOFT']?.totalConsumption.toLocaleString()} m³
                    </td>
                    <td className="p-3 text-right border-l border-slate-800 text-slate-400 font-sans text-[11px]">
                      ยอดสะสมทั้งเดือน
                    </td>
                    <td className="p-3 text-right bg-indigo-900/40 text-indigo-200 font-mono text-sm font-bold">
                      +{monthlyTotals.water['WATER-EVAP']?.totalConsumption.toLocaleString()} m³
                    </td>
                    <td colSpan="2" className="p-3 text-center border-l border-slate-800 text-emerald-400 font-sans">
                      รวมปริมาณน้ำทั้ง 3 จุด: {(
                        (monthlyTotals.water['WATER-MAIN']?.totalConsumption || 0) +
                        (monthlyTotals.water['WATER-SOFT']?.totalConsumption || 0) +
                        (monthlyTotals.water['WATER-EVAP']?.totalConsumption || 0)
                      ).toFixed(1)} m³ (ปกติตามเกณฑ์)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: ค่าไฟฟ้า (ELECTRICITY 14 POINTS + MONTHLY TOTAL)
          ======================================================== */}
      {activeSheetTab === 'electricity' && (
        <div className="space-y-4">
          <div className="bg-slate-800/80 rounded-xl border border-slate-700/60 overflow-hidden shadow-xl">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900/90 text-slate-300 sticky top-0 z-10">
                  <tr className="border-b border-slate-700">
                    <th className="p-3 w-10 text-center">No.</th>
                    <th className="p-3 w-20">รหัสป้าย</th>
                    <th className="p-3">ตำแหน่ง / แผนก (Location)</th>
                    <th className="p-3">กลุ่มตู้สวิตช์บอร์ด</th>
                    <th className="p-3 text-right">31 ส.ค. 2569 (Baseline)</th>
                    <th className="p-3 text-right bg-amber-950/20 text-amber-300">1 ก.ย. 2569 (ล่าสุด)</th>
                    <th className="p-3 text-right bg-amber-950/40 text-amber-300">ใช้ไป 1 ก.ย. (kWh)</th>
                    
                    {/* CRUCIAL USER REQUIREMENT: รวมรอบเดือนของมิเตอร์ทุกตัว */}
                    <th className="p-3 text-right bg-emerald-950/50 text-emerald-300 border-l border-slate-700 font-bold text-sm">
                      รวมรอบเดือน (1-31 ก.ย. kWh)
                    </th>
                    <th className="p-3 text-right bg-emerald-950/30 text-emerald-400">
                      คิดเป็นเงิน (บาท)
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800/70 font-mono">
                  {/* --- Group 1: MDB-1 TR1 (8 Points) --- */}
                  <tr className="bg-slate-900/70 font-sans">
                    <td colSpan="9" className="px-4 py-2 text-xs font-bold text-amber-400 bg-amber-500/10 border-y border-amber-500/20">
                      ⚡ ตู้ MDB-1 TR1 @ 1,600 kVA (8 จุด)
                    </td>
                  </tr>

                  {ELECTRICITY_METERS.filter(m => m.group.includes('MDB-1')).map((meter, idx) => {
                    const day1Usage = meter.readingSep01 - meter.baselineAug31;
                    const tot = monthlyTotals.electricity[meter.id] || { totalConsumption: day1Usage * 30, costTHB: day1Usage * 30 * 4.2 };

                    return (
                      <tr key={meter.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-amber-400">{meter.tag}</td>
                        <td className="p-2.5 text-white font-sans font-medium">{meter.location}</td>
                        <td className="p-2.5 text-slate-400 font-sans text-[11px]">{meter.panel}</td>
                        <td className="p-2.5 text-right text-slate-300">{meter.baselineAug31.toLocaleString()}</td>
                        <td className="p-2.5 text-right bg-amber-950/10 text-amber-200 font-semibold">{meter.readingSep01.toLocaleString()}</td>
                        <td className="p-2.5 text-right bg-amber-950/25 text-amber-300 font-bold">+{day1Usage.toLocaleString()}</td>
                        
                        {/* MONTHLY TOTAL FOR THIS METER */}
                        <td className="p-2.5 text-right bg-emerald-950/30 text-white font-bold border-l border-slate-700 text-sm">
                          {tot.totalConsumption.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right bg-emerald-950/20 text-emerald-400 font-medium">
                          {tot.costTHB.toLocaleString()} บ.
                        </td>
                      </tr>
                    );
                  })}

                  {/* --- Group 2: MDB-2 TR2 (6 Points) --- */}
                  <tr className="bg-slate-900/70 font-sans">
                    <td colSpan="9" className="px-4 py-2 text-xs font-bold text-amber-400 bg-amber-500/10 border-y border-amber-500/20">
                      ⚡ ตู้ MDB-2 TR2 @ 1,600 kVA (6 จุด)
                    </td>
                  </tr>

                  {ELECTRICITY_METERS.filter(m => m.group.includes('MDB-2')).map((meter, idx) => {
                    const day1Usage = meter.readingSep01 - meter.baselineAug31;
                    const tot = monthlyTotals.electricity[meter.id] || { totalConsumption: day1Usage * 30, costTHB: day1Usage * 30 * 4.2 };

                    return (
                      <tr key={meter.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-amber-400">{meter.tag}</td>
                        <td className="p-2.5 text-white font-sans font-medium">{meter.location}</td>
                        <td className="p-2.5 text-slate-400 font-sans text-[11px]">{meter.panel}</td>
                        <td className="p-2.5 text-right text-slate-300">{meter.baselineAug31.toLocaleString()}</td>
                        <td className="p-2.5 text-right bg-amber-950/10 text-amber-200 font-semibold">{meter.readingSep01.toLocaleString()}</td>
                        <td className="p-2.5 text-right bg-amber-950/25 text-amber-300 font-bold">+{day1Usage.toLocaleString()}</td>
                        
                        {/* MONTHLY TOTAL FOR THIS METER */}
                        <td className="p-2.5 text-right bg-emerald-950/30 text-white font-bold border-l border-slate-700 text-sm">
                          {tot.totalConsumption.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right bg-emerald-950/20 text-emerald-400 font-medium">
                          {tot.costTHB.toLocaleString()} บ.
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* GRAND TOTAL SUMMARY FOOTER */}
                <tfoot className="bg-slate-900 border-t-2 border-amber-500 sticky bottom-0 z-10 text-xs font-semibold">
                  <tr className="text-white">
                    <td colSpan="4" className="p-3 text-center font-bold text-amber-300 font-sans">
                      รวมค่าไฟฟ้าทั้งโรงงาน (14 จุด)
                    </td>
                    <td className="p-3 text-right text-slate-400 font-sans text-[11px]">
                      -
                    </td>
                    <td className="p-3 text-right text-slate-400 font-sans text-[11px]">
                      -
                    </td>
                    <td className="p-3 text-right bg-amber-900/50 text-amber-200 font-mono text-sm font-bold">
                      +22,869 kWh
                    </td>
                    
                    {/* MONTHLY GRAND TOTAL KWH */}
                    <td className="p-3 text-right bg-emerald-900/60 text-emerald-200 font-mono text-base font-bold border-l border-slate-700">
                      +{monthlyTotals.elecTotal?.toLocaleString()} kWh
                    </td>
                    <td className="p-3 text-right bg-emerald-900/40 text-emerald-300 font-mono font-bold">
                      ~{Math.round(monthlyTotals.elecTotal * COMPANY_INFO.electricityRatePerUnit).toLocaleString()} บาท
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
