import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { TENANT_COMPANIES, METER_MODEL_PRESETS } from '../data/tenantData';
import { getSupabase } from '../services/supabaseClient';

// Helper: Calculate standard Modbus RTU CRC-16
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

export const SuperAdminConsole = ({ onInspectTenant }) => {
  const {
    allOrganizations,
    allAccounts,
    activeOrgId,
    switchOrganization,
    onboardNewClient,
    updateOrganization,
    createClientAccount,
    updateClientAccount,
    deleteClientAccount,
    addMeterToOrganization,
    updateMeterInOrganization,
    removeMeterFromOrganization,
    removeOrganization,
    clearAllDemoData,
    testRealGatewayConnection
  } = useAuth();

  // Main Sub-Tabs: 'clients' | 'onboard' | 'hardware-test' | 'guide' | 'accounts'
  const [subTab, setSubTab] = useState('clients');
  const [bannerMsg, setBannerMsg] = useState(null);

  // Testing state per Org or Meter
  const [testingOrgId, setTestingOrgId] = useState(null);
  const [orgTestResults, setOrgTestResults] = useState({});
  const [testingMeterId, setTestingMeterId] = useState(null);
  const [meterTestResults, setMeterTestResults] = useState({});

  // Modal 1: Edit Client & Gateway Config Modal (Most frequent admin edits)
  const [editingOrgModal, setEditingOrgModal] = useState(null);
  const [orgEditForm, setOrgEditForm] = useState({});

  // Modal 2: Manage & Edit Meters of a Client
  const [managingMetersOrgId, setManagingMetersOrgId] = useState(null);
  const [editingMeterId, setEditingMeterId] = useState(null);
  const [meterEditForm, setMeterEditForm] = useState({});
  const [newMeterForm, setNewMeterForm] = useState({
    name: '',
    panel: 'Main MDB',
    tag: 'MDB-01',
    slaveId: 1,
    model: 'Schneider PM2200',
    ctRatio: '400/5A',
    regActivePowerKW: 3060,
    regEnergyKWh: 3204,
    regVoltageLL: 3020,
    regCurrentAvg: 3000,
    liveKW: 0,
    voltageLL: 400,
    currentA: 0,
    pf: 0.95,
    todayKWh: 0
  });

  // Onboard New Client Form
  const [onboardForm, setOnboardForm] = useState({
    companyName: '',
    companyCode: '',
    industry: 'โรงงานอุตสาหกรรมและการผลิต',
    location: '',
    transformerKVA: 1600,
    gatewayModel: 'Waveshare RS485 to Ethernet PoE',
    gatewaySerial: '',
    gatewayIp: '192.168.1.200',
    gatewayPort: '502',
    gatewayEndpointUrl: '',
    gatewayApiKey: '',
    baudRate: '9600',
    parity: 'None (8N1)',
    pollingIntervalSec: 5,
    username: '',
    password: '',
    contactName: '',
    email: ''
  });

  const [newClientMeters, setNewClientMeters] = useState([
    {
      name: 'Main Incoming MDB #1',
      panel: 'ตู้เมน MDB ชั้น 1',
      tag: 'MDB-01',
      slaveId: 1,
      model: 'Schneider PM2200',
      ctRatio: '1600/5A',
      regActivePowerKW: 3060,
      regEnergyKWh: 3204,
      regVoltageLL: 3020,
      regCurrentAvg: 3000,
      baseKW: 0
    }
  ]);

  // Direct Hardware Tester State (Web Serial RS485 + HTTP Endpoint Tester)
  const [serialConfig, setSerialConfig] = useState({
    baudRate: 9600,
    parity: 'none',
    slaveId: 1,
    funcCode: 3,
    regAddress: 3060,
    regCount: 2,
    dataType: 'float32',
    targetOrgId: activeOrgId || '',
    targetMeterId: ''
  });
  const [serialLog, setSerialLog] = useState([]);
  const [isSerialBusy, setIsSerialBusy] = useState(false);

  // HTTP / Cloud Live Packet Tester State
  const [httpTestUrl, setHttpTestUrl] = useState('');
  const [httpTestToken, setHttpTestToken] = useState('');
  const [httpTestResult, setHttpTestResult] = useState(null);
  const [isHttpTesting, setIsHttpTesting] = useState(false);

  // Guide Tab selected org for code generation
  const [guideOrgId, setGuideOrgId] = useState(activeOrgId || '');

  // Accounts & Cloud Tab State
  const [editingAccount, setEditingAccount] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [newAccForm, setNewAccForm] = useState({
    orgId: activeOrgId || '',
    username: '',
    password: '',
    fullName: '',
    role: 'PLANT_MANAGER'
  });

  const [sbUrl, setSbUrl] = useState(
    () =>
      localStorage.getItem('AOB_SUPABASE_URL') ||
      import.meta.env.VITE_SUPABASE_URL ||
      ''
  );
  const [sbAnonKey, setSbAnonKey] = useState(
    () =>
      localStorage.getItem('AOB_SUPABASE_ANON_KEY') ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      ''
  );
  const supabaseReady = Boolean(getSupabase());

  const notify = (type, text) => {
    setBannerMsg({ type, text });
    setTimeout(() => {
      setBannerMsg((prev) => (prev?.text === text ? null : prev));
    }, 6000);
  };

  // Open Client Edit Modal
  const handleOpenEditOrg = (org) => {
    const fullComp = TENANT_COMPANIES[org.id] || org;
    setEditingOrgModal(org.id);
    setOrgEditForm({
      name: fullComp.name || '',
      code: fullComp.code || '',
      industry: fullComp.industry || 'โรงงานอุตสาหกรรม',
      location: fullComp.location || '',
      transformerKVA: fullComp.transformerKVA || 1600,
      gatewayModel: fullComp.gatewayModel || 'Waveshare RS485 to Ethernet PoE',
      gatewaySerial: fullComp.gatewaySerial || '',
      gatewayIp: fullComp.gatewayIp || '192.168.1.200',
      gatewayPort: fullComp.gatewayPort || '502',
      gatewayEndpointUrl: fullComp.gatewayEndpointUrl || '',
      gatewayApiKey: fullComp.gatewayApiKey || '',
      baudRate: fullComp.baudRate || '9600',
      parity: fullComp.parity || 'None (8N1)',
      pollingIntervalSec: fullComp.pollingIntervalSec || 5
    });
  };

  const handleSaveOrgEdit = (e) => {
    e.preventDefault();
    if (!editingOrgModal) return;
    const kva = Number(orgEditForm.transformerKVA) || 1600;
    updateOrganization(editingOrgModal, {
      ...orgEditForm,
      transformerKVA: kva,
      contractPeakKW: Math.round(kva * 0.85),
      pollingIntervalSec: Number(orgEditForm.pollingIntervalSec) || 5
    });
    setEditingOrgModal(null);
    notify('success', `บันทึกการแก้ไขข้อมูลบริษัท "${orgEditForm.name}" และตั้งค่า Gateway เรียบร้อยแล้ว`);
  };

  // Real Gateway Status Test
  const handleRunGatewayTest = async (orgId) => {
    setTestingOrgId(orgId);
    const res = await testRealGatewayConnection(orgId);
    setOrgTestResults((prev) => ({
      ...prev,
      [orgId]: {
        ...res,
        testedAt: new Date().toLocaleTimeString('th-TH')
      }
    }));
    setTestingOrgId(null);
  };

  // Real Individual Meter Status Test
  const handleTestSingleMeter = async (orgId, meter) => {
    setTestingMeterId(meter.id);
    const comp = TENANT_COMPANIES[orgId];
    const startTime = performance.now();
    const nowStr = new Date().toLocaleTimeString('th-TH');

    try {
      // 1. Check if Gateway HTTP Endpoint is configured
      if (comp?.gatewayEndpointUrl && comp.gatewayEndpointUrl.trim().startsWith('http')) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const url = new URL(comp.gatewayEndpointUrl.trim());
        url.searchParams.set('slaveId', meter.slaveId);
        url.searchParams.set('meterId', meter.id);

        const headers = {};
        if (comp.gatewayApiKey) headers['Authorization'] = `Bearer ${comp.gatewayApiKey}`;

        const resp = await fetch(url.toString(), {
          method: 'GET',
          headers,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const latency = Math.round(performance.now() - startTime);

        if (resp.ok) {
          let payload = null;
          try {
            payload = await resp.json();
          } catch {}

          const updatedFields = {
            connectionStatus: 'ONLINE',
            lastTestedAt: nowStr,
            lastLatencyMs: latency
          };
          if (payload && typeof payload === 'object') {
            if (payload.active_power_kw !== undefined || payload.kW !== undefined) {
              updatedFields.liveKW = Number(payload.active_power_kw ?? payload.kW) || 0;
              updatedFields.baseKW = updatedFields.liveKW;
            }
            if (payload.voltage !== undefined) updatedFields.voltageLL = Number(payload.voltage) || 400;
            if (payload.current !== undefined) updatedFields.currentA = Number(payload.current) || 0;
            if (payload.kwh !== undefined) updatedFields.todayKWh = Number(payload.kwh) || 0;
          }

          updateMeterInOrganization(orgId, meter.id, updatedFields);
          setMeterTestResults((prev) => ({
            ...prev,
            [meter.id]: {
              success: true,
              status: 'ONLINE',
              latencyMs: latency,
              message: `มิเตอร์ Slave ID #${meter.slaveId} ตอบสนองปกติ (${latency} ms)`
            }
          }));
          setTestingMeterId(null);
          return;
        } else {
          updateMeterInOrganization(orgId, meter.id, {
            connectionStatus: 'ERROR',
            lastTestedAt: nowStr
          });
          setMeterTestResults((prev) => ({
            ...prev,
            [meter.id]: {
              success: false,
              status: 'ERROR',
              message: `HTTP ${resp.status}: Gateway ไม่สามารถอ่านค่าจาก Slave ID #${meter.slaveId}`
            }
          }));
          setTestingMeterId(null);
          return;
        }
      }

      // 2. Check Supabase meter_readings for this meter
      const supabase = getSupabase();
      if (supabase) {
        const { data, error } = await supabase
          .from('meter_readings')
          .select('*')
          .eq('org_id', orgId)
          .order('recorded_at', { ascending: false })
          .limit(10);

        const latency = Math.round(performance.now() - startTime);
        const matched = (data || []).find(
          (r) =>
            r.meter_id === meter.id ||
            r.meter_id === meter.tag ||
            Number(r.slave_id) === Number(meter.slaveId)
        );

        if (!error && matched) {
          const readKW = Number(matched.active_power_kw ?? matched.reading_value) || 0;
          updateMeterInOrganization(orgId, meter.id, {
            connectionStatus: 'ONLINE',
            lastTestedAt: nowStr,
            lastLatencyMs: latency,
            liveKW: readKW,
            baseKW: readKW
          });
          setMeterTestResults((prev) => ({
            ...prev,
            [meter.id]: {
              success: true,
              status: 'ONLINE',
              latencyMs: latency,
              message: `พบค่าจริงจาก Cloud ล่าสุด: ${readKW} kW (${latency} ms)`
            }
          }));
          setTestingMeterId(null);
          return;
        } else {
          updateMeterInOrganization(orgId, meter.id, {
            connectionStatus: 'WAITING',
            lastTestedAt: nowStr
          });
          setMeterTestResults((prev) => ({
            ...prev,
            [meter.id]: {
              success: false,
              status: 'WAITING',
              message: `เชื่อมต่อ Cloud สำเร็จ (${latency} ms) แต่ยังไม่มีข้อมูลส่งมาจาก Slave ID #${meter.slaveId}`
            }
          }));
          setTestingMeterId(null);
          return;
        }
      }

      // 3. Not configured yet
      updateMeterInOrganization(orgId, meter.id, {
        connectionStatus: 'NOT_CONFIGURED',
        lastTestedAt: nowStr
      });
      setMeterTestResults((prev) => ({
        ...prev,
        [meter.id]: {
          success: false,
          status: 'NOT_CONFIGURED',
          message: `กรุณาตั้งค่า Gateway Endpoint URL หรือใช้เมนู "🔌 ทดสอบสาย RS485 จริง" เพื่ออ่านค่าจากมิเตอร์ตัวนี้`
        }
      }));
    } catch (err) {
      updateMeterInOrganization(orgId, meter.id, {
        connectionStatus: 'OFFLINE',
        lastTestedAt: nowStr
      });
      setMeterTestResults((prev) => ({
        ...prev,
        [meter.id]: {
          success: false,
          status: 'OFFLINE',
          message: `ไม่พบสัญญาณตอบกลับจากมิเตอร์ (${err.name === 'AbortError' ? 'Timeout 5s' : err.message})`
        }
      }));
    }
    setTestingMeterId(null);
  };

  // Start editing a specific meter inside the Meter Modal
  const handleStartEditMeter = (m) => {
    setEditingMeterId(m.id);
    setMeterEditForm({
      name: m.name || '',
      panel: m.panel || 'Main MDB',
      tag: m.tag || 'MDB-01',
      slaveId: m.slaveId || 1,
      model: m.model || 'Schneider PM2200',
      ctRatio: m.ctRatio || '400/5A',
      regActivePowerKW: m.regActivePowerKW || 3060,
      regEnergyKWh: m.regEnergyKWh || 3204,
      regVoltageLL: m.regVoltageLL || 3020,
      regCurrentAvg: m.regCurrentAvg || 3000,
      liveKW: m.liveKW ?? m.baseKW ?? 0,
      voltageLL: m.voltageLL ?? 400,
      currentA: m.currentA ?? 0,
      pf: m.pf ?? 0.95,
      todayKWh: m.todayKWh ?? 0
    });
  };

  const handleSaveMeterEdit = (e) => {
    e.preventDefault();
    if (!managingMetersOrgId || !editingMeterId) return;
    updateMeterInOrganization(managingMetersOrgId, editingMeterId, {
      ...meterEditForm,
      slaveId: Number(meterEditForm.slaveId) || 1,
      regActivePowerKW: Number(meterEditForm.regActivePowerKW) || 3060,
      regEnergyKWh: Number(meterEditForm.regEnergyKWh) || 3204,
      regVoltageLL: Number(meterEditForm.regVoltageLL) || 3020,
      regCurrentAvg: Number(meterEditForm.regCurrentAvg) || 3000,
      liveKW: Number(meterEditForm.liveKW) || 0,
      baseKW: Number(meterEditForm.liveKW) || 0,
      voltageLL: Number(meterEditForm.voltageLL) || 400,
      currentA: Number(meterEditForm.currentA) || 0,
      pf: Number(meterEditForm.pf) || 0.95,
      todayKWh: Number(meterEditForm.todayKWh) || 0
    });
    setEditingMeterId(null);
    notify('success', `อัปเดตการตั้งค่าพาวเวอร์มิเตอร์ "${meterEditForm.name}" เรียบร้อยแล้ว`);
  };

  const handleAddMeterSubmit = (e) => {
    e.preventDefault();
    if (!managingMetersOrgId || !newMeterForm.name.trim()) return;
    addMeterToOrganization(managingMetersOrgId, {
      ...newMeterForm,
      baseKW: Number(newMeterForm.liveKW) || 0
    });
    const comp = TENANT_COMPANIES[managingMetersOrgId];
    const nextSlave = (comp?.electricityMeters?.length || 1) + 1;
    setNewMeterForm({
      ...newMeterForm,
      name: '',
      tag: `MDB-${String(nextSlave).padStart(2, '0')}`,
      slaveId: nextSlave,
      liveKW: 0
    });
    notify('success', 'เพิ่มพาวเวอร์มิเตอร์ใหม่เข้าสู่บริษัทเรียบร้อยแล้ว');
  };

  // Apply Model Preset to Meter Form
  const applyModelPreset = (modelName, isEditMode = false) => {
    const preset = METER_MODEL_PRESETS[modelName] || METER_MODEL_PRESETS['Schneider PM2200'];
    if (isEditMode) {
      setMeterEditForm((prev) => ({
        ...prev,
        model: modelName,
        regActivePowerKW: preset.regActivePowerKW,
        regEnergyKWh: preset.regEnergyKWh,
        regVoltageLL: preset.regVoltageLL,
        regCurrentAvg: preset.regCurrentAvg
      }));
    } else {
      setNewMeterForm((prev) => ({
        ...prev,
        model: modelName,
        regActivePowerKW: preset.regActivePowerKW,
        regEnergyKWh: preset.regEnergyKWh,
        regVoltageLL: preset.regVoltageLL,
        regCurrentAvg: preset.regCurrentAvg
      }));
    }
  };

  // Onboard New Client Submit
  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    if (!onboardForm.companyName.trim() || !onboardForm.username.trim() || !onboardForm.password.trim()) {
      notify('error', 'กรุณากรอก ชื่อบริษัทลูกค้า, Username และ Password สำหรับลูกค้าให้ครบถ้วน');
      return;
    }

    const res = await onboardNewClient({
      ...onboardForm,
      electricityMeters: newClientMeters
    });

    notify(
      'success',
      `สร้างบริษัท "${res.organization.name}" พร้อมมิเตอร์ ${newClientMeters.length} ตัว และบัญชี "${res.account.username}" สำเร็จ!`
    );

    setOnboardForm({
      companyName: '',
      companyCode: '',
      industry: 'โรงงานอุตสาหกรรมและการผลิต',
      location: '',
      transformerKVA: 1600,
      gatewayModel: 'Waveshare RS485 to Ethernet PoE',
      gatewaySerial: '',
      gatewayIp: '192.168.1.200',
      gatewayPort: '502',
      gatewayEndpointUrl: '',
      gatewayApiKey: '',
      baudRate: '9600',
      parity: 'None (8N1)',
      pollingIntervalSec: 5,
      username: '',
      password: '',
      contactName: '',
      email: ''
    });
    setSubTab('clients');
  };

  // Direct Web Serial API (USB-to-RS485) Live Modbus RTU Test
  const handleWebSerialModbusTest = async () => {
    const appendLog = (type, msg) => {
      setSerialLog((prev) => [
        { time: new Date().toLocaleTimeString('th-TH'), type, msg },
        ...prev.slice(0, 19)
      ]);
    };

    if (!('serial' in navigator)) {
      appendLog(
        'ERROR',
        'เบราว์เซอร์นี้ไม่รองรับ Web Serial API (กรุณาเปิดด้วย Google Chrome หรือ Microsoft Edge บนคอมพิวเตอร์ที่เสียบสายแปลง USB-to-RS485)'
      );
      return;
    }

    setIsSerialBusy(true);
    let port = null;
    try {
      appendLog('INFO', 'กำลังเปิดหน้าต่างเลือกพอร์ต COM (USB-to-RS485)...');
      port = await navigator.serial.requestPort();
      await port.open({
        baudRate: Number(serialConfig.baudRate) || 9600,
        dataBits: 8,
        stopBits: 1,
        parity: serialConfig.parity || 'none'
      });

      const slave = Number(serialConfig.slaveId) & 0xff;
      const func = Number(serialConfig.funcCode) & 0xff;
      const reg = Number(serialConfig.regAddress) & 0xffff;
      const count = Number(serialConfig.regCount) & 0xffff;

      const payload = [
        slave,
        func,
        (reg >> 8) & 0xff,
        reg & 0xff,
        (count >> 8) & 0xff,
        count & 0xff
      ];
      const [crcLo, crcHi] = calculateModbusCRC16(payload);
      const frame = new Uint8Array([...payload, crcLo, crcHi]);

      appendLog(
        'TX',
        `ส่งคำสั่ง Modbus RTU ไปยัง Slave #${slave}, Reg ${reg} -> [HEX: ${toHexString(frame)}]`
      );

      const writer = port.writable.getWriter();
      await writer.write(frame);
      writer.releaseLock();

      // Read response with 2.5s timeout
      const reader = port.readable.getReader();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('หมดเวลารอรับข้อมูล (Timeout 2.5 วินาที - ตรวจสอบสาย A/B หรือ Slave ID)')), 2500)
      );

      const { value } = await Promise.race([reader.read(), timeoutPromise]);
      reader.releaseLock();

      if (value && value.length >= 5) {
        const hexRx = toHexString(value);
        let decodedVal = null;

        // Parse Float32 (4 bytes data at index 3..6) or UInt16 (2 bytes at index 3..4)
        if (value.length >= 7 && serialConfig.dataType === 'float32') {
          const buf = new ArrayBuffer(4);
          const view = new DataView(buf);
          view.setUint8(0, value[3]);
          view.setUint8(1, value[4]);
          view.setUint8(2, value[5]);
          view.setUint8(3, value[6]);
          decodedVal = Number(view.getFloat32(0, false).toFixed(2));
        } else if (value.length >= 5) {
          decodedVal = (value[3] << 8) | value[4];
        }

        appendLog(
          'RX',
          `เชื่อมต่อสำเร็จ! ได้รับข้อมูลตอบกลับ [HEX: ${hexRx}] -> ค่าที่อ่านได้ = ${decodedVal}`
        );

        // If target org and meter selected, save real reading into meter
        if (serialConfig.targetOrgId && serialConfig.targetMeterId && decodedVal !== null) {
          updateMeterInOrganization(serialConfig.targetOrgId, serialConfig.targetMeterId, {
            connectionStatus: 'ONLINE',
            lastTestedAt: new Date().toLocaleTimeString('th-TH'),
            liveKW: decodedVal,
            baseKW: decodedVal
          });
          appendLog('SUCCESS', `บันทึกค่าจริง (${decodedVal}) ลงในมิเตอร์ของลูกค้าเรียบร้อยแล้ว!`);
        }
      } else {
        appendLog('ERROR', 'ได้รับข้อมูลไม่ครบถ้วนจากพอร์ต RS485');
      }
    } catch (err) {
      appendLog('ERROR', `การเชื่อมต่อ RS485 ไม่สำเร็จ: ${err.message}`);
    } finally {
      if (port) {
        try {
          await port.close();
        } catch {}
      }
      setIsSerialBusy(false);
    }
  };

  // Direct HTTP / Cloud Endpoint Diagnostic Test
  const handleDirectHttpTest = async (e) => {
    e.preventDefault();
    if (!httpTestUrl.trim()) return;
    setIsHttpTesting(true);
    setHttpTestResult(null);
    const start = performance.now();
    try {
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 5000);
      const headers = {};
      if (httpTestToken.trim()) {
        headers['Authorization'] = `Bearer ${httpTestToken.trim()}`;
      }
      const resp = await fetch(httpTestUrl.trim(), {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(tId);
      const ms = Math.round(performance.now() - start);
      const text = await resp.text();
      setHttpTestResult({
        ok: resp.ok,
        status: resp.status,
        latencyMs: ms,
        body: text.slice(0, 800),
        time: new Date().toLocaleTimeString('th-TH')
      });
    } catch (err) {
      setHttpTestResult({
        ok: false,
        status: 'NETWORK_ERR',
        latencyMs: Math.round(performance.now() - start),
        body: err.name === 'AbortError' ? 'หมดเวลาเชื่อมต่อ (Timeout 5 วินาที)' : err.message,
        time: new Date().toLocaleTimeString('th-TH')
      });
    }
    setIsHttpTesting(false);
  };

  // Status badge helper (100% honest status, no fake online)
  const renderConnectionBadge = (status, latencyMs) => {
    if (status === 'ONLINE') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          เชื่อมต่อจริง ONLINE {latencyMs ? `(${latencyMs} ms)` : ''}
        </span>
      );
    }
    if (status === 'OFFLINE' || status === 'ERROR') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          ไม่พบสัญญาณ / OFFLINE
        </span>
      );
    }
    if (status === 'WAITING_DATA' || status === 'WAITING') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          รอแพ็กเกจข้อมูลจากอุปกรณ์
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        รอทดสอบสถานะจริง
      </span>
    );
  };

  const managingOrgCompany = managingMetersOrgId ? TENANT_COMPANIES[managingMetersOrgId] : null;
  const selectedGuideCompany =
    TENANT_COMPANIES[guideOrgId] ||
    TENANT_COMPANIES[activeOrgId] ||
    Object.values(TENANT_COMPANIES)[0] ||
    null;

  return (
    <div className="space-y-6 pb-16">
      {/* Top Super Admin Executive Command Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/90 to-slate-900 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              SUPER ADMIN PRODUCTION HARDWARE & CLIENT CENTER • คุณณัฐพงษ์ (natshownolimit@gmail.com)
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              ศูนย์จัดการลูกค้า ตั้งค่าพาวเวอร์มิเตอร์ และเชื่อมต่ออุปกรณ์จริง (Production Mode)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              ไม่มีข้อมูล Demo ล็อกค้างในระบบ • แก้ไขข้อมูลลูกค้า/มิเตอร์ได้ 100% พร้อมปุ่มทดสอบสัญญาณอุปกรณ์จริง (HTTP / Cloud / RS485)
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 shrink-0">
            <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-center">
              <div className="text-[10px] text-slate-400 font-bold uppercase">บริษัทลูกค้าจริง</div>
              <div className="text-xl font-black text-cyan-400">{allOrganizations.length}</div>
              <div className="text-[10px] text-slate-400">แห่ง</div>
            </div>
            <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-center">
              <div className="text-[10px] text-slate-400 font-bold uppercase">พาวเวอร์มิเตอร์รวม</div>
              <div className="text-xl font-black text-emerald-400">
                {allOrganizations.reduce((acc, o) => acc + (o.elecMeterCount || 0), 0)}
              </div>
              <div className="text-[10px] text-slate-400">จุดวัด</div>
            </div>
            <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-center">
              <div className="text-[10px] text-slate-400 font-bold uppercase">บัญชีลูกค้า</div>
              <div className="text-xl font-black text-amber-400">
                {allAccounts.filter((a) => a.role !== 'SUPER_ADMIN').length}
              </div>
              <div className="text-[10px] text-slate-400">บัญชี</div>
            </div>
          </div>
        </div>

        {/* 5 Action Sub-Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'clients', label: '🏢 1. จัดการลูกค้า & ตั้งค่ามิเตอร์' },
              { id: 'onboard', label: '➕ 2. เพิ่มบริษัทลูกค้าใหม่' },
              { id: 'hardware-test', label: '🔌 3. เชื่อมต่ออุปกรณ์จริง & ทดสอบสัญญาณ' },
              { id: 'guide', label: '📘 4. คู่มือการต่อสาย & โค้ดส่งข้อมูลจริง' },
              { id: 'accounts', label: '🔐 5. รหัสผ่านลูกค้า & ตั้งค่า Cloud' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  subTab === t.id
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {allOrganizations.length > 0 && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    'ยืนยันการล้างข้อมูลบริษัทและมิเตอร์ทั้งหมดเพื่อเริ่มต้นใหม่ (Reset Clean)? บัญชี Super Admin จะยังคงอยู่ตามปกติ'
                  )
                ) {
                  clearAllDemoData();
                  notify('success', 'ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว ระบบพร้อมสำหรับการตั้งค่าลูกค้าจริง 100%');
                }
              }}
              className="px-3 py-2 rounded-xl text-[11px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 cursor-pointer"
            >
              🗑️ ล้างข้อมูลทั้งหมด (Reset Clean)
            </button>
          )}
        </div>
      </div>

      {/* Notification Banner */}
      {bannerMsg && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
            bannerMsg.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
            <span>{bannerMsg.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{bannerMsg.text}</span>
          </div>
          <button
            onClick={() => setBannerMsg(null)}
            className="text-xs px-2.5 py-1 rounded-lg bg-slate-900/60 text-slate-300 cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: MANAGE CLIENTS, EDIT INFO, CONFIGURE METERS & REAL STATUS TEST */}
      {/* ===================================================================== */}
      {subTab === 'clients' && (
        <div className="space-y-4">
          {allOrganizations.length === 0 ? (
            <div className="bg-slate-900/90 border-2 border-dashed border-slate-700 rounded-3xl p-8 sm:p-12 text-center max-w-3xl mx-auto my-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-3xl mx-auto mb-4">
                ⚡
              </div>
              <h2 className="text-xl font-black text-white">
                ระบบพร้อมใช้งานจริง 100% (ลบข้อมูล Demo ออกทั้งหมดแล้ว)
              </h2>
              <p className="text-sm text-slate-300 mt-2 max-w-xl mx-auto leading-relaxed">
                ขณะนี้ยังไม่มีบริษัทลูกค้าในระบบ คุณสามารถกดปุ่มด้านล่างเพื่อเพิ่มบริษัทลูกค้าจริง ตั้งค่าพาวเวอร์มิเตอร์ (Modbus Slave ID / รุ่นมิเตอร์ / CT Ratio) และทดสอบการเชื่อมต่ออุปกรณ์จริงได้ทันที
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setSubTab('onboard')}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 cursor-pointer"
                >
                  ➕ เพิ่มบริษัทลูกค้าจริงแห่งแรก
                </button>
                <button
                  onClick={() => setSubTab('hardware-test')}
                  className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-bold text-sm cursor-pointer"
                >
                  🔌 ทดสอบสายสัญญาณมิเตอร์จริง (RS485 / HTTP)
                </button>
                <button
                  onClick={() => setSubTab('guide')}
                  className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm cursor-pointer"
                >
                  📘 ดูคู่มือการต่อสาย & โค้ดส่งข้อมูล
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {allOrganizations.map((org) => {
                const fullComp = TENANT_COMPANIES[org.id] || org;
                const orgAccounts = allAccounts.filter(
                  (a) => a.orgId === org.id && a.role !== 'SUPER_ADMIN'
                );
                const meters = fullComp.electricityMeters || [];
                const testResult = orgTestResults[org.id];
                const isTestingThis = testingOrgId === org.id;

                return (
                  <div
                    key={org.id}
                    className={`rounded-3xl p-5 border transition-all flex flex-col justify-between ${
                      activeOrgId === org.id
                        ? 'bg-slate-900/95 border-cyan-500/60 shadow-xl'
                        : 'bg-slate-900/75 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Card Top Bar */}
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                              {org.code}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              ID: {org.id}
                            </span>
                            {renderConnectionBadge(fullComp.status, fullComp.lastLatencyMs)}
                          </div>
                          <h3 className="text-lg font-black text-white mt-1.5">{org.name}</h3>
                          <p className="text-xs text-slate-400">
                            {fullComp.industry || 'โรงงานอุตสาหกรรม'}{' '}
                            {fullComp.location ? `• 📍 ${fullComp.location}` : ''}
                          </p>
                        </div>

                        <button
                          onClick={() => handleOpenEditOrg(org)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold cursor-pointer shrink-0"
                        >
                          ✏️ แก้ไขข้อมูลลูกค้า & Gateway
                        </button>
                      </div>

                      {/* Hardware & Gateway Spec Box */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3 bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80 text-xs">
                        <div>
                          <div className="text-[10px] text-slate-400">หม้อแปลง (kVA)</div>
                          <div className="font-black text-white mt-0.5">
                            {Number(fullComp.transformerKVA || 1600).toLocaleString()} kVA
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">จำนวนมิเตอร์ไฟฟ้า</div>
                          <div className="font-black text-emerald-400 mt-0.5">
                            ⚡ {meters.length} จุดวัด
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Gateway IP / พอร์ต</div>
                          <div className="font-mono font-bold text-cyan-300 mt-0.5 truncate">
                            {fullComp.gatewayIp || 'ยังไม่ระบุ'}:{fullComp.gatewayPort || '502'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">RS485 Baud / Parity</div>
                          <div className="font-mono font-bold text-slate-200 mt-0.5">
                            {fullComp.baudRate || '9600'} • {fullComp.parity || '8N1'}
                          </div>
                        </div>
                      </div>

                      {/* Gateway Endpoint URL display */}
                      <div className="mb-3 px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
                        <div className="truncate text-slate-300">
                          <span className="text-slate-500 font-bold">Endpoint รับ/ดึงค่าจริง: </span>
                          <span className="font-mono text-cyan-300">
                            {fullComp.gatewayEndpointUrl
                              ? fullComp.gatewayEndpointUrl
                              : supabaseReady
                              ? 'เชื่อมต่อผ่านฐานข้อมูล Supabase Cloud (meter_readings)'
                              : 'ยังไม่ได้ผูก URL อุปกรณ์จริง (กดแก้ไขเพื่อระบุ URL หรือใช้พอร์ต RS485)'}
                          </span>
                        </div>
                        {fullComp.lastTestedAt && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            ทดสอบล่าสุด: {fullComp.lastTestedAt}
                          </span>
                        )}
                      </div>

                      {/* Real-Time Connection Test Result Box */}
                      {testResult && (
                        <div
                          className={`mb-3 p-3 rounded-xl border text-xs ${
                            testResult.success
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                              : 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                          }`}
                        >
                          <div className="font-bold flex items-center justify-between">
                            <span>
                              {testResult.success ? '🟢 ผลทดสอบอุปกรณ์จริง: ออนไลน์' : '🟡 ผลทดสอบอุปกรณ์จริง:'}
                            </span>
                            <span className="text-[10px] opacity-80">{testResult.testedAt}</span>
                          </div>
                          <div className="mt-1 text-[11px]">{testResult.message}</div>
                        </div>
                      )}

                      {/* Quick Preview of Meters inside this Company */}
                      <div className="mb-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-slate-300">
                            รายการพาวเวอร์มิเตอร์ที่ติดตั้ง ({meters.length} ตัว)
                          </span>
                          <button
                            onClick={() => {
                              setManagingMetersOrgId(org.id);
                              setEditingMeterId(null);
                            }}
                            className="text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer"
                          >
                            ⚙️ ตั้งค่ามิเตอร์ / แก้ไขรีจิสเตอร์ / ทดสอบรายตัว →
                          </button>
                        </div>

                        {meters.length === 0 ? (
                          <div className="text-xs text-slate-500 py-2 text-center">
                            ยังไม่มีมิเตอร์ในบริษัทนี้ กดปุ่มตั้งค่ามิเตอร์เพื่อเพิ่มจุดวัด
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {meters.map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl text-xs"
                              >
                                <div className="min-w-0">
                                  <span className="font-mono text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded mr-1.5">
                                    Slave #{m.slaveId || 1}
                                  </span>
                                  <span className="font-bold text-white truncate">{m.name}</span>
                                  <span className="text-[10px] text-slate-400 ml-1.5">
                                    ({m.model || 'PM2200'} • CT {m.ctRatio || '400/5A'})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-mono font-bold text-cyan-300 text-[11px]">
                                    {Number(m.liveKW ?? m.baseKW ?? 0).toLocaleString()} kW
                                  </span>
                                  <button
                                    onClick={() => handleTestSingleMeter(org.id, m)}
                                    disabled={testingMeterId === m.id}
                                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-cyan-300 border border-slate-700 cursor-pointer"
                                  >
                                    {testingMeterId === m.id ? '⏳...' : '📡 ทดสอบ'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Customer Login Credentials Summary */}
                      <div className="mb-4 bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            บัญชีล็อกอินลูกค้า ({orgAccounts.length} บัญชี)
                          </span>
                          <button
                            onClick={() => {
                              setNewAccForm((prev) => ({ ...prev, orgId: org.id }));
                              setSubTab('accounts');
                            }}
                            className="text-[10px] text-amber-400 hover:underline font-bold cursor-pointer"
                          >
                            + แก้ไขรหัสผ่าน / เพิ่มผู้ใช้
                          </button>
                        </div>
                        {orgAccounts.length === 0 ? (
                          <div className="text-[11px] text-slate-500">ยังไม่มีบัญชีเข้าใช้งาน</div>
                        ) : (
                          <div className="space-y-1">
                            {orgAccounts.map((acc) => (
                              <div
                                key={acc.id}
                                className="flex items-center justify-between text-xs bg-slate-900 px-2.5 py-1 rounded-lg"
                              >
                                <span className="text-slate-300 font-medium truncate">
                                  👤 {acc.fullName}
                                </span>
                                <div className="flex items-center gap-2 font-mono text-[11px]">
                                  <span className="text-cyan-300">ID: {acc.username}</span>
                                  <span className="text-amber-300">Pass: {acc.password}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80">
                      <button
                        onClick={() => handleRunGatewayTest(org.id)}
                        disabled={isTestingThis}
                        className="py-2.5 px-3 rounded-xl font-bold text-xs bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        {isTestingThis ? '⏳ กำลังทดสอบ...' : '📡 ทดสอบสถานะจริง'}
                      </button>

                      <button
                        onClick={() => {
                          setManagingMetersOrgId(org.id);
                          setEditingMeterId(null);
                        }}
                        className="py-2.5 px-3 rounded-xl font-bold text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        ⚡ ตั้งค่ามิเตอร์ ({meters.length})
                      </button>

                      <button
                        onClick={() => {
                          switchOrganization(org.id);
                          if (onInspectTenant) onInspectTenant(org.id);
                        }}
                        className="py-2.5 px-3 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        👁️ เปิดดูหน้าลูกค้า
                      </button>

                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `ยืนยันการลบบริษัท "${org.name}" และมิเตอร์ทั้งหมดของบริษัทนี้ออกจากระบบ?`
                            )
                          ) {
                            removeOrganization(org.id);
                            notify('success', `ลบบริษัท ${org.name} ออกจากระบบเรียบร้อยแล้ว`);
                          }
                        }}
                        className="py-2.5 px-3 rounded-xl font-bold text-xs bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        🗑️ ลบบริษัท
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: EDIT CLIENT COMPANY & GATEWAY HARDWARE CONFIGURATION         */}
      {/* ===================================================================== */}
      {editingOrgModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  QUICK ADMIN EDITOR • แก้ไขข้อมูลลูกค้าและการเชื่อมต่ออุปกรณ์จริง
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">
                  ✏️ แก้ไขข้อมูลบริษัทลูกค้า & ตั้งค่า IoT Gateway
                </h3>
              </div>
              <button
                onClick={() => setEditingOrgModal(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                ✕ ปิดหน้าต่าง
              </button>
            </div>

            <form onSubmit={handleSaveOrgEdit} className="space-y-4 mt-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                <h4 className="text-xs font-black text-cyan-400 uppercase mb-3">
                  1. ข้อมูลพื้นฐานของโรงงาน / บริษัทลูกค้า (ข้อมูลที่แก้ไขบ่อย)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      ชื่อบริษัทลูกค้า *
                    </label>
                    <input
                      type="text"
                      required
                      value={orgEditForm.name}
                      onChange={(e) => setOrgEditForm({ ...orgEditForm, name: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      รหัสย่อโรงงาน (Site Code)
                    </label>
                    <input
                      type="text"
                      value={orgEditForm.code}
                      onChange={(e) =>
                        setOrgEditForm({ ...orgEditForm, code: e.target.value.toUpperCase() })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-cyan-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      ขนาดหม้อแปลงไฟฟ้ารวม (kVA)
                    </label>
                    <input
                      type="number"
                      value={orgEditForm.transformerKVA}
                      onChange={(e) =>
                        setOrgEditForm({ ...orgEditForm, transformerKVA: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      ประเภทอุตสาหกรรม
                    </label>
                    <input
                      type="text"
                      value={orgEditForm.industry}
                      onChange={(e) => setOrgEditForm({ ...orgEditForm, industry: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      สถานที่ตั้ง / นิคมอุตสาหกรรม
                    </label>
                    <input
                      type="text"
                      value={orgEditForm.location}
                      onChange={(e) => setOrgEditForm({ ...orgEditForm, location: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                <h4 className="text-xs font-black text-emerald-400 uppercase mb-3">
                  2. ตั้งค่าการเชื่อมต่ออุปกรณ์จริง (IoT Gateway / RS485 / HTTP Endpoint)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      รุ่นอุปกรณ์ Gateway ที่ติดตั้ง
                    </label>
                    <select
                      value={orgEditForm.gatewayModel}
                      onChange={(e) =>
                        setOrgEditForm({ ...orgEditForm, gatewayModel: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                    >
                      <option value="Waveshare RS485 to Ethernet PoE">
                        Waveshare RS485 to Ethernet (Modbus TCP/HTTP)
                      </option>
                      <option value="ESP32 Industrial RS485 Gateway (WiFi/4G)">
                        ESP32 Industrial RS485 Gateway (WiFi / SIM 4G)
                      </option>
                      <option value="USR-TCP232-410S / USR-DR302">
                        USR-TCP232-410S / USR-DR302 (Modbus Gateway)
                      </option>
                      <option value="Teltonika TRB145 / RUT956 4G RS485">
                        Teltonika TRB145 / RUT956 Industrial 4G RS485
                      </option>
                      <option value="Advantech ADAM / Node-RED Edge PC">
                        Advantech ADAM / Edge Mini-PC (Node-RED / Python)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Gateway Serial No.
                    </label>
                    <input
                      type="text"
                      value={orgEditForm.gatewaySerial}
                      onChange={(e) =>
                        setOrgEditForm({ ...orgEditForm, gatewaySerial: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      IP Address ของ Gateway
                    </label>
                    <input
                      type="text"
                      value={orgEditForm.gatewayIp}
                      onChange={(e) =>
                        setOrgEditForm({ ...orgEditForm, gatewayIp: e.target.value })
                      }
                      placeholder="เช่น 192.168.1.200"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-cyan-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Modbus TCP Port
                    </label>
                    <input
                      type="text"
                      value={orgEditForm.gatewayPort}
                      onChange={(e) =>
                        setOrgEditForm({ ...orgEditForm, gatewayPort: e.target.value })
                      }
                      placeholder="502"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      RS485 Baud Rate & Parity
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        value={orgEditForm.baudRate}
                        onChange={(e) =>
                          setOrgEditForm({ ...orgEditForm, baudRate: e.target.value })
                        }
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2.5 text-xs text-white font-mono"
                      >
                        <option value="9600">9600</option>
                        <option value="19200">19200</option>
                        <option value="38400">38400</option>
                        <option value="115200">115200</option>
                      </select>
                      <select
                        value={orgEditForm.parity}
                        onChange={(e) =>
                          setOrgEditForm({ ...orgEditForm, parity: e.target.value })
                        }
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2.5 text-xs text-white font-mono"
                      >
                        <option value="None (8N1)">8N1</option>
                        <option value="Even (8E1)">8E1</option>
                        <option value="Odd (8O1)">8O1</option>
                      </select>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Gateway HTTP / REST Endpoint URL (สำหรับปุ่มกดทดสอบสถานะจริง & ดึงค่าสด)
                    </label>
                    <input
                      type="text"
                      value={orgEditForm.gatewayEndpointUrl}
                      onChange={(e) =>
                        setOrgEditForm({ ...orgEditForm, gatewayEndpointUrl: e.target.value })
                      }
                      placeholder="เช่น https://your-edge-gateway.ngrok.app/api/meters หรือเว้นว่างหากส่งเข้า Supabase"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-emerald-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      API Token / Key (ถ้ามี)
                    </label>
                    <input
                      type="text"
                      value={orgEditForm.gatewayApiKey}
                      onChange={(e) =>
                        setOrgEditForm({ ...orgEditForm, gatewayApiKey: e.target.value })
                      }
                      placeholder="Optional Bearer Key"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOrgModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-black shadow-lg cursor-pointer"
                >
                  💾 บันทึกการแก้ไขข้อมูลลูกค้า & Gateway
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: FULL METER CONFIGURATION, REGISTER EDITOR & REAL METER TEST  */}
      {/* ===================================================================== */}
      {managingMetersOrgId && managingOrgCompany && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  HARDWARE METER & MODBUS REGISTER CONFIGURATION
                </span>
                <h3 className="text-lg font-black text-white">
                  ⚡ ตั้งค่าพาวเวอร์มิเตอร์และทดสอบสถานะรายตัว — {managingOrgCompany.name}
                </h3>
              </div>
              <button
                onClick={() => {
                  setManagingMetersOrgId(null);
                  setEditingMeterId(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                ✕ ปิดหน้าต่าง
              </button>
            </div>

            {/* Existing Meters List with Edit & Real Status Test Buttons */}
            <div className="mt-4 space-y-3">
              <div className="text-xs font-bold text-slate-300">
                มิเตอร์ไฟฟ้าที่ติดตั้งแล้ว ({(managingOrgCompany.electricityMeters || []).length} จุดวัด)
              </div>

              {(managingOrgCompany.electricityMeters || []).length === 0 ? (
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
                  ยังไม่มีพาวเวอร์มิเตอร์ในบริษัทนี้ กรุณาเพิ่มมิเตอร์ใหม่จากฟอร์มด้านล่าง
                </div>
              ) : (
                (managingOrgCompany.electricityMeters || []).map((m) => {
                  const isEditingThisMeter = editingMeterId === m.id;
                  const mTest = meterTestResults[m.id];

                  return (
                    <div
                      key={m.id}
                      className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-xs font-black">
                              Slave ID #{m.slaveId || 1}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono text-xs font-bold">
                              {m.tag}
                            </span>
                            <span className="text-sm font-black text-white">{m.name}</span>
                            {renderConnectionBadge(m.connectionStatus, m.lastLatencyMs)}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 font-mono">
                            ตู้: {m.panel} • รุ่น: <strong className="text-slate-200">{m.model}</strong> • CT:{' '}
                            <strong className="text-slate-200">{m.ctRatio || '400/5A'}</strong> • Reg kW:{' '}
                            <strong className="text-cyan-300">{m.regActivePowerKW || 3060}</strong> • Reg kWh:{' '}
                            <strong className="text-cyan-300">{m.regEnergyKWh || 3204}</strong> • ค่าปัจจุบัน:{' '}
                            <strong className="text-emerald-400">
                              {Number(m.liveKW ?? m.baseKW ?? 0).toLocaleString()} kW
                            </strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestSingleMeter(managingMetersOrgId, m)}
                            disabled={testingMeterId === m.id}
                            className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold cursor-pointer"
                          >
                            {testingMeterId === m.id ? '⏳ กำลังเช็ค...' : '📡 ทดสอบสถานะจริง'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              isEditingThisMeter ? setEditingMeterId(null) : handleStartEditMeter(m)
                            }
                            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold cursor-pointer"
                          >
                            {isEditingThisMeter ? 'ยกเลิกแก้ไข' : '✏️ แก้ไขตั้งค่า'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`ยืนยันการลบมิเตอร์ "${m.name}" ?`)) {
                                removeMeterFromOrganization(managingMetersOrgId, m.id);
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer"
                          >
                            🗑️ ลบ
                          </button>
                        </div>
                      </div>

                      {/* Real Test Result for this Meter */}
                      {mTest && (
                        <div
                          className={`p-2.5 rounded-xl border text-xs ${
                            mTest.success
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                          }`}
                        >
                          {mTest.message}
                        </div>
                      )}

                      {/* Inline Edit Form for this Meter */}
                      {isEditingThisMeter && (
                        <form
                          onSubmit={handleSaveMeterEdit}
                          className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-2.5"
                        >
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-slate-400 mb-1">
                              ชื่อจุดวัด / เครื่องจักร
                            </label>
                            <input
                              type="text"
                              required
                              value={meterEditForm.name}
                              onChange={(e) =>
                                setMeterEditForm({ ...meterEditForm, name: e.target.value })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              รหัส Tag มิเตอร์
                            </label>
                            <input
                              type="text"
                              value={meterEditForm.tag}
                              onChange={(e) =>
                                setMeterEditForm({ ...meterEditForm, tag: e.target.value })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              ตู้ไฟ (Panel)
                            </label>
                            <input
                              type="text"
                              value={meterEditForm.panel}
                              onChange={(e) =>
                                setMeterEditForm({ ...meterEditForm, panel: e.target.value })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-amber-300 font-bold mb-1">
                              Modbus Slave ID (1-247)
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="247"
                              value={meterEditForm.slaveId}
                              onChange={(e) =>
                                setMeterEditForm({ ...meterEditForm, slaveId: e.target.value })
                              }
                              className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              รุ่นมิเตอร์ (เลือกเพื่อเติม Register อัตโนมัติ)
                            </label>
                            <select
                              value={meterEditForm.model}
                              onChange={(e) => applyModelPreset(e.target.value, true)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white"
                            >
                              {Object.keys(METER_MODEL_PRESETS).map((k) => (
                                <option key={k} value={k}>
                                  {k}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              อัตราส่วน CT (CT Ratio)
                            </label>
                            <input
                              type="text"
                              value={meterEditForm.ctRatio}
                              onChange={(e) =>
                                setMeterEditForm({ ...meterEditForm, ctRatio: e.target.value })
                              }
                              placeholder="เช่น 400/5A"
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-emerald-300 font-bold mb-1">
                              ค่ากำลังไฟฟ้าปัจจุบัน (kW)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={meterEditForm.liveKW}
                              onChange={(e) =>
                                setMeterEditForm({ ...meterEditForm, liveKW: e.target.value })
                              }
                              className="w-full bg-slate-900 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono font-bold"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              Register: Active Power (kW)
                            </label>
                            <input
                              type="number"
                              value={meterEditForm.regActivePowerKW}
                              onChange={(e) =>
                                setMeterEditForm({
                                  ...meterEditForm,
                                  regActivePowerKW: e.target.value
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-cyan-300 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              Register: Total Energy (kWh)
                            </label>
                            <input
                              type="number"
                              value={meterEditForm.regEnergyKWh}
                              onChange={(e) =>
                                setMeterEditForm({ ...meterEditForm, regEnergyKWh: e.target.value })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-cyan-300 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              Register: Voltage L-L (V)
                            </label>
                            <input
                              type="number"
                              value={meterEditForm.regVoltageLL}
                              onChange={(e) =>
                                setMeterEditForm({ ...meterEditForm, regVoltageLL: e.target.value })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-cyan-300 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">
                              Register: Current Avg (A)
                            </label>
                            <input
                              type="number"
                              value={meterEditForm.regCurrentAvg}
                              onChange={(e) =>
                                setMeterEditForm({
                                  ...meterEditForm,
                                  regCurrentAvg: e.target.value
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-cyan-300 font-mono"
                            />
                          </div>

                          <div className="sm:col-span-4 flex justify-end gap-2 pt-2">
                            <button
                              type="submit"
                              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer"
                            >
                              💾 บันทึกการตั้งค่ามิเตอร์ตัวนี้
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Add New Meter to this Client Form */}
            <form
              onSubmit={handleAddMeterSubmit}
              className="mt-5 bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 space-y-3"
            >
              <div className="text-xs font-black text-emerald-400 uppercase">
                ➕ เพิ่มพาวเวอร์มิเตอร์จุดวัดใหม่เข้าสู่บริษัทนี้
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] text-slate-400 mb-1">
                    ชื่อจุดวัด / เครื่องจักร *
                  </label>
                  <input
                    type="text"
                    required
                    value={newMeterForm.name}
                    onChange={(e) => setNewMeterForm({ ...newMeterForm, name: e.target.value })}
                    placeholder="เช่น Main Incoming MDB #1 หรือ Chiller #1"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-amber-300 font-bold mb-1">
                    Modbus Slave ID *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="247"
                    value={newMeterForm.slaveId}
                    onChange={(e) => setNewMeterForm({ ...newMeterForm, slaveId: e.target.value })}
                    className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">รหัส Tag / ตู้ไฟ</label>
                  <input
                    type="text"
                    value={newMeterForm.tag}
                    onChange={(e) => setNewMeterForm({ ...newMeterForm, tag: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">รุ่นพาวเวอร์มิเตอร์</label>
                  <select
                    value={newMeterForm.model}
                    onChange={(e) => applyModelPreset(e.target.value, false)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white"
                  >
                    {Object.keys(METER_MODEL_PRESETS).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">CT Ratio</label>
                  <input
                    type="text"
                    value={newMeterForm.ctRatio}
                    onChange={(e) => setNewMeterForm({ ...newMeterForm, ctRatio: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Reg Active Power (kW)</label>
                  <input
                    type="number"
                    value={newMeterForm.regActivePowerKW}
                    onChange={(e) =>
                      setNewMeterForm({ ...newMeterForm, regActivePowerKW: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    ค่ากำลังไฟฟ้าตั้งต้น (kW)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newMeterForm.liveKW}
                    onChange={(e) => setNewMeterForm({ ...newMeterForm, liveKW: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer"
                >
                  + เพิ่มพาวเวอร์มิเตอร์ตัวนี้
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ONBOARD NEW CLIENT COMPANY + HARDWARE + METERS                 */}
      {/* ===================================================================== */}
      {subTab === 'onboard' && (
        <form onSubmit={handleOnboardSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs">
                1
              </span>
              ข้อมูลบริษัทลูกค้า & การตั้งค่าอุปกรณ์ IoT Gateway จริง
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ชื่อบริษัทลูกค้า (Company Name) *
                </label>
                <input
                  type="text"
                  required
                  value={onboardForm.companyName}
                  onChange={(e) => setOnboardForm({ ...onboardForm, companyName: e.target.value })}
                  placeholder="เช่น บริษัท ไทยพรีซิชั่น แมนูแฟคเจอริ่ง จำกัด"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  รหัสย่อโรงงาน (Site Code) *
                </label>
                <input
                  type="text"
                  required
                  value={onboardForm.companyCode}
                  onChange={(e) =>
                    setOnboardForm({ ...onboardForm, companyCode: e.target.value.toUpperCase() })
                  }
                  placeholder="เช่น TPM01"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-cyan-300 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ขนาดหม้อแปลง (kVA)
                </label>
                <input
                  type="number"
                  value={onboardForm.transformerKVA}
                  onChange={(e) =>
                    setOnboardForm({ ...onboardForm, transformerKVA: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  รุ่นอุปกรณ์ Gateway
                </label>
                <select
                  value={onboardForm.gatewayModel}
                  onChange={(e) => setOnboardForm({ ...onboardForm, gatewayModel: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                >
                  <option value="Waveshare RS485 to Ethernet PoE">
                    Waveshare RS485 to Ethernet PoE
                  </option>
                  <option value="ESP32 Industrial RS485 Gateway (WiFi/4G)">
                    ESP32 Industrial RS485 Gateway
                  </option>
                  <option value="USR-TCP232-410S / USR-DR302">USR-TCP232-410S / USR-DR302</option>
                  <option value="Teltonika TRB145 4G RS485">Teltonika TRB145 4G RS485</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  IP Address : Port ของ Gateway
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={onboardForm.gatewayIp}
                    onChange={(e) => setOnboardForm({ ...onboardForm, gatewayIp: e.target.value })}
                    placeholder="192.168.1.200"
                    className="w-2/3 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-cyan-300 font-mono"
                  />
                  <input
                    type="text"
                    value={onboardForm.gatewayPort}
                    onChange={(e) =>
                      setOnboardForm({ ...onboardForm, gatewayPort: e.target.value })
                    }
                    placeholder="502"
                    className="w-1/3 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Gateway HTTP Endpoint URL (หากต้องการดึงค่าจริงผ่าน HTTP API โดยตรง)
                </label>
                <input
                  type="text"
                  value={onboardForm.gatewayEndpointUrl}
                  onChange={(e) =>
                    setOnboardForm({ ...onboardForm, gatewayEndpointUrl: e.target.value })
                  }
                  placeholder="เช่น https://gateway-site01.yourdomain.com/api/readings (เว้นว่างได้หากส่งเข้า Supabase)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs text-emerald-300 font-mono"
                />
              </div>
            </div>

            {/* Meters List Builder */}
            <div className="pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-black text-white">
                  ⚡ รายการพาวเวอร์มิเตอร์ที่ติดตั้งในโรงงานนี้ ({newClientMeters.length} ตัว)
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = newClientMeters.length + 1;
                    setNewClientMeters([
                      ...newClientMeters,
                      {
                        name: `Power Meter #${nextIdx}`,
                        panel: `Sub-Panel #${nextIdx}`,
                        tag: `MDB-0${nextIdx}`,
                        slaveId: nextIdx,
                        model: 'Schneider PM2200',
                        ctRatio: '400/5A',
                        regActivePowerKW: 3060,
                        regEnergyKWh: 3204,
                        regVoltageLL: 3020,
                        regCurrentAvg: 3000,
                        baseKW: 0
                      }
                    ]);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold cursor-pointer"
                >
                  + เพิ่มจุดวัดมิเตอร์
                </button>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {newClientMeters.map((m, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 bg-slate-950/90 border border-slate-800 p-2.5 rounded-xl items-center text-xs"
                  >
                    <div className="col-span-4">
                      <label className="block text-[10px] text-slate-500">ชื่อจุดวัด</label>
                      <input
                        type="text"
                        value={m.name}
                        onChange={(e) => {
                          const updated = [...newClientMeters];
                          updated[idx].name = e.target.value;
                          setNewClientMeters(updated);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-amber-300">Slave ID</label>
                      <input
                        type="number"
                        value={m.slaveId}
                        onChange={(e) => {
                          const updated = [...newClientMeters];
                          updated[idx].slaveId = Number(e.target.value);
                          setNewClientMeters(updated);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-amber-300 font-mono font-bold"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[10px] text-slate-500">รุ่นมิเตอร์</label>
                      <select
                        value={m.model}
                        onChange={(e) => {
                          const updated = [...newClientMeters];
                          const preset =
                            METER_MODEL_PRESETS[e.target.value] ||
                            METER_MODEL_PRESETS['Schneider PM2200'];
                          updated[idx].model = e.target.value;
                          updated[idx].regActivePowerKW = preset.regActivePowerKW;
                          updated[idx].regEnergyKWh = preset.regEnergyKWh;
                          setNewClientMeters(updated);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                      >
                        {Object.keys(METER_MODEL_PRESETS).map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-slate-500">CT Ratio</label>
                      <input
                        type="text"
                        value={m.ctRatio}
                        onChange={(e) => {
                          const updated = [...newClientMeters];
                          updated[idx].ctRatio = e.target.value;
                          setNewClientMeters(updated);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-cyan-300 font-mono"
                      />
                    </div>
                    <div className="col-span-1 text-right pt-3">
                      {newClientMeters.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setNewClientMeters(newClientMeters.filter((_, i) => i !== idx))
                          }
                          className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-900/90 border border-amber-500/30 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs">
                  2
                </span>
                กำหนดบัญชี Login และรหัสผ่านให้ลูกค้า
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ชื่อผู้ดูแลฝั่งลูกค้า (Contact Person)
                </label>
                <input
                  type="text"
                  value={onboardForm.contactName}
                  onChange={(e) => setOnboardForm({ ...onboardForm, contactName: e.target.value })}
                  placeholder="เช่น คุณสมชาย (ผู้จัดการฝ่ายวิศวกรรม)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1">
                  ชื่อผู้ใช้งานสำหรับล็อกอิน (Login Username) *
                </label>
                <input
                  type="text"
                  required
                  value={onboardForm.username}
                  onChange={(e) => setOnboardForm({ ...onboardForm, username: e.target.value })}
                  placeholder="เช่น tpm_admin"
                  className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-4 py-2.5 text-sm text-amber-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-300 mb-1">
                  รหัสผ่านสำหรับล็อกอิน (Password) *
                </label>
                <input
                  type="text"
                  required
                  value={onboardForm.password}
                  onChange={(e) => setOnboardForm({ ...onboardForm, password: e.target.value })}
                  placeholder="เช่น tpm2026"
                  className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-4 py-2.5 text-sm text-emerald-300 font-mono font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl font-black text-sm text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 shadow-xl shadow-amber-500/20 cursor-pointer"
            >
              🚀 บันทึกบริษัทลูกค้าจริง & เปิดใช้งานระบบทันที
            </button>
          </div>
        </form>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: DIRECT HARDWARE CONNECTION & LIVE RS485 / HTTP DIAGNOSTICS      */}
      {/* ===================================================================== */}
      {subTab === 'hardware-test' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Mode A: Direct USB-to-RS485 Web Serial Modbus RTU Hardware Tester */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-cyan-500/30 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  MODE A • DIRECT RS485 HARDWARE DIAGNOSTICS (WEB SERIAL API)
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">
                  🔌 เชื่อมต่อและอ่านค่ามิเตอร์จริงผ่านสาย USB-to-RS485 (Modbus RTU)
                </h3>
              </div>
              <span className="text-[11px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-2.5 py-1 rounded-lg">
                CRC-16 Auto Calculated
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              เสียบสายแปลง <strong>USB-to-RS485</strong> เข้ากับคอมพิวเตอร์ (ต่อสาย A/D+ และ B/D- เข้าที่ตัวพาวเวอร์มิเตอร์จริง) แล้วกดปุ่มด้านล่างเพื่อยิงคำสั่ง <strong>Modbus RTU จริง</strong> และอ่านค่ากลับมาแสดงผลสดๆ
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
              <div>
                <label className="block text-[10px] text-slate-400 font-bold mb-1">
                  Baud Rate
                </label>
                <select
                  value={serialConfig.baudRate}
                  onChange={(e) =>
                    setSerialConfig({ ...serialConfig, baudRate: Number(e.target.value) })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                >
                  <option value={9600}>9600 bps</option>
                  <option value={19200}>19200 bps</option>
                  <option value={38400}>38400 bps</option>
                  <option value={115200}>115200 bps</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-bold mb-1">Parity</label>
                <select
                  value={serialConfig.parity}
                  onChange={(e) => setSerialConfig({ ...serialConfig, parity: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                >
                  <option value="none">None (8N1)</option>
                  <option value="even">Even (8E1)</option>
                  <option value="odd">Odd (8O1)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-amber-300 font-bold mb-1">
                  Modbus Slave ID
                </label>
                <input
                  type="number"
                  min="1"
                  max="247"
                  value={serialConfig.slaveId}
                  onChange={(e) =>
                    setSerialConfig({ ...serialConfig, slaveId: Number(e.target.value) })
                  }
                  className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-bold mb-1">
                  Function Code
                </label>
                <select
                  value={serialConfig.funcCode}
                  onChange={(e) =>
                    setSerialConfig({ ...serialConfig, funcCode: Number(e.target.value) })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                >
                  <option value={3}>03 - Holding Registers</option>
                  <option value={4}>04 - Input Registers</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-cyan-300 font-bold mb-1">
                  Register Address (เช่น 3060)
                </label>
                <input
                  type="number"
                  value={serialConfig.regAddress}
                  onChange={(e) =>
                    setSerialConfig({ ...serialConfig, regAddress: Number(e.target.value) })
                  }
                  className="w-full bg-slate-900 border border-cyan-500/40 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-bold mb-1">
                  ชนิดข้อมูล (Data Type)
                </label>
                <select
                  value={serialConfig.dataType}
                  onChange={(e) => setSerialConfig({ ...serialConfig, dataType: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                >
                  <option value="float32">Float32 (2 Registers)</option>
                  <option value="uint16">UInt16 (1 Register)</option>
                </select>
              </div>
            </div>

            {/* Optional: Link read value directly to a client meter */}
            {allOrganizations.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    บันทึกค่าที่อ่านได้ลงในบริษัทลูกค้า (ตัวเลือกเสริม)
                  </label>
                  <select
                    value={serialConfig.targetOrgId}
                    onChange={(e) =>
                      setSerialConfig({
                        ...serialConfig,
                        targetOrgId: e.target.value,
                        targetMeterId: ''
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="">-- ไม่บันทึก (ทดสอบอ่านค่าอย่างเดียว) --</option>
                    {allOrganizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    เลือกมิเตอร์ที่จะรับค่าจริง
                  </label>
                  <select
                    value={serialConfig.targetMeterId}
                    onChange={(e) =>
                      setSerialConfig({ ...serialConfig, targetMeterId: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="">-- เลือกมิเตอร์ --</option>
                    {(TENANT_COMPANIES[serialConfig.targetOrgId]?.electricityMeters || []).map(
                      (m) => (
                        <option key={m.id} value={m.id}>
                          Slave #{m.slaveId} - {m.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleWebSerialModbusTest}
              disabled={isSerialBusy}
              className="w-full py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              {isSerialBusy
                ? '⏳ กำลังสื่อสารกับพาวเวอร์มิเตอร์ผ่านพอร์ต RS485...'
                : '🔌 เปิดพอร์ต USB-to-RS485 & ยิงคำสั่งอ่านค่ามิเตอร์จริงทันที'}
            </button>

            {/* Live Modbus RTU Frame Console */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase">
                  Modbus RTU Serial Diagnostic Log (TX / RX Hex Frame)
                </span>
                <button
                  type="button"
                  onClick={() => setSerialLog([])}
                  className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                >
                  ล้างหน้าจอ Log
                </button>
              </div>
              <div className="space-y-1.5 font-mono text-xs max-h-48 overflow-y-auto">
                {serialLog.length === 0 ? (
                  <div className="text-slate-500 py-4 text-center">
                    พร้อมทดสอบการเชื่อมต่อ... กดปุ่มด้านบนเพื่อเลือกพอร์ต COM และส่งคำสั่ง Modbus RTU
                  </div>
                ) : (
                  serialLog.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border ${
                        item.type === 'RX' || item.type === 'SUCCESS'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : item.type === 'TX'
                          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                          : item.type === 'ERROR'
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="text-[10px] opacity-70 mr-2">[{item.time}]</span>
                      <strong className="mr-1.5">[{item.type}]</strong>
                      <span>{item.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Mode B: HTTP Endpoint / Webhook / Cloud Live Tester */}
          <div className="lg:col-span-5 bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                MODE B • GATEWAY HTTP REST API / CLOUD PING TESTER
              </span>
              <h3 className="text-lg font-black text-white mt-0.5">
                📡 ทดสอบดึงแพ็กเกจข้อมูลจริงผ่าน HTTP / Cloud Endpoint
              </h3>
            </div>

            <form onSubmit={handleDirectHttpTest} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  URL ของ Gateway หรือ REST API ที่ต้องการทดสอบ *
                </label>
                <input
                  type="url"
                  required
                  value={httpTestUrl}
                  onChange={(e) => setHttpTestUrl(e.target.value)}
                  placeholder="เช่น https://your-gateway-endpoint.com/api/meters"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-emerald-300 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Bearer Token / API Key (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={httpTestToken}
                  onChange={(e) => setHttpTestToken(e.target.value)}
                  placeholder="Optional Authorization Token"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={isHttpTesting}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer"
              >
                {isHttpTesting ? '⏳ กำลังทดสอบเชื่อมต่อ...' : '📡 ยิงสัญญาณทดสอบ HTTP Endpoint จริง'}
              </button>
            </form>

            {httpTestResult && (
              <div
                className={`p-4 rounded-2xl border text-xs font-mono space-y-2 ${
                  httpTestResult.ok
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>
                    Status: {httpTestResult.status} ({httpTestResult.ok ? 'ONLINE' : 'FAILED'})
                  </span>
                  <span>Latency: {httpTestResult.latencyMs} ms</span>
                </div>
                <pre className="bg-slate-950/90 p-3 rounded-xl overflow-x-auto text-[11px] text-slate-200 max-h-48">
                  {httpTestResult.body}
                </pre>
              </div>
            )}

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
              <div className="font-bold text-amber-300">
                💡 รูปแบบ JSON มาตรฐานที่ Gateway ส่งกลับมาได้ทันที:
              </div>
              <pre className="bg-slate-900 p-2.5 rounded-xl text-[11px] font-mono text-cyan-300 overflow-x-auto">
{`{
  "slave_id": 1,
  "active_power_kw": 245.8,
  "voltage": 401.2,
  "current": 368.5,
  "kwh": 4120.5
}`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: STEP-BY-STEP HARDWARE CONNECTION GUIDE & AUTO CODE GENERATOR   */}
      {/* ===================================================================== */}
      {subTab === 'guide' && (
        <div className="space-y-6">
          {/* Step-by-step Hardware Wiring & Setup Guide */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  SUPER ADMIN HARDWARE INTEGRATION PLAYBOOK
                </span>
                <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                  📘 วิธีการเชื่อมต่ออุปกรณ์พาวเวอร์มิเตอร์จริงให้เสถียรและเกิดประโยชน์สูงสุด
                </h2>
              </div>
              {allOrganizations.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">สร้างโค้ดสำหรับบริษัท:</span>
                  <select
                    value={guideOrgId}
                    onChange={(e) => setGuideOrgId(e.target.value)}
                    className="bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold"
                  >
                    {allOrganizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 4 Core Steps for Field Engineers / Super Admin */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-black text-cyan-400">
                  ขั้นตอนที่ 1: การเดินสาย RS485 (Daisy-Chain)
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                  <li>
                    • ใช้สายคู่บิดเกลียวมีชีลด์ <strong>Belden 9841 (24 AWG)</strong>
                  </li>
                  <li>
                    • พ่วงขั้ว <strong>A (D+) เข้า A (D+)</strong> และ <strong>B (D-) เข้า B (D-)</strong> เรียงจากมิเตอร์ตัวที่ 1 ไปจนถึงตัวสุดท้าย (ห้ามต่อแบบดาว Star)
                  </li>
                  <li>
                    • ติดตั้งตัวต้านทาน <strong>120 Ω (1/2W)</strong> คร่อม A-B ที่ต้นสาย (Gateway) และปลายสาย (มิเตอร์ตัวสุดท้าย)
                  </li>
                  <li>• ต่อสาย Shield ลงกราวด์ตู้ MDB เพียงฝั่งเดียว (ป้องกัน Ground Loop)</li>
                </ul>
              </div>

              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-black text-amber-400">
                  ขั้นตอนที่ 2: ตั้งค่าหน้าจอมิเตอร์ไม่ให้ชนกัน
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                  <li>
                    • <strong>Slave ID:</strong> ตั้งเรียงกันชัดเจน เช่น ตู้เมน = <code>1</code>, Chiller = <code>2</code>, Compressor = <code>3</code> (ห้ามซ้ำกันในสายเส้นเดียวเด็ดขาด)
                  </li>
                  <li>
                    • <strong>Baud Rate & Parity:</strong> มิเตอร์ทุกตัวในวงเดียวกันต้องตั้งค่าตรงกันทั้งหมด แนะนำมาตรฐานโรงงาน <code>9600 bps, 8N1</code>
                  </li>
                  <li>
                    • <strong>CT Ratio:</strong> ตั้งค่า Primary/Secondary ในมิเตอร์ให้ตรงกับขนาดคล้อง CT จริง (เช่น <code>1600/5A</code> หรือ <code>400/5A</code>)
                  </li>
                </ul>
              </div>

              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-black text-emerald-400">
                  ขั้นตอนที่ 3: ทดสอบสัญญาณก่อนส่งมอบลูกค้า
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                  <li>
                    • ใช้แท็บ <strong>"🔌 3. เชื่อมต่ออุปกรณ์จริง"</strong> เสียบสาย USB-to-RS485 ยิงอ่านค่าจริงทีละ Slave ID
                  </li>
                  <li>
                    • เทียบค่า <strong>kW, Voltage (400V), Current (A)</strong> ที่อ่านได้ในระบบว่าตรงกับหน้าจอมิเตอร์จริง 100%
                  </li>
                  <li>
                    • กดปุ่ม <strong>"📡 ทดสอบสถานะจริง"</strong> ในการ์ดบริษัทลูกค้าเพื่อให้ขึ้นสถานะ <code>ONLINE</code>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-black text-purple-400">
                  ขั้นตอนที่ 4: การนำข้อมูลไปใช้ปรับแผนการผลิต
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                  <li>
                    • ตั้งความถี่การส่งข้อมูล (Polling Interval) ทุกๆ <strong>5–60 วินาที</strong> สำหรับดู Load ปัจจุบัน และบันทึกทุก <strong>15 นาที</strong> ลงฐานข้อมูล
                  </li>
                  <li>
                    • ลูกค้าสามารถล็อกอินเข้ามาดูเมนู <strong>"3. รายงาน & ปรับแผนการผลิต"</strong> กดปุ่ม <strong>GO</strong> เพื่อแคปหน้าจอแนวนอนรายงานผู้บริหารได้ทันที
                  </li>
                </ul>
              </div>
            </div>

            {/* Standard Industrial Meter Modbus Register Cheat-Sheet Table */}
            <div className="pt-3">
              <h3 className="text-sm font-black text-white mb-2.5">
                📋 ตารางเปรียบเทียบ Modbus Register มาตรฐานของพาวเวอร์มิเตอร์ยอดนิยม
              </h3>
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-300 border-b border-slate-800">
                      <th className="py-2.5 px-3">รุ่นพาวเวอร์มิเตอร์</th>
                      <th className="py-2.5 px-3">Function Code</th>
                      <th className="py-2.5 px-3">Data Format</th>
                      <th className="py-2.5 px-3 text-cyan-300">Active Power (kW)</th>
                      <th className="py-2.5 px-3 text-emerald-300">Total Energy (kWh)</th>
                      <th className="py-2.5 px-3">Voltage L-L (V)</th>
                      <th className="py-2.5 px-3">Current Avg (A)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 font-mono">
                    {Object.values(METER_MODEL_PRESETS).map((p) => (
                      <tr key={p.model} className="bg-slate-900/60 hover:bg-slate-800/50">
                        <td className="py-2 px-3 font-sans font-bold text-white">{p.model}</td>
                        <td className="py-2 px-3 text-slate-300">{p.functionCode}</td>
                        <td className="py-2 px-3 text-amber-300">{p.dataType}</td>
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

            {/* Auto-Generated Ready-to-Flash Code for Selected Customer */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-cyan-400">
                    💻 โค้ด Python (Edge Gateway / Raspberry Pi / Mini PC) ส่งค่าจริงเข้าเว็บ
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const codeEl = document.getElementById('python-edge-code');
                      if (codeEl) {
                        navigator.clipboard.writeText(codeEl.innerText);
                        notify('success', 'คัดลอกโค้ด Python สำหรับส่งค่าจริงเรียบร้อยแล้ว!');
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-[11px] font-bold cursor-pointer"
                  >
                    📋 คัดลอกโค้ด
                  </button>
                </div>
                <pre
                  id="python-edge-code"
                  className="text-[11px] font-mono text-slate-200 bg-slate-900 p-3 rounded-xl overflow-x-auto max-h-60"
                >
{`# Python Modbus RTU to PowerView Cloud (${selectedGuideCompany?.name || 'Customer Site'})
from pymodbus.client import ModbusSerialClient
import requests, struct, time

ORG_ID = "${selectedGuideCompany?.id || 'ORG-SITE01'}"
SUPABASE_URL = "${sbUrl || 'https://YOUR_PROJECT.supabase.co'}"
SUPABASE_KEY = "${sbAnonKey ? sbAnonKey.slice(0, 18) + '...' : 'YOUR_SUPABASE_SERVICE_OR_ANON_KEY'}"

METERS = [
${
  (selectedGuideCompany?.electricityMeters || []).length > 0
    ? selectedGuideCompany.electricityMeters
        .map(
          (m) =>
            `    {"meter_id": "${m.id}", "slave": ${m.slaveId || 1}, "reg_kw": ${
              m.regActivePowerKW || 3060
            }, "name": "${m.name}"}`
        )
        .join(',\n')
    : '    {"meter_id": "SITE01-E01", "slave": 1, "reg_kw": 3060, "name": "Main MDB #1"}'
}
]

client = ModbusSerialClient(port="COM3", baudrate=${selectedGuideCompany?.baudRate || 9600}, parity="N", stopbits=1, bytesize=8)
client.connect()

def read_float32(slave_id, reg):
    rr = client.read_holding_registers(address=reg, count=2, slave=slave_id)
    if rr.isError(): return None
    raw = struct.pack(">HH", rr.registers[0], rr.registers[1])
    return round(struct.unpack(">f", raw)[0], 2)

while True:
    for m in METERS:
        kw = read_float32(m["slave"], m["reg_kw"])
        if kw is not None:
            requests.post(
                f"{SUPABASE_URL}/rest/v1/meter_readings",
                headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"},
                json={"org_id": ORG_ID, "meter_id": m["meter_id"], "slave_id": m["slave"], "active_power_kw": kw, "reading_value": kw}
            )
    time.sleep(${selectedGuideCompany?.pollingIntervalSec || 5})`}
                </pre>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-400">
                    🔌 โค้ด ESP32 RS485 Gateway (Arduino C++) ส่งค่าขึ้น Cloud อัตโนมัติ
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const codeEl = document.getElementById('esp32-edge-code');
                      if (codeEl) {
                        navigator.clipboard.writeText(codeEl.innerText);
                        notify('success', 'คัดลอกโค้ด ESP32 (Arduino C++) เรียบร้อยแล้ว!');
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-[11px] font-bold cursor-pointer"
                  >
                    📋 คัดลอกโค้ด
                  </button>
                </div>
                <pre
                  id="esp32-edge-code"
                  className="text-[11px] font-mono text-slate-200 bg-slate-900 p-3 rounded-xl overflow-x-auto max-h-60"
                >
{`// ESP32 + MAX485 Modbus RTU to PowerView Cloud (${selectedGuideCompany?.code || 'SITE01'})
#include <WiFi.h>
#include <HTTPClient.h>
#include <ModbusMaster.h>

#define RXD2 16
#define TXD2 17
ModbusMaster node;

const char* ORG_ID = "${selectedGuideCompany?.id || 'ORG-SITE01'}";
const char* ENDPOINT = "${sbUrl || 'https://YOUR_PROJECT.supabase.co'}/rest/v1/meter_readings";
const char* API_KEY = "YOUR_SUPABASE_KEY";

float regsToFloat(uint16_t hi, uint16_t lo) {
  uint32_t combined = ((uint32_t)hi << 16) | lo;
  float val;
  memcpy(&val, &combined, 4);
  return val;
}

void setup() {
  Serial.begin(115200);
  Serial2.begin(${selectedGuideCompany?.baudRate || 9600}, SERIAL_8N1, RXD2, TXD2);
  WiFi.begin("FACTORY_WIFI", "WIFI_PASSWORD");
  while (WiFi.status() != WL_CONNECTED) delay(500);
}

void loop() {
  node.begin(1, Serial2); // Slave ID #1
  if (node.readHoldingRegisters(3060, 2) == node.ku8MBSuccess) {
    float kw = regsToFloat(node.getResponseBuffer(0), node.getResponseBuffer(1));
    HTTPClient http;
    http.begin(ENDPOINT);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", API_KEY);
    http.addHeader("Authorization", String("Bearer ") + API_KEY);
    String body = String("{\\"org_id\\":\\"") + ORG_ID + "\\",\\"slave_id\\":1,\\"active_power_kw\\":" + String(kw, 2) + "}";
    http.POST(body);
    http.end();
  }
  delay(${Number(selectedGuideCompany?.pollingIntervalSec || 5) * 1000});
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: CUSTOMER LOGIN ACCOUNTS & SUPABASE CLOUD CONNECTION            */}
      {/* ===================================================================== */}
      {subTab === 'accounts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-black text-white">
              🔐 รายชื่อบัญชีผู้ใช้งานทั้งหมดในระบบ ({allAccounts.length} บัญชี)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-2">บริษัท / ผู้ใช้งาน</th>
                    <th className="py-2.5 px-2">Login Username</th>
                    <th className="py-2.5 px-2">รหัสผ่าน (Password)</th>
                    <th className="py-2.5 px-2 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {allAccounts.map((acc) => {
                    const isEditing = editingAccount === acc.id;
                    const isSuper = acc.role === 'SUPER_ADMIN';

                    return (
                      <tr key={acc.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-2">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editFullName}
                              onChange={(e) => setEditFullName(e.target.value)}
                              className="bg-slate-950 border border-cyan-500 rounded px-2 py-1 text-white w-full"
                            />
                          ) : (
                            <div className="font-bold text-white">{acc.fullName}</div>
                          )}
                          <div className="text-[11px] text-slate-400">{acc.companyName}</div>
                        </td>
                        <td className="py-3 px-2 font-mono font-bold text-cyan-300">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editUsername}
                              onChange={(e) => setEditUsername(e.target.value)}
                              className="bg-slate-950 border border-cyan-500 rounded px-2 py-1 text-cyan-300 w-28"
                            />
                          ) : (
                            acc.username || acc.email
                          )}
                        </td>
                        <td className="py-3 px-2 font-mono font-bold text-amber-300">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              className="bg-slate-950 border border-amber-500 rounded px-2 py-1 text-amber-300 w-28"
                            />
                          ) : (
                            acc.password
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  updateClientAccount(acc.id, {
                                    username: editUsername.trim(),
                                    password: editPassword.trim(),
                                    fullName: editFullName.trim()
                                  });
                                  setEditingAccount(null);
                                  notify('success', 'อัปเดตบัญชีผู้ใช้งานเรียบร้อยแล้ว');
                                }}
                                className="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 font-bold cursor-pointer"
                              >
                                บันทึก
                              </button>
                              <button
                                onClick={() => setEditingAccount(null)}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-300 cursor-pointer"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingAccount(acc.id);
                                  setEditUsername(acc.username || '');
                                  setEditPassword(acc.password || '');
                                  setEditFullName(acc.fullName || '');
                                }}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold cursor-pointer"
                              >
                                ✏️ แก้ไข
                              </button>
                              {!isSuper && (
                                <button
                                  onClick={() => deleteClientAccount(acc.id)}
                                  className="px-2.5 py-1 rounded bg-rose-500/15 text-rose-300 font-bold cursor-pointer"
                                >
                                  ลบ
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-5">
            {/* Add Account Box */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-3">
              <h4 className="text-sm font-black text-white">➕ เพิ่มบัญชีล็อกอินให้บริษัทลูกค้า</h4>
              {allOrganizations.length === 0 ? (
                <div className="text-xs text-slate-400">
                  กรุณาสร้างบริษัทลูกค้าในแท็บที่ 2 ก่อนเพิ่มบัญชีผู้ใช้งาน
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newAccForm.orgId || !newAccForm.username || !newAccForm.password) return;
                    createClientAccount(newAccForm);
                    setNewAccForm({
                      ...newAccForm,
                      username: '',
                      password: '',
                      fullName: ''
                    });
                    notify('success', 'สร้างบัญชีผู้ใช้งานลูกค้าเรียบร้อยแล้ว');
                  }}
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label className="block text-slate-400 mb-1">เลือกบริษัทลูกค้า</label>
                    <select
                      value={newAccForm.orgId}
                      onChange={(e) => setNewAccForm({ ...newAccForm, orgId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="">-- เลือกบริษัท --</option>
                      {allOrganizations.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">ชื่อ-นามสกุล / ตำแหน่ง</label>
                    <input
                      type="text"
                      required
                      value={newAccForm.fullName}
                      onChange={(e) => setNewAccForm({ ...newAccForm, fullName: e.target.value })}
                      placeholder="เช่น คุณวิชัย (วิศวกรไฟฟ้า)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-amber-300 font-bold mb-1">Username *</label>
                      <input
                        type="text"
                        required
                        value={newAccForm.username}
                        onChange={(e) =>
                          setNewAccForm({ ...newAccForm, username: e.target.value })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-emerald-300 font-bold mb-1">Password *</label>
                      <input
                        type="text"
                        required
                        value={newAccForm.password}
                        onChange={(e) =>
                          setNewAccForm({ ...newAccForm, password: e.target.value })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-emerald-300 font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer"
                  >
                    + บันทึกบัญชีผู้ใช้งาน
                  </button>
                </form>
              )}
            </div>

            {/* Supabase Cloud Database Configuration */}
            <div className="bg-slate-900/90 border border-cyan-500/30 rounded-3xl p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-white">☁️ ตั้งค่าฐานข้อมูล Supabase Cloud</h4>
                <span
                  className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    supabaseReady
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {supabaseReady ? 'CONNECTED' : 'LOCAL STORAGE MODE'}
                </span>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Supabase Project URL</label>
                <input
                  type="url"
                  value={sbUrl}
                  onChange={(e) => setSbUrl(e.target.value)}
                  placeholder="https://xxxx.supabase.co"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-cyan-300 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Supabase Anon / Service Key</label>
                <input
                  type="password"
                  value={sbAnonKey}
                  onChange={(e) => setSbAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (sbUrl.trim() && sbAnonKey.trim()) {
                    localStorage.setItem('AOB_SUPABASE_URL', sbUrl.trim());
                    localStorage.setItem('AOB_SUPABASE_ANON_KEY', sbAnonKey.trim());
                    window.location.reload();
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black cursor-pointer"
              >
                💾 บันทึกการเชื่อมต่อ Supabase Cloud
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
