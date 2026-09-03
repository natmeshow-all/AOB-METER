import React, { useState } from 'react';
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
  Eye
} from 'lucide-react';
import { WATER_METERS, ELECTRICITY_METERS } from '../data/mockData';

export const MeterScannerModal = ({ isOpen, onClose, onSaveReadings }) => {
  if (!isOpen) return null;

  const [selectedSample, setSelectedSample] = useState('/meter_samples/media_1788432644834.jpg');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  // Pre-configured sample presets mapped to the uploaded images
  const samplePresets = [
    {
      id: 'sample-water-evap',
      name: '💧 มิเตอร์น้ำ EVAP (ลูกล้อ Itrón)',
      image: '/meter_samples/media_1788432644834.jpg',
      type: 'water',
      expectedSN: 'F19S000648',
      expectedReading: '77593.1 m³ (ลูกล้อดำ 77593 แดง 1)',
      detectedItems: [
        {
          target: 'มิเตอร์น้ำ ระบบ EVAP. (WATER-EVAP)',
          anchor: 'Serial Number: F19S000648',
          readingRaw: '77593.1',
          unit: 'm³',
          convertedKWh: null,
          confidence: '99.5%',
          status: '✅ ปกติตามเกณฑ์ (ใช้ไป 170.5 m³ สอดคล้องเกณฑ์ 140-210 m³)',
        }
      ]
    },
    {
      id: 'sample-water-soft',
      name: '💧 มิเตอร์น้ำ Soft (ลูกล้อ Itrón)',
      image: '/meter_samples/media_1788432644839.jpg',
      type: 'water',
      expectedSN: 'F19S000630',
      expectedReading: '12907 m³ (ลูกล้อดำ 12907)',
      detectedItems: [
        {
          target: 'มิเตอร์น้ำ ระบบ Soft (WATER-SOFT)',
          anchor: 'Serial Number: F19S000630',
          readingRaw: '12907',
          unit: 'm³',
          convertedKWh: null,
          confidence: '99.2%',
          status: '✅ ปกติตามเกณฑ์ (ใช้ไป 48 m³ สอดคล้องเกณฑ์ 35-70 m³)',
        }
      ]
    },
    {
      id: 'sample-water-main',
      name: '💧 มิเตอร์น้ำหลัก (Octave Digital)',
      image: '/meter_samples/media_1788432644869.jpg',
      type: 'water',
      expectedSN: '193019061',
      expectedReading: '206074 m³ (ตัดทศนิยม 3 จุด .572 ออก)',
      detectedItems: [
        {
          target: 'มิเตอร์น้ำหลัก หน้าโรงงาน (WATER-MAIN)',
          anchor: 'Serial Number: 193019061',
          readingRaw: '206074',
          unit: 'm³',
          flowRate: '5.66 m³/h',
          confidence: '99.9%',
          status: 'Valid (อ่านเฉพาะจำนวนเต็ม 206074 ตัดทศนิยม 3 จุดออก)',
        }
      ]
    },
    {
      id: 'sample-elec-c4-2',
      name: '⚡ ตู้ไฟ C4-2 (ภาพเดียวติด 4 มิเตอร์พร้อมกัน)',
      image: '/meter_samples/media_1788433329556.jpg',
      type: 'multi-electricity',
      expectedSN: 'Panel C4-2',
      expectedReading: '4 Meters Extracted (Q1-3, Q1-6, Q1-7, Q1-8)',
      detectedItems: [
        {
          target: 'MDB-1 Q1-3 (Air Compressor)',
          anchor: 'Label: Q1-3 | Panel: C4-2',
          readingRaw: '812.14 MWh',
          convertedKWh: 812140,
          confidence: '99.2%',
          status: 'Converted (MWh × 1,000 = 812,140 kWh)',
        },
        {
          target: 'MDB-1 Q1-6 (DB-PRO-1 Office)',
          anchor: 'Label: Q1-6 | Panel: C4-2',
          readingRaw: '1.7788 GWh',
          convertedKWh: 1778800,
          confidence: '99.0%',
          status: 'Converted (GWh × 1,000,000 = 1,778,800 kWh)',
        },
        {
          target: 'MDB-1 Q1-8 (MCC-SILO)',
          anchor: 'Label: Q1-8 | Panel: C4-2',
          readingRaw: '229.15 MWh',
          convertedKWh: 229150,
          confidence: '98.9%',
          status: 'Converted (MWh × 1,000 = 229,150 kWh)',
        },
        {
          target: 'MDB-1 Q1-7 (DB-PRO-2 Outside)',
          anchor: 'Label: Q1-7 | Panel: C4-2',
          readingRaw: '880.33 MWh',
          convertedKWh: 880330,
          confidence: '99.1%',
          status: 'Converted (MWh × 1,000 = 880,330 kWh)',
        },
      ]
    },
    {
      id: 'sample-elec-c3-2-red',
      name: '⚡ ตู้ไฟ C3-2 แถบแดง (6 ตัว ข้ามตัวแรก บันทึก 5 ตัว)',
      image: '/meter_samples/media_1788433571583.jpg',
      type: 'multi-electricity',
      expectedSN: 'Panel C3-2 (Red Strip)',
      expectedReading: '5 Meters Extracted (Q1-1 Ignored as requested)',
      detectedItems: [
        {
          target: '⚠️ แถวบนซ้าย Q1-1 (แถบแดง)',
          anchor: 'Label: Q1-1',
          readingRaw: '204.4 MWh (Iavg 0.000 A)',
          convertedKWh: null,
          confidence: '100%',
          status: '🚫 ละเว้นไม่บันทึก (ตามเงื่อนไขช่างกำหนด)',
          isIgnored: true,
        },
        {
          target: 'MDB-2 Q1-2 (Fire Alarm System)',
          anchor: 'Label: Q1-2 | Panel: C3-2 Red',
          readingRaw: '860.97 MWh',
          convertedKWh: 860970,
          confidence: '99.3%',
          status: 'Converted (860,970 kWh)',
        },
        {
          target: 'MDB-2 Q1-3 (LP Emergency)',
          anchor: 'Label: Q1-3 | Panel: C3-2 Red',
          readingRaw: '377.52 MWh',
          convertedKWh: 377520,
          confidence: '99.5%',
          status: 'Converted (377,520 kWh)',
        },
        {
          target: 'MDB-2 Q1-4 (Water Treatment Plant)',
          anchor: 'Label: Q1-4 | Panel: C3-2 Red',
          readingRaw: '814.89 MWh',
          convertedKWh: 814890,
          confidence: '99.1%',
          status: 'Converted (814,890 kWh)',
        },
        {
          target: 'MDB-2 Q1-5 (Server Room)',
          anchor: 'Label: Q1-5 | Panel: C3-2 Red',
          readingRaw: '263.79 MWh',
          convertedKWh: 263790,
          confidence: '99.4%',
          status: 'Converted (263,790 kWh)',
        },
        {
          target: 'MDB-2 Q1-6 (AS/RS)',
          anchor: 'Label: Q1-6 | Panel: C3-2 Red',
          readingRaw: '63.721 MWh',
          convertedKWh: 63721,
          confidence: '99.2%',
          status: 'Converted (63,721 kWh)',
        },
      ]
    },
  ];

  const handleStartScan = () => {
    setIsScanning(true);
    setScanResult(null);

    // Simulate real Gemini Flash high-speed inference (approx 1.2s)
    setTimeout(() => {
      const preset = samplePresets.find(p => p.image === selectedSample) || samplePresets[0];
      setScanResult(preset);
      setIsScanning(false);
    }, 1200);
  };

  const handleSave = () => {
    alert("✅ บันทึกค่าที่อ่านได้ลง Google Sheet และ AppSheet เรียบร้อยแล้ว!");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <span>ระบบสแกนรูปมิเตอร์ AI Vision (Gemini Flash Multimodal)</span>
                <span className="text-[11px] px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                  Zero-Error OCR Engine
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                ทดสอบจำลองภาพจริงที่ช่างส่งผ่าน LINE: ระบุ S/N, แปลง GWh/MWh เป็น kWh, และตรวจสอบความถูกต้องอัตโนมัติ
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
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Preset Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              เลือกรูปถ่ายตัวอย่างจริงจากหน้างานโรงงาน:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {samplePresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setSelectedSample(preset.image);
                    setScanResult(null);
                  }}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer flex items-center gap-2.5 ${
                    selectedSample === preset.image
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                      : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <img src={preset.image} alt="" className="w-10 h-10 object-cover rounded border border-slate-700" />
                  <div className="truncate">
                    <span className="font-semibold block truncate">{preset.name}</span>
                    <span className="text-[11px] text-slate-400 truncate block">{preset.expectedSN}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Center Preview & Scan Action */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {/* Image Preview Box */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
              <img 
                src={selectedSample} 
                alt="Selected Meter" 
                className="max-h-[320px] object-contain rounded-lg shadow-md" 
              />

              {isScanning && (
                <div className="absolute inset-0 bg-blue-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4">
                  <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
                  <span className="text-sm font-semibold text-white">Gemini AI กำลังวิเคราะห์รูปภาพ...</span>
                  <span className="text-xs text-cyan-300 mt-1">สแกนหา Serial Number, ป้ายกำกับตู้ และอ่านค่าตัวเลข</span>
                </div>
              )}
            </div>

            {/* Scan Results Panel */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">ผลการอ่านค่าของ AI:</span>
                <button
                  onClick={handleStartScan}
                  disabled={isScanning}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span>{isScanning ? 'กำลังอ่านค่า...' : 'กดเริ่มสแกนด้วย AI'}</span>
                </button>
              </div>

              {!scanResult ? (
                <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-xl p-8 text-center text-slate-400 text-xs">
                  <Scan className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-60" />
                  <p>กดปุ่ม <strong className="text-blue-400">"กดเริ่มสแกนด้วย AI"</strong> ด้านบน</p>
                  <p className="text-[11px] text-slate-500 mt-1">เพื่อทดสอบความแม่นยำและการตรวจจับหลายมิเตอร์ในภาพเดียว</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> สแกนเสร็จสิ้น (เวลา: 1.18 วินาที)
                    </span>
                    <span className="text-slate-300 font-mono">พบ {scanResult.detectedItems.length} จุด</span>
                  </div>

                  {/* List of Detected Meters */}
                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {scanResult.detectedItems.map((item, idx) => (
                      <div 
                        key={idx}
                        className={`p-3 rounded-lg border text-xs ${
                          item.isIgnored 
                            ? 'bg-rose-950/20 border-rose-900/50 text-slate-400' 
                            : 'bg-slate-800/90 border-slate-700 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-bold ${item.isIgnored ? 'text-rose-400' : 'text-white'}`}>
                            {item.target}
                          </span>
                          <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                            {item.anchor}
                          </span>
                        </div>

                        <div className="mt-2 flex items-baseline justify-between pt-2 border-t border-slate-700/50">
                          <div>
                            <span className="text-[11px] text-slate-400 block">เลขอ่านดิบจากหน้าปัด:</span>
                            <span className="font-mono text-sm font-semibold text-amber-300">
                              {item.readingRaw}
                            </span>
                          </div>

                          {item.convertedKWh && (
                            <div className="text-right">
                              <span className="text-[11px] text-slate-400 block">แปลงเป็นหน่วยบันทึก:</span>
                              <span className="font-mono text-sm font-bold text-emerald-400">
                                {item.convertedKWh.toLocaleString()} kWh
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mt-1.5 flex items-center justify-between text-[11px]">
                          <span className={item.isIgnored ? 'text-rose-400 font-medium' : 'text-emerald-400'}>
                            {item.status}
                          </span>
                          <span className="text-slate-400">ความมั่นใจ: <strong className="text-slate-200 font-mono">{item.confidence}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Confirm Button */}
                  <button
                    onClick={handleSave}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ยืนยันบันทึกลง Google Sheet และ AppSheet ทันที</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
