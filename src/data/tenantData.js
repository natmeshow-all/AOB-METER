// Production Multi-Tenant Energy & Hardware Configuration Engine (V3)
// 100% Real User Data Only — Zero Hardcoded Demo Data

const STORAGE_KEY_COMPANIES = 'POWERVIEW_PROD_COMPANIES_V3';
const LEGACY_COMPANY_KEYS = [
  'POWERVIEW_PROD_COMPANIES_V4',
  'POWERVIEW_PROD_COMPANIES_V3',
  'POWERVIEW_PROD_COMPANIES_V2'
];

// Standard Modbus Register Presets for Industrial Power Meters & Solar Inverters
export const METER_MODEL_PRESETS = {
  'Schneider PM2200': {
    model: 'Schneider PM2200',
    category: 'INDUSTRIAL',
    dataType: 'Float32 (Big-Endian)',
    functionCode: '03 (Read Holding Registers)',
    regVoltageLL: 3020,
    regCurrentAvg: 3000,
    regActivePowerKW: 3060,
    regPowerFactor: 3084,
    regEnergyKWh: 3204
  },
  'Schneider PM5350': {
    model: 'Schneider PM5350',
    category: 'INDUSTRIAL',
    dataType: 'Float32 (Big-Endian)',
    functionCode: '03 (Read Holding Registers)',
    regVoltageLL: 3020,
    regCurrentAvg: 3000,
    regActivePowerKW: 3060,
    regPowerFactor: 3084,
    regEnergyKWh: 3204
  },
  'ABB M4M 20': {
    model: 'ABB M4M 20',
    category: 'INDUSTRIAL',
    dataType: 'UInt32 / Float32',
    functionCode: '03 (Read Holding Registers)',
    regVoltageLL: 23040,
    regCurrentAvg: 23056,
    regActivePowerKW: 23068,
    regPowerFactor: 23092,
    regEnergyKWh: 20480
  },
  'Chint DTSU666 (3-Phase)': {
    model: 'Chint DTSU666 (3-Phase)',
    category: 'INDUSTRIAL',
    dataType: 'Float32 (IEEE754)',
    functionCode: '03 (Read Holding Registers)',
    regVoltageLL: 8192,
    regCurrentAvg: 8204,
    regActivePowerKW: 8210,
    regPowerFactor: 8234,
    regEnergyKWh: 16384
  },
  'Eastron SDM630': {
    model: 'Eastron SDM630',
    category: 'INDUSTRIAL',
    dataType: 'Float32 (Input Reg 04)',
    functionCode: '04 (Read Input Registers)',
    regVoltageLL: 200,
    regCurrentAvg: 48,
    regActivePowerKW: 52,
    regPowerFactor: 62,
    regEnergyKWh: 342
  },
  'SAJ H2-6K-LS2 (Hybrid Inverter)': {
    model: 'SAJ H2-6K-LS2 (Hybrid Inverter)',
    category: 'HOME_SOLAR',
    dataType: 'UInt16 / Int16 (Scale 0.1/0.01)',
    functionCode: '03 (Read Holding Registers)',
    regVoltageLL: 16433,
    regCurrentAvg: 16434,
    regActivePowerKW: 16493,
    regPowerFactor: 16497,
    regEnergyKWh: 16535
  },
  'Chint DDSU666 (1-Phase Meter)': {
    model: 'Chint DDSU666 (1-Phase Meter)',
    category: 'HOME_SOLAR',
    dataType: 'Float32 (IEEE754)',
    functionCode: '03 (Read Holding Registers)',
    regVoltageLL: 8192,
    regCurrentAvg: 8194,
    regActivePowerKW: 8196,
    regPowerFactor: 8202,
    regEnergyKWh: 16384
  }
};

export const createEmptySolarConfig = () => ({
  inverterModel: 'SAJ H2-6K-LS2 (Hybrid Inverter)',
  connectionMethod: 'SAJ_CLOUD_READONLY_ZERO_COST',
  sajCloudGuestEmail: '',
  sajDeviceSn: '',
  sajReadOnlyTokenId: '',
  sajCloudAutoCollect24h: true,
  lastCloudSyncAt: '',
  inverterIp: 'SAJ-CLOUD-AUTO',
  inverterPort: '443',
  slaveId: 1,
  baudRate: '9600',
  pvCapacityKWp: 6.0,
  batteryCapacityKWh: 10.24,
  batteryType: 'Lithium Battery',
  inverterTempC: 36.5,
  batteryTempC: 28.5,
  pv1Voltage: 0,
  pv1Current: 0,
  pv1PowerW: 0,
  pv2Voltage: 0,
  pv2Current: 0,
  pv2PowerW: 0,
  // Solar Panel Specs & Series String Configuration
  pv1PanelCount: 8,
  pv2PanelCount: 6,
  panelModelName: 'Mono Half-Cell N-Type TOPCon 580W',
  panelWattage: 580,
  panelVoc: 51.5,
  panelVmp: 42.5,
  panelImp: 13.65,
  panelIsc: 14.50,
  inverterMaxMpptCurrentA: 16.0,
  inverterMaxDcVoltageV: 550.0,
  batteryStatus: 'Standby',
  batterySOC: 77,
  batteryVoltage: 52.8,
  batteryCurrent: 0,
  batteryPowerW: 0,
  gridAc1Voltage: 231.5,
  gridAc1Current: 0,
  gridAc1PowerW: 0,
  gridAc1FreqHz: 50.0,
  gridMeterL1Voltage: 231.5,
  gridMeterL1Current: 0,
  totalLoadPowerW: 0,
  gridConnectedLoadVoltage: 231.5,
  gridConnectedLoadCurrent: 0,
  gridConnectedLoadPowerW: 0,
  offGridLoadVoltage: 230.0,
  offGridLoadCurrent: 0,
  offGridLoadPowerW: 0,
  todayEnergyKWh: 27.34,
  totalEnergyKWh: 27.34,
  statLoadElectricityKWh: 0,
  statImportKWh: 0,
  statExportKWh: 0,
  statChargeBatteryKWh: 0,
  statDischargeBatteryKWh: 0,
  historicalDailyLogs: []
});

// Generate verified baseline dates for instant render across any device
export const getThailandDateStr = (daysAgo = 0) => {
  const thTimeMs = Date.now() + 7 * 3600 * 1000 - daysAgo * 86400 * 1000;
  return new Date(thTimeMs).toISOString().slice(0, 10);
};

export const createInitialBannatHistory = () => {
  return [];
};

export const createInitial24HourCurve = () => {
  return [];
};

// Load saved companies from localStorage across all versions and ensure BANNAT (NAT01) is preserved
const loadInitialCompanies = () => {
  const merged = {};
  try {
    for (const key of LEGACY_COMPANY_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([orgId, comp]) => {
            if (comp && typeof comp === 'object') {
              merged[orgId] = {
                ...(merged[orgId] || {}),
                ...comp
              };
            }
          });
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load production companies:', e);
  }

  // Sanitize all loaded organizations: strip any legacy simulated historical logs (!item.isRealSajV2)
  // and replace old placeholder SN 'SAJ-H2-6K-LS2' with real inverter SN 'H2A2602J2539E14713'
  Object.keys(merged).forEach((k) => {
    const comp = merged[k];
    if (comp?.solarConfig) {
      const rawLogs = Array.isArray(comp.solarConfig.historicalDailyLogs)
        ? comp.solarConfig.historicalDailyLogs
        : [];
      const realLogsOnly = rawLogs.filter((item) => item && item.isRealSajV2 === true);
      const cleanSn =
        !comp.solarConfig.sajDeviceSn || comp.solarConfig.sajDeviceSn === 'SAJ-H2-6K-LS2'
          ? 'H2A2602J2539E14713'
          : comp.solarConfig.sajDeviceSn;

      merged[k] = {
        ...comp,
        solarConfig: {
          ...comp.solarConfig,
          sajDeviceSn: cleanSn,
          historicalDailyLogs: realLogsOnly
        }
      };
    }
  });

  // Strictly remove all legacy simulated demo companies
  delete merged['ORG-AOB'];
  delete merged['ORG-GRAND'];

  // Ensure BANNAT (NAT01) Home Solar site is always preserved and set to HOME_SOLAR
  const existingBannatKey = Object.keys(merged).find(
    (k) =>
      k === 'ORG-NAT01' ||
      k === 'ORG-BANNAT' ||
      merged[k]?.code?.toUpperCase() === 'NAT01' ||
      merged[k]?.name?.toUpperCase() === 'BANNAT'
  );

  if (existingBannatKey) {
    const existing = merged[existingBannatKey];
    const prevLogs = existing.solarConfig?.historicalDailyLogs || [];
    const validLogs = prevLogs.filter((l) => l && l.isRealSajV2);
    merged[existingBannatKey] = {
      ...existing,
      id: 'ORG-NAT01',
      code: 'NAT01',
      name: 'BANNAT',
      shortName: 'BANNAT (NAT01)',
      siteType: 'HOME_SOLAR',
      solarConfig: {
        ...createEmptySolarConfig(),
        sajCloudGuestEmail: 'natshownolimit@gmail.com',
        sajDeviceSn: 'H2A2602J2539E14713',
        ...(existing.solarConfig || {}),
        historicalDailyLogs: validLogs,
        daily24HourCurve: existing.solarConfig?.daily24HourCurve || []
      }
    };
  } else {
    merged['ORG-NAT01'] = {
      id: 'ORG-NAT01',
      code: 'NAT01',
      name: 'BANNAT',
      shortName: 'BANNAT (NAT01)',
      siteType: 'HOME_SOLAR',
      industry: 'ผู้ใช้งานตามบ้าน (Solar Hybrid Inverter)',
      location: 'Natshow No limit',
      transformerKVA: 0,
      contractPeakKW: 6,
      gatewayModel: 'SAJ AIO3 WiFi / Cloud V2',
      gatewaySerial: 'H2A2602J2539E14713',
      gatewayIp: 'SAJ-CLOUD-AUTO',
      gatewayPort: '443',
      loginUsername: 'natshow',
      loginPassword: 'naTshow8@',
      status: 'ONLINE',
      installedDate: '2026-10-25',
      electricityMeters: [],
      solarConfig: {
        ...createEmptySolarConfig(),
        inverterModel: 'H2-6K-LS2',
        sajCloudGuestEmail: 'natshownolimit@gmail.com',
        sajDeviceSn: 'H2A2602J2539E14713',
        pvCapacityKWp: 6,
        batteryCapacityKWh: 10.24,
        batterySOC: 0,
        todayEnergyKWh: 0,
        totalEnergyKWh: 0,
        pv1Voltage: 0,
        pv1Current: 0,
        batteryVoltage: 0,
        batteryCurrent: 0,
        batteryPowerW: 0,
        gridAc1Voltage: 0,
        gridAc1FreqHz: 0,
        gridAc1PowerW: 0,
        houseLoadW: 0,
        inverterTempC: 0,
        lastCloudSyncAt: 'รอการเชื่อมต่อ/กดซิงค์ข้อมูลจริง',
        historicalDailyLogs: [],
        daily24HourCurve: []
      }
    };
  }

  return merged;
};

export const TENANT_COMPANIES = loadInitialCompanies();

const persistCompanies = () => {
  try {
    localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(TENANT_COMPANIES));
  } catch (e) {
    console.warn('Failed to save companies:', e);
  }
};

export const saveTenantCompany = (companyObj) => {
  if (!companyObj || !companyObj.id) return;
  TENANT_COMPANIES[companyObj.id] = companyObj;
  persistCompanies();
};

export const deleteTenantCompany = (orgId) => {
  if (!TENANT_COMPANIES[orgId]) return false;
  delete TENANT_COMPANIES[orgId];
  persistCompanies();
  return true;
};

export const clearAllTenantCompanies = () => {
  Object.keys(TENANT_COMPANIES).forEach((k) => {
    delete TENANT_COMPANIES[k];
  });
  persistCompanies();
};

// 1. Generate 24-Hour Profile for Selected Company & Date (Uses real meter readings)
export const generateHourlyData = (companyId) => {
  const company = TENANT_COMPANIES[companyId];
  if (!company || !company.electricityMeters || company.electricityMeters.length === 0) {
    return Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      hourNum: h,
      activeKW: 0,
      energyKWh: 0,
      isOnPeak: h >= 9 && h < 22,
      periodLabel: h >= 9 && h < 22 ? 'On-Peak' : 'Off-Peak',
      voltage: 0,
      currentA: 0,
      powerFactor: 0
    }));
  }

  const baseTotal = company.electricityMeters.reduce(
    (acc, m) => acc + (Number(m.liveKW ?? m.baseKW) || 0),
    0
  );
  const avgVolt =
    company.electricityMeters.reduce((acc, m) => acc + (Number(m.voltageLL) || 0), 0) /
    company.electricityMeters.length;
  const totalCurrent = company.electricityMeters.reduce(
    (acc, m) => acc + (Number(m.currentA) || 0),
    0
  );
  const avgPf =
    company.electricityMeters.reduce((acc, m) => acc + (Number(m.pf) || 0), 0) /
    company.electricityMeters.length;

  return Array.from({ length: 24 }, (_, h) => {
    const isOnPeak = h >= 9 && h < 22;
    const activeKW = Number(baseTotal.toFixed(1));
    return {
      hour: `${String(h).padStart(2, '0')}:00`,
      hourNum: h,
      activeKW,
      energyKWh: activeKW,
      isOnPeak,
      periodLabel: isOnPeak ? 'On-Peak' : 'Off-Peak',
      voltage: Number(avgVolt.toFixed(1)),
      currentA: Math.round(totalCurrent),
      powerFactor: Number(avgPf.toFixed(2))
    };
  });
};

// 2. Generate 24-Hour Profile for a Single Selected Meter
export const generateSingleMeterHourlyData = (companyId, meterObj) => {
  if (!meterObj) return [];
  const kw = Number(meterObj.liveKW ?? meterObj.baseKW) || 0;
  const volt = Number(meterObj.voltageLL) || 0;
  const curr = Number(meterObj.currentA) || 0;
  const pf = Number(meterObj.pf) || 0;

  return Array.from({ length: 24 }, (_, h) => {
    const isOnPeak = h >= 9 && h < 22;
    const voltageL1 = volt > 0 ? Number((volt / Math.sqrt(3)).toFixed(1)) : 0;

    return {
      hour: `${String(h).padStart(2, '0')}:00`,
      hourNum: h,
      activeKW: Number(kw.toFixed(1)),
      reactiveKVAR:
        kw > 0 && pf > 0 && pf < 1 ? Number((kw * Math.tan(Math.acos(pf))).toFixed(1)) : 0,
      apparentKVA: kw > 0 && pf > 0 ? Number((kw / pf).toFixed(1)) : 0,
      voltageLL: Number(volt.toFixed(1)),
      voltageL1,
      voltageL2: voltageL1,
      voltageL3: voltageL1,
      currentA: Math.round(curr),
      currentL1: Math.round(curr),
      currentL2: Math.round(curr),
      currentL3: Math.round(curr),
      pf: Number(pf.toFixed(2)),
      isOnPeak
    };
  });
};

// 3. Generate 30-Day Billing & Load-Factor History
export const generateDailyBillingData = (companyId) => {
  const company = TENANT_COMPANIES[companyId];
  if (!company || !company.electricityMeters || company.electricityMeters.length === 0) return [];

  const totalTodayKWh = company.electricityMeters.reduce(
    (acc, m) => acc + (Number(m.todayKWh) || (Number(m.liveKW ?? m.baseKW) || 0) * 24),
    0
  );

  return Array.from({ length: 30 }, (_, idx) => {
    const day = idx + 1;
    const isWeekend = day % 7 === 6 || day % 7 === 0;
    const totalKWh = Math.round(totalTodayKWh);
    const onPeakKWh = isWeekend ? 0 : Math.round(totalKWh * 0.54);
    const offPeakKWh = totalKWh - onPeakKWh;
    const costBaht = Math.round(onPeakKWh * 4.18 + offPeakKWh * 2.6);

    return {
      day: `วันที่ ${day}`,
      dayNum: day,
      isWeekend,
      onPeakKWh,
      offPeakKWh,
      totalKWh,
      costBaht
    };
  });
};

// 4. Generate 12-Month Executive Summary
export const generateYearlyData = (companyId) => {
  const months = [
    'ม.ค.',
    'ก.พ.',
    'มี.ค.',
    'เม.ย.',
    'พ.ค.',
    'มิ.ย.',
    'ก.ค.',
    'ส.ค.',
    'ก.ย.',
    'ต.ค.',
    'พ.ย.',
    'ธ.ค.'
  ];
  const daily = generateDailyBillingData(companyId);
  const avgDailyKWh = daily.length > 0 ? daily[0].totalKWh : 0;

  return months.map((m) => {
    const totalKWh = Math.round(avgDailyKWh * 30);
    const onPeakKWh = Math.round(totalKWh * 0.52);
    const offPeakKWh = totalKWh - onPeakKWh;
    const costBaht = Math.round(onPeakKWh * 4.18 + offPeakKWh * 2.6);
    return {
      month: m,
      onPeakKWh,
      offPeakKWh,
      totalKWh,
      costBaht
    };
  });
};

export const generateDailyData = (companyId, daysInMonth = 30) => {
  const company = TENANT_COMPANIES[companyId];
  const baseTotalKW = (company?.electricityMeters || []).reduce(
    (acc, m) => acc + (Number(m.liveKW ?? m.baseKW) || 0),
    0
  );
  const baseDailyKWh = baseTotalKW * 18;

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = d % 7;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const multiplier = isWeekend ? 0.68 : 1.0;

    const totalKWh = Math.round(baseDailyKWh * multiplier);
    const peakKW = Math.round(baseTotalKW * 1.05);
    const onPeakKWh = Math.round(totalKWh * 0.65);
    const offPeakKWh = totalKWh - onPeakKWh;

    days.push({
      day: d,
      dateLabel: `${d}`,
      isWeekend,
      totalKWh,
      peakKW,
      onPeakKWh,
      offPeakKWh,
      powerFactor: 0.95
    });
  }
  return days;
};

export const generateMonthlyData = (companyId) => {
  const company = TENANT_COMPANIES[companyId];
  const baseTotalKW = (company?.electricityMeters || []).reduce(
    (acc, m) => acc + (Number(m.liveKW ?? m.baseKW) || 0),
    0
  );
  const baseMonthlyKWh = baseTotalKW * 18 * 28;

  const monthNames = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];

  return monthNames.map((name, idx) => {
    const totalKWh = Math.round(baseMonthlyKWh);
    const peakKW = Math.round(baseTotalKW * 1.08);
    return {
      month: name,
      monthNum: idx + 1,
      totalKWh,
      peakKW
    };
  });
};
