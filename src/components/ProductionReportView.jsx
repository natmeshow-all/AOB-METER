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
  Cell,
  LabelList
} from 'recharts';
import {
  Clock,
  Zap,
  Lightbulb,
  Flame,
  FileText,
  Maximize2,
  X,
  Camera,
  Printer,
  EyeOff,
  Eye,
  Gauge,
  Activity,
  CheckCircle2
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
  const currentCompany = TENANT_COMPANIES[activeOrgId] ||
    Object.values(TENANT_COMPANIES)[0] || {
      id: '',
      name: 'ยังไม่มีบริษัทลูกค้าในระบบ',
      code: '-',
      transformerKVA: 1600,
      electricityMeters: []
    };

  // Report Mode: 'daily' | 'monthly' | 'yearly'
  const [reportMode, setReportMode] = useState('daily');
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

  // 1. Hourly data (24 hours) - Pure Electrical Telemetry (kW & kWh)
  const hourlyData = useMemo(() => {
    const base = generateHourlyData(currentCompany.id);
    const dayNum = parseInt(selectedDay.split('-')[2] || '24', 10);
    const mod = 0.92 + (dayNum % 7) * 0.025;
    return base.map((h) => ({
      ...h,
      energyKWh: Math.round(h.energyKWh * mod),
      activeKW: Math.round(h.activeKW * mod)
    }));
  }, [currentCompany.id, selectedDay]);

  // 2. Daily data (30 days)
  const dailyData = useMemo(() => {
    const base = generateDailyData(currentCompany.id, 30);
    const mNum = parseInt(selectedMonth, 10);
    const mod = 0.94 + (mNum % 5) * 0.03;
    const mShort =
      monthNamesFull.find((m) => m.val === selectedMonth)?.label.slice(0, 4) || 'ต.ค.';
    return base.map((d) => {
      const totalKWh = Math.round(d.totalKWh * mod);
      const onPeakKWh = Math.round(d.onPeakKWh * mod);
      const offPeakKWh = totalKWh - onPeakKWh;
      return {
        ...d,
        dateLabel: `${d.day}`,
        fullDateLabel: `${d.day} ${mShort}`,
        totalKWh,
        onPeakKWh,
        offPeakKWh
      };
    });
  }, [currentCompany.id, selectedMonth]);

  // 3. Monthly data (12 months)
  const monthlyData = useMemo(() => {
    const base = generateMonthlyData(currentCompany.id);
    const yMod = selectedYear === '2569' ? 1.0 : selectedYear === '2568' ? 1.06 : 1.12;
    return base.map((m) => {
      const totalKWh = Math.round(m.totalKWh * yMod);
      const onPeakKWh = Math.round(totalKWh * 0.65);
      const offPeakKWh = totalKWh - onPeakKWh;
      return {
        ...m,
        totalKWh,
        onPeakKWh,
        offPeakKWh
      };
    });
  }, [currentCompany.id, selectedYear]);

  // Comprehensive Pure Electrical Report Summary (No Price/Cost)
  const reportSummary = useMemo(() => {
    const trKVA = currentCompany.transformerKVA || 1600;
    const maxSafeKW = Math.round(trKVA * 0.85);

    if (reportMode === 'daily') {
      const totalKWh = hourlyData.reduce((s, h) => s + h.energyKWh, 0);
      const onPeakKWh = hourlyData
        .filter((h) => h.isOnPeak)
        .reduce((s, h) => s + h.energyKWh, 0);
      const offPeakKWh = totalKWh - onPeakKWh;

      const peakItem = [...hourlyData].sort((a, b) => b.activeKW - a.activeKW)[0];
      const minItem = [...hourlyData].sort((a, b) => a.activeKW - b.activeKW)[0];
      const avgKW = Math.round(totalKWh / 24);
      const peakKW = peakItem?.activeKW || 898;
      const trLoadPct = Math.round((peakKW / maxSafeKW) * 100);
      const loadFactorPct = Math.round((avgKW / (peakKW || 1)) * 100);
      const onPeakPct = Math.round((onPeakKWh / (totalKWh || 1)) * 100);
      const shiftableKWh = Math.round(onPeakKWh * 0.2);

      return {
        title: `รายงานสรุปประจำวันที่ ${selectedDay.split('-').reverse().join('/')}`,
        shortPeriod: `วันที่ ${selectedDay.split('-').reverse().join('/')}`,
        totalKWh,
        onPeakKWh,
        offPeakKWh,
        onPeakPct,
        offPeakPct: 100 - onPeakPct,
        peakKW,
        avgKW,
        minKW: minItem?.activeKW || 450,
        minHour: minItem?.hour || '04:00',
        peakHour: peakItem?.hour || '16:00',
        peakWindowLabel: `เวลา ${peakItem?.hour || '16:00'} น. (${peakKW} kW)`,
        trLoadPct,
        loadFactorPct,
        avgPF: 0.95,
        shiftableKWh
      };
    }

    if (reportMode === 'monthly') {
      const totalKWh = dailyData.reduce((s, d) => s + d.totalKWh, 0);
      const onPeakKWh = dailyData.reduce((s, d) => s + d.onPeakKWh, 0);
      const offPeakKWh = totalKWh - onPeakKWh;

      const peakDay = [...dailyData].sort((a, b) => b.totalKWh - a.totalKWh)[0];
      const minDay = [...dailyData].sort((a, b) => a.totalKWh - b.totalKWh)[0];
      const avgKW = Math.round(totalKWh / (30 * 24));
      const peakKW = peakDay?.peakKW || 920;
      const trLoadPct = Math.round((peakKW / maxSafeKW) * 100);
      const loadFactorPct = Math.round((avgKW / (peakKW || 1)) * 100);
      const onPeakPct = Math.round((onPeakKWh / (totalKWh || 1)) * 100);
      const shiftableKWh = Math.round(onPeakKWh * 0.2);
      const mLabel = monthNamesFull.find((m) => m.val === selectedMonth)?.label || 'ตุลาคม';

      return {
        title: `รายงานสรุปประจำเดือน ${mLabel} ${selectedYear}`,
        shortPeriod: `เดือน${mLabel} ${selectedYear}`,
        totalKWh,
        onPeakKWh,
        offPeakKWh,
        onPeakPct,
        offPeakPct: 100 - onPeakPct,
        peakKW,
        avgKW,
        minKW: Math.round((minDay?.totalKWh || 12000) / 24),
        minHour: minDay?.fullDateLabel || 'วันอาทิตย์',
        peakHour: peakDay?.fullDateLabel || '15 ต.ค.',
        peakWindowLabel: `วันที่ ${peakDay?.fullDateLabel} (${peakDay?.totalKWh.toLocaleString()} kWh)`,
        trLoadPct,
        loadFactorPct,
        avgPF: 0.94,
        shiftableKWh
      };
    }

    // Yearly
    const totalKWh = monthlyData.reduce((s, m) => s + m.totalKWh, 0);
    const onPeakKWh = monthlyData.reduce((s, m) => s + m.onPeakKWh, 0);
    const offPeakKWh = totalKWh - onPeakKWh;

    const peakMonth = [...monthlyData].sort((a, b) => b.totalKWh - a.totalKWh)[0];
    const minMonth = [...monthlyData].sort((a, b) => a.totalKWh - b.totalKWh)[0];
    const avgKW = Math.round(totalKWh / (365 * 24));
    const peakKW = peakMonth?.peakKW || 960;
    const trLoadPct = Math.round((peakKW / maxSafeKW) * 100);
    const loadFactorPct = Math.round((avgKW / (peakKW || 1)) * 100);
    const onPeakPct = Math.round((onPeakKWh / (totalKWh || 1)) * 100);
    const shiftableKWh = Math.round(onPeakKWh * 0.2);

    return {
      title: `รายงานสรุปประจำปี พ.ศ. ${selectedYear}`,
      shortPeriod: `ปี พ.ศ. ${selectedYear}`,
      totalKWh,
      onPeakKWh,
      offPeakKWh,
      onPeakPct,
      offPeakPct: 100 - onPeakPct,
      peakKW,
      avgKW,
      minKW: Math.round((minMonth?.totalKWh || 350000) / 720),
      minHour: `เดือน${minMonth?.month || 'ม.ค.'}`,
      peakHour: `เดือน${peakMonth?.month || 'เม.ย.'}`,
      peakWindowLabel: `เดือน${peakMonth?.month} (${peakMonth?.totalKWh.toLocaleString()} kWh)`,
      trLoadPct,
      loadFactorPct,
      avgPF: 0.94,
      shiftableKWh
    };
  }, [
    reportMode,
    hourlyData,
    dailyData,
    monthlyData,
    selectedDay,
    selectedMonth,
    selectedYear,
    currentCompany
  ]);

  // 4 Production Shift Windows (Pure Electrical Load & Production Guidance)
  const shiftWindows = useMemo(() => {
    const scale = reportMode === 'daily' ? 1 : reportMode === 'monthly' ? 30 : 365;

    const buildShift = (id, name, hoursLabel, hoursFilter, isPeak, periodBadge, advice) => {
      const matched = hourlyData.filter(hoursFilter);
      const kwh = matched.reduce((s, h) => s + h.energyKWh, 0) * scale;
      const avgKW = Math.round(
        matched.reduce((s, h) => s + h.activeKW, 0) / (matched.length || 1)
      );
      const maxKW = Math.max(...matched.map((h) => h.activeKW), 0);
      const sharePct = Number(((kwh / (reportSummary.totalKWh || 1)) * 100).toFixed(1));

      return {
        id,
        name,
        hoursLabel,
        periodBadge,
        isPeak,
        kwh,
        avgKW,
        maxKW,
        sharePct,
        advice
      };
    };

    return [
      buildShift(
        'shift-1',
        '1. กะเช้าตรู่ (06:00 - 09:00 น.)',
        'ช่วงเตรียมเดินเครื่อง (3 ชม.)',
        (h) => h.hourNum >= 6 && h.hourNum < 9,
        false,
        'Off-Peak',
        'เดินระบบทำความเย็นล่วงหน้า (Pre-cooling) และอุ่นเตา/เครื่องจักรก่อนเวลา 09:00 น.'
      ),
      buildShift(
        'shift-2',
        '2. กะกลางวัน (09:00 - 17:00 น.)',
        'ช่วงการผลิตหลัก (8 ชม.)',
        (h) => h.hourNum >= 9 && h.hourNum < 17,
        true,
        'On-Peak',
        'โหลดสูงสุดของวัน ควรสลับคิวเดินเครื่องจักรขนาดใหญ่ ไม่ให้พีคชนกันในช่วงบ่าย'
      ),
      buildShift(
        'shift-3',
        '3. กะเย็น-ค่ำ (17:00 - 22:00 น.)',
        'ช่วงผลิตต่อเนื่อง (5 ชม.)',
        (h) => h.hourNum >= 17 && h.hourNum < 22,
        true,
        'On-Peak',
        'ทยอยปิดระบบปรับอากาศสำนักงานและลดโหลดปั๊มลมในไลน์ที่จบการผลิตแล้ว'
      ),
      buildShift(
        'shift-4',
        '4. กะดึก (22:00 - 06:00 น.)',
        'ช่วงเดินเครื่องกลางคืน (8 ชม.)',
        (h) => h.hourNum >= 22 || h.hourNum < 6,
        false,
        'Off-Peak',
        'โหลดหม้อแปลงว่าง เหมาะสำหรับเดินเครื่องห้องเย็นแช่แข็ง (Blast Freezer) เต็มพิกัด'
      )
    ];
  }, [hourlyData, reportMode, reportSummary.totalKWh]);

  // Complete Meter-by-Meter Breakdown (ALL Meters of the company - Pure Electrical)
  const meterBreakdown = useMemo(() => {
    const rawMeters = currentCompany.electricityMeters || [];
    const totalBase =
      rawMeters.reduce((s, m) => s + (Number(m.liveKW ?? m.baseKW) || 0), 0) || 1;

    return rawMeters
      .map((m, idx) => {
        const mKW = Number(m.liveKW ?? m.baseKW) || 0;
        const share = mKW > 0 ? mKW / totalBase : 0;
        const kwh = Math.round(reportSummary.totalKWh * share);
        const onPeakRatio = (m.name || '').toLowerCase().includes('refrig') ? 0.58 : 0.71;
        const onPeakKWh = Math.round(kwh * onPeakRatio);
        const offPeakKWh = kwh - onPeakKWh;
        const peakKW = Number((mKW * 1.08).toFixed(1));

        return {
          ...m,
          rank: idx + 1,
          peakKW,
          onPeakKWh,
          offPeakKWh,
          kwh,
          sharePct: Number((share * 100).toFixed(1))
        };
      })
      .sort((a, b) => b.kwh - a.kwh)
      .map((m, i) => ({ ...m, rank: i + 1 }));
  }, [currentCompany, reportSummary]);

  return (
    <div className="space-y-5">
      {/* =================================================================== */}
      {/* FULL-SCREEN ONE-PAGE LANDSCAPE REPORT (เปิดเมื่อกดปุ่ม GO)           */}
      {/* สัดส่วนเต็มจอ ไม่มีพื้นที่ว่าง ตัวเลขสรุปใหญ่ คมชัด ไร้ราคาค่าไฟ      */}
      {/* =================================================================== */}
      {isOnePageReportOpen && (
        <div className="fixed inset-0 z-50 bg-[#04070e] text-slate-100 overflow-y-auto xl:overflow-hidden flex flex-col p-2 sm:p-3 select-none sm:select-auto">
          {/* Top Action Controls */}
          {!hideControlsForCapture ? (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-blue-500/40 rounded-xl px-4 py-1.5 mb-2 shadow-lg shrink-0 print:hidden">
              <div className="flex items-center gap-2 text-xs">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white">
                  โหมดรายงานสรุปหน้าเดียวแนวนอน (สำหรับแคปหน้าจอทำรายงานและวางแผนการผลิต)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHideControlsForCapture(true)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold cursor-pointer transition-all"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>ซ่อนปุ่มเพื่อแคปจอ</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>พิมพ์ / PDF</span>
                </button>

                <button
                  onClick={() => setIsOnePageReportOpen(false)}
                  className="flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
                >
                  <X className="w-4 h-4" />
                  <span>ปิดหน้ารายงาน</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setHideControlsForCapture(false)}
              className="fixed top-2 right-2 z-50 px-2.5 py-1 bg-slate-900/90 hover:bg-slate-800 text-amber-300 rounded-lg text-[10px] border border-amber-500/40 flex items-center gap-1 cursor-pointer shadow-lg"
            >
              <Eye className="w-3 h-3" /> แสดงปุ่มควบคุม
            </button>
          )}

          {/* SINGLE-PAGE LANDSCAPE MASTER SHEET */}
          <div className="flex-1 flex flex-col bg-[#080d1a] border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xl overflow-hidden gap-2.5">
            {/* 1. Header Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Zap className="w-5 h-5 text-yellow-300" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-base sm:text-xl font-extrabold text-white tracking-tight">
                      {currentCompany.name}
                    </h1>
                    <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-lg">
                      หม้อแปลง {currentCompany.transformerKVA} kVA
                    </span>
                    <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-lg">
                      มิเตอร์ออนไลน์ {meterBreakdown.length} จุดวัด
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    รายงานสรุปการใช้พลังงานไฟฟ้าและวิเคราะห์โหลดการผลิต (PowerView Industrial Energy Report)
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 border-2 border-amber-500/50 rounded-xl px-4 py-1.5 text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-mono">
                  งวดรายงานที่ตรวจสอบ
                </span>
                <span className="text-sm sm:text-lg font-extrabold text-amber-300">
                  📌 {reportSummary.title}
                </span>
              </div>
            </div>

            {/* 2. Top 4 Large Hero Summary Cards (ตัวใหญ่ คมชัด 100%) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
              {/* Card 1: Total Energy */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-300 block">
                    ⚡ พลังงานไฟฟ้ารวมทั้งสิ้น
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white mt-0.5 tracking-tight">
                    {reportSummary.totalKWh.toLocaleString()}{' '}
                    <span className="text-xs sm:text-sm font-sans font-normal text-slate-400">
                      kWh
                    </span>
                  </div>
                  <span className="text-xs text-blue-300 font-mono">
                    กำลังไฟฟ้าเฉลี่ย {reportSummary.avgKW} kW/ชม.
                  </span>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <Zap className="w-6 h-6 text-blue-400" />
                </div>
              </div>

              {/* Card 2: On-Peak Energy */}
              <div className="bg-gradient-to-br from-amber-950/35 to-slate-950 border border-amber-500/40 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-300 block">
                    ☀️ ใช้ไฟช่วง On-Peak (09:00-22:00)
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-300 mt-0.5 tracking-tight">
                    {reportSummary.onPeakKWh.toLocaleString()}{' '}
                    <span className="text-xs sm:text-sm font-sans font-normal text-amber-200/70">
                      kWh
                    </span>
                  </div>
                  <span className="text-xs text-amber-200 font-bold">
                    คิดเป็นสัดส่วน {reportSummary.onPeakPct}% ของทั้งหมด
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-extrabold text-lg">
                  {reportSummary.onPeakPct}%
                </div>
              </div>

              {/* Card 3: Off-Peak Energy */}
              <div className="bg-gradient-to-br from-emerald-950/35 to-slate-950 border border-emerald-500/40 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-300 block">
                    🌙 ใช้ไฟช่วง Off-Peak (22:00-09:00)
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-300 mt-0.5 tracking-tight">
                    {reportSummary.offPeakKWh.toLocaleString()}{' '}
                    <span className="text-xs sm:text-sm font-sans font-normal text-emerald-200/70">
                      kWh
                    </span>
                  </div>
                  <span className="text-xs text-emerald-200 font-bold">
                    คิดเป็นสัดส่วน {reportSummary.offPeakPct}% ของทั้งหมด
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-extrabold text-lg">
                  {reportSummary.offPeakPct}%
                </div>
              </div>

              {/* Card 4: Peak Demand & Transformer Load */}
              <div className="bg-gradient-to-br from-rose-950/30 to-slate-950 border border-rose-500/40 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-rose-300 block">
                    🔥 พีคสูงสุด (Peak Demand)
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold font-mono text-rose-400 mt-0.5 tracking-tight">
                    {reportSummary.peakKW.toLocaleString()}{' '}
                    <span className="text-xs sm:text-sm font-sans font-normal text-slate-300">
                      kW
                    </span>
                  </div>
                  <span className="text-xs text-slate-300 font-mono">
                    เวลา {reportSummary.peakHour} • ภาระหม้อแปลง {reportSummary.trLoadPct}%
                  </span>
                </div>
                <div className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono font-extrabold text-sm text-center">
                  <div>PF</div>
                  <div>{reportSummary.avgPF}</div>
                </div>
              </div>
            </div>

            {/* 3. Main 12-Column Landscape Content Grid (Zero Empty Space!) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2.5 min-h-0">
              {/* =============================================================== */}
              {/* LEFT 5 COLUMNS: FULL-HEIGHT EXPANDED CHART + CRISP HOUR GRID    */}
              {/* =============================================================== */}
              <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2.5 min-h-0">
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white">
                      📊 กราฟการใช้ไฟฟ้ารายช่วงเวลา ({reportSummary.shortPeriod})
                    </h3>
                    <p className="text-xs text-slate-300">
                      พีคสูงสุด: <strong className="text-rose-400 font-mono">{reportSummary.peakKW} kW ({reportSummary.peakHour})</strong> • ต่ำสุด: <strong className="text-emerald-400 font-mono">{reportSummary.minKW} kW ({reportSummary.minHour})</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <span className="flex items-center gap-1.5 text-amber-300 font-bold">
                      <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                      On-Peak
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-300 font-bold">
                      <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                      Off-Peak
                    </span>
                  </div>
                </div>

                {/* Tall, Dynamic Flex-1 Chart that fills all vertical space */}
                <div className="flex-1 w-full min-h-[210px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {reportMode === 'daily' ? (
                      <BarChart data={hourlyData} margin={{ top: 20, right: 6, left: -18, bottom: 2 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="hour"
                          stroke="#cbd5e1"
                          fontSize={10}
                          fontWeight="bold"
                          interval={0}
                          angle={-35}
                          textAnchor="end"
                          height={28}
                        />
                        <YAxis stroke="#cbd5e1" fontSize={10} fontWeight="bold" />
                        <Bar dataKey="energyKWh" radius={[4, 4, 0, 0]}>
                          <LabelList
                            dataKey="energyKWh"
                            position="top"
                            fill="#ffffff"
                            fontSize={9.5}
                            fontWeight="bold"
                          />
                          {hourlyData.map((entry, idx) => (
                            <Cell
                              key={`c-${idx}`}
                              fill={entry.isOnPeak ? '#f59e0b' : '#10b981'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : reportMode === 'monthly' ? (
                      <BarChart data={dailyData} margin={{ top: 18, right: 6, left: -18, bottom: 2 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="dateLabel" stroke="#cbd5e1" fontSize={10} fontWeight="bold" interval={0} />
                        <YAxis stroke="#cbd5e1" fontSize={10} fontWeight="bold" />
                        <Bar dataKey="onPeakKWh" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="offPeakKWh" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    ) : (
                      <BarChart data={monthlyData} margin={{ top: 20, right: 6, left: -12, bottom: 2 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="month" stroke="#cbd5e1" fontSize={11} fontWeight="bold" interval={0} />
                        <YAxis stroke="#cbd5e1" fontSize={10} fontWeight="bold" />
                        <Bar dataKey="onPeakKWh" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="offPeakKWh" stackId="a" fill="#10b981" radius={[5, 5, 0, 0]}>
                          <LabelList
                            dataKey="totalKWh"
                            position="top"
                            fill="#ffffff"
                            fontSize={9.5}
                            fontWeight="bold"
                          />
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* Crisp Bottom Data Matrix (No Empty Gap, Big Numbers, Pure kWh) */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 shrink-0">
                  <div className="text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                    <span>
                      {reportMode === 'daily'
                        ? '📋 สรุปหน่วยไฟฟ้ารายชั่วโมงครบ 24 ชม. (kWh)'
                        : reportMode === 'monthly'
                        ? '📋 สรุปหน่วยไฟฟ้ารายวัน (วันที่ 1 - 30)'
                        : '📋 สรุปหน่วยไฟฟ้ารายเดือนทั้ง 12 เดือน (kWh)'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      สีส้ม = On-Peak • สีเขียว = Off-Peak
                    </span>
                  </div>

                  {reportMode === 'daily' ? (
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 font-mono">
                      {hourlyData.map((h) => (
                        <div
                          key={h.hour}
                          className={`px-1.5 py-1 rounded-lg border text-center ${
                            h.isOnPeak
                              ? 'bg-amber-950/30 border-amber-500/40'
                              : 'bg-emerald-950/30 border-emerald-500/40'
                          }`}
                        >
                          <div className="text-[10px] text-slate-400 font-semibold">{h.hour}</div>
                          <div
                            className={`text-xs sm:text-sm font-extrabold ${
                              h.isOnPeak ? 'text-amber-300' : 'text-emerald-300'
                            }`}
                          >
                            {h.energyKWh}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : reportMode === 'monthly' ? (
                    <div className="grid grid-cols-6 sm:grid-cols-10 gap-1 font-mono">
                      {dailyData.map((d) => (
                        <div
                          key={d.day}
                          className="px-1 py-1 rounded-lg bg-slate-900 border border-slate-800 text-center"
                        >
                          <div className="text-[9px] text-slate-400">วันที่ {d.day}</div>
                          <div className="text-xs font-extrabold text-amber-300">
                            {d.totalKWh.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 font-mono">
                      {monthlyData.map((m) => (
                        <div
                          key={m.month}
                          className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-center"
                        >
                          <div className="text-[10px] text-slate-400 font-sans font-bold">
                            {m.month}
                          </div>
                          <div className="text-xs sm:text-sm font-extrabold text-amber-300">
                            {m.totalKWh.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* =============================================================== */}
              {/* MIDDLE 3 COLUMNS: 4-SHIFT PRODUCTION LOAD ANALYSIS (BIG TEXT)   */}
              {/* =============================================================== */}
              <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2 min-h-0">
                <div className="shrink-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>สรุปโหลด 4 กะการผลิต</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    เปรียบเทียบหน่วยไฟและโหลดแต่ละกะเพื่อเกลี่ยคิวผลิต
                  </p>
                </div>

                {/* 4 Equal-Height Shift Cards filling 100% of column height */}
                <div className="flex-1 grid grid-rows-4 gap-2 min-h-0">
                  {shiftWindows.map((shift) => (
                    <div
                      key={shift.id}
                      className={`rounded-xl px-3 py-2 border flex flex-col justify-between ${
                        shift.isPeak
                          ? 'bg-amber-950/25 border-amber-500/40'
                          : 'bg-emerald-950/25 border-emerald-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-extrabold text-white text-xs sm:text-sm">
                          {shift.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md ${
                            shift.isPeak
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-emerald-500 text-slate-950'
                          }`}
                        >
                          {shift.periodBadge}
                        </span>
                      </div>

                      {/* Large Crisp Shift Numbers */}
                      <div className="flex items-baseline justify-between bg-slate-950/85 rounded-lg px-3 py-1.5 border border-slate-800/80">
                        <div>
                          <span className="text-[10px] text-slate-400 block">พลังงานที่ใช้</span>
                          <span
                            className={`text-base sm:text-xl font-extrabold font-mono ${
                              shift.isPeak ? 'text-amber-300' : 'text-emerald-300'
                            }`}
                          >
                            {shift.kwh.toLocaleString()}{' '}
                            <small className="text-xs font-sans text-slate-400">kWh</small>
                          </span>
                        </div>

                        <div className="text-center">
                          <span className="text-[10px] text-slate-400 block">โหลดเฉลี่ย/พีค</span>
                          <span className="text-xs sm:text-sm font-extrabold font-mono text-cyan-300">
                            {shift.avgKW} / {shift.maxKW} kW
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">สัดส่วน</span>
                          <span className="text-sm sm:text-base font-extrabold font-mono text-white">
                            {shift.sharePct}%
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-200 leading-snug">
                        <strong className="text-amber-300">แผนผลิต:</strong> {shift.advice}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* =============================================================== */}
              {/* RIGHT 4 COLUMNS: COMPLETE ALL-METERS TABLE (BIG CRISP NUMBERS)  */}
              {/* =============================================================== */}
              <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2 min-h-0">
                <div className="flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-rose-400" />
                      <span>ตารางสรุปรายมิเตอร์ครบทุกจุด ({meterBreakdown.length} มิเตอร์)</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      เรียงตามปริมาณการใช้ไฟฟ้า (kWh) จากมากไปน้อย
                    </p>
                  </div>
                </div>

                {/* Full All-Meters Table (No Price Column -> Bigger, Clearer Columns) */}
                <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/90 flex flex-col justify-between">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-slate-300 border-b border-slate-800 font-bold text-[11px]">
                        <th className="py-2 px-2">#</th>
                        <th className="py-2 px-1.5">Tag</th>
                        <th className="py-2 px-2">สายการผลิต / เครื่องจักร</th>
                        <th className="py-2 px-1.5 text-right">kW</th>
                        <th className="py-2 px-1.5 text-right text-amber-300">On-Peak</th>
                        <th className="py-2 px-1.5 text-right text-emerald-300">Off-Peak</th>
                        <th className="py-2 px-2 text-right text-white">รวม (kWh)</th>
                        <th className="py-2 px-2 text-right">สัดส่วน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 font-mono text-[11.5px]">
                      {meterBreakdown.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-900/70">
                          <td className="py-1.5 px-2 font-extrabold text-slate-400">
                            {m.rank}
                          </td>
                          <td className="py-1.5 px-1.5 text-amber-300 font-bold whitespace-nowrap">
                            {m.tag}
                          </td>
                          <td className="py-1.5 px-2 font-sans font-bold text-white truncate max-w-[155px]">
                            {m.name}
                          </td>
                          <td className="py-1.5 px-1.5 text-right text-cyan-300 font-semibold">
                            {m.baseKW}
                          </td>
                          <td className="py-1.5 px-1.5 text-right text-amber-200 font-semibold">
                            {m.onPeakKWh.toLocaleString()}
                          </td>
                          <td className="py-1.5 px-1.5 text-right text-emerald-200 font-semibold">
                            {m.offPeakKWh.toLocaleString()}
                          </td>
                          <td className="py-1.5 px-2 text-right font-extrabold text-white text-xs">
                            {m.kwh.toLocaleString()}
                          </td>
                          <td className="py-1.5 px-2 text-right text-blue-300 font-extrabold">
                            {m.sharePct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 border-t-2 border-slate-700 font-mono font-extrabold text-xs">
                        <td colSpan={3} className="py-2 px-2 font-sans text-amber-300">
                          รวมทั้งหมด ({meterBreakdown.length} จุดวัด)
                        </td>
                        <td className="py-2 px-1.5 text-right text-cyan-300">
                          {meterBreakdown.reduce((s, m) => s + m.baseKW, 0)}
                        </td>
                        <td className="py-2 px-1.5 text-right text-amber-300">
                          {reportSummary.onPeakKWh.toLocaleString()}
                        </td>
                        <td className="py-2 px-1.5 text-right text-emerald-300">
                          {reportSummary.offPeakKWh.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-right text-white text-sm">
                          {reportSummary.totalKWh.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-right text-blue-300">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STANDARD PAGE: PERIOD SELECTOR + "GO" BUTTON (ไร้ราคาค่าไฟ)         */}
      {/* =================================================================== */}
      <div className="bg-gradient-to-b from-[#111728]/85 via-[#0d1322]/90 to-[#080c16]/95 border border-slate-800/60 rounded-3xl p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <span>รายงานวิเคราะห์การใช้พลังงานไฟฟ้า & แผนปรับเวลาการผลิต</span>
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

      {/* Standard Page 4 Large Summary Cards (Pure Electrical kWh & kW) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 block">พลังงานไฟฟ้ารวมทั้งสิ้น</span>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white mt-1">
            {reportSummary.totalKWh.toLocaleString()}{' '}
            <span className="text-xs font-sans font-normal text-slate-400">kWh</span>
          </div>
          <span className="text-xs text-blue-300 mt-1 block">
            โหลดเฉลี่ย {reportSummary.avgKW} kW/ชม.
          </span>
        </div>

        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4">
          <span className="text-xs text-amber-300 font-bold block">
            พลังงานช่วง On-Peak (09:00-22:00)
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-300 mt-1">
            {reportSummary.onPeakKWh.toLocaleString()}{' '}
            <span className="text-xs font-sans font-normal text-slate-400">kWh</span>
          </div>
          <span className="text-xs text-amber-200/80 mt-1 block">
            สัดส่วน {reportSummary.onPeakPct}% ของหน่วยไฟทั้งหมด
          </span>
        </div>

        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4">
          <span className="text-xs text-emerald-300 font-bold block">
            พลังงานช่วง Off-Peak (22:00-09:00)
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-300 mt-1">
            {reportSummary.offPeakKWh.toLocaleString()}{' '}
            <span className="text-xs font-sans font-normal text-slate-400">kWh</span>
          </div>
          <span className="text-xs text-emerald-200/80 mt-1 block">
            สัดส่วน {reportSummary.offPeakPct}% ของหน่วยไฟทั้งหมด
          </span>
        </div>

        <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-4">
          <span className="text-xs text-rose-300 font-bold block">
            ความต้องการพลังไฟฟ้าสูงสุด (Peak)
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-rose-400 mt-1">
            {reportSummary.peakKW.toLocaleString()}{' '}
            <span className="text-xs font-sans font-normal text-slate-400">kW</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            เวลา {reportSummary.peakHour} • ภาระหม้อแปลง {reportSummary.trLoadPct}%
          </span>
        </div>
      </div>

      {/* Main Visual Report Chart */}
      <div className="bg-gradient-to-b from-[#111728]/85 via-[#0d1322]/90 to-[#080c16]/95 border border-slate-800/60 rounded-3xl p-4 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              {reportMode === 'daily' &&
                '📊 กราฟการใช้ไฟฟ้ารายชั่วโมง (00:00 - 23:00 น.) พร้อมตัวเลขกำกับทุกแท่ง'}
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
              On-Peak (09:00-22:00 น.)
            </span>
            <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
              Off-Peak (22:00-09:00 น.)
            </span>
          </div>
        </div>

        <div className="h-72 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {reportMode === 'daily' ? (
              <BarChart data={hourlyData} margin={{ top: 20, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#cbd5e1" fontSize={11} fontWeight="bold" />
                <YAxis stroke="#cbd5e1" fontSize={11} fontWeight="bold" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                  formatter={(value) => [`${value.toLocaleString()} kWh`, 'พลังงานไฟฟ้าที่ใช้']}
                />
                <Bar dataKey="energyKWh" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="energyKWh" position="top" fill="#ffffff" fontSize={10.5} fontWeight="bold" />
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
                <XAxis dataKey="fullDateLabel" stroke="#cbd5e1" fontSize={10} />
                <YAxis stroke="#cbd5e1" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="onPeakKWh" name="On-Peak (kWh)" stackId="a" fill="#f59e0b" />
                <Bar
                  dataKey="offPeakKWh"
                  name="Off-Peak (kWh)"
                  stackId="a"
                  fill="#10b981"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            ) : (
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#cbd5e1" fontSize={11} />
                <YAxis stroke="#cbd5e1" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="onPeakKWh" name="On-Peak (kWh)" stackId="a" fill="#f59e0b" />
                <Bar
                  dataKey="offPeakKWh"
                  name="Off-Peak (kWh)"
                  stackId="a"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Complete All-Meters Table on Standard Page (No Cost Column) */}
      <div className="bg-gradient-to-b from-[#111728]/85 via-[#0d1322]/90 to-[#080c16]/95 border border-slate-800/60 rounded-3xl p-4 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-400" />
              <span>ตารางสรุปการใช้พลังงานไฟฟ้ารายมิเตอร์ครบทุกจุด ({meterBreakdown.length} มิเตอร์)</span>
            </h3>
            <p className="text-xs text-slate-400">
              แตะที่แถวมิเตอร์ใดก็ได้เพื่อเจาะลึกดูแรงดัน กระแส และกราฟรายชั่วโมงของมิเตอร์ตัวนั้น
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-2xl">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-950 text-slate-300 border-b border-slate-800 font-bold">
                <th className="py-3 px-3">อันดับ</th>
                <th className="py-3 px-3">รหัสตู้ / Tag</th>
                <th className="py-3 px-3">ชื่อสายการผลิต / เครื่องจักร</th>
                <th className="py-3 px-3 text-right">โหลดปกติ (kW)</th>
                <th className="py-3 px-3 text-right text-amber-300">On-Peak (kWh)</th>
                <th className="py-3 px-3 text-right text-emerald-300">Off-Peak (kWh)</th>
                <th className="py-3 px-3 text-right text-white">หน่วยรวม (kWh)</th>
                <th className="py-3 px-3 text-right">สัดส่วน (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono">
              {meterBreakdown.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => onSelectMeter && onSelectMeter(m.id)}
                  className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-3 font-extrabold text-slate-400">#{m.rank}</td>
                  <td className="py-2.5 px-3 text-amber-300 font-bold">
                    [{m.tag}] <span className="text-slate-500 text-xs">{m.panel}</span>
                  </td>
                  <td className="py-2.5 px-3 font-sans font-bold text-white">{m.name}</td>
                  <td className="py-2.5 px-3 text-right text-cyan-300 font-bold">{m.baseKW} kW</td>
                  <td className="py-2.5 px-3 text-right text-amber-200 font-bold">
                    {m.onPeakKWh.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-200 font-bold">
                    {m.offPeakKWh.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-extrabold text-white">
                    {m.kwh.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-blue-300 font-extrabold">
                    {m.sharePct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
