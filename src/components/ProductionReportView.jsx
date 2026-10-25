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
  Lightbulb,
  Flame,
  ArrowRight,
  FileText,
  Maximize2,
  X,
  Camera,
  Printer,
  CheckCircle2,
  EyeOff,
  Eye
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

  // Draft selection state vs Applied state when clicking GO
  const [reportMode, setReportMode] = useState('daily'); // 'daily' | 'monthly' | 'yearly'
  const [selectedDay, setSelectedDay] = useState('2026-10-24');
  const [selectedMonth, setSelectedMonth] = useState('10');
  const [selectedYear, setSelectedYear] = useState('2569');

  // One-Page Landscape Report Modal State (Opened when clicking GO)
  const [isOnePageReportOpen, setIsOnePageReportOpen] = useState(false);
  const [hideControlsForCapture, setHideControlsForCapture] = useState(false);

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
    const dayNum = parseInt(selectedDay.split('-')[2] || '24', 10);
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
      dateLabel: `${d.day}`,
      fullDateLabel: `${d.day} ${mShort}`,
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

  // Compute active period summary
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
        shortPeriod: `วันที่ ${selectedDay.split('-').reverse().join('/')}`,
        totalKWh,
        totalCost,
        onPeakKWh,
        offPeakKWh,
        onPeakPct: Math.round((onPeakKWh / (totalKWh || 1)) * 100),
        peakWindowLabel: `เวลา ${peakItem?.hour || '16:00'} น. (${peakItem?.activeKW || 0} kW)`,
        potentialSavingsBaht: Math.round(
          onPeakKWh * 0.2 * ((currentCompany.peakRate || 5.1) - (currentCompany.offPeakRate || 2.6))
        )
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
        shortPeriod: `เดือน${mLabel} ${selectedYear}`,
        totalKWh,
        totalCost,
        onPeakKWh,
        offPeakKWh,
        onPeakPct: Math.round((onPeakKWh / (totalKWh || 1)) * 100),
        peakWindowLabel: `วันที่ ${peakDay?.fullDateLabel} (${peakDay?.totalKWh.toLocaleString()} kWh)`,
        potentialSavingsBaht: Math.round(
          onPeakKWh * 0.2 * ((currentCompany.peakRate || 5.1) - (currentCompany.offPeakRate || 2.6))
        )
      };
    }

    const totalKWh = monthlyData.reduce((s, m) => s + m.totalKWh, 0);
    const totalCost = monthlyData.reduce((s, m) => s + m.costBaht, 0);
    const onPeakKWh = monthlyData.reduce((s, m) => s + m.onPeakKWh, 0);
    const offPeakKWh = totalKWh - onPeakKWh;
    const peakMonth = [...monthlyData].sort((a, b) => b.totalKWh - a.totalKWh)[0];

    return {
      title: `รายงานสรุปประจำปี พ.ศ. ${selectedYear}`,
      shortPeriod: `ปี พ.ศ. ${selectedYear}`,
      totalKWh,
      totalCost,
      onPeakKWh,
      offPeakKWh,
      onPeakPct: Math.round((onPeakKWh / (totalKWh || 1)) * 100),
      peakWindowLabel: `เดือน${peakMonth?.month} (${peakMonth?.totalKWh.toLocaleString()} kWh)`,
      potentialSavingsBaht: Math.round(
        onPeakKWh * 0.2 * ((currentCompany.peakRate || 5.1) - (currentCompany.offPeakRate || 2.6))
      )
    };
  }, [reportMode, hourlyData, dailyData, monthlyData, selectedDay, selectedMonth, selectedYear, currentCompany]);

  // 4 Production Shift Windows Breakdown
  const shiftWindows = useMemo(() => {
    const scale = reportMode === 'daily' ? 1 : reportMode === 'monthly' ? 30 : 365;
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
        name: 'กะเช้าตรู่ (06:00-09:00)',
        tariff: 'Off-Peak 2.60฿',
        isPeak: false,
        kwh: morningKWh,
        cost: Math.round(morningKWh * offRate),
        advice: 'เดินระบบทำความเย็นล่วงหน้า (Pre-Cooling) และอุ่นเตาก่อน 09:00 น.'
      },
      {
        id: 'shift-2',
        name: 'กะกลางวัน (09:00-17:00)',
        tariff: 'On-Peak 5.10฿',
        isPeak: true,
        kwh: dayPeakKWh,
        cost: Math.round(dayPeakKWh * peakRate),
        advice: 'ค่าไฟแพงสุด! เลี่ยงเปิดเครื่องจักรโหลดหนักพร้อมกัน ย้ายงานรอได้ไปกะดึก'
      },
      {
        id: 'shift-3',
        name: 'กะเย็น-ค่ำ (17:00-22:00)',
        tariff: 'On-Peak 5.10฿',
        isPeak: true,
        kwh: eveningPeakKWh,
        cost: Math.round(eveningPeakKWh * peakRate),
        advice: 'ยังอยู่ในเรทแพง ควรทยอยปิดแอร์และสายการผลิตที่เสร็จสิ้นรอบวัน'
      },
      {
        id: 'shift-4',
        name: 'กะดึก (22:00-06:00)',
        tariff: 'Off-Peak 2.60฿',
        isPeak: false,
        kwh: nightOffPeakKWh,
        cost: Math.round(nightOffPeakKWh * offRate),
        advice: 'ค่าไฟถูกเกือบครึ่ง! เหมาะเดินเครื่องห้องเย็นแช่แข็ง (Blast Freezer) เต็มพิกัด'
      }
    ];
  }, [hourlyData, reportMode, currentCompany]);

  // Meter-by-Meter Consumption Ranking
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
      {/* =================================================================== */}
      {/* ONE-PAGE LANDSCAPE REPORT OVERLAY (เปิดเมื่อกดปุ่ม GO)              */}
      {/* ออกแบบให้แสดงครบในหน้าเดียวแนวนอน เพื่อแคปหน้าจอทำรายงานได้ทันที   */}
      {/* =================================================================== */}
      {isOnePageReportOpen && (
        <div className="fixed inset-0 z-50 bg-[#050811] text-slate-100 overflow-y-auto lg:overflow-hidden flex flex-col justify-between p-3 sm:p-5 select-none sm:select-auto">
          {/* Top Action Controls (Can be hidden with 1 click for 100% clean screenshot) */}
          {!hideControlsForCapture ? (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/95 border border-blue-500/40 rounded-2xl px-4 py-2 mb-2.5 shadow-lg shrink-0 print:hidden">
              <div className="flex items-center gap-2 text-xs">
                <Camera className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white">
                  โหมดรายงานสรุปหน้าเดียวแนวนอน (สำหรับแคปหน้าจอส่งรายงาน)
                </span>
                <span className="hidden md:inline text-slate-400">
                  • จัดวางข้อมูลครบใน 1 หน้าจอโดยไม่ต้องเลื่อน
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHideControlsForCapture(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold cursor-pointer transition-all"
                  title="ซ่อนแถบเมนูนี้ชั่วคราวเพื่อแคปหน้าจอให้เต็มแผ่น"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>ซ่อนปุ่มเพื่อแคปจอ</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>พิมพ์ / PDF</span>
                </button>

                <button
                  onClick={() => setIsOnePageReportOpen(false)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  <X className="w-4 h-4" />
                  <span>ปิดหน้ารายงาน</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setHideControlsForCapture(false)}
              className="fixed top-2 right-2 z-50 px-2.5 py-1 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-[10px] border border-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Eye className="w-3 h-3" /> แสดงปุ่มปิด
            </button>
          )}

          {/* SINGLE-PAGE LANDSCAPE BOARD */}
          <div className="flex-1 flex flex-col justify-between bg-[#090d1a] border-2 border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl overflow-hidden">
            {/* 1. Report Official Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
                  <Zap className="w-5 h-5 text-yellow-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-bold text-white">
                      {currentCompany.name}
                    </h1>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded">
                      หม้อแปลง {currentCompany.transformerKVA} kVA
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    รายงานวิเคราะห์การใช้พลังงานไฟฟ้าและแผนบริหารจัดการโหลดการผลิต (PowerView Energy Report)
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 border border-amber-500/40 rounded-xl px-4 py-2 text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-mono">
                  งวดรายงานที่ตรวจสอบ
                </span>
                <span className="text-sm sm:text-base font-bold text-amber-300">
                  📌 {reportSummary.title}
                </span>
              </div>
            </div>

            {/* 2. Top 4 Executive KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-3 shrink-0">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">หน่วยการใช้ไฟฟ้ารวม</span>
                  <span className="text-lg sm:text-2xl font-bold font-mono text-white">
                    {reportSummary.totalKWh.toLocaleString()}{' '}
                    <small className="text-xs font-sans text-slate-400">kWh</small>
                  </span>
                </div>
                <Zap className="w-6 h-6 text-blue-400/60" />
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">ค่าไฟฟ้ารวมทั้งสิ้น</span>
                  <span className="text-lg sm:text-2xl font-bold font-mono text-amber-400">
                    ฿{reportSummary.totalCost.toLocaleString()}
                  </span>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300">
                  TOU
                </span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">
                    สัดส่วน On-Peak (แพง) : Off-Peak (ถูก)
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg sm:text-2xl font-bold font-mono text-rose-400">
                      {reportSummary.onPeakPct}%
                    </span>
                    <span className="text-xs font-mono text-emerald-400">
                      : {100 - reportSummary.onPeakPct}%
                    </span>
                  </div>
                </div>
                <Clock className="w-6 h-6 text-rose-400/60" />
              </div>

              <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-emerald-300 font-semibold block">
                    เป้าหมายลดค่าไฟเมื่อปรับแผนผลิต
                  </span>
                  <span className="text-lg sm:text-2xl font-bold font-mono text-emerald-400">
                    -฿{reportSummary.potentialSavingsBaht.toLocaleString()}
                  </span>
                </div>
                <Lightbulb className="w-6 h-6 text-emerald-400" />
              </div>
            </div>

            {/* 3. Main 12-Column Landscape Content Grid (Fits in 1 Screen) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3.5 min-h-0">
              {/* LEFT 5 COLS: Load Profile Chart */}
              <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between min-h-[240px]">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white">
                      📊 กราฟการใช้ไฟฟ้า ({reportSummary.shortPeriod})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      พีคสูงสุด: <strong className="text-amber-300">{reportSummary.peakWindowLabel}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-1 text-amber-300 font-bold">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                      On-Peak
                    </span>
                    <span className="flex items-center gap-1 text-emerald-300 font-bold">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                      Off-Peak
                    </span>
                  </div>
                </div>

                <div className="flex-1 w-full min-h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {reportMode === 'daily' ? (
                      <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="hour" stroke="#94a3b8" fontSize={9} interval={1} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Bar dataKey="energyKWh" radius={[4, 4, 0, 0]}>
                          {hourlyData.map((entry, idx) => (
                            <Cell
                              key={`c-${idx}`}
                              fill={entry.isOnPeak ? '#f59e0b' : '#10b981'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : reportMode === 'monthly' ? (
                      <BarChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="dateLabel" stroke="#94a3b8" fontSize={9} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Bar dataKey="onPeakKWh" stackId="a" fill="#f59e0b" />
                        <Bar
                          dataKey="offPeakKWh"
                          stackId="a"
                          fill="#10b981"
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    ) : (
                      <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Bar dataKey="onPeakKWh" stackId="a" fill="#f59e0b" />
                        <Bar
                          dataKey="offPeakKWh"
                          stackId="a"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* MIDDLE 4 COLS: 4-Shift Production Analysis & Recommendations */}
              <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="mb-1.5">
                  <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <span>วิเคราะห์ 4 กะการผลิต & แผนปรับเวลาเดินเครื่อง</span>
                  </h3>
                </div>

                <div className="flex-1 grid grid-cols-1 gap-2 overflow-y-auto pr-0.5">
                  {shiftWindows.map((shift) => (
                    <div
                      key={shift.id}
                      className={`rounded-xl px-3 py-2 border flex flex-col justify-between ${
                        shift.isPeak
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : 'bg-emerald-950/20 border-emerald-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-white">{shift.name}</span>
                        <span className="font-mono font-bold text-amber-300">
                          {shift.kwh.toLocaleString()} kWh (฿{shift.cost.toLocaleString()})
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-0.5 leading-snug">
                        • {shift.advice}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT 3 COLS: Top Meter Ranking Table */}
              <div className="lg:col-span-3 bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-rose-400" />
                    <span>อันดับมิเตอร์ที่ใช้ไฟสูงสุด</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    รวม {meterBreakdown.length} จุด
                  </span>
                </div>

                <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 max-h-[260px] lg:max-h-none">
                  {meterBreakdown.slice(0, 7).map((m, idx) => (
                    <div
                      key={m.id}
                      className="bg-slate-950/90 border border-slate-800/90 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[11px]"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-1">
                        <span
                          className={`w-4 h-4 rounded text-[10px] font-mono font-bold flex items-center justify-center shrink-0 ${
                            idx === 0
                              ? 'bg-rose-500 text-white'
                              : idx <= 2
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="font-medium text-white truncate" title={m.name}>
                          {m.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <span className="text-amber-300 font-bold">
                          {m.kwh.toLocaleString()}
                        </span>{' '}
                        <span className="text-[10px] text-slate-400">({m.sharePct}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Report Footer */}
            <div className="pt-2.5 mt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
              <span>
                เอกสารสรุปข้อมูลพลังงานอัตโนมัติ • รหัสไซต์: {currentCompany.code} ({currentCompany.formCode})
              </span>
              <span>
                On-Peak (09:00-22:00 น.): {currentCompany.peakRate || 5.1} ฿/kWh • Off-Peak (22:00-09:00 น.): {currentCompany.offPeakRate || 2.6} ฿/kWh
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STANDARD PAGE: PERIOD SELECTOR + "GO" BUTTON                        */}
      {/* =================================================================== */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <span>รายงานวิเคราะห์การใช้ไฟฟ้า & แผนปรับเวลาการผลิต</span>
            </h2>
            <p className="text-xs text-slate-400">
              เลือกวัน เดือน หรือปี แล้วกดปุ่ม <strong className="text-emerald-400">GO</strong> เพื่อเปิดหน้ารายงานสรุปแนวนอนหน้าเดียวสำหรับแคปหน้าจอ
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

        {/* Specific Date / Month / Year Picker + Prominent GO Button */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs sm:text-sm font-bold text-amber-300">
            📌 {reportSummary.title}
          </span>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            {reportMode === 'daily' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">เลือกวันที่:</label>
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value || '2026-10-24')}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-blue-500 cursor-pointer"
                />
              </div>
            )}

            {reportMode === 'monthly' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">เลือกเดือน:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500 cursor-pointer"
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
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="2569">ปี พ.ศ. 2569 (2026 ปัจจุบัน)</option>
                  <option value="2568">ปี พ.ศ. 2568 (2025)</option>
                  <option value="2567">ปี พ.ศ. 2567 (2024)</option>
                </select>
              </div>
            )}

            {/* PROMINENT "GO" BUTTON TO OPEN SINGLE-PAGE LANDSCAPE REPORT */}
            <button
              type="button"
              onClick={() => {
                setHideControlsForCapture(false);
                setIsOnePageReportOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-95 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
            >
              <span>GO • แสดงรายงานหน้าเดียว (แคปจอ)</span>
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
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
                <XAxis dataKey="fullDateLabel" stroke="#94a3b8" fontSize={10} />
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

      {/* 4. Production Shift Analysis */}
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

      {/* 5. Meter Consumption Ranking Breakdown */}
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
