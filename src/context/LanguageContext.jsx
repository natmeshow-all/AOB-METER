import React, { createContext, useContext, useState } from 'react';

export const TRANSLATIONS = {
  th: {
    // Brand & Status
    online: 'Online',
    systemLive: 'ระบบออนไลน์',
    cloudLive: 'SAJ Cloud เชื่อมต่อสด',
    superAdminPortal: 'ศูนย์ตั้งค่าระบบและจัดการผู้ใช้งาน (Super Admin)',
    noTenantSelected: 'ยังไม่ได้เลือกผู้ใช้งาน',
    activeUser: 'ผู้ใช้งานที่เลือกดู:',
    homeSolarDesc: 'ระบบติดตามพลังงานโซลาร์ไฮบริดและแบตเตอรี่ประจำบ้าน',
    industrialDesc: 'พิกัดหม้อแปลง {kva} kVA • ระบบติดตามการใช้ไฟฟ้าอัจฉริยะ',
    viewDashboard: 'ดูหน้าแดชบอร์ด',
    systemSettingsAdmin: 'ตั้งค่าระบบ (Admin)',
    logout: 'ออกจากระบบ',

    // Mobile Bottom Nav
    navOverview: 'หน้าหลัก',
    navCurve: 'กราฟ 24 ชม.',
    navBilling: 'บิลค่าไฟ',
    navManage: 'จัดการ',
    navIndustrialOverview: 'ภาพรวม',
    navIndustrialDetail: 'เจาะลึก',
    navIndustrialReport: 'รายงาน',
    navAdmin: 'แอดมิน',

    // Manage Action Sheet
    manageTitle: 'ศูนย์ควบคุม & การจัดการ',
    manageSubtitle: 'ระบบโซลาร์โฮม & แบตเตอรี่ BANNAT',
    syncCloudNow: 'ซิงก์ข้อมูล SAJ Cloud ทันที',
    syncingCloud: 'กำลังซิงก์ข้อมูล SAJ Cloud...',
    syncDesc: 'ดึงข้อมูลพลังงานและโซลาร์ล่าสุด',
    syncAction: 'ซิงก์',
    systemPanelSpecs: 'ตั้งค่าระบบ & สเปกแผงโซลาร์',
    systemPanelDesc: 'กำหนดจำนวนแผง PV1, PV2, Voc, Vmp',
    openAction: 'เปิด',
    peaBillOfficial: 'ใบแจ้งหนี้ กฟภ. ฉบับจริง',
    peaBillDesc: 'ดูใบเสร็จ PEA เสมือนจริง + ค่า Ft + VAT',
    openBillAction: 'เปิดบิล',
    adminConsole: 'แดชบอร์ดแอดมิน (Super Admin)',
    adminConsoleDesc: 'จัดการลูกค้า เกตเวย์ และรหัสผ่าน',
    adminReturnSolar: 'กลับสู่หน้าแดชบอร์ดโซลาร์',
    logoutAction: 'ออกจากระบบ (Logout)',
    logoutDesc: 'ล้างเซสชันและออกจากบัญชีผู้ใช้',
    exitAction: 'ออก',

    // Home Solar Dials & Carousel
    dialSolarPv: 'โซลาร์ PV',
    dialMasterHud: 'ระบบรวม',
    dialBattery: 'แบตเตอรี่',
    pvArrayTitle: 'แผงโซลาร์ (PV ARRAY)',
    todayProduction: 'TODAY PRODUCTION',
    kwhToday: 'kWh วันนี้',
    savedToday: 'ประหยัด +฿',
    totalOdometer: 'TOTAL ODOMETER',
    homeLoad: 'โหลดบ้าน',
    gridVoltage: 'แรงดันไฟ',
    usable: 'USABLE',
    autonomy: 'AUTONOMY',
    temp: 'TEMP',
    modeOdo: '1. ไมล์สะสม',
    modeRadar: '2. เรดาร์ไฟ',
    modeBms: '3. แบตสำรอง',
    modeRoi: '4. คุ้มทุน/CO₂',
    hoursShort: 'ชม.',
    liveBmsHealth: 'BMS Live Health Status',
    batterySocTitle: 'ระดับประจุ (SOC)',
    flowRadarTitle: 'เรดาร์ทิศทางการไหลของพลังงาน',
    energyRoiTitle: 'คำนวณผลตอบแทน & ลดคาร์บอน',
    estMonthlySaving: 'ประหยัดต่อเดือน (คาดการณ์)',
    co2Reduced: 'ลดก๊าซ CO₂ สะสม',
    treesUnit: 'ต้นไม้',

    // In-page Desktop Selector
    tabSummary: '⚡ หน้าหลัก & สรุป',
    tabCurve: '📈 กราฟ 24 ชม.',
    tabBilling: '🧾 บิลค่าไฟ & สถิติ',
    tabAll: '📑 แสดงทั้งหมด'
  },
  en: {
    // Brand & Status
    online: 'Online',
    systemLive: 'System Live',
    cloudLive: 'SAJ Cloud Connected',
    superAdminPortal: 'Super Admin System & Identity Console',
    noTenantSelected: 'No tenant selected',
    activeUser: 'Inspecting Tenant:',
    homeSolarDesc: 'Home Solar Hybrid & Energy Storage Intelligence',
    industrialDesc: 'Substation Transformer {kva} kVA • Smart Energy Monitoring',
    viewDashboard: 'View Dashboard',
    systemSettingsAdmin: 'Admin Console',
    logout: 'Sign Out',

    // Mobile Bottom Nav
    navOverview: 'Overview',
    navCurve: '24h Dyno',
    navBilling: 'Billing',
    navManage: 'Manage',
    navIndustrialOverview: 'Overview',
    navIndustrialDetail: 'Detail',
    navIndustrialReport: 'Report',
    navAdmin: 'Admin',

    // Manage Action Sheet
    manageTitle: 'Command & Control Hub',
    manageSubtitle: 'BANNAT Solar Home & ERS Telemetry',
    syncCloudNow: 'Sync SAJ Cloud Now',
    syncingCloud: 'Syncing SAJ Cloud...',
    syncDesc: 'Fetch live inverter & generation telemetry',
    syncAction: 'Sync',
    systemPanelSpecs: 'System & PV String Specs',
    systemPanelDesc: 'Configure PV1, PV2 panel count & Voc/Vmp',
    openAction: 'Open',
    peaBillOfficial: 'Official PEA Invoice',
    peaBillDesc: 'Authentic PEA bill replica + Ft + 7% VAT',
    openBillAction: 'Invoice',
    adminConsole: 'Super Admin Console',
    adminConsoleDesc: 'Manage tenants, gateways, and credentials',
    adminReturnSolar: 'Back to Solar Dashboard',
    logoutAction: 'Sign Out (Logout)',
    logoutDesc: 'Purge active session and exit account',
    exitAction: 'Exit',

    // Home Solar Dials & Carousel
    dialSolarPv: '☀️ Solar PV',
    dialMasterHud: '⚡ Master HUD',
    dialBattery: '🔋 Battery',
    pvArrayTitle: '☀️ SOLAR ARRAY (PV MPPT)',
    todayProduction: 'TODAY PRODUCTION',
    kwhToday: 'kWh Today',
    savedToday: 'Saved +฿',
    totalOdometer: 'TOTAL ODOMETER',
    homeLoad: '🏠 Home Load',
    gridVoltage: '🗼 Grid Volt',
    usable: 'USABLE',
    autonomy: 'AUTONOMY',
    temp: 'TEMP',
    modeOdo: '1. Odometer',
    modeRadar: '2. Flow Radar',
    modeBms: '3. Backup BMS',
    modeRoi: '4. ROI & CO₂',
    hoursShort: 'hrs',
    liveBmsHealth: 'BMS Live Health Status',
    batterySocTitle: 'State of Charge (SOC)',
    flowRadarTitle: '4-Way Energy Flow Vector Radar',
    energyRoiTitle: 'ROI & Carbon Offsetting Simulator',
    estMonthlySaving: 'Est. Monthly Savings',
    co2Reduced: 'Total CO₂ Offset',
    treesUnit: 'Trees',

    // In-page Desktop Selector
    tabSummary: '⚡ Cockpit & Summary',
    tabCurve: '📈 24h Dyno Curve',
    tabBilling: '🧾 PEA Bill & Stats',
    tabAll: '📑 View All'
  }
};

const LanguageContext = createContext({
  lang: 'th',
  setLang: () => {},
  toggleLang: () => {},
  t: (key) => key
});

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem('AOB_LANG');
      if (saved === 'en' || saved === 'th') return saved;
    } catch {
      // ignore
    }
    return 'th'; // Default to Thai
  });

  const setLang = (nextLang) => {
    const safeLang = nextLang === 'en' ? 'en' : 'th';
    setLangState(safeLang);
    try {
      localStorage.setItem('AOB_LANG', safeLang);
    } catch {
      // ignore
    }
  };

  const toggleLang = () => {
    setLang(lang === 'th' ? 'en' : 'th');
  };

  const t = (key, params = {}) => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.th;
    let text = dict[key] ?? TRANSLATIONS.th[key] ?? key;
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
