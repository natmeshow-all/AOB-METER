import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  TENANT_COMPANIES,
  METER_MODEL_PRESETS,
  createEmptySolarConfig
} from '../data/tenantData';
import {
  getSupabase,
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection
} from '../services/supabaseClient';
import { syncSajCloudAndBackfillHistory } from '../services/sajCloudService';

// Standard Modbus RTU CRC-16 Calculator
const calculateModbusCRC16 = (bytes) => {
  let crc = 0xffff;
  for (let pos = 0; pos < bytes.length; pos++) {
    crc ^= bytes[pos];
    for (let i = 8; i !== 0; i--) {
      if ((crc & 0x0001) !== 0) {
        crc >>= 1;
        crc ^= 0xa001;
      } else {
        crc >>= 1;
      }
    }
  }
  return [crc & 0xff, (crc >> 8) & 0xff];
};

const toHexString = (byteArray) =>
  Array.from(byteArray)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

const createBlankMeter = (idx = 1) => ({
  id: '',
  name: `จุดวัดที่ ${idx}`,
  panel: 'Main MDB',
  tag: `MDB-0${idx}`,
  slaveId: idx,
  model: 'Schneider PM2200',
  ctRatio: '400/5A',
  regActivePowerKW: 3060,
  regEnergyKWh: 3204,
  regVoltageLL: 3020,
  regCurrentAvg: 3000,
  liveKW: 0,
  voltageLL: 0,
  currentA: 0,
  pf: 0,
  todayKWh: 0,
  connectionStatus: 'WAITING'
});

const createBlankSetupForm = (siteType = 'INDUSTRIAL') => ({
  id: '',
  siteType, // 'INDUSTRIAL' | 'HOME_SOLAR'
  companyName: '',
  companyCode: '',
  location: '',
  transformerKVA: siteType === 'INDUSTRIAL' ? 1600 : 0,
  gatewayModel:
    siteType === 'HOME_SOLAR'
      ? 'Waveshare USB-to-RS485 (Isolated) / RS485 to WIFI'
      : 'Waveshare RS485 to WIFI/ETH (SKU 21968)',
  deviceSerial: '',
  baudRate: '9600',
  parity: 'None (8N1)',
  pollingIntervalSec: siteType === 'HOME_SOLAR' ? 30 : 10,
  username: '',
  password: '',
  contactName: '',
  electricityMeters: [createBlankMeter(1)],
  solarConfig: createEmptySolarConfig()
});

export const SuperAdminConsole = ({ onInspectTenant }) => {
  const {
    allOrganizations,
    allAccounts,
    activeOrgId,
    switchOrganization,
    saveFullClientSetup,
    updateOrganization,
    removeOrganization,
    clearAllDemoData,
    testRealGatewayConnection
  } = useAuth();

  // Single-Page Unified Form State (Zero Manual Electrical Input Required!)
  const [form, setForm] = useState(() => createBlankSetupForm('INDUSTRIAL'));
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-Read & Live Hardware Test State
  const [isAutoReading, setIsAutoReading] = useState(false);
  const [autoReadLog, setAutoReadLog] = useState([]);
  const [connectionTestResult, setConnectionTestResult] = useState(null);
  const [orgCardTestMap, setOrgCardTestMap] = useState({});
  // Transient Guest Password for SAJ Cloud (Strictly in-memory only, wiped immediately after token exchange)
  const [sajTransientGuestPass, setSajTransientGuestPass] = useState('');
  const [sajBackfillDays, setSajBackfillDays] = useState(30);

  // Supabase Cloud Database Connection State
  const initialSb = getSupabaseConfig();
  const [sbUrl, setSbUrl] = useState(initialSb.url || '');
  const [sbKey, setSbKey] = useState(initialSb.anonKey || '');
  const [sbStatus, setSbStatus] = useState(null);
  const [isTestingSb, setIsTestingSb] = useState(false);
  const [showCodeHelper, setShowCodeHelper] = useState(false);

  const showNotice = (type, text) => {
    setStatusBanner({ type, text });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addLog = (type, msg) => {
    setAutoReadLog((prev) => [
      { time: new Date().toLocaleTimeString('th-TH'), type, msg },
      ...prev.slice(0, 12)
    ]);
  };

  // Switch between 'INDUSTRIAL' (ใช้งานบริษัท) and 'HOME_SOLAR' (ผู้ใช้งานตามบ้าน)
  const handleSelectSiteType = (newType) => {
    setForm((prev) => ({
      ...prev,
      siteType: newType,
      gatewayModel:
        newType === 'HOME_SOLAR'
          ? 'Waveshare USB-to-RS485 (Isolated) / RS485 to WIFI'
          : 'Waveshare RS485 to WIFI/ETH (SKU 21968)',
      pollingIntervalSec: newType === 'HOME_SOLAR' ? 30 : 10,
      solarConfig: prev.solarConfig || createEmptySolarConfig()
    }));
    setConnectionTestResult(null);
  };

  // Load an existing saved customer into the single-page form
  const handleLoadOrgToForm = (orgId) => {
    const comp = TENANT_COMPANIES[orgId];
    if (!comp) return;
    const acc = allAccounts.find((a) => a.orgId === orgId && a.role !== 'SUPER_ADMIN');

    setForm({
      id: comp.id,
      siteType: comp.siteType || 'INDUSTRIAL',
      companyName: comp.name || '',
      companyCode: comp.code || '',
      location: comp.location || '',
      transformerKVA: Number(comp.transformerKVA) || 0,
      gatewayModel: comp.gatewayModel || 'Waveshare RS485 to WIFI/ETH (SKU 21968)',
      deviceSerial: comp.gatewaySerial || '',
      baudRate: comp.baudRate || '9600',
      parity: comp.parity || 'None (8N1)',
      pollingIntervalSec: Number(comp.pollingIntervalSec) || 10,
      username: acc?.username || '',
      password: acc?.password || '',
      contactName: acc?.fullName || '',
      electricityMeters:
        comp.electricityMeters && comp.electricityMeters.length > 0
          ? comp.electricityMeters.map((m) => ({ ...m }))
          : [createBlankMeter(1)],
      solarConfig: {
        ...createEmptySolarConfig(),
        ...(comp.solarConfig || {})
      }
    });
    setIsEditingExisting(true);
    setConnectionTestResult(null);
    const formEl = document.getElementById('unified-setup-form');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
  };

  // ============================================================================
  // ZERO-COST (0 BAHT) SAJ CLOUD GUEST READ-ONLY + HISTORICAL BACKFILL
  // ============================================================================
  const handleSyncSajCloudZeroCost = async () => {
    setIsAutoReading(true);
    setConnectionTestResult(null);

    const targetOrgId =
      form.id ||
      (form.companyCode
        ? `ORG-${form.companyCode.toUpperCase().replace(/[^A-Z0-9]/g, '')}`
        : 'ORG-HOME01');

    addLog(
      'INFO',
      `กำลังขอ Read-Only Token จาก SAJ Cloud (Guest Mode) และดึงข้อมูลย้อนหลัง ${sajBackfillDays} วัน...`
    );

    const res = await syncSajCloudAndBackfillHistory({
      orgId: targetOrgId,
      companyName: form.companyName || 'บ้านโซลาร์ SAJ',
      guestEmail: form.solarConfig.sajCloudGuestEmail || form.username || 'guest@saj-readonly.local',
      transientPassword: sajTransientGuestPass,
      deviceSn: form.solarConfig.sajDeviceSn || 'SAJ-H2-6K-LS2',
      backfillDays: sajBackfillDays,
      pvCapacityKWp: form.solarConfig.pvCapacityKWp || 6.0,
      batteryCapacityKWh: form.solarConfig.batteryCapacityKWh || 10.24,
      currentSolarConfig: form.solarConfig
    });

    // Immediately wipe transient password from React state (Zero Password Storage!)
    setSajTransientGuestPass('');

    if (res.success) {
      setForm((prev) => ({
        ...prev,
        solarConfig: res.syncedSolarConfig
      }));
      addLog('SUCCESS', res.message);
      setConnectionTestResult({
        success: true,
        testedAt: new Date().toLocaleTimeString('th-TH'),
        message: res.message
      });
    } else {
      addLog('ERROR', res.message);
      setConnectionTestResult({
        success: false,
        testedAt: new Date().toLocaleTimeString('th-TH'),
        message: res.message
      });
    }
    setIsAutoReading(false);
  };

  // ============================================================================
  // ONE-CLICK AUTO-READ FROM DEVICE (NO IP NEEDED! READS VIA USB-RS485 OR CLOUD)
  // ============================================================================
  const handleAutoReadFromDevice = async (mode = 'CLOUD_OR_USB') => {
    setIsAutoReading(true);
    setConnectionTestResult(null);

    try {
      // 1. First check if real data is already streaming into Supabase Cloud for this site
      const supabase = getSupabase();
      const targetOrgId =
        form.id ||
        (form.companyCode
          ? `ORG-${form.companyCode.toUpperCase().replace(/[^A-Z0-9]/g, '')}`
          : '');

      if (supabase && targetOrgId && mode !== 'FORCE_USB') {
        addLog('INFO', `กำลังตรวจหาข้อมูลที่ส่งมาจากอุปกรณ์จริงในฐานข้อมูล Cloud (${targetOrgId})...`);
        const { data, error } = await supabase
          .from('meter_readings')
          .select('*')
          .eq('org_id', targetOrgId)
          .order('recorded_at', { ascending: false })
          .limit(10);

        if (!error && Array.isArray(data) && data.length > 0) {
          const latest = data[0];
          const readKW = Number(latest.active_power_kw ?? latest.reading_value) || 0;
          addLog('SUCCESS', `ดึงค่าจากฐานข้อมูล Cloud อัตโนมัติสำเร็จ! (ค่าล่าสุด: ${readKW} kW)`);

          if (form.siteType === 'HOME_SOLAR') {
            setForm((prev) => ({
              ...prev,
              solarConfig: {
                ...prev.solarConfig,
                pv1PowerW: Number(latest.pv_power_w ?? readKW * 1000) || 0,
                batterySOC: Number(latest.battery_soc) || prev.solarConfig.batterySOC,
                totalLoadPowerW: Number(latest.load_power_w) || prev.solarConfig.totalLoadPowerW,
                todayEnergyKWh: Number(latest.today_kwh) || prev.solarConfig.todayEnergyKWh
              }
            }));
          } else {
            setForm((prev) => ({
              ...prev,
              electricityMeters: prev.electricityMeters.map((m) => {
                const matched = data.find(
                  (r) => r.meter_id === m.id || Number(r.slave_id) === Number(m.slaveId)
                );
                if (matched) {
                  return {
                    ...m,
                    liveKW: Number(matched.active_power_kw ?? matched.reading_value) || 0,
                    connectionStatus: 'ONLINE'
                  };
                }
                return m;
              })
            }));
          }

          setConnectionTestResult({
            success: true,
            testedAt: new Date().toLocaleTimeString('th-TH'),
            message: `ดึงค่าอัตโนมัติจาก Cloud สำเร็จ! ไม่ต้องกรอกค่าเอง (พบแพ็กเกจข้อมูล ${data.length} รายการ)`
          });
          setIsAutoReading(false);
          return;
        }
      }

      // 2. If user clicked USB-to-RS485 Auto-Read (No IP Address Needed — Direct Serial Port!)
      if (mode === 'FORCE_USB') {
        if (!('serial' in navigator)) {
          addLog(
            'ERROR',
            'กรุณาเปิดหน้าเว็บด้วย Google Chrome หรือ Microsoft Edge บนคอมพิวเตอร์ที่เสียบสาย Waveshare USB-to-RS485'
          );
          setIsAutoReading(false);
          return;
        }

        addLog('INFO', 'กำลังเปิดพอร์ต USB-to-RS485 (ไม่ต้องใช้ IP Address)... กรุณาเลือก COM Port ในหน้าต่างที่เด้งขึ้นมา');
        const port = await navigator.serial.requestPort();
        await port.open({
          baudRate: Number(form.baudRate) || 9600,
          dataBits: 8,
          stopBits: 1,
          parity: 'none'
        });

        // Helper to read registers via Modbus RTU Function 03 (100% Read-Only)
        const readModbusReg = async (slaveId, regAddr, regCount) => {
          const body = [
            slaveId & 0xff,
            0x03,
            (regAddr >> 8) & 0xff,
            regAddr & 0xff,
            (regCount >> 8) & 0xff,
            regCount & 0xff
          ];
          const [crcLo, crcHi] = calculateModbusCRC16(body);
          const frame = new Uint8Array([...body, crcLo, crcHi]);

          const writer = port.writable.getWriter();
          await writer.write(frame);
          writer.releaseLock();

          const reader = port.readable.getReader();
          const timeout = new Promise((_, rej) =>
            setTimeout(() => rej(new Error('หมดเวลารอรับข้อมูล 2.5 วินาที (ตรวจสอบสาย A+/B- หรือ Slave ID)')), 2500)
          );
          try {
            const { value } = await Promise.race([reader.read(), timeout]);
            return value;
          } finally {
            reader.releaseLock();
          }
        };

        try {
          if (form.siteType === 'HOME_SOLAR') {
            // Auto-read SAJ H2-6K-LS2 Registers automatically!
            const slave = Number(form.solarConfig.slaveId) || 1;
            addLog('TX', `กำลังดึงค่าอัตโนมัติจาก SAJ H2-6K-LS2 (Slave ID #${slave})...`);

            // Read Grid & PV & Battery block
            const rxGrid = await readModbusReg(slave, 16433, 2); // Grid V, A
            const rxPv = await readModbusReg(slave, 16469, 25); // PV1 V, A, W & Battery SOC
            const rxStat = await readModbusReg(slave, 16535, 4); // Today kWh, Total kWh

            const gridV = rxGrid && rxGrid.length >= 5 ? ((rxGrid[3] << 8) | rxGrid[4]) * 0.1 : 0;
            const pv1V = rxPv && rxPv.length >= 5 ? ((rxPv[3] << 8) | rxPv[4]) * 0.1 : 0;
            const pv1A = rxPv && rxPv.length >= 7 ? ((rxPv[5] << 8) | rxPv[6]) * 0.01 : 0;
            const pv1W = rxPv && rxPv.length >= 9 ? (rxPv[7] << 8) | rxPv[8] : 0;
            const soc = rxPv && rxPv.length >= 25 ? ((rxPv[23] << 8) | rxPv[24]) * 0.01 : 0;
            const todayKWh = rxStat && rxStat.length >= 5 ? ((rxStat[3] << 8) | rxStat[4]) * 0.01 : 0;

            setForm((prev) => ({
              ...prev,
              solarConfig: {
                ...prev.solarConfig,
                gridAc1Voltage: Number(gridV.toFixed(1)),
                pv1Voltage: Number(pv1V.toFixed(1)),
                pv1Current: Number(pv1A.toFixed(2)),
                pv1PowerW: Number(pv1W),
                batterySOC: Number(soc.toFixed(1)),
                todayEnergyKWh: Number(todayKWh.toFixed(2))
              }
            }));

            addLog(
              'SUCCESS',
              `ดึงค่าจาก SAJ อัตโนมัติครบทุกจุด! PV=${pv1W}W, SOC=${soc.toFixed(1)}%, Grid=${gridV.toFixed(1)}V`
            );
            setConnectionTestResult({
              success: true,
              testedAt: new Date().toLocaleTimeString('th-TH'),
              message: `ดึงค่าจากเครื่อง SAJ ผ่านสาย USB-to-RS485 สำเร็จอัตโนมัติ! (PV: ${pv1W} W, แบต: ${soc.toFixed(1)}%)`
            });
          } else {
            // Auto-read all Industrial Power Meters in the list!
            const updatedMeters = [...form.electricityMeters];
            for (let i = 0; i < updatedMeters.length; i++) {
              const m = updatedMeters[i];
              addLog('TX', `กำลังดึงค่าจากมิเตอร์ "${m.name}" (Slave #${m.slaveId}, Reg ${m.regActivePowerKW})...`);
              const rx = await readModbusReg(Number(m.slaveId) || 1, Number(m.regActivePowerKW) || 3060, 2);
              if (rx && rx.length >= 7) {
                const buf = new ArrayBuffer(4);
                const view = new DataView(buf);
                view.setUint8(0, rx[3]);
                view.setUint8(1, rx[4]);
                view.setUint8(2, rx[5]);
                view.setUint8(3, rx[6]);
                const kwVal = Number(view.getFloat32(0, false).toFixed(2));
                updatedMeters[i] = {
                  ...m,
                  liveKW: kwVal,
                  connectionStatus: 'ONLINE'
                };
                addLog('SUCCESS', `อ่านค่ามิเตอร์ #${m.slaveId} สำเร็จ: ${kwVal} kW`);
              }
            }
            setForm((prev) => ({ ...prev, electricityMeters: updatedMeters }));
            setConnectionTestResult({
              success: true,
              testedAt: new Date().toLocaleTimeString('th-TH'),
              message: 'ดึงค่าจากพาวเวอร์มิเตอร์ผ่านสาย USB-to-RS485 เข้าสู่ระบบอัตโนมัติสำเร็จ!'
            });
          }
        } finally {
          await port.close().catch(() => {});
        }
        setIsAutoReading(false);
        return;
      }

      // 3. Default Database / Cloud readiness check
      const res = await testRealGatewayConnection(targetOrgId);
      setConnectionTestResult({
        ...res,
        testedAt: new Date().toLocaleTimeString('th-TH')
      });
    } catch (err) {
      addLog('ERROR', `การดึงค่าอัตโนมัติไม่สำเร็จ: ${err.message}`);
      setConnectionTestResult({
        success: false,
        testedAt: new Date().toLocaleTimeString('th-TH'),
        message: `ยังไม่พบสัญญาณตอบกลับจากอุปกรณ์: ${err.message}`
      });
    } finally {
      setIsAutoReading(false);
    }
  };

  // Save everything to Database
  const handleSaveAllToDatabase = async (e) => {
    e.preventDefault();
    if (!form.companyName.trim() || !form.companyCode.trim()) {
      showNotice('error', 'กรุณากรอก ชื่อบริษัท/ชื่อบ้าน และ รหัสไซต์ (Site Code) ให้ครบถ้วน');
      return;
    }
    if (!form.username.trim() || !form.password.trim()) {
      showNotice('error', 'กรุณากำหนด ชื่อผู้ใช้งาน (Username) และ รหัสผ่าน (Password) สำหรับล็อกอิน');
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveFullClientSetup({
        ...form,
        gatewaySerial: form.deviceSerial
      });
      showNotice(
        'success',
        `✅ บันทึก "${result.organization.name}" และรหัสล็อกอิน "${result.account?.username}" ลงฐานข้อมูลสำเร็จ! (ค่าไฟฟ้าทั้งหมดจะอัปเดตจากอุปกรณ์โดยอัตโนมัติ)`
      );
      setIsEditingExisting(false);
      setForm(createBlankSetupForm(form.siteType));
    } catch (err) {
      showNotice('error', `เกิดข้อผิดพลาดในการบันทึก: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestCardOrg = async (orgId) => {
    setOrgCardTestMap((prev) => ({ ...prev, [orgId]: { loading: true } }));
    const res = await testRealGatewayConnection(orgId);
    setOrgCardTestMap((prev) => ({
      ...prev,
      [orgId]: {
        loading: false,
        ...res,
        testedAt: new Date().toLocaleTimeString('th-TH')
      }
    }));
  };

  const handleSaveAndTestSupabase = async () => {
    setIsTestingSb(true);
    setSbStatus(null);
    saveSupabaseConfig(sbUrl, sbKey);
    if (!sbUrl.trim() || !sbKey.trim()) {
      setSbStatus({
        success: false,
        message: 'ล้างค่า Supabase URL/Key แล้ว'
      });
      setIsTestingSb(false);
      return;
    }
    const res = await testSupabaseConnection(sbUrl, sbKey);
    setSbStatus(res);
    setIsTestingSb(false);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* ===================================================================== */}
      {/* HEADER: SUPER ADMIN ALL-IN-ONE SETTING & AUTO-READ CONTROL CENTER     */}
      {/* ===================================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/90 to-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              ALL-IN-ONE SUPER ADMIN SETTING • คุณณัฐพงษ์ (natshownolimit@gmail.com)
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              ตั้งค่าผู้ใช้งานและดึงค่าจากอุปกรณ์จริงอัตโนมัติ (ไม่ต้องกรอกค่าไฟเอง • ไม่ต้องใช้ IP)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              เพียงตั้งชื่อผู้ใช้งาน + เลือกรุ่นอุปกรณ์ + กดปุ่มเชื่อมต่ออ่านค่าอัตโนมัติ แล้วกดบันทึกลงฐานข้อมูลได้ทันทีในหน้าเดียว
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl px-4 py-2 text-center">
              <div className="text-[10px] text-slate-400 font-bold">ผู้ใช้งานในฐานข้อมูล</div>
              <div className="text-xl font-black text-cyan-400">{allOrganizations.length} ราย</div>
            </div>

            {allOrganizations.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('ยืนยันการล้างข้อมูลทั้งหมดเพื่อเริ่มต้นใหม่?')) {
                    clearAllDemoData();
                    setForm(createBlankSetupForm('INDUSTRIAL'));
                    showNotice('success', 'ล้างข้อมูลทั้งหมดในระบบเรียบร้อยแล้ว');
                  }
                }}
                className="px-3.5 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer"
              >
                🗑️ ล้างข้อมูลทั้งหมด
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Notification Banner */}
      {statusBanner && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
            statusBanner.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
          }`}
        >
          <span className="text-xs sm:text-sm font-bold">{statusBanner.text}</span>
          <button
            onClick={() => setStatusBanner(null)}
            className="px-2.5 py-1 rounded-lg bg-slate-900/70 text-xs text-slate-300 cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 1: SAVED USERS & SITES IN DATABASE                            */}
      {/* ===================================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white">
              📋 รายชื่อผู้ใช้งานที่บันทึกในฐานข้อมูลแล้ว ({allOrganizations.length} รายการ)
            </h2>
          </div>
          {isEditingExisting && (
            <button
              type="button"
              onClick={() => {
                setIsEditingExisting(false);
                setForm(createBlankSetupForm('INDUSTRIAL'));
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold cursor-pointer"
            >
              ➕ สร้างผู้ใช้งานรายใหม่
            </button>
          )}
        </div>

        {allOrganizations.length === 0 ? (
          <div className="bg-slate-950/70 border border-dashed border-slate-800 rounded-2xl p-6 text-center text-xs sm:text-sm text-slate-400">
            ยังไม่มีผู้ใช้งานในฐานข้อมูล — กรุณาตั้งค่าผู้ใช้งานในฟอร์มด้านล่างแล้วกดปุ่ม <strong>&ldquo;💾 บันทึกข้อมูลทั้งหมดลงฐานข้อมูล&rdquo;</strong>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allOrganizations.map((org) => {
              const fullComp = TENANT_COMPANIES[org.id] || org;
              const isHomeSolar = fullComp.siteType === 'HOME_SOLAR';
              const acc = allAccounts.find(
                (a) => a.orgId === org.id && a.role !== 'SUPER_ADMIN'
              );
              const cardTest = orgCardTestMap[org.id];

              return (
                <div
                  key={org.id}
                  className={`rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                    activeOrgId === org.id
                      ? 'bg-slate-950/95 border-cyan-500/60'
                      : 'bg-slate-950/70 border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          isHomeSolar
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                            : 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                        }`}
                      >
                        {isHomeSolar
                          ? '🏠 ผู้ใช้งานตามบ้าน (Solar Inverter)'
                          : '🏢 ใช้งานบริษัท / โรงงาน'}
                      </span>
                      <span className="font-mono text-xs font-bold text-amber-300">
                        รหัสไซต์: {org.code} (ID: {org.id})
                      </span>
                    </div>

                    <h3 className="text-base font-black text-white">{org.name}</h3>

                    <div className="mt-2 grid grid-cols-2 gap-2 bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">รุ่นอุปกรณ์ที่ผูกไว้</span>
                        <span className="font-mono font-bold text-cyan-300 truncate block">
                          {isHomeSolar
                            ? fullComp.solarConfig?.inverterModel || 'SAJ H2-6K-LS2'
                            : `${(fullComp.electricityMeters || []).length} พาวเวอร์มิเตอร์`}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">บัญชีสำหรับล็อกอิน</span>
                        <span className="font-mono font-bold text-amber-300 block">
                          ID: {acc?.username || '-'} | Pass: {acc?.password || '-'}
                        </span>
                      </div>
                    </div>

                    {cardTest && !cardTest.loading && (
                      <div
                        className={`mt-2 p-2.5 rounded-xl border text-xs ${
                          cardTest.success
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                        }`}
                      >
                        [{cardTest.testedAt}] {cardTest.message}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleLoadOrgToForm(org.id)}
                      className="py-2 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold cursor-pointer"
                    >
                      ✏️ แก้ไขตั้งค่า
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestCardOrg(org.id)}
                      className="py-2 px-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold cursor-pointer"
                    >
                      {cardTest?.loading ? '⏳ ทดสอบ...' : '📡 เช็กสัญญาณ'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        switchOrganization(org.id);
                        if (onInspectTenant) onInspectTenant(org.id);
                      }}
                      className="py-2 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                    >
                      👁️ เปิดดูหน้าจอ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`ยืนยันการลบ "${org.name}" ออกจากฐานข้อมูล?`)) {
                          removeOrganization(org.id);
                          showNotice('success', `ลบ "${org.name}" ออกจากฐานข้อมูลแล้ว`);
                        }
                      }}
                      className="py-2 px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer"
                    >
                      🗑️ ลบ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* SECTION 2: ALL-IN-ONE UNIFIED SETUP (NO MANUAL VALUE INPUTS, NO IP!)  */}
      {/* ===================================================================== */}
      <form
        id="unified-setup-form"
        onSubmit={handleSaveAllToDatabase}
        className="bg-slate-900/95 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6"
      >
        <div className="border-b border-slate-800 pb-4">
          <span className="text-xs font-black uppercase tracking-wider text-amber-400">
            {isEditingExisting
              ? `✏️ กำลังแก้ไขข้อมูลผู้ใช้งาน: ${form.companyName}`
              : '➕ ตั้งค่าผู้ใช้งานและเชื่อมต่ออุปกรณ์ในหน้าเดียว'}
          </span>
          <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
            ขั้นตอนที่ 1: เลือกประเภทผู้ใช้งาน (ใช้งานบริษัท หรือ ผู้ใช้งานตามบ้าน)
          </h2>
        </div>

        {/* STEP 1: SELECT USER TYPE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleSelectSiteType('INDUSTRIAL')}
            className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start gap-4 ${
              form.siteType === 'INDUSTRIAL'
                ? 'bg-blue-600/20 border-blue-400 shadow-lg shadow-blue-500/15'
                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 opacity-75'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-2xl shrink-0">
              🏢
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-white">
                  1. ใช้งานบริษัท / โรงงานอุตสาหกรรม
                </span>
                {form.siteType === 'INDUSTRIAL' && (
                  <span className="px-2 py-0.5 rounded bg-blue-500 text-white text-[10px] font-black">
                    เลือกอยู่
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                สำหรับโรงงานที่ติดตั้ง <strong>Power Meter 3 เฟส</strong> (แสดงเฉพาะ 3 เมนูไฟฟ้าโรงงาน ไม่มีเมนูโซลาร์บ้านไปรบกวนลูกค้าบริษัท)
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSiteType('HOME_SOLAR')}
            className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start gap-4 ${
              form.siteType === 'HOME_SOLAR'
                ? 'bg-emerald-600/20 border-emerald-400 shadow-lg shadow-emerald-500/15'
                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 opacity-75'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-2xl shrink-0">
              🏠
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-white">
                  2. ผู้ใช้งานตามบ้าน (Solar Hybrid Inverter)
                </span>
                {form.siteType === 'HOME_SOLAR' && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black">
                    เลือกอยู่
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                สำหรับบ้านที่ติดตั้ง <strong>Solar Inverter & แบตเตอรี่</strong> เช่น <code>SAJ H2-6K-LS2</code> (ดึงค่า PV, แบตเตอรี่ SOC%, โหลดไฟบ้าน และหน่วยผลิตไฟอัตโนมัติ)
              </p>
            </div>
          </button>
        </div>

        {/* STEP 2: USER NAME & LOGIN CREDENTIALS */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm sm:text-base font-black text-cyan-400">
            ขั้นตอนที่ 2: กำหนดชื่อผู้ใช้งาน และ รหัสผ่านสำหรับล็อกอิน (ใส่แค่ 4 ช่องนี้)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {form.siteType === 'HOME_SOLAR' ? 'ชื่อบ้าน / ชื่อจุดติดตั้ง *' : 'ชื่อบริษัทลูกค้า *'}
              </label>
              <input
                type="text"
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder={
                  form.siteType === 'HOME_SOLAR' ? 'เช่น บ้านคุณณัฐพงษ์' : 'เช่น บริษัท เอบีซี จำกัด'
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                รหัสไซต์ (Site Code ภาษาอังกฤษ) *
              </label>
              <input
                type="text"
                required
                value={form.companyCode}
                onChange={(e) =>
                  setForm({ ...form, companyCode: e.target.value.toUpperCase() })
                }
                placeholder={form.siteType === 'HOME_SOLAR' ? 'เช่น HOME01' : 'เช่น FAC01'}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-cyan-300 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-300 mb-1">
                🔑 ชื่อล็อกอิน (Login Username) *
              </label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="ตั้งชื่อ Username"
                className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-sm text-amber-300 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-300 mb-1">
                🔒 รหัสผ่าน (Password) *
              </label>
              <input
                type="text"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="ตั้งรหัสผ่าน"
                className="w-full bg-slate-900 border border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-sm text-emerald-300 font-mono font-bold"
              />
            </div>
          </div>
        </div>

        {/* STEP 3: HARDWARE MODEL & AUTO-READ TELEMETRY (NO IP NEEDED, NO MANUAL TYPING OF VALUES!) */}
        {form.siteType === 'HOME_SOLAR' ? (
          <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-black text-emerald-400">
                  ขั้นตอนที่ 3: เชื่อมต่อ SAJ Cloud ฟรี 0 บาท (โหมด Guest ดูอย่างเดียว • ดึงข้อมูลเก่าย้อนหลัง + เก็บข้อมูลใหม่ 24 ชม.)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ไม่ต้องซื้ออุปกรณ์เพิ่ม • ไม่ต้องหาเลข IP • ไม่เก็บรหัสผ่านไว้ในหน้าเว็บ (Zero Password Storage 100%)
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                🛡️ ปลอดภัย 100% (Read-Only Guest Token)
              </span>
            </div>

            {/* ZERO-COST SAJ CLOUD GUEST READ-ONLY & HISTORICAL BACKFILL BOX */}
            <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/30 border border-emerald-500/40 rounded-2xl p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-emerald-300 mb-1">
                    1. อีเมลบัญชีสำรอง SAJ (Guest Read-Only)
                  </label>
                  <input
                    type="email"
                    value={form.solarConfig.sajCloudGuestEmail || ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        solarConfig: {
                          ...form.solarConfig,
                          sajCloudGuestEmail: e.target.value
                        }
                      })
                    }
                    placeholder="เช่น myhome-guest@gmail.com"
                    className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-cyan-300 mb-1">
                    2. รหัสผ่าน Guest (ใช้ขอ Token แล้วลบทิ้งทันที)
                  </label>
                  <input
                    type="password"
                    value={sajTransientGuestPass}
                    onChange={(e) => setSajTransientGuestPass(e.target.value)}
                    placeholder="ไม่บันทึกในเครื่อง (Zero Storage)"
                    className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl px-3 py-2.5 text-cyan-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    3. Serial Number (SN) อินเวอร์เตอร์ / แท่ง AIO3
                  </label>
                  <input
                    type="text"
                    value={form.solarConfig.sajDeviceSn || ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        solarConfig: {
                          ...form.solarConfig,
                          sajDeviceSn: e.target.value
                        }
                      })
                    }
                    placeholder="เช่น H2S602J... (เว้นว่างให้อ่านอัตโนมัติได้)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-amber-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-amber-300 mb-1">
                    4. ดึงข้อมูลเก่าย้อนหลัง (Historical Backfill)
                  </label>
                  <select
                    value={sajBackfillDays}
                    onChange={(e) => setSajBackfillDays(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2.5 text-amber-300 font-bold"
                  >
                    <option value={30}>ย้อนหลัง 30 วันล่าสุด</option>
                    <option value={90}>ย้อนหลัง 90 วัน (3 เดือน)</option>
                    <option value={180}>ย้อนหลัง 180 วัน (6 เดือน)</option>
                    <option value={365}>ย้อนหลัง 365 วัน (1 ปีเต็ม)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="text-[11px] text-slate-300">
                  🔒 <strong>สถานะ Token ปัจจุบัน:</strong>{' '}
                  {form.solarConfig.sajReadOnlyTokenId ? (
                    <span className="font-mono text-emerald-400">
                      ผูก Token สำเร็จ ({form.solarConfig.sajReadOnlyTokenId.slice(0, 18)}...) • ดึงข้อมูลเก่าแล้ว {(form.solarConfig.historicalDailyLogs || []).length} วัน
                    </span>
                  ) : (
                    <span className="text-slate-400">ยังไม่ได้กดดึง Token</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSyncSajCloudZeroCost}
                  disabled={isAutoReading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-xs sm:text-sm cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  {isAutoReading
                    ? '⏳ กำลังซิงก์และดึงข้อมูลเก่า...'
                    : `☁️ ดึงข้อมูลจาก SAJ Cloud ฟรี 0 บาท + ดึงข้อมูลเก่าย้อนหลัง (${sajBackfillDays} วัน)`}
                </button>
              </div>
            </div>

            {/* Only Hardware Spec Selection (4 simple fields — NO manual electrical reading inputs!) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  รุ่นเครื่อง Solar Inverter
                </label>
                <select
                  value={form.solarConfig.inverterModel}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      solarConfig: { ...form.solarConfig, inverterModel: e.target.value }
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-bold"
                >
                  <option value="SAJ H2-6K-LS2 (Hybrid Inverter)">
                    SAJ H2-6K-LS2 (Hybrid 6kW)
                  </option>
                  <option value="SAJ H2 Series (5K/8K/10K)">SAJ H2 Series (5K/8K/10K)</option>
                  <option value="Huawei SUN2000 Hybrid">Huawei SUN2000 Hybrid</option>
                  <option value="Deye Hybrid Inverter">Deye Hybrid Inverter</option>
                  <option value="Growatt Hybrid Inverter">Growatt Hybrid Inverter</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-amber-300 mb-1">
                  ขนาดแผงโซลาร์รวม (kWp)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form.solarConfig.pvCapacityKWp || 6.0}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      solarConfig: {
                        ...form.solarConfig,
                        pvCapacityKWp: Number(e.target.value)
                      }
                    })
                  }
                  className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-amber-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-emerald-300 mb-1">
                  ความจุแบตเตอรี่ที่ติดตั้ง (kWh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.solarConfig.batteryCapacityKWh}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      solarConfig: {
                        ...form.solarConfig,
                        batteryCapacityKWh: Number(e.target.value)
                      }
                    })
                  }
                  placeholder="เช่น 10.24 หรือ 16.08"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-emerald-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Modbus Slave ID (กรณีต่อสายสำรอง)
                </label>
                <input
                  type="number"
                  min="1"
                  max="247"
                  value={form.solarConfig.slaveId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      solarConfig: { ...form.solarConfig, slaveId: Number(e.target.value) }
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono"
                />
              </div>
            </div>

            {/* AUTO-FETCHED TELEMETRY READOUT PANEL (READ-ONLY DISPLAY FROM DEVICE — NOT MANUAL INPUTS!) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-300">
                  📊 ค่าไฟฟ้าที่ระบบดึงได้อัตโนมัติ (Read-Only Telemetry — ไม่ต้องพิมพ์เอง):
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSyncSajCloudZeroCost}
                    disabled={isAutoReading}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    ☁️ ซิงก์จาก SAJ Cloud ฟรี 0 บาท
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAutoReadFromDevice('FORCE_USB')}
                    disabled={isAutoReading}
                    className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs cursor-pointer"
                  >
                    🔌 ดูดผ่านสาย USB-to-RS485
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-center font-mono text-xs">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <span className="text-[10px] font-sans text-slate-400 block">
                    กำลังผลิต PV1 (Auto)
                  </span>
                  <strong className="text-base text-amber-400">
                    {form.solarConfig.pv1PowerW} W
                  </strong>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <span className="text-[10px] font-sans text-slate-400 block">
                    แรงดัน / กระแส PV1
                  </span>
                  <strong className="text-base text-white">
                    {form.solarConfig.pv1Voltage}V / {form.solarConfig.pv1Current}A
                  </strong>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <span className="text-[10px] font-sans text-slate-400 block">
                    แบตเตอรี่ SOC (Auto)
                  </span>
                  <strong className="text-base text-emerald-400">
                    {form.solarConfig.batterySOC}%
                  </strong>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <span className="text-[10px] font-sans text-slate-400 block">
                    ผลิตได้วันนี้ (Today)
                  </span>
                  <strong className="text-base text-emerald-300">
                    {form.solarConfig.todayEnergyKWh} kWh
                  </strong>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <span className="text-[10px] font-sans text-slate-400 block">
                    สะสมทั้งหมด (Total)
                  </span>
                  <strong className="text-base text-cyan-300">
                    {form.solarConfig.totalEnergyKWh} kWh
                  </strong>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <span className="text-[10px] font-sans text-slate-400 block">
                    ประวัติเก่าที่ดึงมาแล้ว
                  </span>
                  <strong className="text-base text-purple-300">
                    {(form.solarConfig.historicalDailyLogs || []).length} วัน
                  </strong>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* INDUSTRIAL COMPANY POWER METERS SETUP (NO MANUAL kW INPUT REQUIRED!) */
          <div className="bg-slate-950/80 border border-blue-500/30 rounded-2xl p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-black text-blue-400">
                  ขั้นตอนที่ 3: ตั้งค่าหม้อแปลง & รายการพาวเวอร์มิเตอร์ของโรงงาน (ไม่ต้องกรอกค่าไฟเอง!)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ระบุเฉพาะชื่อจุดวัด, Slave ID, รุ่นมิเตอร์ และ CT Ratio ส่วนค่าไฟฟ้า (kW, V, A, kWh) อุปกรณ์จะส่งเข้าฐานข้อมูลให้อัตโนมัติ
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  ขนาดหม้อแปลงไฟฟ้ารวม (kVA)
                </label>
                <input
                  type="number"
                  value={form.transformerKVA}
                  onChange={(e) => setForm({ ...form, transformerKVA: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  รุ่นอุปกรณ์ Gateway ที่ติดตั้งหน้าตู้
                </label>
                <select
                  value={form.gatewayModel}
                  onChange={(e) => setForm({ ...form, gatewayModel: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                >
                  <option value="Waveshare RS485 to WIFI/ETH (SKU 21968)">
                    Waveshare RS485 to WIFI/ETH (SKU 21968)
                  </option>
                  <option value="Waveshare USB-to-RS485 (Isolated)">
                    Waveshare USB-to-RS485 (Isolated)
                  </option>
                  <option value="USR-DR154 / 4G LTE RS485">USR-DR154 / 4G LTE RS485</option>
                  <option value="Teltonika TRB145 4G RS485">Teltonika TRB145 4G RS485</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  ความเร็ว RS485 (Baud Rate & Parity)
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={form.baudRate}
                    onChange={(e) => setForm({ ...form, baudRate: e.target.value })}
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2.5 text-white font-mono"
                  >
                    <option value="9600">9600 bps</option>
                    <option value="19200">19200 bps</option>
                    <option value="115200">115200 bps</option>
                  </select>
                  <select
                    value={form.parity}
                    onChange={(e) => setForm({ ...form, parity: e.target.value })}
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2.5 text-white font-mono"
                  >
                    <option value="None (8N1)">8N1</option>
                    <option value="Even (8E1)">8E1</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Power Meters List (Only Hardware Config: Name, Slave ID, Model, CT Ratio) */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-black text-white">
                  ⚡ รายการพาวเวอร์มิเตอร์ที่พ่วงในสาย RS485 ({form.electricityMeters.length} ตัว)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAutoReadFromDevice('FORCE_USB')}
                    disabled={isAutoReading}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold cursor-pointer"
                  >
                    🔌 ทดสอบดูดค่าจริงจากมิเตอร์ผ่านสาย USB-to-RS485
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        electricityMeters: [
                          ...form.electricityMeters,
                          createBlankMeter(form.electricityMeters.length + 1)
                        ]
                      })
                    }
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold cursor-pointer"
                  >
                    + เพิ่มจุดวัดมิเตอร์ตัวต่อไป
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {form.electricityMeters.map((m, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-slate-900/90 border border-slate-800 p-3 rounded-2xl items-end text-xs"
                  >
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] text-slate-400 mb-1">
                        ชื่อจุดวัด / เครื่องจักร *
                      </label>
                      <input
                        type="text"
                        required
                        value={m.name}
                        onChange={(e) => {
                          const list = [...form.electricityMeters];
                          list[idx].name = e.target.value;
                          setForm({ ...form, electricityMeters: list });
                        }}
                        placeholder={`เช่น ตู้เมน MDB #${idx + 1}`}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-amber-300 font-bold mb-1">
                        Modbus Slave ID
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="247"
                        value={m.slaveId}
                        onChange={(e) => {
                          const list = [...form.electricityMeters];
                          list[idx].slaveId = Number(e.target.value);
                          setForm({ ...form, electricityMeters: list });
                        }}
                        className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-2 py-2 text-amber-300 font-mono font-bold text-center"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-slate-400 mb-1">
                        เลือกรุ่นมิเตอร์ (ตั้งค่า Register ให้อัตโนมัติ)
                      </label>
                      <select
                        value={m.model}
                        onChange={(e) => {
                          const list = [...form.electricityMeters];
                          const preset =
                            METER_MODEL_PRESETS[e.target.value] ||
                            METER_MODEL_PRESETS['Schneider PM2200'];
                          list[idx].model = e.target.value;
                          list[idx].regActivePowerKW = preset.regActivePowerKW;
                          list[idx].regEnergyKWh = preset.regEnergyKWh;
                          list[idx].regVoltageLL = preset.regVoltageLL;
                          list[idx].regCurrentAvg = preset.regCurrentAvg;
                          setForm({ ...form, electricityMeters: list });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-white"
                      >
                        {Object.keys(METER_MODEL_PRESETS).map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-slate-400 mb-1">
                        ขนาดคล้อง CT (CT Ratio)
                      </label>
                      <input
                        type="text"
                        value={m.ctRatio}
                        onChange={(e) => {
                          const list = [...form.electricityMeters];
                          list[idx].ctRatio = e.target.value;
                          setForm({ ...form, electricityMeters: list });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-cyan-300 font-mono"
                      />
                    </div>

                    <div className="sm:col-span-1 text-right">
                      {form.electricityMeters.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              electricityMeters: form.electricityMeters.filter(
                                (_, i) => i !== idx
                              )
                            })
                          }
                          className="px-2.5 py-2 rounded-xl bg-rose-500/15 text-rose-300 font-bold cursor-pointer"
                        >
                          ลบ
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] text-emerald-400 block py-2">
                          {m.liveKW > 0 ? `${m.liveKW} kW` : 'Auto'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Live Log & Test Result Box */}
        {(connectionTestResult || autoReadLog.length > 0) && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
            {connectionTestResult && (
              <div
                className={`p-3 rounded-xl border font-bold ${
                  connectionTestResult.success
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                }`}
              >
                [{connectionTestResult.testedAt}] {connectionTestResult.message}
              </div>
            )}
            {autoReadLog.length > 0 && (
              <div className="font-mono text-[11px] space-y-1 max-h-32 overflow-y-auto pt-1">
                {autoReadLog.map((l, i) => (
                  <div key={i} className="text-slate-300">
                    [{l.time}] <strong className="text-cyan-300">{l.type}:</strong> {l.msg}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: UNIFIED ACTION BAR */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => handleAutoReadFromDevice('CLOUD_OR_USB')}
              disabled={isAutoReading}
              className="px-4 py-3.5 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 font-black text-xs sm:text-sm cursor-pointer"
            >
              {isAutoReading
                ? '⏳ กำลังตรวจสอบ...'
                : '📡 1. ทดสอบสถานะฐานข้อมูล & เช็กสัญญาณ'}
            </button>

            <button
              type="button"
              onClick={() => handleAutoReadFromDevice('FORCE_USB')}
              disabled={isAutoReading}
              className="px-4 py-3.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-black text-xs sm:text-sm cursor-pointer"
            >
              🔌 2. ดูดค่าจริงผ่านสาย USB-to-RS485 (ไม่ต้องใช้ IP)
            </button>

            <button
              type="button"
              onClick={() => setShowCodeHelper(!showCodeHelper)}
              className="px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs sm:text-sm cursor-pointer"
            >
              📘 วิธีต่อสาย & โค้ดส่งค่าขึ้นเว็บอัตโนมัติ
            </button>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-amber-500/25 cursor-pointer"
          >
            {isSaving
              ? '⏳ กำลังบันทึกลงฐานข้อมูล...'
              : '💾 3. บันทึกผู้ใช้งานและอุปกรณ์ลงฐานข้อมูล'}
          </button>
        </div>
      </form>

      {/* ===================================================================== */}
      {/* EXPANDABLE GUIDE: WHY NO IP IS NEEDED & HOW DATA FLOWS AUTOMATICALLY  */}
      {/* ===================================================================== */}
      {showCodeHelper && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-white">
              📘 ทำไมระบบนี้ถึงไม่ต้องใช้ IP Address ของอุปกรณ์ และไม่ต้องกรอกค่าไฟเอง?
            </h3>
            <button
              type="button"
              onClick={() => setShowCodeHelper(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              ✕ ซ่อนคำอธิบาย
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="font-black text-emerald-400 text-sm">
                1. กรณีใช้สาย Waveshare USB-to-RS485 (ตัว 975 บาทใน Shopee)
              </div>
              <p>
                • <strong>ไม่ต้องใช้ IP Address เลย!</strong> เพราะสายแปลงเสียบเข้าช่อง USB ของโน้ตบุ๊ก/คอมพิวเตอร์โดยตรง
              </p>
              <p>
                • สำหรับอินเวอร์เตอร์ <strong>SAJ H2-6K-LS2 ที่บ้าน</strong>: ใช้สาย LAN เสียบช่อง <code>RS485</code> ใต้เครื่อง แล้วนำสายคู่ <strong>เส้นที่ 5 (ขาว-น้ำเงิน = A+)</strong> และ <strong>เส้นที่ 4 (น้ำเงิน = B-)</strong> ต่อเข้าตัวแปลง USB-to-RS485
              </p>
              <p>
                • พอกดปุ่ม <strong>&ldquo;🔌 2. ดูดค่าจริงผ่านสาย USB-to-RS485&rdquo;</strong> ระบบจะวิ่งไปอ่านค่าทุกตัว (PV W, SOC %, V, A, kWh) จากตัวเครื่องมาใส่และบันทึกลงฐานข้อมูลให้อัตโนมัติทันที!
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="font-black text-cyan-400 text-sm">
                2. กรณีใช้กล่อง Waveshare RS485 to WIFI/ETH เกาะรางตู้ไฟ
              </div>
              <p>
                • ตัวกล่องจะอ่านค่าจากมิเตอร์/อินเวอร์เตอร์ผ่านสาย RS485 (ใช้แค่เลข <code>Slave ID = 1, 2, 3...</code>) แล้ว <strong>ยิงข้อมูลขาออกขึ้นมายัง URL ฐานข้อมูล Supabase ของเราเองทุกๆ 15-30 วินาที</strong>
              </p>
              <p>
                • ดังนั้น <strong>หน้าเว็บจึงไม่จำเป็นต้องรู้ IP ในบ้านหรือในโรงงานของลูกค้าเลย</strong> ข้อมูลจะไหลเข้าฐานข้อมูลตามรหัสไซต์ (<code>ORG-HOME01</code> หรือ <code>ORG-FAC01</code>) เองโดยอัตโนมัติ 24 ชม. ครับ
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 3: SUPABASE CLOUD DATABASE CONNECTION & TEST IN SAME PAGE     */}
      {/* ===================================================================== */}
      <div className="bg-slate-900/90 border border-cyan-500/30 rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-white">
              ☁️ ตั้งค่าฐานข้อมูลหลัก (Supabase Cloud Database)
            </h3>
            <p className="text-xs text-slate-400">
              เชื่อมต่อฐานข้อมูล Supabase เพื่อให้ข้อมูลทั้งหมดบันทึกและอัปเดตแบบอัตโนมัติบนคลาวด์
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              initialSb.isConfigured
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {initialSb.isConfigured ? '🟢 เชื่อมต่อ Supabase Cloud แล้ว' : '⚪ โหมดฐานข้อมูลในเครื่อง'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              value={sbUrl}
              onChange={(e) => setSbUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-cyan-300 font-mono"
            />
          </div>
          <div className="sm:col-span-5">
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Supabase API Key (Anon / Service Key)
            </label>
            <input
              type="password"
              value={sbKey}
              onChange={(e) => setSbKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={handleSaveAndTestSupabase}
              disabled={isTestingSb}
              className="w-full py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer"
            >
              {isTestingSb ? '⏳ ทดสอบ...' : '💾 บันทึก & ทดสอบ DB'}
            </button>
          </div>
        </div>

        {sbStatus && (
          <div
            className={`p-3 rounded-xl border text-xs font-bold ${
              sbStatus.success
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
            }`}
          >
            {sbStatus.message}
          </div>
        )}
      </div>
    </div>
  );
};
