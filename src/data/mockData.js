// Master data and historical readings for ART OF BAKING CO.,LTD.
// Water meters (3 points), Electricity meters (14 points across MDB-1 & MDB-2), Solar cell system

export const COMPANY_INFO = {
  name: "ART OF BAKING CO., LTD.",
  formCode: "FM-EN-000/R00-000000",
  sheetTitle: "แบบฟอร์มสรุปการน้ำและใช้ไฟฟ้า(9-69)",
  period: "เดือนกันยายน พ.ศ. 2569",
  electricityRatePerUnit: 4.20, // บาทต่อ kWh
  waterRatePerUnit: 18.50, // บาทต่อ m³
};

// 1. ข้อมูลมิเตอร์น้ำ 3 จุด
export const WATER_METERS = [
  {
    id: "WATER-MAIN",
    name: "มิเตอร์น้ำหลัก (หน้าโรงงาน)",
    location: "หน้าโรงงาน (Main Water Supply)",
    type: "Digital LCD (m³)",
    model: "ARAD Octave DN80",
    serialNumber: "193019061",
    unit: "m³",
    sampleImage: "/meter_samples/media_1788432644869.jpg",
    baselineAug31: 205646.300,
    readingSep01: 206378.702,
    avgDailyUsage: 730,
    maxDailyUsage: 1200,
  },
  {
    id: "WATER-SOFT",
    name: "มิเตอร์น้ำ ระบบ Soft",
    location: "ระบบบำบัดน้ำ Soft Water (Boiler/Utility)",
    type: "Analog Roller (m³)",
    model: "Itrón Multimag Cyble",
    serialNumber: "F19S000630",
    unit: "m³",
    sampleImage: "/meter_samples/media_1788432644839.jpg",
    baselineAug31: 12143.0,
    readingSep01: 12191.2,
    avgDailyUsage: 48,
    maxDailyUsage: 150,
  },
  {
    id: "WATER-EVAP",
    name: "มิเตอร์น้ำ ระบบ EVAP.",
    location: "ระบบระบายความร้อน Cooling EVAP",
    type: "Analog Roller (m³)",
    model: "Itrón Multimag Cyble",
    serialNumber: "F19S000648",
    unit: "m³",
    sampleImage: "/meter_samples/media_1788432644834.jpg",
    baselineAug31: 77508.0,
    readingSep01: 77678.5,
    avgDailyUsage: 170,
    maxDailyUsage: 350,
  },
];

// 2. ข้อมูลมิเตอร์ไฟฟ้า 14 จุด (MDB-1: 8 จุด + MDB-2: 6 จุด)
export const ELECTRICITY_METERS = [
  // --- MDB-1 TR1 @ 1,600 kVA (8 Points) ---
  {
    id: "MDB1-Q1-1",
    panel: "C2-2",
    tag: "Q1-1",
    location: "MMC-PRO-1 (Frozen Line)",
    group: "MDB-1 TR1 @ 1,600 kVA",
    model: "Schneider EasyLogic PM2200",
    sampleImage: "/meter_samples/media_1788433329487.jpg",
    unit: "kWh",
    screenUnit: "GWh",
    baselineAug31: 2551900,
    readingSep01: 2554700,
    avgDailyUsage: 2800,
  },
  {
    id: "MDB1-Q1-2",
    panel: "C3-2",
    tag: "Q1-2",
    location: "MMC-PRO-2 (RTE Line)",
    group: "MDB-1 TR1 @ 1,600 kVA",
    model: "Schneider EasyLogic PM2200",
    sampleImage: "/meter_samples/media_1788433329548.jpg",
    unit: "kWh",
    screenUnit: "GWh",
    baselineAug31: 4261400,
    readingSep01: 4264100,
    avgDailyUsage: 2700,
  },
  {
    id: "MDB1-Q1-3",
    panel: "C4-2",
    tag: "Q1-3",
    location: "MCC-ACP (Air compressor)",
    group: "MDB-1 TR1 @ 1,600 kVA",
    model: "Schneider EasyLogic PM2200",
    sampleImage: "/meter_samples/media_1788433329556.jpg",
    unit: "kWh",
    screenUnit: "MWh",
    baselineAug31: 812570,
    readingSep01: 813000,
    avgDailyUsage: 430,
  },
  {
    id: "MDB1-Q1-4",
    panel: "C3-2",
    tag: "Q1-4",
    location: "MCC-WSP (Water Pump)",
    group: "MDB-1 TR1 @ 1,600 kVA",
    model: "Schneider EasyLogic PM2200",
    sampleImage: "/meter_samples/media_1788433329548.jpg",
    unit: "kWh",
    screenUnit: "MWh",
    baselineAug31: 90366,
    readingSep01: 90415,
    avgDailyUsage: 49,
  },
  {
    id: "MDB1-Q1-5",
    panel: "C2-2",
    tag: "Q1-5",
    location: "DC-AC (Air conditioner for all control room)",
    group: "MDB-1 TR1 @ 1,600 kVA",
    model: "Schneider EasyLogic PM2200",
    sampleImage: "/meter_samples/media_1788433329487.jpg",
    unit: "kWh",
    screenUnit: "MWh",
    baselineAug31: 980660,
    readingSep01: 981360,
    avgDailyUsage: 700,
  },
  {
    id: "MDB1-Q1-6",
    panel: "C4-2",
    tag: "Q1-6",
    location: "DB-PRO-1 (LP _ Office)",
    group: "MDB-1 TR1 @ 1,600 kVA",
    model: "Schneider EasyLogic PM2200",
    sampleImage: "/meter_samples/media_1788433329556.jpg",
    unit: "kWh",
    screenUnit: "GWh",
    baselineAug31: 1779800,
    readingSep01: 1780800,
    avgDailyUsage: 1000,
  },
  {
    id: "MDB1-Q1-7",
    panel: "C4-2",
    tag: "Q1-7",
    location: "DB-PRO-2 (LP _ outside)",
    group: "MDB-1 TR1 @ 1,600 kVA",
    model: "Schneider EasyLogic PM2200",
    sampleImage: "/meter_samples/media_1788433329556.jpg",
    unit: "kWh",
    screenUnit: "MWh",
    baselineAug31: 880770,
    readingSep01: 881210,
    avgDailyUsage: 440,
  },
  {
    id: "MDB1-Q1-8",
    panel: "C4-2",
    tag: "Q1-8",
    location: "MCC-SILO (Silo)",
    group: "MDB-1 TR1 @ 1,600 kVA",
    model: "Schneider EasyLogic PM2200",
    sampleImage: "/meter_samples/media_1788433329556.jpg",
    unit: "kWh",
    screenUnit: "MWh",
    baselineAug31: 229250,
    readingSep01: 229370,
    avgDailyUsage: 120,
  },

  // --- MDB-2 TR2 @ 1,600 kVA (6 Points) ---
  {
    id: "MDB2-Q1-1",
    panel: "C3-2 (Black)",
    tag: "Q1-1",
    location: "REFRIGERATION PLANT (System)",
    group: "MDB-2 TR2 @ 1,600 kVA",
    model: "Schneider EasyLogic PM2200",
    sampleImage: "/meter_samples/media_1788433329544.jpg",
    unit: "kWh",
    screenUnit: "GWh",
    baselineAug31: 21307000,
    readingSep01: 21320000,
    avgDailyUsage: 13000,
  },
  {
    id: "MDB2-Q1-2",
    panel: "C3-2 (Red)",
    tag: "Q1-2",
    location: "EMCC-FP&SN (Fire alarm system)",
    group: "MDB-2 TR2 @ 1,600 kVA",
    model: "Schneider EasyLogic PM2200",
    sampleImage: "/meter_samples/media_1788433571583.jpg",
    unit: "kWh",
    screenUnit: "MWh",
    baselineAug31: 861480,
    readingSep01: 862260,
    avgDailyUsage: 780,
  },
  {
    id: "MDB2-Q1-3",
    panel: "C3-2 (Red)",
    tag: "Q1-3",
    location: "ELP-PRO-1 (LP _ Emergency )",
    group: "MDB-2 TR2 @ 1,600 kVA",
    model: "Schneider EasyLogic PM2200",
    sampleImage: "/meter_samples/media_1788433571583.jpg",
    unit: "kWh",
    screenUnit: "MWh",
    baselineAug31: 377790,
    readingSep01: 378050,
    avgDailyUsage: 260,
  },
  {
    id: "MDB2-Q1-4",
    panel: "C3-2 (Red)",
    tag: "Q1-4",
    location: "EDB-PRO (Water treatment plant)",
    group: "MDB-2 TR2 @ 1,600 kVA",
    model: "Schneider EasyLogic PM2200",
    sampleImage: "/meter_samples/media_1788433571583.jpg",
    unit: "kWh",
    screenUnit: "MWh",
    baselineAug31: 815280,
    readingSep01: 815710,
    avgDailyUsage: 430,
  },
  {
    id: "MDB2-Q1-5",
    panel: "C3-2 (Red)",
    tag: "Q1-5",
    location: "ELP-OFF (Server room)",
    group: "MDB-2 TR2 @ 1,600 kVA",
    model: "Schneider EasyLogic PM2200",
    sampleImage: "/meter_samples/media_1788433571583.jpg",
    unit: "kWh",
    screenUnit: "MWh",
    baselineAug31: 263900,
    readingSep01: 264010,
    avgDailyUsage: 110,
  },
  {
    id: "MDB2-Q1-6",
    panel: "C3-2 (Red)",
    tag: "Q1-6",
    location: "EDB-AS/RS (AS/RS)",
    group: "MDB-2 TR2 @ 1,600 kVA",
    model: "Schneider EasyLogic PM2200",
    sampleImage: "/meter_samples/media_1788433571583.jpg",
    unit: "kWh",
    screenUnit: "MWh",
    baselineAug31: 63767,
    readingSep01: 63817,
    avgDailyUsage: 50,
  },
];

// Helper to generate full 31-day data for September 2026
export const generateMonthlyData = () => {
  const days = [];

  // Seed with Day 1 exact values from user images
  for (let day = 1; day <= 31; day++) {
    const isRecorded = day <= 3; // Days 1 to 3 have readings, rest can be projected or current
    const dateStr = `2026-09-${String(day).padStart(2, "0")}`;

    // Random variance factor for days 2-31 to simulate realistic factory production
    const variance = (day) => 0.95 + ((day * 7) % 15) / 100;

    // Water points
    const waterReadings = {};
    WATER_METERS.forEach((m) => {
      if (day === 1) {
        waterReadings[m.id] = {
          current: m.readingSep01,
          previous: m.baselineAug31,
          consumption: Number((m.readingSep01 - m.baselineAug31).toFixed(1)),
        };
      } else {
        const prevCurrent = days[day - 2]?.water[m.id]?.current || m.readingSep01;
        const dailyUse = Number((m.avgDailyUsage * variance(day)).toFixed(1));
        const current = Number((prevCurrent + dailyUse).toFixed(1));
        waterReadings[m.id] = {
          current: isRecorded ? current : null,
          previous: prevCurrent,
          consumption: isRecorded ? dailyUse : null,
        };
      }
    });

    // Electricity points
    const elecReadings = {};
    ELECTRICITY_METERS.forEach((m) => {
      if (day === 1) {
        elecReadings[m.id] = {
          current: m.readingSep01,
          previous: m.baselineAug31,
          consumption: m.readingSep01 - m.baselineAug31,
        };
      } else {
        const prevCurrent = days[day - 2]?.electricity[m.id]?.current || m.readingSep01;
        const dailyUse = Math.round(m.avgDailyUsage * variance(day));
        const current = prevCurrent + dailyUse;
        elecReadings[m.id] = {
          current: isRecorded ? current : null,
          previous: prevCurrent,
          consumption: isRecorded ? dailyUse : null,
        };
      }
    });

    // Solar system
    const solarYield = isRecorded ? Math.round(3800 * variance(day)) : null;

    days.push({
      day,
      date: dateStr,
      isRecorded,
      recordedBy: isRecorded ? "LINE Bot (AI Verified)" : "-",
      reviewer: isRecorded ? "นายสมชาย (หัวหน้าแผนกซ่อมบำรุง)" : "-",
      water: waterReadings,
      electricity: elecReadings,
      solar: {
        dailyYield: solarYield,
        peakPower: isRecorded ? Math.round(640 * variance(day)) : null,
        savingsTHB: isRecorded ? Math.round(solarYield * 4.2) : null,
        inverterStatus: "Normal (8/8 Online)",
      },
    });
  }

  return days;
};

// Calculate monthly totals for every single meter point (from day 1 to 31)
export const calculateMonthlyTotals = (monthlyDays) => {
  const waterTotals = {};
  WATER_METERS.forEach((m) => {
    let sum = 0;
    monthlyDays.forEach((d) => {
      if (d.water[m.id]?.consumption) {
        sum += d.water[m.id].consumption;
      }
    });
    waterTotals[m.id] = {
      meterId: m.id,
      name: m.name,
      unit: m.unit,
      totalConsumption: Number(sum.toFixed(1)),
      costTHB: Number((sum * COMPANY_INFO.waterRatePerUnit).toFixed(2)),
    };
  });

  const electricityTotals = {};
  ELECTRICITY_METERS.forEach((m) => {
    let sum = 0;
    monthlyDays.forEach((d) => {
      if (d.electricity[m.id]?.consumption) {
        sum += d.electricity[m.id].consumption;
      }
    });
    electricityTotals[m.id] = {
      meterId: m.id,
      tag: m.tag,
      panel: m.panel,
      location: m.location,
      group: m.group,
      unit: m.unit,
      totalConsumption: sum,
      costTHB: Math.round(sum * COMPANY_INFO.electricityRatePerUnit),
    };
  });

  let totalSolarYield = 0;
  monthlyDays.forEach((d) => {
    if (d.solar?.dailyYield) {
      totalSolarYield += d.solar.dailyYield;
    }
  });

  return {
    water: waterTotals,
    electricity: electricityTotals,
    solar: {
      totalYield: totalSolarYield,
      totalSavingsTHB: Math.round(totalSolarYield * COMPANY_INFO.electricityRatePerUnit),
    },
  };
};

// 12-Month Yearly summary
export const YEARLY_SUMMARY_2026 = [
  { month: "ม.ค.", waterM3: 21850, elecKWh: 692000, solarKWh: 114000, costSavedTHB: 478800 },
  { month: "ก.พ.", waterM3: 20900, elecKWh: 665000, solarKWh: 118500, costSavedTHB: 497700 },
  { month: "มี.ค.", waterM3: 23100, elecKWh: 735000, solarKWh: 126000, costSavedTHB: 529200 },
  { month: "เม.ย.", waterM3: 24500, elecKWh: 752000, solarKWh: 131000, costSavedTHB: 550200 },
  { month: "พ.ค.", waterM3: 22800, elecKWh: 718000, solarKWh: 119000, costSavedTHB: 499800 },
  { month: "มิ.ย.", waterM3: 22100, elecKWh: 698000, solarKWh: 105000, costSavedTHB: 441000 },
  { month: "ก.ค.", waterM3: 21900, elecKWh: 695000, solarKWh: 102000, costSavedTHB: 428400 },
  { month: "ส.ค.", waterM3: 22600, elecKWh: 708900, solarKWh: 112000, costSavedTHB: 470400 },
  { month: "ก.ย. (ปัจจุบัน)", waterM3: 22400, elecKWh: 686000, solarKWh: 115500, costSavedTHB: 485100 },
  { month: "ต.ค. (ประมาณการ)", waterM3: 22200, elecKWh: 690000, solarKWh: 116000, costSavedTHB: 487200 },
  { month: "พ.ย. (ประมาณการ)", waterM3: 21500, elecKWh: 680000, solarKWh: 119000, costSavedTHB: 499800 },
  { month: "ธ.ค. (ประมาณการ)", waterM3: 21000, elecKWh: 670000, solarKWh: 121000, costSavedTHB: 508200 },
];
