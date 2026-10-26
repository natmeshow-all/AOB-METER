import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  Cpu,
  Compass,
  Clock,
  Sparkles,
  Leaf,
  RefreshCw,
  Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TENANT_COMPANIES, createEmptySolarConfig } from '../data/tenantData';
import {
  syncSajCloudAndBackfillHistory,
  getSavedSajSessionTicket,
  getSavedSajEmail,
  normalizeHistoricalDayLog,
  getThailandDateStr
} from '../services/sajCloudService';

const formatSlashDate = (isoStr) => {
  if (!isoStr || typeof isoStr !== 'string') return '';
  const parts = isoStr.slice(0, 10).split('-');
  if (parts.length !== 3) return isoStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

// Residential stepped (progressive) electricity tariff — editable in ⚙️ ตั้งค่า
const TARIFF_STORAGE_KEY = 'POWERVIEW_TARIFF_TIERS_V1';
const DEFAULT_TARIFF_TIERS = [
  { upTo: 200, rate: 3.0 },
  { upTo: 400, rate: 4.22 },
  { upTo: null, rate: 4.42 }
];
const DEFAULT_EXPORT_RATE = 2.2;

const loadTariffSettings = () => {
  try {
    const raw = localStorage.getItem(TARIFF_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.tiers) && parsed.tiers.length > 0) {
        return {
          tiers: parsed.tiers,
          exportRate: Number(parsed.exportRate ?? DEFAULT_EXPORT_RATE)
        };
      }
    }
  } catch {
    // ignore malformed storage
  }
  return { tiers: DEFAULT_TARIFF_TIERS, exportRate: DEFAULT_EXPORT_RATE };
};

/**
 * Calculates a monthly stepped electricity bill (e.g. 0–200 units @ 3 baht, 201–400 @ 4.22, 401+ @ 4.42).
 */
export const calcTieredBill = (kwh, tiers = DEFAULT_TARIFF_TIERS) => {
  let remaining = Math.max(0, Number(kwh) || 0);
  let prevCap = 0;
  let total = 0;
  for (const tier of tiers) {
    if (remaining <= 0) break;
    const cap = tier.upTo === null || tier.upTo === '' ? Infinity : Number(tier.upTo);
    const tierUnits = Math.min(remaining, Math.max(0, cap - prevCap));
    total += tierUnits * Number(tier.rate || 0);
    remaining -= tierUnits;
    prevCap = cap;
  }
  return Number(total.toFixed(2));
};

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];
const formatThaiMonth = (ym) => {
  const [y, m] = String(ym).split('-');
  return `${THAI_MONTHS[Number(m) - 1] || m} ${Number(y) + 543}`;
};
const formatBaht = (n) =>
  `฿${Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const COCKPIT_THEMES = {
  WEISSACH: {
    id: 'WEISSACH',
    name: 'Porsche Weissach',
    tag: 'ICE CYAN // TITANIUM',
    pvPrimary: '#0ea5e9',
    pvSecondary: '#38bdf8',
    battPrimary: '#10b981',
    battSecondary: '#34d399',
    ringBorder: 'border-sky-500/30',
    accentBadge: 'bg-sky-500/10 text-sky-300 border-sky-500/30'
  },
  ARAMCO: {
    id: 'ARAMCO',
    name: 'Aston Aramco F1',
    tag: 'EMERALD // CHAMPAGNE',
    pvPrimary: '#f59e0b',
    pvSecondary: '#fbbf24',
    battPrimary: '#14b8a6',
    battSecondary: '#2dd4bf',
    ringBorder: 'border-teal-500/30',
    accentBadge: 'bg-teal-500/10 text-teal-300 border-teal-500/30'
  },
  REVUELTO: {
    id: 'REVUELTO',
    name: 'Lamborghini Corsa',
    tag: 'GOLD // CARBON',
    pvPrimary: '#d97706',
    pvSecondary: '#f59e0b',
    battPrimary: '#06b6d4',
    battSecondary: '#22d3ee',
    ringBorder: 'border-amber-500/30',
    accentBadge: 'bg-amber-500/10 text-amber-300 border-amber-500/30'
  }
};

/**
 * Executive Supercar Radial Instrument Dial (Precision SVG)
 */
const SupercarRadialGauge = ({
  value = 0,
  max = 100,
  unit = 'W',
  title = 'SOLAR ARRAY',
  subtitle = 'MPPT TELEMETRY',
  accentColor = '#0ea5e9',
  secondaryColor = '#38bdf8',
  glowId = 'gaugeGlowPrimary',
  ticks = 32,
  displayValue,
  subMetrics = [],
  badgeText = 'LIVE',
  onClickGauge
}) => {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.max(0, Math.min(safeMax, Number(value) || 0));
  const ratio = clamped / safeMax;

  // 240-degree sweep from -210 deg to +30 deg
  const startAngle = -210;
  const endAngle = 30;
  const sweepAngle = endAngle - startAngle;
  const currentAngle = startAngle + ratio * sweepAngle;

  const cx = 130;
  const cy = 128;
  const rOuter = 102;
  const rArc = 90;
  const rInner = 68;

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
    ratio > 0.003 ? describeArc(cx, cy, rArc, startAngle, Math.max(startAngle + 1.5, currentAngle)) : '';

  const needleTip = polarToCartesian(cx, cy, rArc - 4, currentAngle);
  const needleBaseLeft = polarToCartesian(cx, cy, 5.5, currentAngle - 90);
  const needleBaseRight = polarToCartesian(cx, cy, 5.5, currentAngle + 90);

  return (
    <div
      onClick={onClickGauge}
      className="relative bg-[#080d19]/95 border border-slate-800/90 hover:border-slate-700/90 rounded-[26px] p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.75)] transition-all duration-300 overflow-hidden group cursor-pointer"
    >
      {/* Brushed micro-carbon texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.35), transparent 70%), repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 6px)'
        }}
      />

      {/* Top Instrument Bezel Header */}
      <div className="relative z-10 flex items-center justify-between mb-1">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-400">
            {subtitle}
          </div>
          <div className="text-xs sm:text-sm font-bold tracking-wide text-slate-100 mt-0.5">
            {title}
          </div>
        </div>
        <span
          className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border"
          style={{
            color: secondaryColor,
            borderColor: `${accentColor}44`,
            backgroundColor: `${accentColor}12`
          }}
        >
          {badgeText}
        </span>
      </div>

      {/* SVG Tachometer Dial */}
      <div className="relative z-10 flex flex-col items-center">
        <svg viewBox="0 0 260 208" className="w-full max-w-[245px] overflow-visible">
          <defs>
            <linearGradient id={`${glowId}-grad`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={accentColor} />
              <stop offset="100%" stopColor={secondaryColor} />
            </linearGradient>
            <filter id={glowId} x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Outer precision titanium ring */}
          <circle
            cx={cx}
            cy={cy}
            r={rOuter + 5}
            fill="none"
            stroke="#1e293b"
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />

          {/* Track Arc */}
          <path
            d={fullTrackPath}
            fill="none"
            stroke="#0f172a"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d={fullTrackPath}
            fill="none"
            stroke="#1e293b"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Active Precision Arc */}
          {activeArcPath && (
            <path
              d={activeArcPath}
              fill="none"
              stroke={`url(#${glowId}-grad)`}
              strokeWidth="8"
              strokeLinecap="round"
              filter={`url(#${glowId})`}
            />
          )}

          {/* Laser-Etched Tick Marks */}
          {Array.from({ length: ticks + 1 }).map((_, idx) => {
            const tRatio = idx / ticks;
            const ang = startAngle + tRatio * sweepAngle;
            const isMajor = idx % 4 === 0;
            const p1 = polarToCartesian(cx, cy, isMajor ? rOuter - 2 : rOuter, ang);
            const p2 = polarToCartesian(cx, cy, isMajor ? rOuter + 6 : rOuter + 3, ang);
            const isLit = tRatio <= ratio;

            return (
              <line
                key={idx}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={isLit ? secondaryColor : isMajor ? '#475569' : '#1e293b'}
                strokeWidth={isMajor ? '1.8' : '1'}
                strokeLinecap="round"
              />
            );
          })}

          {/* Inner Dial Face */}
          <circle cx={cx} cy={cy} r={rInner} fill="#050811" stroke="#1e293b" strokeWidth="1.5" />

          {/* Sweeping Indicator Needle */}
          <polygon
            points={`${needleTip.x},${needleTip.y} ${needleBaseLeft.x},${needleBaseLeft.y} ${needleBaseRight.x},${needleBaseRight.y}`}
            fill={secondaryColor}
            opacity="0.88"
          />

          {/* Center Machined Hub */}
          <circle
            cx={cx}
            cy={cy}
            r="44"
            fill="#070b14"
            stroke={accentColor}
            strokeWidth="1.2"
            strokeOpacity="0.45"
          />

          {/* Digital Readout */}
          <text
            x={cx}
            y={cy - 3}
            textAnchor="middle"
            className="fill-slate-100 font-mono font-black"
            style={{ fontSize: '25px', letterSpacing: '-0.5px' }}
          >
            {displayValue !== undefined ? displayValue : clamped.toLocaleString()}
          </text>
          <text
            x={cx}
            y={cy + 16}
            textAnchor="middle"
            className="font-mono font-bold uppercase"
            fill={secondaryColor}
            style={{ fontSize: '9.5px', letterSpacing: '1.8px' }}
          >
            {unit}
          </text>

          {/* Scale Min / Max */}
          <text x={52} y={188} textAnchor="middle" className="fill-slate-500 font-mono text-[10px]">
            0
          </text>
          <text x={208} y={188} textAnchor="middle" className="fill-slate-400 font-mono text-[10px]">
            {safeMax.toLocaleString()}
          </text>
        </svg>

        {/* Sub-Telemetry Readouts */}
        {subMetrics.length > 0 && (
          <div className="w-full grid grid-cols-3 gap-1.5 mt-1 pt-2.5 border-t border-slate-800/80">
            {subMetrics.map((m, i) => (
              <div
                key={i}
                className="bg-[#050811]/90 border border-slate-800/80 rounded-xl px-2 py-1.5 text-center"
              >
                <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                  {m.label}
                </div>
                <div
                  className="text-xs font-mono font-bold mt-0.5 truncate"
                  style={{ color: m.color || '#f8fafc' }}
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

  // Interactive Cockpit States
  const [cockpitThemeKey, setCockpitThemeKey] = useState('WEISSACH'); // 'WEISSACH' | 'ARAMCO' | 'REVUELTO'
  const [centerHudMode, setCenterHudMode] = useState('ODO'); // 'ODO' | 'VECTOR' | 'BMS' | 'ROI'
  const [scrubHour, setScrubHour] = useState(() => new Date().getHours());
  const [simTariffBaht, setSimTariffBaht] = useState(4.72);

  const [statPeriod, setStatPeriod] = useState('Month'); // 'Day' | 'Week' | 'Month' | 'Year' | 'Total' | 'Custom'
  const [customStartDate, setCustomStartDate] = useState(() => getThailandDateStr(30));
  const [customEndDate, setCustomEndDate] = useState(() => getThailandDateStr(0));
  const [tariffSettings, setTariffSettings] = useState(() => loadTariffSettings());

  const updateTariffSettings = (next) => {
    setTariffSettings(next);
    try {
      localStorage.setItem(TARIFF_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const [editForm, setEditForm] = useState(solarData);
  const [transientGuestPassword, setTransientGuestPassword] = useState('');
  const [backfillDays, setBackfillDays] = useState(90);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [saveNotice, setSaveNotice] = useState(null);

  const theme = COCKPIT_THEMES[cockpitThemeKey] || COCKPIT_THEMES.WEISSACH;

  // Only show verified real SAJ V2 historical logs AND normalize Grid Import (importKWh) on every day
  const historicalLogs = useMemo(() => {
    const raw = Array.isArray(solarData.historicalDailyLogs) ? solarData.historicalDailyLogs : [];
    return raw
      .filter((item) => item && item.date && item.isRealSajV2 !== false)
      .map((item) => normalizeHistoricalDayLog(item))
      .filter(Boolean);
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
  const totalGenKWh = Math.max(todayGenKWh, Number(solarData.totalEnergyKWh || 0));
  const loadKWh = Number(solarData.statLoadElectricityKWh || 0);
  const exportKWh = Number(solarData.statExportKWh || 0);
  const chargeBatKWh = Number(solarData.statChargeBatteryKWh || 0);
  const dischargeBatKWh = Number(solarData.statDischargeBatteryKWh || 0);
  const todayBalancedImportKWh = Math.max(
    0,
    Number(
      (loadKWh - Math.max(0, todayGenKWh - exportKWh - chargeBatKWh + dischargeBatKWh)).toFixed(2)
    )
  );
  const importKWh = Math.max(Number(solarData.statImportKWh || 0), todayBalancedImportKWh);

  // Filtered historical logs according to selected period or custom Start-End date range
  const filteredHistoryLogs = useMemo(() => {
    if (historicalLogs.length === 0) return [];
    if (statPeriod === 'Custom') {
      const start = customStartDate <= customEndDate ? customStartDate : customEndDate;
      const end = customStartDate <= customEndDate ? customEndDate : customStartDate;
      return historicalLogs.filter((item) => item.date >= start && item.date <= end);
    }
    if (statPeriod === 'Day') {
      return historicalLogs.slice(-1);
    }
    const sliceCount =
      statPeriod === 'Week'
        ? 7
        : statPeriod === 'Month'
        ? 30
        : statPeriod === 'Year'
        ? 365
        : historicalLogs.length;
    return historicalLogs.slice(-sliceCount);
  }, [historicalLogs, statPeriod, customStartDate, customEndDate]);

  // Calculate statistics strictly from real historical logs or today's verified counter
  const periodStats = useMemo(() => {
    if (historicalLogs.length > 0 && statPeriod !== 'Day') {
      const subset = filteredHistoryLogs;
      const sum = (key) =>
        Number(subset.reduce((acc, item) => acc + Number(item[key] || 0), 0).toFixed(2));
      const pvGen =
        statPeriod === 'Total'
          ? Math.max(totalGenKWh, sum('pvGenerationKWh'))
          : sum('pvGenerationKWh');
      const load = sum('loadElectricityKWh');
      const exp = sum('exportKWh');
      const chg = sum('chargeBatteryKWh');
      const dis = sum('dischargeBatteryKWh');
      const rawImp = sum('importKWh');
      const balancedImp = Math.max(
        0,
        Number((load - Math.max(0, pvGen - exp - chg + dis)).toFixed(2))
      );
      const imp = Math.max(rawImp, balancedImp);

      // Group logs by month (YYYY-MM) for monthly progressive tariff calculation
      const monthBuckets = new Map();
      subset.forEach((log) => {
        const ym = (log.date || '').slice(0, 7);
        if (!ym) return;
        if (!monthBuckets.has(ym)) {
          monthBuckets.set(ym, {
            month: ym,
            days: 0,
            pvGen: 0,
            load: 0,
            imp: 0,
            exp: 0,
            chg: 0,
            dis: 0
          });
        }
        const b = monthBuckets.get(ym);
        b.days += 1;
        b.pvGen += Number(log.pvGenerationKWh || 0);
        b.load += Number(log.loadElectricityKWh || 0);
        b.exp += Number(log.exportKWh || 0);
        b.chg += Number(log.chargeBatteryKWh || 0);
        b.dis += Number(log.dischargeBatteryKWh || 0);
        const dayBalancedImp = Math.max(
          0,
          Number(
            (
              Number(log.loadElectricityKWh || 0) -
              Math.max(
                0,
                Number(log.pvGenerationKWh || 0) -
                  Number(log.exportKWh || 0) -
                  Number(log.chargeBatteryKWh || 0) +
                  Number(log.dischargeBatteryKWh || 0)
              )
            ).toFixed(2)
          )
        );
        b.imp += Math.max(Number(log.importKWh || 0), dayBalancedImp);
      });

      // Calculate bill & savings per month using tiered rates
      const monthlyBreakdown = Array.from(monthBuckets.values())
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => {
          const importBill = calcTieredBill(m.imp, tariffSettings.tiers);
          const hypotheticalBillWithoutSolar = calcTieredBill(m.load, tariffSettings.tiers);
          const exportIncome = Number((m.exp * (tariffSettings.exportRate || DEFAULT_EXPORT_RATE)).toFixed(2));
          // Saved = (What you would have paid to Grid for Load) - (What you actually paid for Grid Import) + Export Income
          const savedBaht = Math.max(
            0,
            Number((hypotheticalBillWithoutSolar - importBill + exportIncome).toFixed(2))
          );
          return {
            ...m,
            pvGen: Number(m.pvGen.toFixed(2)),
            load: Number(m.load.toFixed(2)),
            imp: Number(m.imp.toFixed(2)),
            exp: Number(m.exp.toFixed(2)),
            importBill,
            hypotheticalBillWithoutSolar,
            exportIncome,
            savedBaht
          };
        });

      const totalGridBill = Number(
        monthlyBreakdown.reduce((acc, m) => acc + m.importBill, 0).toFixed(2)
      );
      const totalSavedBaht = Number(
        monthlyBreakdown.reduce((acc, m) => acc + m.savedBaht, 0).toFixed(2)
      );

      return {
        daysCount: subset.length,
        pvGen,
        load,
        imp,
        exp,
        chg,
        dis,
        gridBill: totalGridBill,
        savedBaht: totalSavedBaht || Math.round(Math.max(0, pvGen - exp) * simTariffBaht + exp * 2.2),
        monthlyBreakdown
      };
    }

    const pvGen = statPeriod === 'Total' ? totalGenKWh : todayGenKWh;
    const todayImportBill = calcTieredBill(importKWh, tariffSettings.tiers);
    const todayWithoutSolar = calcTieredBill(loadKWh, tariffSettings.tiers);
    const todayExportIncome = Number((exportKWh * (tariffSettings.exportRate || DEFAULT_EXPORT_RATE)).toFixed(2));
    const todaySavedBaht = Math.max(
      0,
      Number((todayWithoutSolar - todayImportBill + todayExportIncome).toFixed(2))
    );

    return {
      daysCount: 1,
      pvGen,
      load: loadKWh,
      imp: importKWh,
      exp: exportKWh,
      chg: chargeBatKWh,
      dis: dischargeBatKWh,
      gridBill: todayImportBill,
      savedBaht: todaySavedBaht || Math.round(Math.max(0, pvGen - exportKWh) * simTariffBaht + exportKWh * 2.2),
      monthlyBreakdown: [
        {
          month: (getThailandDateStr(0) || '').slice(0, 7),
          days: 1,
          pvGen,
          load: loadKWh,
          imp: importKWh,
          exp: exportKWh,
          importBill: todayImportBill,
          exportIncome: todayExportIncome,
          savedBaht: todaySavedBaht
        }
      ]
    };
  }, [
    historicalLogs.length,
    filteredHistoryLogs,
    statPeriod,
    todayGenKWh,
    totalGenKWh,
    loadKWh,
    importKWh,
    exportKWh,
    chargeBatKWh,
    dischargeBatKWh,
    simTariffBaht,
    tariffSettings
  ]);

  const selfConsKWh = Math.max(0, Number((periodStats.pvGen - periodStats.exp).toFixed(2)));
  const selfConsPct =
    periodStats.pvGen > 0 ? Number(((selfConsKWh / periodStats.pvGen) * 100).toFixed(1)) : 0;
  const expPct = periodStats.pvGen > 0 ? Number((100 - selfConsPct).toFixed(1)) : 0;

  const selfSuffKWh = Math.max(0, Number((periodStats.load - periodStats.imp).toFixed(2)));
  const selfSuffPct =
    periodStats.load > 0 ? Number(((selfSuffKWh / periodStats.load) * 100).toFixed(1)) : 100;
  const impPct = periodStats.load > 0 ? Number((100 - selfSuffPct).toFixed(1)) : 0;

  // 24-hour curve for selected historical day
  const dailyCurveData = useMemo(() => {
    if (
      activeHistoryDay &&
      Array.isArray(activeHistoryDay.hourlyCurve) &&
      activeHistoryDay.hourlyCurve.length > 0
    ) {
      return activeHistoryDay.hourlyCurve;
    }
    // Proportional curve from today's verified kWh if hourly array isn't synced yet
    const estPeakW = todayGenKWh > 0 ? Math.round((todayGenKWh / 5.2) * 1000) : totalPvPowerW;
    return Array.from({ length: 24 }, (_, h) => {
      let pvW = 0;
      if (h >= 6 && h <= 18 && estPeakW > 0) {
        pvW = Math.round(estPeakW * Math.sin(((h - 6) / 12) * Math.PI));
      }
      const loadW = Math.round(Number(solarData.totalLoadPowerW || 350));
      return {
        hour: `${String(h).padStart(2, '0')}:00`,
        pvW,
        loadW,
        batterySOC: Number(solarData.batterySOC || 77)
      };
    });
  }, [activeHistoryDay, todayGenKWh, totalPvPowerW, solarData.totalLoadPowerW, solarData.batterySOC]);

  const scrubbedPoint = dailyCurveData[scrubHour] || dailyCurveData[12] || {
    hour: '12:00',
    pvW: 0,
    loadW: 0,
    batterySOC: Number(solarData.batterySOC || 0)
  };

  const savedTicket = getSavedSajSessionTicket(solarData);
  const savedEmail = getSavedSajEmail(solarData) || 'natshownolimit@gmail.com';
  const [autoSyncCountdown, setAutoSyncCountdown] = useState(60);
  const isSyncingRef = useRef(false);
  const autoStartedOrgRef = useRef(null);

  // Core Real-Time + Automatic Historical Backfill Engine (Zero Repeated Password Prompts)
  const executeSajSync = useCallback(
    async ({ silent = false, skipBackfillIfCached = false } = {}) => {
      if (!currentCompany || isSyncingRef.current) return;

      const cleanSajUser = (
        editForm.sajCloudGuestEmail ||
        solarData.sajCloudGuestEmail ||
        savedEmail
      ).trim();
      const cleanSajPass = (transientGuestPassword || '').trim();
      const activeTicket = getSavedSajSessionTicket({ ...solarData, ...editForm });

      if (!cleanSajPass && !activeTicket) {
        if (!silent) {
          setIsSettingOpen(true);
          setTestResult({
            success: false,
            message:
              '🔑 กรุณากรอก "รหัสผ่านแอป SAJ (Elekeeper)" เพียงครั้งเดียวในช่องรหัสผ่านด้านล่าง เพื่อเปิดระบบดึงข้อมูลเรียลไทม์และประวัติย้อนหลังอัตโนมัติ (หลังจากผูกสำเร็จแล้ว ไม่ต้องกรอกรหัสซ้ำอีก)'
          });
        }
        return;
      }

      isSyncingRef.current = true;
      if (!silent) {
        setIsTesting(true);
        setTestResult({
          success: true,
          message: `⏳ กำลังซิงก์ข้อมูลเรียลไทม์และดึงประวัติจริงย้อนหลัง ${backfillDays} วันจาก SAJ Cloud อัตโนมัติ...`
        });
      }

      const res = await syncSajCloudAndBackfillHistory({
        orgId: currentCompany.id,
        companyName: currentCompany.name,
        guestEmail: cleanSajUser,
        transientPassword: cleanSajPass,
        deviceSn: editForm.sajDeviceSn || solarData.sajDeviceSn || '',
        backfillDays,
        skipBackfillIfCached,
        currentSolarConfig: {
          ...solarData,
          ...editForm,
          sajEncryptedSessionTicket: activeTicket
        },
        onProgress: (progressText) => {
          if (!silent) {
            setTestResult({
              success: true,
              message: progressText
            });
          }
        },
        onPartialSync: (partialConfig) => {
          setEditForm(partialConfig);
          updateOrganization(currentCompany.id, {
            gatewayIp: 'SAJ-CLOUD-AUTO',
            gatewayPort: '443',
            status: 'ONLINE',
            solarConfig: partialConfig
          });
        }
      });

      setTransientGuestPassword('');

      if (res.success) {
        setEditForm(res.syncedSolarConfig);
        updateOrganization(currentCompany.id, {
          gatewayIp: 'SAJ-CLOUD-AUTO',
          gatewayPort: '443',
          status: 'ONLINE',
          solarConfig: res.syncedSolarConfig
        });
        if (res.syncedSolarConfig.historicalDailyLogs?.length > 0 && !selectedHistoryDate) {
          const latestDay =
            res.syncedSolarConfig.historicalDailyLogs[
              res.syncedSolarConfig.historicalDailyLogs.length - 1
            ];
          setSelectedHistoryDate(latestDay.date);
        }
        setAutoSyncCountdown(60);
        if (!silent) {
          setIsSettingOpen(false);
          setSaveNotice(
            `ซิงก์เรียลไทม์และดึงประวัติย้อนหลัง ${res.backfilledDaysCount} วันสำเร็จ! (ระบบจำสิทธิ์ปลอดภัยแล้ว ไม่ต้องใส่รหัสซ้ำ)`
          );
          setTimeout(() => setSaveNotice(null), 6000);
          setTestResult(res);
        }
      } else {
        if (res.needsPassword) {
          setIsSettingOpen(true);
        }
        if (!silent || res.needsPassword) {
          setTestResult(res);
        }
      }

      isSyncingRef.current = false;
      if (!silent) {
        setIsTesting(false);
      }
    },
    [
      currentCompany,
      editForm,
      solarData,
      savedEmail,
      transientGuestPassword,
      backfillDays,
      updateOrganization,
      selectedHistoryDate
    ]
  );

  // Automatic Initial Sync + Historical Backfill on Mount & 60s Real-Time Auto-Polling
  useEffect(() => {
    if (!currentCompany) return;
    const ticket = getSavedSajSessionTicket(solarData);

    if (ticket && autoStartedOrgRef.current !== currentCompany.id) {
      autoStartedOrgRef.current = currentCompany.id;
      const needsHistoryBackfill = historicalLogs.length <= 2;
      executeSajSync({
        silent: !needsHistoryBackfill,
        skipBackfillIfCached: !needsHistoryBackfill
      });
    } else if (!ticket && autoStartedOrgRef.current !== currentCompany.id) {
      autoStartedOrgRef.current = currentCompany.id;
      setIsSettingOpen(true);
    }
  }, [currentCompany, solarData, historicalLogs.length, executeSajSync]);

  useEffect(() => {
    if (!savedTicket) return;
    const interval = setInterval(() => {
      setAutoSyncCountdown((prev) => {
        if (prev <= 1) {
          executeSajSync({ silent: true, skipBackfillIfCached: true });
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [savedTicket, executeSajSync]);

  // Manual One-click REAL SAJ Cloud V2 Sync + Full Historical Backfill
  const handleSyncSajCloudAndHistory = async () => {
    await executeSajSync({ silent: false, skipBackfillIfCached: false });
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
    setSaveNotice('บันทึกการตั้งค่าลงฐานข้อมูลเรียบร้อยแล้ว');
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
          message: `✅ อ่านค่าจริงผ่านพอร์ต USB-to-RS485 (Slave ID ${slave}) สำเร็จ!`
        });
      } else {
        const res = await testRealGatewayConnection(currentCompany.id);
        setTestResult(res);
      }
    } catch {
      setTestResult({
        success: false,
        message: `💡 แนะนำให้ใช้ปุ่มซิงก์ผ่าน SAJ Cloud ด้านบนได้เลยโดยไม่ต้องต่อสาย USB`
      });
    }
    setIsTesting(false);
  };

  // Cockpit Telemetry Calculations
  const maxPvW = Math.round((Number(solarData.pvCapacityKWp) || 6) * 1000);
  const houseLoadW = Number(solarData.totalLoadPowerW || 0);
  const battSoc = Number(solarData.batterySOC || 0);
  const battCapKWh = Number(solarData.batteryCapacityKWh || 10.24);
  const usableBatKWh = Number(((battCapKWh * Math.max(0, battSoc - 10)) / 100).toFixed(2));
  const estAutonomyHours =
    houseLoadW > 50
      ? Number(((usableBatKWh * 1000) / houseLoadW).toFixed(1))
      : Number(((usableBatKWh * 1000) / 450).toFixed(1));

  const driveMode =
    totalPvPowerW > 1500
      ? { code: 'CORSA // SOLAR BOOST', gear: 'S+', color: '#f59e0b' }
      : totalPvPowerW > 50
      ? { code: 'STRADA // HYBRID DRIVE', gear: 'D1', color: '#38bdf8' }
      : battSoc > 20
      ? { code: 'STEALTH // BATT CRUISE', gear: 'EV', color: '#10b981' }
      : { code: 'GRID // STANDBY', gear: 'G', color: '#94a3b8' };

  const shiftLightRatio = Math.min(
    1,
    Math.max(totalPvPowerW / maxPvW, houseLoadW / 6000, battSoc / 100)
  );
  const activeShiftLeds = Math.max(4, Math.round(shiftLightRatio * 18));

  const formattedOdometer = String(Math.floor(totalGenKWh || todayGenKWh)).padStart(6, '0');
  const todaySavedBaht = Math.round(todayGenKWh * simTariffBaht);
  const co2ReducedKg = Number((totalGenKWh * 0.499).toFixed(1));
  const treesEquivalent = Math.max(1, Math.round(co2ReducedKg / 9.5));

  return (
    <div className="space-y-4 pb-14">
      {/* =================================================================== */}
      {/* MINIMALIST EXECUTIVE HEADER BAR (ALL SETTINGS HIDDEN IN 1 BUTTON)   */}
      {/* =================================================================== */}
      <div className="bg-[#070b14] border border-slate-800/90 rounded-2xl px-4 py-3 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
            {currentCompany.name}
          </h2>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-900 text-sky-400 border border-slate-800">
            {solarData.inverterModel || 'H2-6K-LS2'}
          </span>
          {solarData.lastCloudSyncAt && (
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              • อัปเดตล่าสุด {solarData.lastCloudSyncAt} ({autoSyncCountdown}s)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncSajCloudAndHistory}
            disabled={isTesting}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
            title="ซิงก์ข้อมูลล่าสุดจาก SAJ Cloud"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'กำลังซิงก์...' : 'ซิงก์ข้อมูล'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditForm(solarData);
              setIsSettingOpen(!isSettingOpen);
            }}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              isSettingOpen
                ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-lg'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isSettingOpen ? 'ปิดตั้งค่า' : '⚙️ ตั้งค่า'}</span>
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-200">
          ✅ {saveNotice}
        </div>
      )}

      {/* =================================================================== */}
      {/* UNIFIED SETTINGS DRAWER (HIDDEN UNTIL USER CLICKS '⚙️ ตั้งค่า')      */}
      {/* =================================================================== */}
      {isSettingOpen && (
        <form
          onSubmit={handleSaveSettingsToDb}
          className="bg-[#080d19] border border-sky-500/30 rounded-3xl p-5 space-y-4 text-xs shadow-2xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-black text-sky-400">
                ⚙️ ตั้งค่าระบบ, ธีมหน้าปัด, เรตค่าไฟ และการเชื่อมต่อ SAJ Cloud
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                SN: <strong className="font-mono text-amber-300">{solarData.sajDeviceSn || 'H2A2602J2539E14713'}</strong> • ประวัติสะสมในฐานข้อมูล: <strong className="font-mono text-sky-300">{historicalLogs.length} วัน</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingOpen(false)}
              className="px-3 py-1 rounded-lg bg-slate-900 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
            >
              ✕ ซ่อนหน้าตั้งค่า
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs font-bold ${
                testResult.success
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-200'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              }`}
            >
              {testResult.message}
            </div>
          )}

          {/* Theme & Tariff Preferences inside Settings */}
          <div className="space-y-3 bg-[#04070e] border border-slate-800 rounded-2xl p-3.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b border-slate-800/80">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  🎨 เลือกโทนสีหน้าปัด (Cockpit Theme)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(COCKPIT_THEMES).map((tItem) => (
                    <button
                      key={tItem.id}
                      type="button"
                      onClick={() => setCockpitThemeKey(tItem.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                        cockpitThemeKey === tItem.id
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {tItem.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  💰 เรตรับซื้อไฟคืน (Export): <strong className="text-sky-300 font-mono">฿{tariffSettings.exportRate || DEFAULT_EXPORT_RATE} / หน่วย</strong>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={tariffSettings.exportRate || DEFAULT_EXPORT_RATE}
                    onChange={(e) =>
                      updateTariffSettings({
                        ...tariffSettings,
                        exportRate: Number(e.target.value) || 0
                      })
                    }
                    className="w-28 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-sky-300 font-mono font-bold"
                  />
                  <span className="text-[11px] text-slate-400">บาท/kWh (โครงการโซลาร์ภาคประชาชน ฿2.20)</span>
                </div>
              </div>
            </div>

            {/* Stepped Tariff Tier Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="block text-amber-300 font-bold">
                    ⚡ กำหนดอัตราค่าไฟฟ้าแบบขั้นบันได (Progressive Tariff)
                  </label>
                  <span className="text-[10px] text-slate-400">
                    คำนวณแยกตามเดือนจริง: 0–200 หน่วยแรกคิดหน่วยละ 3 บาท และ 201 หน่วยขึ้นไปคิดเป็นขั้นบันได
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateTariffSettings({
                      tiers: DEFAULT_TARIFF_TIERS,
                      exportRate: DEFAULT_EXPORT_RATE
                    })
                  }
                  className="text-[10px] font-bold text-sky-400 hover:text-sky-200 underline cursor-pointer"
                >
                  ↺ รีเซ็ตเป็นค่ามาตรฐาน
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {tariffSettings.tiers.map((tier, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-1.5 text-xs font-mono"
                  >
                    <div className="text-[10px] font-sans font-bold text-slate-300 flex items-center justify-between">
                      <span>ขั้นที่ {idx + 1}</span>
                      <span className="text-amber-400">
                        {idx === 0
                          ? `0 – ${tier.upTo} หน่วย`
                          : tier.upTo
                          ? `${tariffSettings.tiers[idx - 1].upTo + 1} – ${tier.upTo} หน่วย`
                          : `${tariffSettings.tiers[idx - 1].upTo + 1} หน่วยขึ้นไป`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-sans text-slate-400">คิดหน่วยละ:</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={tier.rate}
                        onChange={(e) => {
                          const newTiers = [...tariffSettings.tiers];
                          newTiers[idx] = { ...newTiers[idx], rate: Number(e.target.value) || 0 };
                          updateTariffSettings({ ...tariffSettings, tiers: newTiers });
                        }}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-emerald-400 font-black text-right"
                      />
                      <span className="text-[11px] font-sans text-slate-400">฿</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                1. อีเมล/ชื่อผู้ใช้แอป SAJ (Elekeeper)
              </label>
              <input
                type="text"
                value={editForm.sajCloudGuestEmail || ''}
                onChange={(e) =>
                  setEditForm({ ...editForm, sajCloudGuestEmail: e.target.value })
                }
                placeholder="เช่น natshownolimit@gmail.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-sky-300 font-bold mb-1">
                2. รหัสผ่านแอป SAJ (กรอกครั้งเดียวจำสิทธิ์ถาวร)
              </label>
              <input
                type="password"
                value={transientGuestPassword}
                onChange={(e) => setTransientGuestPassword(e.target.value)}
                placeholder={
                  savedTicket
                    ? '✅ จำสิทธิ์แล้ว (ไม่ต้องกรอกซ้ำ)'
                    : 'กรอกรหัสผ่านแอป SAJ ครั้งเดียวที่นี่'
                }
                className="w-full bg-slate-950 border border-sky-500/50 rounded-xl px-3 py-2.5 text-sky-300 font-mono"
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
                placeholder="H2A2602J2539E14713"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-amber-300 font-mono"
              />
            </div>

            <div>
              <label className="block text-emerald-300 font-bold mb-1">
                4. จำนวนวันย้อนหลังที่ดึงอัตโนมัติ
              </label>
              <select
                value={backfillDays}
                onChange={(e) => setBackfillDays(Number(e.target.value))}
                className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2.5 text-emerald-300 font-bold"
              >
                <option value={30}>ย้อนหลัง 30 วัน</option>
                <option value={90}>ย้อนหลัง 90 วัน (3 เดือน)</option>
                <option value={180}>ย้อนหลัง 180 วัน (6 เดือน)</option>
                <option value={365}>ย้อนหลัง 365 วัน (1 ปีเต็ม)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleAutoReadUsbSerial}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold cursor-pointer"
            >
              🔌 อ่านผ่านสาย USB-to-RS485
            </button>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSyncSajCloudAndHistory}
                disabled={isTesting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 hover:from-sky-300 hover:to-emerald-300 text-slate-950 font-black cursor-pointer shadow-lg"
              >
                ☁️ ซิงก์ข้อมูลปัจจุบัน + ดึงประวัติจริงย้อนหลัง ({backfillDays} วัน)
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 font-bold cursor-pointer"
              >
                💾 บันทึกการตั้งค่า
              </button>
            </div>
          </div>
        </form>
      )}

      {/* =================================================================== */}
      {/* TRIPLE-DIAL SUPERCAR INSTRUMENT CLUSTER WITH INTERACTIVE CENTER HUD */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* LEFT DIAL (4 cols): SOLAR PV ARRAY TACHOMETER */}
        <div className="lg:col-span-4">
          <SupercarRadialGauge
            value={totalPvPowerW}
            max={maxPvW}
            unit="WATTS PV"
            title="☀️ แผงโซลาร์ (PV ARRAY)"
            subtitle="LEFT INSTRUMENT // MPPT"
            accentColor={theme.pvPrimary}
            secondaryColor={theme.pvSecondary}
            glowId="cockpitPvGlow"
            badgeText={`${solarData.pvCapacityKWp || 6} kWp`}
            onClickGauge={() => setCenterHudMode('VECTOR')}
            subMetrics={[
              { label: 'PV1 VOLT', value: `${solarData.pv1Voltage || 0} V`, color: theme.pvSecondary },
              { label: 'PV1 AMP', value: `${solarData.pv1Current || 0} A`, color: '#f8fafc' },
              { label: 'TODAY GEN', value: `${todayGenKWh} kWh`, color: '#34d399' }
            ]}
          />
        </div>

        {/* CENTER MASTER MULTI-FUNCTION DISPLAY (4 cols): 4 INTERACTIVE MODES! */}
        <div className="lg:col-span-4 bg-[#080d19]/95 border border-slate-800/90 rounded-[26px] p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col justify-between">
          {/* Interactive Mode Selector Tabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-sky-400" /> CENTER MULTI-DISPLAY (คลิกสลับโหมดได้)
              </span>
              <span
                className="px-2 py-0.5 rounded-md font-mono font-black text-xs border"
                style={{
                  color: driveMode.color,
                  borderColor: `${driveMode.color}55`,
                  backgroundColor: `${driveMode.color}15`
                }}
              >
                {driveMode.gear}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1 bg-[#04070e] p-1 rounded-xl border border-slate-800/90">
              {[
                { id: 'ODO', label: '1. ไมล์สะสม' },
                { id: 'VECTOR', label: '2. เรดาร์ไฟ' },
                { id: 'BMS', label: '3. แบตสำรอง' },
                { id: 'ROI', label: '4. คุ้มทุน/CO₂' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCenterHudMode(tab.id)}
                  className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    centerHudMode === tab.id
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* MODE 1: MASTER ODOMETER & TODAY GENERATION */}
          {centerHudMode === 'ODO' && (
            <div className="my-3 flex flex-col items-center">
              <div className="relative w-44 h-44 rounded-full border-2 border-slate-800 bg-[#04070e] shadow-[inset_0_0_30px_rgba(14,165,233,0.15)] flex flex-col items-center justify-center p-4">
                <div className="absolute inset-2 rounded-full border border-dashed border-sky-500/30" />
                <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-sky-400">
                  TODAY PRODUCTION
                </span>
                <div className="text-3xl sm:text-4xl font-mono font-black text-white tracking-tight mt-0.5">
                  {todayGenKWh.toFixed(2)}
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-400">
                  kWh วันนี้
                </span>
                <div className="mt-2 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-bold">
                  ประหยัด +฿{todaySavedBaht.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: INTERACTIVE 4-WAY ENERGY VECTOR RADAR */}
          {centerHudMode === 'VECTOR' && (
            <div className="my-2 bg-[#04070e] border border-slate-800/90 rounded-2xl p-3.5 space-y-2.5">
              <div className="text-[11px] font-bold text-sky-300 flex items-center justify-between">
                <span>⚡ เรดาร์ทิศทางการไหลของพลังงานสด</span>
                <span className="font-mono text-[10px] text-emerald-400">LIVE VECTOR</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] text-amber-300 font-bold">☀️ แผงโซลาร์ → อินเวอร์เตอร์</div>
                  <div className="text-base font-mono font-black text-white mt-0.5">
                    {totalPvPowerW} W
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {solarData.pv1Voltage}V • {solarData.pv1Current}A
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] text-emerald-300 font-bold">🔋 สถานะแบตเตอรี่</div>
                  <div className="text-base font-mono font-black text-emerald-400 mt-0.5">
                    {solarData.batteryPowerW || 0} W
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {solarData.batteryStatus} ({battSoc}%)
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] text-sky-300 font-bold">🏠 จ่ายเข้าโหลดในบ้าน</div>
                  <div className="text-base font-mono font-black text-white mt-0.5">
                    {houseLoadW} W
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    พึ่งพาตนเอง {selfSuffPct}%
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] text-purple-300 font-bold">🗼 สายส่งการไฟฟ้า (Grid)</div>
                  <div className="text-base font-mono font-black text-white mt-0.5">
                    {solarData.gridAc1Voltage || 230} VAC
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {solarData.gridAc1FreqHz || 50} Hz • {solarData.gridAc1PowerW || 0} W
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODE 3: BATTERY BMS & BACKUP AUTONOMY CALCULATOR */}
          {centerHudMode === 'BMS' && (
            <div className="my-2 bg-[#04070e] border border-slate-800/90 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-300">
                  🔋 วิเคราะห์พลังงานสำรองในแบตเตอรี่
                </span>
                <span className="font-mono text-xs font-black text-emerald-400">
                  SOC {battSoc}%
                </span>
              </div>
              <div className="bg-slate-900/90 border border-emerald-500/25 rounded-xl p-3 text-center">
                <div className="text-[10px] text-slate-400">
                  ระยะเวลาจ่ายไฟสำรองได้ต่อเนื่อง (เมื่อไฟดับ/กลางคืน)
                </div>
                <div className="text-2xl font-mono font-black text-emerald-400 mt-0.5">
                  ≈ {estAutonomyHours} ชั่วโมง
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                  พลังงานที่ใช้ได้จริง: {usableBatKWh} kWh (จากความจุ {battCapKWh} kWh)
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-mono">
                <div className="bg-slate-900 rounded-lg p-1.5 border border-slate-800">
                  <span className="text-[9px] text-slate-400 block">VOLTAGE</span>
                  <strong className="text-white">{solarData.batteryVoltage || 52.8}V</strong>
                </div>
                <div className="bg-slate-900 rounded-lg p-1.5 border border-slate-800">
                  <span className="text-[9px] text-slate-400 block">CURRENT</span>
                  <strong className="text-white">{solarData.batteryCurrent || 0}A</strong>
                </div>
                <div className="bg-slate-900 rounded-lg p-1.5 border border-slate-800">
                  <span className="text-[9px] text-slate-400 block">TEMP</span>
                  <strong className="text-sky-300">{solarData.inverterTempC || 36.5}°C</strong>
                </div>
              </div>
            </div>
          )}

          {/* MODE 4: INTERACTIVE ROI & CARBON SIMULATOR */}
          {centerHudMode === 'ROI' && (
            <div className="my-2 bg-[#04070e] border border-slate-800/90 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-amber-300 flex items-center gap-1">
                  <Leaf className="w-3.5 h-3.5 text-emerald-400" /> คำนวณผลตอบแทน & ลดคาร์บอน
                </span>
                <span className="font-mono text-sky-300">เรต ฿{simTariffBaht.toFixed(2)}/หน่วย</span>
              </div>
              <div>
                <input
                  type="range"
                  min="3.5"
                  max="6.5"
                  step="0.05"
                  value={simTariffBaht}
                  onChange={(e) => setSimTariffBaht(Number(e.target.value))}
                  className="w-full accent-sky-400 cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-500">
                  <span>เรตบ้าน ฿3.50</span>
                  <span>เลื่อนปรับเรตค่าไฟ</span>
                  <span>เรตธุรกิจ ฿6.50</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2">
                  <div className="text-[9px] text-slate-400">ประหยัดต่อเดือน (คาดการณ์)</div>
                  <div className="text-sm font-mono font-black text-emerald-400 mt-0.5">
                    ฿{Math.round(todayGenKWh * 30 * simTariffBaht).toLocaleString()}
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2">
                  <div className="text-[9px] text-slate-400">ลดก๊าซ CO₂ สะสม</div>
                  <div className="text-sm font-mono font-black text-sky-300 mt-0.5">
                    {co2ReducedKg} kg ({treesEquivalent} ต้นไม้)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom 6-Digit Supercar Rolling Odometer */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="bg-[#04070e] border border-slate-800/90 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
                TOTAL ODOMETER
              </span>
              <div className="flex items-center gap-1 font-mono">
                {formattedOdometer.split('').map((digit, i) => (
                  <span
                    key={i}
                    className="w-5 h-6 rounded bg-slate-900 border border-slate-700/80 text-slate-100 font-black text-xs flex items-center justify-center"
                  >
                    {digit}
                  </span>
                ))}
                <span className="text-[10px] text-sky-400 font-bold ml-1">kWh</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#04070e] border border-slate-800/90 rounded-xl px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">🏠 โหลดบ้าน</span>
                <span className="text-xs font-mono font-bold text-slate-100">
                  {houseLoadW.toLocaleString()} W
                </span>
              </div>
              <div className="bg-[#04070e] border border-slate-800/90 rounded-xl px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">🗼 แรงดันไฟ</span>
                <span className="text-xs font-mono font-bold text-slate-100">
                  {solarData.gridAc1Voltage || 231.5} V
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT DIAL (4 cols): HV BATTERY ERS & SOC GAUGE */}
        <div className="lg:col-span-4">
          <SupercarRadialGauge
            value={battSoc}
            max={100}
            unit="% SOC"
            title="🔋 แบตเตอรี่ (HV LiFePO4)"
            subtitle="RIGHT INSTRUMENT // ERS PACK"
            accentColor={theme.battPrimary}
            secondaryColor={theme.battSecondary}
            glowId="cockpitBattGlow"
            badgeText={solarData.batteryStatus || 'STANDBY'}
            onClickGauge={() => setCenterHudMode('BMS')}
            subMetrics={[
              { label: 'AUTONOMY', value: `~${estAutonomyHours} ชม.`, color: theme.battSecondary },
              { label: 'USABLE', value: `${usableBatKWh} kWh`, color: '#f8fafc' },
              { label: 'TEMP', value: `${solarData.inverterTempC || 36.5}°C`, color: '#38bdf8' }
            ]}
          />
        </div>
      </div>

      {/* =================================================================== */}
      {/* INTERACTIVE TIME-MACHINE 24-HOUR DYNO CHART & HISTORICAL EXPLORER   */}
      {/* =================================================================== */}
      <div className="bg-[#080d19]/95 border border-slate-800/90 rounded-[28px] p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              <span>
                📈 กราฟ Telemetry 24 ชั่วโมง & เลือกดูย้อนหลัง:{' '}
                <strong className="text-sky-300 font-mono">
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
                <strong className="text-sky-300 font-mono">
                  {activeHistoryDay.loadElectricityKWh} kWh
                </strong>{' '}
                • ประหยัดเงิน:{' '}
                <strong className="text-amber-300 font-mono">
                  ฿{activeHistoryDay.savedBaht}
                </strong>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {historicalLogs.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">📅 เลือกวันที่ ({historicalLogs.length} วันจริง):</span>
                <select
                  value={activeHistoryDay?.date || ''}
                  onChange={(e) => setSelectedHistoryDate(e.target.value)}
                  className="bg-slate-950 border border-sky-500/40 rounded-xl px-3 py-2 text-xs text-sky-300 font-mono font-bold"
                >
                  {[...historicalLogs].reverse().map((log) => (
                    <option key={log.date} value={log.date}>
                      {log.date} — ผลิต {log.pvGenerationKWh} kWh (ประหยัด ฿{log.savedBaht})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleSyncSajCloudAndHistory}
              disabled={isTesting}
              className="px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-bold cursor-pointer"
            >
              {historicalLogs.length <= 1
                ? '📥 ดึงประวัติย้อนหลังจาก SAJ Cloud เพิ่มเติม'
                : '🔄 อัปเดตประวัติล่าสุด'}
            </button>
          </div>
        </div>

        {/* Interactive Hour-by-Hour Time-Machine Scrubber */}
        <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>🎚️ เลื่อนสแกนดูค่าไฟรายชั่วโมง (Time-Machine Inspector):</span>
              <strong className="font-mono text-sky-300 text-sm">{scrubbedPoint.hour} น.</strong>
            </span>
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
              <span className="text-amber-300">
                ☀️ โซลาร์: <strong>{scrubbedPoint.pvW} W</strong>
              </span>
              <span className="text-sky-300">
                🏠 โหลดบ้าน: <strong>{scrubbedPoint.loadW} W</strong>
              </span>
              {scrubbedPoint.batterySOC > 0 && (
                <span className="text-emerald-300">
                  🔋 แบตเตอรี่: <strong>{scrubbedPoint.batterySOC}%</strong>
                </span>
              )}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={23}
            step={1}
            value={scrubHour}
            onChange={(e) => setScrubHour(Number(e.target.value))}
            className="w-full accent-sky-400 cursor-pointer"
          />
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyCurveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#070b14',
                  borderColor: '#1e293b',
                  borderRadius: '14px',
                  fontSize: '12px'
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="pvW"
                name="กำลังผลิตโซลาร์ PV (W)"
                stroke={theme.pvSecondary}
                fill={theme.pvPrimary}
                fillOpacity={0.25}
              />
              <Area
                type="monotone"
                dataKey="loadW"
                name="โหลดใช้ไฟในบ้าน (W)"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.18}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* =================================================================== */}
      {/* ELECTRICITY STATISTICS (DAY / WEEK / MONTH / YEAR / TOTAL)          */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-[#080d19]/95 border border-slate-800/90 rounded-[28px] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <span>
                สถิติพลังงานไฟฟ้าจริง (
                {statPeriod === 'Custom'
                  ? `${formatSlashDate(customStartDate)} – ${formatSlashDate(customEndDate)}`
                  : statPeriod}{' '}
                • ข้อมูลจริง {periodStats.daysCount} วัน)
              </span>
            </h3>
            <div className="flex flex-wrap bg-[#04070e] p-1 rounded-xl border border-slate-800">
              {[
                { id: 'Day', label: 'วันนี้' },
                { id: 'Week', label: '7 วัน' },
                { id: 'Month', label: '30 วัน' },
                { id: 'Year', label: 'รายปี' },
                { id: 'Total', label: 'สะสมทั้งหมด' },
                { id: 'Custom', label: '📅 เลือกช่วงวันที่' }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setStatPeriod(p.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    statPeriod === p.id
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {statPeriod === 'Custom' && (
            <div className="bg-[#04070e] border border-sky-500/30 rounded-2xl p-3 flex flex-wrap items-end gap-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">วันที่เริ่มต้น</label>
                <input
                  type="date"
                  value={customStartDate}
                  max={customEndDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sky-300 font-mono [color-scheme:dark]"
                />
              </div>
              <span className="text-slate-500 pb-2">ถึง</span>
              <div>
                <label className="block text-slate-400 font-bold mb-1">วันที่สิ้นสุด</label>
                <input
                  type="date"
                  value={customEndDate}
                  min={customStartDate}
                  max={getThailandDateStr(0)}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sky-300 font-mono [color-scheme:dark]"
                />
              </div>
              <div className="text-[11px] text-slate-400 pb-2">
                พบข้อมูลจริง <strong className="text-sky-300 font-mono">{filteredHistoryLogs.length}</strong> วันในช่วงนี้
                {historicalLogs.length > 0 && (
                  <span>
                    {' '}(มีข้อมูลตั้งแต่ {formatSlashDate(historicalLogs[0].date)})
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3.5">
              <div className="text-xs text-sky-300 font-bold">☀️ ผลิตไฟโซลาร์ (PV Gen)</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                {periodStats.pvGen.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
            <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3.5">
              <div className="text-xs text-indigo-300 font-bold">🏠 ไฟที่ใช้ในบ้านรวม (Load)</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                {periodStats.load.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
            <div className="bg-[#04070e] border border-emerald-500/30 rounded-2xl p-3.5">
              <div className="text-xs text-emerald-300 font-bold flex items-center justify-between">
                <span>💰 ประหยัดค่าไฟได้</span>
                <span className="text-[10px] text-emerald-400/80 font-normal">สุทธิ</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-1">
                {formatBaht(periodStats.savedBaht)}
              </div>
            </div>
            <div className="bg-[#04070e] border border-rose-500/40 rounded-2xl p-3.5">
              <div className="text-xs text-rose-300 font-bold flex items-center justify-between">
                <span>⚡ จ่ายให้การไฟฟ้า</span>
                <span className="text-[10px] text-rose-400/80 font-normal">ขั้นบันได</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-rose-400 mt-1">
                {formatBaht(periodStats.gridBill || 0)}
              </div>
            </div>

            <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3.5">
              <div className="text-xs text-amber-300 font-bold">🗼 ดึงไฟการไฟฟ้า (Import)</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-amber-300 mt-1">
                {periodStats.imp.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
            <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3.5">
              <div className="text-xs text-emerald-300 font-bold">🔋 ชาร์จลงแบตเตอรี่</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-1">
                {periodStats.chg.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
            <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3.5">
              <div className="text-xs text-teal-300 font-bold">🔋 จ่ายไฟจากแบตเตอรี่</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-teal-300 mt-1">
                {periodStats.dis.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
            <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3.5">
              <div className="text-xs text-sky-300 font-bold">📤 ส่งออกขายไฟ (Export)</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-sky-300 mt-1">
                {periodStats.exp.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#080d19]/95 border border-slate-800/90 rounded-[28px] p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-black text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>สรุปค่าไฟฟ้าและเงินที่ประหยัดได้</span>
              </span>
              <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded-md">
                อัตราก้าวหน้า 0-200หน่วย @ ฿3
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              คิดคำนวณแยกตามเดือนจริง และหักลบรายได้ขายไฟคืน ({tariffSettings.exportRate || DEFAULT_EXPORT_RATE}฿/หน่วย)
            </p>
          </div>

          {/* Monthly Billing Breakdown Table */}
          <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3 space-y-2 overflow-hidden">
            <div className="text-xs font-bold text-slate-300 flex items-center justify-between pb-1 border-b border-slate-800">
              <span>รอบเดือน</span>
              <span>ดึงไฟ (kWh)</span>
              <span>จ่ายการไฟฟ้า</span>
              <span className="text-emerald-400">ประหยัดได้</span>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {Array.isArray(periodStats.monthlyBreakdown) && periodStats.monthlyBreakdown.length > 0 ? (
                periodStats.monthlyBreakdown.map((m) => (
                  <div
                    key={m.month}
                    className="flex items-center justify-between text-[11px] font-mono py-1 px-2 rounded-lg bg-slate-900/60 border border-slate-800/60 hover:border-slate-700"
                  >
                    <span className="font-sans font-bold text-slate-200">
                      {formatThaiMonth(m.month)} <span className="text-[10px] text-slate-500 font-normal">({m.days}วัน)</span>
                    </span>
                    <span className="text-amber-300">{m.imp.toLocaleString()}</span>
                    <span className="text-rose-400 font-bold">{formatBaht(m.importBill)}</span>
                    <span className="text-emerald-400 font-bold">{formatBaht(m.savedBaht)}</span>
                  </div>
                ))
              ) : (
                <div className="text-center text-xs text-slate-500 py-2">ไม่มีข้อมูลเดือนที่เลือก</div>
              )}
            </div>
            <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-slate-800 font-mono">
              <span className="text-slate-300 font-sans">รวมยอดที่เลือก:</span>
              <span className="text-amber-300">{periodStats.imp.toLocaleString()} kWh</span>
              <span className="text-rose-400">{formatBaht(periodStats.gridBill || 0)}</span>
              <span className="text-emerald-400">{formatBaht(periodStats.savedBaht || 0)}</span>
            </div>
          </div>

          <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-emerald-300">
                ใช้ไฟโซลาร์ในบ้าน: {selfConsKWh} kWh ({selfConsPct}%)
              </span>
              <span className="text-sky-300">
                ส่งออก Export: {periodStats.exp} kWh ({expPct}%)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500" style={{ width: `${selfConsPct}%` }} />
              <div className="h-full bg-sky-400" style={{ width: `${expPct}%` }} />
            </div>
          </div>

          <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-emerald-300">
                พึ่งพาโซลาร์+แบต: {selfSuffKWh} kWh ({selfSuffPct}%)
              </span>
              <span className="text-amber-300">
                ดึงไฟหลวง: {periodStats.imp} kWh ({impPct}%)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500" style={{ width: `${selfSuffPct}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${impPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* HISTORICAL TIMELINE BAR CHART (VERIFIED SAJ V2 DAYS ONLY)           */}
      {/* =================================================================== */}
      {historicalLogs.length > 0 && (
        <div className="bg-[#080d19]/95 border border-slate-800/90 rounded-[28px] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <History className="w-4 h-4 text-sky-400" />
              <span>
                📊 กราฟรายวันตามช่วงที่เลือก ({(statPeriod === 'Day' ? historicalLogs.slice(-30) : filteredHistoryLogs).length} วัน)
              </span>
            </h3>
            <span className="text-xs text-slate-400">
              ข้อมูลจริงจากเซิร์ฟเวอร์ SAJ ทั้งหมด {historicalLogs.length} วัน
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statPeriod === 'Day' ? historicalLogs.slice(-30) : filteredHistoryLogs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tickFormatter={formatSlashDate} stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#070b14',
                    borderColor: '#1e293b',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
                <Legend />
                <Bar
                  dataKey="pvGenerationKWh"
                  name="ผลิตโซลาร์จริง (kWh/วัน)"
                  fill={theme.pvSecondary}
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="loadElectricityKWh"
                  name="ใช้ไฟในบ้าน (kWh/วัน)"
                  fill="#6366f1"
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
    </div>
  );
};
