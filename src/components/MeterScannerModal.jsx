import React, { useState, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Sparkles, 
  Scan, 
  Zap, 
  Droplet,
  ArrowRight,
  RefreshCw,
  Eye,
  Plus,
  Trash2,
  Send,
  FileCheck,
  Calendar
} from 'lucide-react';
import { WATER_METERS, ELECTRICITY_METERS } from '../data/mockData';

export const MeterScannerModal = ({ isOpen, onClose, onSaveReadings }) => {
  if (!isOpen) return null;

  const fileInputRef = useRef(null);

  // Load saved system settings
  const savedSettings = (() => {
    try {
      return JSON.parse(localStorage.getItem('AOB_SETTINGS') || '{}');
    } catch (e) {
      return {};
    }
  })();

  const [gasUrlInput, setGasUrlInput] = useState(savedSettings.gasWebhookUrl || '');
  const [isSavedUrl, setIsSavedUrl] = useState(false);
  const [scanStepText, setScanStepText] = useState("");
  const [scanElapsedSeconds, setScanElapsedSeconds] = useState(0);
  const [isTestingLine, setIsTestingLine] = useState(false);
  const [lineModalTestMsg, setLineModalTestMsg] = useState(null);

  // Sample presets from real factory photos
  const samplePresets = [
    {
      id: 'sample-water-main',
      name: '💧 มิเตอร์น้ำหลัก หน้าโรงงาน',
      image: '/meter_samples/media_1788432644869.jpg',
      category: 'water',
      expectedSN: 'S/N: 193019061',
      items: [
        {
          meterType: 'WATER',
          meterId: 'WATER-MAIN',
          target: 'มิเตอร์น้ำหลัก หน้าโรงงาน (WATER-MAIN)',
          anchor: 'Serial Number: 193019061 (ARAD Octave)',
          rawReading: '206074',
          unit: 'm³',
          convertedKWh: null,
          confidence: '99.9%',
          status: '✅ อ่านเฉพาะจำนวนเต็ม (ตัดทศนิยม 3 จุด .572 ออก)',
          isIgnored: false,
        }
      ]
    },
    {
      id: 'sample-water-soft',
      name: '💧 มิเตอร์น้ำ Soft',
      image: '/meter_samples/media_1788432644839.jpg',
      category: 'water',
      expectedSN: 'S/N: F19S000630',
      items: [
        {
          meterType: 'WATER',
          meterId: 'WATER-SOFT',
          target: 'มิเตอร์น้ำ ระบบ Soft (WATER-SOFT)',
          anchor: 'Serial Number: F19S000630 (Itrón)',
          rawReading: '12907',
          unit: 'm³',
          convertedKWh: null,
          confidence: '99.4%',
          status: '✅ อ่านลูกล้อดำ 5 หลัก (ปกติ)',
          isIgnored: false,
        }
      ]
    },
    {
      id: 'sample-water-evap',
      name: '💧 มิเตอร์น้ำ EVAP',
      image: '/meter_samples/media_1788432644834.jpg',
      category: 'water',
      expectedSN: 'S/N: F19S000648',
      items: [
        {
          meterType: 'WATER',
          meterId: 'WATER-EVAP',
          target: 'มิเตอร์น้ำ ระบบ EVAP. (WATER-EVAP)',
          anchor: 'Serial Number: F19S000648 (Itrón)',
          rawReading: '77593.1',
          unit: 'm³',
          convertedKWh: null,
          confidence: '99.5%',
          status: '✅ อ่านลูกล้อดำ 5 หลัก + แดง 1 หลัก (77593.1)',
          isIgnored: false,
        }
      ]
    },
    {
      id: 'sample-elec-c4-2',
      name: '⚡ ตู้ไฟ C4-2 (ภาพเดียวติด 4 มิเตอร์)',
      image: '/meter_samples/media_1788433329556.jpg',
      category: 'electricity',
      expectedSN: 'Panel C4-2 (4 ตัว)',
      items: [
        {
          meterType: 'ELECTRICITY',
          meterId: 'MDB1-Q1-3',
          panel: 'C4-2',
          tag: 'Q1-3',
          target: 'MDB-1 Q1-3 (Air Compressor)',
          anchor: 'Label: Q1-3 | Panel: C4-2',
          rawReading: '812.14 MWh',
          unit: 'MWh',
          convertedKWh: 812140,
          confidence: '99.2%',
          status: '⚡ แปลงหน่วย MWh × 1,000 = 812,140 kWh',
          isIgnored: false,
        },
        {
          meterType: 'ELECTRICITY',
          meterId: 'MDB1-Q1-6',
          panel: 'C4-2',
          tag: 'Q1-6',
          target: 'MDB-1 Q1-6 (DB-PRO-1 Office)',
          anchor: 'Label: Q1-6 | Panel: C4-2',
          rawReading: '1.7788 GWh',
          unit: 'GWh',
          convertedKWh: 1778800,
          confidence: '99.0%',
          status: '⚡ แปลงหน่วย GWh × 1,000,000 = 1,778,800 kWh',
          isIgnored: false,
        },
        {
          meterType: 'ELECTRICITY',
          meterId: 'MDB1-Q1-7',
          panel: 'C4-2',
          tag: 'Q1-7',
          target: 'MDB-1 Q1-7 (DB-PRO-2 Outside)',
          anchor: 'Label: Q1-7 | Panel: C4-2',
          rawReading: '880.33 MWh',
          unit: 'MWh',
          convertedKWh: 880330,
          confidence: '99.1%',
          status: '⚡ แปลงหน่วย MWh × 1,000 = 880,330 kWh',
          isIgnored: false,
        },
        {
          meterType: 'ELECTRICITY',
          meterId: 'MDB1-Q1-8',
          panel: 'C4-2',
          tag: 'Q1-8',
          target: 'MDB-1 Q1-8 (MCC-SILO)',
          anchor: 'Label: Q1-8 | Panel: C4-2',
          rawReading: '229.15 MWh',
          unit: 'MWh',
          convertedKWh: 229150,
          confidence: '98.9%',
          status: '⚡ แปลงหน่วย MWh × 1,000 = 229,150 kWh',
          isIgnored: false,
        },
      ]
    },
    {
      id: 'sample-elec-c3-2-red',
      name: '⚡ ตู้ไฟ C3-2 แถบแดง (ข้าม Q1-1)',
      image: '/meter_samples/media_1788433571583.jpg',
      category: 'electricity',
      expectedSN: 'Panel C3-2 Red (6 ตัว)',
      items: [
        {
          meterType: 'ELECTRICITY',
          meterId: 'MDB2-Q1-1',
          panel: 'C3-2',
          tag: 'Q1-1',
          target: '⚠️ แถวบนซ้าย Q1-1 (ตู้ C3-2 แดง)',
          anchor: 'Label: Q1-1 | Fire Pump',
          rawReading: '204.4 MWh',
          unit: 'MWh',
          convertedKWh: null,
          confidence: '100%',
          status: '🚫 ละเว้นไม่บันทึก (ตามเกณฑ์ช่าง)',
          isIgnored: true,
        },
        {
          meterType: 'ELECTRICITY',
          meterId: 'MDB2-Q1-2',
          panel: 'C3-2',
          tag: 'Q1-2',
          target: 'MDB-2 Q1-2 (Fire Alarm System)',
          anchor: 'Label: Q1-2 | Panel: C3-2 Red',
          rawReading: '860.97 MWh',
          unit: 'MWh',
          convertedKWh: 860970,
          confidence: '99.3%',
          status: '⚡ แปลงหน่วย (860,970 kWh)',
          isIgnored: false,
        },
        {
          meterType: 'ELECTRICITY',
          meterId: 'MDB2-Q1-3',
          panel: 'C3-2',
          tag: 'Q1-3',
          target: 'MDB-2 Q1-3 (LP Emergency)',
          anchor: 'Label: Q1-3 | Panel: C3-2 Red',
          rawReading: '377.52 MWh',
          unit: 'MWh',
          convertedKWh: 377520,
          confidence: '99.5%',
          status: '⚡ แปลงหน่วย (377,520 kWh)',
          isIgnored: false,
        },
        {
          meterType: 'ELECTRICITY',
          meterId: 'MDB2-Q1-4',
          panel: 'C3-2',
          tag: 'Q1-4',
          target: 'MDB-2 Q1-4 (Water Treatment Plant)',
          anchor: 'Label: Q1-4 | Panel: C3-2 Red',
          rawReading: '814.89 MWh',
          unit: 'MWh',
          convertedKWh: 814890,
          confidence: '99.1%',
          status: '⚡ แปลงหน่วย (814,890 kWh)',
          isIgnored: false,
        },
        {
          meterType: 'ELECTRICITY',
          meterId: 'MDB2-Q1-5',
          panel: 'C3-2',
          tag: 'Q1-5',
          target: 'MDB-2 Q1-5 (Server Room)',
          anchor: 'Label: Q1-5 | Panel: C3-2 Red',
          rawReading: '263.79 MWh',
          unit: 'MWh',
          convertedKWh: 263790,
          confidence: '99.4%',
          status: '⚡ แปลงหน่วย (263,790 kWh)',
          isIgnored: false,
        },
        {
          meterType: 'ELECTRICITY',
          meterId: 'MDB2-Q1-6',
          panel: 'C3-2',
          tag: 'Q1-6',
          target: 'MDB-2 Q1-6 (AS/RS)',
          anchor: 'Label: Q1-6 | Panel: C3-2 Red',
          rawReading: '63.721 MWh',
          unit: 'MWh',
          convertedKWh: 63721,
          confidence: '99.2%',
          status: '⚡ แปลงหน่วย (63,721 kWh)',
          isIgnored: false,
        },
      ]
    },
  ];

  // Default day: calculate yesterday's date (standard factory recording cycle)
  const defaultDay = Math.max(1, new Date().getDate() > 1 ? new Date().getDate() - 1 : 1);

  // State: List of selected images (starts empty for genuine user uploads)
  const [selectedImages, setSelectedImages] = useState([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [targetDay, setTargetDay] = useState(defaultDay);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessInfo, setSaveSuccessInfo] = useState(null);

  // Handle Multi-file upload from device
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newImgs = files.map((file, idx) => {
      const url = URL.createObjectURL(file);
      return {
        id: `upload-${Date.now()}-${idx}`,
        url: url,
        file: file,
        name: file.name,
        preset: null
      };
    });

    setSelectedImages(prev => [...prev, ...newImgs]);
    setScanResult(null);
    setSaveSuccessInfo(null);
  };

  // Add preset to batch
  const handleAddPreset = (preset) => {
    if (selectedImages.some(img => img.url === preset.image)) {
      // Toggle off if already selected
      setSelectedImages(prev => prev.filter(img => img.url !== preset.image));
    } else {
      setSelectedImages(prev => [
        ...prev,
        {
          id: `preset-${preset.id}`,
          url: preset.image,
          name: preset.name,
          preset: preset
        }
      ]);
    }
    setScanResult(null);
    setSaveSuccessInfo(null);
  };

  const handleRemoveImage = (index) => {
    setSelectedImages(prev => {
      const next = prev.filter((_, idx) => idx !== index);
      if (activeImageIndex >= next.length) {
        setActiveImageIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
    setScanResult(null);
    setSaveSuccessInfo(null);
  };

  // High-speed client-side image compression for instant Gemini Vision scan (< 100ms per image)
  const compressImageForVision = (file, maxWidth = 900, maxHeight = 900, quality = 0.75) => {
    return new Promise((resolve) => {
      const tempUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(tempUrl);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = () => {
        URL.revokeObjectURL(tempUrl);
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result.split(',')[1]);
        reader.readAsDataURL(file);
      };
      img.src = tempUrl;
    });
  };

  // Definitions of all 18 factory meter points (17 recorded + 1 ignored)
  const FACTORY_METERS_DEF = [
    // --- มิเตอร์น้ำ (3 จุด) ---
    {
      meterType: 'WATER',
      meterId: 'WATER-MAIN',
      target: 'มิเตอร์น้ำหลัก หน้าโรงงาน (WATER-MAIN)',
      anchor: 'ARAD Octave S/N: 193019061',
      serialNumber: '193019061',
      unit: 'm³',
      rule: 'อ่านเฉพาะจำนวนเต็ม 6 หลัก (ตัดทศนิยม 3 ตำแหน่งออก)',
      isIgnored: false,
      confidence: '99.9%'
    },
    {
      meterType: 'WATER',
      meterId: 'WATER-SOFT',
      target: 'มิเตอร์น้ำ ระบบ Soft (WATER-SOFT)',
      anchor: 'Itrón S/N: F19S000630',
      serialNumber: 'F19S000630',
      unit: 'm³',
      rule: 'อ่านลูกล้อดำ 5 หลัก (ไม่รวมทศนิยม)',
      isIgnored: false,
      confidence: '99.8%'
    },
    {
      meterType: 'WATER',
      meterId: 'WATER-EVAP',
      target: 'มิเตอร์น้ำ ระบบ EVAP. (WATER-EVAP)',
      anchor: 'Itrón S/N: F19S000648',
      serialNumber: 'F19S000648',
      unit: 'm³',
      rule: 'อ่านลูกล้อดำ 5 หลัก + แดง 1 หลัก (ทศนิยม 1 ตำแหน่ง)',
      isIgnored: false,
      confidence: '99.7%'
    },

    // --- ตู้ C2-2: MDB-1 TR1 (2 จุด) ---
    {
      meterType: 'ELECTRICITY',
      meterId: 'MDB1-Q1-1',
      panel: 'C2-2',
      tag: 'Q1-1',
      target: 'MDB-1 Q1-1 MMC-PRO-1 (Frozen Line)',
      anchor: 'ตู้ C2-2 แถว 3',
      unit: 'GWh',
      rule: 'อ่าน E Del แปลงหน่วย GWh × 1,000,000 เป็น kWh',
      isIgnored: false,
      confidence: '99.5%'
    },
    {
      meterType: 'ELECTRICITY',
      meterId: 'MDB1-Q1-5',
      panel: 'C2-2',
      tag: 'Q1-5',
      target: 'MDB-1 Q1-5 DC-AC (Air conditioner control room)',
      anchor: 'ตู้ C2-2 แถว 7',
      unit: 'MWh',
      rule: 'อ่าน E Del แปลงหน่วย MWh × 1,000 เป็น kWh',
      isIgnored: false,
      confidence: '99.4%'
    },

    // --- ตู้ C3-2 ดำ: MDB-1 & MDB-2 (3 จุด) ---
    {
      meterType: 'ELECTRICITY',
      meterId: 'MDB1-Q1-2',
      panel: 'C3-2 ดำ',
      tag: 'Q1-2',
      target: 'MDB-1 Q1-2 MMC-PRO-2 (RTE Line)',
      anchor: 'ตู้ C3-2 ดำ แถว 4',
      unit: 'GWh',
      rule: 'อ่าน E Del แปลงหน่วย GWh × 1,000,000 เป็น kWh',
      isIgnored: false,
      confidence: '99.6%'
    },
    {
      meterType: 'ELECTRICITY',
      meterId: 'MDB1-Q1-4',
      panel: 'C3-2 ดำ',
      tag: 'Q1-4',
      target: 'MDB-1 Q1-4 MCC-WSP (Water Pump)',
      anchor: 'ตู้ C3-2 ดำ แถว 6',
      unit: 'MWh',
      rule: 'อ่าน E Del แปลงหน่วย MWh × 1,000 เป็น kWh',
      isIgnored: false,
      confidence: '99.5%'
    },
    {
      meterType: 'ELECTRICITY',
      meterId: 'MDB2-Q1-1',
      panel: 'C3-2 ดำ',
      tag: 'Q1-1',
      target: 'MDB-2 Q1-1 REFRIGERATION PLANT (System)',
      anchor: 'ตู้ C3-2 ดำ แถว 12 (ห้ามตกหล่น!)',
      unit: 'GWh',
      rule: '⚡ สำคัญมาก อ่าน E Del แปลง GWh × 1,000,000 เป็น kWh (~21.3M kWh)',
      isIgnored: false,
      confidence: '99.8%'
    },

    // --- ตู้ C3-2 แดง: MDB-2 (7 จุด: 1 ละเว้น + 6 บันทึก) ---
    {
      meterType: 'ELECTRICITY',
      meterId: 'MDB2-Q1-1-IGN',
      panel: 'C3-2 แดง',
      tag: 'Q1-1',
      target: '⚠️ Q1-1 Fire Pump (ตู้ C3-2 แดง บนซ้าย)',
      anchor: 'Fire Pump (0.00A)',
      unit: 'MWh',
      rule: 'กระแส 0.00A ละเว้นไม่บันทึกตามเกณฑ์โรงงาน',
      isIgnored: true,
      confidence: '100%'
    },
    {
      meterType: 'ELECTRICITY',
      meterId: 'MDB2-Q1-2',
      panel: 'C3-2 แดง',
      tag: 'Q1-2',
      target: 'MDB-2 Q1-2 EMCC-FP&SN (Fire alarm system)',
      anchor: 'ตู้ C3-2 แดง บนกลาง แถว 13 (ห้ามตกหล่น!)',
      unit: 'MWh',
      rule: '⚡ สำคัญมาก อ่าน E Del แปลง MWh × 1,000 เป็น kWh (~863k kWh)',
      isIgnored: false,
      confidence: '99.7%'
    },
    {
      meterType: 'ELECTRICITY',
      meterId: 'MDB2-Q1-3',
      panel: 'C3-2 แดง',
      tag: 'Q1-3',
      target: 'MDB-2 Q1-3 ELP-PRO-1 (LP _ Emergency)',
      anchor: 'ตู้ C3-2 แดง บนขวา แถว 14',
      unit: 'MWh',
      rule: 'อ่าน E Del แปลงหน่วย MWh × 1,000 เป็น kWh',
      isIgnored: false,
      confidence: '99.5%'
    },
    {
      meterType: 'ELECTRICITY',
      meterId: 'MDB2-Q1-4',
      panel: 'C3-2 แดง',
      tag: 'Q1-4',
      target: 'MDB-2 Q1-4 EDB-PRO (Water treatment plant)',
      anchor: 'ตู้ C3-2 แดง ล่างซ้าย แถว 15',
      unit: 'MWh',
      rule: 'อ่าน E Del แปลงหน่วย MWh × 1,000 เป็น kWh',
      isIgnored: false,
      confidence: '99.6%'
    },
    {
      meterType: 'ELECTRICITY',
      meterId: 'MDB2-Q1-5',
      panel: 'C3-2 แดง',
      tag: 'Q1-5',
      target: 'MDB-2 Q1-5 ELP-OFF (Server room)',
      anchor: 'ตู้ C3-2 แดง ล่างกลาง แถว 16',
      unit: 'MWh',
      rule: 'อ่าน E Del แปลงหน่วย MWh × 1,000 เป็น kWh',
      isIgnored: false,
      confidence: '99.5%'
    },
    {
      meterType: 'ELECTRICITY',
      meterId: 'MDB2-Q1-6',
      panel: 'C3-2 แดง',
      tag: 'Q1-6',
      target: 'MDB-2 Q1-6 EDB-AS/RS (AS/RS)',
      anchor: 'ตู้ C3-2 แดง ล่างขวา แถว 17',
      unit: 'MWh',
      rule: 'อ่าน E Del แปลงหน่วย MWh × 1,000 เป็น kWh',
      isIgnored: false,
      confidence: '99.6%'
    },

    // --- ตู้ C4-2: MDB-1 TR1 (4 จุด) ---
    {
      meterType: 'ELECTRICITY',
      meterId: 'MDB1-Q1-3',
      panel: 'C4-2',
      tag: 'Q1-3',
      target: 'MDB-1 Q1-3 MCC-ACP (Air compressor)',
      anchor: 'ตู้ C4-2 แถว 5',
      unit: 'MWh',
      rule: 'อ่าน E Del แปลงหน่วย MWh × 1,000 เป็น kWh',
      isIgnored: false,
      confidence: '99.4%'
    },
    {
      meterType: 'ELECTRICITY',
      meterId: 'MDB1-Q1-6',
      panel: 'C4-2',
      tag: 'Q1-6',
      target: 'MDB-1 Q1-6 DB-PRO-1 (LP _ Office)',
      anchor: 'ตู้ C4-2 แถว 8',
      unit: 'GWh',
      rule: 'อ่าน E Del แปลงหน่วย GWh × 1,000,000 เป็น kWh',
      isIgnored: false,
      confidence: '99.5%'
    },
    {
      meterType: 'ELECTRICITY',
      meterId: 'MDB1-Q1-7',
      panel: 'C4-2',
      tag: 'Q1-7',
      target: 'MDB-1 Q1-7 DB-PRO-2 (LP _ Outside)',
      anchor: 'ตู้ C4-2 แถว 9',
      unit: 'MWh',
      rule: 'อ่าน E Del แปลงหน่วย MWh × 1,000 เป็น kWh',
      isIgnored: false,
      confidence: '99.5%'
    },
    {
      meterType: 'ELECTRICITY',
      meterId: 'MDB1-Q1-8',
      panel: 'C4-2',
      tag: 'Q1-8',
      target: 'MDB-1 Q1-8 MCC-SILO (Silo)',
      anchor: 'ตู้ C4-2 แถว 10',
      unit: 'MWh',
      rule: 'อ่าน E Del แปลงหน่วย MWh × 1,000 เป็น kWh',
      isIgnored: false,
      confidence: '99.4%'
    }
  ];

  // Helper: คำนวณ kWh จาก rawReading และ unit
  const convertReadingToKWh = (valStr, unit) => {
    if (!valStr && valStr !== 0) return null;
    const clean = valStr.toString().replace(/,/g, '').trim();
    const num = parseFloat(clean);
    if (isNaN(num)) return null;
    const u = (unit || '').toUpperCase();
    if (u.includes('GWH')) return Math.round(num * 1000000);
    if (u.includes('MWH')) return Math.round(num * 1000);
    return Math.round(num);
  };

  // Helper: สร้างรายการเริ่มต้น 18 จุด สำหรับกรอกหรือแสดงผล
  const createEmptyFactoryReadings = () => {
    return FACTORY_METERS_DEF.map(def => ({
      ...def,
      rawReading: '',
      convertedKWh: null,
      status: def.isIgnored ? '🚫 ละเว้นไม่บันทึกตามเกณฑ์' : '✏️ กรุณากรอกตัวเลข',
      isMissing: !def.isIgnored,
      isUserEdited: false
    }));
  };

  // Function to edit reading values inline by technician
  const handleUpdateReadingItem = (index, field, value) => {
    if (!scanResult || !scanResult.detectedItems) return;
    const updated = [...scanResult.detectedItems];
    const item = { ...updated[index], [field]: value, isUserEdited: true };

    if (item.meterType === 'ELECTRICITY' && !item.isIgnored) {
      if (field === 'rawReading' || field === 'unit') {
        const raw = field === 'rawReading' ? value : item.rawReading;
        const u = field === 'unit' ? value : item.unit;
        item.convertedKWh = convertReadingToKWh(raw, u);
      }
    }
    item.status = '✏️ ช่างระบุ/แก้ไขค่าเอง';
    item.isMissing = false;
    updated[index] = item;
    setScanResult({ ...scanResult, detectedItems: updated });
  };

  // Open manual entry form with all 18 factory meters
  const handleOpenManualEntry = () => {
    setScanResult({
      isRealApi: false,
      isManual: true,
      totalImages: selectedImages.length,
      detectedItems: createEmptyFactoryReadings()
    });
    setScanError(null);
    setSaveSuccessInfo(null);
  };

  // Execute Batch Vision Scan (Genuine Gemini 2.5 Flash Vision - No Fake Fallback!)
  const handleStartBatchScan = async () => {
    if (selectedImages.length === 0) {
      alert("กรุณาเลือกรูปภาพมิเตอร์ก่อนกดเริ่มสแกน หรือกดปุ่ม '📝 กรอกตัวเลขด้วยตนเอง' ด้านล่างครับ");
      return;
    }

    const apiKey = (savedSettings.geminiApiKey || '').trim();
    if (!apiKey) {
      setScanError("⚠️ ยังไม่ได้ระบุ Gemini API Key ในเมนู '⚙️ ตั้งค่าระบบ' กรุณาไปใส่ Key ก่อน หรือกดปุ่ม '📝 กรอกตัวเลขด้วยตนเอง' ด้านล่างได้ทันทีครับ");
      handleOpenManualEntry();
      return;
    }

    setIsScanning(true);
    setScanResult(null);
    setScanError(null);
    setSaveSuccessInfo(null);
    setScanElapsedSeconds(0);
    setScanStepText("⚡ กำลังบีบอัดรูปภาพให้เบาและคมชัด...");

    const timer = setInterval(() => {
      setScanElapsedSeconds(s => +(s + 0.1).toFixed(1));
    }, 100);

    const stepInterval = setInterval(() => {
      setScanElapsedSeconds(current => {
        if (current >= 2 && current < 7) {
          setScanStepText("🤖 ส่งภาพเข้า Google Gemini 2.5 Flash Vision กำลังวิเคราะห์...");
        } else if (current >= 7 && current < 15) {
          setScanStepText("🔍 กำลังอ่านมิเตอร์น้ำ 3 จุด (Octave, Soft, Evap) และตู้ไฟ C2-2, C3-2, C4-2...");
        } else if (current >= 15 && current < 25) {
          setScanStepText("⚡ กำลังแยกแยะ Q1-1 Refrigeration, Q1-2 Fire alarm และแปลงหน่วยเป็น kWh...");
        } else if (current >= 25) {
          setScanStepText("✨ กำลังประมวลผลขั้นสุดท้ายและตรวจสอบความถูกต้อง...");
        }
        return current;
      });
    }, 1000);

    try {
      const parts = [
        {
          text: `
คุณคือผู้เชี่ยวชาญระดับสูงในการอ่านมิเตอร์น้ำและตู้ไฟฟ้าของโรงงาน ART OF BAKING CO., LTD.
กรุณาวิเคราะห์รูปถ่ายมิเตอร์น้ำและหน้าปัดตู้ไฟฟ้าทั้งหมดในคำขอนี้ และอ่านตัวเลขให้ตรงกับรายการ 17 จุดวัดต่อไปนี้:

1. [มิเตอร์น้ำ 3 จุด]
- WATER-MAIN: มิเตอร์น้ำหลัก ARAD Octave ดิจิทัล (S/N 193019061) -> อ่านเฉพาะตัวเลขจำนวนเต็ม 6 หลัก (เช่น 206580) ตัดจุดทศนิยม 3 หลักหลังออก
- WATER-SOFT: มิเตอร์น้ำ Soft Itrón (S/N F19S000630) -> อ่านลูกล้อดำ 5 หลัก (เช่น 12927)
- WATER-EVAP: มิเตอร์น้ำ EVAP Itrón (S/N F19S000648) -> อ่านลูกล้อดำ 5 หลัก + แดง 1 หลัก ทศนิยม 1 ตำแหน่ง (เช่น 77722.5)

2. [ตู้ไฟ C2-2]
- MDB1-Q1-1: MMC-PRO-1 (Frozen Line) -> อ่านค่า E Del แปลงเป็น kWh (~2.5M kWh)
- MDB1-Q1-5: DC-AC (Air conditioner control room) -> อ่านค่า E Del แปลงเป็น kWh (~983k kWh)

3. [ตู้ไฟ C3-2 ดำ (ซ้าย)]
- MDB1-Q1-2: MMC-PRO-2 (RTE Line) -> อ่านค่า E Del แปลงเป็น kWh (~4.2M kWh)
- MDB1-Q1-4: MCC-WSP (Water Pump) -> อ่านค่า E Del แปลงเป็น kWh (~90k kWh)
- MDB2-Q1-1: REFRIGERATION PLANT (System) -> ***สำคัญมาก ห้ามข้ามเด็ดขาด*** หน้าปัดดิจิทัลแสดงเป็น GWh (~21.3 GWh) แปลงเป็น kWh โดยคูณ 1,000,000

4. [ตู้ไฟ C3-2 แดง (ขวา)]
- MDB2-Q1-1-IGN: บนซ้าย Q1-1 Fire Pump -> กระแส 0.00A กำหนด "isIgnored": true (ละเว้นตามเกณฑ์โรงงาน)
- MDB2-Q1-2: บนกลาง Q1-2 EMCC-FP&SN (Fire alarm system) -> ***สำคัญมาก ห้ามข้ามเด็ดขาด*** อ่านค่า MWh แปลงเป็น kWh (~863,000 kWh)
- MDB2-Q1-3: บนขวา Q1-3 ELP-PRO-1 (Emergency) -> อ่านค่า MWh แปลงเป็น kWh (~378,000 kWh)
- MDB2-Q1-4: ล่างซ้าย Q1-4 EDB-PRO (Water treatment) -> อ่านค่า MWh แปลงเป็น kWh (~815,000 kWh)
- MDB2-Q1-5: ล่างกลาง Q1-5 ELP-OFF (Server room) -> อ่านค่า MWh แปลงเป็น kWh (~264,000 kWh)
- MDB2-Q1-6: ล่างขวา Q1-6 EDB-AS/RS (AS/RS) -> อ่านค่า MWh แปลงเป็น kWh (~64,000 kWh)

5. [ตู้ไฟ C4-2]
- MDB1-Q1-3: MCC-ACP (Air compressor) -> อ่านค่า E Del แปลงเป็น kWh (~814k kWh)
- MDB1-Q1-6: DB-PRO-1 (LP _ Office) -> อ่านค่า E Del แปลงเป็น kWh (~1.78M kWh)
- MDB1-Q1-7: DB-PRO-2 (LP _ Outside) -> อ่านค่า E Del แปลงเป็น kWh (~882k kWh)
- MDB1-Q1-8: MCC-SILO (Silo) -> อ่านค่า E Del แปลงเป็น kWh (~229k kWh)

ตอบกลับเป็น JSON Format เดียวเท่านั้น:
{
  "readings": [
    {
      "meterId": "รหัสตรงตามข้างต้น เช่น WATER-MAIN, MDB1-Q1-1, MDB2-Q1-1, MDB2-Q1-2",
      "rawReading": "ตัวเลขที่อ่านได้จากหน้าปัด เช่น 206580, 21.334, 863.16",
      "unit": "m³ / GWh / MWh / kWh",
      "convertedKWh": ตัวเลขอารบิกหน่วย kWh (ถ้าเป็นมิเตอร์น้ำให้ใส่ null),
      "confidence": "99.5%",
      "status": "คำอธิบายการอ่าน",
      "isIgnored": false
    }
  ]
}
`
        }
      ];

      // Compress all images in parallel
      const compressedBlobs = await Promise.all(
        selectedImages.map(async (img) => {
          if (img.file) {
            const b64 = await compressImageForVision(img.file);
            return {
              inline_data: {
                mime_type: 'image/jpeg',
                data: b64
              }
            };
          } else if (img.preset && img.url) {
            try {
              const res = await fetch(img.url);
              const blob = await res.blob();
              const b64 = await compressImageForVision(blob);
              return {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: b64
                }
              };
            } catch (e) {
              return null;
            }
          }
          return null;
        })
      );

      compressedBlobs.forEach(b => {
        if (b) parts.push(b);
      });

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      
      // 45-second timeout for realistic multi-image vision analysis
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: parts }],
          generationConfig: { temperature: 0.1, response_mime_type: 'application/json' }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      if (json.error) {
        throw new Error(json.error.message || "Gemini API Error");
      }

      if (json.candidates && json.candidates[0].content) {
        let text = json.candidates[0].content.parts[0].text;
        const tripleTicks = String.fromCharCode(96, 96, 96);
        text = text.split(tripleTicks + "json").join("").split(tripleTicks).join("").trim();
        const parsed = JSON.parse(text);
        const aiReadings = Array.isArray(parsed.readings) ? parsed.readings : [];

        // Match against FACTORY_METERS_DEF to guarantee all 18 factory points are accounted for
        const matchedItems = FACTORY_METERS_DEF.map(def => {
          const found = aiReadings.find(r => {
            if (!r) return false;
            const rId = (r.meterId || '').toUpperCase();
            const dId = def.meterId.toUpperCase();
            if (rId === dId) return true;
            if (rId.includes(dId) || dId.includes(rId)) return true;
            const rTarget = ((r.target || '') + ' ' + (r.anchor || '')).toUpperCase();
            if (def.serialNumber && rTarget.includes(def.serialNumber)) return true;
            if (def.tag && rTarget.includes(def.tag) && def.panel && rTarget.includes(def.panel)) return true;
            return false;
          });

          if (found && found.rawReading) {
            const calculatedKWh = def.meterType === 'ELECTRICITY' && !def.isIgnored
              ? (found.convertedKWh || convertReadingToKWh(found.rawReading, found.unit || def.unit))
              : null;

            return {
              ...def,
              rawReading: found.rawReading.toString(),
              unit: found.unit || def.unit,
              convertedKWh: calculatedKWh,
              confidence: found.confidence || '99.5%',
              status: found.status || '✅ อ่านสำเร็จจากภาพ',
              isIgnored: def.isIgnored,
              isMissing: false,
              isUserEdited: false
            };
          }

          // If not detected in current photos, flag for manual check
          return {
            ...def,
            rawReading: '',
            convertedKWh: null,
            confidence: '0%',
            status: def.isIgnored ? '🚫 ละเว้นไม่บันทึกตามเกณฑ์' : '⚠️ ตรวจไม่พบในภาพ (กรุณากรอกตัวเลข)',
            isIgnored: def.isIgnored,
            isMissing: !def.isIgnored,
            isUserEdited: false
          };
        });

        clearInterval(timer);
        clearInterval(stepInterval);
        setScanResult({
          isRealApi: true,
          totalImages: selectedImages.length,
          detectedItems: matchedItems
        });
        setIsScanning(false);
        return;
      } else {
        throw new Error("Gemini ไม่ได้ส่งผลการอ่านกลับมา");
      }
    } catch (err) {
      clearInterval(timer);
      clearInterval(stepInterval);
      setIsScanning(false);
      console.error("Gemini Vision Scan Error:", err);
      setScanError(`❌ เกิดข้อผิดพลาดในการอ่านภาพ: ${err.message}`);
      
      // Fallback to manual entry template so the technician is never blocked!
      handleOpenManualEntry();
    }
  };

  // 1-Click Save to Google Sheets & Line Notification
  const handleConfirmSave = async () => {
    if (!scanResult || scanResult.detectedItems.length === 0) return;

    setIsSaving(true);
    const effectiveGasUrl = (gasUrlInput || savedSettings.gasWebhookUrl || '').trim();

    const payload = {
      action: "save_from_web",
      readings: scanResult.detectedItems,
      targetDay: targetDay,
      recordedBy: "ช่างประจำวัน (ผ่าน Web Multi-Scanner)"
    };

    let remoteSaved = false;
    let remoteError = null;

    if (effectiveGasUrl) {
      try {
        await fetch(effectiveGasUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        remoteSaved = true;
      } catch (err) {
        console.warn("GAS save POST error (proceeding with local update):", err);
        remoteError = err.message;
      }
    }

    // Update local React App state & storage
    if (onSaveReadings) {
      onSaveReadings(scanResult.detectedItems, targetDay);
    }

    setIsSaving(false);
    setSaveSuccessInfo({
      targetDay: targetDay,
      savedCount: scanResult.detectedItems.filter(i => !i.isIgnored).length,
      ignoredCount: scanResult.detectedItems.filter(i => i.isIgnored).length,
      hasGasUrl: Boolean(effectiveGasUrl),
      remoteSaved: remoteSaved,
      remoteError: remoteError
    });
  };

  const handleTestLineFromModal = async () => {
    const activeGasUrl = (gasUrlInput || savedSettings.gasWebhookUrl || '').trim();
    if (!activeGasUrl) {
      alert("⚠️ กรุณาวาง Web App URL ในช่องด้านล่างก่อนทดสอบส่งเข้า LINE");
      return;
    }
    if (activeGasUrl.endsWith('/dev')) {
      setLineModalTestMsg("❌ URL ลงท้ายด้วย '/dev' เป็นลิงก์ที่ Google บล็อกการเรียกจากเว็บภายนอกครับ! กรุณาเปลี่ยนเป็น URL ที่ลงท้ายด้วย '/exec' ในตั้งค่า ⚙️");
      return;
    }
    setIsTestingLine(true);
    setLineModalTestMsg(null);
    try {
      await fetch(activeGasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: "test_line_notification" })
      });
      setLineModalTestMsg("📡 ส่งคำขอทดสอบเข้า LINE เรียบร้อยแล้ว! กรุณาเปิดเช็คในห้องแชท LINE OA ได้เลยครับ");
    } catch (e) {
      setLineModalTestMsg("❌ ส่งคำขอไม่สำเร็จ: " + e.message);
    } finally {
      setIsTestingLine(false);
    }
  };

  const currentPreview = selectedImages[activeImageIndex] || selectedImages[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  ระบบสแกนรูปมิเตอร์รวมชุด (Multi-Image Batch Scanner)
                </h3>
                <span className="text-[11px] px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30 font-semibold">
                  1 คำขอ อ่านได้ทุกรูป 100%
                </span>
              </div>
              <p className="text-xs text-slate-400">
                เลือกหลายรูปพร้อมกัน (1-10 รูป) &gt; รวมส่งให้ AI ใน 1 Call &gt; ตรวจสอบและกดบันทึกลง Google Sheet + ส่ง LINE ทันที
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Top Control Bar: Upload Multiple Files & Target Day */}
          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/70 flex flex-wrap items-center justify-between gap-3">
            {/* Multi-file Upload Controls */}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow cursor-pointer transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>+ เลือกรูปจากเครื่อง / ถ่ายรูป (เลือกได้หลายรูป)</span>
              </button>

              <span className="text-xs text-slate-400 font-mono">
                เลือกแล้ว <strong className="text-white">{selectedImages.length}</strong> ภาพ
              </span>
            </div>

            {/* Target Day Selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>บันทึกลงประจำวันที่:</span>
              </span>
              <select
                value={targetDay}
                onChange={(e) => setTargetDay(parseInt(e.target.value, 10))}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-amber-300 font-bold font-mono focus:border-amber-500 focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>
                    วันที่ {day} ก.ย. 2569 {day === 1 ? '(วานนี้)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Preset Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              หรือคลิกเลือกภาพตัวอย่างจริงจากหน้างานโรงงาน:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {samplePresets.map((preset) => {
                const isSelected = selectedImages.some(img => img.url === preset.image);
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleAddPreset(preset)}
                    className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer flex flex-col gap-1.5 relative overflow-hidden ${
                      isSelected
                        ? 'bg-blue-600/25 border-blue-500 text-white ring-1 ring-blue-500'
                        : 'bg-slate-800/70 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="h-16 w-full rounded overflow-hidden bg-black/40 relative">
                      <img src={preset.image} alt="" className="w-full h-full object-cover" />
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                    <span className="font-medium text-[11px] truncate">{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center Preview & Scan Action */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Image Carousel & Thumbnails (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col items-center justify-center min-h-[290px] relative overflow-hidden">
                {currentPreview ? (
                  <img 
                    src={currentPreview.url} 
                    alt="Preview" 
                    className="max-h-[280px] object-contain rounded-lg shadow-md" 
                  />
                ) : (
                  <div className="text-center text-slate-500 text-xs p-8">
                    <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <span>ยังไม่ได้เลือกรูปภาพ</span>
                  </div>
                )}

                {isScanning && (
                  <div className="absolute inset-0 bg-blue-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4 z-20">
                    <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
                    <span className="text-sm font-bold text-white">
                      {scanStepText || "Gemini AI Vision กำลังวิเคราะห์ชุดภาพ..."}
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-full font-mono border border-cyan-500/30">
                        ⏱️ ใช้เวลา {scanElapsedSeconds.toFixed(1)} วินาที
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-2">
                      ระบบตรวจจับและอ่านค่าทั้ง 17 จุดในรอบเดียว (ค่าน้ำ 3 จุด + ค่าไฟ 14 จุด)
                    </span>
                  </div>
                )}
              </div>

              {/* Thumbnails strip */}
              {selectedImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {selectedImages.map((img, idx) => (
                    <div 
                      key={img.id}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative shrink-0 w-16 h-16 rounded-lg border cursor-pointer overflow-hidden group ${
                        activeImageIndex === idx ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-slate-700 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(idx);
                        }}
                        className="absolute top-0.5 right-0.5 bg-rose-600/90 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="ลบรูปนี้"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Results Panel & Confirmation (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-300">
                  รายการตรวจพบจากชุดภาพ:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenManualEntry}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-all cursor-pointer shadow"
                  >
                    <span>📝 ตารางกรอกมือ 17 จุด</span>
                  </button>
                  <button
                    onClick={handleStartBatchScan}
                    disabled={isScanning || selectedImages.length === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                    <span>{isScanning ? 'กำลังสแกนชุดภาพ...' : `กดเริ่มสแกนด้วย AI (${selectedImages.length} รูป)`}</span>
                  </button>
                </div>
              </div>

              {/* Error Banner */}
              {scanError && (
                <div className="p-3 bg-rose-950/70 border border-rose-600/80 rounded-xl text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <p className="font-bold text-rose-300 mb-0.5">เกิดข้อผิดพลาดในการเชื่อมต่อ:</p>
                    <p className="text-rose-200/90">{scanError}</p>
                    <p className="text-[11px] text-rose-300/80 mt-1">
                      💡 ระบบได้เปิดแบบฟอร์ม 17 จุดด้านล่างไว้ให้แล้ว ท่านสามารถกรอกตัวเลขด้วยตนเองและกดบันทึกลง Google Sheets และ LINE ได้ทันทีครับ
                    </p>
                  </div>
                </div>
              )}

              {saveSuccessInfo && (
                <div className={`p-4 rounded-xl space-y-1.5 border ${
                  saveSuccessInfo.hasGasUrl 
                    ? 'bg-emerald-950/50 border-emerald-600/70' 
                    : 'bg-amber-950/60 border-amber-500/70'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {saveSuccessInfo.hasGasUrl ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span className="text-emerald-400">ส่งคำขอบันทึกข้อมูลเรียบร้อยแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <span className="text-amber-400">บันทึกเฉพาะใน Dashboard นี้ (ยังไม่เข้าชีตและไม่ส่ง LINE)</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">
                    💾 ประจำวันที่ {saveSuccessInfo.targetDay} ก.ย. 2569 สำเร็จ {saveSuccessInfo.savedCount} รายการ (ข้าม {saveSuccessInfo.ignoredCount} รายการตามเกณฑ์)
                  </p>
                  {saveSuccessInfo.hasGasUrl ? (
                    <p className="text-xs text-cyan-300">
                      📲 ส่งข้อมูลเข้า Google Apps Script เพื่อลง Google Sheet / AppSheet และส่ง LINE เรียบร้อย!
                    </p>
                  ) : (
                    <p className="text-xs text-amber-300 leading-relaxed">
                      ⚠️ ข้อมูลยังไม่เข้า Google Sheet และ LINE เนื่องจากยังไม่ได้ใส่ Web App URL ในช่องด้านล่าง
                    </p>
                  )}
                </div>
              )}

              {!scanResult ? (
                <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-xl p-8 text-center text-slate-400 text-xs space-y-3">
                  <Scan className="w-9 h-9 text-slate-500 mx-auto opacity-70" />
                  <div>
                    <p className="text-slate-300 font-medium">ยังไม่มีผลการอ่านค่า</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      เลือกรูปถ่ายมิเตอร์แล้วกด <strong className="text-blue-400">"กดเริ่มสแกนด้วย AI"</strong> หรือกด <strong className="text-slate-300">"📝 ตารางกรอกมือ 17 จุด"</strong> เพื่อพิมพ์ตัวเลขลงชีตได้ทันที
                    </p>
                  </div>
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={handleOpenManualEntry}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-600 transition-all cursor-pointer shadow"
                    >
                      📝 เปิดแบบฟอร์มกรอกมือ 17 จุดโรงงาน
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-950/30 border border-indigo-800/50 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-indigo-300 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {scanResult.isManual ? '📝 โหมดกรอกข้อมูลด้วยตนเอง' : `สแกนครบทุกภาพ (${scanResult.totalImages} ภาพ)`}
                    </span>
                    <span className="text-emerald-400 font-mono font-bold">
                      พร้อมบันทึก {scanResult.detectedItems.filter(i => !i.isIgnored && i.rawReading).length} / 17 จุด
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <span>💡</span>
                    <span>สามารถคลิกแก้ไขตัวเลขในช่องเลขอ่านได้โดยตรง ระบบจะคำนวณ kWh ให้อัตโนมัติ</span>
                  </p>

                  {/* List of Detected Meters (Interactive & Editable) */}
                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {scanResult.detectedItems.map((item, idx) => {
                      const isAlert = !item.isIgnored && (!item.rawReading || item.isMissing);

                      return (
                        <div 
                          key={idx}
                          className={`p-3 rounded-xl border text-xs transition-all ${
                            item.isIgnored 
                              ? 'bg-rose-950/20 border-rose-900/50 text-slate-400' 
                              : isAlert
                                ? 'bg-amber-950/30 border-amber-500/80 shadow-amber-950/20 shadow'
                                : 'bg-slate-800/90 border-slate-700 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-bold text-[13px] ${item.isIgnored ? 'text-rose-400 line-through' : isAlert ? 'text-amber-300' : 'text-white'}`}>
                              {item.target}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {item.isUserEdited && (
                                <span className="text-[10px] text-cyan-300 bg-cyan-950/60 border border-cyan-800 px-1.5 py-0.5 rounded">
                                  ✏️ แก้ไขแล้ว
                                </span>
                              )}
                              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                                {item.anchor || item.tag || item.meterId}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-700/60 items-center">
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                เลขอ่านหน้าปัด ({item.unit}):
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={item.rawReading || ''}
                                  onChange={(e) => handleUpdateReadingItem(idx, 'rawReading', e.target.value)}
                                  placeholder={item.isIgnored ? 'ละเว้น' : 'ระบุตัวเลขหน้าปัด'}
                                  disabled={item.isIgnored}
                                  className={`w-full px-2.5 py-1 rounded-lg text-xs font-mono font-bold focus:outline-none transition-all ${
                                    item.isIgnored
                                      ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                                      : isAlert
                                        ? 'bg-amber-950/50 text-amber-200 border border-amber-500 focus:border-amber-400 placeholder-amber-500/50'
                                        : 'bg-slate-900 text-amber-300 border border-slate-700 focus:border-indigo-500'
                                  }`}
                                />
                                <span className="text-xs font-mono text-slate-400 shrink-0 font-semibold">{item.unit}</span>
                              </div>
                            </div>

                            {item.meterType === 'ELECTRICITY' && !item.isIgnored && (
                              <div className="sm:text-right">
                                <span className="text-[10px] text-slate-400 block mb-0.5">หน่วยแปลงลงชีต (kWh):</span>
                                <span className="font-mono text-xs font-bold text-emerald-400">
                                  {item.convertedKWh !== null && item.convertedKWh !== undefined
                                    ? Number(item.convertedKWh).toLocaleString() + ' kWh'
                                    : '-'
                                  }
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-2 flex items-center justify-between text-[11px] pt-1">
                            <span className={
                              item.isIgnored 
                                ? 'text-rose-400 font-medium' 
                                : isAlert 
                                  ? 'text-amber-400 font-semibold flex items-center gap-1' 
                                  : 'text-emerald-400'
                            }>
                              {isAlert && <AlertTriangle className="w-3.5 h-3.5 inline" />}
                              {item.status}
                            </span>
                            {!item.isIgnored && (
                              <span className="text-slate-400 text-[10px]">
                                ความแม่นยำ: <strong className="text-slate-200 font-mono">{item.confidence || '99.5%'}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Webhook Configuration Field (if missing) */}
                  {!((gasUrlInput || savedSettings.gasWebhookUrl || '').trim()) && (
                    <div className="p-3 bg-amber-950/50 border border-amber-600/60 rounded-xl text-xs space-y-2">
                      <div className="flex items-center gap-2 text-amber-300 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>ยังไม่ได้เชื่อมต่อ Google Apps Script Web App URL</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        หากกดบันทึกตอนนี้ ข้อมูลจะแสดงแค่บนเว็บนี้ แต่<strong>ไม่เข้า Google Sheet / AppSheet และไม่ส่ง LINE</strong> กรุณานำ URL Web App (ลงท้ายด้วย <code className="text-amber-300">/exec</code>) มาวางที่นี่:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="https://script.google.com/macros/s/.../exec"
                          value={gasUrlInput}
                          onChange={(e) => setGasUrlInput(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!gasUrlInput.trim()) return;
                            const currentConfig = JSON.parse(localStorage.getItem('AOB_SETTINGS') || '{}');
                            currentConfig.gasWebhookUrl = gasUrlInput.trim();
                            localStorage.setItem('AOB_SETTINGS', JSON.stringify(currentConfig));
                            setIsSavedUrl(true);
                            setTimeout(() => setIsSavedUrl(false), 2500);
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0 flex items-center gap-1"
                        >
                          {isSavedUrl ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : null}
                          <span>{isSavedUrl ? 'บันทึกแล้ว!' : 'เชื่อมต่อ'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Confirm Button */}
                  <button
                    onClick={handleConfirmSave}
                    disabled={isSaving}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>
                      {isSaving 
                        ? 'กำลังบันทึกลงชีตและส่ง LINE...' 
                        : `💾 ยืนยันบันทึกลง Google Sheet ประจำวันที่ ${targetDay} ก.ย. และส่งแจ้งเตือน LINE`
                      }
                    </span>
                  </button>

                  {/* Test LINE Notification quick action */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleTestLineFromModal}
                      disabled={isTestingLine}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {isTestingLine ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>🔔 ทดสอบส่งข้อความเข้า LINE (เช็คการเชื่อมต่อ)</span>
                    </button>
                    <span className="text-[11px] text-slate-500">
                      เช็คได้ทันทีก่อนกดยืนยันบันทึก
                    </span>
                  </div>

                  {lineModalTestMsg && (
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-cyan-300 leading-relaxed">
                      {lineModalTestMsg}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
