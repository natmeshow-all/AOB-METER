import React, { useState, useMemo } from 'react';
import { Calendar, Flame, AlertCircle, Clock, Info } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * EnergyIntensityHeatmap
 * 24x7 Weekly Matrix Heatmap (Inspired by Dexma Spacewell & EcoStruxure)
 * Reveals energy consumption patterns, peak shift anomalies, and weekend standby power leaks.
 */
export function EnergyIntensityHeatmap({ baseKW = 450 }) {
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';
  const [hoveredCell, setHoveredCell] = useState(null);

  const daysOfWeek = isEn
    ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    : ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Generate 7x24 Matrix based on realistic factory operating patterns
  const heatmapData = useMemo(() => {
    return dayKeys.map((dayKey, dayIdx) => {
      const isWeekend = dayIdx >= 5;
      const hourly = [];

      for (let hour = 0; hour < 24; hour++) {
        let loadFactor = 0.35; // Night standby baseline

        if (!isWeekend) {
          // Weekday Shift 1 & 2 (08:00 - 20:00)
          if (hour >= 8 && hour <= 12) loadFactor = 0.88 + Math.sin(hour) * 0.08;
          else if (hour > 12 && hour <= 13) loadFactor = 0.65; // Lunch break
          else if (hour > 13 && hour <= 18) loadFactor = 0.95 + Math.cos(hour) * 0.05; // Peak production
          else if (hour > 18 && hour <= 22) loadFactor = 0.72; // Evening shift
          else loadFactor = 0.32 + (hour === 2 ? 0.25 : 0); // Night shift / clean
        } else if (dayIdx === 5) {
          // Saturday half-day production
          if (hour >= 8 && hour <= 14) loadFactor = 0.68;
          else loadFactor = 0.28;
        } else {
          // Sunday: Idle / Maintenance leak anomaly around 01:00 - 04:00
          if (hour >= 1 && hour <= 4) loadFactor = 0.48; // Potential air compressor leak!
          else loadFactor = 0.22;
        }

        const valueKW = Math.round(baseKW * loadFactor);
        hourly.push({
          hour,
          dayLabel: daysOfWeek[dayIdx],
          hourLabel: `${String(hour).padStart(2, '0')}:00`,
          valueKW,
          loadFactor: Math.min(1.0, loadFactor)
        });
      }
      return {
        dayKey,
        dayLabel: daysOfWeek[dayIdx],
        hourly
      };
    });
  }, [baseKW]);

  // Color generator based on intensity
  const getCellColor = (factor) => {
    if (factor >= 0.85) return 'bg-rose-500 text-white';
    if (factor >= 0.70) return 'bg-amber-500 text-slate-950';
    if (factor >= 0.50) return 'bg-amber-400/80 text-slate-950';
    if (factor >= 0.35) return 'bg-emerald-600/70 text-white';
    return 'bg-slate-850/60 text-slate-400 border border-slate-800/40';
  };

  return (
    <div className="bg-gradient-to-br from-[#0c1424] via-[#080d1a] to-[#050811] border border-slate-800/80 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              {isEn ? '24×7 Energy Intensity Heatmap' : 'ปฏิทินความร้อนการใช้ไฟฟ้า (24×7 Energy Intensity Heatmap)'}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Pattern Matrix
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {isEn
                ? 'Reveals 7-day 24-hour load patterns, off-hour baseline leaks, and weekend standby anomalies.'
                : 'วิเคราะห์พฤติกรรมการกินไฟรายชั่วโมงทั้ง 7 วัน เผยจุดรั่วไหลนอกเวลางานและช่วงวันหยุด'}
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
          <span>{isEn ? 'Standby' : 'สแตนด์บาย'}</span>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded bg-slate-850 border border-slate-700" />
            <span className="w-3.5 h-3.5 rounded bg-emerald-600/70" />
            <span className="w-3.5 h-3.5 rounded bg-amber-400/80" />
            <span className="w-3.5 h-3.5 rounded bg-amber-500" />
            <span className="w-3.5 h-3.5 rounded bg-rose-500" />
          </div>
          <span className="text-rose-400 font-bold">{isEn ? 'Heavy Peak' : 'พีคหนัก'}</span>
        </div>
      </div>

      {/* Heatmap Grid Matrix (Mobile Horizontal Scrollable) */}
      <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin scrollbar-thumb-slate-700">
        <div className="min-w-[620px]">
          {/* Hour Numbers Header (00 to 23) */}
          <div className="grid grid-cols-[70px_repeat(24,1fr)] gap-1 text-[9px] font-mono text-slate-500 text-center mb-1.5">
            <span className="text-left font-bold text-slate-400">{isEn ? 'Day / Hr' : 'วัน / ชม.'}</span>
            {Array.from({ length: 24 }).map((_, h) => (
              <span key={h} className={h === 12 || h === 18 ? 'font-bold text-sky-400' : ''}>
                {String(h).padStart(2, '0')}
              </span>
            ))}
          </div>

          {/* Day Rows */}
          <div className="space-y-1.5">
            {heatmapData.map((row) => (
              <div key={row.dayKey} className="grid grid-cols-[70px_repeat(24,1fr)] gap-1 items-center">
                <span className="text-xs font-bold text-slate-300 truncate">
                  {row.dayLabel}
                </span>

                {row.hourly.map((cell) => (
                  <button
                    key={cell.hour}
                    type="button"
                    onMouseEnter={() => setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => setHoveredCell(cell)}
                    className={`h-7 rounded-md transition-all duration-150 cursor-pointer flex items-center justify-center text-[9px] font-mono hover:scale-110 hover:z-20 hover:shadow-lg ${getCellColor(
                      cell.loadFactor
                    )}`}
                    title={`${cell.dayLabel} ${cell.hourLabel}: ${cell.valueKW} kW`}
                  >
                    {cell.loadFactor >= 0.85 ? (
                      <span className="font-bold">!</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hovered Cell Detail HUD */}
      {hoveredCell ? (
        <div className="p-3 rounded-2xl bg-slate-900 border border-sky-500/40 text-xs flex items-center justify-between text-white animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400" />
            <span>
              <strong>{hoveredCell.dayLabel}</strong> {isEn ? 'at' : 'เวลา'} <strong>{hoveredCell.hourLabel} {isEn ? '' : 'น.'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">{isEn ? 'Active Demand:' : 'กำลังไฟบริโภค:'}</span>
            <span className="text-base font-black font-mono text-amber-400">
              {hoveredCell.valueKW.toLocaleString()} kW
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {Math.round(hoveredCell.loadFactor * 100)}% {isEn ? 'Load' : 'โหลด'}
            </span>
          </div>
        </div>
      ) : (
        /* Intelligent Energy Leak Insight */
        <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-600/30 text-xs text-amber-200/90 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {isEn ? (
              <>
                <strong>Energy Leak Detected:</strong> Sunday between <strong>01:00 - 04:00</strong> recorded continuous idle load averaging ~216 kW (48% of peak capacity). Recommend auditing air compressors and centralized HVAC chillers for off-hour idling.
              </>
            ) : (
              <>
                <strong>ตรวจพบจุดรั่วไหลพลังงาน (Energy Leak Detected):</strong> วันอาทิตย์ช่วงเวลา <strong>01:00 - 04:00 น.</strong> มีการกินไฟแช่ค้างเฉลี่ย ~216 kW (คิดเป็น 48% ของโหลด) แนะนำให้ตรวจสอบระบบเครื่องอัดลม (Air Compressor) หรือแอร์ส่วนกลางว่ามีเครื่องใดเปิดค้างไว้หรือไม่
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
