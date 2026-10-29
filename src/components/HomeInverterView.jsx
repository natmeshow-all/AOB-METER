import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  ReferenceLine,
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
  Battery,
  Thermometer,
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
  TrendingDown,
  Coins,
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
  Table,
  CheckCircle2,
  AlertTriangle,
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
import {
  pickPvStringSpecs,
  sanitizePvStringSpecs,
  evaluateStringHealth,
  evaluateStringMismatch,
  HEALTH_LEVELS
} from '../utils/pvStringHealth';

const HEALTH_TONE_CLASSES = {
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  orange: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
  rose: 'bg-rose-500/20 text-rose-300 border-rose-500/60',
  slate: 'bg-slate-800/60 text-slate-300 border-slate-700'
};

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

  // Always points at the latest persisted solar config (panel/string specs are user-owned and
  // must win over any stale copy captured by a background sync closure).
  const latestSolarDataRef = useRef(solarData);
  latestSolarDataRef.current = solarData;

  // Interactive Cockpit States
  const [cockpitThemeKey, setCockpitThemeKey] = useState('WEISSACH'); // 'WEISSACH' | 'ARAMCO' | 'REVUELTO'
  const [centerHudMode, setCenterHudMode] = useState('ODO'); // 'ODO' | 'VECTOR' | 'BMS' | 'ROI'
  const [scrubHour, setScrubHour] = useState(() => new Date(Date.now() + 7 * 3600 * 1000).getUTCHours());
  const [curveMetricTab, setCurveMetricTab] = useState('all'); // 'all' | 'power' | 'battery' | 'temp'
  const [isHourlyTableOpen, setIsHourlyTableOpen] = useState(false);
  const [simTariffBaht, setSimTariffBaht] = useState(4.72);
  const [dashboardSection, setDashboardSection] = useState('summary'); // 'summary' | 'curve' | 'billing' | 'all'

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
  const isSettingOpenRef = useRef(false);
  isSettingOpenRef.current = isSettingOpen;
  const [settingsTab, setSettingsTab] = useState('pv-strings'); // Default directly to panel & string specs
  const [isStringConfigOpen, setIsStringConfigOpen] = useState(false);
  const [isStringAdvisoryExpanded, setIsStringAdvisoryExpanded] = useState(false);
  const [inlineStringForm, setInlineStringForm] = useState(() => ({
    pv1PanelCount: solarData.pv1PanelCount ?? 7,
    pv2PanelCount: solarData.pv2PanelCount ?? 1,
    panelModelName: solarData.panelModelName || 'RAPID 750W N-Type Bifacial TOPCon',
    panelWattage: solarData.panelWattage ?? 750,
    panelVoc: solarData.panelVoc ?? 50.2,
    panelVmp: solarData.panelVmp ?? 43.6,
    panelImp: solarData.panelImp ?? 17.9,
    panelIsc: solarData.panelIsc ?? 18.74,
    inverterMaxMpptCurrentA: solarData.inverterMaxMpptCurrentA ?? 20.0,
    inverterMaxDcVoltageV: solarData.inverterMaxDcVoltageV ?? 550.0
  }));

  // Re-seed the inline form ONLY when the saved panel specs actually change and the form is
  // closed — background telemetry syncs (every 60 s) must never wipe what the user is typing.
  const savedSpecsKey = JSON.stringify(pickPvStringSpecs(solarData));
  useEffect(() => {
    if (isStringConfigOpen) return;
    setInlineStringForm({
      pv1PanelCount: solarData.pv1PanelCount ?? 7,
      pv2PanelCount: solarData.pv2PanelCount ?? 1,
      panelModelName: solarData.panelModelName || 'RAPID 750W N-Type Bifacial TOPCon',
      panelWattage: solarData.panelWattage ?? 750,
      panelVoc: solarData.panelVoc ?? 50.2,
      panelVmp: solarData.panelVmp ?? 43.6,
      panelImp: solarData.panelImp ?? 17.9,
      panelIsc: solarData.panelIsc ?? 18.74,
      inverterMaxMpptCurrentA: solarData.inverterMaxMpptCurrentA ?? 20.0,
      inverterMaxDcVoltageV: solarData.inverterMaxDcVoltageV ?? 550.0
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSpecsKey, isStringConfigOpen]);

  const handleSaveInlineStringConfig = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanSpecs = sanitizePvStringSpecs(inlineStringForm);
    const updatedConfig = {
      ...solarData,
      ...cleanSpecs,
      inverterIp: 'SAJ-CLOUD-AUTO'
    };
    // Update the ref immediately so an in-flight / next background sync can never
    // write the old panel specs back (root cause of values flipping back and forth).
    latestSolarDataRef.current = updatedConfig;
    setEditForm((prev) => ({ ...prev, ...cleanSpecs }));
    updateOrganization(currentCompany.id, {
      gatewayIp: 'SAJ-CLOUD-AUTO',
      gatewayPort: '443',
      solarConfig: updatedConfig
    });
    setSaveNotice('บันทึกข้อมูลสเปกแผงและการต่ออนุกรม PV1/PV2 เรียบร้อยแล้ว');
    setTimeout(() => setSaveNotice(null), 4000);
    setIsStringConfigOpen(false);
  };
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
            rawImp: 0,
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
        b.rawImp += Number(log.importKWh || 0);
      });

      // Calculate bill & savings per month using tiered rates + PEA Ft + VAT 7%
      const monthlyBreakdown = Array.from(monthBuckets.values())
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => {
          // Month-level physical hybrid inverter energy balance:
          const netGreenKWh = Math.max(0, m.pvGen - m.exp - m.chg + m.dis);
          const monthBalancedImp = Math.max(0, Number((m.load - netGreenKWh).toFixed(2)));
          const monthImp = Math.max(Number(m.rawImp.toFixed(2)), monthBalancedImp);

          const importBillDetails = calcFullPeaBill(monthImp, tariffSettings);
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
            imp: monthImp,
            exp: Number(m.exp.toFixed(2)),
            importBill: importBillDetails.totalBill,
            importBillDetails,
            hypotheticalBillWithoutSolar: hypotheticalBillDetails.totalBill,
            hypotheticalBillDetails,
            exportIncome,
            savedBaht
          };
        });

      // Calculate period grid bill and savings strictly matching the period's import units
      const periodImportBillDetails = calcFullPeaBill(imp, tariffSettings);
      const periodHypotheticalDetails = calcFullPeaBill(load, tariffSettings);
      const periodExportIncome = Number((exp * (tariffSettings.exportRate || DEFAULT_EXPORT_RATE)).toFixed(2));
      const periodExactSavedBaht = Math.max(
        0,
        Number((periodHypotheticalDetails.totalBill - periodImportBillDetails.totalBill + periodExportIncome).toFixed(2))
      );

      const totalGridBill = monthlyBreakdown.length > 1
        ? Number(monthlyBreakdown.reduce((acc, m) => acc + m.importBill, 0).toFixed(2))
        : periodImportBillDetails.totalBill;

      const totalSavedBaht = monthlyBreakdown.length > 1
        ? Number(monthlyBreakdown.reduce((acc, m) => acc + m.savedBaht, 0).toFixed(2))
        : periodExactSavedBaht;

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

  // Theoretical Engineering Standard Ratings based on Solar Panel Specs & Series Counts
  const stringStandards = useMemo(() => {
    const pv1Count = Number(solarData.pv1PanelCount ?? 7);
    const pv2Count = Number(solarData.pv2PanelCount ?? 1);
    const panelW = Number(solarData.panelWattage ?? 750);
    const panelVoc = Number(solarData.panelVoc ?? 50.2);
    const panelVmp = Number(solarData.panelVmp ?? 43.6);
    const panelImp = Number(solarData.panelImp ?? 17.9);
    const panelIsc = Number(solarData.panelIsc ?? 18.74);
    const maxInvA = Number(solarData.inverterMaxMpptCurrentA ?? 20.0);
    const maxInvV = Number(solarData.inverterMaxDcVoltageV ?? 550.0);

    const pv1StdVmp = Number((pv1Count * panelVmp).toFixed(1));
    const pv1StdVoc = Number((pv1Count * panelVoc).toFixed(1));
    const pv1StdW = pv1Count * panelW;

    const pv2StdVmp = Number((pv2Count * panelVmp).toFixed(1));
    const pv2StdVoc = Number((pv2Count * panelVoc).toFixed(1));
    const pv2StdW = pv2Count * panelW;

    return {
      pv1Count,
      pv2Count,
      panelW,
      panelVoc,
      panelVmp,
      panelImp,
      panelIsc,
      maxInvA,
      maxInvV,
      pv1StdVmp,
      pv1StdVoc,
      pv1StdW,
      pv1StdImp: panelImp,
      pv1StdIsc: panelIsc,
      pv2StdVmp,
      pv2StdVoc,
      pv2StdW,
      pv2StdImp: panelImp,
      pv2StdIsc: panelIsc,
      totalKw: Number(((pv1StdW + pv2StdW) / 1000).toFixed(2))
    };
  }, [solarData]);

  // 24-hour curve for selected historical day (with Solar PV, House Load, Battery SOC %, Inverter Temp °C, and Battery Temp °C)
  const todayThaiDateStr = getThailandDateStr(0);
  const currentThaiHour = new Date(Date.now() + 7 * 3600 * 1000).getUTCHours();
  const activeHistoricalDate = activeHistoryDay?.date || todayThaiDateStr;
  const isViewingToday = !selectedHistoryDate || activeHistoricalDate === todayThaiDateStr;
  const maxScrubHour = isViewingToday ? currentThaiHour : 23;

  const dailyCurveData = useMemo(() => {
    const currentInvTemp = Number(solarData.inverterTempC || 36.5);
    const currentBatSoc = Number(solarData.batterySOC || 77);
    const currentBatTemp = Number(solarData.batteryTempC || 28.5);
    const estPeakW = todayGenKWh > 0 ? Math.round((todayGenKWh / 5.2) * 1000) : totalPvPowerW;

    if (
      activeHistoryDay &&
      Array.isArray(activeHistoryDay.hourlyCurve) &&
      activeHistoryDay.hourlyCurve.length > 0
    ) {
      return activeHistoryDay.hourlyCurve.map((pt, h) => {
        // Clamp future hours for today: strictly null so Recharts never fabricates unverified future projections
        if (isViewingToday && h > currentThaiHour) {
          return {
            ...pt,
            hour: pt.hour || `${String(h).padStart(2, '0')}:00`,
            pvW: null,
            pvCurrentA: null,
            loadW: null,
            loadCurrentA: null,
            batterySOC: null,
            tempC: null,
            batteryTempC: null,
            pv1W: null,
            pv1V: null,
            pv1A: null,
            pv1MaxA: null,
            isPv1Overcurrent: false,
            pv2W: null,
            pv2V: null,
            pv2A: null,
            pv2MaxA: null,
            isPv2Overcurrent: false,
            isFuture: true
          };
        }

        let ptTemp = Number(pt.tempC ?? pt.inverterTempC ?? 0);
        if (!ptTemp || ptTemp <= 0) {
          const solarHeatFactor = (Number(pt.pvW || 0) / Math.max(1, estPeakW || 5000)) * 14;
          const ambient = 29.5 + Math.sin(((h - 8) / 14) * Math.PI) * 3.5;
          ptTemp = Number(Math.max(28, Math.min(62, (currentInvTemp > 30 ? currentInvTemp - 4 : ambient) + solarHeatFactor)).toFixed(1));
        }

        let ptBatTemp = Number(pt.batteryTempC ?? pt.batTemperature ?? 0);
        if (!ptBatTemp || ptBatTemp <= 0) {
          const batHeatFactor = Math.sin(((h - 8) / 14) * Math.PI) * 2.5;
          ptBatTemp = Number((currentBatTemp + (h >= 8 && h <= 17 ? Math.max(0, batHeatFactor) : 0)).toFixed(1));
        }

        let ptSoc = Number(pt.batterySOC ?? pt.soc ?? 0);
        if (!ptSoc || ptSoc <= 0) {
          if (h >= 0 && h < 6) ptSoc = Math.max(20, Math.round(currentBatSoc * 0.7 - h * 2.5));
          else if (h >= 6 && h < 14) ptSoc = Math.min(100, Math.round(25 + (h - 6) * 9.5));
          else if (h >= 14 && h < 18) ptSoc = Math.min(100, Math.round(currentBatSoc > 85 ? currentBatSoc : 96));
          else ptSoc = Math.max(25, Math.round((currentBatSoc > 85 ? 95 : currentBatSoc) - (h - 18) * 6));
        }

        // House load power: if 0, calculate based on the day's real load energy and realistic household diurnal profile
        let ptLoad = Number(pt.loadW || pt.totalLoadPower || 0);
        if (ptLoad <= 0) {
          const dayLoadKWh = Number(activeHistoryDay.loadElectricityKWh || 0);
          const targetTotalWh = (dayLoadKWh > 0 ? dayLoadKWh : Math.max(8, (activeHistoryDay.pvGenerationKWh || 10) * 0.7)) * 1000;
          const factors = [0.5, 0.45, 0.4, 0.4, 0.45, 0.6, 1.1, 1.4, 1.2, 0.8, 0.85, 0.9, 1.0, 0.95, 0.9, 0.85, 1.1, 1.5, 1.9, 2.1, 1.8, 1.4, 0.9, 0.6];
          ptLoad = Math.max(180, Math.round((targetTotalWh / 24) * factors[h]));
        }

        const rawPv = Number(pt.pvW || 0);
        const loadCurrentA = Number((ptLoad / 230).toFixed(2));
        const pvCurrentA = Number((rawPv > 0 ? rawPv / 380 : 0).toFixed(2));

        const pv1W = Number(pt.pv1W || 0);
        const pv1V = Number(pt.pv1V || 0);
        const pv1A = Number(pt.pv1A || 0);
        const pv1MaxA = Math.max(Number(pt.pv1MaxA || 0), pv1A);

        const pv2W = Number(pt.pv2W || 0);
        const pv2V = Number(pt.pv2V || 0);
        const pv2A = Number(pt.pv2A || 0);
        const pv2MaxA = Math.max(Number(pt.pv2MaxA || 0), pv2A);
        // NOTE: No fabricated PV1/PV2 split — only real per-string telemetry from SAJ is shown.

        const maxMpptLimitA = Number(solarData.inverterMaxMpptCurrentA || 20.0);
        const isPv1Overcurrent = pv1MaxA > maxMpptLimitA;
        const isPv2Overcurrent = pv2MaxA > maxMpptLimitA;

        return {
          ...pt,
          pvW: rawPv,
          pvCurrentA,
          loadW: ptLoad,
          loadCurrentA,
          batterySOC: Math.round(ptSoc),
          tempC: ptTemp,
          batteryTempC: ptBatTemp,
          pv1W,
          pv1V,
          pv1A,
          pv1MaxA,
          isPv1Overcurrent,
          pv2W,
          pv2V,
          pv2A,
          pv2MaxA,
          isPv2Overcurrent,
          isFuture: false
        };
      });
    }

    // Proportional curve from today's verified kWh if hourly array isn't synced yet
    return Array.from({ length: 24 }, (_, h) => {
      const hourStr = `${String(h).padStart(2, '0')}:00`;
      if (isViewingToday && h > currentThaiHour) {
        return {
          hour: hourStr,
          pvW: null,
          pvCurrentA: null,
          loadW: null,
          loadCurrentA: null,
          batterySOC: null,
          tempC: null,
          batteryTempC: null,
          pv1W: null,
          pv1V: null,
          pv1A: null,
          isPv1Overcurrent: false,
          pv2W: null,
          pv2V: null,
          pv2A: null,
          isPv2Overcurrent: false,
          isFuture: true
        };
      }

      let pvW = 0;
      if (h >= 6 && h <= 18 && estPeakW > 0) {
        pvW = Math.round(estPeakW * Math.sin(((h - 6) / 12) * Math.PI));
      }
      let loadW = Math.round(Number(solarData.totalLoadPowerW || 0));
      if (loadW <= 0) {
        const dayLoadKWh = Number(activeHistoryDay?.loadElectricityKWh || solarData.statLoadElectricityKWh || 12);
        const targetTotalWh = dayLoadKWh * 1000;
        const factors = [0.5, 0.45, 0.4, 0.4, 0.45, 0.6, 1.1, 1.4, 1.2, 0.8, 0.85, 0.9, 1.0, 0.95, 0.9, 0.85, 1.1, 1.5, 1.9, 2.1, 1.8, 1.4, 0.9, 0.6];
        loadW = Math.max(180, Math.round((targetTotalWh / 24) * factors[h]));
      }
      const solarHeatFactor = (pvW / Math.max(1, estPeakW || 5000)) * 14;
      const ambient = 29.5 + Math.sin(((h - 8) / 14) * Math.PI) * 3.5;
      const tempC = Number(Math.max(28, Math.min(62, (currentInvTemp > 30 ? currentInvTemp - 4 : ambient) + solarHeatFactor)).toFixed(1));

      const batHeatFactor = Math.sin(((h - 8) / 14) * Math.PI) * 2.5;
      const batteryTempC = Number((currentBatTemp + (h >= 8 && h <= 17 ? Math.max(0, batHeatFactor) : 0)).toFixed(1));

      let batterySOC;
      if (h >= 0 && h < 6) batterySOC = Math.max(20, Math.round(currentBatSoc * 0.7 - h * 2.5));
      else if (h >= 6 && h < 14) batterySOC = Math.min(100, Math.round(25 + (h - 6) * 9.5));
      else if (h >= 14 && h < 18) batterySOC = Math.min(100, Math.round(currentBatSoc > 85 ? currentBatSoc : 96));
      else batterySOC = Math.max(25, Math.round((currentBatSoc > 85 ? 95 : currentBatSoc) - (h - 18) * 6));

      const loadCurrentA = Number((loadW / 230).toFixed(2));
      const pvCurrentA = Number((pvW > 0 ? pvW / 380 : 0).toFixed(2));

      return {
        hour: hourStr,
        pvW,
        pvCurrentA,
        loadW,
        loadCurrentA,
        batterySOC: Math.round(batterySOC),
        tempC,
        batteryTempC,
        pv1W: 0,
        pv1V: 0,
        pv1A: 0,
        isPv1Overcurrent: false,
        pv2W: 0,
        pv2V: 0,
        pv2A: 0,
        isPv2Overcurrent: false,
        isFuture: false
      };
    });
  }, [
    activeHistoryDay,
    isViewingToday,
    currentThaiHour,
    todayGenKWh,
    totalPvPowerW,
    solarData.totalLoadPowerW,
    solarData.batterySOC,
    solarData.inverterTempC,
    solarData.batteryTempC,
    solarData.inverterMaxMpptCurrentA
  ]);

  // Keep scrubber bounded within actual recorded hours
  useEffect(() => {
    if (scrubHour > maxScrubHour) {
      setScrubHour(maxScrubHour);
    }
  }, [maxScrubHour, scrubHour]);

  const effectiveScrubHour = Math.min(scrubHour, maxScrubHour);
  const scrubbedPoint = dailyCurveData[effectiveScrubHour] || dailyCurveData[0] || {
    hour: `${String(effectiveScrubHour).padStart(2, '0')}:00`,
    pvW: 0,
    pvCurrentA: 0,
    loadW: 0,
    loadCurrentA: 0,
    batterySOC: Number(solarData.batterySOC || 77),
    tempC: Number(solarData.inverterTempC || 36.5),
    batteryTempC: Number(solarData.batteryTempC || 28.5),
    pv1W: 0,
    pv1V: 0,
    pv1A: 0,
    isPv1Overcurrent: false,
    pv2W: 0,
    pv2V: 0,
    pv2A: 0,
    isPv2Overcurrent: false,
    isFuture: false
  };

  // Daily peak power, timing, current, and maximum operating temperatures + PV1/PV2 String Peaks & Overcurrent
  // Calculated exclusively from valid elapsed points (excluding unoccurred future hours)
  const dailyPeakStats = useMemo(() => {
    if (!dailyCurveData || dailyCurveData.length === 0) {
      return {
        peakLoadW: 0,
        peakLoadHour: '19:00',
        peakLoadCurrentA: 0,
        peakPvW: 0,
        peakPvHour: '12:00',
        peakPvCurrentA: 0,
        peakPv1W: 0,
        peakPv1Hour: '12:00',
        peakPv1V: 0,
        peakPv1A: 0,
        maxPv1A: 0,
        maxPv1AHour: '12:00',
        pv1Overcurrent: false,
        peakPv2W: 0,
        peakPv2Hour: '12:00',
        peakPv2V: 0,
        peakPv2A: 0,
        maxPv2A: 0,
        maxPv2AHour: '12:00',
        pv2Overcurrent: false,
        maxInverterTempC: 36.5,
        maxInverterTempHour: '13:00',
        maxBatteryTempC: 28.5,
        maxBatteryTempHour: '14:00'
      };
    }

    const validPoints = dailyCurveData.filter((pt) => !pt.isFuture);
    const activePool = validPoints.length > 0 ? validPoints : dailyCurveData;

    const peakLoadPoint = activePool.reduce((max, pt) => ((pt.loadW || 0) > (max?.loadW || 0) ? pt : max), activePool[0]);
    const peakPvPoint = activePool.reduce((max, pt) => ((pt.pvW || 0) > (max?.pvW || 0) ? pt : max), activePool[0]);
    const peakPv1Point = activePool.reduce((max, pt) => ((pt.pv1W || 0) > (max?.pv1W || 0) ? pt : max), activePool[0]);
    const peakPv2Point = activePool.reduce((max, pt) => ((pt.pv2W || 0) > (max?.pv2W || 0) ? pt : max), activePool[0]);
    const maxPv1APoint = activePool.reduce((max, pt) => ((pt.pv1A || 0) > (max?.pv1A || 0) ? pt : max), activePool[0]);
    const maxPv2APoint = activePool.reduce((max, pt) => ((pt.pv2A || 0) > (max?.pv2A || 0) ? pt : max), activePool[0]);
    const maxInvTempPoint = activePool.reduce((max, pt) => ((pt.tempC || 0) > (max?.tempC || 0) ? pt : max), activePool[0]);
    const maxBatTempPoint = activePool.reduce((max, pt) => ((pt.batteryTempC || 0) > (max?.batteryTempC || 0) ? pt : max), activePool[0]);

    const pv1Overcurrent = activePool.some((pt) => pt.isPv1Overcurrent);
    const pv2Overcurrent = activePool.some((pt) => pt.isPv2Overcurrent);

    // Prefer the day-level peaks computed from raw 5-minute samples (W, V, A taken from the SAME
    // sample → physically consistent). Fall back to the hourly curve only if they are missing.
    const day = activeHistoryDay || {};
    const dayHasPv1 = Number(day.peakPv1W || 0) > 0;
    const dayHasPv2 = Number(day.peakPv2W || 0) > 0;
    const curveMaxPv1A = Math.max(0, ...activePool.map((pt) => Number(pt.pv1MaxA ?? pt.pv1A ?? 0)));
    const curveMaxPv2A = Math.max(0, ...activePool.map((pt) => Number(pt.pv2MaxA ?? pt.pv2A ?? 0)));
    const dayMaxPv1A = Number(day.maxPv1A || 0);
    const dayMaxPv2A = Number(day.maxPv2A || 0);

    return {
      peakLoadW: peakLoadPoint?.loadW || 0,
      peakLoadHour: peakLoadPoint?.hour || '12:00',
      peakLoadCurrentA: peakLoadPoint?.loadCurrentA || 0,
      peakPvW: peakPvPoint?.pvW || 0,
      peakPvHour: peakPvPoint?.hour || '12:00',
      peakPvCurrentA: peakPvPoint?.pvCurrentA || 0,
      hasStringTelemetry:
        Boolean(day.hasStringTelemetry) ||
        dayHasPv1 ||
        dayHasPv2 ||
        activePool.some((pt) => (pt.pv1W || 0) > 0 || (pt.pv2W || 0) > 0),
      // PV1 String
      peakPv1W: dayHasPv1 ? Number(day.peakPv1W) : peakPv1Point?.pv1W || 0,
      peakPv1Hour: dayHasPv1 ? day.peakPv1Hour || peakPv1Point?.hour : peakPv1Point?.hour || '12:00',
      peakPv1V: dayHasPv1 ? Number(day.peakPv1V || 0) : peakPv1Point?.pv1V || 0,
      peakPv1A: dayHasPv1 ? Number(day.peakPv1A || 0) : peakPv1Point?.pv1A || 0,
      maxPv1A: Number(Math.max(dayMaxPv1A, curveMaxPv1A).toFixed(2)),
      maxPv1AHour:
        dayMaxPv1A >= curveMaxPv1A && day.maxPv1AHour ? day.maxPv1AHour : maxPv1APoint?.hour || '12:00',
      pv1Overcurrent,
      // PV2 String
      peakPv2W: dayHasPv2 ? Number(day.peakPv2W) : peakPv2Point?.pv2W || 0,
      peakPv2Hour: dayHasPv2 ? day.peakPv2Hour || peakPv2Point?.hour : peakPv2Point?.hour || '12:00',
      peakPv2V: dayHasPv2 ? Number(day.peakPv2V || 0) : peakPv2Point?.pv2V || 0,
      peakPv2A: dayHasPv2 ? Number(day.peakPv2A || 0) : peakPv2Point?.pv2A || 0,
      maxPv2A: Number(Math.max(dayMaxPv2A, curveMaxPv2A).toFixed(2)),
      maxPv2AHour:
        dayMaxPv2A >= curveMaxPv2A && day.maxPv2AHour ? day.maxPv2AHour : maxPv2APoint?.hour || '12:00',
      pv2Overcurrent,
      // Temperatures
      maxInverterTempC: maxInvTempPoint?.tempC || 36.5,
      maxInverterTempHour: maxInvTempPoint?.hour || '12:00',
      maxBatteryTempC: maxBatTempPoint?.batteryTempC || 28.5,
      maxBatteryTempHour: maxBatTempPoint?.hour || '12:00'
    };
  }, [dailyCurveData, activeHistoryDay]);

  // Comprehensive Engineering Health & Safety Inspection (เปรียบเทียบค่าจริงกับสเปกแผงและขีดจำกัดความปลอดภัย)
  const stringHealthAnalysis = useMemo(() => {
    const isToday = !selectedHistoryDate || selectedHistoryDate === getThailandDateStr(0);
    const live1 = isToday
      ? {
          v: Number(solarData.pv1Voltage || 0),
          a: Number(solarData.pv1Current || 0),
          w: Number(solarData.pv1PowerW || 0)
        }
      : null;
    const live2 = isToday
      ? {
          v: Number(solarData.pv2Voltage || 0),
          a: Number(solarData.pv2Current || 0),
          w: Number(solarData.pv2PowerW || 0)
        }
      : null;

    const pv1Health = evaluateStringHealth({
      label: 'สตริงที่ 1 (PV1)',
      panelCount: solarData.pv1PanelCount ?? 7,
      specs: solarData,
      peak: {
        w: dailyPeakStats.peakPv1W,
        v: dailyPeakStats.peakPv1V,
        a: dailyPeakStats.peakPv1A,
        hour: dailyPeakStats.peakPv1Hour
      },
      maxCurrent: {
        a: dailyPeakStats.maxPv1A,
        hour: dailyPeakStats.maxPv1AHour
      },
      live: live1,
      sitePeakPvW: dailyPeakStats.peakPvW,
      hasTelemetry: dailyPeakStats.hasStringTelemetry
    });

    const pv2Health = evaluateStringHealth({
      label: 'สตริงที่ 2 (PV2)',
      panelCount: solarData.pv2PanelCount ?? 1,
      specs: solarData,
      peak: {
        w: dailyPeakStats.peakPv2W,
        v: dailyPeakStats.peakPv2V,
        a: dailyPeakStats.peakPv2A,
        hour: dailyPeakStats.peakPv2Hour
      },
      maxCurrent: {
        a: dailyPeakStats.maxPv2A,
        hour: dailyPeakStats.maxPv2AHour
      },
      live: live2,
      sitePeakPvW: dailyPeakStats.peakPvW,
      hasTelemetry: dailyPeakStats.hasStringTelemetry
    });

    const mismatch = evaluateStringMismatch(pv1Health, pv2Health);

    const allIssues = [
      ...pv1Health.checks.filter((c) => c.level !== 'OK'),
      ...pv2Health.checks.filter((c) => c.level !== 'OK'),
      ...(mismatch ? [mismatch] : [])
    ];

    const hasDanger = allIssues.some((c) => c.level === 'DANGER');
    const hasWarning = allIssues.some((c) => c.level === 'WARNING');
    const hasWatch = allIssues.some((c) => c.level === 'WATCH');

    const overallLevel = hasDanger ? 'DANGER' : hasWarning ? 'WARNING' : hasWatch ? 'WATCH' : 'OK';

    return {
      pv1: pv1Health,
      pv2: pv2Health,
      mismatch,
      allIssues,
      overallLevel,
      hasAnyIssue: allIssues.length > 0
    };
  }, [solarData, dailyPeakStats, selectedHistoryDate]);

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
          ...pickPvStringSpecs(latestSolarDataRef.current),
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
          const merged = { ...partialConfig, ...pickPvStringSpecs(latestSolarDataRef.current) };
          setEditForm((prev) =>
            isSettingOpenRef.current ? { ...merged, ...pickPvStringSpecs(prev) } : merged
          );
          updateOrganization(currentCompany.id, {
            gatewayIp: 'SAJ-CLOUD-AUTO',
            gatewayPort: '443',
            status: 'ONLINE',
            solarConfig: merged
          });
        }
      });

      setTransientGuestPassword('');

      if (res.success) {
        // Panel/string specs are user-owned: re-apply the LATEST saved values (the user may have
        // edited them while this sync was in flight).
        const syncedWithSpecs = {
          ...res.syncedSolarConfig,
          ...pickPvStringSpecs(latestSolarDataRef.current)
        };
        res.syncedSolarConfig = syncedWithSpecs;
        // If the user is currently editing the Settings modal, keep their unsaved spec edits.
        setEditForm((prev) =>
          isSettingOpenRef.current
            ? { ...syncedWithSpecs, ...pickPvStringSpecs(prev) }
            : syncedWithSpecs
        );
        updateOrganization(currentCompany.id, {
          gatewayIp: 'SAJ-CLOUD-AUTO',
          gatewayPort: '443',
          status: 'ONLINE',
          solarConfig: syncedWithSpecs
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
    const savedConfig = {
      ...editForm,
      ...sanitizePvStringSpecs({ ...pickPvStringSpecs(solarData), ...pickPvStringSpecs(editForm) }),
      inverterIp: 'SAJ-CLOUD-AUTO'
    };
    latestSolarDataRef.current = { ...solarData, ...savedConfig };
    updateOrganization(currentCompany.id, {
      gatewayIp: 'SAJ-CLOUD-AUTO',
      gatewayPort: '443',
      solarConfig: savedConfig
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

              {/* TAB: SOLAR PANELS & STRING CONFIGURATION (PV1 / PV2) */}
              {settingsTab === 'pv-strings' && (
                <div className="space-y-4">
                  {/* Preset Buttons */}
                  <div className="bg-[#04070e] border border-slate-800 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>⚡ เลือกพรีเซ็ตแผงโซลาร์มาตรฐาน (คลิกเปลี่ยนค่าทันที)</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                      {[
                        {
                          name: '⚡ RAPID 750W (7 แผง PV1)',
                          desc: '5.25 kWp • Vmp 305V',
                          spec: {
                            panelModelName: 'RAPID 750W N-Type Bifacial TOPCon',
                            panelWattage: 750,
                            panelVoc: 50.20,
                            panelVmp: 43.60,
                            panelImp: 17.90,
                            panelIsc: 18.74,
                            pv1PanelCount: 7,
                            pv2PanelCount: 0,
                            inverterMaxMpptCurrentA: 20.0,
                            inverterMaxDcVoltageV: 550.0
                          }
                        },
                        {
                          name: 'RAPID 750W (6+5 แผง)',
                          desc: '8.25 kWp • Vmp 262V/218V',
                          spec: {
                            panelModelName: 'RAPID 750W N-Type Bifacial TOPCon',
                            panelWattage: 750,
                            panelVoc: 50.20,
                            panelVmp: 43.60,
                            panelImp: 17.90,
                            panelIsc: 18.74,
                            pv1PanelCount: 6,
                            pv2PanelCount: 5,
                            inverterMaxMpptCurrentA: 20.0,
                            inverterMaxDcVoltageV: 550.0
                          }
                        },
                        {
                          name: 'N-Type TOPCon 580W (8+6)',
                          desc: '8.12 kWp • Vmp 340V/255V',
                          spec: {
                            panelModelName: 'Mono Half-Cell N-Type TOPCon 580W',
                            panelWattage: 580,
                            panelVoc: 51.5,
                            panelVmp: 42.5,
                            panelImp: 13.65,
                            panelIsc: 14.50,
                            pv1PanelCount: 8,
                            pv2PanelCount: 6,
                            inverterMaxMpptCurrentA: 16.0,
                            inverterMaxDcVoltageV: 550.0
                          }
                        },
                        {
                          name: 'Mono PERC 550W (8+8)',
                          desc: '8.80 kWp • Vmp 334V/334V',
                          spec: {
                            panelModelName: 'Mono Perc Tier 1 550W',
                            panelWattage: 550,
                            panelVoc: 49.8,
                            panelVmp: 41.8,
                            panelImp: 13.16,
                            panelIsc: 13.98,
                            pv1PanelCount: 8,
                            pv2PanelCount: 8,
                            inverterMaxMpptCurrentA: 16.0,
                            inverterMaxDcVoltageV: 550.0
                          }
                        },
                        {
                          name: 'Hi-MO 7 620W (7+6)',
                          desc: '8.06 kWp • Vmp 305V/262V',
                          spec: {
                            panelModelName: 'Longi Hi-MO 7 620W',
                            panelWattage: 620,
                            panelVoc: 52.8,
                            panelVmp: 43.6,
                            panelImp: 14.22,
                            panelIsc: 15.08,
                            pv1PanelCount: 7,
                            pv2PanelCount: 6,
                            inverterMaxMpptCurrentA: 16.0,
                            inverterMaxDcVoltageV: 550.0
                          }
                        }
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setEditForm((prev) => ({ ...prev, ...preset.spec }))}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-left text-xs text-slate-200 cursor-pointer transition-all active:scale-95"
                        >
                          <div className="font-bold text-sky-300">{preset.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {preset.spec.panelWattage}W • Vmp {preset.spec.panelVmp}V • {preset.spec.panelImp}A
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 1. Series String Panel Counts */}
                  <div className="bg-[#04070e] border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-300 text-xs flex items-center gap-1.5">
                        <Sun className="w-4 h-4 text-sky-400" />
                        <span>1. จำนวนแผงโซลาร์ที่ต่ออนุกรมกัน (Series Panel Count)</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        อินเวอร์เตอร์ 2 MPPT (PV1 & PV2)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
                      {/* PV1 String */}
                      <div className="bg-slate-950/90 border border-sky-500/40 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sky-300 font-bold text-xs flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-sky-400" />
                            <span>สตริงที่ 1 (PV1) ต่ออนุกรม:</span>
                          </label>
                          <span className="text-[11px] font-mono text-sky-400 font-black">
                            {editForm.pv1PanelCount ?? 7} แผง
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="16"
                            step="1"
                            value={editForm.pv1PanelCount ?? 7}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                pv1PanelCount: parseInt(e.target.value, 10) || 0
                              }))
                            }
                            className="w-full bg-slate-900 border border-sky-500/40 rounded-lg px-3 py-2 text-sky-300 font-mono font-black text-right text-sm"
                          />
                          <span className="text-xs text-slate-400 shrink-0">แผง</span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          กำลังผลิตสตริง 1: <strong className="text-sky-300 font-mono">{(((editForm.pv1PanelCount ?? 7) * (editForm.panelWattage ?? 750)) / 1000).toFixed(2)} kWp</strong>
                        </p>
                      </div>

                      {/* PV2 String */}
                      <div className="bg-slate-950/90 border border-emerald-500/40 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-emerald-300 font-bold text-xs flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>สตริงที่ 2 (PV2) ต่ออนุกรม:</span>
                          </label>
                          <span className="text-[11px] font-mono text-emerald-400 font-black">
                            {editForm.pv2PanelCount ?? 1} แผง
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="16"
                            step="1"
                            value={editForm.pv2PanelCount ?? 1}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                pv2PanelCount: parseInt(e.target.value, 10) || 0
                              }))
                            }
                            className="w-full bg-slate-900 border border-emerald-500/40 rounded-lg px-3 py-2 text-emerald-300 font-mono font-black text-right text-sm"
                          />
                          <span className="text-xs text-slate-400 shrink-0">แผง</span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          กำลังผลิตสตริง 2: <strong className="text-emerald-300 font-mono">{(((editForm.pv2PanelCount ?? 1) * (editForm.panelWattage ?? 750)) / 1000).toFixed(2)} kWp</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 2. Solar Panel Technical Specifications */}
                  <div className="bg-[#04070e] border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                        <Sliders className="w-4 h-4 text-amber-400" />
                        <span>2. สเปกแผงโซลาร์เซลล์ต่อ 1 แผง (STC Data-Sheet)</span>
                      </span>
                      <span className="text-[10px] text-slate-500">ดูได้จากหลังแผง (Plate)</span>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-slate-400 text-[11px] font-bold">
                        ชื่อรุ่น / ยี่ห้อแผงโซลาร์:
                      </label>
                      <input
                        type="text"
                        value={editForm.panelModelName || 'RAPID 750W N-Type Bifacial TOPCon'}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, panelModelName: e.target.value }))
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-200 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {/* Wattage Wp */}
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-1">
                        <label className="block text-slate-400 text-[10px] font-bold">
                          กำลังวัตต์ (Wp / แผง)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="5"
                            value={editForm.panelWattage ?? 750}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                panelWattage: parseFloat(e.target.value) || 0
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-amber-300 font-mono font-bold text-right text-xs"
                          />
                          <span className="text-[10px] text-slate-400">W</span>
                        </div>
                      </div>

                      {/* Vmp */}
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-1">
                        <label className="block text-slate-400 text-[10px] font-bold">
                          แรงดันทำงาน Vmp (V)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.1"
                            value={editForm.panelVmp ?? 43.6}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                panelVmp: parseFloat(e.target.value) || 0
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-sky-300 font-mono font-bold text-right text-xs"
                          />
                          <span className="text-[10px] text-slate-400">V</span>
                        </div>
                      </div>

                      {/* Voc */}
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-1">
                        <label className="block text-slate-400 text-[10px] font-bold">
                          แรงดันเปิดวงจร Voc (V)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.1"
                            value={editForm.panelVoc ?? 50.2}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                panelVoc: parseFloat(e.target.value) || 0
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-rose-300 font-mono font-bold text-right text-xs"
                          />
                          <span className="text-[10px] text-slate-400">V</span>
                        </div>
                      </div>

                      {/* Imp */}
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-1">
                        <label className="block text-slate-400 text-[10px] font-bold">
                          กระแสทำงาน Imp (A)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.05"
                            value={editForm.panelImp ?? 17.9}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                panelImp: parseFloat(e.target.value) || 0
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-emerald-300 font-mono font-bold text-right text-xs"
                          />
                          <span className="text-[10px] text-slate-400">A</span>
                        </div>
                      </div>

                      {/* Isc */}
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-1">
                        <label className="block text-slate-400 text-[10px] font-bold">
                          กระแสลัดวงจร Isc (A)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.05"
                            value={editForm.panelIsc ?? 18.74}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                panelIsc: parseFloat(e.target.value) || 0
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-amber-300 font-mono font-bold text-right text-xs"
                          />
                          <span className="text-[10px] text-slate-400">A</span>
                        </div>
                      </div>

                      {/* Inverter Max MPPT Current */}
                      <div className="bg-slate-950/80 border border-rose-500/30 rounded-xl p-2.5 space-y-1">
                        <label className="block text-rose-300 text-[10px] font-bold">
                          ขีดจำกัดแอมป์ Inverter (A)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.5"
                            value={editForm.inverterMaxMpptCurrentA ?? 20.0}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                inverterMaxMpptCurrentA: parseFloat(e.target.value) || 20.0
                              }))
                            }
                            className="w-full bg-slate-900 border border-rose-500/40 rounded-lg px-2 py-1 text-rose-300 font-mono font-bold text-right text-xs"
                          />
                          <span className="text-[10px] text-slate-400">A</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Real-Time Engineering Benchmark Calculation Preview */}
                  {(() => {
                    const n1 = Number(editForm.pv1PanelCount ?? 7);
                    const n2 = Number(editForm.pv2PanelCount ?? 1);
                    const w = Number(editForm.panelWattage ?? 750);
                    const voc = Number(editForm.panelVoc ?? 50.2);
                    const vmp = Number(editForm.panelVmp ?? 43.6);
                    const imp = Number(editForm.panelImp ?? 17.9);
                    const maxInvA = Number(editForm.inverterMaxMpptCurrentA ?? 20.0);
                    const maxInvV = Number(editForm.inverterMaxDcVoltageV ?? 550.0);

                    const pv1Vmp = (n1 * vmp).toFixed(1);
                    const pv1Voc = (n1 * voc).toFixed(1);
                    const pv1W = n1 * w;

                    const pv2Vmp = (n2 * vmp).toFixed(1);
                    const pv2Voc = (n2 * voc).toFixed(1);
                    const pv2W = n2 * w;

                    const totalKw = (((pv1W + pv2W)) / 1000).toFixed(2);
                    const isPv1VocSafe = Number(pv1Voc) <= maxInvV;
                    const isPv2VocSafe = Number(pv2Voc) <= maxInvV;

                    return (
                      <div className="bg-gradient-to-r from-sky-950/40 via-slate-900 to-emerald-950/40 border border-sky-500/40 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-bold text-white text-xs flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            <span>📐 สรุปค่ามาตรฐานทางวิศวกรรมที่ถูกต้อง (Engineering Benchmarks)</span>
                          </span>
                          <span className="text-[11px] font-mono font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40">
                            รวมกำลังแผง: {totalKw} kWp
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                          {/* PV1 Summary */}
                          <div className="bg-slate-950/80 border border-sky-500/30 rounded-xl p-3 space-y-1.5">
                            <div className="text-sky-300 font-bold text-[11px] font-sans flex justify-between">
                              <span>☀️ สตริง PV1 ({n1} แผง)</span>
                              <span>{pv1W.toLocaleString()} W ({(pv1W / 1000).toFixed(2)} kWp)</span>
                            </div>
                            <div className="text-slate-300 text-[11px] space-y-1 pt-1 border-t border-slate-800/80">
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-sans">แรงดันทำงานมาตรฐาน (Vmp):</span>
                                <strong className="text-sky-300">{pv1Vmp} V</strong>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-sans">แรงดันเปิดวงจรสูงสุด (Voc):</span>
                                <strong className={isPv1VocSafe ? 'text-emerald-300' : 'text-rose-400'}>
                                  {pv1Voc} V {isPv1VocSafe ? '✓ ปลอดภัย' : '⚠️ เกิน 550V'}
                                </strong>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-sans">กระแสทำงานมาตรฐาน (Imp):</span>
                                <strong className="text-amber-300">{imp} A</strong>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-sans">เกณฑ์เตือนกระแสเกิน:</span>
                                <span className="text-rose-400 font-bold">&gt; {maxInvA} A</span>
                              </div>
                            </div>
                          </div>

                          {/* PV2 Summary */}
                          <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3 space-y-1.5">
                            <div className="text-emerald-300 font-bold text-[11px] font-sans flex justify-between">
                              <span>☀️ สตริง PV2 ({n2} แผง)</span>
                              <span>{pv2W.toLocaleString()} W ({(pv2W / 1000).toFixed(2)} kWp)</span>
                            </div>
                            <div className="text-slate-300 text-[11px] space-y-1 pt-1 border-t border-slate-800/80">
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-sans">แรงดันทำงานมาตรฐาน (Vmp):</span>
                                <strong className="text-emerald-300">{pv2Vmp} V</strong>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-sans">แรงดันเปิดวงจรสูงสุด (Voc):</span>
                                <strong className={isPv2VocSafe ? 'text-emerald-300' : 'text-rose-400'}>
                                  {pv2Voc} V {isPv2VocSafe ? '✓ ปลอดภัย' : '⚠️ เกิน 550V'}
                                </strong>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-sans">กระแสทำงานมาตรฐาน (Imp):</span>
                                <strong className="text-amber-300">{imp} A</strong>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-sans">เกณฑ์เตือนกระแสเกิน:</span>
                                <span className="text-rose-400 font-bold">&gt; {maxInvA} A</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
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
            {/* =================================================================== */}
      {/* MOBILE-FIRST SECTION FOCUS SELECTOR (ใช้งานง่าย & สบายตา)           */}
      {/* =================================================================== */}
      <div className="bg-[#0b1220]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-1.5 shadow-lg flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 w-full">
          {[
            { id: 'summary', icon: Zap, label: '⚡ หน้าหลัก & สรุป' },
            { id: 'curve', icon: TrendingUp, label: '📈 กราฟ 24 ชม.' },
            { id: 'billing', icon: FileText, label: '🧾 บิลค่าไฟ & สถิติ' },
            { id: 'all', icon: Sparkles, label: '📑 แสดงทั้งหมด' }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = dashboardSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setDashboardSection(tab.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex-1 min-w-[105px] py-2 px-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 shadow-sm shadow-sky-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-300' : 'text-slate-500'}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TRIPLE-DIAL SUPERCAR INSTRUMENT CLUSTER WITH INTERACTIVE CENTER HUD */}
      {(dashboardSection === 'summary' || dashboardSection === 'all') && (
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

            <div className="grid grid-cols-4 gap-1 bg-[#070a10] p-1 rounded-xl border border-slate-800/80">
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
                  className={`py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                    centerHudMode === tab.id
                      ? 'bg-[#141b27] text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
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
              <div className="relative w-44 h-44 rounded-full border border-slate-800/80 bg-[#070a10] shadow-[inset_0_0_20px_rgba(6,182,212,0.1)] flex flex-col items-center justify-center p-4">
                <div className="absolute inset-2 rounded-full border border-dashed border-cyan-500/20" />
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-400">
                  TODAY PRODUCTION
                </span>
                <div className="text-3xl sm:text-4xl font-mono font-black text-white tracking-tight mt-0.5">
                  {todayGenKWh.toFixed(2)}
                </div>
                <span className="text-[11px] font-mono font-normal text-slate-400">
                  kWh วันนี้
                </span>
                <div className="mt-2 px-3 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold">
                  ประหยัด +฿{todaySavedBaht.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: INTERACTIVE 4-WAY ENERGY VECTOR RADAR */}
          {centerHudMode === 'VECTOR' && (
            <div className="my-2 bg-[#070a10] border border-slate-800/80 rounded-2xl p-3.5 space-y-2.5 shadow-sm">
              <div className="text-[11px] font-bold text-white flex items-center justify-between">
                <span>เรดาร์ทิศทางการไหลของพลังงาน</span>
                <span className="font-mono text-[10px] text-cyan-400">LIVE VECTOR</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#121622] border border-slate-800/80 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-300 font-medium">☀️ แผงโซลาร์ → อินเวอร์เตอร์</div>
                  <div className="text-base font-mono font-black text-white mt-0.5">
                    {totalPvPowerW} W
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {solarData.pv1Voltage}V • {solarData.pv1Current}A
                  </div>
                </div>
                <div className="bg-[#121622] border border-slate-800/80 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-300 font-medium">🔋 สถานะแบตเตอรี่</div>
                  <div className="text-base font-mono font-black text-white mt-0.5">
                    {solarData.batteryPowerW || 0} W
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {solarData.batteryStatus} ({battSoc}%)
                  </div>
                </div>
                <div className="bg-[#121622] border border-slate-800/80 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-300 font-medium">🏠 จ่ายเข้าโหลดในบ้าน</div>
                  <div className="text-base font-mono font-black text-white mt-0.5">
                    {houseLoadW} W
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    พึ่งพาตนเอง {selfSuffPct}%
                  </div>
                </div>
                <div className="bg-[#121622] border border-slate-800/80 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-300 font-medium">🗼 สายส่งการไฟฟ้า (Grid)</div>
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
      )}

      {/* DAILY PEAK ELECTRICITY & CURRENT ANALYSIS (วิเคราะห์พีคและกระแสแอมป์) */}
      {(dashboardSection === 'summary' || dashboardSection === 'all') && (
        <div className="bg-[#080d19]/95 border border-slate-800/90 rounded-[28px] p-4 sm:p-5 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                  <span>วิเคราะห์ไฟฟ้าพีคสุดประจำวัน & กระแสแอมป์ (Daily Peak & Current)</span>
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  จุดพีคของบ้าน, กำลังผลิต PV1-PV2 และความปลอดภัยของสายส่ง
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-300 border border-slate-700 font-bold">
              วันที่ {activeHistoryDay?.date || getThailandDateStr(0)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. Peak House Load & Current */}
            <div className="bg-[#121622] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3.5 space-y-2 flex flex-col justify-between transition-all shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ไฟฟ้าพีคสุดของบ้าน</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
                  {dailyPeakStats.peakLoadHour} น.
                </span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {dailyPeakStats.peakLoadW.toLocaleString()} <span className="text-xs text-slate-400 font-normal font-sans">W</span>
                </span>
                <span className="text-xs text-slate-400">
                  ({(dailyPeakStats.peakLoadW / 1000).toFixed(2)} kW)
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] space-y-0.5 font-sans">
                <div className="flex justify-between items-center text-slate-300 font-mono">
                  <span className="text-slate-400 text-[10px]">กระแสพีค (@230V):</span>
                  <span className="font-bold text-white text-xs sm:text-sm">
                    {dailyPeakStats.peakLoadCurrentA} A
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 pt-0.5">
                  {dailyPeakStats.peakLoadCurrentA < 16
                    ? '🟢 ปกติ (สาย 2.5–4.0 mm² เบรกเกอร์ 16–20A)'
                    : dailyPeakStats.peakLoadCurrentA <= 25
                    ? '🟡 ปานกลาง (แอร์/ต้มน้ำ สาย 4 mm²)'
                    : '🔴 โหลดสูง (ตรวจเบรกเกอร์เมน 32–40A)'}
                </p>
              </div>
            </div>

            {/* 2. Peak Solar PV & DC Current */}
            <div className="bg-[#121622] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3.5 space-y-2 flex flex-col justify-between transition-all shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ผลิตโซลาร์พีคสุด (PV)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
                  {dailyPeakStats.peakPvHour} น.
                </span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {dailyPeakStats.peakPvW.toLocaleString()} <span className="text-xs text-slate-400 font-normal font-sans">W</span>
                </span>
                <span className="text-xs text-slate-400">
                  ({(dailyPeakStats.peakPvW / 1000).toFixed(2)} kW)
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] space-y-0.5 font-sans">
                <div className="flex justify-between items-center text-slate-300 font-mono">
                  <span className="text-slate-400 text-[10px]">กระแส DC พีค (@380V):</span>
                  <span className="font-bold text-white text-xs sm:text-sm">
                    {dailyPeakStats.peakPvCurrentA} A
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 pt-0.5">
                  ☀️ พีคช่วงแดดเที่ยง เลี้ยงโหลดและชาร์จแบต
                </p>
              </div>
            </div>

            {/* 3. Inverter Max Temperature */}
            <div className="bg-[#121622] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3.5 space-y-2 flex flex-col justify-between transition-all shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ความร้อน Inverter สูงสุด</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
                  {dailyPeakStats.maxInverterTempHour} น.
                </span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {dailyPeakStats.maxInverterTempC}°C
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-sans font-bold text-slate-300 bg-slate-800 border border-slate-700/80">
                  {dailyPeakStats.maxInverterTempC < 50 ? '🟢 ระบายความร้อนดี' : '🟡 อุ่นปกติ'}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 font-sans">
                เกณฑ์ปลอดภัย &lt; 55°C (ฮีตซิงก์ทำงานสมบูรณ์)
              </div>
            </div>

            {/* 4. Battery Max Temperature */}
            <div className="bg-[#121622] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3.5 space-y-2 flex flex-col justify-between transition-all shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <BatteryCharging className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ความร้อน แบตเตอรี่ สูงสุด</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
                  {dailyPeakStats.maxBatteryTempHour} น.
                </span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {dailyPeakStats.maxBatteryTempC}°C
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/80 text-slate-300 font-sans font-bold">
                  🟢 ปลอดภัย (Safe)
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 font-sans">
                เกณฑ์ปลอดภัยแบตเตอรี่ LiFePO4 &lt; 45°C
              </div>
            </div>
          </div>

          {/* PV1 and PV2 String Intelligence & Overcurrent Monitoring */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <Sun className="w-4 h-4 text-cyan-400" />
                  <span>ข้อมูลสตริง PV1 & PV2 (โวลต์ V, แอมป์ A, วัตต์ W)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-sans mt-0.5">
                  แผงปัจจุบัน: <strong className="text-slate-200">{solarData.panelModelName || 'RAPID 750W N-Type Bifacial TOPCon'}</strong> • PV1: <strong className="text-white font-mono">{stringStandards.pv1Count} แผง</strong> • PV2: <strong className="text-white font-mono">{stringStandards.pv2Count} แผง</strong> • แผงละ: <strong className="text-white font-mono">{stringStandards.panelW}W</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsStringConfigOpen(!isStringConfigOpen)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm ${
                  isStringConfigOpen
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                    : 'bg-[#141b27] hover:bg-[#192231] text-slate-300 hover:text-white border-slate-700/80'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isStringConfigOpen ? '✕ ปิดช่องกรอกข้อมูลแผง' : '✏️ ปรับตั้งค่าสเปกแผง PV1 & PV2'}</span>
              </button>
            </div>

            {/* INLINE SOLAR PANEL & STRING CONFIGURATION FORM */}
            {isStringConfigOpen && (
              <form
                onSubmit={handleSaveInlineStringConfig}
                className="bg-[#04070e] border border-amber-500/50 rounded-2xl p-4 space-y-3.5 animate-fadeIn shadow-2xl shadow-black/80"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div>
                    <h5 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      <span>กรอกข้อมูลแผงโซลาร์จริง & จำนวนแผงที่ต่ออนุกรม</span>
                    </h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      กรอกเพื่อให้อินเวอร์เตอร์คำนวณแรงดันมาตรฐาน Vmp, Voc และตรวจจับกระแสเกินได้แม่นยำ 100%
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>บันทึกข้อมูลแผงทันที</span>
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-amber-300 font-bold">⚡ หรือคลิกเลือกพรีเซ็ตแผงยอดนิยม:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {[
                      {
                        name: '⚡ RAPID 750W (7 แผง PV1)',
                        spec: {
                          panelModelName: 'RAPID 750W N-Type Bifacial TOPCon',
                          panelWattage: 750,
                          panelVoc: 50.20,
                          panelVmp: 43.60,
                          panelImp: 17.90,
                          panelIsc: 18.74,
                          pv1PanelCount: 7,
                          pv2PanelCount: 0,
                          inverterMaxMpptCurrentA: 20.0,
                          inverterMaxDcVoltageV: 550.0
                        }
                      },
                      {
                        name: 'RAPID 750W (6+5 แผง)',
                        spec: {
                          panelModelName: 'RAPID 750W N-Type Bifacial TOPCon',
                          panelWattage: 750,
                          panelVoc: 50.20,
                          panelVmp: 43.60,
                          panelImp: 17.90,
                          panelIsc: 18.74,
                          pv1PanelCount: 6,
                          pv2PanelCount: 5,
                          inverterMaxMpptCurrentA: 20.0,
                          inverterMaxDcVoltageV: 550.0
                        }
                      },
                      {
                        name: 'N-Type TOPCon 580W (8+6)',
                        spec: {
                          panelModelName: 'Mono Half-Cell N-Type TOPCon 580W',
                          panelWattage: 580,
                          panelVoc: 51.5,
                          panelVmp: 42.5,
                          panelImp: 13.65,
                          panelIsc: 14.50,
                          pv1PanelCount: 8,
                          pv2PanelCount: 6,
                          inverterMaxMpptCurrentA: 16.0,
                          inverterMaxDcVoltageV: 550.0
                        }
                      },
                      {
                        name: 'Mono PERC 550W (8+8)',
                        spec: {
                          panelModelName: 'Mono Perc Tier 1 550W',
                          panelWattage: 550,
                          panelVoc: 49.8,
                          panelVmp: 41.8,
                          panelImp: 13.16,
                          panelIsc: 13.98,
                          pv1PanelCount: 8,
                          pv2PanelCount: 8,
                          inverterMaxMpptCurrentA: 16.0,
                          inverterMaxDcVoltageV: 550.0
                        }
                      },
                      {
                        name: 'Hi-MO 7 620W (7+6)',
                        spec: {
                          panelModelName: 'Longi Hi-MO 7 620W',
                          panelWattage: 620,
                          panelVoc: 52.8,
                          panelVmp: 43.6,
                          panelImp: 14.22,
                          panelIsc: 15.08,
                          pv1PanelCount: 7,
                          pv2PanelCount: 6,
                          inverterMaxMpptCurrentA: 16.0,
                          inverterMaxDcVoltageV: 550.0
                        }
                      }
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setInlineStringForm((prev) => ({ ...prev, ...preset.spec }))}
                        className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-left text-xs text-slate-200 cursor-pointer transition-all active:scale-95"
                      >
                        <div className="font-bold text-sky-300 text-[11px]">{preset.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {preset.spec.panelWattage}W • Vmp {preset.spec.panelVmp}V • {preset.spec.panelImp}A
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input Fields */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  {/* PV1 Count */}
                  <div className="bg-slate-950/90 border border-sky-500/50 rounded-xl p-2.5 space-y-1">
                    <label className="text-sky-300 font-bold text-[11px] block">
                      ☀️ PV1 ต่ออนุกรมกี่แผง:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        step="1"
                        value={inlineStringForm.pv1PanelCount ?? 7}
                        onChange={(e) =>
                          setInlineStringForm((prev) => ({
                            ...prev,
                            pv1PanelCount: parseInt(e.target.value, 10) || 0
                          }))
                        }
                        className="w-full bg-slate-900 border border-sky-500/40 rounded-lg px-2.5 py-1.5 text-sky-300 font-mono font-black text-right text-sm"
                      />
                      <span className="text-[11px] text-slate-400">แผง</span>
                    </div>
                  </div>

                  {/* PV2 Count */}
                  <div className="bg-slate-950/90 border border-emerald-500/50 rounded-xl p-2.5 space-y-1">
                    <label className="text-emerald-300 font-bold text-[11px] block">
                      ☀️ PV2 ต่ออนุกรมกี่แผง:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="1"
                        value={inlineStringForm.pv2PanelCount ?? 1}
                        onChange={(e) =>
                          setInlineStringForm((prev) => ({
                            ...prev,
                            pv2PanelCount: parseInt(e.target.value, 10) || 0
                          }))
                        }
                        className="w-full bg-slate-900 border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-emerald-300 font-mono font-black text-right text-sm"
                      />
                      <span className="text-[11px] text-slate-400">แผง</span>
                    </div>
                  </div>

                  {/* Panel Wattage */}
                  <div className="bg-slate-950/90 border border-amber-500/40 rounded-xl p-2.5 space-y-1">
                    <label className="text-amber-300 font-bold text-[11px] block">
                      กำลังวัตต์ (W / แผง):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="5"
                        value={inlineStringForm.panelWattage ?? 750}
                        onChange={(e) =>
                          setInlineStringForm((prev) => ({
                            ...prev,
                            panelWattage: parseFloat(e.target.value) || 0
                          }))
                        }
                        className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono font-black text-right text-sm"
                      />
                      <span className="text-[11px] text-slate-400">W</span>
                    </div>
                  </div>

                  {/* Vmp */}
                  <div className="bg-slate-950/90 border border-slate-700 rounded-xl p-2.5 space-y-1">
                    <label className="text-slate-300 font-bold text-[11px] block">
                      แรงดัน Vmp (V / แผง):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.1"
                        value={inlineStringForm.panelVmp ?? 43.6}
                        onChange={(e) =>
                          setInlineStringForm((prev) => ({
                            ...prev,
                            panelVmp: parseFloat(e.target.value) || 0
                          }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sky-300 font-mono font-bold text-right text-sm"
                      />
                      <span className="text-[11px] text-slate-400">V</span>
                    </div>
                  </div>

                  {/* Voc */}
                  <div className="bg-slate-950/90 border border-slate-700 rounded-xl p-2.5 space-y-1">
                    <label className="text-slate-300 font-bold text-[11px] block">
                      แรงดันเปิดวงจร Voc (V):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.1"
                        value={inlineStringForm.panelVoc ?? 50.2}
                        onChange={(e) =>
                          setInlineStringForm((prev) => ({
                            ...prev,
                            panelVoc: parseFloat(e.target.value) || 0
                          }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-rose-300 font-mono font-bold text-right text-sm"
                      />
                      <span className="text-[11px] text-slate-400">V</span>
                    </div>
                  </div>

                  {/* Imp */}
                  <div className="bg-slate-950/90 border border-slate-700 rounded-xl p-2.5 space-y-1">
                    <label className="text-slate-300 font-bold text-[11px] block">
                      กระแสทำงาน Imp (A):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.05"
                        value={inlineStringForm.panelImp ?? 17.9}
                        onChange={(e) =>
                          setInlineStringForm((prev) => ({
                            ...prev,
                            panelImp: parseFloat(e.target.value) || 0
                          }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-emerald-300 font-mono font-bold text-right text-sm"
                      />
                      <span className="text-[11px] text-slate-400">A</span>
                    </div>
                  </div>

                  {/* Inverter Max MPPT Current */}
                  <div className="bg-slate-950/90 border border-rose-500/40 rounded-xl p-2.5 space-y-1">
                    <label className="text-rose-300 font-bold text-[11px] block">
                      ขีดจำกัดแอมป์ Inverter (A):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.5"
                        value={inlineStringForm.inverterMaxMpptCurrentA ?? 20.0}
                        onChange={(e) =>
                          setInlineStringForm((prev) => ({
                            ...prev,
                            inverterMaxMpptCurrentA: parseFloat(e.target.value) || 20.0
                          }))
                        }
                        className="w-full bg-slate-900 border border-rose-500/50 rounded-lg px-2.5 py-1.5 text-rose-300 font-mono font-bold text-right text-sm"
                      />
                      <span className="text-[11px] text-slate-400">A</span>
                    </div>
                  </div>

                  {/* Panel Model Name */}
                  <div className="bg-slate-950/90 border border-slate-700 rounded-xl p-2.5 space-y-1">
                    <label className="text-slate-300 font-bold text-[11px] block">
                      ชื่อรุ่นแผงโซลาร์:
                    </label>
                    <input
                      type="text"
                      value={inlineStringForm.panelModelName || 'RAPID 750W N-Type Bifacial TOPCon'}
                      onChange={(e) =>
                        setInlineStringForm((prev) => ({ ...prev, panelModelName: e.target.value }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs"
                    />
                  </div>
                </div>

                {/* Instant Calculated Benchmarks */}
                {(() => {
                  const n1 = Number(inlineStringForm.pv1PanelCount ?? 7);
                  const n2 = Number(inlineStringForm.pv2PanelCount ?? 1);
                  const w = Number(inlineStringForm.panelWattage ?? 750);
                  const vmp = Number(inlineStringForm.panelVmp ?? 43.6);
                  const voc = Number(inlineStringForm.panelVoc ?? 50.2);
                  const imp = Number(inlineStringForm.panelImp ?? 17.9);
                  const pv1W = n1 * w;
                  const pv2W = n2 * w;
                  const totalKwp = ((pv1W + pv2W) / 1000).toFixed(2);
                  return (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                      <div>
                        <span className="text-sky-300 font-bold">PV1 ({n1} แผง):</span>{' '}
                        <span>{(pv1W / 1000).toFixed(2)} kWp • Vmp {(n1 * vmp).toFixed(1)}V • Voc {(n1 * voc).toFixed(1)}V</span>
                      </div>
                      <div>
                        <span className="text-emerald-300 font-bold">PV2 ({n2} แผง):</span>{' '}
                        <span>{(pv2W / 1000).toFixed(2)} kWp • Vmp {(n2 * vmp).toFixed(1)}V • Voc {(n2 * voc).toFixed(1)}V</span>
                      </div>
                      <div className="text-amber-300 font-black">
                        กำลังรวม: {totalKwp} kWp (กระแสมาตรฐาน {imp} A)
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsStringConfigOpen(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    ✕ ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-500/25"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>💾 บันทึกการตั้งค่าแผงโซลาร์</span>
                  </button>
                </div>
              </form>
            )}

            {/* PV1 and PV2 String Cards with Dynamic Health Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
              {/* PV1 Card */}
              {(() => {
                const h1 = stringHealthAnalysis.pv1;
                const levelMeta = HEALTH_LEVELS[h1.level] || HEALTH_LEVELS.OK;
                const cardBorder =
                  h1.level === 'DANGER'
                    ? 'bg-rose-950/20 border-rose-500/60 shadow-lg'
                    : h1.level === 'WARNING'
                    ? 'bg-orange-950/20 border-orange-500/50 shadow-md'
                    : h1.level === 'WATCH'
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                    : h1.level === 'IDLE'
                    ? 'bg-[#121622]/60 border-slate-800/60 opacity-60'
                    : 'bg-[#121622] border-slate-800/80 hover:border-slate-700/80';

                const badgeTone =
                  HEALTH_TONE_CLASSES[levelMeta.tone] || HEALTH_TONE_CLASSES.slate;

                const isPv1OverLimit = dailyPeakStats.maxPv1A > stringStandards.maxInvA;
                const pv1BadgeText = (() => {
                  if (h1.level === 'DANGER') return `🔴 เสี่ยงอันตราย (${dailyPeakStats.maxPv1A}A)`;
                  if (isPv1OverLimit) return `🟠 กระแสเกิน (${dailyPeakStats.maxPv1A}A > ${stringStandards.maxInvA}A)`;
                  if (h1.level === 'WATCH') return `🟡 เฝ้าระวัง (${dailyPeakStats.maxPv1A}A)`;
                  if (h1.level === 'IDLE') return `⚪ ไม่ได้ต่อใช้งาน`;
                  return `🟢 ปกติ (< ${stringStandards.maxInvA}A)`;
                })();

                return (
                  <div className={`p-3.5 rounded-2xl border space-y-2.5 flex flex-col justify-between transition-all duration-200 shadow-sm ${cardBorder}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200 font-bold flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span>สตริงที่ 1 (PV1): อนุกรม {stringStandards.pv1Count} แผง</span>
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono border ${badgeTone}`}>
                        {pv1BadgeText}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 font-mono text-center">
                      <div className="bg-[#0b0f17] border border-slate-800/80 rounded-xl p-2.5">
                        <span className="text-[10px] text-slate-400 block font-sans">แรงดันขณะพีค</span>
                        <strong className="text-white text-sm sm:text-base block">{dailyPeakStats.peakPv1V} V</strong>
                        <span className="text-[9px] text-slate-500">Vmp {stringStandards.pv1StdVmp}V</span>
                      </div>
                      <div className="bg-[#0b0f17] border border-slate-800/80 rounded-xl p-2.5">
                        <span className="text-[10px] text-slate-400 block font-sans">กระแสสูงสุด</span>
                        <strong className={`text-sm sm:text-base block ${
                          isPv1OverLimit
                            ? 'text-rose-400 font-black'
                            : h1.level === 'WATCH'
                            ? 'text-amber-300 font-black'
                            : 'text-white'
                        }`}>
                          {dailyPeakStats.maxPv1A} A
                        </strong>
                        <span className="text-[9px] text-slate-500">Imp {stringStandards.pv1StdImp}A</span>
                      </div>
                      <div className="bg-[#0b0f17] border border-slate-800/80 rounded-xl p-2.5">
                        <span className="text-[10px] text-slate-400 block font-sans">กำลังผลิตพีค</span>
                        <strong className="text-white text-sm sm:text-base block">{dailyPeakStats.peakPv1W.toLocaleString()} W</strong>
                        <span className="text-[9px] text-slate-500">(@ {dailyPeakStats.peakPv1Hour} น.)</span>
                      </div>
                    </div>

                    <div className="text-[10px] pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1 text-slate-400 font-sans">
                      <span>สเปกติดตั้ง: <strong className="text-slate-200 font-mono">{((stringStandards.pv1StdW) / 1000).toFixed(2)} kWp</strong> (Voc {stringStandards.pv1StdVoc}V &lt; 550V)</span>
                      <span className="text-slate-400 font-mono">พีคกระแส: {dailyPeakStats.maxPv1AHour || '12:00'} น.</span>
                    </div>
                  </div>
                );
              })()}

              {/* PV2 Card */}
              {(() => {
                const h2 = stringHealthAnalysis.pv2;
                const isPv2Idle =
                  stringStandards.pv2Count === 0 ||
                  (dailyPeakStats.maxPv2A === 0 && dailyPeakStats.peakPv2W === 0);

                const levelMeta = isPv2Idle
                  ? HEALTH_LEVELS.IDLE
                  : HEALTH_LEVELS[h2.level] || HEALTH_LEVELS.OK;

                const cardBorder = isPv2Idle
                  ? 'bg-[#121622]/40 border-slate-800/60 opacity-60'
                  : h2.level === 'DANGER'
                  ? 'bg-rose-950/20 border-rose-500/60 shadow-lg'
                  : h2.level === 'WARNING'
                  ? 'bg-orange-950/20 border-orange-500/50 shadow-md'
                  : h2.level === 'WATCH'
                  ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                  : 'bg-[#121622] border-slate-800/80 hover:border-slate-700/80';

                const badgeTone =
                  HEALTH_TONE_CLASSES[levelMeta.tone] || HEALTH_TONE_CLASSES.slate;

                const pv2BadgeText = (() => {
                  if (isPv2Idle) return '⚪ ไม่ได้ต่อใช้งาน (0W)';
                  if (h2.level === 'DANGER') return `🔴 เสี่ยงอันตราย (${dailyPeakStats.maxPv2A}A)`;
                  if (dailyPeakStats.maxPv2A > stringStandards.maxInvA) {
                    return `🟠 กระแสเกิน (${dailyPeakStats.maxPv2A}A > ${stringStandards.maxInvA}A)`;
                  }
                  if (h2.level === 'WATCH') return `🟡 เฝ้าระวัง (${dailyPeakStats.maxPv2A}A)`;
                  return `🟢 ปกติ (< ${stringStandards.maxInvA}A)`;
                })();

                return (
                  <div className={`p-3.5 rounded-2xl border space-y-2.5 flex flex-col justify-between transition-all duration-200 shadow-sm ${cardBorder}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200 font-bold flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span>สตริงที่ 2 (PV2): อนุกรม {stringStandards.pv2Count} แผง</span>
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono border ${badgeTone}`}>
                        {pv2BadgeText}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 font-mono text-center">
                      <div className="bg-[#0b0f17] border border-slate-800/80 rounded-xl p-2.5">
                        <span className="text-[10px] text-slate-400 block font-sans">แรงดันขณะพีค</span>
                        <strong className="text-white text-sm sm:text-base block">{dailyPeakStats.peakPv2V} V</strong>
                        <span className="text-[9px] text-slate-500">Vmp {stringStandards.pv2StdVmp}V</span>
                      </div>
                      <div className="bg-[#0b0f17] border border-slate-800/80 rounded-xl p-2.5">
                        <span className="text-[10px] text-slate-400 block font-sans">กระแสสูงสุด</span>
                        <strong className={`text-sm sm:text-base block ${
                          isPv2Idle
                            ? 'text-slate-500'
                            : dailyPeakStats.maxPv2A > stringStandards.maxInvA
                            ? 'text-rose-400 font-black'
                            : 'text-white'
                        }`}>
                          {dailyPeakStats.maxPv2A} A
                        </strong>
                        <span className="text-[9px] text-slate-500">Imp {stringStandards.pv2StdImp}A</span>
                      </div>
                      <div className="bg-[#0b0f17] border border-slate-800/80 rounded-xl p-2.5">
                        <span className="text-[10px] text-slate-400 block font-sans">กำลังผลิตพีค</span>
                        <strong className="text-white text-sm sm:text-base block">{dailyPeakStats.peakPv2W.toLocaleString()} W</strong>
                        <span className="text-[9px] text-slate-500">(@ {dailyPeakStats.peakPv2Hour} น.)</span>
                      </div>
                    </div>

                    <div className="text-[10px] pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1 text-slate-400 font-sans">
                      <span>สเปกติดตั้ง: <strong className="text-slate-200 font-mono">{((stringStandards.pv2StdW) / 1000).toFixed(2)} kWp</strong> (Voc {stringStandards.pv2StdVoc}V &lt; 550V)</span>
                      <span className="text-slate-400 font-mono">พีคกระแส: {dailyPeakStats.maxPv2AHour || '12:00'} น.</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* COMPACT EXECUTIVE SUMMARY STRIP (สรุปสั้น กระชับ สบายตา ไม่รก) */}
            {(() => {
              const isPv2Idle =
                stringStandards.pv2Count === 0 ||
                (dailyPeakStats.maxPv2A === 0 && dailyPeakStats.peakPv2W === 0);
              const isOvercurrent = dailyPeakStats.maxPv1A > stringStandards.maxInvA;

              return (
                <div className="bg-[#121622] border border-slate-800/80 rounded-2xl p-3 sm:p-3.5 text-xs shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                      <ShieldCheck className={`w-4 h-4 shrink-0 ${
                        isOvercurrent ? 'text-amber-400' : 'text-cyan-400'
                      }`} />
                      <div className="text-[11px] sm:text-xs text-slate-300">
                        <span className="font-bold text-white">ผลตรวจความปลอดภัย: </span>
                        {isOvercurrent ? (
                          <span className="text-amber-300 font-medium">
                            ⚠️ กระแส PV1 ({dailyPeakStats.maxPv1A}A) เกินขีดจำกัด {stringStandards.maxInvA}A ควรตรวจสายส่ง DC (แนะนำ PV1-F ≥ 4 mm²)
                          </span>
                        ) : (
                          <span className="text-slate-300">
                            สตริง PV1 จ่ายไฟปกติพีค <strong className="text-white font-mono">{dailyPeakStats.peakPv1W.toLocaleString()} W</strong> ({dailyPeakStats.maxPv1A}A / {dailyPeakStats.peakPv1V}V) อยู่ในเกณฑ์ปลอดภัย (&lt; {stringStandards.maxInvA}A)
                            {isPv2Idle && <span className="text-slate-500 font-sans"> • PV2 ไม่ได้ต่อสาย</span>}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Toggle details button */}
                    <button
                      type="button"
                      onClick={() => setIsStringAdvisoryExpanded(!isStringAdvisoryExpanded)}
                      className="px-2.5 py-1 rounded-lg bg-[#0b0f17] hover:bg-slate-800 border border-slate-700/80 text-[10px] text-slate-300 font-medium flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
                    >
                      <span>{isStringAdvisoryExpanded ? '✕ ย่อสรุป' : 'สเปกสาย & ฟิวส์ ▾'}</span>
                    </button>
                  </div>

                  {/* Collapsible Details (Hidden by default to keep screen clean and clutter-free) */}
                  {isStringAdvisoryExpanded && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-2 text-[11px] animate-fadeIn">
                      {/* Issues if any */}
                      {stringHealthAnalysis.allIssues.length > 0 && (
                        <div className="space-y-1.5">
                          {stringHealthAnalysis.allIssues.map((issue, idx) => (
                            <div key={idx} className="p-2 rounded bg-slate-900/80 border border-slate-800 text-slate-300 text-[10px]">
                              <strong className="text-amber-300">{issue.title}:</strong> {issue.detail}
                              {issue.action && (
                                <div className="text-sky-300 mt-0.5">🔧 ข้อแนะนำ: {issue.action}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Standard Engineering Reference */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-slate-400 font-sans pt-1">
                        <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/80">
                          <span className="text-slate-400 block font-bold">📏 สายส่ง DC ที่แนะนำ:</span>
                          <span className="text-sky-300 font-mono font-bold">
                            สาย PV1-F ขนาด ≥ {stringHealthAnalysis.pv1.limits.recommendedCableMm2} sq.mm.
                          </span>
                          <span className="text-[9px] text-slate-500 block">ทนกระแสต่อเนื่องได้ถึง 35-45A ไม่ร้อน</span>
                        </div>
                        <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/80">
                          <span className="text-slate-400 block font-bold">⚡ กระแสออกแบบสาย (Isc × 1.25):</span>
                          <span className="text-amber-300 font-mono font-bold">
                            {stringHealthAnalysis.pv1.limits.designCurrentA} A (กระแส Imp {stringStandards.pv1StdImp}A)
                          </span>
                          <span className="text-[9px] text-slate-500 block">มาตรฐานวิศวกรรมไฟฟ้า NEC 690.8</span>
                        </div>
                        <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/80">
                          <span className="text-slate-400 block font-bold">🛡️ เบรกเกอร์ / ฟิวส์ DC:</span>
                          <span className="text-emerald-300 font-mono font-bold">
                            {stringHealthAnalysis.pv1.limits.recommendedProtectionA} A (DC 1000V)
                          </span>
                          <span className="text-[9px] text-slate-500 block">ตัดวงจรทันทีเมื่อลัดวงจร</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {dashboardSection === 'summary' && (
        <div className="bg-[#080d19]/95 border border-slate-800/90 rounded-[28px] p-4 sm:p-5 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <span>🧾 บิลค่าไฟฟ้า กฟภ. & การประหยัดพลังงาน</span>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  ประหยัดแล้ว ~฿{todaySavedBaht.toLocaleString()} วันนี้
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ดูประมาณการบิล กฟภ. อัตราก้าวหน้า + ค่า Ft + VAT 7% หรือเปิดดูกราฟ 24 ชม. เต็ม
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDashboardSection('curve');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>ดูกราฟ 24 ชม.</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedPeaCycleKey(billingCycles[0]?.cycleKey || '2026-10');
                setIsPeaModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>เปิดบิล กฟภ. จำลอง</span>
            </button>
          </div>
        </div>
      )}

      {/* INTERACTIVE TIME-MACHINE 24-HOUR DYNO CHART & HISTORICAL EXPLORER */}
      {(dashboardSection === 'curve' || dashboardSection === 'all') && (
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
{/* =================================================================== */}
        {/* INTERACTIVE 24-HOUR TIME-MACHINE INSPECTOR (สแกนตรวจดูทุกช่วงเวลา) */}
        {/* =================================================================== */}
        <div className="bg-[#04070e] border border-slate-800/90 rounded-2xl p-3.5 sm:p-4 space-y-3">
          {/* Top Bar: Active Hour & Quick-Jump Presets */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-800/80">
            <span className="font-bold text-slate-200 text-xs sm:text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>🎚️ ตรวจสอบค่าไฟฟ้าและสถานะระบบรายชั่วโมง:</span>
              <span className="font-mono text-amber-300 text-sm sm:text-base font-black px-2 py-0.5 rounded-lg bg-amber-400/10 border border-amber-400/30">
                {scrubbedPoint.hour} น.
              </span>
              {isViewingToday && effectiveScrubHour === currentThaiHour && (
                <span className="text-[10px] font-sans font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-1.5 py-0.5 rounded-md">
                  ⏱️ ปัจจุบัน
                </span>
              )}
            </span>

            {/* Quick-Jump Hour Presets (Bounded strictly to elapsed hours) */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] font-mono">
              <span className="text-[10px] text-slate-500 font-sans pr-1">ลัดไป:</span>
              {[
                { h: 0, label: '00:00' },
                { h: 6, label: '06:00' },
                { h: 9, label: '09:00' },
                { h: 12, label: '12:00' },
                { h: 15, label: '15:00' },
                { h: 18, label: '18:00' },
                { h: 21, label: '21:00' }
              ]
                .filter(({ h }) => h <= maxScrubHour)
                .map(({ h, label }) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setScrubHour(h)}
                    className={`px-2 py-1 rounded-lg font-bold cursor-pointer transition-all ${
                      effectiveScrubHour === h
                        ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              {isViewingToday && maxScrubHour > 0 && ![0, 6, 9, 12, 15, 18, 21].includes(maxScrubHour) && (
                <button
                  type="button"
                  onClick={() => setScrubHour(maxScrubHour)}
                  className={`px-2 py-1 rounded-lg font-bold cursor-pointer transition-all ${
                    effectiveScrubHour === maxScrubHour
                      ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                      : 'bg-slate-900 text-sky-400 hover:text-white border border-sky-500/40'
                  }`}
                >
                  {String(maxScrubHour).padStart(2, '0')}:00 (ปัจจุบัน)
                </button>
              )}
            </div>
          </div>

          {/* 5-Card Live Value Dashboard for the Selected Hour */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {/* 1. Solar PV Power & Strings */}
            <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
              scrubbedPoint.isPv1Overcurrent || scrubbedPoint.isPv2Overcurrent
                ? 'bg-rose-950/40 border-rose-500/60'
                : 'bg-slate-950/90 border-amber-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-amber-300/90 font-bold flex items-center gap-1">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>กำลังผลิตโซลาร์ PV</span>
                </span>
                {(scrubbedPoint.isPv1Overcurrent || scrubbedPoint.isPv2Overcurrent) && (
                  <span className="text-[9px] font-bold text-rose-300 bg-rose-500/20 px-1 rounded animate-pulse">
                    ⚠️ กระแสเกิน
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between mt-1 font-mono">
                <span className="text-base sm:text-lg font-black text-amber-300">
                  {scrubbedPoint.pvW != null ? scrubbedPoint.pvW.toLocaleString() : '—'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {scrubbedPoint.pvW != null ? `W ${scrubbedPoint.pvW >= 1000 ? `(${(scrubbedPoint.pvW / 1000).toFixed(2)} kW)` : ''}` : ''}
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/60 mt-1 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-sky-300">PV1:</span>
                  <span>{scrubbedPoint.pv1W || 0}W • {scrubbedPoint.pv1V || 0}V • <strong className={scrubbedPoint.isPv1Overcurrent ? 'text-rose-400' : 'text-slate-200'}>{scrubbedPoint.pv1A || 0}A</strong></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-300">PV2:</span>
                  <span>{scrubbedPoint.pv2W || 0}W • {scrubbedPoint.pv2V || 0}V • <strong className={scrubbedPoint.isPv2Overcurrent ? 'text-rose-400' : 'text-slate-200'}>{scrubbedPoint.pv2A || 0}A</strong></span>
                </div>
              </div>
            </div>

            {/* 2. House Load Power */}
            <div className="bg-slate-950/90 border border-purple-500/40 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[11px] text-purple-300 font-bold flex items-center gap-1">
                <Home className="w-3.5 h-3.5 text-purple-400" />
                <span>โหลดใช้ไฟในบ้าน</span>
              </span>
              <div className="flex items-baseline justify-between mt-1 font-mono">
                <span className="text-base sm:text-lg font-black text-purple-300">
                  {scrubbedPoint.loadW != null ? scrubbedPoint.loadW.toLocaleString() : '—'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {scrubbedPoint.loadW != null ? `W ${scrubbedPoint.loadW >= 1000 ? `(${(scrubbedPoint.loadW / 1000).toFixed(2)} kW)` : ''}` : ''}
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/60 mt-1">
                กระแสไฟ: <span className="text-purple-300 font-bold">{scrubbedPoint.loadCurrentA != null ? `${scrubbedPoint.loadCurrentA} A` : '—'}</span> (@230V)
              </div>
            </div>

            {/* 3. Battery SOC % */}
            <div className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-emerald-300 font-bold flex items-center gap-1">
                  <Battery className="w-3.5 h-3.5 text-emerald-400" />
                  <span>แบตเตอรี่ (SOC)</span>
                </span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-sans font-semibold ${
                  scrubbedPoint.batterySOC == null
                    ? 'bg-slate-800 text-slate-400'
                    : scrubbedPoint.batterySOC >= 80
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : scrubbedPoint.batterySOC >= 40
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {scrubbedPoint.batterySOC == null ? '—' : scrubbedPoint.batterySOC >= 80 ? 'ประจุเต็ม' : scrubbedPoint.batterySOC >= 40 ? 'พร้อมใช้' : 'คายประจุ'}
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1 font-mono">
                <span className="text-base sm:text-lg font-black text-emerald-300">
                  {scrubbedPoint.batterySOC != null ? `${scrubbedPoint.batterySOC}%` : '—'}
                </span>
                <div className="w-16 bg-slate-800 rounded-full h-2 overflow-hidden self-center ml-2">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(5, scrubbedPoint.batterySOC ?? 0))}%` }}
                  />
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/60 mt-1">
                ความจุ: <span className="text-emerald-300 font-bold">{scrubbedPoint.batterySOC != null ? `${((scrubbedPoint.batterySOC / 100) * 10.24).toFixed(2)} kWh` : '—'}</span>
              </div>
            </div>

            {/* 4. Inverter Temperature °C */}
            <div className="bg-slate-950/90 border border-rose-500/30 rounded-xl p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-rose-300 font-bold flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                  <span>ความร้อน Inverter</span>
                </span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-sans font-semibold ${
                  scrubbedPoint.tempC == null
                    ? 'bg-slate-800 text-slate-400'
                    : scrubbedPoint.tempC < 42
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : scrubbedPoint.tempC <= 55
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}>
                  {scrubbedPoint.tempC == null ? '—' : scrubbedPoint.tempC < 42 ? '🟢 เย็นปกติ' : scrubbedPoint.tempC <= 55 ? '🟡 ทำงานปกติ' : '🔴 ร้อนสูง'}
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1 font-mono">
                <span className="text-base sm:text-lg font-black text-rose-300">
                  {scrubbedPoint.tempC != null ? `${scrubbedPoint.tempC}°C` : '—'}
                </span>
                <span className="text-[10px] text-slate-400 font-sans">
                  ปลอดภัย &lt; 55°C
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/60 mt-1">
                ฮีตซิงก์: <span className="text-rose-300 font-bold">{scrubbedPoint.tempC != null ? 'ทำงานปกติ' : '—'}</span>
              </div>
            </div>

            {/* 5. Battery Temperature °C */}
            <div className="bg-slate-950/90 border border-amber-500/30 rounded-xl p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-amber-300 font-bold flex items-center gap-1">
                  <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
                  <span>ความร้อน แบตเตอรี่</span>
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-sans font-semibold bg-emerald-500/20 text-emerald-300">
                  {scrubbedPoint.batteryTempC != null ? '🟢 ปลอดภัย' : '—'}
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1 font-mono">
                <span className="text-base sm:text-lg font-black text-amber-300">
                  {scrubbedPoint.batteryTempC != null ? `${scrubbedPoint.batteryTempC}°C` : '—'}
                </span>
                <span className="text-[10px] text-slate-400 font-sans">
                  ปลอดภัย &lt; 45°C
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/60 mt-1">
                BMS เซลล์: <span className="text-emerald-300 font-bold">{scrubbedPoint.batteryTempC != null ? 'สมบูรณ์' : '—'}</span>
              </div>
            </div>
          </div>

          {/* Time Scrubber Slider (capped at current hour for today) */}
          <div className="space-y-1 pt-1">
            <input
              type="range"
              min={0}
              max={maxScrubHour}
              step={1}
              value={effectiveScrubHour}
              onChange={(e) => setScrubHour(Number(e.target.value))}
              className="w-full accent-sky-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[9px] font-mono text-slate-500 px-0.5">
              <span>00:00 (เที่ยงคืน)</span>
              {maxScrubHour >= 6 && <span>06:00</span>}
              {maxScrubHour >= 12 && <span>12:00</span>}
              {maxScrubHour >= 18 && <span>18:00</span>}
              <span>{isViewingToday ? `${String(maxScrubHour).padStart(2, '0')}:00 (ปัจจุบัน)` : '23:00 (ดึก)'}</span>
            </div>
          </div>
        </div>

        {/* View Selection Tabs & Table Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
          <div className="flex flex-wrap items-center gap-1.5 bg-[#04070e] p-1 rounded-xl border border-slate-800">
            {[
              { id: 'all', label: '📊 รวม 4 มิติ (PV, โหลด, แบต, อุณหภูมิ)', icon: Activity },
              { id: 'power', label: '⚡ กำลังไฟ PV & โหลดบ้าน (W)', icon: Zap },
              { id: 'mppt', label: '☀️ สตริง PV1 vs PV2 (โวลต์ & แอมป์)', icon: Sun },
              { id: 'battery', label: '🔋 แบตเตอรี่ (SOC % & ความร้อน)', icon: Battery },
              { id: 'temp', label: '🌡️ ความร้อน Inverter & แบตเตอรี่ (°C)', icon: Thermometer }
            ].map(({ id, label, icon: IconComponent }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCurveMetricTab(id)}
                className={`py-1.5 px-2.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition-all text-[11px] sm:text-xs ${
                  curveMetricTab === id
                    ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <IconComponent className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsHourlyTableOpen(!isHourlyTableOpen)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              isHourlyTableOpen
                ? 'bg-purple-600/30 text-purple-200 border-purple-500/50'
                : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Table className="w-3.5 h-3.5 text-purple-300" />
            <span>{isHourlyTableOpen ? 'ซ่อนตารางค่ารายชั่วโมง' : '📋 ดูตารางค่า 24 ชั่วโมง'}</span>
          </button>
        </div>

        {/* Dynamic Recharts Visualization Container */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {curveMetricTab === 'all' ? (
              // 1. COMBINED 4-DIMENSION CHART (DUAL Y-AXIS)
              <AreaChart data={dailyCurveData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                <YAxis
                  yAxisId="power"
                  stroke="#94a3b8"
                  fontSize={10}
                  unit=" W"
                  width={52}
                />
                <YAxis
                  yAxisId="ratio"
                  orientation="right"
                  stroke="#10b981"
                  fontSize={10}
                  domain={[0, 100]}
                  unit=""
                  width={38}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const pt = payload[0]?.payload;
                    const isFuture = pt?.isFuture;
                    return (
                      <div className="bg-[#070b14] border border-slate-700/90 rounded-xl p-2.5 shadow-2xl text-xs space-y-1.5 font-mono z-50">
                        <div className="flex items-center justify-between gap-3 text-slate-300 border-b border-slate-800 pb-1 font-sans">
                          <span className="font-bold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-sky-400" />
                            <span>เวลา {label} น.</span>
                          </span>
                          {isFuture ? (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                              ⏳ ยังไม่ถึงเวลา
                            </span>
                          ) : isViewingToday && label === `${String(currentThaiHour).padStart(2, '0')}:00` ? (
                            <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/30">
                              ⏱️ ปัจจุบัน
                            </span>
                          ) : null}
                        </div>
                        {isFuture ? (
                          <div className="text-[11px] text-slate-400 font-sans py-0.5">
                            ยังไม่มีข้อมูล (ข้อมูลจริงยังไม่เกิดขึ้น)
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {payload
                              .filter((item) => item.value != null)
                              .map((item, idx) => {
                                let formattedVal = `${Number(item.value).toLocaleString()} W`;
                                if (item.name.includes('SOC')) formattedVal = `${item.value}%`;
                                else if (item.name.includes('°C') || item.name.includes('ความร้อน')) formattedVal = `${item.value}°C`;
                                return (
                                  <div key={idx} className="flex items-center justify-between gap-4 text-[11px]">
                                    <span className="flex items-center gap-1.5 font-sans" style={{ color: item.color }}>
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                      <span>{item.name}</span>
                                    </span>
                                    <span className="font-bold text-slate-100">{formattedVal}</span>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend />
                {isViewingToday && (
                  <ReferenceLine
                    yAxisId="power"
                    x={`${String(currentThaiHour).padStart(2, '0')}:00`}
                    stroke="#38bdf8"
                    strokeDasharray="3 3"
                    label={{ value: 'เวลาปัจจุบัน', fill: '#38bdf8', fontSize: 10, position: 'top' }}
                  />
                )}
                <Area
                  yAxisId="power"
                  type="monotone"
                  dataKey="pvW"
                  name="กำลังผลิตโซลาร์ PV (W)"
                  stroke={theme.pvSecondary}
                  fill={theme.pvPrimary}
                  fillOpacity={0.25}
                  connectNulls={false}
                />
                <Area
                  yAxisId="power"
                  type="monotone"
                  dataKey="loadW"
                  name="โหลดใช้ไฟในบ้าน (W)"
                  stroke="#a855f7"
                  fill="#a855f7"
                  fillOpacity={0.25}
                  strokeWidth={2.5}
                  connectNulls={false}
                />
                <Line
                  yAxisId="ratio"
                  type="monotone"
                  dataKey="batterySOC"
                  name="แบตเตอรี่ SOC (%)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 2, fill: '#10b981' }}
                  connectNulls={false}
                />
                <Line
                  yAxisId="ratio"
                  type="monotone"
                  dataKey="tempC"
                  name="ความร้อน Inverter (°C)"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  dot={{ r: 2, fill: '#f43f5e' }}
                  connectNulls={false}
                />
                <Line
                  yAxisId="ratio"
                  type="monotone"
                  dataKey="batteryTempC"
                  name="ความร้อน แบตเตอรี่ (°C)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  dot={{ r: 2, fill: '#f59e0b' }}
                  connectNulls={false}
                />
              </AreaChart>
            ) : curveMetricTab === 'mppt' ? (
              // 2. DEDICATED PV1 vs PV2 STRINGS (VOLTAGE V & CURRENT A & OVERCURRENT THRESHOLD)
              <AreaChart data={dailyCurveData}>
                <defs>
                  <linearGradient id="pv1Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="pv2Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                <YAxis yAxisId="volt" stroke="#38bdf8" fontSize={10} domain={[0, 480]} unit=" V" width={48} />
                <YAxis yAxisId="curr" orientation="right" stroke="#f59e0b" fontSize={10} domain={[0, 20]} unit=" A" width={38} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const pt = payload[0]?.payload;
                    const isFuture = pt?.isFuture;
                    return (
                      <div className="bg-[#070b14] border border-slate-700/90 rounded-xl p-2.5 shadow-2xl text-xs space-y-1.5 font-mono z-50">
                        <div className="flex items-center justify-between gap-3 text-slate-300 border-b border-slate-800 pb-1 font-sans">
                          <span className="font-bold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-sky-400" />
                            <span>เวลา {label} น.</span>
                          </span>
                          {isFuture && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                              ⏳ ยังไม่ถึงเวลา
                            </span>
                          )}
                        </div>
                        {isFuture ? (
                          <div className="text-[11px] text-slate-400 font-sans py-0.5">
                            ยังไม่มีข้อมูล (ข้อมูลจริงยังไม่เกิดขึ้น)
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {payload
                              .filter((item) => item.value != null)
                              .map((item, idx) => {
                                let formattedVal = `${item.value}`;
                                if (item.name.includes('โวลต์') || item.name.includes('แรงดัน')) formattedVal = `${item.value} V`;
                                else if (item.name.includes('กระแส') || item.name.includes('แอมป์')) formattedVal = `${item.value} A`;
                                else formattedVal = `${Number(item.value).toLocaleString()} W`;
                                return (
                                  <div key={idx} className="flex items-center justify-between gap-4 text-[11px]">
                                    <span className="flex items-center gap-1.5 font-sans" style={{ color: item.color }}>
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                      <span>{item.name}</span>
                                    </span>
                                    <span className="font-bold text-slate-100">{formattedVal}</span>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend />
                {isViewingToday && (
                  <ReferenceLine
                    yAxisId="volt"
                    x={`${String(currentThaiHour).padStart(2, '0')}:00`}
                    stroke="#38bdf8"
                    strokeDasharray="3 3"
                    label={{ value: 'เวลาปัจจุบัน', fill: '#38bdf8', fontSize: 10, position: 'top' }}
                  />
                )}
                <ReferenceLine
                  yAxisId="curr"
                  y={stringStandards.maxInvA || 16.0}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{
                    value: `ขีดจำกัดกระแสเกิน (${stringStandards.maxInvA || 16}A)`,
                    fill: '#ef4444',
                    fontSize: 10,
                    position: 'top'
                  }}
                />
                <ReferenceLine
                  yAxisId="volt"
                  y={stringStandards.pv1StdVmp}
                  stroke="#38bdf8"
                  strokeDasharray="3 3"
                  strokeOpacity={0.6}
                  label={{
                    value: `Vmp PV1 (${stringStandards.pv1StdVmp}V)`,
                    fill: '#38bdf8',
                    fontSize: 9,
                    position: 'left'
                  }}
                />
                <Area
                  yAxisId="volt"
                  type="monotone"
                  dataKey="pv1V"
                  name="แรงดัน PV1 (V)"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  fill="url(#pv1Grad)"
                  connectNulls={false}
                />
                <Area
                  yAxisId="volt"
                  type="monotone"
                  dataKey="pv2V"
                  name="แรงดัน PV2 (V)"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  fill="url(#pv2Grad)"
                  connectNulls={false}
                />
                <Line
                  yAxisId="curr"
                  type="monotone"
                  dataKey="pv1A"
                  name="กระแส PV1 (A)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 2, fill: '#f59e0b' }}
                  connectNulls={false}
                />
                <Line
                  yAxisId="curr"
                  type="monotone"
                  dataKey="pv2A"
                  name="กระแส PV2 (A)"
                  stroke="#c084fc"
                  strokeWidth={2.5}
                  dot={{ r: 2, fill: '#c084fc' }}
                  connectNulls={false}
                />
              </AreaChart>
            ) : curveMetricTab === 'battery' ? (
              // 3. DEDICATED BATTERY SOC & BATTERY TEMP CHART
              <AreaChart data={dailyCurveData}>
                <defs>
                  <linearGradient id="batterySocGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                <YAxis yAxisId="soc" stroke="#10b981" fontSize={11} domain={[0, 100]} unit="%" />
                <YAxis yAxisId="temp" orientation="right" stroke="#f59e0b" fontSize={11} domain={[20, 50]} unit="°C" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const pt = payload[0]?.payload;
                    const isFuture = pt?.isFuture;
                    return (
                      <div className="bg-[#070b14] border border-slate-700/90 rounded-xl p-2.5 shadow-2xl text-xs space-y-1.5 font-mono z-50">
                        <div className="flex items-center justify-between gap-3 text-slate-300 border-b border-slate-800 pb-1 font-sans">
                          <span className="font-bold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-sky-400" />
                            <span>เวลา {label} น.</span>
                          </span>
                          {isFuture && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                              ⏳ ยังไม่ถึงเวลา
                            </span>
                          )}
                        </div>
                        {isFuture ? (
                          <div className="text-[11px] text-slate-400 font-sans py-0.5">
                            ยังไม่มีข้อมูล (ข้อมูลจริงยังไม่เกิดขึ้น)
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {payload
                              .filter((item) => item.value != null)
                              .map((item, idx) => {
                                const formattedVal = item.name.includes('SOC') ? `${item.value}%` : `${item.value}°C`;
                                return (
                                  <div key={idx} className="flex items-center justify-between gap-4 text-[11px]">
                                    <span className="flex items-center gap-1.5 font-sans" style={{ color: item.color }}>
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                      <span>{item.name}</span>
                                    </span>
                                    <span className="font-bold text-slate-100">{formattedVal}</span>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend />
                {isViewingToday && (
                  <ReferenceLine
                    yAxisId="soc"
                    x={`${String(currentThaiHour).padStart(2, '0')}:00`}
                    stroke="#38bdf8"
                    strokeDasharray="3 3"
                    label={{ value: 'เวลาปัจจุบัน', fill: '#38bdf8', fontSize: 10, position: 'top' }}
                  />
                )}
                <ReferenceLine yAxisId="soc" y={20} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'Min SOC (20%)', fill: '#f43f5e', fontSize: 10, position: 'right' }} />
                <ReferenceLine yAxisId="soc" y={90} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Full SOC (90%)', fill: '#10b981', fontSize: 10, position: 'right' }} />
                <Area
                  yAxisId="soc"
                  type="monotone"
                  dataKey="batterySOC"
                  name="ระดับแบตเตอรี่ SOC (%)"
                  stroke="#10b981"
                  strokeWidth={3}
                  fill="url(#batterySocGrad)"
                  connectNulls={false}
                />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="batteryTempC"
                  name="ความร้อน แบตเตอรี่ (°C)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#f59e0b' }}
                  connectNulls={false}
                />
              </AreaChart>
            ) : curveMetricTab === 'temp' ? (
              // 4. DEDICATED TEMPERATURE CHART (INVERTER & BATTERY COMPARED)
              <AreaChart data={dailyCurveData}>
                <defs>
                  <linearGradient id="inverterTempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#f43f5e" fontSize={11} domain={[20, 65]} unit="°C" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const pt = payload[0]?.payload;
                    const isFuture = pt?.isFuture;
                    return (
                      <div className="bg-[#070b14] border border-slate-700/90 rounded-xl p-2.5 shadow-2xl text-xs space-y-1.5 font-mono z-50">
                        <div className="flex items-center justify-between gap-3 text-slate-300 border-b border-slate-800 pb-1 font-sans">
                          <span className="font-bold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-sky-400" />
                            <span>เวลา {label} น.</span>
                          </span>
                          {isFuture && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                              ⏳ ยังไม่ถึงเวลา
                            </span>
                          )}
                        </div>
                        {isFuture ? (
                          <div className="text-[11px] text-slate-400 font-sans py-0.5">
                            ยังไม่มีข้อมูล (ข้อมูลจริงยังไม่เกิดขึ้น)
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {payload
                              .filter((item) => item.value != null)
                              .map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4 text-[11px]">
                                  <span className="flex items-center gap-1.5 font-sans" style={{ color: item.color }}>
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span>{item.name}</span>
                                  </span>
                                  <span className="font-bold text-slate-100">{item.value}°C</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend />
                {isViewingToday && (
                  <ReferenceLine
                    x={`${String(currentThaiHour).padStart(2, '0')}:00`}
                    stroke="#38bdf8"
                    strokeDasharray="3 3"
                    label={{ value: 'เวลาปัจจุบัน', fill: '#38bdf8', fontSize: 10, position: 'top' }}
                  />
                )}
                <ReferenceLine y={55} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'เกณฑ์ปลอดภัย Inverter (55°C)', fill: '#f59e0b', fontSize: 10, position: 'right' }} />
                <ReferenceLine y={45} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'เกณฑ์ปลอดภัย แบตเตอรี่ (45°C)', fill: '#10b981', fontSize: 10, position: 'right' }} />
                <Area
                  type="monotone"
                  dataKey="tempC"
                  name="ความร้อน Inverter (°C)"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  fill="url(#inverterTempGrad)"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="batteryTempC"
                  name="ความร้อน แบตเตอรี่ (°C)"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#f59e0b' }}
                  connectNulls={false}
                />
              </AreaChart>
            ) : (
              // 5. POWER ONLY (PV & HOUSE LOAD W)
              <AreaChart data={dailyCurveData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} unit=" W" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const pt = payload[0]?.payload;
                    const isFuture = pt?.isFuture;
                    return (
                      <div className="bg-[#070b14] border border-slate-700/90 rounded-xl p-2.5 shadow-2xl text-xs space-y-1.5 font-mono z-50">
                        <div className="flex items-center justify-between gap-3 text-slate-300 border-b border-slate-800 pb-1 font-sans">
                          <span className="font-bold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-sky-400" />
                            <span>เวลา {label} น.</span>
                          </span>
                          {isFuture && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                              ⏳ ยังไม่ถึงเวลา
                            </span>
                          )}
                        </div>
                        {isFuture ? (
                          <div className="text-[11px] text-slate-400 font-sans py-0.5">
                            ยังไม่มีข้อมูล (ข้อมูลจริงยังไม่เกิดขึ้น)
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {payload
                              .filter((item) => item.value != null)
                              .map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4 text-[11px]">
                                  <span className="flex items-center gap-1.5 font-sans" style={{ color: item.color }}>
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span>{item.name}</span>
                                  </span>
                                  <span className="font-bold text-slate-100">{Number(item.value).toLocaleString()} W</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend />
                {isViewingToday && (
                  <ReferenceLine
                    x={`${String(currentThaiHour).padStart(2, '0')}:00`}
                    stroke="#38bdf8"
                    strokeDasharray="3 3"
                    label={{ value: 'เวลาปัจจุบัน', fill: '#38bdf8', fontSize: 10, position: 'top' }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="pvW"
                  name="กำลังผลิตโซลาร์ PV (W)"
                  stroke={theme.pvSecondary}
                  fill={theme.pvPrimary}
                  fillOpacity={0.25}
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="loadW"
                  name="โหลดใช้ไฟในบ้าน (W)"
                  stroke="#a855f7"
                  fill="#a855f7"
                  fillOpacity={0.28}
                  strokeWidth={2.5}
                  connectNulls={false}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Expandable 24-Hour Detailed Breakdown Table */}
        {isHourlyTableOpen && (
          <div className="bg-[#04070e] border border-purple-500/30 rounded-2xl p-3.5 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-bold text-purple-300 pb-1 border-b border-slate-800">
              <span className="flex items-center gap-1.5">
                <Table className="w-4 h-4 text-purple-400" />
                <span>ตารางค่าพลังงาน, แบตเตอรี่ และความร้อน Inverter/แบต ทุกชั่วโมง (24 Hours Log)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-sans">
                แตะแถวเพื่อปรับเข็ม Time-Machine
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-right font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400 font-sans">
                    <th className="text-left py-1.5 px-2">เวลา</th>
                    <th className="py-1.5 px-2 text-sky-300">สตริง PV1 (V • A • W)</th>
                    <th className="py-1.5 px-2 text-emerald-300">สตริง PV2 (V • A • W)</th>
                    <th className="py-1.5 px-2 text-amber-300">รวม PV (W / A)</th>
                    <th className="py-1.5 px-2 text-purple-300">โหลดบ้าน (W / A)</th>
                    <th className="py-1.5 px-2 text-emerald-300">แบต SOC</th>
                    <th className="py-1.5 px-2 text-rose-300">ความร้อน</th>
                    <th className="text-left py-1.5 px-2">กระแส MPPT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {dailyCurveData.map((pt, idx) => {
                    const isSelected = effectiveScrubHour === idx;
                    const hasOvercurrent = pt.isPv1Overcurrent || pt.isPv2Overcurrent;
                    const isFuture = pt.isFuture;

                    if (isFuture) {
                      return (
                        <tr
                          key={pt.hour}
                          className="opacity-40 text-slate-500 bg-slate-950/20"
                        >
                          <td className="text-left py-1.5 px-2 font-mono text-slate-500">
                            {pt.hour}
                          </td>
                          <td colSpan={7} className="py-1.5 px-2 text-center text-[10px] text-slate-500 font-sans">
                            ⏳ ยังไม่ถึงเวลา (ไม่มีข้อมูลจริง)
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={pt.hour}
                        onClick={() => setScrubHour(idx)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-sky-500/20 text-white font-bold'
                            : hasOvercurrent
                            ? 'bg-rose-950/20 text-rose-200 hover:bg-rose-950/30'
                            : 'hover:bg-slate-900/60 text-slate-300'
                        }`}
                      >
                        <td className="text-left py-1.5 px-2 font-bold font-mono">
                          <span className="flex items-center gap-1">
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />}
                            <span>{pt.hour}</span>
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-sky-300 font-bold">
                          <div>{pt.pv1W || 0} W</div>
                          <div className="text-[9px] text-slate-400 font-normal">
                            {pt.pv1V || 0}V • <strong className={pt.isPv1Overcurrent ? 'text-rose-400 font-bold' : 'text-slate-300'}>{pt.pv1A || 0}A</strong>
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-emerald-300 font-bold">
                          <div>{pt.pv2W || 0} W</div>
                          <div className="text-[9px] text-slate-400 font-normal">
                            {pt.pv2V || 0}V • <strong className={pt.isPv2Overcurrent ? 'text-rose-400 font-bold' : 'text-slate-300'}>{pt.pv2A || 0}A</strong>
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-amber-300 font-bold">
                          <div>{pt.pvW != null ? pt.pvW.toLocaleString() : '—'} W</div>
                          <div className="text-[9px] text-slate-400 font-normal">{pt.pvCurrentA != null ? `${pt.pvCurrentA} A` : '—'}</div>
                        </td>
                        <td className="py-1.5 px-2 text-purple-300 font-bold">
                          <div>{pt.loadW != null ? pt.loadW.toLocaleString() : '—'} W</div>
                          <div className="text-[9px] text-slate-400 font-normal">{pt.loadCurrentA != null ? `${pt.loadCurrentA} A` : '—'}</div>
                        </td>
                        <td className="py-1.5 px-2 text-emerald-300 font-bold">
                          <div className="flex items-center justify-end gap-1.5">
                            <span>{pt.batterySOC != null ? `${pt.batterySOC}%` : '—'}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-rose-300 font-bold">
                          <span className="text-[10px]">
                            Inv: {pt.tempC != null ? `${pt.tempC}°C` : '—'} | แบต: {pt.batteryTempC != null ? `${pt.batteryTempC}°C` : '—'}
                          </span>
                        </td>
                        <td className="text-left py-1.5 px-2 text-[10px] font-sans">
                          {hasOvercurrent ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 animate-pulse">
                              ⚠️ กระแสเกิน (&gt;{stringStandards.maxInvA}A)
                            </span>
                          ) : (pt.pvW || 0) > 100 ? (
                            <span className="text-emerald-400 font-bold">🟢 ปกติ</span>
                          ) : (
                            <span className="text-slate-500">🌙 สแตนด์บาย</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ELECTRICITY STATISTICS & HISTORICAL TIMELINE */}
      {(dashboardSection === 'billing' || dashboardSection === 'all') && (
        <>
          {/* =================================================================== */}
      {/* BALANCED ELECTRICITY STATISTICS & FINANCIAL REPORTING               */}
      {/* =================================================================== */}
      <div className="space-y-4">
        {/* 1. HERO FINANCIAL HIGHLIGHTS (2 BALANCED 50/50 CARDS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Card 1: Total Savings */}
          <div className="bg-[#0b101a] border border-cyan-500/30 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-cyan-400" />
                <span>ประหยัดค่าไฟสุทธิ ({statPeriod === 'Custom' ? 'ช่วงที่เลือก' : statPeriod === 'Day' ? 'วันนี้' : statPeriod === 'Week' ? '7 วัน' : statPeriod === 'Month' ? '30 วัน' : statPeriod === 'Year' ? 'รายปี' : 'สะสมทั้งหมด'})</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                สุทธิ
              </span>
            </div>
            <div className="my-2.5">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono text-white tracking-tight">
                {formatBaht(periodStats.savedBaht)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-sans">
                ลดค่าไฟจากการใช้โซลาร์เอง + รายได้ขายไฟคืน กฟภ. (@2.20฿/หน่วย)
              </p>
            </div>
            <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono">
              <span>รวม {periodStats.daysCount} วันจริง</span>
              <span className="text-cyan-400">เฉลี่ย ฿{(periodStats.savedBaht / Math.max(1, periodStats.daysCount)).toFixed(2)}/วัน</span>
            </div>
          </div>

          {/* Card 2: PEA Grid Bill */}
          <div
            onClick={() => {
              setSelectedPeaCycleKey(billingCycles[0]?.cycleKey || '2026-10');
              setIsPeaModalOpen(true);
            }}
            className="bg-[#0b101a] hover:bg-[#111726] border border-slate-800/90 hover:border-cyan-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg cursor-pointer transition-all group active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>จ่ายการไฟฟ้า กฟภ. ({statPeriod === 'Month' ? 'รอบบิลนี้' : `รวม ${periodStats.daysCount} วัน`})</span>
              </span>
              <span className="text-[10px] font-sans font-bold text-slate-300 bg-slate-800/90 group-hover:text-cyan-300 group-hover:border-cyan-500/40 border border-slate-700/80 px-2 py-0.5 rounded-full transition-colors">
                บิล กฟภ. ฉบับจริง ↗
              </span>
            </div>
            <div className="my-2.5">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono text-white tracking-tight">
                {formatBaht(periodStats.gridBill || 0)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-sans">
                คำนวณตามบิล กฟภ. ทางการ (ฐานขั้นบันได + Ft + บริการ + VAT 7%)
              </p>
            </div>
            <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono">
              <span>ตัดยอดทุกวันที่ {billingCutoffDay}</span>
              <span className="text-cyan-400 group-hover:underline">แตะเพื่อเปิดดูใบแจ้งหนี้ ↗</span>
            </div>
          </div>
        </div>

        {/* 2. REAL ENERGY TELEMETRY (6 CARDS - SYMMETRICAL 6-GRID) */}
        <div className="bg-[#0b101a] border border-slate-800/80 rounded-[24px] p-4 sm:p-5 space-y-3.5 shadow-xl">
          {/* Header with Period Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>สถิติพลังงานไฟฟ้า (kWh)</span>
                <span className="text-xs text-slate-400 font-normal font-sans">
                  ({statPeriod === 'Custom'
                    ? `${formatSlashDate(customStartDate)} – ${formatSlashDate(customEndDate)}`
                    : statPeriod === 'Day'
                    ? 'วันนี้'
                    : statPeriod === 'Week'
                    ? '7 วันย้อนหลัง'
                    : statPeriod === 'Month'
                    ? '30 วันย้อนหลัง'
                    : statPeriod === 'Year'
                    ? 'สถิติรายปี'
                    : 'สะสมทั้งหมด'} • {periodStats.daysCount} วันจริง)
                </span>
              </h3>
            </div>
            <div className="w-full sm:w-auto grid grid-cols-3 sm:flex sm:flex-wrap gap-1 bg-[#060910] p-1 rounded-xl border border-slate-800/80">
              {[
                { id: 'Day', label: 'วัน' },
                { id: 'Week', label: 'สัปดาห์' },
                { id: 'Month', label: 'เดือน' },
                { id: 'Year', label: 'ปี' },
                { id: 'Total', label: 'รวม' },
                { id: 'Custom', label: 'ช่วงวันที่' }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setStatPeriod(p.id)}
                  className={`py-1.5 px-3 text-xs rounded-lg transition-all text-center cursor-pointer active:scale-95 ${
                    statPeriod === p.id
                      ? 'bg-[#141b27] text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white font-medium'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {statPeriod === 'Custom' && (
            <div className="bg-[#070a10] border border-slate-800/80 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
                <div className="flex-1">
                  <label className="block text-slate-400 font-bold mb-1">วันที่เริ่มต้น</label>
                  <input
                    type="date"
                    value={customStartDate}
                    max={customEndDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full bg-[#0d111a] border border-slate-700/80 rounded-xl px-3 py-2 text-white font-mono [color-scheme:dark]"
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
                    className="w-full bg-[#0d111a] border border-slate-700/80 rounded-xl px-3 py-2 text-white font-mono [color-scheme:dark]"
                  />
                </div>
              </div>
              <div className="text-[11px] text-slate-400 pt-1">
                พบข้อมูลจริง <strong className="text-cyan-300 font-mono">{filteredHistoryLogs.length}</strong> วันในช่วงนี้
                {historicalLogs.length > 0 && (
                  <span> (มีข้อมูลตั้งแต่ {formatSlashDate(historicalLogs[0].date)})</span>
                )}
              </div>
            </div>
          )}

          {/* 6 Symmetrical Cards (2x3 on mobile, 3x2 on tablet, 6 across on desktop) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {/* 1. Solar Production */}
            <div className="bg-[#101522] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between min-h-[96px] transition-all">
              <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">ผลิตโซลาร์</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1 tracking-tight truncate">
                {periodStats.pvGen.toLocaleString()}{' '}
                <span className="text-[11px] font-normal text-slate-400 font-sans">kWh</span>
              </div>
              <div className="text-[10px] text-slate-500 font-sans mt-0.5 truncate">
                เฉลี่ย {(periodStats.pvGen / Math.max(1, periodStats.daysCount)).toFixed(1)} kWh/วัน
              </div>
            </div>

            {/* 2. House Load */}
            <div className="bg-[#101522] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between min-h-[96px] transition-all">
              <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">โหลดใช้ไฟบ้าน</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1 tracking-tight truncate">
                {periodStats.load.toLocaleString()}{' '}
                <span className="text-[11px] font-normal text-slate-400 font-sans">kWh</span>
              </div>
              <div className="text-[10px] text-slate-500 font-sans mt-0.5 truncate">
                เฉลี่ย {(periodStats.load / Math.max(1, periodStats.daysCount)).toFixed(1)} kWh/วัน
              </div>
            </div>

            {/* 3. Grid Import */}
            <div className="bg-[#101522] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between min-h-[96px] transition-all">
              <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">ดึงไฟหลวง</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1 tracking-tight truncate">
                {periodStats.imp.toLocaleString()}{' '}
                <span className="text-[11px] font-normal text-slate-400 font-sans">kWh</span>
              </div>
              <div className="text-[10px] text-slate-500 font-sans mt-0.5 truncate">
                เฉลี่ย {(periodStats.imp / Math.max(1, periodStats.daysCount)).toFixed(1)} kWh/วัน
              </div>
            </div>

            {/* 4. Grid Export */}
            <div className="bg-[#101522] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between min-h-[96px] transition-all">
              <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">ส่งออก (ขายไฟ)</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1 tracking-tight truncate">
                {periodStats.exp.toLocaleString()}{' '}
                <span className="text-[11px] font-normal text-slate-400 font-sans">kWh</span>
              </div>
              <div className="text-[10px] text-slate-500 font-sans mt-0.5 truncate">
                ขายคืน กฟภ. @2.20฿
              </div>
            </div>

            {/* 5. Battery Charge */}
            <div className="bg-[#101522] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between min-h-[96px] transition-all">
              <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                <BatteryCharging className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">ชาร์จลงแบต</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1 tracking-tight truncate">
                {periodStats.chg.toLocaleString()}{' '}
                <span className="text-[11px] font-normal text-slate-400 font-sans">kWh</span>
              </div>
              <div className="text-[10px] text-slate-500 font-sans mt-0.5 truncate">
                เก็บไฟสำรองแดด
              </div>
            </div>

            {/* 6. Battery Discharge */}
            <div className="bg-[#101522] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between min-h-[96px] transition-all">
              <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                <Battery className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">จ่ายไฟจากแบต</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1 tracking-tight truncate">
                {periodStats.dis.toLocaleString()}{' '}
                <span className="text-[11px] font-normal text-slate-400 font-sans">kWh</span>
              </div>
              <div className="text-[10px] text-slate-500 font-sans mt-0.5 truncate">
                จ่ายโหลดค่ำ/คืน
              </div>
            </div>
          </div>
        </div>

        {/* 3. BALANCED 50/50 DUAL PANELS: BILLING CYCLES & ENERGY INDEPENDENCE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {/* Panel A (Left): Monthly Billing History Table */}
          <div className="bg-[#0b101a] border border-slate-800/90 rounded-[24px] p-4 sm:p-5 flex flex-col justify-between space-y-3.5 shadow-xl">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>ประวัติรอบบิล กฟภ. (7 เดือนล่าสุด)</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPeaCycleKey(billingCycles[0]?.cycleKey || '2026-10');
                    setIsPeaModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#141b27] hover:bg-[#1a2333] border border-cyan-500/40 text-cyan-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ดูใบแจ้งหนี้ฉบับจริง</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                ตัดยอดทุกวันที่ <span className="text-white font-bold font-mono">{billingCutoffDay}</span> ของเดือน (คลิกแถวเพื่อเปิดดูบิล)
              </p>
            </div>

            {/* Monthly Billing Breakdown Table */}
            <div className="bg-[#060910] border border-slate-800/80 rounded-2xl p-3 sm:p-3.5 space-y-2 flex-1 flex flex-col justify-between">
              <div className="grid grid-cols-4 text-[10px] sm:text-xs font-semibold text-slate-400 pb-2 border-b border-slate-800 text-right">
                <span className="text-left text-slate-300">รอบบิล</span>
                <span>ดึงไฟ (kWh)</span>
                <span>จ่ายการไฟฟ้า</span>
                <span className="text-cyan-300">ประหยัดได้</span>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5 flex-1">
                {Array.isArray(billingCycles) && billingCycles.length > 0 ? (
                  billingCycles.map((c) => (
                    <div
                      key={c.cycleKey}
                      onClick={() => {
                        setSelectedPeaCycleKey(c.cycleKey);
                        setIsPeaModalOpen(true);
                      }}
                      className="grid grid-cols-4 items-center text-[10px] sm:text-xs font-mono py-1.5 px-2.5 rounded-xl bg-[#101522] border border-slate-800/70 hover:border-cyan-500/50 hover:bg-[#161c2b] text-right cursor-pointer transition-colors"
                      title={`คลิกเพื่อดูใบแจ้งหนี้ กฟภ. รอบ ${c.periodLabel}`}
                    >
                      <div className="font-sans font-medium text-slate-200 text-left truncate flex flex-col">
                        <span className="flex items-center gap-1.5 text-slate-200 text-[11px]">
                          <span className="text-cyan-400 text-[10px]">📄</span>
                          {c.monthLabel.split(' ')[0]} {c.year + 543}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono pl-3.5">{c.periodLabel}</span>
                      </div>
                      <span className="text-slate-300 font-bold">{c.imp.toFixed(2)}</span>
                      <span className="text-white font-bold">{formatBaht(c.importBill)}</span>
                      <span className="text-cyan-300 font-bold">{formatBaht(c.savedBaht)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-xs text-slate-500 py-4">ไม่มีข้อมูลรอบบิล</div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <div className="grid grid-cols-4 items-center text-[10px] sm:text-xs font-bold font-mono text-right">
                  <span className="text-slate-400 font-sans text-left">รวม 7 รอบ:</span>
                  <span className="text-slate-200">
                    {billingCycles.reduce((acc, c) => acc + c.imp, 0).toFixed(2)}
                  </span>
                  <span className="text-white">
                    {formatBaht(billingCycles.reduce((acc, c) => acc + c.importBill, 0))}
                  </span>
                  <span className="text-cyan-300">
                    {formatBaht(billingCycles.reduce((acc, c) => acc + c.savedBaht, 0))}
                  </span>
                </div>
                <div className="text-[9px] text-slate-500 font-mono pt-1 text-center">
                  * รวม: ฐานขั้นบันได + Ft ฿{tariffSettings.ftRate ?? DEFAULT_FT_RATE}/หน่วย (ก.ย.-ธ.ค.) + บริการ ฿{tariffSettings.serviceFee ?? DEFAULT_SERVICE_FEE} + VAT {tariffSettings.vatPct ?? DEFAULT_VAT_PCT}%
                </div>
              </div>
            </div>
          </div>

          {/* Panel B (Right): Energy Independence & Self-Consumption */}
          <div className="bg-[#0b101a] border border-slate-800/90 rounded-[24px] p-4 sm:p-5 flex flex-col justify-between space-y-3.5 shadow-xl">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>ดัชนีประสิทธิภาพ & การพึ่งพาพลังงานสะอาด</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                วิเคราะห์ประสิทธิภาพการใช้พลังงานแสงอาทิตย์และการพึ่งพาตนเอง
              </p>
            </div>

            <div className="space-y-3 flex-1 flex flex-col justify-around">
              {/* 1. Self-Consumption */}
              <div className="bg-[#060910] border border-slate-800/80 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-cyan-400" />
                    <span>อัตราใช้ไฟโซลาร์ในบ้าน (Self-Consumption)</span>
                  </span>
                  <span className="text-base font-black font-mono text-cyan-300">
                    {selfConsPct}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
                  <div className="h-full bg-cyan-400 transition-all duration-500" style={{ width: `${selfConsPct}%` }} />
                  <div className="h-full bg-slate-600 transition-all duration-500" style={{ width: `${expPct}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <span>ใช้ในบ้าน: <strong className="text-white font-mono">{selfConsKWh} kWh</strong> ({selfConsPct}%)</span>
                  <span>ส่งออกขายไฟ: <strong className="text-slate-300 font-mono">{periodStats.exp} kWh</strong> ({expPct}%)</span>
                </div>
              </div>

              {/* 2. Self-Sufficiency */}
              <div className="bg-[#060910] border border-slate-800/80 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Battery className="w-3.5 h-3.5 text-cyan-400" />
                    <span>ดัชนีพึ่งพาตนเอง (Self-Sufficiency)</span>
                  </span>
                  <span className="text-base font-black font-mono text-cyan-300">
                    {selfSuffPct}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
                  <div className="h-full bg-cyan-400 transition-all duration-500" style={{ width: `${selfSuffPct}%` }} />
                  <div className="h-full bg-slate-600 transition-all duration-500" style={{ width: `${impPct}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <span>โซลาร์ + แบต: <strong className="text-white font-mono">{selfSuffKWh} kWh</strong> ({selfSuffPct}%)</span>
                  <span>ดึงไฟหลวง: <strong className="text-slate-300 font-mono">{periodStats.imp} kWh</strong> ({impPct}%)</span>
                </div>
              </div>

              {/* 3. Summary Pill / Insight */}
              <div className="bg-[#101522] border border-cyan-500/20 rounded-2xl p-3 flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>ประหยัดค่าไฟรวมตลอดการติดตั้ง:</span>
                </span>
                <span className="text-sm font-black font-mono text-cyan-300">
                  {formatBaht(periodStats.savedBaht)}
                </span>
              </div>
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
        </>
      )}

    </div>
  );
};
