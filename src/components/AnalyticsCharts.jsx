import React from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { YEARLY_SUMMARY_2026 } from '../data/mockData';

export const AnalyticsCharts = ({ timeframe, monthlyDays }) => {
  // Monthly chart data (Day 1 to 31)
  const monthlyChartData = monthlyDays.map(d => {
    let waterTotal = 0;
    Object.values(d.water).forEach(w => {
      if (w?.consumption) waterTotal += w.consumption;
    });

    let elecTotal = 0;
    Object.values(d.electricity).forEach(e => {
      if (e?.consumption) elecTotal += e.consumption;
    });

    return {
      day: `วันที่ ${d.day}`,
      'น้ำประปา (m³)': Number(waterTotal.toFixed(1)),
      'ไฟฟ้า (kWh)': elecTotal,
      'โซลาร์เซลล์ (kWh)': d.solar?.dailyYield || 0,
    };
  });

  // Department electricity breakdown for Day 1
  const deptData = [
    { name: 'ห้องเย็น (Refrigeration)', usage: 13000, color: '#f59e0b' },
    { name: 'MMC Frozen Line', usage: 2800, color: '#3b82f6' },
    { name: 'MMC RTE Line', usage: 2700, color: '#6366f1' },
    { name: 'Office & แสงสว่าง', usage: 1440, color: '#10b981' },
    { name: 'Air Compressor', usage: 430, color: '#8b5cf6' },
    { name: 'Water Treatment', usage: 430, color: '#06b6d4' },
    { name: 'ส่วนอื่นๆ (Fire/Pump/Silo)', usage: 2069, color: '#64748b' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Monthly 31-Day Trend View */}
      {timeframe === 'monthly' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Electricity & Solar 31 Days */}
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 shadow-lg">
            <h3 className="text-sm font-semibold text-white mb-1">
              ⚡ แนวโน้มการใช้ไฟฟ้า & การผลิตโซลาร์เซลล์ (1 - 31 ก.ย. 2569)
            </h3>
            <p className="text-xs text-slate-400 mb-4">หน่วย: กิโลวัตต์-ชั่วโมง (kWh)</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyChartData.slice(0, 15)}>
                  <defs>
                    <linearGradient id="elecGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Area type="monotone" dataKey="ไฟฟ้า (kWh)" stroke="#f59e0b" fillOpacity={1} fill="url(#elecGrad)" />
                  <Area type="monotone" dataKey="โซลาร์เซลล์ (kWh)" stroke="#10b981" fillOpacity={1} fill="url(#solarGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Water 31 Days */}
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 shadow-lg">
            <h3 className="text-sm font-semibold text-white mb-1">
              💧 แนวโน้มปริมาณการใช้น้ำประปารวม (1 - 31 ก.ย. 2569)
            </h3>
            <p className="text-xs text-slate-400 mb-4">หน่วย: ลูกบาศก์เมตร (m³)</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="น้ำประปา (m³)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 2. Yearly View */}
      {timeframe === 'yearly' && (
        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 shadow-lg">
          <h3 className="text-sm font-semibold text-white mb-1">
            📈 ภาพรวมการใช้พลังงาน 12 เดือน ประจำปี 2569 (ม.ค. - ธ.ค.)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            เปรียบเทียบการใช้ไฟฟ้าจากการไฟฟ้า เทียบกับไฟฟ้าที่ผลิตและประหยัดได้จากโซลาร์เซลล์
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={YEARLY_SUMMARY_2026}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="elecKWh" name="ไฟฟ้าโรงงาน (kWh)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="solarKWh" name="โซลาร์เซลล์ช่วยผลิต (kWh)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 3. Daily Breakdown View */}
      {timeframe === 'daily' && (
        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">
                📊 สัดส่วนการใช้ไฟฟ้าแต่ละแผนก ประจำวันที่ 1 ก.ย. 2569
              </h3>
              <p className="text-xs text-slate-400">
                รวม 22,869 kWh (แผนกห้องเย็น REFRIGERATION PLANT คิดเป็น ~56.8% ของทั้งโรงงาน)
              </p>
            </div>
            <span className="text-xs text-amber-400 font-mono font-bold">22,869 kWh</span>
          </div>

          <div className="space-y-2.5">
            {deptData.map((d, i) => {
              const pct = ((d.usage / 22869) * 100).toFixed(1);
              return (
                <div key={i} className="text-xs">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span className="font-medium">{d.name}</span>
                    <span className="font-mono text-slate-200">
                      {d.usage.toLocaleString()} kWh <strong className="text-amber-400">({pct}%)</strong>
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%`, backgroundColor: d.color }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
