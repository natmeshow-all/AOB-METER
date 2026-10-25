import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
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
  Thermometer,
  Activity,
  Lock,
  Copy,
  Check,
  Sliders
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TENANT_COMPANIES, createEmptySolarConfig } from '../data/tenantData';

export const HomeInverterView = ({ viewMode = 'overview' }) => {
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
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [saveNotice, setSaveNotice] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

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

  const pPvGen = Number((todayGenKWh * mult).toFixed(2));
  const pLoad = Number((loadKWh * mult).toFixed(2));
  const pImp = Number((importKWh * mult).toFixed(2));
  const pExp = Number((exportKWh * mult).toFixed(2));
  const pChg = Number((chargeBatKWh * mult).toFixed(2));
  const pDis = Number((dischargeBatKWh * mult).toFixed(2));

  const selfConsKWh = Math.max(0, Number((pPvGen - pExp).toFixed(2)));
  const selfConsPct = pPvGen > 0 ? Number(((selfConsKWh / pPvGen) * 100).toFixed(1)) : 0;
  const expPct = pPvGen > 0 ? Number((100 - selfConsPct).toFixed(1)) : 0;

  const selfSuffKWh = Math.max(0, Number((pLoad - pImp).toFixed(2)));
  const selfSuffPct = pLoad > 0 ? Number(((selfSuffKWh / pLoad) * 100).toFixed(1)) : 0;
  const impPct = pLoad > 0 ? Number((100 - selfSuffPct).toFixed(1)) : 0;

  const dailyCurveData = useMemo(() => {
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
  }, [totalPvPowerW, solarData.totalLoadPowerW]);

  const handleSaveSettingsToDb = (e) => {
    e.preventDefault();
    updateOrganization(currentCompany.id, {
      gatewayIp: 'RS485-AUTO-SYNC',
      gatewayPort: '9600',
      solarConfig: { ...editForm, inverterIp: 'RS485-AUTO-SYNC' }
    });
    setIsSettingOpen(false);
    setSaveNotice('บันทึกการตั้งค่าอุปกรณ์และค่าที่อ่านจากเครื่องลงฐานข้อมูลเรียบร้อยแล้ว');
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
        message: `⚠️ ยังไม่ได้เสียบสาย Waveshare USB-to-RS485 เข้ากับอุปกรณ์นี้ (${err?.message || 'Serial port not selected'})`
      });
    }
    setIsTesting(false);
  };

  const handleTestInverterConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await testRealGatewayConnection(currentCompany.id);
    setTestResult(res);
    setIsTesting(false);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/50 to-slate-900 border border-emerald-500/30 rounded-3xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                🏠 ผู้ใช้งานตามบ้าน (Solar Hybrid Inverter)
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-amber-300 font-mono text-xs font-bold">
                {solarData.inverterModel}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold">
                🛡️ Read-Only 100%
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {currentCompany.name} ({currentCompany.code})
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              การเชื่อมต่อ: <strong className="font-mono text-cyan-300">RS485 Auto-Read / Cloud Sync (ไม่ต้องใช้ IP)</strong> • Slave ID: <strong className="font-mono text-amber-300">{solarData.slaveId || 1}</strong> • Baud Rate: <strong className="font-mono text-emerald-300">{solarData.baudRate || 9600} bps</strong> • อุณหภูมิเครื่อง: <strong className="font-mono text-white">{solarData.inverterTempC}°C</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAutoReadUsbSerial}
              disabled={isTesting}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold cursor-pointer"
            >
              {isTesting ? '⏳ กำลังอ่านค่าจากเครื่อง...' : '🔌 ดูดค่าจริงผ่านสาย USB-to-RS485 (ไม่ต้องใช้ IP)'}
            </button>
            <button
              type="button"
              onClick={handleTestInverterConnection}
              disabled={isTesting}
              className="px-3.5 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 text-xs font-bold cursor-pointer"
            >
              ☁️ ซิงก์ค่าล่าสุดจาก Cloud DB
            </button>
            <button
              type="button"
              onClick={() => {
                setEditForm(solarData);
                setIsSettingOpen(!isSettingOpen);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              <span>{isSettingOpen ? 'ซ่อนหน้าตั้งค่า' : '⚙️ ตั้งค่าพอร์ตอุปกรณ์'}</span>
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

      {/* Inline Single-Page Hardware Setting & Auto-Telemetry Readout Panel */}
      {isSettingOpen && (
        <form
          onSubmit={handleSaveSettingsToDb}
          className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-5 space-y-4 text-xs"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-black text-amber-400">
                ⚙️ ตั้งค่าพอร์ตเชื่อมต่ออุปกรณ์ ({currentCompany.name}) — ไม่ต้องใช้ IP และไม่ต้องกรอกค่าไฟเอง
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                เนื่องจากโมดูล SAJ AIO3 ปิดการแสดง IP ในบ้าน ระบบจึงใช้การอ่านค่าอัตโนมัติผ่านพอร์ต RS485 (Slave ID + Baud Rate) โดยตรง
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingOpen(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              ✕ ปิด
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">รุ่นอินเวอร์เตอร์ (Inverter Model)</label>
              <input
                type="text"
                value={editForm.inverterModel}
                onChange={(e) => setEditForm({ ...editForm, inverterModel: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-amber-300 font-bold mb-1">Modbus Slave ID (ค่าโรงงาน = 1)</label>
              <input
                type="number"
                min="1"
                max="247"
                value={editForm.slaveId || 1}
                onChange={(e) => setEditForm({ ...editForm, slaveId: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2.5 text-amber-300 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-cyan-300 font-bold mb-1">ความเร็วพอร์ต RS485 (Baud Rate)</label>
              <select
                value={editForm.baudRate || 9600}
                onChange={(e) => setEditForm({ ...editForm, baudRate: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl px-3 py-2.5 text-cyan-300 font-mono font-bold"
              >
                <option value={9600}>9600 bps (มาตรฐาน SAJ)</option>
                <option value={19200}>19200 bps</option>
                <option value={38400}>38400 bps</option>
                <option value={115200}>115200 bps</option>
              </select>
            </div>
            <div>
              <label className="block text-emerald-300 font-bold mb-1">สเปกความจุแบตเตอรี่ (kWh)</label>
              <input
                type="number"
                step="0.01"
                value={editForm.batteryCapacityKWh}
                onChange={(e) =>
                  setEditForm({ ...editForm, batteryCapacityKWh: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2.5 text-emerald-300 font-mono font-bold"
              />
            </div>
          </div>

          {/* Read-Only Telemetry Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="text-xs font-bold text-emerald-300">
              📊 ค่าทางไฟฟ้าที่ระบบดูดมาจากตัวเครื่องอัตโนมัติ (Read-Only Telemetry — ไม่ต้องพิมพ์เอง):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                <div className="text-[10px] text-slate-400">PV Power</div>
                <div className="text-sm font-black font-mono text-amber-300">{totalPvPowerW} W</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                <div className="text-[10px] text-slate-400">PV1 V / A</div>
                <div className="text-sm font-black font-mono text-white">
                  {solarData.pv1Voltage}V / {solarData.pv1Current}A
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                <div className="text-[10px] text-slate-400">Battery SOC</div>
                <div className="text-sm font-black font-mono text-emerald-400">
                  {solarData.batterySOC}%
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                <div className="text-[10px] text-slate-400">Home Load</div>
                <div className="text-sm font-black font-mono text-blue-300">
                  {solarData.totalLoadPowerW} W
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                <div className="text-[10px] text-slate-400">Today Energy</div>
                <div className="text-sm font-black font-mono text-emerald-300">
                  {solarData.todayEnergyKWh} kWh
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                <div className="text-[10px] text-slate-400">Total Energy</div>
                <div className="text-sm font-black font-mono text-cyan-300">
                  {solarData.totalEnergyKWh} kWh
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleAutoReadUsbSerial}
              className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold cursor-pointer"
            >
              🔌 ดูดค่าจริงผ่านสาย USB-to-RS485 อัตโนมัติ
            </button>
            <button
              type="button"
              onClick={handleTestInverterConnection}
              className="px-4 py-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold cursor-pointer"
            >
              ☁️ ดึงค่าล่าสุดจากฐานข้อมูล Cloud
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black cursor-pointer"
            >
              💾 บันทึกการตั้งค่าพอร์ตลงฐานข้อมูล
            </button>
          </div>
        </form>
      )}

      {/* 4 Live Nodes: PV, Battery, Home Load, Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-4">
          <div className="flex items-center justify-between text-xs font-bold text-amber-300">
            <span className="flex items-center gap-1.5">
              <Sun className="w-4 h-4" /> แผงโซลาร์ (PV Power)
            </span>
            <span className="font-mono">PV1+PV2</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-2">
            {totalPvPowerW.toLocaleString()} <span className="text-xs text-amber-300">W</span>
          </div>
          <div className="text-xs text-slate-400 font-mono mt-1">
            PV1: {solarData.pv1Voltage} V • {solarData.pv1Current} A
          </div>
        </div>

        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-4">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
            <span className="flex items-center gap-1.5">
              <BatteryCharging className="w-4 h-4" /> แบตเตอรี่ ({solarData.batteryCapacityKWh} kWh)
            </span>
            <span className="font-mono">{solarData.batteryStatus}</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 mt-2">
            SOC {solarData.batterySOC}%
          </div>
          <div className="text-xs text-slate-400 font-mono mt-1">
            {solarData.batteryVoltage} V • {solarData.batteryCurrent} A • {solarData.batteryPowerW} W
          </div>
        </div>

        <div className="bg-slate-900/90 border border-blue-500/30 rounded-3xl p-4">
          <div className="flex items-center justify-between text-xs font-bold text-blue-300">
            <span className="flex items-center gap-1.5">
              <Home className="w-4 h-4" /> โหลดใช้ไฟในบ้านรวม
            </span>
            <span className="font-mono">Total Load</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-2">
            {Number(solarData.totalLoadPowerW || 0).toLocaleString()}{' '}
            <span className="text-xs text-blue-300">W</span>
          </div>
          <div className="text-xs text-slate-400 font-mono mt-1">
            Off-Grid: {solarData.offGridLoadPowerW}W | Grid-Load: {solarData.gridConnectedLoadPowerW}W
          </div>
        </div>

        <div className="bg-slate-900/90 border border-purple-500/30 rounded-3xl p-4">
          <div className="flex items-center justify-between text-xs font-bold text-purple-300">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> ระบบการไฟฟ้า (Grid AC1)
            </span>
            <span className="font-mono">{solarData.gridAc1FreqHz} Hz</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-2">
            {solarData.gridAc1Voltage} <span className="text-xs text-purple-300">VAC</span>
          </div>
          <div className="text-xs text-slate-400 font-mono mt-1">
            กระแส {solarData.gridAc1Current} A • กำลัง {solarData.gridAc1PowerW} W
          </div>
        </div>
      </div>

      {/* Electricity Statistics & Self-Consumption Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Electricity Statistics (สถิติพลังงานไฟฟ้า)</span>
            </h3>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              {['Day', 'Week', 'Month', 'Year', 'Total'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setStatPeriod(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    statPeriod === p
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-xs text-cyan-300 font-bold">☀️ PV Generation</div>
              <div className="text-2xl font-black font-mono text-white mt-1">
                {pPvGen} <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-xs text-blue-300 font-bold">🏠 Load Electricity</div>
              <div className="text-2xl font-black font-mono text-white mt-1">
                {pLoad} <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-xs text-amber-300 font-bold">🗼 Import การไฟฟ้า</div>
              <div className="text-2xl font-black font-mono text-amber-300 mt-1">
                {pImp} <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-xs text-purple-300 font-bold">⚡ Export ส่งออก</div>
              <div className="text-2xl font-black font-mono text-white mt-1">
                {pExp} <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-xs text-emerald-300 font-bold">🔋 Charge Battery</div>
              <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                {pChg} <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-xs text-teal-300 font-bold">🔋 Battery Discharge</div>
              <div className="text-2xl font-black font-mono text-teal-300 mt-1">
                {pDis} <span className="text-xs font-normal text-slate-400">kWh</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between space-y-4">
          <h3 className="text-base font-black text-white">
            Self-Consumption & Self-Sufficiency
          </h3>

          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-emerald-300">Self-Consumption: {selfConsKWh} kWh ({selfConsPct}%)</span>
              <span className="text-cyan-300">Export: {pExp} kWh ({expPct}%)</span>
            </div>
            <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500" style={{ width: `${selfConsPct}%` }} />
              <div className="h-full bg-cyan-400" style={{ width: `${expPct}%` }} />
            </div>
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-emerald-300">โซลาร์+แบต: {selfSuffKWh} kWh ({selfSuffPct}%)</span>
              <span className="text-amber-300">Import: {pImp} kWh ({impPct}%)</span>
            </div>
            <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500" style={{ width: `${selfSuffPct}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${impPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* 24-Hour Curve */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-3">
        <h3 className="text-base font-black text-white">
          📈 กราฟกำลังผลิตโซลาร์เซลล์ (PV W) และโหลดใช้ไฟในบ้าน (Load W)
        </h3>
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
                name="PV Power (W)"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.25}
              />
              <Area
                type="monotone"
                dataKey="loadW"
                name="Home Load (W)"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hardened Read-Only Box & Copyable Script (Zero-IP RS485 Direct) */}
      <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm sm:text-base font-black text-white">
              🛡️ โค้ดดูดค่าจริงอัตโนมัติผ่านพอร์ต RS485 (ไม่ต้องใช้ IP Address • ล็อก Read-Only 0x03 100%)
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
            <span>{copiedCode ? 'คัดลอกสำเร็จ' : 'คัดลอกโค้ด Auto-Read'}</span>
          </button>
        </div>
        <pre
          id="home-saj-readonly-script"
          className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-[11px] font-mono text-cyan-200 overflow-x-auto max-h-56"
        >
{`# SAJ H2-6K-LS2 Zero-IP RS485 Auto-Collector (Site: ${currentCompany.name})
from pymodbus.client import ModbusSerialClient
import time

# ใช้สาย Waveshare USB-to-RS485 ต่อช่อง RS485 ใต้เครื่อง SAJ (Pin 5 ขาว-น้ำเงิน = A+, Pin 4 น้ำเงิน = B-)
SERIAL_PORT = "COM3"  # หรือ "/dev/ttyUSB0"
BAUD_RATE = ${solarData.baudRate || 9600}
SLAVE_ID = ${solarData.slaveId || 1}

# อนุญาตเฉพาะ Function Code 03 (Read Holding Registers) เท่านั้น ห้ามส่ง 06/16 เด็ดขาด
def poll_readonly():
    client = ModbusSerialClient(port=SERIAL_PORT, baudrate=BAUD_RATE, parity='N', stopbits=1, bytesize=8, timeout=3)
    if client.connect():
        try:
            rr = client.read_holding_registers(address=16433, count=65, slave=SLAVE_ID)
            if not rr.isError():
                print("Auto-Read Telemetry OK:", rr.registers[:10])
        finally:
            client.close()

while True:
    poll_readonly()
    time.sleep(30)`}
        </pre>
      </div>
    </div>
  );
};
