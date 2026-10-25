import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  Calendar,
  Clock,
  Zap,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Flame,
  ArrowRight,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  TENANT_COMPANIES,
  generateHourlyData,
  generateDailyData,
  generateMonthlyData
} from '../data/tenantData';

export const ProductionReportView = ({ onSelectMeter }) => {
  const { activeOrgId } = useAuth();
  const currentCompany = TENANT_COMPANIES[activeOrgId] || TENANT_COMPANIES['ORG-AOB'];

  // Report Mode: 'daily' | 'monthly' | 'yearly'
  const [reportMode, setReportMode] = useState('daily');
  const [selectedDay, setSelectedDay] = useState('2026-10-25');
  const [selectedMonth, setSelectedMonth] = useState('10'); // October
  const [selectedYear, setSelectedYear] = useState('2569');

  const monthNamesFull = [
    { val: '01', label: 'มกราคม' },
    { val: '02', label: 'กุมภาพันธ์' },
    { val: '03', label: 'มีนาคม' },
    { val: '04', label: 'เมษายน' },
    { val: '05', label: 'พฤษภาคม' },
    { val: '06', label: 'มิถุนายน' },
    { val: '07', label: 'กรกฎาคม' },
    { val: '08', label: 'สิงหาคม' },
    { val: '09', label: 'กันยายน' },
    { val: '10', label: 'ตุลาคม' },
    { val: '11', label: 'พฤศจิกายน' },
    { val: '12', label: 'ธันวาคม' }
  ];

  // Generate data with deterministic seed based on selected Day / Month / Year
  const hourlyData = useMemo(() => {
    const base = generateHourlyData(currentCompany.id);
    const dayNum = parseInt(selectedDay.split('-')[2] || '25', 10);
    const mod = 0.92 + ((dayNum % 7) * 0.025);
    return base.map((h) => ({
      ...h,
      energyKWh: Math.round(h.energyKWh * mod),
      activeKW: Math.round(h.activeKW * mod),
      costBaht: Math.round(h.costBaht * mod)
    }));
  }, [currentCompany.id, selectedDay]);

  const dailyData = useMemo(() => {
    const base = generateDailyData(currentCompany.id, 30);
    const mNum = parseInt(selectedMonth, 10);
    const mod = 0.94 + ((mNum % 5) * 0.03);
    const mShort =
      monthNamesFull.find((m) => m.val === selectedMonth)?.label.slice(0, 4) || 'ต.ค.';
    return base.map((d) => ({
      ...d,
      dateLabel: `${d.day} ${mShort}`,
      totalKWh: Math.round(d.totalKWh * mod),
      onPeakKWh: Math.round(d.onPeakKWh * mod),
      offPeakKWh: Math.round(d.offPeakKWh * mod),
      costBaht: Math.round(d.costBaht * mod)
    }));
  }, [currentCompany.id, selectedMonth]);

  const monthlyData = useMemo(() => {
    const base = generateMonthlyData(currentCompany.id);
    const yMod = selectedYear === '2569' ? 1.0 : selectedYear === '2568' ? 1.06 : 1.12;
    return base.map((m) => {
      const totalKWh = Math.round(m.totalKWh * yMod);
      const onPeakKWh = Math.round(totalKWh * 0.63);
      const offPeakKWh = totalKWh - onPeakKWh;
      return {
        ...m,
        totalKWh,
        onPeakKWh,
        offPeakKWh,
        costBaht: Math.round(m.costBaht * yMod)
      };
    });
  }, [currentCompany.id, selectedYear]);

  // Compute active period summary & shift breakdown
  const reportSummary = useMemo(() => {
    if (reportMode === 'daily') {
      const totalKWh = hourlyData.reduce((s, h) => s + h.energyKWh, 0);
      const totalCost = hourlyData.reduce((s, h) => s + h.costBaht, 0);
      const onPeakKWh = hourlyData
        .filter((h) => h.isOnPeak)
        .reduce((s, h) => s + h.energyKWh, 0);
      const offPeakKWh = totalKWh - onPeakKWh;
      const peakItem = [...hourlyData].sort((a, b) => b.activeKW - a.activeKW)[0];

      return {
        title: `รายงานสรุปประจำวันที่ ${selectedDay.split('-').reverse().join('/')}`,
        totalKWh,
        totalCost,
        onPeakKWh,
        offPeakKWh,
        onPeakPct: Math.round((onPeakKWh / (totalKWh || 1)) * 100),
        peakWindowLabel: `เวลา ${peakItem?.hour || '14:00'} น. (${peakItem?.activeKW || 0} kW)`,
        potentialSavingsBaht: Math.round(onPeakKWh * 0.2 * ((currentCompany.peakRate || 5.1) - (currentCompany.offPeakRate || 2.6)))
      };
    }

    if (reportMode === 'monthly') {
      const totalKWh = dailyData.reduce((s, d) => s + d.totalKWh, 0);
      const totalCost = dailyData.reduce((s, d) => s + d.costBaht, 0);
      const onPeakKWh = dailyData.reduce((s, d) => s + d.onPeakKWh, 0);
      const offPeakKWh = totalKWh - onPeakKWh;
      const peakDay = [...dailyData].sort((a, b) => b.totalKWh - a.totalKWh)[0];
      const mLabel = monthNamesFull.find((m) => m.val === selectedMonth)?.label || 'ตุลาคม';

      return {
        title: `รายงานสรุปประจำเดือน ${mLabel} ${selectedYear}`,
        totalKWh,
        totalCost,
        onPeakKWh,
        offPeakKWh,
        onPeakPct: Math.round((onPeakKWh / (totalKWh || 1)) * 100),
        peakWindowLabel: `วันที่ ${peakDay?.dateLabel} (${peakDay?.totalKWh.toLocaleString()} kWh)`,
        potentialSavingsBaht: Math.round(onPeakKWh * 0.2 * ((currentCompany.peakRate || 5.1) - (currentCompany.offPeakRate || 2.6)))
      };
    }

    // Yearly
    const totalKWh = monthlyData.reduce((s, m) => s + m.totalKWh, 0);
    const totalCost = monthlyData.reduce((s, m) => s + m.costBaht, 0);
    const onPeakKWh = monthlyData.reduce((s, m) => s + m.onPeakKWh, 0);
    const offPeakKWh = totalKWh - onPeakKWh;
    const peakMonth = [...monthlyData].sort((a, b) => b.totalKWh - a.totalKWh)[0];

    return {
      title: `รายงานสรุปประจำปี พ.ศ. ${selectedYear}`,
      totalKWh,
      totalCost,
      onPeakKWh,
      offPeakKWh,
      onPeakPct: Math.round((onPeakKWh / (totalKWh || 1)) * 100),
      peakWindowLabel: `เดือน${peakMonth?.month} (${peakMonth?.totalKWh.toLocaleString()} kWh)`,
      potentialSavingsBaht: Math.round(onPeakKWh * 0.2 * ((currentCompany.peakRate || 5.1) - (currentCompany.offPeakRate || 2.6)))
    };
  }, [reportMode, hourlyData, dailyData, monthlyData, selectedDay, selectedMonth, selectedYear, currentCompany]);

  // 4 Production Shift Windows Breakdown (for Production Planning)
  const shiftWindows = useMemo(() => {
    const scale =
      reportMode === 'daily' ? 1 : reportMode === 'monthly' ? 30 : 365;
    const morningKWh =
      hourlyData
        .filter((h) => h.hourNum >= 6 && h.hourNum < 9)
        .reduce((s, h) => s + h.energyKWh, 0) * scale;
    const dayPeakKWh =
      hourlyData
        .filter((h) => h.hourNum >= 9 && h.hourNum < 17)
        .reduce((s, h) => s + h.energyKWh, 0) * scale;
    const eveningPeakKWh =
      hourlyData
        .filter((h) => h.hourNum >= 17 && h.hourNum < 22)
        .reduce((s, h) => s + h.energyKWh, 0) * scale;
    const nightOffPeakKWh =
      hourlyData
        .filter((h) => h.hourNum >= 22 || h.hourNum < 6)
        .reduce((s, h) => s + h.energyKWh, 0) * scale;

    const peakRate = currentCompany.peakRate || 5.1;
    const offRate = currentCompany.offPeakRate || 2.6;

    return [
      {
        id: 'shift-1',
        name: 'กะเช้าตรู่ (06:00 - 09:00 น.)',
        tariff: 'Off-Peak (ค่าไฟถูก 2.60 ฿)',
        isPeak: false,
        kwh: morningKWh,
        cost: Math.round(morningKWh * offRate),
        advice: 'เหมาะสำหรับเปิดเดินระบบทำความเย็นล่วงหน้า (Pre-Cooling) และอุ่นเครื่องจักรก่อนถึงเวลา 09:00 น.'
      },
      {
        id: 'shift-2',
        name: 'กะทำงานหลัก (09:00 - 17:00 น.)',
        tariff: 'On-Peak (ค่าไฟแพง 5.10 ฿)',
        isPeak: true,
        kwh: dayPeakKWh,
        cost: Math.round(dayPeakKWh * peakRate),
        advice: 'ช่วงกินไฟสูงสุด! ควรเลี่ยงการเดินเครื่องจักรที่กินโหลดสูงพร้อมกัน หรือย้ายงานเตรียมวัตถุดิบไปกะดึก'
      },
      {
        id: 'shift-3',
        name: 'กะเย็น-ค่ำ (17:00 - 22:00 น.)',
        tariff: 'On-Peak (ค่าไฟแพง 5.10 ฿)',
        isPeak: true,
        kwh: eveningPeakKWh,
        cost: Math.round(eveningPeakKWh * peakRate),
        advice: 'ยังอยู่ในเรทค่าไฟแพง ควรทยอยปิดแอร์สำนักงานและเครื่องจักรสายการผลิตที่เสร็จสิ้นรอบวันแล้ว'
      },
      {
        id: 'shift-4',
        name: 'กะดึก (22:00 - 06:00 น.)',
        tariff: 'Off-Peak (ค่าไฟถูก 2.60 ฿)',
        isPeak: false,
        kwh: nightOffPeakKWh,
        cost: Math.round(nightOffPeakKWh * offRate),
        advice: 'นาทีทองค่าไฟถูกเกือบครึ่ง! แนะนำให้เดินระบบห้องเย็นแช่แข็ง (Blast Freezer) และชาร์จระบบสำรองในช่วงนี้'
      }
    ];
  }, [hourlyData, reportMode, currentCompany]);

  // Meter-by-Meter Consumption Ranking for the selected timeframe
  const meterBreakdown = useMemo(() => {
    const rawMeters = (currentCompany.electricityMeters || []).filter((m) => m.baseKW > 0);
    const totalBase = rawMeters.reduce((s, m) => s + m.baseKW, 0) || 1;

    return rawMeters
      .map((m) => {
        const share = m.baseKW / totalBase;
        const kwh = Math.round(reportSummary.totalKWh * share);
        const cost = Math.round(reportSummary.totalCost * share);
        return {
          ...m,
          kwh,
          cost,
          sharePct: Number((share * 100).toFixed(1))
        };
      })
      .sort((a, b) => b.kwh - a.kwh);
  }, [currentCompany, reportSummary]);

  return (
    <div className="space-y-5">
      {/* 1. Mobile-App Style Timeframe & Date/Month/Year Selector Card */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <span>รายงานวิเคราะห์การใช้ไฟฟ้า & แผนปรับเวลาการผลิต</span>
            </h2>
            <p className="text-xs text-slate-400">
              เลือกดูสรุปข้อมูลรายวัน รายเดือน หรือรายปี เพื่อวางแผนเดินเครื่องจักรในเวลาค่าไฟถูก
            </p>
          </div>

          {/* 3-Mode Segmented Pill Switcher */}
          <div className="grid grid-cols-3 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold shrink-0">
            <button
              onClick={() => setReportMode('daily')}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                reportMode === 'daily'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📅 รายวัน
            </button>
            <button
              onClick={() => setReportMode('monthly')}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                reportMode === 'monthly'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🗓️ รายเดือน
            </button>
            <button
              onClick={() => setReportMode('yearly')}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                reportMode === 'yearly'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📈 รายปี
            </button>
          </div>
        </div>

        {/* Specific Date / Month / Year Picker Bar */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold text-amber-300">
            📌 {reportSummary.title}
          </span>

          {reportMode === 'daily' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">เลือกวันที่:</label>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value || '2026-10-25')}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-white outline-none focus:border-blue-500 cursor-pointer"
              />
            </div>
          )}

          {reportMode === 'monthly' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">เลือกเดือน:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-blue-500 cursor-pointer"
              >
                {monthNamesFull.map((m) => (
                  <option key={m.val} value={m.val}>
                    เดือน{m.label} {selectedYear}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reportMode === 'yearly' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">เลือกปี พ.ศ.:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="2569">ปี พ.ศ. 2569 (2026 ปัจจุบัน)</option>
                <option value="2568">ปี พ.ศ. 2568 (2025)</option>
                <option value="2567">ปี พ.ศ. 2567 (2024)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 2. Clear 4-Card Report Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 block">หน่วยการใช้ไฟฟ้ารวม</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
            {reportSummary.totalKWh.toLocaleString()}{' '}
            <span className="text-xs font-sans font-normal text-slate-400">kWh</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            รวมทุกมิเตอร์ของบริษัท
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 block">ค่าไฟฟ้ารวมทั้งสิ้น</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400 mt-1">
            ฿{reportSummary.totalCost.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            คำนวณตามอัตรา TOU
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 block">สัดส่วนใช้ไฟช่วงแพง (On-Peak)</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-rose-400 mt-1">
            {reportSummary.onPeakPct}%
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Off-Peak (ค่าไฟถูก): {100 - reportSummary.onPeakPct}%
          </span>
        </div>

        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4">
          <span className="text-xs text-emerald-300 font-semibold block">
            💡 โอกาสลดค่าไฟเมื่อปรับแผนผลิต
          </span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1">
            -฿{reportSummary.potentialSavingsBaht.toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-300/80 mt-1 block">
            หากย้ายโหลด On-Peak 20% ไปกะดึก
          </span>
        </div>
      </div>

      {/* 3. Main Visual Report Chart */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              {reportMode === 'daily' &&
                '📊 กราฟการใช้ไฟฟ้ารายชั่วโมง (00:00 - 23:00 น.) เพื่อดูช่วงเวลาพีคของโรงงาน'}
              {reportMode === 'monthly' &&
                '📊 กราฟการใช้ไฟฟ้ารายวันตลอดเดือน (เปรียบเทียบ On-Peak และ Off-Peak)'}
              {reportMode === 'yearly' &&
                '📊 กราฟสรุปการใช้ไฟฟ้ารายเดือนตลอดทั้งปี (มกราคม - ธันวาคม)'}
            </h3>
            <p className="text-xs text-slate-400">
              ช่วงเวลาพีคสูงสุด: <strong className="text-amber-300">{reportSummary.peakWindowLabel}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
              <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
              On-Peak (ค่าไฟแพง 09:00-22:00)
            </span>
            <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
              Off-Peak (ค่าไฟถูก)
            </span>
          </div>
        </div>

        <div className="h-64 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {reportMode === 'daily' ? (
              <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                  formatter={(value, name) => [
                    name === 'energyKWh' ? `${value.toLocaleString()} kWh` : `฿${value.toLocaleString()}`,
                    name === 'energyKWh' ? 'หน่วยไฟฟ้าที่ใช้' : 'ค่าไฟฟ้า'
                  ]}
                />
                <Bar dataKey="energyKWh" radius={[6, 6, 0, 0]}>
                  {hourlyData.map((entry, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={entry.isOnPeak ? '#f59e0b' : '#10b981'}
                    />
                  ))}
                </Bar>
              </BarChart>
            ) : reportMode === 'monthly' ? (
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="dateLabel" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar
                  dataKey="onPeakKWh"
                  name="On-Peak (ค่าไฟแพง)"
                  stackId="a"
                  fill="#f59e0b"
                />
                <Bar
                  dataKey="offPeakKWh"
                  name="Off-Peak (ค่าไฟถูก)"
                  stackId="a"
                  fill="#10b981"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            ) : (
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar
                  dataKey="onPeakKWh"
                  name="On-Peak (ค่าไฟแพง)"
                  stackId="a"
                  fill="#f59e0b"
                />
                <Bar
                  dataKey="offPeakKWh"
                  name="Off-Peak (ค่าไฟถูก)"
                  stackId="a"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Production Shift Analysis (ตารางวิเคราะห์ 4 กะการผลิต เพื่อปรับแผนการผลิต) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-400" />
            <span>สรุปการใช้ไฟแยกตามกะการผลิต & คำแนะนำปรับแผนการผลิต</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            เปรียบเทียบต้นทุนค่าไฟแต่ละช่วงเวลา เพื่อช่วยตัดสินใจโยกย้ายคิวการผลิตไปช่วงค่าไฟถูก
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {shiftWindows.map((shift) => (
            <div
              key={shift.id}
              className={`rounded-2xl p-4 border ${
                shift.isPeak
                  ? 'bg-amber-950/15 border-amber-500/30'
                  : 'bg-emerald-950/15 border-emerald-500/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-bold text-white text-sm">{shift.name}</span>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    shift.isPeak
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {shift.tariff}
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-950/80 rounded-xl px-3.5 py-2.5 mb-2.5 text-xs">
                <div>
                  <span className="text-slate-400">พลังงานที่ใช้: </span>
                  <strong className="font-mono text-white text-sm">
                    {shift.kwh.toLocaleString()} kWh
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">ค่าไฟ: </span>
                  <strong className="font-mono text-amber-300 text-sm">
                    ฿{shift.cost.toLocaleString()}
                  </strong>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                💡 <strong>แนวทางปรับแผนผลิต:</strong> {shift.advice}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Meter Consumption Ranking Breakdown (จัดอันดับมิเตอร์ที่กินไฟสูงสุดในงวดนี้) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-400" />
              <span>จัดอันดับเครื่องจักร/สายการผลิตที่ใช้ไฟฟ้าสูงสุดในงวดนี้</span>
            </h3>
            <p className="text-xs text-slate-400">
              แตะที่รายการใดก็ได้ เพื่อเปิดดูกราฟรายชั่วโมงของมิเตอร์ตัวนั้น
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {meterBreakdown.map((m, idx) => (
            <div
              key={m.id}
              onClick={() => onSelectMeter && onSelectMeter(m.id)}
              className="bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-3.5 transition-all cursor-pointer"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                      idx === 0
                        ? 'bg-rose-500 text-white'
                        : idx === 1
                        ? 'bg-amber-500 text-slate-950'
                        : idx === 2
                        ? 'bg-amber-500/30 text-amber-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="font-mono text-xs text-amber-300 font-bold">
                    [{m.tag}]
                  </span>
                  <span className="font-bold text-white text-xs sm:text-sm truncate">
                    {m.name}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="font-mono text-slate-300">
                    <strong>{m.kwh.toLocaleString()}</strong> kWh
                  </span>
                  <span className="font-mono font-bold text-amber-300">
                    ฿{m.cost.toLocaleString()}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 font-mono font-bold text-[11px]">
                    {m.sharePct}%
                  </span>
                </div>
              </div>

              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    idx === 0
                      ? 'bg-rose-500'
                      : idx <= 2
                      ? 'bg-amber-400'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, m.sharePct * 2.2)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
