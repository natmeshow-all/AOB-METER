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
  Eye,
  FileText,
  Printer,
  ChevronLeft,
  ChevronRight,
  X
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

// Residential stepped (progressive) electricity tariff + PEA Ft + VAT 7% — editable in ⚙️ ตั้งค่า
const TARIFF_STORAGE_KEY = 'POWERVIEW_TARIFF_TIERS_V2';
const DEFAULT_TARIFF_TIERS = [
  { upTo: 200, rate: 3.0 },
  { upTo: 400, rate: 4.22 },
  { upTo: null, rate: 4.42 }
];
const DEFAULT_EXPORT_RATE = 2.2;
const DEFAULT_FT_RATE = 0.1623; // ค่า Ft การไฟฟ้าส่วนภูมิภาค (กฟภ.) รอบ ก.ย. 69 - ธ.ค. 69 ตามบิลจริง = 0.1623 บาท/หน่วย
const DEFAULT_SERVICE_FEE = 24.62; // ค่าบริการรายเดือน กฟภ. บาท/เดือน
const DEFAULT_VAT_PCT = 7; // ภาษีมูลค่าเพิ่ม 7%

const loadTariffSettings = () => {
  try {
    const raw = localStorage.getItem(TARIFF_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.tiers) && parsed.tiers.length > 0) {
        // Auto-migrate if user was on old Ft rate 0.3972
        const effectiveFt =
          parsed.ftRate === 0.3972 ? DEFAULT_FT_RATE : Number(parsed.ftRate ?? DEFAULT_FT_RATE);
        return {
          tiers: parsed.tiers,
          exportRate: Number(parsed.exportRate ?? DEFAULT_EXPORT_RATE),
          ftRate: effectiveFt,
          serviceFee: Number(parsed.serviceFee ?? DEFAULT_SERVICE_FEE),
          vatPct: Number(parsed.vatPct ?? DEFAULT_VAT_PCT)
        };
      }
    }
  } catch {
    // ignore malformed storage
  }
  return {
    tiers: DEFAULT_TARIFF_TIERS,
    exportRate: DEFAULT_EXPORT_RATE,
    ftRate: DEFAULT_FT_RATE,
    serviceFee: DEFAULT_SERVICE_FEE,
    vatPct: DEFAULT_VAT_PCT
  };
};

/**
 * Calculates base tiered energy charge with full line-item breakdown matching official PEA invoice
 */
export const calcTieredBillWithBreakdown = (kwh, tiers = DEFAULT_TARIFF_TIERS) => {
  let remaining = Math.max(0, Number(kwh) || 0);
  let prevCap = 0;
  let total = 0;
  const breakdown = [];

  for (let idx = 0; idx < tiers.length; idx++) {
    const tier = tiers[idx];
    if (remaining <= 0) break;
    const cap = tier.upTo === null || tier.upTo === '' ? Infinity : Number(tier.upTo);
    const tierUnits = Math.min(remaining, Math.max(0, cap - prevCap));
    const tierCost = Number((tierUnits * Number(tier.rate || 0)).toFixed(2));
    total += tierCost;

    breakdown.push({
      tierIndex: idx + 1,
      rangeLabel:
        idx === 0
          ? `(หน่วยที่ 1-${tier.upTo})`
          : tier.upTo
          ? `(หน่วยที่ ${prevCap + 1}-${tier.upTo})`
          : `(หน่วยที่ ${prevCap + 1} ขึ้นไป)`,
      units: tierUnits,
      rate: Number(tier.rate || 0),
      amount: tierCost
    });

    remaining -= tierUnits;
    prevCap = cap;
  }

  return {
    total: Number(total.toFixed(2)),
    breakdown
  };
};

export const calcTieredBill = (kwh, tiers = DEFAULT_TARIFF_TIERS) => {
  return calcTieredBillWithBreakdown(kwh, tiers).total;
};

/**
 * Calculates full PEA bill with exact parity to official PEA invoices:
 * 1. Base tiered energy charge
 * 2. Monthly service charge (24.62฿)
 * 3. Total based amount (Base + Service charge)
 * 4. Ft charge (Ft rate x units)
 * 5. Sub total (Base + Service + Ft)
 * 6. VAT 7%
 * 7. Grand total bill
 */
export const calcFullPeaBill = (kwh, settings = {}) => {
  const units = Math.max(0, Number(kwh) || 0);
  const tiers = settings.tiers || DEFAULT_TARIFF_TIERS;
  const ftRate = Number(settings.ftRate ?? DEFAULT_FT_RATE);
  const serviceFee = Number(settings.serviceFee ?? DEFAULT_SERVICE_FEE);
  const vatPct = Number(settings.vatPct ?? DEFAULT_VAT_PCT);

  if (units <= 0) {
    return {
      units: 0,
      baseEnergy: 0,
      tierBreakdown: [],
      serviceFee,
      totalBaseAmount: serviceFee,
      ftRate,
      ftCharge: 0,
      subtotalBeforeVat: serviceFee,
      vatPct,
      vatBaht: Number((serviceFee * (vatPct / 100)).toFixed(2)),
      totalBill: Number((serviceFee * (1 + vatPct / 100)).toFixed(2))
    };
  }

  const { total: baseEnergy, breakdown: tierBreakdown } = calcTieredBillWithBreakdown(units, tiers);
  const totalBaseAmount = Number((baseEnergy + serviceFee).toFixed(2));
  const ftCharge = Number((units * ftRate).toFixed(2));
  const subtotalBeforeVat = Number((totalBaseAmount + ftCharge).toFixed(2));
  const vatBaht = Number((subtotalBeforeVat * (vatPct / 100)).toFixed(2));
  const totalBill = Number((subtotalBeforeVat + vatBaht).toFixed(2));

  return {
    units,
    baseEnergy,
    tierBreakdown,
    serviceFee,
    totalBaseAmount,
    ftRate,
    ftCharge,
    subtotalBeforeVat,
    vatPct,
    vatBaht,
    totalBill
  };
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

export const formatThaiDateShort = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).split('-');
  const thaiYear = (parseInt(y, 10) + 543) % 100;
  return `${d}/${m}/${thaiYear}`;
};

export const getBillingCycleRange = (year, month, cutOffDay = 24) => {
  const prevMonthDate = new Date(year, month - 2, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth() + 1;
  const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
  const actualPrevDay = Math.min(cutOffDay, daysInPrevMonth);

  const daysInCurMonth = new Date(year, month, 0).getDate();
  const actualCurDay = Math.min(cutOffDay, daysInCurMonth);

  const pad = (n) => String(n).padStart(2, '0');
  const startDate = `${prevYear}-${pad(prevMonth)}-${pad(actualPrevDay)}`;
  const endDate = `${year}-${pad(month)}-${pad(actualCurDay)}`;

  return {
    cycleKey: `${year}-${pad(month)}`,
    year,
    month,
    startDate,
    endDate,
    periodLabel: `${formatThaiDateShort(startDate)} - ${formatThaiDateShort(endDate)}`,
    readDateThai: formatThaiDateShort(endDate),
    monthLabel: `${THAI_MONTHS[month - 1]} ${year + 543} (รอบเดือน ${month})`
  };
};

export const BENCHMARK_PEA_HISTORY = [
  { cycleKey: '2026-10', year: 2026, month: 10, units: 37.23, recentReading: 3324.0, prevReading: 3286.77 },
  { cycleKey: '2026-09', year: 2026, month: 9, units: 184.0, recentReading: 3286.77, prevReading: 3102.77 },
  { cycleKey: '2026-08', year: 2026, month: 8, units: 430.0, recentReading: 3102.77, prevReading: 2672.77 },
  { cycleKey: '2026-07', year: 2026, month: 7, units: 456.0, recentReading: 2672.77, prevReading: 2216.77 },
  { cycleKey: '2026-06', year: 2026, month: 6, units: 454.0, recentReading: 2216.77, prevReading: 1762.77 },
  { cycleKey: '2026-05', year: 2026, month: 5, units: 491.0, recentReading: 1762.77, prevReading: 1271.77 },
  { cycleKey: '2026-04', year: 2026, month: 4, units: 473.0, recentReading: 1271.77, prevReading: 798.77 }
];

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
  const [settingsTab, setSettingsTab] = useState('tariff'); // 'tariff' | 'cloud' | 'theme'
  const [editForm, setEditForm] = useState(solarData);
  const [transientGuestPassword, setTransientGuestPassword] = useState('');
  const [backfillDays, setBackfillDays] = useState(90);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [saveNotice, setSaveNotice] = useState(null);
  const [isPeaModalOpen, setIsPeaModalOpen] = useState(false);
  const [selectedPeaMonth, setSelectedPeaMonth] = useState(null);
  const [selectedPeaCycleKey, setSelectedPeaCycleKey] = useState('2026-10');
  const [billingCutoffDay, setBillingCutoffDay] = useState(() => {
    try {
      const saved = localStorage.getItem('POWERVIEW_BILLING_CUTOFF_DAY');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 1 && parsed <= 31) return parsed;
      }
    } catch (e) {
      // ignore
    }
    return 24;
  });

  const handleBillingCutoffDayChange = (newDay) => {
    const day = Math.min(31, Math.max(1, parseInt(newDay, 10) || 24));
    setBillingCutoffDay(day);
    try {
      localStorage.setItem('POWERVIEW_BILLING_CUTOFF_DAY', String(day));
    } catch (e) {
      // ignore
    }
  };

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

  // Dynamic monthly billing cycles with user-selected cut-off date (e.g. 24th of each month)
  const billingCycles = useMemo(() => {
    const baseCycles = [
      { year: 2026, month: 10 },
      { year: 2026, month: 9 },
      { year: 2026, month: 8 },
      { year: 2026, month: 7 },
      { year: 2026, month: 6 },
      { year: 2026, month: 5 },
      { year: 2026, month: 4 }
    ];

    return baseCycles.map(({ year, month }) => {
      const cycleRange = getBillingCycleRange(year, month, billingCutoffDay);
      const { startDate, endDate, cycleKey, periodLabel, readDateThai, monthLabel } = cycleRange;

      // Filter historical logs strictly falling in this billing cut-off window: date > startDate && date <= endDate
      const matchingLogs = historicalLogs.filter(
        (log) => log && log.date && log.date > startDate && log.date <= endDate
      );

      const benchmark = BENCHMARK_PEA_HISTORY.find((b) => b.cycleKey === cycleKey);

      let pvGen = 0;
      let load = 0;
      let exp = 0;
      let imp = 0;
      let daysCount = matchingLogs.length;

      if (matchingLogs.length > 0) {
        pvGen = Number(matchingLogs.reduce((acc, l) => acc + Number(l.pvGenerationKWh || 0), 0).toFixed(2));
        load = Number(matchingLogs.reduce((acc, l) => acc + Number(l.loadElectricityKWh || 0), 0).toFixed(2));
        exp = Number(matchingLogs.reduce((acc, l) => acc + Number(l.exportKWh || 0), 0).toFixed(2));
        const rawImp = Number(matchingLogs.reduce((acc, l) => acc + Number(l.importKWh || 0), 0).toFixed(2));
        const balancedImp = Math.max(0, Number((load - Math.max(0, pvGen - exp)).toFixed(2)));
        imp = Math.max(rawImp, balancedImp);
      }

      // If no hardware logs for this month yet, or if benchmark units available
      if (matchingLogs.length === 0 && benchmark) {
        imp = benchmark.units;
        load = benchmark.units;
      } else if (benchmark && imp === 0) {
        imp = benchmark.units;
      }

      // Meter readings: benchmark if available or calculate from cumulative
      const recentReading = benchmark ? benchmark.recentReading : 3324.0;
      const prevReading = benchmark ? benchmark.prevReading : Math.max(0, Number((recentReading - imp).toFixed(3)));

      const importBillDetails = calcFullPeaBill(imp, tariffSettings);
      const hypotheticalBillDetails = calcFullPeaBill(load, tariffSettings);
      const exportIncome = Number((exp * (tariffSettings.exportRate || DEFAULT_EXPORT_RATE)).toFixed(2));
      const savedBaht = Math.max(
        0,
        Number((hypotheticalBillDetails.totalBill - importBillDetails.totalBill + exportIncome).toFixed(2))
      );

      return {
        cycleKey,
        month: cycleKey,
        year,
        monthNum: month,
        startDate,
        endDate,
        periodLabel,
        readDateThai,
        monthLabel,
        days: daysCount,
        pvGen,
        load,
        imp,
        exp,
        recentReading,
        prevReading,
        importBill: importBillDetails.totalBill,
        importBillDetails,
        hypotheticalBillWithoutSolar: hypotheticalBillDetails.totalBill,
        hypotheticalBillDetails,
        exportIncome,
        savedBaht,
        isBenchmark: matchingLogs.length === 0 && !!benchmark
      };
    });
  }, [historicalLogs, billingCutoffDay, tariffSettings]);

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

      // Calculate bill & savings per month using tiered rates + PEA Ft + VAT 7%
      const monthlyBreakdown = Array.from(monthBuckets.values())
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => {
          const importBillDetails = calcFullPeaBill(m.imp, tariffSettings);
          const hypotheticalBillDetails = calcFullPeaBill(m.load, tariffSettings);
          const exportIncome = Number(
            (m.exp * (tariffSettings.exportRate || DEFAULT_EXPORT_RATE)).toFixed(2)
          );
          // Saved = (What you would have paid to Grid with Ft & VAT 7%) - (What you actually paid for Import with Ft & VAT 7%) + Export Income
          const savedBaht = Math.max(
            0,
            Number((hypotheticalBillDetails.totalBill - importBillDetails.totalBill + exportIncome).toFixed(2))
          );
          return {
            ...m,
            pvGen: Number(m.pvGen.toFixed(2)),
            load: Number(m.load.toFixed(2)),
            imp: Number(m.imp.toFixed(2)),
            exp: Number(m.exp.toFixed(2)),
            importBill: importBillDetails.totalBill,
            importBillDetails,
            hypotheticalBillWithoutSolar: hypotheticalBillDetails.totalBill,
            hypotheticalBillDetails,
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
        monthlyBreakdown: billingCycles && billingCycles.length > 0 ? billingCycles : monthlyBreakdown
      };
    }

    const pvGen = statPeriod === 'Total' ? totalGenKWh : todayGenKWh;
    const todayImportBillDetails = calcFullPeaBill(importKWh, tariffSettings);
    const todayWithoutSolarDetails = calcFullPeaBill(loadKWh, tariffSettings);
    const todayExportIncome = Number((exportKWh * (tariffSettings.exportRate || DEFAULT_EXPORT_RATE)).toFixed(2));
    const todaySavedBaht = Math.max(
      0,
      Number((todayWithoutSolarDetails.totalBill - todayImportBillDetails.totalBill + todayExportIncome).toFixed(2))
    );

    return {
      daysCount: 1,
      pvGen,
      load: loadKWh,
      imp: importKWh,
      exp: exportKWh,
      chg: chargeBatKWh,
      dis: dischargeBatKWh,
      gridBill: todayImportBillDetails.totalBill,
      savedBaht: todaySavedBaht || Math.round(Math.max(0, pvGen - exportKWh) * simTariffBaht + exportKWh * 2.2),
      monthlyBreakdown: billingCycles && billingCycles.length > 0 ? billingCycles : [
        {
          month: (getThailandDateStr(0) || '').slice(0, 7),
          days: 1,
          pvGen,
          load: loadKWh,
          imp: importKWh,
          exp: exportKWh,
          importBill: todayImportBillDetails.totalBill,
          importBillDetails: todayImportBillDetails,
          hypotheticalBillWithoutSolar: todayWithoutSolarDetails.totalBill,
          hypotheticalBillDetails: todayWithoutSolarDetails,
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
        if (!silent) {
          if (res.needsPassword) {
            setIsSettingOpen(true);
          }
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

  // Automatic Initial Sync on Mount (100% SILENT in background, NEVER pops up settings or error modals)
  useEffect(() => {
    if (!currentCompany) return;

    if (autoStartedOrgRef.current !== currentCompany.id) {
      autoStartedOrgRef.current = currentCompany.id;
      // Always sync silently in background on mount - never interrupt the user with popups
      executeSajSync({
        silent: true,
        skipBackfillIfCached: historicalLogs.length > 5
      });
    }
  }, [currentCompany, historicalLogs.length, executeSajSync]);

  // 60s Real-Time Auto-Polling (Runs silently in background, keeping telemetry live)
  useEffect(() => {
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
  }, [executeSajSync]);

  // Manual One-click REAL SAJ Cloud V2 Sync + Full Historical Backfill
  const handleSyncSajCloudAndHistory = useCallback(async () => {
    await executeSajSync({ silent: false, skipBackfillIfCached: false });
  }, [executeSajSync]);

  // Listen to mobile bottom bar actions
  useEffect(() => {
    const handleOpenSettings = () => {
      setEditForm(solarData);
      setIsSettingOpen(true);
    };
    const handleTriggerSync = () => {
      handleSyncSajCloudAndHistory();
    };

    window.addEventListener('OPEN_SOLAR_SETTINGS', handleOpenSettings);
    window.addEventListener('TRIGGER_SOLAR_SYNC', handleTriggerSync);

    return () => {
      window.removeEventListener('OPEN_SOLAR_SETTINGS', handleOpenSettings);
      window.removeEventListener('TRIGGER_SOLAR_SYNC', handleTriggerSync);
    };
  }, [solarData, handleSyncSajCloudAndHistory]);

  // Broadcast sync animation state to mobile bottom navigation bar
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('SOLAR_SYNC_STATUS', { detail: { isSyncing: isTesting } })
    );
  }, [isTesting]);

  const handleSaveSettingsToDb = (e) => {
    if (e && e.preventDefault) e.preventDefault();
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
      {/* MINIMALIST EXECUTIVE STATUS BAR (ACTIONS UNIFIED IN MOBILE BAR)    */}
      {/* =================================================================== */}
      <div className="bg-[#070b14] border border-slate-800/90 rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 shadow-lg flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center justify-between sm:justify-start w-full sm:w-auto gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-base sm:text-xl font-black tracking-tight text-white">
              {currentCompany.name}
            </h2>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-900 text-sky-400 border border-slate-800">
              {solarData.inverterModel || 'H2-6K-LS2'}
            </span>
          </div>
          {solarData.lastCloudSyncAt && (
            <span className="text-[11px] text-slate-400 font-mono">
              • ซิงก์ล่าสุด {solarData.lastCloudSyncAt.slice(-8)} ({autoSyncCountdown}s)
            </span>
          )}
        </div>

        {/* Desktop-Only Action Buttons (On Mobile, Sync & Settings are unified in the 1-thumb Bottom Menu Bar) */}
        <div className="hidden sm:flex items-center gap-2">
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

      {/* =================================================================== */}
      {/* FLOATING MOBILE-APP STATUS TOAST / SYNC MODAL                       */}
      {/* =================================================================== */}
      {(isTesting || saveNotice || (testResult && !testResult.dismissed)) && (
        <div className="fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-50 w-[92%] sm:max-w-md pointer-events-auto transition-all duration-300">
          <div
            className={`p-3.5 sm:p-4 rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.8)] backdrop-blur-2xl border flex items-start justify-between gap-3 ${
              isTesting
                ? 'bg-slate-900/95 border-sky-500/60 text-sky-200 shadow-sky-500/10'
                : saveNotice
                ? 'bg-slate-900/95 border-emerald-500/60 text-emerald-200 shadow-emerald-500/10'
                : testResult?.success
                ? 'bg-slate-900/95 border-emerald-500/60 text-emerald-200 shadow-emerald-500/10'
                : 'bg-slate-900/95 border-amber-500/60 text-amber-200 shadow-amber-500/10'
            }`}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="mt-0.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800 shrink-0">
                {isTesting ? (
                  <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
                ) : saveNotice || testResult?.success ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Lock className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs sm:text-sm text-white flex items-center gap-2">
                  <span>
                    {isTesting
                      ? 'กำลังซิงก์ข้อมูล SAJ Cloud...'
                      : saveNotice
                      ? 'บันทึกสำเร็จ'
                      : testResult?.success
                      ? 'ซิงก์ข้อมูลเรียบร้อย'
                      : 'แจ้งเตือนระบบ'}
                  </span>
                  {isTesting && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      LIVE
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 leading-relaxed break-words">
                  {isTesting
                    ? 'กำลังดึงข้อมูล Real-time และประวัติย้อนหลังเข้าสู่ฐานข้อมูล...'
                    : saveNotice || testResult?.message}
                </p>
                {!isTesting && testResult && !testResult.success && testResult.needsPassword && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingOpen(true);
                      setSettingsTab('cloud');
                      setTestResult(null);
                    }}
                    className="mt-2 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>ใส่รหัสผ่านในหน้าตั้งค่า</span>
                  </button>
                )}
              </div>
            </div>

            {!isTesting && (
              <button
                type="button"
                onClick={() => {
                  setSaveNotice(null);
                  setTestResult(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition-all shrink-0"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* GORGEOUS NATIVE MOBILE-APP SETTINGS MODAL / BOTTOM SHEET            */}
      {/* =================================================================== */}
      {isSettingOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md">
          {/* Backdrop click to close */}
          <div
            className="fixed inset-0 bg-transparent"
            onClick={() => setIsSettingOpen(false)}
          />

          <div className="relative z-10 w-full sm:max-w-2xl bg-[#080d19] border border-sky-500/30 rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col shadow-[0_-20px_60px_rgba(0,0,0,0.9)] overflow-hidden pb-safe">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden pt-3 pb-1 flex justify-center bg-slate-900/90">
              <div className="w-12 h-1.5 bg-slate-700/80 rounded-full" />
            </div>

            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800/90 flex items-center justify-between bg-slate-900/90 backdrop-blur-xl shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    ⚙️ ตั้งค่าระบบ & จัดการ SAJ Cloud
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    SN: <strong className="font-mono text-amber-300">{solarData.sajDeviceSn || 'H2A2602J2539E14713'}</strong> • ประวัติสะสม: <strong className="font-mono text-sky-300">{historicalLogs.length} วัน</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSettingOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b border-slate-800/80 bg-[#04070e] px-4 pt-2 gap-2 overflow-x-auto no-scrollbar shrink-0">
              {[
                { id: 'tariff', label: '⚡ เรตค่าไฟขั้นบันได', icon: Zap },
                { id: 'cloud', label: '☁️ บัญชี SAJ Cloud', icon: CloudDownload },
                { id: 'theme', label: '🎨 ธีมหน้าปัดรถหรู', icon: Sparkles }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSettingsTab(tab.id)}
                    className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                      settingsTab === tab.id
                        ? 'border-sky-400 text-sky-300 font-extrabold'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <form
              onSubmit={handleSaveSettingsToDb}
              className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs"
            >
              {/* TAB 1: TARIFF */}
              {settingsTab === 'tariff' && (
                <div className="space-y-4">
                  <div className="bg-[#04070e] border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-amber-300 font-bold text-sm">
                          ⚡ อัตราค่าไฟฟ้าแบบขั้นบันได (Progressive Tariff)
                        </label>
                        <span className="text-[11px] text-slate-400">
                          0–200 หน่วยแรกคิดหน่วยละ 3 บาท และ 201 หน่วยขึ้นไปคิดเป็นขั้นบันได
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateTariffSettings({
                            tiers: DEFAULT_TARIFF_TIERS,
                            exportRate: DEFAULT_EXPORT_RATE,
                            ftRate: DEFAULT_FT_RATE,
                            serviceFee: DEFAULT_SERVICE_FEE,
                            vatPct: DEFAULT_VAT_PCT
                          })
                        }
                        className="text-[10px] font-bold text-sky-400 hover:text-sky-200 underline cursor-pointer"
                      >
                        ↺ รีเซ็ตมาตรฐาน
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {tariffSettings.tiers.map((tier, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1.5 text-xs font-mono"
                        >
                          <div className="text-[11px] font-sans font-bold text-slate-300 flex items-center justify-between">
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
                            <span className="text-[11px] font-sans text-slate-400">หน่วยละ:</span>
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

                  {/* PEA Ft Rate, Monthly Service Fee, VAT 7% */}
                  <div className="bg-[#04070e] border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="text-slate-200 font-bold text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-cyan-300">
                        ⚡ ค่า Ft การไฟฟ้า (PEA Ft) และ ภาษี VAT 7% (คิดครบตามบิลจริง)
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">ตามประกาศ กฟภ.</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Ft Rate */}
                      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1 text-xs">
                        <label className="block text-slate-400 text-[11px] font-bold">
                          ค่า Ft (บาท/หน่วย)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.0001"
                            value={tariffSettings.ftRate ?? DEFAULT_FT_RATE}
                            onChange={(e) =>
                              updateTariffSettings({
                                ...tariffSettings,
                                ftRate: Number(e.target.value) || 0
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-cyan-300 font-mono font-bold text-right"
                          />
                          <span className="text-[11px] text-slate-400">฿</span>
                        </div>
                        <p className="text-[10px] text-slate-500">มาตรฐาน 0.3972 ฿</p>
                      </div>

                      {/* Service Fee */}
                      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1 text-xs">
                        <label className="block text-slate-400 text-[11px] font-bold">
                          ค่าบริการ กฟภ. (บาท/เดือน)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={tariffSettings.serviceFee ?? DEFAULT_SERVICE_FEE}
                            onChange={(e) =>
                              updateTariffSettings({
                                ...tariffSettings,
                                serviceFee: Number(e.target.value) || 0
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono font-bold text-right"
                          />
                          <span className="text-[11px] text-slate-400">฿</span>
                        </div>
                        <p className="text-[10px] text-slate-500">มาตรฐาน 24.62 ฿</p>
                      </div>

                      {/* VAT % */}
                      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1 text-xs">
                        <label className="block text-slate-400 text-[11px] font-bold">
                          ภาษีมูลค่าเพิ่ม (VAT %)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={tariffSettings.vatPct ?? DEFAULT_VAT_PCT}
                            onChange={(e) =>
                              updateTariffSettings({
                                ...tariffSettings,
                                vatPct: Number(e.target.value) || 0
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-emerald-400 font-mono font-bold text-right"
                          />
                          <span className="text-[11px] text-slate-400">%</span>
                        </div>
                        <p className="text-[10px] text-slate-500">มาตรฐาน 7%</p>
                      </div>
                    </div>
                  </div>

                  {/* Export Rate */}
                  <div className="bg-[#04070e] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <label className="block text-slate-200 font-bold mb-0.5">
                        💰 เรตรับซื้อไฟคืนเข้าสายส่ง (Export Rate)
                      </label>
                      <p className="text-[11px] text-slate-400">
                        โครงการโซลาร์ภาคประชาชน อัตรามาตรฐาน ฿2.20 / kWh
                      </p>
                    </div>
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
                        className="w-24 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-sky-300 font-mono font-bold text-center"
                      />
                      <span className="text-xs text-slate-400">บาท/หน่วย</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SAJ CLOUD */}
              {settingsTab === 'cloud' && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <label className="block text-sky-300 font-bold mb-1 flex items-center justify-between">
                        <span>2. รหัสผ่านแอป SAJ</span>
                        {savedTicket && (
                          <span className="text-[10px] text-emerald-400 font-mono font-bold">
                            ✅ มี Ticket ถาวรแล้ว
                          </span>
                        )}
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
                </div>
              )}

              {/* TAB 3: THEME */}
              {settingsTab === 'theme' && (
                <div className="space-y-3">
                  <label className="block text-slate-300 font-bold text-sm">
                    🎨 เลือกโทนสีหน้าปัดไมล์รถหรู (Cockpit Theme)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {Object.values(COCKPIT_THEMES).map((tItem) => (
                      <button
                        key={tItem.id}
                        type="button"
                        onClick={() => setCockpitThemeKey(tItem.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          cockpitThemeKey === tItem.id
                            ? 'bg-sky-500/15 border-sky-400 shadow-lg text-white'
                            : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="font-bold text-xs">{tItem.name}</div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{tItem.tag}</div>
                        <div className="flex gap-1.5 mt-2.5">
                          <span
                            className="w-4 h-4 rounded-full border border-white/20"
                            style={{ backgroundColor: tItem.pvPrimary }}
                          />
                          <span
                            className="w-4 h-4 rounded-full border border-white/20"
                            style={{ backgroundColor: tItem.battPrimary }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>

            {/* Modal Bottom Actions */}
            <div className="p-4 border-t border-slate-800/90 bg-[#060a14] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleAutoReadUsbSerial}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold cursor-pointer text-xs flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
                <span>USB-RS485</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncSajCloudAndHistory}
                  disabled={isTesting}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold cursor-pointer text-xs flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'กำลังซิงก์...' : 'ซิงก์ข้อมูลทันที'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveSettingsToDb}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-slate-950 font-black cursor-pointer text-xs shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
                >
                  💾 บันทึกการตั้งค่า
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* OFFICIAL PEA ELECTRICITY BILL MODAL (จำลองใบแจ้งค่าไฟฟ้า กฟภ. ฉบับจริง) */}
      {/* =================================================================== */}
      {isPeaModalOpen && (() => {
        const activeCycle = billingCycles.find((c) => c.cycleKey === selectedPeaCycleKey) || billingCycles[0];
        const bill = activeCycle.importBillDetails;
        const hypothetical = activeCycle.hypotheticalBillDetails;
        const exportIncome = activeCycle.exportIncome;
        const netSaved = activeCycle.savedBaht;

        // Cumulative meter counter matching PEA invoice style
        const recentReading = activeCycle.recentReading;
        const prevReading = activeCycle.prevReading;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
            <div className="relative w-full max-w-3xl bg-[#0c101d] border border-purple-500/50 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col my-auto max-h-[94vh]">
              {/* Modal Top Bar */}
              <div className="bg-gradient-to-r from-purple-900/90 via-indigo-950 to-purple-900/90 border-b border-purple-500/30 p-3.5 sm:p-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-600/30 border border-purple-400/50 flex items-center justify-center text-purple-200">
                    <Zap className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                      <span>การไฟฟ้าส่วนภูมิภาค (PEA)</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
                        ใบคำนวณค่าไฟฟ้าตามบิลจริง
                      </span>
                    </h3>
                    <p className="text-[11px] text-purple-200/80">
                      รอบบิล: {activeCycle.monthLabel} • ผู้ใช้ไฟ: {currentCompany.name} (บ้านอยู่อาศัย)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold cursor-pointer transition-all"
                    title="พิมพ์หรือบันทึก PDF"
                  >
                    <Printer className="w-4 h-4 text-purple-300" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPeaModalOpen(false)}
                    className="p-2 rounded-xl bg-slate-900/80 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-700 text-xs font-bold cursor-pointer transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Scrollable Body: Replicating the PEA Invoice Layout */}
              <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 text-xs font-sans">
                {/* 0. Billing Cycle Selector & Cut-off Day Controller */}
                <div className="bg-[#101628] border border-purple-500/40 rounded-2xl p-3 sm:p-3.5 space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {/* Left: Cycle Selector */}
                    <div className="flex-1 space-y-1">
                      <label className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                        <span>เลือกรอบบิลที่ต้องการสรุป (รอบเดือน):</span>
                      </label>
                      <select
                        value={activeCycle.cycleKey}
                        onChange={(e) => setSelectedPeaCycleKey(e.target.value)}
                        className="w-full bg-slate-950 border border-purple-500/50 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-amber-300 focus:outline-none focus:border-amber-400 cursor-pointer"
                      >
                        {billingCycles.map((c) => (
                          <option key={c.cycleKey} value={c.cycleKey}>
                            {c.monthLabel} • อ่านหน่วย {c.periodLabel} ({c.imp} หน่วย - ฿{c.importBill.toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Right: Cut-off Day Selector */}
                    <div className="space-y-1 shrink-0">
                      <div className="text-[11px] font-bold text-purple-300 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          <span>กำหนดวันตัดยอดของเดือน:</span>
                        </span>
                        <span className="text-[10px] text-amber-300 font-mono font-bold">วันที่ {billingCutoffDay}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[20, 22, 23, 24, 25].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => handleBillingCutoffDayChange(d)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                              billingCutoffDay === d
                                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/30'
                                : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-700'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                        <div className="flex items-center gap-1 pl-1">
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={billingCutoffDay}
                            onChange={(e) => handleBillingCutoffDayChange(e.target.value)}
                            className="w-12 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-center text-white focus:outline-none focus:border-purple-400"
                            title="กำหนดวันตัดรอบบิลเอง 1-31"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-purple-500/20">
                    <span className="text-purple-300">
                      💡 รอบบิลเดือน {activeCycle.monthNum}: อ่านหน่วยวันที่ <span className="text-amber-300 font-bold">{activeCycle.periodLabel}</span>
                    </span>
                    <span className="text-slate-400">
                      อ่านหน่วยครั้งถัดไป: วันที่ {billingCutoffDay} เดือนถัดไป
                    </span>
                  </div>
                </div>

                {/* 1. Header Usage & Breakdown Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
                  {/* Left Column (8 cols): Usage + Tariff Breakdown + Amount Calculation */}
                  <div className="lg:col-span-8 space-y-3.5">
                    {/* 1.1 รายละเอียดการใช้ไฟฟ้า (Usage) */}
                    <div className="bg-[#101628] border border-purple-500/30 rounded-2xl p-3 sm:p-3.5 space-y-2">
                      <div className="text-[11px] font-bold text-purple-300 flex items-center justify-between">
                        <span>รายละเอียดการใช้ไฟฟ้า (Usage)</span>
                        <span className="text-[10px] text-amber-300 font-mono bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-500/40">
                          ช่วงวันที่อ่านหน่วย: {activeCycle.periodLabel}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center font-mono">
                        <div className="bg-slate-950/90 rounded-xl p-2 border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-sans block">เลขอ่านครั้งหลัง ({activeCycle.readDateThai})</span>
                          <span className="text-xs sm:text-sm font-bold text-slate-200">{recentReading.toFixed(3)}</span>
                        </div>
                        <div className="bg-slate-950/90 rounded-xl p-2 border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-sans block">เลขอ่านครั้งก่อน</span>
                          <span className="text-xs sm:text-sm font-bold text-slate-200">{prevReading.toFixed(3)}</span>
                        </div>
                        <div className="bg-purple-950/40 rounded-xl p-2 border border-purple-500/50">
                          <span className="text-[10px] text-purple-300 font-sans block">จำนวนที่ใช้ (หน่วย)</span>
                          <span className="text-xs sm:text-sm font-black text-amber-300">{bill.units.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 1.2 รายละเอียดค่าไฟฟ้าฐาน (Tariff Breakdown Table) */}
                    <div className="bg-[#101628] border border-purple-500/30 rounded-2xl p-3 sm:p-3.5 space-y-2">
                      <div className="text-[11px] font-bold text-purple-300 flex items-center justify-between">
                        <span>รายละเอียดค่าไฟฟ้าฐาน (Tariff)</span>
                        <span className="text-[10px] text-slate-400">อัตราตามประกาศ กฟภ.</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-right font-mono text-[11px]">
                          <thead>
                            <tr className="border-b border-purple-500/30 text-purple-300/80 font-sans text-[10px]">
                              <th className="text-left pb-1.5 font-bold">ขั้นหน่วยที่ใช้</th>
                              <th className="pb-1.5 font-bold">ราคา/หน่วย (บาท)</th>
                              <th className="pb-1.5 font-bold">จำนวนเงิน (บาท)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {bill.tierBreakdown.map((t, idx) => (
                              <tr key={idx} className="hover:bg-purple-500/5">
                                <td className="text-left py-1 text-slate-300 font-sans">
                                  {t.rangeLabel} {t.units} หน่วย
                                </td>
                                <td className="py-1 text-slate-400">{t.rate.toFixed(4)}</td>
                                <td className="py-1 text-slate-200 font-bold">{t.amount.toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr className="hover:bg-purple-500/5">
                              <td className="text-left py-1 text-slate-300 font-sans">
                                ค่าบริการรายเดือน (Service Charge)
                              </td>
                              <td className="py-1 text-slate-400">-</td>
                              <td className="py-1 text-slate-200 font-bold">{bill.serviceFee.toFixed(2)}</td>
                            </tr>
                            <tr className="bg-purple-950/30 font-bold border-t border-purple-500/40">
                              <td className="text-left py-1.5 px-2 text-purple-200 font-sans">
                                รวมเงินค่าไฟฟ้าฐาน (Total Based Amount)
                              </td>
                              <td className="py-1.5">-</td>
                              <td className="py-1.5 px-2 text-purple-300 font-black">{bill.totalBaseAmount.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 1.3 การคำนวณเงิน (Amount Calculation Box - Exact PEA invoice replicate) */}
                    <div className="bg-[#101628] border border-purple-500/30 rounded-2xl p-3 sm:p-3.5 space-y-2 font-mono">
                      <div className="text-[11px] font-bold text-purple-300 flex items-center justify-between font-sans">
                        <span>การคำนวณเงิน (Amount)</span>
                        <span className="text-[10px] text-slate-400">หน่วย: บาท</span>
                      </div>

                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                          <span className="font-sans text-slate-300">เงินค่าไฟฟ้าฐาน (Based Amount)</span>
                          <span className="text-slate-200 font-bold">{bill.totalBaseAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                          <span className="font-sans text-slate-300 flex items-center gap-1">
                            <span>ค่า Ft (รอบ ก.ย.-ธ.ค. = {bill.ftRate} บาท/หน่วย)</span>
                          </span>
                          <span className="text-cyan-300 font-bold">{bill.ftCharge.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-800/80 text-slate-400">
                          <span className="font-sans">*ส่วนลด (Discount)</span>
                          <span>-</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-purple-500/30 text-purple-200 font-bold">
                          <span className="font-sans">รวมเงินค่าไฟฟ้า (Sub Total)</span>
                          <span>{bill.subtotalBeforeVat.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                          <span className="font-sans text-slate-300">ภาษีมูลค่าเพิ่ม 7.00 % (VAT)</span>
                          <span className="text-slate-200 font-bold">{bill.vatBaht.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                          <span className="font-sans text-slate-300">รวมเงินค่าไฟฟ้าเดือนปัจจุบัน (Total)</span>
                          <span className="text-slate-100 font-bold">{bill.totalBill.toFixed(2)}</span>
                        </div>

                        {/* Grand Total Golden Highlight Bar (Identical to PEA Paper Bill) */}
                        <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black flex items-center justify-between text-sm sm:text-base shadow-lg shadow-amber-500/20 mt-2">
                          <span className="font-sans">รวมเงินทั้งสิ้น (Grand Total)</span>
                          <span className="text-lg sm:text-xl font-mono">{bill.totalBill.toFixed(2)} บาท</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column (4 cols): Usage History & Solar Savings Breakdown */}
                  <div className="lg:col-span-4 space-y-3.5">
                    {/* 1.4 ประวัติการใช้ไฟฟ้า (Usage History) */}
                    <div className="bg-[#101628] border border-purple-500/30 rounded-2xl p-3 sm:p-3.5 space-y-2">
                      <div className="text-[11px] font-bold text-amber-300 flex items-center justify-between">
                        <span>ประวัติการใช้ไฟฟ้า (Usage History)</span>
                        <span className="text-[10px] text-slate-400 font-sans">คลิกแถวเพื่อดูบิลรอบนั้น</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-right font-mono text-[11px]">
                          <thead>
                            <tr className="border-b border-purple-500/30 text-slate-400 font-sans text-[10px]">
                              <th className="text-left pb-1 font-bold">วันที่อ่าน</th>
                              <th className="text-center pb-1 font-bold">ช่วงรอบบิล</th>
                              <th className="pb-1 font-bold">หน่วย</th>
                              <th className="pb-1 font-bold">ค่าไฟ (฿)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {billingCycles.map((c) => {
                              const isSelected = c.cycleKey === activeCycle.cycleKey;
                              return (
                                <tr
                                  key={c.cycleKey}
                                  onClick={() => setSelectedPeaCycleKey(c.cycleKey)}
                                  className={`cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-purple-600/30 text-amber-300 font-bold'
                                      : 'hover:bg-purple-500/10 text-slate-300'
                                  }`}
                                  title={`คลิกเพื่อดูบิลรอบ ${c.monthLabel}`}
                                >
                                  <td className="text-left py-1.5 px-1 font-sans">
                                    <div className="flex items-center gap-1">
                                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                                      <span>{c.readDateThai}</span>
                                    </div>
                                  </td>
                                  <td className="text-center py-1.5 text-[9px] text-slate-400 font-sans">
                                    {c.periodLabel}
                                  </td>
                                  <td className="py-1.5 px-1 font-bold text-slate-100">{c.imp.toFixed(2)}</td>
                                  <td className="py-1.5 px-1 font-bold text-emerald-400">{c.importBill.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 1.5 กล่องเปรียบเทียบความคุ้มค่าโซลาร์ (Solar Energy Intelligence) */}
                    <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-emerald-950/20 border border-emerald-500/40 rounded-2xl p-3 sm:p-3.5 space-y-2.5">
                      <div className="text-[11px] font-bold text-emerald-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Sun className="w-3.5 h-3.5 text-amber-400" /> สรุปความคุ้มค่าจากโซลาร์
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          SOLAR ROI
                        </span>
                      </div>

                      <div className="space-y-1.5 text-[11px] font-mono">
                        <div className="flex justify-between items-center py-0.5 text-slate-300">
                          <span className="font-sans text-[10px]">☀️ ผลิตไฟโซลาร์ได้</span>
                          <span className="text-amber-300 font-bold">{activeCycle.pvGen} kWh</span>
                        </div>
                        <div className="flex justify-between items-center py-0.5 text-slate-400">
                          <span className="font-sans text-[10px]">💡 ถ้าไม่มีโซลาร์ต้องจ่าย</span>
                          <span className="line-through">{formatBaht(hypothetical.totalBill)}</span>
                        </div>
                        <div className="flex justify-between items-center py-0.5 text-rose-300">
                          <span className="font-sans text-[10px]">⚡ จ่ายจริงตามบิล กฟภ.</span>
                          <span className="font-bold">{formatBaht(bill.totalBill)}</span>
                        </div>
                        {exportIncome > 0 && (
                          <div className="flex justify-between items-center py-0.5 text-sky-300">
                            <span className="font-sans text-[10px]">📤 รายได้ขายไฟคืน ({tariffSettings.exportRate}฿)</span>
                            <span className="font-bold">+{formatBaht(exportIncome)}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-emerald-500/30 flex justify-between items-center">
                          <span className="font-sans font-bold text-emerald-300 text-xs">💰 ประหยัดสุทธิ</span>
                          <span className="text-base sm:text-lg font-black text-emerald-400">
                            {formatBaht(netSaved)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notice & Public Relations Box (Exactly as in PEA paper bill) */}
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-purple-500/30 text-[10px] text-slate-400 space-y-1 text-center font-sans">
                  <p className="text-purple-300 font-semibold">
                    ข้อความประชาสัมพันธ์: สมัครรับใบแจ้งค่าไฟฟ้า ใบเสร็จรับเงิน/ใบกำกับภาษีอิเล็กทรอนิกส์ ผ่าน e-mail สะดวก ปลอดภัย ผ่าน PEA Smart Plus หรือ www.pea.co.th โทร 1129
                  </p>
                  <p className="text-slate-500">
                    การไฟฟ้าส่วนภูมิภาค • "เอกสารนี้ออกโดยระบบอัตโนมัติ จึงไม่ต้องมีการลงนาม"
                  </p>
                </div>
              </div>

              {/* Modal Bottom Actions */}
              <div className="p-3 sm:p-4 border-t border-purple-500/30 bg-[#080d19] flex items-center justify-between gap-2 shrink-0">
                <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">
                  * คำนวณตามสูตร กฟภ. ฉบับทางการ (ฐาน ฿3-4.42 + Ft ฿{bill.ftRate} + บริการ ฿{bill.serviceFee} + VAT 7%)
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>พิมพ์บิล</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPeaModalOpen(false)}
                    className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 cursor-pointer active:scale-95 transition-all"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
            <div className="w-full sm:w-auto grid grid-cols-3 sm:flex sm:flex-wrap gap-1 bg-[#04070e] p-1 rounded-xl border border-slate-800">
              {[
                { id: 'Day', label: 'วันนี้' },
                { id: 'Week', label: '7 วัน' },
                { id: 'Month', label: '30 วัน' },
                { id: 'Year', label: 'รายปี' },
                { id: 'Total', label: 'สะสมทั้งหมด' },
                { id: 'Custom', label: '📅 ช่วงวันที่' }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setStatPeriod(p.id)}
                  className={`py-1.5 px-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all text-center cursor-pointer active:scale-95 ${
                    statPeriod === p.id
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {statPeriod === 'Custom' && (
            <div className="bg-[#04070e] border border-sky-500/30 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
                <div className="flex-1">
                  <label className="block text-slate-400 font-bold mb-1">วันที่เริ่มต้น</label>
                  <input
                    type="date"
                    value={customStartDate}
                    max={customEndDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sky-300 font-mono [color-scheme:dark]"
                  />
                </div>
                <span className="text-slate-500 text-center self-center py-0.5 sm:pb-2">ถึง</span>
                <div className="flex-1">
                  <label className="block text-slate-400 font-bold mb-1">วันที่สิ้นสุด</label>
                  <input
                    type="date"
                    value={customEndDate}
                    min={customStartDate}
                    max={getThailandDateStr(0)}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sky-300 font-mono [color-scheme:dark]"
                  />
                </div>
              </div>
              <div className="text-[11px] text-slate-400 pt-1">
                พบข้อมูลจริง <strong className="text-sky-300 font-mono">{filteredHistoryLogs.length}</strong> วันในช่วงนี้
                {historicalLogs.length > 0 && (
                  <span>
                    {' '}(มีข้อมูลตั้งแต่ {formatSlashDate(historicalLogs[0].date)})
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between min-h-[92px]">
              <div className="text-xs text-sky-300 font-bold truncate">☀️ ผลิตไฟโซลาร์ (PV)</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                {periodStats.pvGen.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>

            <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between min-h-[92px]">
              <div className="text-xs text-indigo-300 font-bold truncate">🏠 ใช้ไฟในบ้านรวม (Load)</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                {periodStats.load.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>

            <div className="bg-[#04070e] border border-emerald-500/30 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between min-h-[92px]">
              <div className="text-xs text-emerald-300 font-bold flex items-center justify-between">
                <span>💰 ประหยัดได้</span>
                <span className="text-[10px] text-emerald-400/80 font-normal">สุทธิ</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-1">
                {formatBaht(periodStats.savedBaht)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedPeaCycleKey(billingCycles[0]?.cycleKey || '2026-10');
                setIsPeaModalOpen(true);
              }}
              className="bg-[#04070e] hover:bg-slate-900 border border-rose-500/40 hover:border-purple-400 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between min-h-[92px] text-left transition-all cursor-pointer group active:scale-95"
              title="คลิกเพื่อเปิดดูใบแจ้งหนี้ กฟภ. ฉบับทางการ"
            >
              <div className="text-xs text-rose-300 font-bold flex items-center justify-between w-full">
                <span>⚡ จ่ายการไฟฟ้า</span>
                <span className="text-[10px] text-purple-300 bg-purple-500/20 border border-purple-500/30 px-1.5 py-0.5 rounded font-mono group-hover:scale-105 transition-transform flex items-center gap-1">
                  <FileText className="w-3 h-3" /> บิล กฟภ.
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-rose-400 mt-1">
                {formatBaht(billingCycles[0]?.importBill || periodStats.gridBill || 0)}
              </div>
            </button>

            <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between min-h-[92px]">
              <div className="text-xs text-amber-300 font-bold truncate">🗼 ดึงไฟการไฟฟ้า (Import)</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-amber-300 mt-1">
                {periodStats.imp.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>

            <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between min-h-[92px]">
              <div className="text-xs text-emerald-300 font-bold truncate">🔋 ชาร์จลงแบต</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-1">
                {periodStats.chg.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>

            <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between min-h-[92px]">
              <div className="text-xs text-teal-300 font-bold truncate">🔋 จ่ายไฟจากแบต</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-teal-300 mt-1">
                {periodStats.dis.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>

            <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between min-h-[92px]">
              <div className="text-xs text-sky-300 font-bold truncate">📤 ส่งออกขายไฟ (Export)</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-sky-300 mt-1">
                {periodStats.exp.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#080d19]/95 border border-slate-800/90 rounded-[28px] p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>สรุปค่าไฟฟ้าและเงินที่ประหยัดได้</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedPeaCycleKey(billingCycles[0]?.cycleKey || '2026-10');
                  setIsPeaModalOpen(true);
                }}
                className="px-2.5 py-1 rounded-xl bg-purple-600/25 hover:bg-purple-600/35 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
              >
                <FileText className="w-3.5 h-3.5 text-purple-300" />
                <span>📄 ดูบิล กฟภ. ฉบับจริง</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400">
              <p>
                ตัดยอดทุกวันที่ <span className="text-amber-300 font-bold font-mono">{billingCutoffDay}</span> ของเดือน (เช่น รอบ ต.ค. 69: {billingCycles[0]?.periodLabel})
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedPeaCycleKey(billingCycles[0]?.cycleKey || '2026-10');
                  setIsPeaModalOpen(true);
                }}
                className="text-purple-400 hover:text-purple-300 underline font-semibold cursor-pointer text-[10px]"
              >
                เปลี่ยนวันตัดยอด
              </button>
            </div>
          </div>

          {/* Monthly Billing Breakdown Table */}
          <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3 sm:p-3.5 space-y-2 overflow-hidden">
            <div className="grid grid-cols-4 text-[10px] sm:text-xs font-bold text-slate-400 pb-1.5 border-b border-slate-800 text-right">
              <span className="text-left text-slate-300">รอบบิล (คลิกดูบิล)</span>
              <span>ดึงไฟ (kWh)</span>
              <span className="text-rose-400">จ่ายการไฟฟ้า</span>
              <span className="text-emerald-400">ประหยัดได้</span>
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
              {Array.isArray(billingCycles) && billingCycles.length > 0 ? (
                billingCycles.map((c) => (
                  <div
                    key={c.cycleKey}
                    onClick={() => {
                      setSelectedPeaCycleKey(c.cycleKey);
                      setIsPeaModalOpen(true);
                    }}
                    className="grid grid-cols-4 items-center text-[10px] sm:text-xs font-mono py-1.5 px-2 rounded-xl bg-slate-900/60 border border-slate-800/60 hover:border-purple-500/60 hover:bg-purple-950/20 text-right cursor-pointer transition-colors"
                    title={`คลิกเพื่อดูใบแจ้งหนี้ กฟภ. รอบ ${c.periodLabel}`}
                  >
                    <div className="font-sans font-bold text-slate-200 text-left truncate flex flex-col">
                      <span className="flex items-center gap-1 text-slate-200 text-[11px]">
                        <span className="text-purple-400 text-[10px]">📄</span>
                        {c.monthLabel.split(' ')[0]} {c.year + 543}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono pl-3">{c.periodLabel}</span>
                    </div>
                    <span className="text-amber-300 font-bold">{c.imp.toFixed(2)}</span>
                    <span className="text-rose-400 font-bold">{formatBaht(c.importBill)}</span>
                    <span className="text-emerald-400 font-bold">{formatBaht(c.savedBaht)}</span>
                  </div>
                ))
              ) : (
                <div className="text-center text-xs text-slate-500 py-2">ไม่มีข้อมูลรอบบิล</div>
              )}
            </div>
            <div className="grid grid-cols-4 items-center text-[10px] sm:text-xs font-bold pt-2 border-t border-slate-800 font-mono text-right">
              <span className="text-slate-300 font-sans text-left">รวม 7 รอบบิล:</span>
              <span className="text-amber-300">
                {billingCycles.reduce((acc, c) => acc + c.imp, 0).toFixed(2)}
              </span>
              <span className="text-rose-400">
                {formatBaht(billingCycles.reduce((acc, c) => acc + c.importBill, 0))}
              </span>
              <span className="text-emerald-400">
                {formatBaht(billingCycles.reduce((acc, c) => acc + c.savedBaht, 0))}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono pt-1 text-center">
              * รวม: ฐานขั้นบันได + Ft ฿{tariffSettings.ftRate ?? DEFAULT_FT_RATE}/หน่วย (รอบ ก.ย.-ธ.ค.) + บริการ ฿{tariffSettings.serviceFee ?? DEFAULT_SERVICE_FEE} + VAT {tariffSettings.vatPct ?? DEFAULT_VAT_PCT}%
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
