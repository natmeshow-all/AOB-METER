import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  TENANT_COMPANIES,
  METER_MODEL_PRESETS,
  createEmptySolarConfig
} from '../data/tenantData';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection
} from '../services/supabaseClient';

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
  name: '',
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
  todayKWh: 0
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
      ? 'SAJ AIO3 WiFi / RS485 Dongle'
      : 'Waveshare RS485 to WIFI/ETH',
  gatewayIp: '',
  gatewayPort: '502',
  gatewayEndpointUrl: '',
  gatewayApiKey: '',
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
    removeOrganization,
    clearAllDemoData,
    testRealGatewayConnection
  } = useAuth();

  // Single-Page Unified Form State (No Demo Data)
  const [form, setForm] = useState(() => createBlankSetupForm('INDUSTRIAL'));
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Live Hardware / Connection Test State
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState(null);
  const [orgCardTestMap, setOrgCardTestMap] = useState({});

  // Direct USB-to-RS485 Web Serial Tester (Expandable inside the same single page)
  const [showRs485Panel, setShowRs485Panel] = useState(false);
  const [serialConfig, setSerialConfig] = useState({
    baudRate: 9600,
    parity: 'none',
    slaveId: 1,
    funcCode: 3,
    regAddress: 3060,
    regCount: 2,
    dataType: 'float32'
  });
  const [serialLogs, setSerialLogs] = useState([]);
  const [isSerialRunning, setIsSerialRunning] = useState(false);

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

  // Switch between 'INDUSTRIAL' (ใช้งานบริษัท) and 'HOME_SOLAR' (ผู้ใช้งานตามบ้าน)
  const handleSelectSiteType = (newType) => {
    setForm((prev) => ({
      ...prev,
      siteType: newType,
      gatewayModel:
        newType === 'HOME_SOLAR'
          ? 'SAJ AIO3 WiFi / RS485 Dongle'
          : 'Waveshare RS485 to WIFI/ETH',
      pollingIntervalSec: newType === 'HOME_SOLAR' ? 30 : 10,
      solarConfig: prev.solarConfig || createEmptySolarConfig()
    }));
    setConnectionTestResult(null);
  };

  // Load an existing saved customer into the single-page form for immediate editing
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
      gatewayModel: comp.gatewayModel || 'Waveshare RS485 to WIFI/ETH',
      gatewayIp: comp.gatewayIp || '',
      gatewayPort: comp.gatewayPort || '502',
      gatewayEndpointUrl: comp.gatewayEndpointUrl || '',
      gatewayApiKey: comp.gatewayApiKey || '',
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
      const result = await saveFullClientSetup(form);
      showNotice(
        'success',
        `✅ บันทึกข้อมูล "${result.organization.name}" (${
          result.organization.siteType === 'HOME_SOLAR'
            ? '🏠 ผู้ใช้งานตามบ้าน / Solar Inverter'
            : '🏢 ใช้งานบริษัท / โรงงาน'
        }) และรหัสล็อกอิน "${result.account?.username}" ลงฐานข้อมูลเรียบร้อยแล้ว!`
      );
      setIsEditingExisting(false);
      setForm(createBlankSetupForm(form.siteType));
    } catch (err) {
      showNotice('error', `เกิดข้อผิดพลาดในการบันทึก: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Test connection right from the form
  const handleTestFormConnection = async () => {
    setIsTestingConnection(true);
    setConnectionTestResult(null);
    const res = await testRealGatewayConnection(form.id || '', form.gatewayEndpointUrl);
    setConnectionTestResult({
      ...res,
      testedAt: new Date().toLocaleTimeString('th-TH')
    });
    setIsTestingConnection(false);
  };

  // Test connection on a saved card
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

  // Direct USB-to-RS485 Modbus RTU Live Test (Read-Only Function 03/04)
  const handleRunRs485Test = async () => {
    const addLog = (type, msg) =>
      setSerialLogs((prev) => [
        { time: new Date().toLocaleTimeString('th-TH'), type, msg },
        ...prev.slice(0, 14)
      ]);

    if (!('serial' in navigator)) {
      addLog(
        'ERROR',
        'กรุณาเปิดหน้าเว็บด้วย Google Chrome หรือ Microsoft Edge บนคอมพิวเตอร์ที่เสียบสาย USB-to-RS485'
      );
      return;
    }

    setIsSerialRunning(true);
    let port = null;
    try {
      port = await navigator.serial.requestPort();
      await port.open({
        baudRate: Number(serialConfig.baudRate) || 9600,
        dataBits: 8,
        stopBits: 1,
        parity: serialConfig.parity || 'none'
      });

      // Strictly allow ONLY Read-Only Function Codes 03 or 04
      const safeFunc = Number(serialConfig.funcCode) === 4 ? 4 : 3;
      const slave = Number(serialConfig.slaveId) & 0xff;
      const reg = Number(serialConfig.regAddress) & 0xffff;
      const count = Number(serialConfig.regCount) & 0xffff;

      const body = [
        slave,
        safeFunc,
        (reg >> 8) & 0xff,
        reg & 0xff,
        (count >> 8) & 0xff,
        count & 0xff
      ];
      const [crcLo, crcHi] = calculateModbusCRC16(body);
      const frame = new Uint8Array([...body, crcLo, crcHi]);

      addLog('TX', `ส่งคำสั่ง Read-Only (0${safeFunc}) Slave #${slave}, Reg ${reg} -> [${toHexString(frame)}]`);

      const writer = port.writable.getWriter();
      await writer.write(frame);
      writer.releaseLock();

      const reader = port.readable.getReader();
      const timeout = new Promise((_, rej) =>
        setTimeout(() => rej(new Error('หมดเวลารอรับข้อมูล 2.5 วินาที (ตรวจสอบสาย A/B หรือ Slave ID)')), 2500)
      );

      const { value } = await Promise.race([reader.read(), timeout]);
      reader.releaseLock();

      if (value && value.length >= 5) {
        let decoded = 0;
        if (value.length >= 7 && serialConfig.dataType === 'float32') {
          const buf = new ArrayBuffer(4);
          const view = new DataView(buf);
          view.setUint8(0, value[3]);
          view.setUint8(1, value[4]);
          view.setUint8(2, value[5]);
          view.setUint8(3, value[6]);
          decoded = Number(view.getFloat32(0, false).toFixed(2));
        } else {
          decoded = (value[3] << 8) | value[4];
        }

        addLog('RX', `อ่านค่าสำเร็จ! RX: [${toHexString(value)}] => ค่าที่อ่านได้จริง = ${decoded}`);

        // Automatically populate the read value into the active form so user can click Save!
        if (form.siteType === 'HOME_SOLAR') {
          setForm((prev) => ({
            ...prev,
            solarConfig: {
              ...prev.solarConfig,
              pv1PowerW: decoded
            }
          }));
        } else {
          setForm((prev) => {
            const meters = [...prev.electricityMeters];
            if (meters[0]) {
              meters[0] = { ...meters[0], liveKW: decoded };
            }
            return { ...prev, electricityMeters: meters };
          });
        }
      }
    } catch (err) {
      addLog('ERROR', err.message);
    } finally {
      if (port) {
        try {
          await port.close();
        } catch {}
      }
      setIsSerialRunning(false);
    }
  };

  // Save & Test Supabase Cloud Database Config
  const handleSaveAndTestSupabase = async () => {
    setIsTestingSb(true);
    setSbStatus(null);
    saveSupabaseConfig(sbUrl, sbKey);
    if (!sbUrl.trim() || !sbKey.trim()) {
      setSbStatus({
        success: false,
        message: 'ล้างค่า Supabase URL/Key แล้ว (ขณะนี้บันทึกข้อมูลในโหมด Local Database)'
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
      {/* HEADER: SUPER ADMIN ALL-IN-ONE SETTING & HARDWARE CONTROL CENTER      */}
      {/* ===================================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/90 to-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              ALL-IN-ONE SUPER ADMIN SETTING • คุณณัฐพงษ์ (natshownolimit@gmail.com)
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              หน้าตั้งค่าระบบและเชื่อมต่ออุปกรณ์จริงครบจบในหน้าเดียว (Zero Demo Data)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              เลือกประเภทผู้ใช้งาน (🏢 บริษัท/โรงงาน หรือ 🏠 บ้าน/อินเวอร์เตอร์โซลาร์) • ตั้งค่าอุปกรณ์ • กดทดสอบสัญญาณจริง • และบันทึกลงฐานข้อมูลได้ทันทีในหน้านี้
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl px-4 py-2 text-center">
              <div className="text-[10px] text-slate-400 font-bold">ผู้ใช้งานที่บันทึกแล้ว</div>
              <div className="text-xl font-black text-cyan-400">{allOrganizations.length} ราย</div>
            </div>

            {allOrganizations.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('ยืนยันการล้างข้อมูลทั้งหมดเพื่อเริ่มต้นใหม่ (Reset Clean)?')) {
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
      {/* SECTION 1: SAVED USERS & SITES IN DATABASE (QUICK EDIT / TEST / VIEW) */}
      {/* ===================================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white">
              📋 รายชื่อผู้ใช้งานและอุปกรณ์ที่บันทึกในฐานข้อมูล ({allOrganizations.length} รายการ)
            </h2>
            <p className="text-xs text-slate-400">
              กด &ldquo;✏️ แก้ไขตั้งค่า&rdquo; เพื่อดึงข้อมูลลงมาปรับแก้ในฟอร์มด้านล่าง หรือกด &ldquo;📡 ทดสอบสถานะจริง&rdquo; ได้ทันที
            </p>
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
              ➕ สลับเป็นโหมดสร้างผู้ใช้งานรายใหม่
            </button>
          )}
        </div>

        {allOrganizations.length === 0 ? (
          <div className="bg-slate-950/70 border border-dashed border-slate-800 rounded-2xl p-6 text-center text-xs sm:text-sm text-slate-400">
            ยังไม่มีข้อมูลผู้ใช้งานในฐานข้อมูล (ไม่มีค่า Demo) — กรุณาเลือกประเภทผู้ใช้งานและกรอกการตั้งค่าในฟอร์มด้านล่างแล้วกดปุ่ม <strong>&ldquo;💾 บันทึกลงฐานข้อมูล&rdquo;</strong>
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
                      <div className="flex items-center gap-2">
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
                          [{org.code}]
                        </span>
                      </div>

                      <span className="text-[11px] font-mono text-slate-400">
                        สถานะ: {fullComp.status || 'SAVED'}
                      </span>
                    </div>

                    <h3 className="text-base font-black text-white">{org.name}</h3>

                    <div className="mt-2 grid grid-cols-2 gap-2 bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">อุปกรณ์ / การเชื่อมต่อ</span>
                        <span className="font-mono font-bold text-cyan-300 truncate block">
                          {isHomeSolar
                            ? `${fullComp.solarConfig?.inverterModel || 'SAJ Inverter'} (${
                                fullComp.gatewayIp || 'ยังไม่ระบุ IP'
                              })`
                            : `${(fullComp.electricityMeters || []).length} มิเตอร์ • IP: ${
                                fullComp.gatewayIp || '-'
                              }`}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          รหัสล็อกอินของลูกค้ารายนี้
                        </span>
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
                      {cardTest?.loading ? '⏳ ทดสอบ...' : '📡 ทดสอบจริง'}
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
      {/* SECTION 2: ALL-IN-ONE UNIFIED SETUP, HARDWARE CONFIG & TEST FORM      */}
      {/* ===================================================================== */}
      <form
        id="unified-setup-form"
        onSubmit={handleSaveAllToDatabase}
        className="bg-slate-900/95 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">
              {isEditingExisting
                ? `✏️ โหมดแก้ไขข้อมูลผู้ใช้งาน: ${form.companyName}`
                : '➕ สร้างและตั้งค่าผู้ใช้งานใหม่ครบจบในหน้าเดียว'}
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
              ขั้นตอนที่ 1: เลือกประเภทผู้ใช้งาน (ใช้งานบริษัท หรือ ผู้ใช้งานตามบ้าน)
            </h2>
          </div>
        </div>

        {/* STEP 1: QUESTION SELECTOR — INDUSTRIAL COMPANY VS HOME SOLAR USER */}
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
                สำหรับโรงงานและอาคารที่ติดตั้ง <strong>Power Meter 3 เฟส</strong> (แสดงเมนูภาพรวมมิเตอร์ทั้งหมด, เจาะลึกรายมิเตอร์ และรายงานปรับแผนการผลิต — ไม่มีเมนูโซลาร์บ้านมารบกวน)
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
                สำหรับบ้านพักอาศัยที่ติดตั้ง <strong>Solar Inverter & แบตเตอรี่</strong> เช่น <code>SAJ H2-6K-LS2</code> (แสดงหน้าจอ PV, แบตเตอรี่ SOC%, โหลดไฟบ้าน และสถิติ Self-Consumption โดยเฉพาะ)
              </p>
            </div>
          </button>
        </div>

        {/* STEP 2: USER IDENTITY & LOGIN CREDENTIALS */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm sm:text-base font-black text-cyan-400">
            ขั้นตอนที่ 2: ข้อมูลผู้ใช้งาน และ รหัสผ่านสำหรับล็อกอิน (Login ID & Password)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {form.siteType === 'HOME_SOLAR'
                  ? 'ชื่อบ้าน / ชื่อระบบโซลาร์ของผู้ใช้งาน *'
                  : 'ชื่อบริษัท / โรงงานลูกค้า *'}
              </label>
              <input
                type="text"
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder={
                  form.siteType === 'HOME_SOLAR'
                    ? 'กรอกชื่อบ้านของคุณ'
                    : 'กรอกชื่อบริษัทลูกค้า'
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
                placeholder="เช่น HOME01 หรือ FAC01"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-cyan-300 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                ชื่อผู้ติดต่อ / เจ้าของระบบ
              </label>
              <input
                type="text"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                placeholder="ชื่อผู้ดูแล"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-amber-300 mb-1">
                🔑 ชื่อผู้ใช้งานสำหรับล็อกอิน (Login Username) *
              </label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="กำหนด Username สำหรับล็อกอินหน้าแรก"
                className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-sm text-amber-300 font-mono font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-emerald-300 mb-1">
                🔒 รหัสผ่านสำหรับล็อกอิน (Password) *
              </label>
              <input
                type="text"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="กำหนด Password สำหรับล็อกอิน"
                className="w-full bg-slate-900 border border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-sm text-emerald-300 font-mono font-bold"
              />
            </div>
          </div>
        </div>

        {/* STEP 3: HARDWARE & METER / INVERTER CONFIGURATION (DYNAMIC BY SITE TYPE) */}
        {form.siteType === 'INDUSTRIAL' ? (
          <div className="bg-slate-950/80 border border-blue-500/30 rounded-2xl p-5 space-y-5">
            <h3 className="text-sm sm:text-base font-black text-blue-400">
              ขั้นตอนที่ 3: ตั้งค่าอุปกรณ์ Gateway และรายการพาวเวอร์มิเตอร์ของบริษัท/โรงงาน
            </h3>

            {/* Gateway & Transformer Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ขนาดหม้อแปลงไฟฟ้ารวม (kVA)
                </label>
                <input
                  type="number"
                  value={form.transformerKVA}
                  onChange={(e) => setForm({ ...form, transformerKVA: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  รุ่นอุปกรณ์ Gateway ที่ใช้
                </label>
                <select
                  value={form.gatewayModel}
                  onChange={(e) => setForm({ ...form, gatewayModel: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  <option value="Waveshare RS485 to WIFI/ETH">
                    Waveshare RS485 to WIFI/ETH (SKU 21968)
                  </option>
                  <option value="Waveshare ESP32-S3-ETH-8DI-8RO">
                    Waveshare ESP32-S3-ETH-8DI-8RO
                  </option>
                  <option value="USR-DR154 / 4G LTE RS485">USR-DR154 / 4G LTE RS485</option>
                  <option value="Teltonika TRB145 4G RS485">Teltonika TRB145 4G RS485</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  IP Address : Port ของอุปกรณ์
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={form.gatewayIp}
                    onChange={(e) => setForm({ ...form, gatewayIp: e.target.value })}
                    placeholder="IP Address"
                    className="w-2/3 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-cyan-300 font-mono"
                  />
                  <input
                    type="text"
                    value={form.gatewayPort}
                    onChange={(e) => setForm({ ...form, gatewayPort: e.target.value })}
                    placeholder="502"
                    className="w-1/3 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  RS485 Baud Rate & Parity
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={form.baudRate}
                    onChange={(e) => setForm({ ...form, baudRate: e.target.value })}
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2.5 text-xs text-white font-mono"
                  >
                    <option value="9600">9600</option>
                    <option value="19200">19200</option>
                    <option value="38400">38400</option>
                    <option value="115200">115200</option>
                  </select>
                  <select
                    value={form.parity}
                    onChange={(e) => setForm({ ...form, parity: e.target.value })}
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2.5 text-xs text-white font-mono"
                  >
                    <option value="None (8N1)">8N1</option>
                    <option value="Even (8E1)">8E1</option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Gateway HTTP / Cloud Endpoint URL (สำหรับดึงค่าหรือกดทดสอบการเชื่อมต่อ)
                </label>
                <input
                  type="text"
                  value={form.gatewayEndpointUrl}
                  onChange={(e) => setForm({ ...form, gatewayEndpointUrl: e.target.value })}
                  placeholder="ระบุ URL ของอุปกรณ์หากเชื่อมต่อผ่าน HTTP API หรือเว้นว่างหากส่งเข้าฐานข้อมูล Supabase"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-emerald-300 font-mono"
                />
              </div>
            </div>

            {/* Power Meters List in the Same Page */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-black text-white">
                  ⚡ รายการพาวเวอร์มิเตอร์ ({form.electricityMeters.length} จุดวัด)
                </span>
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
                  + เพิ่มจุดวัดพาวเวอร์มิเตอร์
                </button>
              </div>

              <div className="space-y-2.5">
                {form.electricityMeters.map((m, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-slate-900/90 border border-slate-800 p-3 rounded-2xl items-end text-xs"
                  >
                    <div className="sm:col-span-3">
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
                        placeholder={`ชื่อมิเตอร์ตัวที่ ${idx + 1}`}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[10px] text-amber-300 font-bold mb-1">
                        Slave ID
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
                        รุ่นพาวเวอร์มิเตอร์ (Auto Register)
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
                      <label className="block text-[10px] text-slate-400 mb-1">CT Ratio</label>
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

                    <div className="sm:col-span-1">
                      <label className="block text-[10px] text-slate-400 mb-1">Reg (kW)</label>
                      <input
                        type="number"
                        value={m.regActivePowerKW}
                        onChange={(e) => {
                          const list = [...form.electricityMeters];
                          list[idx].regActivePowerKW = Number(e.target.value);
                          setForm({ ...form, electricityMeters: list });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-cyan-300 font-mono"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[10px] text-emerald-300 font-bold mb-1">
                        ค่าจริง (kW)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={m.liveKW}
                        onChange={(e) => {
                          const list = [...form.electricityMeters];
                          list[idx].liveKW = Number(e.target.value);
                          setForm({ ...form, electricityMeters: list });
                        }}
                        className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-2 py-2 text-emerald-300 font-mono font-bold"
                      />
                    </div>

                    <div className="sm:col-span-1 text-right">
                      {form.electricityMeters.length > 1 && (
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
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* HOME SOLAR INVERTER CONFIG IN THE SAME SINGLE PAGE */
          <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-5 space-y-5">
            <h3 className="text-sm sm:text-base font-black text-emerald-400">
              ขั้นตอนที่ 3: ตั้งค่าเครื่อง Solar Hybrid Inverter & แบตเตอรี่ประจำบ้าน (Read-Only 100%)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
              <div className="sm:col-span-2">
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
                    SAJ H2-6K-LS2 (Hybrid 6kW Single-Phase)
                  </option>
                  <option value="SAJ H2-5K/8K/10K Series">SAJ H2 Series (5K / 8K / 10K)</option>
                  <option value="Huawei SUN2000 Hybrid">Huawei SUN2000 Hybrid</option>
                  <option value="Deye SUN-5K/6K-SG04LP1">Deye Hybrid Inverter</option>
                  <option value="Growatt MIN/SPH Hybrid">Growatt Hybrid Inverter</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  วิธีเชื่อมต่อดึงข้อมูล (Read-Only)
                </label>
                <select
                  value={form.solarConfig.connectionMethod}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      solarConfig: { ...form.solarConfig, connectionMethod: e.target.value }
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-emerald-300 font-bold"
                >
                  <option value="WIFI_MODBUS_TCP">
                    วิธีที่ 1: ดึงผ่าน WiFi Dongle (AIO3 Port 502)
                  </option>
                  <option value="RS485_GATEWAY">
                    วิธีที่ 2: ต่อสาย RS485 ใต้เครื่อง (Pin 5 A+, Pin 4 B-)
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-cyan-300 mb-1">
                  IP ของอินเวอร์เตอร์ในบ้าน : Port
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={form.gatewayIp}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        gatewayIp: e.target.value,
                        solarConfig: { ...form.solarConfig, inverterIp: e.target.value }
                      })
                    }
                    placeholder="เช่น 192.168.1.xxx"
                    className="w-2/3 bg-slate-900 border border-cyan-500/40 rounded-xl px-3 py-2.5 text-cyan-300 font-mono"
                  />
                  <input
                    type="text"
                    value={form.gatewayPort}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        gatewayPort: e.target.value,
                        solarConfig: { ...form.solarConfig, inverterPort: e.target.value }
                      })
                    }
                    placeholder="502"
                    className="w-1/3 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Modbus Slave ID</label>
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">ความจุแบตเตอรี่ลิเธียม (kWh)</label>
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-amber-300 font-bold mb-1">
                  กำลังผลิตโซลาร์ PV1 (W)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form.solarConfig.pv1PowerW}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      solarConfig: { ...form.solarConfig, pv1PowerW: Number(e.target.value) }
                    })
                  }
                  className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-emerald-300 font-bold mb-1">
                  เปอร์เซ็นต์แบตเตอรี่ SOC (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form.solarConfig.batterySOC}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      solarConfig: { ...form.solarConfig, batterySOC: Number(e.target.value) }
                    })
                  }
                  className="w-full bg-slate-900 border border-emerald-500/40 rounded-xl px-3 py-2 text-emerald-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">แรงดัน PV1 (V) / กระแส PV1 (A)</label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    value={form.solarConfig.pv1Voltage}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        solarConfig: {
                          ...form.solarConfig,
                          pv1Voltage: Number(e.target.value)
                        }
                      })
                    }
                    placeholder="V"
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-white font-mono"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={form.solarConfig.pv1Current}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        solarConfig: {
                          ...form.solarConfig,
                          pv1Current: Number(e.target.value)
                        }
                      })
                    }
                    placeholder="A"
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-cyan-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  โหลดใช้ไฟในบ้านรวม Total Load (W)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form.solarConfig.totalLoadPowerW}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      solarConfig: {
                        ...form.solarConfig,
                        totalLoadPowerW: Number(e.target.value)
                      }
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  ไฟผลิตได้วันนี้ Today Energy (kWh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.solarConfig.todayEnergyKWh}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      solarConfig: {
                        ...form.solarConfig,
                        todayEnergyKWh: Number(e.target.value)
                      }
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-emerald-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  ไฟผลิตสะสมทั้งหมด Total (kWh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.solarConfig.totalEnergyKWh}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      solarConfig: {
                        ...form.solarConfig,
                        totalEnergyKWh: Number(e.target.value)
                      }
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Live Connection Test Result Box inside the Form */}
        {connectionTestResult && (
          <div
            className={`p-4 rounded-2xl border text-xs ${
              connectionTestResult.success
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
            }`}
          >
            <div className="font-black flex items-center justify-between">
              <span>
                {connectionTestResult.success
                  ? '🟢 ผลการทดสอบเชื่อมต่ออุปกรณ์และฐานข้อมูล: สำเร็จ (ONLINE)'
                  : '🟡 ผลการทดสอบสถานะ:'}
              </span>
              <span>เวลาทดสอบ: {connectionTestResult.testedAt}</span>
            </div>
            <div className="mt-1">{connectionTestResult.message}</div>
          </div>
        )}

        {/* Expandable Direct RS485 Web Serial Tester right inside the Unified Form */}
        {showRs485Panel && (
          <div className="bg-slate-950 border border-cyan-500/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-cyan-400">
                🔌 ทดสอบสายสัญญาณจริงผ่านพอร์ต USB-to-RS485 (Modbus RTU Read-Only 03/04)
              </span>
              <button
                type="button"
                onClick={() => setShowRs485Panel(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ✕ ซ่อนแผงทดสอบ RS485
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Baud Rate</label>
                <select
                  value={serialConfig.baudRate}
                  onChange={(e) =>
                    setSerialConfig({ ...serialConfig, baudRate: Number(e.target.value) })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-white font-mono"
                >
                  <option value={9600}>9600</option>
                  <option value={19200}>19200</option>
                  <option value={115200}>115200</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-amber-300 mb-1">Slave ID</label>
                <input
                  type="number"
                  value={serialConfig.slaveId}
                  onChange={(e) =>
                    setSerialConfig({ ...serialConfig, slaveId: Number(e.target.value) })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-amber-300 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] text-cyan-300 mb-1">
                  Register (เช่น 3060 หรือ 16493)
                </label>
                <input
                  type="number"
                  value={serialConfig.regAddress}
                  onChange={(e) =>
                    setSerialConfig({ ...serialConfig, regAddress: Number(e.target.value) })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-cyan-300 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">ชนิดข้อมูล</label>
                <select
                  value={serialConfig.dataType}
                  onChange={(e) => setSerialConfig({ ...serialConfig, dataType: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-white font-mono"
                >
                  <option value="float32">Float32 (PM2200/DTSU)</option>
                  <option value="uint16">UInt16 (SAJ Inverter)</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleRunRs485Test}
                  disabled={isSerialRunning}
                  className="w-full py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer"
                >
                  {isSerialRunning ? '⏳ กำลังอ่าน...' : '⚡ ยิงอ่านค่าจริง'}
                </button>
              </div>
            </div>
            {serialLogs.length > 0 && (
              <div className="bg-slate-900 rounded-xl p-2.5 font-mono text-[11px] space-y-1 max-h-32 overflow-y-auto">
                {serialLogs.map((l, i) => (
                  <div key={i} className="text-slate-200">
                    [{l.time}] <strong className="text-cyan-300">{l.type}:</strong> {l.msg}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: UNIFIED ACTION BAR (TEST CONNECTION + TEST RS485 + SAVE TO DATABASE) */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleTestFormConnection}
              disabled={isTestingConnection}
              className="px-4 py-3.5 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 font-black text-xs sm:text-sm cursor-pointer flex items-center justify-center gap-2"
            >
              {isTestingConnection
                ? '⏳ กำลังทดสอบสถานะ...'
                : '📡 1. ปุ่มทดสอบสถานะการเชื่อมต่อจริง'}
            </button>

            <button
              type="button"
              onClick={() => setShowRs485Panel(!showRs485Panel)}
              className="px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-xs sm:text-sm cursor-pointer flex items-center justify-center gap-2"
            >
              🔌 2. ทดสอบผ่านสาย USB-to-RS485
            </button>

            <button
              type="button"
              onClick={() => setShowCodeHelper(!showCodeHelper)}
              className="px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs sm:text-sm cursor-pointer"
            >
              📘 ดูโค้ดส่งข้อมูล & ตาราง Register
            </button>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-amber-500/25 cursor-pointer"
          >
            {isSaving
              ? '⏳ กำลังบันทึกลงฐานข้อมูล...'
              : '💾 3. บันทึกข้อมูลทั้งหมดลงฐานข้อมูล'}
          </button>
        </div>
      </form>

      {/* ===================================================================== */}
      {/* OPTIONAL EXPANDABLE: REGISTER CHEAT-SHEET & AUTO PYTHON SCRIPT        */}
      {/* ===================================================================== */}
      {showCodeHelper && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-white">
              📘 ตารางเลข Modbus Register มาตรฐาน (Read-Only Function 03/04 — ปลอดภัยต่ออุปกรณ์ 100%)
            </h3>
            <button
              type="button"
              onClick={() => setShowCodeHelper(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              ✕ ซ่อนตาราง
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-slate-950 text-slate-300 border-b border-slate-800">
                  <th className="py-2.5 px-3">รุ่นอุปกรณ์</th>
                  <th className="py-2.5 px-3">ประเภท</th>
                  <th className="py-2.5 px-3 text-cyan-300">Active Power (kW/W)</th>
                  <th className="py-2.5 px-3 text-emerald-300">Energy (kWh)</th>
                  <th className="py-2.5 px-3">Voltage (V)</th>
                  <th className="py-2.5 px-3">Current (A)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {Object.values(METER_MODEL_PRESETS).map((p) => (
                  <tr key={p.model} className="bg-slate-900/60">
                    <td className="py-2 px-3 font-sans font-bold text-white">{p.model}</td>
                    <td className="py-2 px-3 text-amber-300">{p.category}</td>
                    <td className="py-2 px-3 font-bold text-cyan-300">{p.regActivePowerKW}</td>
                    <td className="py-2 px-3 font-bold text-emerald-300">{p.regEnergyKWh}</td>
                    <td className="py-2 px-3 text-slate-200">{p.regVoltageLL}</td>
                    <td className="py-2 px-3 text-slate-200">{p.regCurrentAvg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              ☁️ ตั้งค่าการเชื่อมต่อฐานข้อมูลหลัก (Supabase Cloud Database)
            </h3>
            <p className="text-xs text-slate-400">
              ใส่ Project URL และ Anon/Service Key เพื่อซิงค์ข้อมูลลูกค้าและค่ามิเตอร์ทั้งหมดลงฐานข้อมูลคลาวด์โดยตรง
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
