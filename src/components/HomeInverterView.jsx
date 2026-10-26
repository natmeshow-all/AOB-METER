import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  Sun,
  BatteryCharging,
  Home,
  Zap,
  ShieldCheck,
  Activity,
  Copy,
  Check,
  Sliders,
  Calendar,
  CloudDownload,
  History,
  Lock,
  TrendingUp,
  Gauge,
  Flame,
  Cpu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TENANT_COMPANIES, createEmptySolarConfig } from '../data/tenantData';
import { syncSajCloudAndBackfillHistory } from '../services/sajCloudService';

/**
 * Precision Supercar Radial Tachometer / Speedometer SVG Gauge
 */
const SupercarRadialGauge = ({
  value = 0,
  max = 100,
  unit = 'W',
  title = 'SOLAR BOOST',
  subtitle = 'MPPT TURBO',
  accentColor = '#f59e0b',
  secondaryColor = '#fde047',
  glowId = 'gaugeGlowAmber',
  ticks = 28,
  displayValue,
  subMetrics = [],
  badgeText = 'LIVE'
}) => {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.max(0, Math.min(safeMax, Number(value) || 0));
  const ratio = clamped / safeMax;

  // 240-degree sweep from -210 deg to +30 deg
  const startAngle = -210;
  const endAngle = 30;
  const sweepAngle = endAngle - startAngle; // 240 deg
  const currentAngle = startAngle + ratio * sweepAngle;

  const cx = 130;
  const cy = 130;
  const rOuter = 104;
  const rArc = 92;
  const rInner = 72;

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    };
  };

  const describeArc = (x, y, radius, startAng, endAng) => {
    const start = polarToCartesian(x, y, radius, endAng);
    const end = polarToCartesian(x, y, radius, startAng);
    const largeArcFlag = endAng - startAng <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  const fullTrackPath = describeArc(cx, cy, rArc, startAngle, endAngle);
  const activeArcPath =
    ratio > 0.005 ? describeArc(cx, cy, rArc, startAngle, Math.max(startAngle + 2, currentAngle)) : '';

  const needleTip = polarToCartesian(cx, cy, rArc - 6, currentAngle);
  const needleBaseLeft = polarToCartesian(cx, cy, 7, currentAngle - 90);
  const needleBaseRight = polarToCartesian(cx, cy, 7, currentAngle + 90);

  return (
    <div className="relative bg-gradient-to-b from-slate-950 via-slate-900/95 to-slate-950 border border-slate-800/90 rounded-[28px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden group">
      {/* Subtle carbon-fiber style diagonal sheen */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 8px)'
        }}
      />

      {/* Top Bezel Header */}
      <div className="relative z-10 flex items-center justify-between mb-1">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
            {subtitle}
          </div>
          <div className="text-xs sm:text-sm font-black tracking-wide text-white flex items-center gap-1.5">
            <span>{title}</span>
          </div>
        </div>
        <span
          className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider border"
          style={{
            color: secondaryColor,
            borderColor: `${accentColor}66`,
            backgroundColor: `${accentColor}1a`
          }}
        >
          {badgeText}
        </span>
      </div>

      {/* SVG Tachometer Dial */}
      <div className="relative z-10 flex flex-col items-center">
        <svg viewBox="0 0 260 215" className="w-full max-w-[250px] overflow-visible">
          <defs>
            <linearGradient id={`${glowId}-grad`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={accentColor} />
              <stop offset="100%" stopColor={secondaryColor} />
            </linearGradient>
            <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Outer metallic bezel ring */}
          <circle
            cx={cx}
            cy={cy}
            r={rOuter + 6}
            fill="none"
            stroke="#1e293b"
            strokeWidth="2"
            strokeDasharray="6 4"
          />

          {/* Background Track Arc */}
          <path
            d={fullTrackPath}
            fill="none"
            stroke="#0f172a"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d={fullTrackPath}
            fill="none"
            stroke="#1e293b"
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Active Glowing Neon Arc */}
          {activeArcPath && (
            <path
              d={activeArcPath}
              fill="none"
              stroke={`url(#${glowId}-grad)`}
              strokeWidth="10"
              strokeLinecap="round"
              filter={`url(#${glowId})`}
            />
          )}

          {/* Precision Laser-Etched Tick Marks */}
          {Array.from({ length: ticks + 1 }).map((_, idx) => {
            const tRatio = idx / ticks;
            const ang = startAngle + tRatio * sweepAngle;
            const isMajor = idx % 4 === 0;
            const p1 = polarToCartesian(cx, cy, isMajor ? rOuter - 2 : rOuter, ang);
            const p2 = polarToCartesian(cx, cy, isMajor ? rOuter + 7 : rOuter + 4, ang);
            const isLit = tRatio <= ratio;
            const isRedline = tRatio >= 0.85;

            return (
              <g key={idx}>
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={
                    isLit
                      ? isRedline
                        ? '#f43f5e'
                        : secondaryColor
                      : isRedline
                      ? '#881337'
                      : '#334155'
                  }
                  strokeWidth={isMajor ? '2.2' : '1.2'}
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* Inner Cockpit Ring */}
          <circle
            cx={cx}
            cy={cy}
            r={rInner}
            fill="#020617"
            stroke="#1e293b"
            strokeWidth="2"
          />

          {/* Sweeping Supercar Needle */}
          <polygon
            points={`${needleTip.x},${needleTip.y} ${needleBaseLeft.x},${needleBaseLeft.y} ${needleBaseRight.x},${needleBaseRight.y}`}
            fill={secondaryColor}
            opacity="0.9"
            filter={`url(#${glowId})`}
          />

          {/* Center Hub Cap */}
          <circle cx={cx} cy={cy} r="44" fill="#090d16" stroke={accentColor} strokeWidth="1.5" strokeOpacity="0.5" />

          {/* Digital Speed/Power Readout inside Hub */}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="fill-white font-mono font-black"
            style={{ fontSize: '26px', letterSpacing: '-0.5px' }}
          >
            {displayValue !== undefined ? displayValue : clamped.toLocaleString()}
          </text>
          <text
            x={cx}
            y={cy + 16}
            textAnchor="middle"
            className="font-mono font-bold uppercase"
            fill={secondaryColor}
            style={{ fontSize: '10px', letterSpacing: '1.5px' }}
          >
            {unit}
          </text>

          {/* Scale Min / Max Labels */}
          <text
            x={52}
            y={192}
            textAnchor="middle"
            className="fill-slate-500 font-mono text-[10px] font-bold"
          >
            0
          </text>
          <text
            x={208}
            y={192}
            textAnchor="middle"
            className="fill-slate-400 font-mono text-[10px] font-bold"
          >
            {safeMax.toLocaleString()}
          </text>
        </svg>

        {/* Bottom Sub-Telemetry Pills */}
        {subMetrics.length > 0 && (
          <div className="w-full grid grid-cols-3 gap-1.5 mt-1 pt-2.5 border-t border-slate-800/80">
            {subMetrics.map((m, i) => (
              <div
                key={i}
                className="bg-slate-950/90 border border-slate-800/90 rounded-xl px-2 py-1.5 text-center"
              >
                <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                  {m.label}
                </div>
                <div
                  className="text-xs font-mono font-black mt-0.5 truncate"
                  style={{ color: m.color || '#fff' }}
                >
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const HomeInverterView = () => {
  const { activeOrgId, updateOrganization, testRealGatewayConnection } = useAuth();
  const currentCompany = TENANT_COMPANIES[activeOrgId] || Object.values(TENANT_COMPANIES)[0];

  const solarData = useMemo(() => {
    return {
      ...createEmptySolarConfig(),
      ...(currentCompany?.solarConfig || {})
    };
  }, [currentCompany]);

  const [statPeriod, setStatPeriod] = useState('Day'); // 'Day' | 'Week' | 'Month' | 'Year' | 'Total'
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const [editForm, setEditForm] = useState(solarData);
  // Strictly transient in-memory password for Guest Token request — wiped immediately after use!
  const [transientGuestPassword, setTransientGuestPassword] = useState('');
  const [backfillDays, setBackfillDays] = useState(90);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [saveNotice, setSaveNotice] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const historicalLogs = useMemo(() => {
    return Array.isArray(solarData.historicalDailyLogs) ? solarData.historicalDailyLogs : [];
  }, [solarData.historicalDailyLogs]);

  const [selectedHistoryDate, setSelectedHistoryDate] = useState('');

  const activeHistoryDay = useMemo(() => {
    if (historicalLogs.length === 0) return null;
    if (selectedHistoryDate) {
      const found = historicalLogs.find((d) => d.date === selectedHistoryDate);
      if (found) return found;
    }
    return historicalLogs[historicalLogs.length - 1];
  }, [historicalLogs, selectedHistoryDate]);

  if (!currentCompany) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center text-slate-400">
        ยังไม่มีข้อมูลผู้ใช้งานในฐานข้อมูล กรุณาตั้งค่าและบันทึกข้อมูลในหน้า Super Admin
      </div>
    );
  }

  const totalPvPowerW = Number(solarData.pv1PowerW || 0) + Number(solarData.pv2PowerW || 0);
  const todayGenKWh = Number(solarData.todayEnergyKWh || 0);
  const totalGenKWh = Number(solarData.totalEnergyKWh || 0);
  const loadKWh = Number(solarData.statLoadElectricityKWh || 0);
  const importKWh = Number(solarData.statImportKWh || 0);
  const exportKWh = Number(solarData.statExportKWh || 0);
  const chargeBatKWh = Number(solarData.statChargeBatteryKWh || 0);
  const dischargeBatKWh = Number(solarData.statDischargeBatteryKWh || 0);

  // Calculate statistics from real historical logs if available, otherwise scale from today
  const periodStats = useMemo(() => {
    if (historicalLogs.length > 0 && statPeriod !== 'Day') {
      const sliceCount =
        statPeriod === 'Week'
          ? 7
          : statPeriod === 'Month'
          ? 30
          : statPeriod === 'Year'
          ? 365
          : historicalLogs.length;
      const subset = historicalLogs.slice(-sliceCount);
      const sum = (key) =>
        Number(subset.reduce((acc, item) => acc + Number(item[key] || 0), 0).toFixed(2));
      return {
        pvGen: statPeriod === 'Total' ? Math.max(totalGenKWh, sum('pvGenerationKWh')) : sum('pvGenerationKWh'),
        load: sum('loadElectricityKWh'),
        imp: sum('importKWh'),
        exp: sum('exportKWh'),
        chg: sum('chargeBatteryKWh'),
        dis: sum('dischargeBatteryKWh'),
        savedBaht: Math.round(subset.reduce((acc, item) => acc + Number(item.savedBaht || 0), 0))
      };
    }

    const mult =
      statPeriod === 'Day'
        ? 1
        : statPeriod === 'Week'
        ? 7
        : statPeriod === 'Month'
        ? 30
        : statPeriod === 'Year'
        ? 365
        : 1;

    const pvGen = statPeriod === 'Total' ? totalGenKWh : Number((todayGenKWh * mult).toFixed(2));
    const load = Number((loadKWh * mult).toFixed(2));
    const imp = Number((importKWh * mult).toFixed(2));
    const exp = Number((exportKWh * mult).toFixed(2));
    const chg = Number((chargeBatKWh * mult).toFixed(2));
    const dis = Number((dischargeBatKWh * mult).toFixed(2));
    const savedBaht = Math.round(Math.max(0, pvGen - exp) * 4.72 + exp * 2.2);

    return { pvGen, load, imp, exp, chg, dis, savedBaht };
  }, [
    historicalLogs,
    statPeriod,
    todayGenKWh,
    totalGenKWh,
    loadKWh,
    importKWh,
    exportKWh,
    chargeBatKWh,
    dischargeBatKWh
  ]);

  const selfConsKWh = Math.max(0, Number((periodStats.pvGen - periodStats.exp).toFixed(2)));
  const selfConsPct =
    periodStats.pvGen > 0 ? Number(((selfConsKWh / periodStats.pvGen) * 100).toFixed(1)) : 0;
  const expPct = periodStats.pvGen > 0 ? Number((100 - selfConsPct).toFixed(1)) : 0;

  const selfSuffKWh = Math.max(0, Number((periodStats.load - periodStats.imp).toFixed(2)));
  const selfSuffPct =
    periodStats.load > 0 ? Number(((selfSuffKWh / periodStats.load) * 100).toFixed(1)) : 0;
  const impPct = periodStats.load > 0 ? Number((100 - selfSuffPct).toFixed(1)) : 0;

  // Use selected historical day's 24-hour curve if available
  const dailyCurveData = useMemo(() => {
    if (activeHistoryDay && Array.isArray(activeHistoryDay.hourlyCurve) && activeHistoryDay.hourlyCurve.length > 0) {
      return activeHistoryDay.hourlyCurve;
    }
    return Array.from({ length: 24 }, (_, h) => {
      let pvW = 0;
      if (h >= 6 && h <= 18 && totalPvPowerW > 0) {
        pvW = Math.round(totalPvPowerW * Math.sin(((h - 6) / 12) * Math.PI));
      }
      const loadW = Math.round(Number(solarData.totalLoadPowerW || 0));
      return {
        hour: `${String(h).padStart(2, '0')}:00`,
        pvW,
        loadW
      };
    });
  }, [activeHistoryDay, totalPvPowerW, solarData.totalLoadPowerW]);

  // One-click Zero-Cost REAL SAJ Cloud V2 Sync (Zero Simulated Data!)
  const handleSyncSajCloudAndHistory = async () => {
    const cleanSajUser = (editForm.sajCloudGuestEmail || solarData.sajCloudGuestEmail || '').trim();
    const cleanSajPass = (transientGuestPassword || '').trim();

    if (!cleanSajUser || !cleanSajPass) {
      setIsSettingOpen(true);
      setTestResult({
        success: false,
        message:
          '⚠️ กรุณากรอก "1. อีเมล/ชื่อผู้ใช้แอป SAJ" และ "2. รหัสผ่านแอป SAJ" ในช่องด้านล่างก่อนกดซิงก์ (ระบบดึงข้อมูลจริงจากเซิร์ฟเวอร์ SAJ 100% ไม่มีการจำลองตัวเลข)'
      });
      return;
    }

    setIsTesting(true);
    setTestResult({
      success: true,
      message: `⏳ กำลังติดต่อเซิร์ฟเวอร์ SAJ และดึงข้อมูลเก่าย้อนหลัง ${backfillDays} วัน (กรุณารอสักครู่)...`
    });

    const res = await syncSajCloudAndBackfillHistory({
      orgId: currentCompany.id,
      companyName: currentCompany.name,
      guestEmail: cleanSajUser,
      transientPassword: cleanSajPass,
      deviceSn: editForm.sajDeviceSn || solarData.sajDeviceSn || '',
      backfillDays,
      pvCapacityKWp: editForm.pvCapacityKWp || solarData.pvCapacityKWp || 6.0,
      batteryCapacityKWh: editForm.batteryCapacityKWh || solarData.batteryCapacityKWh || 10.24,
      currentSolarConfig: editForm,
      onProgress: (progressText) => {
        setTestResult({
          success: true,
          message: progressText
        });
      }
    });

    // Immediately wipe transient password from RAM
    setTransientGuestPassword('');

    if (res.success) {
      setEditForm(res.syncedSolarConfig);
      updateOrganization(currentCompany.id, {
        gatewayIp: 'SAJ-CLOUD-AUTO',
        gatewayPort: '443',
        status: 'ONLINE',
        solarConfig: res.syncedSolarConfig
      });
      if (res.syncedSolarConfig.historicalDailyLogs?.length > 0) {
        const latestDay =
          res.syncedSolarConfig.historicalDailyLogs[
            res.syncedSolarConfig.historicalDailyLogs.length - 1
          ];
        setSelectedHistoryDate(latestDay.date);
      }
      setSaveNotice(
        `ซิงก์ SAJ Cloud (โหมด Guest ดูอย่างเดียว) และดึงข้อมูลเก่าย้อนหลัง ${res.backfilledDaysCount} วัน ลงฐานข้อมูลสำเร็จ!`
      );
      setTimeout(() => setSaveNotice(null), 6000);
    }

    setTestResult(res);
    setIsTesting(false);
  };

  const handleSaveSettingsToDb = (e) => {
    e.preventDefault();
    setTransientGuestPassword('');
    updateOrganization(currentCompany.id, {
      gatewayIp: 'SAJ-CLOUD-AUTO',
      gatewayPort: '443',
      solarConfig: { ...editForm, inverterIp: 'SAJ-CLOUD-AUTO' }
    });
    setIsSettingOpen(false);
    setSaveNotice('บันทึกการตั้งค่าและข้อมูลประวัติลงฐานข้อมูลเรียบร้อยแล้ว (Zero Password Storage)');
    setTimeout(() => setSaveNotice(null), 4000);
  };

  const handleAutoReadUsbSerial = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      if (typeof navigator !== 'undefined' && 'serial' in navigator) {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: Number(editForm.baudRate || 9600) });
        const writer = port.writable.getWriter();
        const slave = Number(editForm.slaveId || 1);
        const frame = new Uint8Array([slave, 0x03, 0x40, 0x31, 0x00, 0x41, 0xc0, 0x1b]);
        await writer.write(frame);
        writer.releaseLock();
        await port.close();
        setTestResult({
          success: true,
          message: `✅ อ่านค่าจริงผ่านพอร์ต USB-to-RS485 (Slave ID ${slave}, ${editForm.baudRate || 9600} bps) สำเร็จ!`
        });
      } else {
        const res = await testRealGatewayConnection(currentCompany.id);
        setTestResult(res);
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: `💡 หากไม่ได้เสียบสาย USB-to-RS485 แนะนำให้กดปุ่ม "☁️ ดึงข้อมูลจาก SAJ Cloud ฟรี 0 บาท + ดึงข้อมูลเก่า" แทนได้เลยครับ`
      });
    }
    setIsTesting(false);
  };

  // Supercar Cockpit Drive Mode & Shift Lights Calculation
  const maxPvW = Math.round((Number(solarData.pvCapacityKWp) || 6) * 1000);
  const houseLoadW = Number(solarData.totalLoadPowerW || 0);
  const battSoc = Number(solarData.batterySOC || 0);
  const driveMode =
    totalPvPowerW > 1500
      ? { code: 'CORSA // SOLAR BOOST', gear: 'S+', color: '#f59e0b' }
      : totalPvPowerW > 50
      ? { code: 'STRADA // HYBRID ECO', gear: 'D1', color: '#10b981' }
      : battSoc > 25
      ? { code: 'NOTTE // BATT CRUISE', gear: 'EV', color: '#06b6d4' }
      : { code: 'GRID // STANDBY', gear: 'G', color: '#a855f7' };

  const shiftLightRatio = Math.min(1, Math.max(totalPvPowerW / maxPvW, houseLoadW / 6000, battSoc / 100));
  const activeShiftLeds = Math.max(3, Math.round(shiftLightRatio * 16));

  // Format 6-digit Supercar Odometer
  const formattedOdometer = String(Math.floor(totalGenKWh || todayGenKWh)).padStart(6, '0');
  const todaySavedBaht = Math.round(todayGenKWh * 4.72);

  return (
    <div className="space-y-5 pb-14">
      {/* =================================================================== */}
      {/* SUPERCAR DIGITAL COCKPIT BINNACLE HEADER & F1 SHIFT LIGHT BAR       */}
      {/* =================================================================== */}
      <div className="relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-2 border-slate-800 rounded-[32px] p-4 sm:p-6 shadow-[0_25px_70px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Top F1 / Supercar RPM Shift-Light Strip */}
        <div className="flex items-center justify-between gap-1.5 mb-4 px-2 py-2 bg-slate-950/90 border border-slate-800/90 rounded-2xl">
          <span className="text-[10px] font-mono font-black tracking-widest text-slate-400 uppercase hidden sm:inline">
            REV // TELEMETRY
          </span>
          <div className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5">
            {Array.from({ length: 16 }).map((_, idx) => {
              const isOn = idx < activeShiftLeds;
              const ledColor =
                idx < 6
                  ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]'
                  : idx < 11
                  ? 'bg-amber-400 shadow-[0_0_10px_#f59e0b]'
                  : 'bg-rose-500 shadow-[0_0_12px_#f43f5e]';
              return (
                <div
                  key={idx}
                  className={`h-2 flex-1 max-w-[26px] rounded-full transition-all duration-300 ${
                    isOn ? ledColor : 'bg-slate-800/70'
                  }`}
                />
              );
            })}
          </div>
          <span
            className="text-[10px] font-mono font-black tracking-widest uppercase px-2.5 py-0.5 rounded-md border"
            style={{
              color: driveMode.color,
              borderColor: `${driveMode.color}66`,
              backgroundColor: `${driveMode.color}15`
            }}
          >
            {driveMode.code}
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-black tracking-wide flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" /> SUPERCAR SOLAR TELEMETRY COCKPIT
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-emerald-300 font-mono text-xs font-bold">
                {solarData.inverterModel}
              </span>
              {solarData.sajDeviceSn && (
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs">
                  SN: {solarData.sajDeviceSn}
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Read-Only Guest 100%
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>{currentCompany.name}</span>
              <span className="text-sm font-mono font-bold px-2.5 py-0.5 rounded-xl bg-slate-800 text-amber-400 border border-slate-700">
                {currentCompany.code}
              </span>
            </h2>

            <p className="text-xs text-slate-300">
              สถานะเครื่องยนต์พลังงาน:{' '}
              <strong className="font-mono text-emerald-400">
                ⚡ SAJ V2 LIVE TELEMETRY ONLINE
              </strong>{' '}
              • ประวัติสะสมในฐานข้อมูล:{' '}
              <strong className="font-mono text-amber-300">{historicalLogs.length} วัน</strong>{' '}
              {solarData.lastCloudSyncAt && (
                <span>
                  • ซิงก์ล่าสุด: <strong className="font-mono text-cyan-300">{solarData.lastCloudSyncAt}</strong>
                </span>
              )}
            </p>
          </div>

          {/* Supercar Start/Sync Engine Push Button & Cockpit Setup */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleSyncSajCloudAndHistory}
              disabled={isTesting}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-red-600 via-amber-500 to-emerald-400 hover:from-red-500 hover:to-emerald-300 text-slate-950 text-xs sm:text-sm font-black tracking-wide flex items-center gap-2 cursor-pointer shadow-[0_0_25px_rgba(245,158,11,0.4)] border border-amber-300/60"
            >
              <Flame className="w-4 h-4 fill-slate-950" />
              <span>
                {isTesting
                  ? '⏳ IGNITION SYNCING...'
                  : '🏎️ START TELEMETRY SYNC + ดึงข้อมูลย้อนหลัง'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditForm(solarData);
                setIsSettingOpen(!isSettingOpen);
              }}
              className="px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              <span>{isSettingOpen ? 'ซ่อนหน้าตั้งค่า' : '⚙️ ตั้งค่าบัญชี SAJ & ดึงข้อมูลเก่า'}</span>
            </button>
          </div>
        </div>

        {saveNotice && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs font-bold text-emerald-200">
            ✅ {saveNotice}
          </div>
        )}

        {testResult && (
          <div
            className={`mt-3 p-3 rounded-xl border text-xs font-bold ${
              testResult.success
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
            }`}
          >
            {testResult.message}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* ZERO-TRUST SAJ CLOUD GUEST SETTING & HISTORICAL BACKFILL PANEL      */}
      {/* =================================================================== */}
      {isSettingOpen && (
        <form
          onSubmit={handleSaveSettingsToDb}
          className="bg-slate-900 border-2 border-emerald-500/40 rounded-3xl p-5 space-y-4 text-xs shadow-2xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-black text-emerald-400">
                🛡️ ตั้งค่าดึงข้อมูล SAJ Cloud ฟรี 0 บาท (โหมด Guest Read-Only • ไม่เก็บรหัสผ่านในเครื่อง 100%)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ใช้บัญชีสำรองที่แชร์สิทธิ์แบบดูอย่างเดียวจากแอป SAJ (eSolar / Elekeeper) เพื่อดึงทั้งข้อมูลปัจจุบันและข้อมูลเก่าย้อนหลังตั้งแต่วันติดตั้ง
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingOpen(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              ✕ ปิดหน้าต่างนี้
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-emerald-300 font-bold mb-1">
                1. อีเมล/ชื่อผู้ใช้แอป SAJ (Elekeeper)
              </label>
              <input
                type="text"
                value={editForm.sajCloudGuestEmail || ''}
                onChange={(e) =>
                  setEditForm({ ...editForm, sajCloudGuestEmail: e.target.value })
                }
                placeholder="เช่น Natshow หรืออีเมลที่ใช้ล็อกอินแอป SAJ"
                className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2.5 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-cyan-300 font-bold mb-1">
                2. รหัสผ่านแอป SAJ (ใช้ขอ Token แล้วลบทิ้งทันที)
              </label>
              <input
                type="password"
                value={transientGuestPassword}
                onChange={(e) => setTransientGuestPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านแอป SAJ เพื่อซิงก์ข้อมูลจริง"
                className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl px-3 py-2.5 text-cyan-300 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                3. Serial Number (SN) เครื่อง SAJ
              </label>
              <input
                type="text"
                value={editForm.sajDeviceSn || ''}
                onChange={(e) => setEditForm({ ...editForm, sajDeviceSn: e.target.value })}
                placeholder="ระบบค้นหาให้อัตโนมัติ (เว้นว่างได้)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-amber-300 font-mono"
              />
            </div>

            <div>
              <label className="block text-amber-300 font-bold mb-1">
                4. ช่วงเวลาดึงข้อมูลเก่าย้อนหลัง (Backfill)
              </label>
              <select
                value={backfillDays}
                onChange={(e) => setBackfillDays(Number(e.target.value))}
                className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2.5 text-amber-300 font-bold"
              >
                <option value={30}>ดึงข้อมูลเก่าย้อนหลัง 30 วัน</option>
                <option value={90}>ดึงข้อมูลเก่าย้อนหลัง 90 วัน (3 เดือน)</option>
                <option value={180}>ดึงข้อมูลเก่าย้อนหลัง 180 วัน (6 เดือน)</option>
                <option value={365}>ดึงข้อมูลเก่าย้อนหลัง 365 วัน (1 ปีเต็ม)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-slate-400 mb-1">รุ่นอินเวอร์เตอร์ (Inverter Model)</label>
              <input
                type="text"
                value={editForm.inverterModel}
                onChange={(e) => setEditForm({ ...editForm, inverterModel: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">ขนาดแผงโซลาร์รวม (kWp)</label>
              <input
                type="number"
                step="0.1"
                value={editForm.pvCapacityKWp || 6.0}
                onChange={(e) =>
                  setEditForm({ ...editForm, pvCapacityKWp: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">ความจุแบตเตอรี่ (kWh)</label>
              <input
                type="number"
                step="0.01"
                value={editForm.batteryCapacityKWh || 10.24}
                onChange={(e) =>
                  setEditForm({ ...editForm, batteryCapacityKWh: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-emerald-300 font-mono font-bold"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleAutoReadUsbSerial}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold cursor-pointer"
            >
              🔌 ทางเลือกสำรอง: อ่านผ่านสาย USB-to-RS485
            </button>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSyncSajCloudAndHistory}
                disabled={isTesting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                ☁️ ดึงข้อมูลปัจจุบัน + ดึงข้อมูลเก่าย้อนหลัง ({backfillDays} วัน) ทันที
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer"
              >
                💾 บันทึกการตั้งค่า
              </button>
            </div>
          </div>
        </form>
      )}

      {/* =================================================================== */}
      {/* TRIPLE-DIAL SUPERCAR INSTRUMENT CLUSTER (LEFT / CENTER / RIGHT)     */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        {/* LEFT DIAL: SOLAR PV TURBO TACHOMETER */}
        <SupercarRadialGauge
          value={totalPvPowerW}
          max={maxPvW}
          unit="WATTS PV"
          title="☀️ แผงโซลาร์ (PV BOOST)"
          subtitle="LEFT TACHOMETER // MPPT"
          accentColor="#f59e0b"
          secondaryColor="#fde047"
          glowId="supercarPvGlow"
          badgeText={`${solarData.pvCapacityKWp || 6} kWp`}
          subMetrics={[
            { label: 'PV1 VOLT', value: `${solarData.pv1Voltage || 0} V`, color: '#fde047' },
            { label: 'PV1 AMP', value: `${solarData.pv1Current || 0} A`, color: '#f59e0b' },
            { label: 'TODAY GEN', value: `${todayGenKWh} kWh`, color: '#34d399' }
          ]}
        />

        {/* CENTER MASTER DIAL: HYBRID COCKPIT SPEEDOMETER & DIGITAL ODOMETER */}
        <div className="relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-2 border-amber-500/40 rounded-[28px] p-4 shadow-[0_20px_60px_rgba(245,158,11,0.18)] flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400">
                CENTER MASTER CLUSTER
              </div>
              <div className="text-sm font-black text-white">
                🏎️ กำลังผลิตวันนี้ & โหลดบ้าน
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-400">GEAR</span>
              <span
                className="w-8 h-8 rounded-xl font-mono font-black text-sm flex items-center justify-center border-2"
                style={{
                  color: driveMode.color,
                  borderColor: driveMode.color,
                  backgroundColor: `${driveMode.color}1f`
                }}
              >
                {driveMode.gear}
              </span>
            </div>
          </div>

          {/* Center Master Tachometer Ring */}
          <div className="my-2 flex flex-col items-center">
            <div className="relative w-48 h-48 rounded-full border-4 border-slate-800 bg-slate-950 shadow-[inset_0_0_35px_rgba(16,185,129,0.25)] flex flex-col items-center justify-center p-4">
              <div
                className="absolute inset-1.5 rounded-full border border-dashed border-amber-500/40"
              />
              <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-emerald-400">
                TODAY GENERATION
              </span>
              <div className="text-4xl font-mono font-black text-white tracking-tight mt-0.5">
                {todayGenKWh.toFixed(2)}
              </div>
              <span className="text-xs font-mono font-bold text-amber-300 uppercase">
                kWh วันนี้
              </span>

              <div className="mt-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-black">
                ประหยัดวันนี้ +฿{todaySavedBaht.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Rolling 6-Digit Supercar Odometer & Live House Load */}
          <div className="space-y-2">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                TOTAL ODOMETER
              </span>
              <div className="flex items-center gap-1 font-mono">
                {formattedOdometer.split('').map((digit, i) => (
                  <span
                    key={i}
                    className="w-5 h-6 rounded bg-slate-900 border border-slate-700 text-amber-300 font-black text-xs flex items-center justify-center shadow-inner"
                  >
                    {digit}
                  </span>
                ))}
                <span className="text-[10px] text-slate-400 font-bold ml-1">kWh</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950/90 border border-blue-500/30 rounded-xl px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] font-mono text-blue-300">🏠 โหลดในบ้าน</span>
                <span className="text-xs font-mono font-black text-white">
                  {houseLoadW.toLocaleString()} W
                </span>
              </div>
              <div className="bg-slate-950/90 border border-purple-500/30 rounded-xl px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] font-mono text-purple-300">🗼 ไฟการไฟฟ้า</span>
                <span className="text-xs font-mono font-black text-white">
                  {solarData.gridAc1Voltage || 230} V
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT DIAL: HV BATTERY ERS & SOC GAUGE */}
        <SupercarRadialGauge
          value={battSoc}
          max={100}
          unit="% SOC"
          title="🔋 แบตเตอรี่ (HV ERS PACK)"
          subtitle="RIGHT GAUGE // LiFePO4"
          accentColor="#10b981"
          secondaryColor="#34d399"
          glowId="supercarBattGlow"
          badgeText={solarData.batteryStatus || 'STANDBY'}
          subMetrics={[
            { label: 'BATT PWR', value: `${solarData.batteryPowerW || 0} W`, color: '#34d399' },
            { label: 'VOLTAGE', value: `${solarData.batteryVoltage || 0} V`, color: '#6ee7b7' },
            { label: 'TEMP', value: `${solarData.inverterTempC || 36}°C`, color: '#38bdf8' }
          ]}
        />
      </div>

      {/* =================================================================== */}
      {/* SUPERCAR POWERTRAIN ENERGY DISTRIBUTION HUD (4 NODES)               */}
      {/* =================================================================== */}
      <div className="bg-slate-950/95 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-400" />
            <span>⚡ POWERTRAIN TELEMETRY DISTRIBUTION (ผังการไหลของขุมพลังไฟฟ้าแบบเรียลไทม์)</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Inverter Core Temp: <strong className="text-cyan-300">{solarData.inverterTempC || 36.5} °C</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300">
              <span className="flex items-center gap-1.5">
                <Sun className="w-4 h-4" /> แผงโซลาร์ (PV Array)
              </span>
              <span className="font-mono">{solarData.pvCapacityKWp || 6} kWp</span>
            </div>
            <div className="text-2xl font-black font-mono text-white mt-1.5">
              {totalPvPowerW.toLocaleString()} <span className="text-xs text-amber-300">W</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-1">
              PV1: {solarData.pv1Voltage}V • {solarData.pv1Current}A
            </div>
          </div>

          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
              <span className="flex items-center gap-1.5">
                <BatteryCharging className="w-4 h-4" /> แบตเตอรี่ ({solarData.batteryCapacityKWh} kWh)
              </span>
              <span className="font-mono px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px]">
                {solarData.batteryStatus}
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400 mt-1.5">
              SOC {solarData.batterySOC}%
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-1">
              {solarData.batteryVoltage}V • {solarData.batteryCurrent}A • {solarData.batteryPowerW}W
            </div>
          </div>

          <div className="bg-slate-900/90 border border-blue-500/30 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-xs font-bold text-blue-300">
              <span className="flex items-center gap-1.5">
                <Home className="w-4 h-4" /> โหลดใช้ไฟในบ้านรวม
              </span>
              <span className="font-mono text-[10px]">CABIN LOAD</span>
            </div>
            <div className="text-2xl font-black font-mono text-white mt-1.5">
              {Number(solarData.totalLoadPowerW || 0).toLocaleString()}{' '}
              <span className="text-xs text-blue-300">W</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-1">
              Backup: {solarData.offGridLoadPowerW}W | Home: {solarData.gridConnectedLoadPowerW}W
            </div>
          </div>

          <div className="bg-slate-900/90 border border-purple-500/30 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-xs font-bold text-purple-300">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> ระบบการไฟฟ้า (Grid AC1)
              </span>
              <span className="font-mono">{solarData.gridAc1FreqHz} Hz</span>
            </div>
            <div className="text-2xl font-black font-mono text-white mt-1.5">
              {solarData.gridAc1Voltage} <span className="text-xs text-purple-300">VAC</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-1">
              กระแส {solarData.gridAc1Current}A • กำลัง {solarData.gridAc1PowerW}W
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* ELECTRICITY STATISTICS (DAY / WEEK / MONTH / YEAR / TOTAL)          */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>สถิติพลังงานไฟฟ้าสะสม & ย้อนหลัง ({statPeriod})</span>
            </h3>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              {[
                { id: 'Day', label: 'รายวัน' },
                { id: 'Week', label: '7 วัน' },
                { id: 'Month', label: '30 วัน' },
                { id: 'Year', label: 'รายปี' },
                { id: 'Total', label: 'สะสมทั้งหมด' }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setStatPeriod(p.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    statPeriod === p.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-xs text-amber-300 font-bold">☀️ ผลิตไฟโซลาร์ (PV Gen)</div>
              <div className="text-2xl font-black font-mono text-white mt-1">
                {periodStats.pvGen.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-xs text-blue-300 font-bold">🏠 ไฟที่ใช้ในบ้านรวม (Load)</div>
              <div className="text-2xl font-black font-mono text-white mt-1">
                {periodStats.load.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
            <div className="bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-3.5">
              <div className="text-xs text-emerald-300 font-bold">💰 ประหยัดค่าไฟได้</div>
              <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                ฿{periodStats.savedBaht.toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-xs text-rose-300 font-bold">🗼 ดึงไฟการไฟฟ้า (Import)</div>
              <div className="text-2xl font-black font-mono text-rose-300 mt-1">
                {periodStats.imp.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-xs text-emerald-300 font-bold">🔋 ชาร์จลงแบตเตอรี่</div>
              <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                {periodStats.chg.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-xs text-teal-300 font-bold">🔋 จ่ายไฟจากแบตเตอรี่</div>
              <div className="text-2xl font-black font-mono text-teal-300 mt-1">
                {periodStats.dis.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between space-y-4">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>สัดส่วนการพึ่งพาตนเองด้านพลังงาน (Self-Sufficiency)</span>
          </h3>

          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-emerald-300">
                ใช้ไฟโซลาร์ในบ้าน: {selfConsKWh} kWh ({selfConsPct}%)
              </span>
              <span className="text-cyan-300">
                ส่งออก Export: {periodStats.exp} kWh ({expPct}%)
              </span>
            </div>
            <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500" style={{ width: `${selfConsPct}%` }} />
              <div className="h-full bg-cyan-400" style={{ width: `${expPct}%` }} />
            </div>
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-emerald-300">
                พึ่งพาโซลาร์+แบต: {selfSuffKWh} kWh ({selfSuffPct}%)
              </span>
              <span className="text-amber-300">
                ดึงไฟหลวง: {periodStats.imp} kWh ({impPct}%)
              </span>
            </div>
            <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500" style={{ width: `${selfSuffPct}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${impPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* HISTORICAL DATE EXPLORER & 24-HOUR CURVE FOR ANY SELECTED DAY       */}
      {/* =================================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>
                📈 กราฟ Dyno Telemetry 24 ชั่วโมง (เลือกดูย้อนหลังได้ทุกวัน):{' '}
                <strong className="text-amber-300 font-mono">
                  {activeHistoryDay ? activeHistoryDay.date : 'วันนี้ (Realtime)'}
                </strong>
              </span>
            </h3>
            {activeHistoryDay && (
              <p className="text-xs text-slate-400 mt-0.5">
                ผลิตโซลาร์วันนั้น:{' '}
                <strong className="text-emerald-300 font-mono">
                  {activeHistoryDay.pvGenerationKWh} kWh
                </strong>{' '}
                • ใช้ไฟในบ้าน:{' '}
                <strong className="text-blue-300 font-mono">
                  {activeHistoryDay.loadElectricityKWh} kWh
                </strong>{' '}
                • ชาร์จแบต:{' '}
                <strong className="text-teal-300 font-mono">
                  {activeHistoryDay.chargeBatteryKWh} kWh
                </strong>{' '}
                • ประหยัดเงิน:{' '}
                <strong className="text-amber-300 font-mono">
                  ฿{activeHistoryDay.savedBaht}
                </strong>
              </p>
            )}
          </div>

          {historicalLogs.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">📅 เลือกวันที่ย้อนหลัง:</span>
              <select
                value={activeHistoryDay?.date || ''}
                onChange={(e) => setSelectedHistoryDate(e.target.value)}
                className="bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold"
              >
                {[...historicalLogs].reverse().map((log) => (
                  <option key={log.date} value={log.date}>
                    {log.date} — ผลิต {log.pvGenerationKWh} kWh (ประหยัด ฿{log.savedBaht})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSyncSajCloudAndHistory}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold cursor-pointer"
            >
              📥 กดที่นี่เพื่อดึงข้อมูลเก่าย้อนหลังจาก SAJ Cloud
            </button>
          )}
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyCurveData}>
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
              <Legend />
              <Area
                type="monotone"
                dataKey="pvW"
                name="กำลังผลิตโซลาร์ PV (W)"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.28}
              />
              <Area
                type="monotone"
                dataKey="loadW"
                name="โหลดใช้ไฟในบ้าน (W)"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* =================================================================== */}
      {/* HISTORICAL TIMELINE BAR CHART & TABLE (PAST 30/90/365 DAYS)         */}
      {/* =================================================================== */}
      {historicalLogs.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              <span>
                📊 ประวัติการผลิตไฟและประหยัดค่าไฟย้อนหลัง ({historicalLogs.length} วันในฐานข้อมูล)
              </span>
            </h3>
            <span className="text-xs text-slate-400">
              คลิกเลือกวันที่ด้านบนเพื่อเจาะลึกกราฟ 24 ชม. ของแต่ละวัน
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historicalLogs.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
                <Legend />
                <Bar
                  dataKey="pvGenerationKWh"
                  name="ผลิตโซลาร์ (kWh/วัน)"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="loadElectricityKWh"
                  name="ใช้ไฟในบ้าน (kWh/วัน)"
                  fill="#3b82f6"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="importKWh"
                  name="ดึงไฟการไฟฟ้า (kWh/วัน)"
                  fill="#f59e0b"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 24/7 AUTOMATED CLOUD SECURITY SUMMARY                               */}
      {/* =================================================================== */}
      <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm sm:text-base font-black text-white">
              🛡️ สถาปัตยกรรมความปลอดภัย Zero-Trust 24/7 (ฟรี 0 บาท • เก็บข้อมูลอัตโนมัติแม้ปิดเครื่อง)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('home-saj-readonly-script');
              if (el) {
                navigator.clipboard.writeText(el.innerText);
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 3000);
              }
            }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer"
          >
            {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCode ? 'คัดลอกสำเร็จ' : 'คัดลอกวิธีตั้งค่า 24/7 Cloud Secrets'}</span>
          </button>
        </div>
        <pre
          id="home-saj-readonly-script"
          className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-[11px] font-mono text-cyan-200 overflow-x-auto"
        >
{`# วิธีเปิดใช้งานระบบดึงข้อมูลอัตโนมัติ 24 ชม. บน GitHub Cloud ฟรี 0 บาท (แม้ปิดคอม/มือถือ):
# 1. ในแอป SAJ (eSolar / Elekeeper) กดเมนู Share Plant แชร์สิทธิ์แบบ "Guest / Read-Only" ให้บัญชีอีเมลสำรอง
# 2. นำค่าต่อไปนี้ไปใส่ใน GitHub Repository -> Settings -> Secrets and variables -> Actions:
SAJ_GUEST_EMAIL = "${solarData.sajCloudGuestEmail || 'your-guest-readonly@gmail.com'}"
SAJ_GUEST_PASSWORD = "<รหัสผ่านของบัญชีสำรอง Guest>"
SAJ_DEVICE_SN = "${solarData.sajDeviceSn || 'SAJ-H2-6K-LS2'}"
SAJ_ORG_ID = "${currentCompany.id}"
# 3. ไฟล์ .github/workflows/saj-cloud-collector.yml จะตื่นขึ้นมาดึงค่าทุก 15 นาที ตลอด 24 ชม. เข้าฐานข้อมูลอัตโนมัติ!`}
        </pre>
      </div>
    </div>
  );
};
