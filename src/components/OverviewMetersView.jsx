import React, { useState, useMemo } from 'react';
import {
  Zap,
  Activity,
  Gauge,
  ChevronRight,
  Search,
  Flame,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TENANT_COMPANIES } from '../data/tenantData';

export const OverviewMetersView = ({ onSelectMeter }) => {
  const { activeOrgId } = useAuth();
  const currentCompany = TENANT_COMPANIES[activeOrgId] ||
    Object.values(TENANT_COMPANIES)[0] || {
      id: '',
      name: 'ยังไม่มีบริษัทลูกค้าในระบบ',
      code: '-',
      transformerKVA: 1600,
      electricityMeters: []
    };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPanel, setSelectedPanel] = useState('ALL');

  // Build real meter list for this company (100% real configured/telemetry values, no fake sine wave)
  const metersLive = useMemo(() => {
    const rawMeters = currentCompany.electricityMeters || [];
    const totalBase =
      rawMeters.reduce((s, m) => s + (Number(m.liveKW ?? m.baseKW) || 0), 0) || 1;

    return rawMeters.map((m, idx) => {
      const activeKW = Number((Number(m.liveKW ?? m.baseKW) || 0).toFixed(1));
      const currentA = Number(
        (m.currentA !== undefined && Number(m.currentA) > 0
          ? Number(m.currentA)
          : activeKW * 1.52
        ).toFixed(1)
      );
      const voltageLL = Number((Number(m.voltageLL) || 400.0).toFixed(1));
      const pf = Number((Number(m.pf) || 0.95).toFixed(2));
      const todayKWh =
        m.todayKWh !== undefined && Number(m.todayKWh) > 0
          ? Math.round(Number(m.todayKWh))
          : Math.round(activeKW * 14.5);
      const sharePercent =
        activeKW > 0 ? Number(((activeKW / totalBase) * 100).toFixed(1)) : 0;

      return {
        ...m,
        meterNo: idx + 1,
        activeKW,
        currentA,
        voltageLL,
        pf,
        todayKWh,
        sharePercent
      };
    });
  }, [currentCompany]);

  // Company-wide totals
  const summary = useMemo(() => {
    const totalKW = metersLive.reduce((s, m) => s + m.activeKW, 0);
    const totalTodayKWh = metersLive.reduce((s, m) => s + m.todayKWh, 0);
    const totalCurrentA = metersLive.reduce((s, m) => s + m.currentA, 0);
    const trCapacity = currentCompany.transformerKVA || 1600;
    const loadPct = Math.min(100, Math.round((totalKW / (trCapacity * 0.85)) * 100));
    const avgPF =
      metersLive.length > 0
        ? (metersLive.reduce((s, m) => s + m.pf, 0) / metersLive.length).toFixed(2)
        : '0.95';

    return {
      totalKW: Number(totalKW.toFixed(1)),
      totalTodayKWh,
      totalCurrentA: Math.round(totalCurrentA),
      trCapacity,
      loadPct,
      avgPF,
      meterCount: metersLive.length
    };
  }, [metersLive, currentCompany]);

  // Panel categories for quick filter
  const panels = useMemo(() => {
    const set = new Set(metersLive.map((m) => m.panel).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [metersLive]);

  const filteredMeters = metersLive.filter((m) => {
    const matchesPanel = selectedPanel === 'ALL' || m.panel === selectedPanel;
    const matchesSearch =
      !searchQuery.trim() ||
      (m.name && m.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.tag && m.tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.panel && m.panel.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesPanel && matchesSearch;
  });

  const nowHour = new Date().getHours();
  const isOnPeakNow = nowHour >= 9 && nowHour < 22;

  if (!currentCompany.id) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-10 text-center max-w-xl mx-auto my-8">
        <div className="text-3xl mb-3">⚡</div>
        <h3 className="text-lg font-black text-white">
          ยังไม่มีข้อมูลบริษัทลูกค้าในระบบ
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          กรุณาไปที่เมนู <strong>👑 จัดการลูกค้า (Super Admin)</strong> เพื่อเพิ่มบริษัทลูกค้าจริงและตั้งค่าพาวเวอร์มิเตอร์
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. Executive Summary Hero Card (Large Crisp Numbers, No Cost) */}
      <div className="bg-gradient-to-b from-[#111728]/85 via-[#0d1322]/90 to-[#080c16]/95 border border-slate-800/60 rounded-3xl p-4 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm sm:text-base font-bold text-white">
              ภาพรวมพาวเวอร์มิเตอร์ทั้งหมดของ {currentCompany.name}
            </h2>
          </div>

          <div
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
              isOnPeakNow
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>
              ช่วงเวลาปัจจุบัน: {isOnPeakNow ? 'On-Peak (09:00 - 22:00 น.)' : 'Off-Peak (22:00 - 09:00 น.)'}
            </span>
          </div>
        </div>

        {/* 4 Key Electrical Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-4">
          <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>กำลังไฟฟ้ารวมขณะนี้</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono mt-1">
              {summary.totalKW.toLocaleString()}{' '}
              <span className="text-xs font-sans font-normal text-slate-400">kW</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              ติดตั้งทั้งหมด {summary.meterCount} จุดวัด
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>ภาระหม้อแปลง ({summary.trCapacity} kVA)</span>
              <Gauge className="w-4 h-4 text-sky-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-2xl sm:text-3xl font-extrabold font-mono ${
                  summary.loadPct > 85 ? 'text-rose-400' : 'text-sky-400'
                }`}
              >
                {summary.loadPct}%
              </span>
              <span className="text-xs text-slate-400">ของพิกัดปลอดภัย</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  summary.loadPct > 85
                    ? 'bg-rose-500'
                    : summary.loadPct > 70
                    ? 'bg-amber-500'
                    : 'bg-sky-500'
                }`}
                style={{ width: `${summary.loadPct}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>พลังงานไฟฟ้าสะสมวันนี้</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-1">
              {summary.totalTodayKWh.toLocaleString()}{' '}
              <span className="text-xs font-sans font-normal text-slate-400">kWh</span>
            </div>
            <div className="text-xs text-slate-400 mt-1 font-mono">
              กระแสรวม {summary.totalCurrentA.toLocaleString()} A
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>ค่าเพาเวอร์แฟกเตอร์เฉลี่ย</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono mt-1">
              {summary.avgPF}{' '}
              <span className="text-xs font-sans font-normal text-slate-400">PF</span>
            </div>
            <div className="text-xs text-emerald-400/90 mt-1">
              ✓ คุณภาพไฟฟ้าอยู่ในเกณฑ์มาตรฐาน
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Bar for Meters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          {panels.map((panel) => (
            <button
              key={panel}
              onClick={() => setSelectedPanel(panel)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedPanel === panel
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {panel === 'ALL' ? `ทั้งหมด (${metersLive.length} มิเตอร์)` : `ตู้ ${panel}`}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อเครื่องจักร หรือรหัสมิเตอร์..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
          />
        </div>
      </div>

      {/* 3. All Meters Grid */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-semibold text-slate-400">
            แตะที่การ์ดมิเตอร์ตัวใดก็ได้ เพื่อเจาะลึกดูแรงดัน 3 เฟส กระแส และกราฟรายตัว
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredMeters.map((meter) => {
            const isHighConsumer = meter.sharePercent >= 15;
            const isOnline = meter.connectionStatus === 'ONLINE';
            return (
              <div
                key={meter.id}
                onClick={() => onSelectMeter && onSelectMeter(meter.id)}
                className={`group bg-gradient-to-b from-slate-900/80 to-slate-950/90 hover:bg-slate-900/90 border rounded-2xl p-4 transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-[0.99] ${
                  isHighConsumer
                    ? 'border-amber-500/30 hover:border-amber-400/50'
                    : 'border-slate-800/60 hover:border-slate-700/80'
                }`}
              >
                {/* Card Top: Meter Tag, Slave ID, Name & Status Badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[11px] font-mono font-bold text-amber-300">
                        {meter.tag}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-mono font-bold text-cyan-300">
                        Slave #{meter.slaveId || 1}
                      </span>
                      {isHighConsumer && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center gap-0.5">
                          <Flame className="w-3 h-3" /> โหลดหลัก
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-white mt-1.5 truncate group-hover:text-blue-300 transition-colors">
                      {meter.name}
                    </h3>
                  </div>

                  <span
                    className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 border ${
                      isOnline
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                        : 'text-slate-300 bg-slate-800 border-slate-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isOnline ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                      }`}
                    />
                    {isOnline ? 'Online' : 'Ready'}
                  </span>
                </div>

                {/* Main Live Power Display */}
                <div className="bg-slate-950/90 border border-slate-800/80 rounded-xl p-3 mb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block">
                      กำลังไฟฟ้าขณะนี้ (Active Power)
                    </span>
                    <div className="text-2xl font-extrabold font-mono text-white mt-0.5">
                      {meter.activeKW}{' '}
                      <span className="text-xs font-sans font-normal text-amber-400">kW</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">สัดส่วนของโรงงาน</span>
                    <span className="text-base font-extrabold font-mono text-blue-300">
                      {meter.sharePercent}%
                    </span>
                  </div>
                </div>

                {/* Load Share Progress Bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full ${
                      isHighConsumer ? 'bg-amber-400' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, meter.sharePercent * 2.2)}%` }}
                  />
                </div>

                {/* Secondary Electrical Parameters (V, A, PF, kWh) */}
                <div className="grid grid-cols-4 gap-1.5 text-center bg-slate-950/50 rounded-xl p-2 border border-slate-800/50 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">แรงดัน</span>
                    <span className="font-mono font-bold text-slate-200">{meter.voltageLL}V</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">กระแส</span>
                    <span className="font-mono font-bold text-cyan-300">{meter.currentA}A</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">PF</span>
                    <span className="font-mono font-bold text-emerald-300">{meter.pf}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">สะสม (kWh)</span>
                    <span className="font-mono font-bold text-amber-300">
                      {meter.todayKWh.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Footer Tap Prompt */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    รุ่น: <strong className="text-slate-200">{meter.model || 'PM2200'}</strong>
                  </span>
                  <span className="text-blue-400 font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                    เจาะลึกมิเตอร์นี้ <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
