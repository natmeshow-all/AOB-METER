// Multi-Tenant Energy Data Engine
// Generates company-isolated meters, realtime telemetry, and historical data (Hourly, Daily, Monthly, Yearly)

export const TENANT_COMPANIES = {
  'ORG-AOB': {
    id: 'ORG-AOB',
    code: 'AOB',
    name: 'บริษัท เอโอเบสต์ จำกัด (ART OF BAKING CO., LTD.)',
    shortName: 'เอโอเบสต์ (AOB)',
    industry: 'โรงงานผลิตเบเกอรี่และแป้งแช่แข็ง',
    transformerKVA: 1600,
    contractPeakKW: 1200,
    rateKWh: 4.20,
    peakRate: 5.10,
    offPeakRate: 2.60,
    waterRate: 18.50,
    formCode: 'FM-EN-000/R00-AOB',
    electricityMeters: [
      { id: 'AOB-E01', tag: 'Q1-1', panel: 'C2-2', name: 'MMC-PRO-1 (Frozen Line)', baseKW: 85, model: 'Schneider PM2200', unit: 'GWh' },
      { id: 'AOB-E02', tag: 'Q1-2', panel: 'C3-2 ดำ', name: 'MMC-PRO-2 (RTE Line)', baseKW: 110, model: 'Schneider PM2200', unit: 'GWh' },
      { id: 'AOB-E03', tag: 'Q1-3', panel: 'C4-2', name: 'MCC-ACP (Air compressor)', baseKW: 45, model: 'Schneider PM2200', unit: 'MWh' },
      { id: 'AOB-E04', tag: 'Q1-4', panel: 'C3-2 ดำ', name: 'MCC-WSP (Water Pump)', baseKW: 18, model: 'Schneider PM2200', unit: 'MWh' },
      { id: 'AOB-E05', tag: 'Q1-5', panel: 'C2-2', name: 'DC-AC (Control Room Air)', baseKW: 35, model: 'Schneider PM2200', unit: 'MWh' },
      { id: 'AOB-E06', tag: 'Q1-6', panel: 'C4-2', name: 'DB-PRO-1 (LP Office)', baseKW: 60, model: 'Schneider PM2200', unit: 'GWh' },
      { id: 'AOB-E07', tag: 'Q1-7', panel: 'C4-2', name: 'DB-PRO-2 (LP Outside)', baseKW: 30, model: 'Schneider PM2200', unit: 'MWh' },
      { id: 'AOB-E08', tag: 'Q1-8', panel: 'C4-2', name: 'MCC-SILO (Silo System)', baseKW: 25, model: 'Schneider PM2200', unit: 'MWh' },
      { id: 'AOB-E09', tag: 'Q1-1', panel: 'C3-2 ดำ', name: 'REFRIGERATION PLANT', baseKW: 380, model: 'Schneider PM2200', unit: 'GWh' },
      { id: 'AOB-E10', tag: 'Q1-2', panel: 'C3-2 แดง', name: 'EMCC-FP&SN (Fire alarm)', baseKW: 35, model: 'Schneider PM2200', unit: 'MWh' },
      { id: 'AOB-E11', tag: 'Q1-3', panel: 'C3-2 แดง', name: 'ELP-PRO-1 (Emergency)', baseKW: 15, model: 'Schneider PM2200', unit: 'MWh' },
      { id: 'AOB-E12', tag: 'Q1-4', panel: 'C3-2 แดง', name: 'EDB-PRO (Water treatment)', baseKW: 30, model: 'Schneider PM2200', unit: 'MWh' },
      { id: 'AOB-E13', tag: 'Q1-5', panel: 'C3-2 แดง', name: 'ELP-OFF (Server room)', baseKW: 12, model: 'Schneider PM2200', unit: 'MWh' },
      { id: 'AOB-E14', tag: 'Q1-6', panel: 'C3-2 แดง', name: 'EDB-AS/RS (Automated Store)', baseKW: 8, model: 'Schneider PM2200', unit: 'MWh' },
    ],
    waterMeters: [
      { id: 'AOB-W01', name: 'มิเตอร์น้ำหลัก หน้าโรงงาน', tag: 'WATER-MAIN', baseM3: 160 },
      { id: 'AOB-W02', name: 'มิเตอร์น้ำ ระบบ Soft Water', tag: 'WATER-SOFT', baseM3: 12 },
      { id: 'AOB-W03', name: 'มิเตอร์น้ำ ระบบ Cooling EVAP.', tag: 'WATER-EVAP', baseM3: 45 },
    ]
  },

  'ORG-GRAND': {
    id: 'ORG-GRAND',
    code: 'GDB',
    name: 'บริษัท แกรนด์ เบเกอรี่ อินดัสทรี จำกัด',
    shortName: 'แกรนด์ เบเกอรี่ (GDB)',
    industry: 'โรงงานผลิตขนมปังแผ่นและแซนวิชอุตสาหกรรม',
    transformerKVA: 2000,
    contractPeakKW: 1500,
    rateKWh: 4.25,
    peakRate: 5.15,
    offPeakRate: 2.65,
    waterRate: 18.00,
    formCode: 'FM-EN-GDB/2026',
    electricityMeters: [
      { id: 'GDB-E01', tag: 'MDB-01', panel: 'Main Feeder 1', name: 'สายการอบ Main Tunnel Oven 1', baseKW: 280, model: 'ABB M4M 20', unit: 'MWh' },
      { id: 'GDB-E02', tag: 'MDB-02', panel: 'Main Feeder 1', name: 'สายการอบ Main Tunnel Oven 2', baseKW: 295, model: 'ABB M4M 20', unit: 'MWh' },
      { id: 'GDB-E03', tag: 'MDB-03', panel: 'Utility Panel', name: 'ระบบชิลเลอร์ Chiller Plant A', baseKW: 210, model: 'ABB M4M 20', unit: 'MWh' },
      { id: 'GDB-E04', tag: 'MDB-04', panel: 'Utility Panel', name: 'ระบบชิลเลอร์ Chiller Plant B', baseKW: 195, model: 'ABB M4M 20', unit: 'MWh' },
      { id: 'GDB-E05', tag: 'MDB-05', panel: 'Compressor', name: 'Air Compressor 100HP', baseKW: 75, model: 'ABB M4M 20', unit: 'MWh' },
      { id: 'GDB-E06', tag: 'MDB-06', panel: 'Packing Line', name: 'เครื่องบรรจุอัตโนมัติ Auto Packing', baseKW: 65, model: 'ABB M4M 20', unit: 'MWh' },
      { id: 'GDB-E07', tag: 'MDB-07', panel: 'Warehouse', name: 'คลังสินค้าและระบบปรับอากาศส่วนกลาง', baseKW: 90, model: 'ABB M4M 20', unit: 'MWh' },
      { id: 'GDB-E08', tag: 'MDB-08', panel: 'Office', name: 'อาคารสำนักงานและห้องทดลอง R&D', baseKW: 45, model: 'ABB M4M 20', unit: 'MWh' },
      { id: 'GDB-E09', tag: 'MDB-09', panel: 'Emergency', name: 'ระบบดับเพลิงและลิฟต์ขนส่ง', baseKW: 30, model: 'ABB M4M 20', unit: 'MWh' },
      { id: 'GDB-E10', tag: 'MDB-10', panel: 'Solar Tie', name: 'Solar Rooftop Grid-Tie Inverter', baseKW: -180, model: 'ABB M4M 20', unit: 'MWh' },
    ],
    waterMeters: [
      { id: 'GDB-W01', name: 'มิเตอร์น้ำประปาหลัก Main Pipe', tag: 'MAIN-GDB', baseM3: 210 },
      { id: 'GDB-W02', name: 'มิเตอร์น้ำระบบ Boiler & Steam', tag: 'BOILER-GDB', baseM3: 65 },
    ]
  },

  'ORG-SIAMCOLD': {
    id: 'ORG-SIAMCOLD',
    code: 'SCS',
    name: 'บริษัท สยาม โคลด์ สตอเรจ จำกัด (คลังสินค้าห้องเย็น)',
    shortName: 'สยามโคลด์ (SCS)',
    industry: 'ศูนย์กระจายสินค้าและห้องเย็นรักษาอุณหภูมิ -25°C',
    transformerKVA: 2500,
    contractPeakKW: 1900,
    rateKWh: 4.15,
    peakRate: 5.05,
    offPeakRate: 2.58,
    waterRate: 18.50,
    formCode: 'FM-SCS-COLD-01',
    electricityMeters: [
      { id: 'SCS-E01', tag: 'COMP-1', panel: 'Ammonia Plant', name: 'Screw Compressor 1 (Mycom 250kW)', baseKW: 240, model: 'Schneider PM5350', unit: 'GWh' },
      { id: 'SCS-E02', tag: 'COMP-2', panel: 'Ammonia Plant', name: 'Screw Compressor 2 (Mycom 250kW)', baseKW: 235, model: 'Schneider PM5350', unit: 'GWh' },
      { id: 'SCS-E03', tag: 'COMP-3', panel: 'Ammonia Plant', name: 'Screw Compressor 3 (Mycom 300kW)', baseKW: 280, model: 'Schneider PM5350', unit: 'GWh' },
      { id: 'SCS-E04', tag: 'EVAP-P1', panel: 'Condenser Bay', name: 'Evaporative Condenser 1 & 2', baseKW: 95, model: 'Schneider PM5350', unit: 'MWh' },
      { id: 'SCS-E05', tag: 'ROOM-A', panel: 'Cold Room A', name: 'Freezer Room A (-25°C Blast)', baseKW: 180, model: 'Schneider PM5350', unit: 'MWh' },
      { id: 'SCS-E06', tag: 'ROOM-B', panel: 'Cold Room B', name: 'Holding Room B (-18°C Storage)', baseKW: 150, model: 'Schneider PM5350', unit: 'MWh' },
      { id: 'SCS-E07', tag: 'ANTEROOM', panel: 'Loading Dock', name: 'ห้องโหลดสินค้า ควบคุมความชื้น Anteroom', baseKW: 75, model: 'Schneider PM5350', unit: 'MWh' },
      { id: 'SCS-E08', tag: 'ASRS-ROBOT', panel: 'Automation', name: 'ระบบหุ่นยนต์หยิบสินค้า ASRS Stacker', baseKW: 85, model: 'Schneider PM5350', unit: 'MWh' },
      { id: 'SCS-E09', tag: 'SUB-OFFICE', panel: 'Facility', name: 'สำนักงานศุลกากรและฝ่ายปฏิบัติการ', baseKW: 35, model: 'Schneider PM5350', unit: 'MWh' },
      { id: 'SCS-E10', tag: 'WATER-PUMP', panel: 'Utility', name: 'ปั๊มสูบน้ำหล่อเย็นและระบบบำบัด', baseKW: 40, model: 'Schneider PM5350', unit: 'MWh' },
      { id: 'SCS-E11', tag: 'SOLAR-ROOF', panel: 'Solar Bay', name: 'โซลาร์รูฟท็อป 450 kWp', baseKW: -260, model: 'Schneider PM5350', unit: 'MWh' },
      { id: 'SCS-E12', tag: 'EMERGENCY', panel: 'Generator Bus', name: 'ระบบสำรองไฟฉุกเฉิน UPS 100kVA', baseKW: 25, model: 'Schneider PM5350', unit: 'MWh' },
    ],
    waterMeters: [
      { id: 'SCS-W01', name: 'มิเตอร์น้ำประปาหลัก Cooling Water', tag: 'WATER-MAIN', baseM3: 290 },
      { id: 'SCS-W02', name: 'มิเตอร์น้ำหล่อเย็น Condenser Loop', tag: 'WATER-CONDENSER', baseM3: 110 },
    ]
  }
};

// 1. Generate 24-Hour Profile for Selected Company & Date
export const generateHourlyData = (companyId) => {
  const company = TENANT_COMPANIES[companyId] || TENANT_COMPANIES['ORG-AOB'];
  const baseTotal = company.electricityMeters.reduce((acc, m) => acc + (m.baseKW > 0 ? m.baseKW : 0), 0);

  const hours = [];
  for (let h = 0; h < 24; h++) {
    const hourStr = `${h.toString().padStart(2, '0')}:00`;
    // On-Peak in Thailand is 09:00 - 22:00 on weekdays
    const isOnPeak = h >= 9 && h <= 22;
    
    // Realistic industrial load curve: peaks at 10-12 and 14-17, lowers at night
    let factor = 0.55; // baseline night load
    if (h >= 7 && h <= 8) factor = 0.75;
    else if (h >= 9 && h <= 12) factor = 0.95;
    else if (h === 13) factor = 0.82; // lunch break dip
    else if (h >= 14 && h <= 17) factor = 0.98;
    else if (h >= 18 && h <= 21) factor = 0.88;
    else if (h >= 22) factor = 0.62;

    const jitter = Math.sin(h * 1.3) * 0.04;
    const activeKW = Math.round(baseTotal * (factor + jitter));
    const kwh = Math.round(activeKW); // 1 hr usage
    const rate = isOnPeak ? company.peakRate : company.offPeakRate;
    const cost = Math.round(kwh * rate);
    const pf = Math.min(0.98, Math.max(0.89, 0.94 + Math.cos(h) * 0.02));

    hours.push({
      hour: hourStr,
      hourNum: h,
      activeKW: activeKW,
      energyKWh: kwh,
      costBaht: cost,
      isOnPeak: isOnPeak,
      periodLabel: isOnPeak ? 'On-Peak' : 'Off-Peak',
      voltage: Math.round((400 + Math.sin(h) * 2) * 10) / 10,
      currentA: Math.round(activeKW * 1.5),
      powerFactor: Number(pf.toFixed(2)),
      solarGenerationKW: (h >= 8 && h <= 17) ? Math.round(Math.sin((h - 8) / 9 * Math.PI) * (company.transformerKVA * 0.15)) : 0
    });
  }
  return hours;
};

// 2. Generate 31-Day Profile for Selected Month
export const generateDailyData = (companyId, daysInMonth = 30) => {
  const company = TENANT_COMPANIES[companyId] || TENANT_COMPANIES['ORG-AOB'];
  const baseDailyKWh = company.electricityMeters.reduce((acc, m) => acc + (m.baseKW > 0 ? m.baseKW : 0), 0) * 18;

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    // Weekend load is ~65% of weekday
    const dayOfWeek = (d % 7); // 0 or 6 is weekend
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const multiplier = isWeekend ? 0.65 : 1.0;
    const randomJitter = (Math.sin(d * 1.8) * 0.08);

    const totalKWh = Math.round(baseDailyKWh * (multiplier + randomJitter));
    const peakKW = Math.round((totalKWh / 16) * 1.15);
    const onPeakKWh = Math.round(totalKWh * 0.62);
    const offPeakKWh = totalKWh - onPeakKWh;
    const cost = Math.round((onPeakKWh * company.peakRate) + (offPeakKWh * company.offPeakRate));
    const waterM3 = Math.round((company.waterMeters.reduce((acc, w) => acc + w.baseM3, 0)) * (multiplier + randomJitter));

    days.push({
      day: d,
      dateLabel: `${d} ก.ย.`,
      isWeekend: isWeekend,
      totalKWh: totalKWh,
      peakKW: peakKW,
      onPeakKWh: onPeakKWh,
      offPeakKWh: offPeakKWh,
      costBaht: cost,
      waterM3: waterM3,
      waterCostBaht: Math.round(waterM3 * company.waterRate),
      powerFactor: Number((0.93 + (Math.sin(d) * 0.02)).toFixed(2))
    });
  }
  return days;
};

// 3. Generate 12-Month Profile (Jan - Dec)
export const generateMonthlyData = (companyId) => {
  const company = TENANT_COMPANIES[companyId] || TENANT_COMPANIES['ORG-AOB'];
  const baseMonthlyKWh = company.electricityMeters.reduce((acc, m) => acc + (m.baseKW > 0 ? m.baseKW : 0), 0) * 18 * 28;

  const monthNames = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];

  return monthNames.map((name, idx) => {
    // Summer months (Mar - May) have higher cooling load
    let seasonal = 1.0;
    if (idx >= 2 && idx <= 4) seasonal = 1.18; // Summer peak
    if (idx === 11 || idx === 0) seasonal = 0.92; // Winter cooler

    const totalKWh = Math.round(baseMonthlyKWh * seasonal * (1 + (Math.sin(idx) * 0.04)));
    const peakKW = Math.round((totalKWh / (30 * 16)) * 1.25);
    const costBaht = Math.round(totalKWh * company.rateKWh);
    const previousYearKWh = Math.round(totalKWh * 1.06); // 6% higher last year (shows energy savings)
    const savingsBaht = Math.round((previousYearKWh - totalKWh) * company.rateKWh);

    return {
      month: name,
      monthNum: idx + 1,
      totalKWh: totalKWh,
      previousYearKWh: previousYearKWh,
      peakKW: peakKW,
      costBaht: costBaht,
      savingsBaht: Math.max(0, savingsBaht),
      waterM3: Math.round(company.waterMeters.reduce((acc, w) => acc + w.baseM3, 0) * 30 * seasonal)
    };
  });
};

// 4. Generate Multi-Year Profile (2024, 2025, 2026)
export const generateYearlyData = (companyId) => {
  const company = TENANT_COMPANIES[companyId] || TENANT_COMPANIES['ORG-AOB'];
  const baseYearKWh = company.electricityMeters.reduce((acc, m) => acc + (m.baseKW > 0 ? m.baseKW : 0), 0) * 18 * 350;

  return [
    {
      year: '2567 (2024)',
      totalKWh: Math.round(baseYearKWh * 1.12),
      costBaht: Math.round(baseYearKWh * 1.12 * 4.35),
      peakDemandKW: Math.round(company.contractPeakKW * 0.96),
      efficiencyScore: '78%',
      status: 'ก่อนติดตั้ง AI & IoT'
    },
    {
      year: '2568 (2025)',
      totalKWh: Math.round(baseYearKWh * 1.04),
      costBaht: Math.round(baseYearKWh * 1.04 * 4.28),
      peakDemandKW: Math.round(company.contractPeakKW * 0.91),
      efficiencyScore: '86%',
      status: 'เริ่มใช้ AI สแกนเนอร์'
    },
    {
      year: '2569 (2026 ปัจจุบัน)',
      totalKWh: Math.round(baseYearKWh * 0.95),
      costBaht: Math.round(baseYearKWh * 0.95 * company.rateKWh),
      peakDemandKW: Math.round(company.contractPeakKW * 0.82),
      efficiencyScore: '94%',
      status: 'เชื่อมต่อ PowerView IoT สด'
    }
  ];
};
