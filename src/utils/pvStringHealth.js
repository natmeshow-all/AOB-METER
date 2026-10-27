/**
 * PV String Health Engine (ระบบตรวจสุขภาพสตริงโซลาร์ PV1 / PV2)
 *
 * Compares REAL measured string telemetry (V / A / W) against the engineering limits derived
 * from the installed panel datasheet (Vmp, Voc, Imp, Isc, Wp) × series panel count and the
 * inverter MPPT limits, then classifies every finding as:
 *   OK      – ปกติ
 *   WATCH   – เฝ้าระวัง (ยังไม่อันตราย แต่ควรติดตาม)
 *   WARNING – ผิดปกติ ควรตรวจเช็ค
 *   DANGER  – เสี่ยงอันตราย ควรตรวจสอบทันที
 *
 * Pure functions only (no React) so they can be unit-tested and reused by API / reports.
 */

/** Keys that describe the physical PV installation. These are user-owned settings and must
 *  never be overwritten by cloud telemetry sync. */
export const PV_STRING_SPEC_KEYS = [
  'pv1PanelCount',
  'pv2PanelCount',
  'panelModelName',
  'panelWattage',
  'panelVoc',
  'panelVmp',
  'panelImp',
  'panelIsc',
  'inverterMaxMpptCurrentA',
  'inverterMaxDcVoltageV'
];

export const pickPvStringSpecs = (cfg = {}) => {
  const out = {};
  PV_STRING_SPEC_KEYS.forEach((k) => {
    if (cfg && cfg[k] !== undefined && cfg[k] !== null && cfg[k] !== '') out[k] = cfg[k];
  });
  return out;
};

/** Coerce user-entered spec values to clean numbers (keeps the model name as text). */
export const sanitizePvStringSpecs = (cfg = {}) => {
  const num = (v, fallback, min = 0) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min ? n : fallback;
  };
  return {
    pv1PanelCount: Math.round(num(cfg.pv1PanelCount, 0)),
    pv2PanelCount: Math.round(num(cfg.pv2PanelCount, 0)),
    panelModelName: String(cfg.panelModelName || '').trim() || 'แผงโซลาร์ (ไม่ระบุรุ่น)',
    panelWattage: num(cfg.panelWattage, 0),
    panelVoc: num(cfg.panelVoc, 0),
    panelVmp: num(cfg.panelVmp, 0),
    panelImp: num(cfg.panelImp, 0),
    panelIsc: num(cfg.panelIsc, 0),
    inverterMaxMpptCurrentA: num(cfg.inverterMaxMpptCurrentA, 16, 1),
    inverterMaxDcVoltageV: num(cfg.inverterMaxDcVoltageV, 550, 1)
  };
};

export const HEALTH_LEVELS = {
  OK: { rank: 0, label: 'ปกติ', icon: '🟢', tone: 'emerald' },
  WATCH: { rank: 1, label: 'เฝ้าระวัง', icon: '🟡', tone: 'amber' },
  WARNING: { rank: 2, label: 'ผิดปกติ ควรตรวจเช็ค', icon: '🟠', tone: 'orange' },
  DANGER: { rank: 3, label: 'เสี่ยงอันตราย', icon: '🔴', tone: 'rose' },
  IDLE: { rank: -1, label: 'ไม่ได้ใช้งาน', icon: '⚪', tone: 'slate' },
  NO_DATA: { rank: -1, label: 'ยังไม่มีข้อมูลสตริง', icon: '⚪', tone: 'slate' }
};

const STANDARD_DC_PROTECTION_A = [10, 12, 15, 16, 20, 25, 30, 32, 40, 50, 63];

// Typical crystalline-silicon temperature behaviour (conservative for TOPCon / PERC)
const VOC_TEMP_COEFF = -0.0028; // -0.28 %/°C
const VMP_TEMP_COEFF = -0.0035; // -0.35 %/°C
const MIN_CELL_TEMP_C = 10; // coldest realistic Thai morning
const HOT_CELL_TEMP_C = 65; // hot roof at noon

const round = (v, d = 1) => Number(Number(v || 0).toFixed(d));

/** Engineering limits for one string based on panel datasheet × series count. */
export const computeStringLimits = (panelCount, specs) => {
  const s = sanitizePvStringSpecs(specs);
  const n = Math.max(0, Math.round(Number(panelCount) || 0));
  const stdVmp = n * s.panelVmp;
  const stdVoc = n * s.panelVoc;
  const coldVoc = stdVoc * (1 + VOC_TEMP_COEFF * (MIN_CELL_TEMP_C - 25));
  const hotVmp = stdVmp * (1 + VMP_TEMP_COEFF * (HOT_CELL_TEMP_C - 25));
  const designCurrentA = s.panelIsc * 1.25; // NEC 690.8 continuous design current
  const recommendedProtectionA =
    STANDARD_DC_PROTECTION_A.find((a) => a >= designCurrentA) || Math.ceil(designCurrentA);

  return {
    panelCount: n,
    stdW: n * s.panelWattage,
    stdVmp: round(stdVmp),
    stdVoc: round(stdVoc),
    coldVoc: round(coldVoc),
    hotVmp: round(hotVmp),
    // Normal operating voltage window while producing power
    normalVMin: round(hotVmp * 0.95),
    normalVMax: round(stdVoc * 1.02),
    imp: s.panelImp,
    isc: s.panelIsc,
    mpptLimitA: s.inverterMaxMpptCurrentA,
    maxDcV: s.inverterMaxDcVoltageV,
    designCurrentA: round(designCurrentA, 2),
    recommendedProtectionA,
    recommendedCableMm2: designCurrentA <= 30 ? 4 : 6,
    panelVmp: s.panelVmp,
    panelVoc: s.panelVoc
  };
};

const pushCheck = (list, level, title, detail, action) => {
  list.push({ level, title, detail, action });
};

/**
 * Evaluate one string.
 * @param {object} p
 * @param {string} p.label             'PV1' | 'PV2'
 * @param {number} p.panelCount        series panel count configured by user
 * @param {object} p.specs             panel / inverter specs
 * @param {object} p.peak              { w, v, a, hour } – consistent sample at the day's peak power
 * @param {object} p.maxCurrent        { a, hour } – highest current of the day
 * @param {object} [p.live]            { v, a, w } – latest realtime reading (today only)
 * @param {number} [p.sitePeakPvW]     total PV peak of the day (to detect a dead string)
 * @param {boolean} [p.hasTelemetry]   whether SAJ reported per-string data at all
 */
export const evaluateStringHealth = ({
  label,
  panelCount,
  specs,
  peak = {},
  maxCurrent = {},
  live = null,
  sitePeakPvW = 0,
  hasTelemetry = true
}) => {
  const lim = computeStringLimits(panelCount, specs);
  const checks = [];

  const peakW = Number(peak.w || 0);
  const peakV = Number(peak.v || 0);
  const peakA = Number(peak.a || 0);
  const maxA = Math.max(Number(maxCurrent.a || 0), peakA, Number(live?.a || 0));
  const maxAHour = maxCurrent.hour || peak.hour || '';
  const liveV = Number(live?.v || 0);
  const liveA = Number(live?.a || 0);

  if (lim.panelCount === 0) {
    if (peakW > 50 || maxA > 0.5) {
      pushCheck(
        checks,
        'WARNING',
        `${label} ตั้งค่าไว้ 0 แผง แต่มีกำลังไฟเข้า ${peakW.toLocaleString()} W`,
        'ระบบตรวจพบไฟจากสตริงนี้ แต่ยังไม่ได้กรอกจำนวนแผง จึงคำนวณเกณฑ์ปลอดภัยไม่ได้',
        `กรอกจำนวนแผงที่ต่ออนุกรมจริงของ ${label} ในช่องตั้งค่าแผง`
      );
      return { label, level: 'WARNING', limits: lim, checks, metrics: { peakW, peakV, peakA, maxA, maxAHour } };
    }
    return { label, level: 'IDLE', limits: lim, checks, metrics: { peakW, peakV, peakA, maxA, maxAHour } };
  }

  if (!hasTelemetry) {
    return { label, level: 'NO_DATA', limits: lim, checks, metrics: { peakW, peakV, peakA, maxA, maxAHour } };
  }

  // ---------- 0. Static design check (independent of telemetry) ----------
  if (lim.coldVoc > lim.maxDcV) {
    pushCheck(
      checks,
      'DANGER',
      `ออกแบบสตริงเกินพิกัดแรงดันอินเวอร์เตอร์`,
      `Voc ตอนเช้าอากาศเย็น (~${MIN_CELL_TEMP_C}°C) ≈ ${lim.coldVoc} V เกินพิกัด ${lim.maxDcV} V ของอินเวอร์เตอร์`,
      'ลดจำนวนแผงที่ต่ออนุกรมในสตริงนี้ทันที เพื่อป้องกันอินเวอร์เตอร์เสียหาย'
    );
  } else if (lim.coldVoc > lim.maxDcV * 0.95) {
    pushCheck(
      checks,
      'WATCH',
      'แรงดันสตริงใกล้พิกัดสูงสุดของอินเวอร์เตอร์',
      `Voc อากาศเย็น ≈ ${lim.coldVoc} V (พิกัด ${lim.maxDcV} V) เหลือระยะเผื่อน้อยกว่า 5%`,
      'ไม่ควรเพิ่มแผงในสตริงนี้อีก'
    );
  }

  if (lim.imp > lim.mpptLimitA) {
    pushCheck(
      checks,
      'WATCH',
      `กระแสแผง (Imp ${lim.imp} A) สูงกว่าพิกัด MPPT ${lim.mpptLimitA} A`,
      'ช่วงแดดจัดอินเวอร์เตอร์จะจำกัดกระแส (Clipping) ทำให้ผลิตไฟได้ไม่เต็มกำลังแผง — ไม่อันตรายต่ออินเวอร์เตอร์ถ้า Isc ไม่เกินพิกัด Isc สูงสุดของอินเวอร์เตอร์',
      'ตรวจสเปก "Max. short-circuit current" ของอินเวอร์เตอร์ว่ารองรับ Isc ของแผงหรือไม่'
    );
  }

  // ---------- 1. Dead / disconnected string ----------
  if (peakW <= 0 && maxA <= 0.1) {
    if (sitePeakPvW > 300) {
      pushCheck(
        checks,
        'WARNING',
        `${label} ไม่มีไฟเข้าเลยทั้งวัน (0 W / 0 A)`,
        `ขณะที่ระบบรวมผลิตได้สูงสุด ${Math.round(sitePeakPvW).toLocaleString()} W แต่ ${label} ซึ่งตั้งไว้ ${lim.panelCount} แผง ไม่มีกระแสไหลเลย`,
        'ตรวจ DC Breaker/สวิตช์ DC ว่าเปิดอยู่, ขั้วต่อ MC4 หลุด/ไหม้, ฟิวส์ DC ขาด หรือสายขาด — หากไม่ได้ต่อแผงที่สตริงนี้จริง ให้ตั้งจำนวนแผงเป็น 0'
      );
      return finalize(label, lim, checks, { peakW, peakV, peakA, maxA, maxAHour });
    }
    return { label, level: 'NO_DATA', limits: lim, checks, metrics: { peakW, peakV, peakA, maxA, maxAHour } };
  }

  // ---------- 2. Current checks ----------
  if (maxA > lim.designCurrentA) {
    pushCheck(
      checks,
      'DANGER',
      `กระแส ${label} สูงถึง ${maxA} A เกินพิกัดออกแบบสาย (${lim.designCurrentA} A)`,
      `เกิน Isc × 1.25 ของแผง (${lim.isc} A × 1.25) — เสี่ยงสาย/ขั้วต่อ MC4 ร้อนจัดจนละลายหรือเกิดอาร์ค${maxAHour ? ` (เกิดเวลา ${maxAHour} น.)` : ''}`,
      'ปิด DC Breaker แล้วตรวจสอบทันที: สายต่อขนานผิดสตริง, ขั้ว MC4 หลวม/ไหม้, ขนาดสายเล็กเกิน หรือเซนเซอร์อ่านค่าผิด'
    );
  } else if (maxA > lim.mpptLimitA) {
    pushCheck(
      checks,
      'WARNING',
      `กระแส ${label} สูง ${maxA} A เกินขีดจำกัดที่ตั้งไว้ ${lim.mpptLimitA} A`,
      `ควรเฝ้าระวังความร้อนที่สายส่ง DC และขั้วต่อ MC4${maxAHour ? ` (เกิดเวลา ${maxAHour} น.)` : ''}`,
      `ตรวจเช็คสายส่ง DC (แนะนำ PV1-F ≥ ${lim.recommendedCableMm2} mm²), ขันขั้วต่อให้แน่น, สังเกตรอยไหม้/กลิ่นไหม้ที่ MC4 และตู้ DC`
    );
  } else if (maxA > lim.isc * 1.02) {
    pushCheck(
      checks,
      'WATCH',
      `กระแส ${label} ${maxA} A สูงกว่า Isc ของแผง (${lim.isc} A)`,
      'อาจเกิดจากแสงสะท้อนเข้าด้านหลังแผง Bifacial / เมฆสะท้อนแสง (Cloud-edge effect) — ยังไม่เกินพิกัดสาย',
      'ติดตามต่อเนื่อง หากเกิดบ่อยหรือสูงขึ้นเรื่อย ๆ ให้ตรวจการเดินสาย'
    );
  } else if (maxA > lim.imp) {
    pushCheck(
      checks,
      'OK',
      `กระแสสูงสุด ${maxA} A (ช่วงแดดจัด)`,
      `อยู่ระหว่าง Imp ${lim.imp} A และ Isc ${lim.isc} A — ปกติสำหรับวันแดดแรง`,
      ''
    );
  } else {
    pushCheck(
      checks,
      'OK',
      `กระแสสูงสุด ${maxA} A ปกติ`,
      `ไม่เกิน Imp มาตรฐาน ${lim.imp} A และขีดจำกัด ${lim.mpptLimitA} A`,
      ''
    );
  }

  // ---------- 3. Voltage checks (only meaningful while the string carries current) ----------
  const evalVoltage = (v, a, when) => {
    if (v <= 0) return;
    if (v > lim.maxDcV) {
      pushCheck(
        checks,
        'DANGER',
        `แรงดัน ${label} ${v} V เกินพิกัดอินเวอร์เตอร์ ${lim.maxDcV} V (${when})`,
        'แรงดันเกินพิกัดอาจทำให้วงจร MPPT ของอินเวอร์เตอร์เสียหายถาวร',
        'ปิด DC Breaker และลดจำนวนแผงในสตริงนี้'
      );
      return;
    }
    if (v > lim.normalVMax) {
      const estPanels = Math.round(v / Math.max(1, lim.panelVoc));
      pushCheck(
        checks,
        'WARNING',
        `แรงดัน ${label} ${v} V สูงกว่า Voc ของ ${lim.panelCount} แผง (${lim.stdVoc} V) (${when})`,
        `แรงดันนี้เทียบเท่าแผงประมาณ ${estPanels} แผง — จำนวนแผงที่ตั้งไว้อาจน้อยกว่าที่ติดตั้งจริง`,
        `ตรวจนับจำนวนแผงที่ต่ออนุกรมจริงของ ${label} แล้วแก้ไขในช่องตั้งค่า`
      );
      return;
    }
    if (a < Math.max(0.5, lim.imp * 0.15)) return; // too little current to judge MPP voltage
    if (v < lim.normalVMin) {
      const hotPanelVmp = lim.panelVmp * (1 + VMP_TEMP_COEFF * (HOT_CELL_TEMP_C - 25));
      const estPanels = Math.max(0, v / Math.max(1, hotPanelVmp));
      const missing = Math.max(1, Math.round(lim.panelCount - estPanels));
      const severe = v < lim.normalVMin * 0.75;
      pushCheck(
        checks,
        severe ? 'WARNING' : 'WATCH',
        `แรงดัน ${label} ต่ำกว่าปกติ: ${v} V (ควร ≥ ${lim.normalVMin} V) (${when})`,
        `เทียบเท่าแผงทำงานประมาณ ${estPanels.toFixed(1)} จาก ${lim.panelCount} แผง (หายไป ~${missing} แผง) — อาจเกิดจากเงาบัง, Bypass Diode ทำงาน/เสีย, แผงชำรุด หรือจำนวนแผงที่ตั้งไว้มากกว่าจริง`,
        'ตรวจเงาบังและความสะอาดแผง, วัด Voc ทีละแผง, และตรวจว่าจำนวนแผงที่ตั้งไว้ตรงกับหน้างาน'
      );
    }
  };

  evalVoltage(peakV, peakA, `ขณะพีค ${peak.hour || ''} น.`.trim());
  if (live && liveV > 0 && Math.abs(liveV - peakV) > 1) evalVoltage(liveV, liveA, 'ค่าล่าสุด');

  // ---------- 4. Power vs. installed capacity ----------
  if (lim.stdW > 0 && peakW > 0) {
    const ratio = peakW / lim.stdW;
    if (ratio > 1.15) {
      pushCheck(
        checks,
        'WARNING',
        `กำลังพีค ${peakW.toLocaleString()} W สูงกว่ากำลังติดตั้ง ${(lim.stdW / 1000).toFixed(2)} kWp (${Math.round(ratio * 100)}%)`,
        'เป็นไปไม่ได้ทางกายภาพสำหรับสตริงเดี่ยว — จำนวนแผง/วัตต์ที่ตั้งไว้อาจน้อยกว่าที่ติดตั้งจริง',
        'ตรวจสอบจำนวนแผงและกำลังวัตต์ต่อแผงในช่องตั้งค่า'
      );
    } else {
      pushCheck(
        checks,
        'OK',
        `ผลิตได้ ${Math.round(ratio * 100)}% ของกำลังติดตั้ง`,
        `พีค ${peakW.toLocaleString()} W จาก ${(lim.stdW / 1000).toFixed(2)} kWp (สภาพอากาศร้อนในไทยปกติอยู่ที่ 70–90%)`,
        ''
      );
    }
  }

  // ---------- 5. Data consistency (P ≈ V × I) ----------
  if (peakV > 0 && peakA > 0 && peakW > 0) {
    const calcW = peakV * peakA;
    const diff = Math.abs(calcW - peakW) / peakW;
    if (diff > 0.2) {
      pushCheck(
        checks,
        'WATCH',
        'ค่าที่อินเวอร์เตอร์รายงานไม่สอดคล้องกัน',
        `${peakV} V × ${peakA} A = ${Math.round(calcW).toLocaleString()} W แต่รายงาน ${peakW.toLocaleString()} W (ต่างกัน ${Math.round(diff * 100)}%)`,
        'กดซิงก์ข้อมูลใหม่ หากยังต่างกันมาก อาจเป็นข้อมูลจาก Cloud ที่สุ่มเวลาไม่ตรงกัน'
      );
    }
  }

  return finalize(label, lim, checks, { peakW, peakV, peakA, maxA, maxAHour });
};

const finalize = (label, limits, checks, metrics) => {
  const worst = checks.reduce(
    (acc, c) => (HEALTH_LEVELS[c.level].rank > HEALTH_LEVELS[acc].rank ? c.level : acc),
    'OK'
  );
  return { label, level: worst, limits, checks, metrics };
};

/** Cross-string comparison (current mismatch between PV1 & PV2). */
export const evaluateStringMismatch = (h1, h2) => {
  if (!h1 || !h2) return null;
  if (h1.limits.panelCount === 0 || h2.limits.panelCount === 0) return null;
  const a1 = Number(h1.metrics.peakA || 0);
  const a2 = Number(h2.metrics.peakA || 0);
  if (a1 < 1 || a2 < 1) return null;
  const diff = Math.abs(a1 - a2) / Math.max(a1, a2);
  if (diff <= 0.3) return null;
  const weaker = a1 < a2 ? 'PV1' : 'PV2';
  return {
    level: 'WATCH',
    title: `กระแส PV1 กับ PV2 ต่างกัน ${Math.round(diff * 100)}%`,
    detail: `PV1 ${a1} A • PV2 ${a2} A — ในสตริงอนุกรม กระแสไม่ขึ้นกับจำนวนแผง ถ้าหันทิศ/มุมเดียวกันควรใกล้เคียงกัน`,
    action: `ตรวจเงาบัง ความสะอาดแผง และขั้วต่อของ ${weaker} (ถ้าสองสตริงหันคนละทิศ ถือว่าปกติ)`
  };
};
