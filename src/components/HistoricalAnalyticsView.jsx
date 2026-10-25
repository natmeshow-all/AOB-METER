import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';
import { 
  TrendingUp, 
  Calendar, 
  Clock, 
  Zap, 
  DollarSign, 
  ShieldCheck, 
  AlertTriangle, 
  Download, 
  Sparkles,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  TENANT_COMPANIES, 
  generateHourlyData, 
  generateDailyData, 
  generateMonthlyData, 
  generateYearlyData 
} from '../data/tenantData';

export const HistoricalAnalyticsView = () => {
  const { activeOrgId } = useAuth();
  const currentCompany = TENANT_COMPANIES[activeOrgId] || TENANT_COMPANIES['ORG-AOB'];

  // Timeframe state: 'hourly' | 'daily' | 'monthly' | 'yearly'
  const [timeframe, setTimeframe] = useState('hourly');
  const [selectedDay, setSelectedDay] = useState(2); // Day 1-31

  // Dynamic Data based on active company
  const hourlyData = useMemo(() => generateHourlyData(activeOrgId), [activeOrgId]);
  const dailyData = useMemo(() => generateDailyData(activeOrgId), [activeOrgId]);
  const monthlyData = useMemo(() => generateMonthlyData(activeOrgId), [activeOrgId]);
  const yearlyData = useMemo(() => generateYearlyData(activeOrgId), [activeOrgId]);

  // Aggregate Metrics for Active Timeframe
  const metrics = useMemo(() => {
    if (timeframe === 'hourly') {
      const totalKWh = hourlyData.reduce((acc, h) => acc + h.energyKWh, 0);
      const totalCost = hourlyData.reduce((acc, h) => acc + h.costBaht, 0);
      const maxPeak = Math.max(...hourlyData.map(h => h.activeKW));
      const avgPF = (hourlyData.reduce((acc, h) => acc + h.powerFactor, 0) / hourlyData.length).toFixed(2);
      return { totalKWh, totalCost, maxPeak, avgPF, title: 'สรุปการใช้ไฟรอบ 24 ชั่วโมง (วันนี้)' };
    }
    if (timeframe === 'daily') {
      const totalKWh = dailyData.reduce((acc, d) => acc + d.totalKWh, 0);
      const totalCost = dailyData.reduce((acc, d) => acc + d.costBaht, 0);
      const maxPeak = Math.max(...dailyData.map(d => d.peakKW));
      const avgPF = (dailyData.reduce((acc, d) => acc + d.powerFactor, 0) / dailyData.length).toFixed(2);
      return { totalKWh, totalCost, maxPeak, avgPF, title: 'สรุปการใช้ไฟรอบเดือนกันยายน (30 วัน)' };
    }
    if (timeframe === 'monthly') {
      const totalKWh = monthlyData.reduce((acc, m) => acc + m.totalKWh, 0);
      const totalCost = monthlyData.reduce((acc, m) => acc + m.costBaht, 0);
      const maxPeak = Math.max(...monthlyData.map(m => m.peakKW));
      const totalSavings = monthlyData.reduce((acc, m) => acc + m.savingsBaht, 0);
      return { totalKWh, totalCost, maxPeak, totalSavings, avgPF: '0.95', title: 'สรุปการใช้ไฟรอบ 12 เดือน (ปี 2569)' };
    }
    // yearly
    const totalKWh = yearlyData[yearlyData.length - 1].totalKWh;
    const totalCost = yearlyData[yearlyData.length - 1].costBaht;
    const maxPeak = yearlyData[yearlyData.length - 1].peakDemandKW;
    return { totalKWh, totalCost, maxPeak, avgPF: '0.95', title: 'แนวโน้มการใช้ไฟและลดพีค 3 ปี (2567-2569)' };
  }, [timeframe, hourlyData, dailyData, monthlyData, yearlyData]);

  return (
    <div className="space-y-6">
      {/* Top Controls: Timeframe Pills & Company Identity */}
      <div className="bg-slate-900/90 p-4 sm:p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <TrendingUp className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  ศูนย์วิเคราะห์และสถิติพลังงานย้อนหลัง
                </h2>
                <p className="text-xs text-slate-400">
                  {currentCompany.name} • อัตราค่าไฟฟ้าเฉลี่ย {currentCompany.rateKWh} บ./kWh
                </p>
              </div>
            </div>
          </div>

          {/* Timeframe Selector Button Group (Mobile Optimized) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto overflow-x-auto no-scrollbar">
            <button
              onClick={() => setTimeframe('hourly')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                timeframe === 'hourly'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>รายชั่วโมง (24 ชม.)</span>
            </button>

            <button
              onClick={() => setTimeframe('daily')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                timeframe === 'daily'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>รายวัน (1-31 วัน)</span>
            </button>

            <button
              onClick={() => setTimeframe('monthly')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                timeframe === 'monthly'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>รายเดือน (12 เดือน)</span>
            </button>

            <button
              onClick={() => setTimeframe('yearly')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                timeframe === 'yearly'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>รายปี (3 ปี)</span>
            </button>
          </div>
        </div>

        {/* Dynamic Executive Metric Badges */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Total Energy */}
          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-slate-400 block mb-1">
              พลังงานไฟฟ้ารวม ({timeframe === 'hourly' ? 'วันเดียว' : timeframe === 'daily' ? 'ทั้งเดือน' : 'ทั้งปี'})
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-mono font-bold text-amber-400">
                {metrics.totalKWh >= 1000000 
                  ? (metrics.totalKWh / 1000000).toFixed(2) + ' M'
                  : metrics.totalKWh.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400">kWh</span>
            </div>
          </div>

          {/* Total Cost */}
          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-slate-400 block mb-1">
              คิดเป็นค่าไฟฟ้าโดยประมาณ
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-mono font-bold text-emerald-400">
                ฿{metrics.totalCost.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Peak Demand */}
          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-slate-400 block mb-1">
              พีคความต้องการสูงสุด (Peak Demand)
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-mono font-bold text-cyan-400">
                {metrics.maxPeak.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400">kW</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              พิกัดสัญญา: {currentCompany.contractPeakKW} kW
            </span>
          </div>

          {/* Power Factor or Savings */}
          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-slate-400 block mb-1">
              {timeframe === 'monthly' ? 'ประหยัดเงินเทียบปีก่อน' : 'เพาเวอร์แฟกเตอร์ (PF)'}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-mono font-bold text-indigo-400">
                {timeframe === 'monthly' 
                  ? `฿${(metrics.totalSavings || 0).toLocaleString()}` 
                  : metrics.avgPF}
              </span>
            </div>
            <span className="text-[10px] text-emerald-400 block mt-0.5">
              {timeframe === 'monthly' ? '✓ ประหยัดขึ้น 6.2%' : '✓ สูงกว่าเกณฑ์ 0.85 ปลอดค่าปรับ'}
            </span>
          </div>
        </div>
      </div>

      {/* ================= 1. HOURLY CHART (24 HOURS) ================= */}
      {timeframe === 'hourly' && (
        <div className="bg-slate-900/90 p-4 sm:p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                กราฟโหลดไฟฟ้าตลอด 24 ชั่วโมง (Hourly Load Curve)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                เปรียบเทียบช่วง On-Peak (09:00 - 22:00 น. หน่วยละ ฿{currentCompany.peakRate}) กับ Off-Peak (หน่วยละ ฿{currentCompany.offPeakRate})
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-3 h-3 rounded bg-amber-500" /> On-Peak (09:00-22:00)
              </span>
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="w-3 h-3 rounded bg-blue-500" /> Off-Peak
              </span>
            </div>
          </div>

          <div className="h-72 sm:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="hour" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} unit=" kW" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val, name) => [
                    name === 'activeKW' ? `${Number(val).toLocaleString()} kW` : `฿${Number(val).toLocaleString()}`,
                    name === 'activeKW' ? 'โหลดไฟฟ้า (kW)' : 'ค่าไฟประมาณการ (บาท)'
                  ]}
                />
                <ReferenceLine y={currentCompany.contractPeakKW} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: `พิกัดสัญญา ${currentCompany.contractPeakKW} kW`, fill: '#f43f5e', fontSize: 10, position: 'top' }} />
                <Area type="monotone" dataKey="activeKW" stroke="#38bdf8" strokeWidth={3} fillOpacity={1} fill="url(#loadGradient)" name="activeKW" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ================= 2. DAILY CHART (1-31 DAYS) ================= */}
      {timeframe === 'daily' && (
        <div className="bg-slate-900/90 p-4 sm:p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                กราฟการใช้ไฟฟ้ารายวันประจำเดือน (Daily Energy Consumption & Cost)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                แสดงยอดการใช้ไฟฟ้ารายวัน (kWh) ควบคู่กับสัดส่วน On-Peak / Off-Peak
              </p>
            </div>
            <div className="text-xs text-slate-400">
              วันเสาร์-อาทิตย์จะลดการผลิตลงประมาณ 35%
            </div>
          </div>

          <div className="h-72 sm:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} unit=" kWh" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val, name) => [
                    `${Number(val).toLocaleString()} kWh`,
                    name === 'onPeakKWh' ? 'ช่วง On-Peak' : 'ช่วง Off-Peak'
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="onPeakKWh" name="On-Peak (kWh)" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                <Bar dataKey="offPeakKWh" name="Off-Peak (kWh)" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ================= 3. MONTHLY CHART (12 MONTHS) ================= */}
      {timeframe === 'monthly' && (
        <div className="bg-slate-900/90 p-4 sm:p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                เปรียบเทียบการใช้ไฟฟ้า 12 เดือน (ปี 2569 เทียบกับ 2568)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                เห็นผลลัพธ์การประหยัดพลังงานหลังติดตั้งระบบมอนิเตอร์และ AI สแกนเนอร์อย่างชัดเจน
              </p>
            </div>
            <div className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              ✓ ประหยัดไฟสะสม ฿{(metrics.totalSavings || 0).toLocaleString()} บาท
            </div>
          </div>

          <div className="h-72 sm:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} unit=" kWh" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val, name) => [
                    `${Number(val).toLocaleString()} kWh`,
                    name === 'totalKWh' ? 'ปีปัจจุบัน 2569' : 'ปีก่อนหน้า 2568'
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="previousYearKWh" name="ปี 2568 (ก่อนปรับปรุง)" fill="#64748b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="totalKWh" name="ปี 2569 (ปัจจุบัน)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ================= 4. YEARLY CHART (3 YEARS) ================= */}
      {timeframe === 'yearly' && (
        <div className="bg-slate-900/90 p-4 sm:p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                แนวโน้มภาพรวมการใช้ไฟฟ้ารายปี (Year-Over-Year 2567 - 2569)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ติดตามประสิทธิภาพการใช้พลังงาน (Energy Efficiency Index) รายปี
              </p>
            </div>
            <span className="text-xs font-bold text-cyan-400 font-mono">
              Peak Demand ลดลงจาก 96% เหลือ 82%
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 my-3">
            {yearlyData.map((y, idx) => (
              <div key={idx} className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{y.year}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                    {y.status}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">ค่าไฟรวมทั้งปี:</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    ฿{(y.costBaht / 1000000).toFixed(2)} ล้านบาท
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Peak Demand: <strong className="text-white font-mono">{y.peakDemandKW} kW</strong></span>
                  <span className="text-cyan-400 font-bold">ประสิทธิภาพ {y.efficiencyScore}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="h-64 sm:h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="year" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} unit=" kWh" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val) => [`${Number(val).toLocaleString()} kWh`, 'การใช้ไฟฟ้ารวมรายปี']}
                />
                <Bar dataKey="totalKWh" name="หน่วยการใช้ไฟฟ้ารวม (kWh)" fill="#818cf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
