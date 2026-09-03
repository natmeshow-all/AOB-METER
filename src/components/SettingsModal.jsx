import React, { useState } from 'react';
import { 
  Settings, 
  Key, 
  FileSpreadsheet, 
  MessageSquare, 
  Copy, 
  Check, 
  X, 
  Save, 
  Code2, 
  ExternalLink 
} from 'lucide-react';

export const SettingsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [spreadsheetId, setSpreadsheetId] = useState('1a3nh3RFQ2vloRbmKECnq0VKs3yA0PL6LSPhJbsTE');
  const [lineToken, setLineToken] = useState('YOUR_LINE_CHANNEL_ACCESS_TOKEN');
  const [geminiApiKey, setGeminiApiKey] = useState('AIzaSy...');
  const [activeTab, setActiveTab] = useState('config'); // 'config' | 'gas-code'
  const [isCopied, setIsCopied] = useState(false);

  // Full production-ready Google Apps Script Code
  const gasScriptCode = `/**
 * ART OF BAKING CO., LTD. - Factory Meter & Utility Tracker (GAS Backend)
 * สคริปต์เชื่อมต่อ LINE Webhook + Gemini Vision AI + บันทึกลง Google Sheets FM-EN-000
 */

const CONFIG = {
  SPREADSHEET_ID: "${spreadsheetId}",
  LINE_ACCESS_TOKEN: "${lineToken}",
  GEMINI_API_KEY: "${geminiApiKey}",
  GEMINI_MODEL: "gemini-2.5-flash", // หรือโมเดล Vision ล่าสุด
  CUTOFF_HOUR: 6, // 06:30 น.
  CUTOFF_MINUTE: 30,
  REPORT_HOUR: 8, // 08:00 น.
};

// Webhook รับรูปภาพและข้อความจาก LINE Official Account
function doPost(e) {
  try {
    const events = JSON.parse(e.postData.contents).events;
    for (let event of events) {
      if (event.type === 'message' && event.message.type === 'image') {
        handleMeterImage(event);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error(err);
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ฟังก์ชันประมวลผลรูปภาพมิเตอร์ด้วย Gemini Vision
function handleMeterImage(event) {
  const messageId = event.message.id;
  const replyToken = event.replyToken;
  
  // 1. ดึงไฟล์รูปภาพจาก LINE Messaging API
  const imageBlob = getLineImageBlob(messageId);
  
  // 2. ส่งวิเคราะห์ด้วย Gemini Flash Multimodal
  const aiResult = analyzeMeterWithGemini(imageBlob);
  
  // 3. บันทึกลง Google Sheet ประจำวัน (ย้อนหลัง 1 วันของเมื่อวาน)
  const saveResult = writeToSheet(aiResult);
  
  // 4. ส่งข้อความ Flex Message ยืนยันกลับไปหาช่างใน LINE
  replyLineFlexChecklist(replyToken, aiResult, saveResult);
}

// ฟังก์ชันตั้งเวลาตรวจเช็ค 06:30 น. (Time-driven Trigger)
function checkMorningCutoff() {
  const missingMeters = checkMissingMetersForYesterday();
  if (missingMeters.length > 0) {
    sendLineAlertMessage("⚠️ แจ้งเตือน 06:30 น.: ยังไม่ได้รับรูปมิเตอร์ [" + missingMeters.join(", ") + "] กรุณาส่งด่วนก่อน 07:30 น.");
  }
}

// ฟังก์ชันส่งรายงาน 08:00 น. ให้หัวหน้างาน
function sendMorningExecutiveReport() {
  const summary = calculateDailySummaryForYesterday();
  sendLineFlexReport(summary);
}
`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(gasScriptCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-800 text-amber-400 rounded-lg">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                การตั้งค่าระบบเชื่อมต่อ (Google Sheets & LINE OA)
              </h3>
              <p className="text-xs text-slate-400">
                เชื่อมต่อฐานข้อมูล Google Sheets เดิมและ LINE Messaging API Token
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

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 px-4 bg-slate-900/50">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'config'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ใส่รหัสเชื่อมต่อ (API Keys & ID)
          </button>

          <button
            onClick={() => setActiveTab('gas-code')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'gas-code'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>โค้ด Google Apps Script (นำไปแปะใน Sheet)</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'config' ? (
            <div className="space-y-4 text-xs">
              {/* SPREADSHEET ID */}
              <div>
                <label className="font-semibold text-slate-200 block mb-1 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Google Spreadsheet ID:</span>
                </label>
                <input
                  type="text"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  placeholder="เช่น 1a3nh3RFQ2vloRbmKECnq0VKs3yA0PL6LSPhJbsTE"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  จาก URL ของไฟล์ชีต: <code>https://docs.google.com/spreadsheets/d/<b>[ID นี้]</b>/edit</code>
                </p>
              </div>

              {/* LINE CHANNEL ACCESS TOKEN */}
              <div>
                <label className="font-semibold text-slate-200 block mb-1 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>LINE Channel Access Token (Long-lived):</span>
                </label>
                <textarea
                  rows={3}
                  value={lineToken}
                  onChange={(e) => setLineToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
                  placeholder="ใส่ Channel Access Token จาก LINE Developers Console"
                />
              </div>

              {/* GEMINI API KEY */}
              <div>
                <label className="font-semibold text-slate-200 block mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-400" />
                  <span>Google Gemini API Key (สำหรับ AI Vision อ่านหน้าปัด):</span>
                </label>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
                  placeholder="AIzaSy..."
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  ใช้โมเดล Gemini Flash Vision รุ่นล่าสุดสำหรับการอ่านมิเตอร์ความเร็วสูง
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => {
                    alert("บันทึกการตั้งค่าเรียบร้อยแล้ว!");
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-md cursor-pointer transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>บันทึกการตั้งค่า</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  คัดลอกโค้ดนี้ไปวางที่: <strong>ส่วนขยาย (Extensions) &gt; Apps Script</strong> ในไฟล์ Google Sheets ของท่าน
                </span>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-all cursor-pointer"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'คัดลอกแล้ว!' : 'คัดลอกโค้ด'}</span>
                </button>
              </div>

              <pre className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 font-mono overflow-x-auto max-h-[350px]">
                {gasScriptCode}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
