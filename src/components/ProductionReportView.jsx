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
  TrendingDown,
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
  const currentCompany = TENANT_COMPANIES[activeOrgId] || TENANT_COMPANIES['ORG-AOB'];

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

  const peakRate = currentCompany.peakRate || 5.1;
  const offPeakRate = currentCompany.offPeakRate || 2.6;

  // 1. Hourly data (24 hours)
  const hourlyData = useMemo(() => {
    const base = generateHourlyData(currentCompany.id);
    const dayNum = parseInt(selectedDay.split('-')[2] || '24', 10);
    const mod = 0.92 + (dayNum % 7) * 0.025;
    return base.map((h) => {
      const energyKWh = Math.round(h.energyKWh * mod);
      const activeKW = Math.round(h.activeKW * mod);
      const rate = h.isOnPeak ? peakRate : offPeakRate;
      const costBaht = Math.round(energyKWh * rate);
      return {
        ...h,
        energyKWh,
        activeKW,
        costBaht
      };
    });
  }, [currentCompany.id, selectedDay, peakRate, offPeakRate]);

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
      const costBaht = Math.round(onPeakKWh * peakRate + offPeakKWh * offPeakRate);
      return {
        ...d,
        dateLabel: `${d.day}`,
        fullDateLabel: `${d.day} ${mShort}`,
        totalKWh,
        onPeakKWh,
        offPeakKWh,
        costBaht
      };
    });
  }, [currentCompany.id, selectedMonth, peakRate, offPeakRate]);

  // 3. Monthly data (12 months)
  const monthlyData = useMemo(() => {
    const base = generateMonthlyData(currentCompany.id);
    const yMod = selectedYear === '2569' ? 1.0 : selectedYear === '2568' ? 1.06 : 1.12;
    return base.map((m) => {
      const totalKWh = Math.round(m.totalKWh * yMod);
      const onPeakKWh = Math.round(totalKWh * 0.65);
      const offPeakKWh = totalKWh - onPeakKWh;
      const costBaht = Math.round(onPeakKWh * peakRate + offPeakKWh * offPeakRate);
      return {
        ...m,
        totalKWh,
        onPeakKWh,
        offPeakKWh,
        costBaht
      };
    });
  }, [currentCompany.id, selectedYear, peakRate, offPeakRate]);

  // Comprehensive Report Summary
  const reportSummary = useMemo(() => {
    const trKVA = currentCompany.transformerKVA || 1600;
    const maxSafeKW = Math.round(trKVA * 0.85);

    if (reportMode === 'daily') {
      const totalKWh = hourlyData.reduce((s, h) => s + h.energyKWh, 0);
      const onPeakKWh = hourlyData
        .filter((h) => h.isOnPeak)
        .reduce((s, h) => s + h.energyKWh, 0);
      const offPeakKWh = totalKWh - onPeakKWh;
      const onPeakCost = Math.round(onPeakKWh * peakRate);
      const offPeakCost = Math.round(offPeakKWh * offPeakRate);
      const totalCost = onPeakCost + offPeakCost;

      const peakItem = [...hourlyData].sort((a, b) => b.activeKW - a.activeKW)[0];
      const minItem = [...hourlyData].sort((a, b) => a.activeKW - b.activeKW)[0];
      const avgKW = Math.round(totalKWh / 24);
      const peakKW = peakItem?.activeKW || 898;
      const trLoadPct = Math.round((peakKW / maxSafeKW) * 100);
      const loadFactorPct = Math.round((avgKW / (peakKW || 1)) * 100);
      const avgRate = (totalCost / (totalKWh || 1)).toFixed(2);
      const shiftableKWh = Math.round(onPeakKWh * 0.2);
      const potentialSavingsBaht = Math.round(shiftableKWh * (peakRate - offPeakRate));

      return {
        title: `รายงานสรุปประจำวันที่ ${selectedDay.split('-').reverse().join('/')}`,
        shortPeriod: `วันที่ ${selectedDay.split('-').reverse().join('/')}`,
        totalKWh,
        totalCost,
        avgRate,
        onPeakKWh,
        offPeakKWh,
        onPeakCost,
        offPeakCost,
        onPeakPct: Math.round((onPeakKWh / (totalKWh || 1)) * 100),
        offPeakPct: 100 - Math.round((onPeakKWh / (totalKWh || 1)) * 100),
        peakKW,
        avgKW,
        minKW: minItem?.activeKW || 450,
        minHour: minItem?.hour || '04:00',
        peakHour: peakItem?.hour || '16:00',
        peakWindowLabel: `เวลา ${peakItem?.hour || '16:00'} น. (${peakKW} kW)`,
        trLoadPct,
        loadFactorPct,
        avgPF: 0.95,
        shiftableKWh,
        potentialSavingsBaht,
        projectedMonthlySavings: potentialSavingsBaht * 30
      };
    }

    if (reportMode === 'monthly') {
      const totalKWh = dailyData.reduce((s, d) => s + d.totalKWh, 0);
      const onPeakKWh = dailyData.reduce((s, d) => s + d.onPeakKWh, 0);
      const offPeakKWh = totalKWh - onPeakKWh;
      const onPeakCost = Math.round(onPeakKWh * peakRate);
      const offPeakCost = Math.round(offPeakKWh * offPeakRate);
      const totalCost = onPeakCost + offPeakCost;

      const peakDay = [...dailyData].sort((a, b) => b.totalKWh - a.totalKWh)[0];
      const minDay = [...dailyData].sort((a, b) => a.totalKWh - b.totalKWh)[0];
      const avgKW = Math.round(totalKWh / (30 * 24));
      const peakKW = peakDay?.peakKW || 920;
      const trLoadPct = Math.round((peakKW / maxSafeKW) * 100);
      const loadFactorPct = Math.round((avgKW / (peakKW || 1)) * 100);
      const avgRate = (totalCost / (totalKWh || 1)).toFixed(2);
      const shiftableKWh = Math.round(onPeakKWh * 0.2);
      const potentialSavingsBaht = Math.round(shiftableKWh * (peakRate - offPeakRate));
      const mLabel = monthNamesFull.find((m) => m.val === selectedMonth)?.label || 'ตุลาคม';

      return {
        title: `รายงานสรุปประจำเดือน ${mLabel} ${selectedYear}`,
        shortPeriod: `เดือน${mLabel} ${selectedYear}`,
        totalKWh,
        totalCost,
        avgRate,
        onPeakKWh,
        offPeakKWh,
        onPeakCost,
        offPeakCost,
        onPeakPct: Math.round((onPeakKWh / (totalKWh || 1)) * 100),
        offPeakPct: 100 - Math.round((onPeakKWh / (totalKWh || 1)) * 100),
        peakKW,
        avgKW,
        minKW: Math.round((minDay?.totalKWh || 12000) / 24),
        minHour: minDay?.fullDateLabel || 'วันอาทิตย์',
        peakHour: peakDay?.fullDateLabel || '15 ต.ค.',
        peakWindowLabel: `วันที่ ${peakDay?.fullDateLabel} (${peakDay?.totalKWh.toLocaleString()} kWh)`,
        trLoadPct,
        loadFactorPct,
        avgPF: 0.94,
        shiftableKWh,
        potentialSavingsBaht,
        projectedMonthlySavings: potentialSavingsBaht
      };
    }

    // Yearly
    const totalKWh = monthlyData.reduce((s, m) => s + m.totalKWh, 0);
    const onPeakKWh = monthlyData.reduce((s, m) => s + m.onPeakKWh, 0);
    const offPeakKWh = totalKWh - onPeakKWh;
    const onPeakCost = Math.round(onPeakKWh * peakRate);
    const offPeakCost = Math.round(offPeakKWh * offPeakRate);
    const totalCost = onPeakCost + offPeakCost;

    const peakMonth = [...monthlyData].sort((a, b) => b.totalKWh - a.totalKWh)[0];
    const minMonth = [...monthlyData].sort((a, b) => a.totalKWh - b.totalKWh)[0];
    const avgKW = Math.round(totalKWh / (365 * 24));
    const peakKW = peakMonth?.peakKW || 960;
    const trLoadPct = Math.round((peakKW / maxSafeKW) * 100);
    const loadFactorPct = Math.round((avgKW / (peakKW || 1)) * 100);
    const avgRate = (totalCost / (totalKWh || 1)).toFixed(2);
    const shiftableKWh = Math.round(onPeakKWh * 0.2);
    const potentialSavingsBaht = Math.round(shiftableKWh * (peakRate - offPeakRate));

    return {
      title: `รายงานสรุปประจำปี พ.ศ. ${selectedYear}`,
      shortPeriod: `ปี พ.ศ. ${selectedYear}`,
      totalKWh,
      totalCost,
      avgRate,
      onPeakKWh,
      offPeakKWh,
      onPeakCost,
      offPeakCost,
      onPeakPct: Math.round((onPeakKWh / (totalKWh || 1)) * 100),
      offPeakPct: 100 - Math.round((onPeakKWh / (totalKWh || 1)) * 100),
      peakKW,
      avgKW,
      minKW: Math.round((minMonth?.totalKWh || 350000) / 720),
      minHour: `เดือน${minMonth?.month || 'ม.ค.'}`,
      peakHour: `เดือน${peakMonth?.month || 'เม.ย.'}`,
      peakWindowLabel: `เดือน${peakMonth?.month} (${peakMonth?.totalKWh.toLocaleString()} kWh)`,
      trLoadPct,
      loadFactorPct,
      avgPF: 0.94,
      shiftableKWh,
      potentialSavingsBaht,
      projectedMonthlySavings: Math.round(potentialSavingsBaht / 12)
    };
  }, [
    reportMode,
    hourlyData,
    dailyData,
    monthlyData,
    selectedDay,
    selectedMonth,
    selectedYear,
    currentCompany,
    peakRate,
    offPeakRate
  ]);

  // Detailed 4 Production Shift Windows
  const shiftWindows = useMemo(() => {
    const scale = reportMode === 'daily' ? 1 : reportMode === 'monthly' ? 30 : 365;

    const buildShift = (id, name, hoursLabel, hoursFilter, isPeak, tariff, machineFocus, advice) => {
      const matched = hourlyData.filter(hoursFilter);
      const kwh = matched.reduce((s, h) => s + h.energyKWh, 0) * scale;
      const avgKW = Math.round(
        matched.reduce((s, h) => s + h.activeKW, 0) / (matched.length || 1)
      );
      const maxKW = Math.max(...matched.map((h) => h.activeKW), 0);
      const rate = isPeak ? peakRate : offPeakRate;
      const cost = Math.round(kwh * rate);
      const sharePct = Number(((kwh / (reportSummary.totalKWh || 1)) * 100).toFixed(1));

      return {
        id,
        name,
        hoursLabel,
        tariff,
        rate,
        isPeak,
        kwh,
        avgKW,
        maxKW,
        cost,
        sharePct,
        machineFocus,
        advice
      };
    };

    return [
      buildShift(
        'shift-1',
        '1. กะเช้าตรู่ (Pre-Start)',
        '06:00 - 09:00 น. (3 ชม.)',
        (h) => h.hourNum >= 6 && h.hourNum < 9,
        false,
        `Off-Peak (${offPeakRate.toFixed(2)} ฿)`,
        'คอมเพรสเซอร์ทำความเย็น & ปั๊มน้ำหลัก',
        'เปิดอัดความเย็นห้องเย็นล่วงหน้า (Pre-cooling) และอุ่นเครื่องจักรก่อนถึงเวลา 09:00 น.'
      ),
      buildShift(
        'shift-2',
        '2. กะผลิตหลักกลางวัน',
        '09:00 - 17:00 น. (8 ชม.)',
        (h) => h.hourNum >= 9 && h.hourNum < 17,
        true,
        `On-Peak (${peakRate.toFixed(2)} ฿)`,
        'สายการผลิตหลัก PRO-1, PRO-2 & ระบบทำความเย็น',
        'ค่าไฟแพงสุด! ห้ามเดินเครื่องกินโหลดหนักพร้อมกัน ย้ายการบดผสม/อัดความเย็นสต็อกไปกะดึก'
      ),
      buildShift(
        'shift-3',
        '3. กะเย็น-ค่ำ (Overtime)',
        '17:00 - 22:00 น. (5 ชม.)',
        (h) => h.hourNum >= 17 && h.hourNum < 22,
        true,
        `On-Peak (${peakRate.toFixed(2)} ฿)`,
        'สายการผลิตต่อเนื่อง & แอร์สำนักงาน/คลัง',
        'ยังคิดเรท On-Peak ควรปิดแอร์สำนักงานเวลา 17:30 น. และลดโหลดปั๊มลมเมื่อจบคิวผลิต'
      ),
      buildShift(
        'shift-4',
        '4. กะดึก (Night Off-Peak)',
        '22:00 - 06:00 น. (8 ชม.)',
        (h) => h.hourNum >= 22 || h.hourNum < 6,
        false,
        `Off-Peak (${offPeakRate.toFixed(2)} ฿)`,
        'ระบบห้องเย็น Refrigeration & แช่แข็ง Blast Freezer',
        'ค่าไฟถูกเกือบครึ่ง! เดินเครื่องห้องเย็นเต็มพิกัด 100% เพื่อสะสมความเย็นไว้ใช้ตอนกลางวัน'
      )
    ];
  }, [hourlyData, reportMode, reportSummary.totalKWh, peakRate, offPeakRate]);

  // Complete Meter-by-Meter Breakdown (ALL Meters of the company with On-Peak / Off-Peak / Cost)
  const meterBreakdown = useMemo(() => {
    const rawMeters = (currentCompany.electricityMeters || []).filter((m) => m.baseKW > 0);
    const totalBase = rawMeters.reduce((s, m) => s + m.baseKW, 0) || 1;

    return rawMeters
      .map((m, idx) => {
        const share = m.baseKW / totalBase;
        const kwh = Math.round(reportSummary.totalKWh * share);
        // Industrial variation: production lines use slightly more On-Peak, cold storage runs 24h
        const onPeakRatio = m.name.toLowerCase().includes('refrig') ? 0.58 : 0.71;
        const onPeakKWh = Math.round(kwh * onPeakRatio);
        const offPeakKWh = kwh - onPeakKWh;
        const cost = Math.round(onPeakKWh * peakRate + offPeakKWh * offPeakRate);
        const peakKW = Number((m.baseKW * 1.08).toFixed(1));

        return {
          ...m,
          rank: idx + 1,
          peakKW,
          onPeakKWh,
          offPeakKWh,
          kwh,
          cost,
          sharePct: Number((share * 100).toFixed(1))
        };
      })
      .sort((a, b) => b.kwh - a.kwh)
      .map((m, i) => ({ ...m, rank: i + 1 }));
  }, [currentCompany, reportSummary, peakRate, offPeakRate]);

  return (
    <div className="space-y-5">
      {/* =================================================================== */}
      {/* FULL-SCREEN ONE-PAGE LANDSCAPE REPORT (เปิดเมื่อกดปุ่ม GO)           */}
      {/* แสดงข้อมูลครบถ้วนละเอียดทุกจุดในหน้าเดียว เพื่อแคปหน้าจอทำรายงาน    */}
      {/* =================================================================== */}
      {isOnePageReportOpen && (
        <div className="fixed inset-0 z-50 bg-[#04070f] text-slate-100 overflow-y-auto xl:overflow-hidden flex flex-col justify-between p-2 sm:p-3.5 select-none sm:select-auto">
          {/* Top Action Controls (Can be hidden with 1 click for clean screenshot) */}
          {!hideControlsForCapture ? (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-blue-500/40 rounded-xl px-3.5 py-1.5 mb-2 shadow-lg shrink-0 print:hidden">
              <div className="flex items-center gap-2 text-xs">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white">
                  ใบรายงานสรุปวิศวกรรมพลังงานไฟฟ้าฉบับสมบูรณ์ (แสดงครบทุกมิเตอร์และทุกช่วงเวลาในหน้าเดียว)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHideControlsForCapture(true)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold cursor-pointer transition-all"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>ซ่อนแถบปุ่มเพื่อแคปจอเต็มแผ่น</span>
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
          <div className="flex-1 flex flex-col justify-between bg-[#080c17] border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xl overflow-hidden">
            {/* 1. Header Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow">
                  <Zap className="w-5 h-5 text-yellow-300" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-sm sm:text-base font-bold text-white">
                      {currentCompany.name}
                    </h1>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded">
                      หม้อแปลง {currentCompany.transformerKVA} kVA
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded">
                      มิเตอร์ไฟฟ้าครบ {meterBreakdown.length} จุดวัด
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    รายงานวิเคราะห์การใช้พลังงานไฟฟ้าเชิงลึก แยกตามช่วงเวลา TOU, กะการผลิต และรายมิเตอร์ทั้งหมดของโรงงาน
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden md:block text-[11px] text-slate-400">
                  <div>เรท On-Peak (09:00-22:00): <strong className="text-amber-300 font-mono">{peakRate.toFixed(2)} ฿/kWh</strong></div>
                  <div>เรท Off-Peak (22:00-09:00): <strong className="text-emerald-300 font-mono">{offPeakRate.toFixed(2)} ฿/kWh</strong></div>
                </div>
                <div className="bg-slate-950 border border-amber-500/50 rounded-xl px-3.5 py-1.5 text-right">
                  <span className="text-[9px] text-slate-400 block uppercase font-mono">
                    งวดรายงานที่ตรวจสอบ
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-amber-300">
                    📌 {reportSummary.title}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. 6-Box High-Density Engineering KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 my-2.5 shrink-0">
              {/* Box 1: Total Energy */}
              <div className="bg-slate-900/95 border border-slate-800 rounded-xl px-3 py-2">
                <span className="text-[10px] text-slate-400 block">1. พลังงานไฟฟ้ารวมสุทธิ</span>
                <div className="text-base sm:text-lg font-bold font-mono text-white">
                  {reportSummary.totalKWh.toLocaleString()} <small className="text-[10px] text-slate-400">kWh</small>
                </div>
                <span className="text-[10px] text-blue-300 font-mono block">
                  โหลดเฉลี่ย {reportSummary.avgKW} kW/ชม.
                </span>
              </div>

              {/* Box 2: Total Cost */}
              <div className="bg-slate-900/95 border border-slate-800 rounded-xl px-3 py-2">
                <span className="text-[10px] text-slate-400 block">2. ค่าไฟฟ้ารวมทั้งสิ้น</span>
                <div className="text-base sm:text-lg font-bold font-mono text-amber-400">
                  ฿{reportSummary.totalCost.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-400 font-mono block">
                  เฉลี่ยหน่วยละ {reportSummary.avgRate} บาท
                </span>
              </div>

              {/* Box 3: On-Peak Breakdown */}
              <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl px-3 py-2">
                <span className="text-[10px] text-amber-300 font-semibold block">
                  3. ช่วง On-Peak (09:00-22:00)
                </span>
                <div className="text-base sm:text-lg font-bold font-mono text-amber-300">
                  {reportSummary.onPeakKWh.toLocaleString()} <small className="text-[10px]">kWh ({reportSummary.onPeakPct}%)</small>
                </div>
                <span className="text-[10px] text-amber-200/80 font-mono block">
                  ค่าไฟ On-Peak: ฿{reportSummary.onPeakCost.toLocaleString()}
                </span>
              </div>

              {/* Box 4: Off-Peak Breakdown */}
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl px-3 py-2">
                <span className="text-[10px] text-emerald-300 font-semibold block">
                  4. ช่วง Off-Peak (22:00-09:00)
                </span>
                <div className="text-base sm:text-lg font-bold font-mono text-emerald-300">
                  {reportSummary.offPeakKWh.toLocaleString()} <small className="text-[10px]">kWh ({reportSummary.offPeakPct}%)</small>
                </div>
                <span className="text-[10px] text-emerald-200/80 font-mono block">
                  ค่าไฟ Off-Peak: ฿{reportSummary.offPeakCost.toLocaleString()}
                </span>
              </div>

              {/* Box 5: Peak Demand & Transformer Load */}
              <div className="bg-slate-900/95 border border-slate-800 rounded-xl px-3 py-2">
                <span className="text-[10px] text-slate-400 block">5. พีคสูงสุด & ภาระหม้อแปลง</span>
                <div className="text-base sm:text-lg font-bold font-mono text-rose-400">
                  {reportSummary.peakKW} <small className="text-[10px] text-slate-300">kW ({reportSummary.trLoadPct}% TR)</small>
                </div>
                <span className="text-[10px] text-slate-400 font-mono block">
                  เวลา {reportSummary.peakHour} • PF {reportSummary.avgPF} • LF {reportSummary.loadFactorPct}%
                </span>
              </div>

              {/* Box 6: Load Shifting Target Saving */}
              <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-xl px-3 py-2">
                <span className="text-[10px] text-emerald-300 font-bold block">
                  6. เป้าหมายลดค่าไฟ (ย้ายโหลด 20%)
                </span>
                <div className="text-base sm:text-lg font-bold font-mono text-emerald-400">
                  -฿{reportSummary.potentialSavingsBaht.toLocaleString()} <small className="text-[10px]">/งวด</small>
                </div>
                <span className="text-[10px] text-emerald-200 font-mono block">
                  ประหยัดเดือนละ ~฿{reportSummary.projectedMonthlySavings.toLocaleString()}
                </span>
              </div>
            </div>

            {/* 3. Main 12-Column High-Density Landscape Grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2.5 min-h-0">
              {/* =============================================================== */}
              {/* LEFT 5 COLUMNS: CHART WITH VALUE LABELS + COMPLETE PERIOD TABLE */}
              {/* =============================================================== */}
              <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between min-h-0">
                <div className="flex items-center justify-between gap-1 mb-1 shrink-0">
                  <div>
                    <h3 className="text-xs font-bold text-white">
                      📊 กราฟและตารางหน่วยการใช้ไฟฟ้ารายช่วงเวลา ({reportSummary.shortPeriod})
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      สูงสุด: <strong className="text-rose-300">{reportSummary.peakKW} kW ({reportSummary.peakHour})</strong> • ต่ำสุด: <strong className="text-emerald-300">{reportSummary.minKW} kW ({reportSummary.minHour})</strong>
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

                {/* Bar Chart with Top Value Labels */}
                <div className="h-44 sm:h-48 w-full shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    {reportMode === 'daily' ? (
                      <BarChart data={hourlyData} margin={{ top: 14, right: 4, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="hour" stroke="#94a3b8" fontSize={8.5} interval={0} angle={-35} textAnchor="end" height={26} />
                        <YAxis stroke="#94a3b8" fontSize={9} />
                        <Bar dataKey="energyKWh" radius={[3, 3, 0, 0]}>
                          <LabelList dataKey="energyKWh" position="top" fill="#cbd5e1" fontSize={7.5} />
                          {hourlyData.map((entry, idx) => (
                            <Cell
                              key={`c-${idx}`}
                              fill={entry.isOnPeak ? '#f59e0b' : '#10b981'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : reportMode === 'monthly' ? (
                      <BarChart data={dailyData} margin={{ top: 12, right: 4, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="dateLabel" stroke="#94a3b8" fontSize={8.5} interval={0} />
                        <YAxis stroke="#94a3b8" fontSize={9} />
                        <Bar dataKey="onPeakKWh" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="offPeakKWh" stackId="a" fill="#10b981" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    ) : (
                      <BarChart data={monthlyData} margin={{ top: 14, right: 4, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={9} interval={0} />
                        <YAxis stroke="#94a3b8" fontSize={9} />
                        <Bar dataKey="onPeakKWh" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="offPeakKWh" stackId="a" fill="#10b981" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* Compact Data Matrix Table Below Chart (Shows exact numbers for every hour/period) */}
                <div className="mt-1.5 bg-slate-950/90 border border-slate-800 rounded-xl p-2 flex-1 flex flex-col justify-between overflow-hidden">
                  <div className="text-[10px] font-bold text-slate-300 mb-1 flex items-center justify-between">
                    <span>
                      {reportMode === 'daily'
                        ? '📋 ตารางข้อมูลรายชั่วโมงครบทั้ง 24 ชั่วโมง (kWh & ค่าไฟ)'
                        : reportMode === 'monthly'
                        ? '📋 ตารางสรุปข้อมูลรายวัน (วันที่ 1 - 30)'
                        : '📋 ตารางสรุปข้อมูลรายเดือนทั้ง 12 เดือน'}
                    </span>
                    <span className="text-[9px] text-slate-400">หน่วย: kWh (บาท)</span>
                  </div>

                  {reportMode === 'daily' ? (
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1 text-[9.5px] font-mono">
                      {hourlyData.map((h) => (
                        <div
                          key={h.hour}
                          className={`px-1.5 py-1 rounded border text-center ${
                            h.isOnPeak
                              ? 'bg-amber-950/25 border-amber-500/30 text-amber-200'
                              : 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200'
                          }`}
                        >
                          <div className="text-[8.5px] text-slate-400">{h.hour}</div>
                          <div className="font-bold text-white">{h.energyKWh}</div>
                          <div className="text-[8px] opacity-80">฿{h.costBaht.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  ) : reportMode === 'monthly' ? (
                    <div className="grid grid-cols-6 sm:grid-cols-10 gap-1 text-[9px] font-mono overflow-y-auto max-h-36">
                      {dailyData.map((d) => (
                        <div
                          key={d.day}
                          className="px-1 py-0.5 rounded bg-slate-900 border border-slate-800 text-center"
                        >
                          <div className="text-[8px] text-slate-400">วันที่ {d.day}</div>
                          <div className="font-bold text-amber-300">{d.totalKWh.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 text-[9.5px] font-mono">
                      {monthlyData.map((m) => (
                        <div
                          key={m.month}
                          className="px-1.5 py-1 rounded bg-slate-900 border border-slate-800 text-center"
                        >
                          <div className="text-[9px] text-slate-400">{m.month}</div>
                          <div className="font-bold text-white">{m.totalKWh.toLocaleString()}</div>
                          <div className="text-[8.5px] text-amber-300">฿{m.costBaht.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* =============================================================== */}
              {/* MIDDLE 3.5 COLUMNS: 4-SHIFT PRODUCTION TABLE & ACTION PLAN      */}
              {/* =============================================================== */}
              <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between min-h-0">
                <div className="mb-1.5 shrink-0">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>วิเคราะห์ 4 กะการผลิต & แผนปรับลดค่าไฟ</span>
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    เปรียบเทียบโหลดและค่าไฟรายกะ เพื่อวางแผนเดินเครื่องจักร
                  </p>
                </div>

                {/* 4 Shift Cards - Compact & Information-Rich */}
                <div className="space-y-1.5 flex-1 flex flex-col justify-between">
                  {shiftWindows.map((shift) => (
                    <div
                      key={shift.id}
                      className={`rounded-xl p-2.5 border ${
                        shift.isPeak
                          ? 'bg-amber-950/20 border-amber-500/35'
                          : 'bg-emerald-950/20 border-emerald-500/35'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-white text-[11px]">{shift.name}</span>
                        <span
                          className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded ${
                            shift.isPeak
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {shift.tariff}
                        </span>
                      </div>
                      <div className="text-[9.5px] text-slate-400 mb-1">{shift.hoursLabel}</div>

                      {/* Shift Metrics Grid */}
                      <div className="grid grid-cols-3 gap-1 bg-slate-950/80 rounded-lg px-2 py-1 text-[10px] font-mono mb-1">
                        <div>
                          <span className="text-slate-500 block text-[8.5px]">หน่วยไฟ ({shift.sharePct}%)</span>
                          <strong className="text-white">{shift.kwh.toLocaleString()} kWh</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[8.5px]">โหลดเฉลี่ย/พีค</span>
                          <strong className="text-cyan-300">{shift.avgKW}/{shift.maxKW} kW</strong>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 block text-[8.5px]">ค่าไฟกะนี้</span>
                          <strong className="text-amber-300">฿{shift.cost.toLocaleString()}</strong>
                        </div>
                      </div>

                      <div className="text-[9.5px] text-slate-300 leading-tight">
                        <strong className="text-amber-300">แผนผลิต:</strong> {shift.advice}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Actionable Conclusion Box */}
                <div className="mt-2 bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-2 text-[10px] shrink-0">
                  <div className="font-bold text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>สรุปแนวทางลดต้นทุนการผลิต:</span>
                  </div>
                  <p className="text-slate-200 mt-0.5 leading-snug">
                    หากย้ายโหลดช่วง On-Peak เพียง 20% ({reportSummary.shiftableKWh.toLocaleString()} kWh) ไปเดินในกะดึก (Off-Peak 2.60฿) จะประหยัดเงินได้ทันที{' '}
                    <strong className="text-emerald-300 font-mono">
                      ฿{reportSummary.potentialSavingsBaht.toLocaleString()}/งวด
                    </strong>
                  </p>
                </div>
              </div>

              {/* =============================================================== */}
              {/* RIGHT 4 COLUMNS: COMPLETE ALL-METERS TABLE (แสดงครบทุกมิเตอร์!) */}
              {/* =============================================================== */}
              <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between min-h-0">
                <div className="flex items-center justify-between mb-1.5 shrink-0">
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-rose-400" />
                      <span>ตารางสรุปการใช้ไฟฟ้ารายมิเตอร์ครบทุกจุด ({meterBreakdown.length} จุดวัด)</span>
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      แสดงข้อมูลครบทุกมิเตอร์ของบริษัท เรียงตามปริมาณการใช้ไฟฟ้ามากไปน้อย
                    </p>
                  </div>
                </div>

                {/* Full All-Meters Table */}
                <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/90">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 font-semibold">
                        <th className="py-1.5 px-2">#</th>
                        <th className="py-1.5 px-1.5">ตู้/Tag</th>
                        <th className="py-1.5 px-2">ชื่อสายการผลิต / เครื่องจักร</th>
                        <th className="py-1.5 px-1.5 text-right">kW</th>
                        <th className="py-1.5 px-1.5 text-right text-amber-300">On-Peak</th>
                        <th className="py-1.5 px-1.5 text-right text-emerald-300">Off-Peak</th>
                        <th className="py-1.5 px-2 text-right">รวม kWh</th>
                        <th className="py-1.5 px-2 text-right">ค่าไฟ (฿)</th>
                        <th className="py-1.5 px-1.5 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 font-mono">
                      {meterBreakdown.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-900/60">
                          <td className="py-1 px-2 font-bold text-slate-400">{m.rank}</td>
                          <td className="py-1 px-1.5 text-amber-300 font-bold whitespace-nowrap">
                            {m.tag}
                          </td>
                          <td className="py-1 px-2 font-sans font-semibold text-white truncate max-w-[130px]">
                            {m.name}
                          </td>
                          <td className="py-1 px-1.5 text-right text-cyan-300">{m.baseKW}</td>
                          <td className="py-1 px-1.5 text-right text-amber-200">
                            {m.onPeakKWh.toLocaleString()}
                          </td>
                          <td className="py-1 px-1.5 text-right text-emerald-200">
                            {m.offPeakKWh.toLocaleString()}
                          </td>
                          <td className="py-1 px-2 text-right font-bold text-white">
                            {m.kwh.toLocaleString()}
                          </td>
                          <td className="py-1 px-2 text-right font-bold text-amber-300">
                            ฿{m.cost.toLocaleString()}
                          </td>
                          <td className="py-1 px-1.5 text-right text-blue-300 font-bold">
                            {m.sharePct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 border-t-2 border-slate-700 font-mono font-bold text-[10.5px]">
                        <td colSpan={3} className="py-1.5 px-2 font-sans text-amber-300">
                          รวมทั้งหมด ({meterBreakdown.length} มิเตอร์)
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-cyan-300">
                          {meterBreakdown.reduce((s, m) => s + m.baseKW, 0)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-amber-300">
                          {reportSummary.onPeakKWh.toLocaleString()}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-emerald-300">
                          {reportSummary.offPeakKWh.toLocaleString()}
                        </td>
                        <td className="py-1.5 px-2 text-right text-white">
                          {reportSummary.totalKWh.toLocaleString()}
                        </td>
                        <td className="py-1.5 px-2 text-right text-amber-400">
                          ฿{reportSummary.totalCost.toLocaleString()}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-blue-300">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* 4. Official Document Footer */}
            <div className="pt-2 mt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[10px] text-slate-400 shrink-0">
              <span>
                เอกสารรายงานพลังงานไฟฟ้าอัตโนมัติ (PowerView Cloud Telemetry) • บริษัท: {currentCompany.name} ({currentCompany.formCode})
              </span>
              <span>
                สถานะข้อมูล: ยืนยันผลจากมิเตอร์ RS485 Modbus ครบ {meterBreakdown.length}/{meterBreakdown.length} จุดวัด
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
              เลือกวัน เดือน หรือปี แล้วกดปุ่ม <strong className="text-emerald-400">GO</strong> เพื่อเปิดใบรายงานสรุปแนวนอนฉบับเต็ม (แสดงครบทุกมิเตอร์และทุกชั่วโมงในหน้าเดียว)
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

      {/* Standard Page Content below selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 block">หน่วยการใช้ไฟฟ้ารวม</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
            {reportSummary.totalKWh.toLocaleString()}{' '}
            <span className="text-xs font-sans font-normal text-slate-400">kWh</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            โหลดเฉลี่ย {reportSummary.avgKW} kW/ชม.
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 block">ค่าไฟฟ้ารวมทั้งสิ้น</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400 mt-1">
            ฿{reportSummary.totalCost.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            On-Peak ฿{reportSummary.onPeakCost.toLocaleString()} • Off-Peak ฿{reportSummary.offPeakCost.toLocaleString()}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 block">สัดส่วนใช้ไฟช่วงแพง (On-Peak)</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-rose-400 mt-1">
            {reportSummary.onPeakPct}% ({reportSummary.onPeakKWh.toLocaleString()} kWh)
          </div>
          <span className="text-[11px] text-emerald-400 mt-1 block">
            Off-Peak: {reportSummary.offPeakPct}% ({reportSummary.offPeakKWh.toLocaleString()} kWh)
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
            ประหยัดเดือนละ ~฿{reportSummary.projectedMonthlySavings.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Main Visual Report Chart */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
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
              <BarChart data={hourlyData} margin={{ top: 18, right: 10, left: -15, bottom: 0 }}>
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
                />
                <Bar dataKey="energyKWh" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="energyKWh" position="top" fill="#e2e8f0" fontSize={10} />
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
                <Bar dataKey="onPeakKWh" name="On-Peak (ค่าไฟแพง)" stackId="a" fill="#f59e0b" />
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
                <Bar dataKey="onPeakKWh" name="On-Peak (ค่าไฟแพง)" stackId="a" fill="#f59e0b" />
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

      {/* Complete All-Meters Table on Standard Page as well */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-400" />
              <span>ตารางรายละเอียดการใช้ไฟฟ้ารายมิเตอร์ครบทุกจุด ({meterBreakdown.length} มิเตอร์)</span>
            </h3>
            <p className="text-xs text-slate-400">
              แยกแสดงหน่วยการใช้ไฟช่วง On-Peak, Off-Peak, หน่วยรวม และค่าไฟฟ้าของแต่ละสายการผลิต
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <th className="py-3 px-3">อันดับ</th>
                <th className="py-3 px-3">รหัสตู้ / Tag</th>
                <th className="py-3 px-3">ชื่อสายการผลิต / เครื่องจักร</th>
                <th className="py-3 px-3 text-right">โหลดปกติ (kW)</th>
                <th className="py-3 px-3 text-right text-amber-300">On-Peak (kWh)</th>
                <th className="py-3 px-3 text-right text-emerald-300">Off-Peak (kWh)</th>
                <th className="py-3 px-3 text-right">หน่วยรวม (kWh)</th>
                <th className="py-3 px-3 text-right">ค่าไฟฟ้า (บาท)</th>
                <th className="py-3 px-3 text-right">สัดส่วน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono">
              {meterBreakdown.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => onSelectMeter && onSelectMeter(m.id)}
                  className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-3 font-bold text-slate-400">#{m.rank}</td>
                  <td className="py-2.5 px-3 text-amber-300 font-bold">
                    [{m.tag}] <span className="text-slate-500 text-[11px]">{m.panel}</span>
                  </td>
                  <td className="py-2.5 px-3 font-sans font-bold text-white">{m.name}</td>
                  <td className="py-2.5 px-3 text-right text-cyan-300">{m.baseKW} kW</td>
                  <td className="py-2.5 px-3 text-right text-amber-200">
                    {m.onPeakKWh.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-200">
                    {m.offPeakKWh.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-white">
                    {m.kwh.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-amber-300">
                    ฿{m.cost.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-blue-300 font-bold">
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
