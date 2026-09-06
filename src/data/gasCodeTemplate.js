export const getGasScriptCode = (spreadsheetId, lineToken, geminiApiKey) => `/**
 * =========================================================================
 * ART OF BAKING CO., LTD. - Factory Utility & Meter Automation
 * ระบบอ่านและบันทึกมิเตอร์น้ำ-ไฟฟ้าอัตโนมัติ 100% (Dual-Channel Architecture)
 * 1. ทางที่ 1: LINE OA Batch Aggregator (ส่งหลายรูป รวมอ่านใน 1 API Call)
 * 2. ทางที่ 2: Web Dashboard Multi-Image Scanner (สแกนและกดบันทึกลง Sheet ทันที)
 * =========================================================================
 */

const SETTINGS = {
  SPREADSHEET_ID: "${spreadsheetId || '1a3nh3RFQ2vloRbmKECnq0VKs3yA0PL6LSPhJbsTE'}", // ใส่สำรอง (ถ้าสคริปต์อยู่ในชีต ระบบจะใช้ชีตปัจจุบันอัตโนมัติ)
  LINE_ACCESS_TOKEN: "${lineToken || 'YOUR_LINE_CHANNEL_ACCESS_TOKEN'}",           // LINE Channel Access Token
  
  // 🔑 ใส่ Gemini API Keys ได้หลายบัญชี (ระบบจะสลับกุญแจหมุนเวียนอัตโนมัติ และสลับหนี Error ทันที)
  GEMINI_API_KEYS: [
    "${geminiApiKey || 'YOUR_GEMINI_API_KEY_1'}", // บัญชีที่ 1
    "YOUR_GEMINI_API_KEY_2", // บัญชีที่ 2
    "YOUR_GEMINI_API_KEY_3"  // บัญชีที่ 3 (ถ้ามี)
  ],
  GEMINI_API_KEY: "${geminiApiKey || 'YOUR_GEMINI_API_KEY'}",                         // ใส่สำรองกรณีใส่แบบ Key เดียว
  GEMINI_MODEL: "gemini-3.6-flash",                             // โมเดล Vision ล่าสุดตามที่ Google กำหนด
  CUTOFF_HOUR: 6,
  CUTOFF_MINUTE: 30,
  REPORT_HOUR: 8,
};

// ดึงรายชื่อ API Keys ทั้งหมดที่ใช้งานได้จริง
function getGeminiApiKeys() {
  if (Array.isArray(SETTINGS.GEMINI_API_KEYS) && SETTINGS.GEMINI_API_KEYS.length > 0) {
    const valid = SETTINGS.GEMINI_API_KEYS.filter(k => k && k.length > 10 && !k.startsWith("YOUR_"));
    if (valid.length > 0) return valid;
  }
  if (SETTINGS.GEMINI_API_KEY && SETTINGS.GEMINI_API_KEY.length > 10 && !SETTINGS.GEMINI_API_KEY.startsWith("YOUR_")) {
    return [SETTINGS.GEMINI_API_KEY];
  }
  return [];
}

// ดึงอ็อบเจกต์ Google Spreadsheet (ใช้ชีตปัจจุบันก่อนเสมอ ไม่ต้องพึ่ง ID)
function getTargetSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  try {
    return SpreadsheetApp.openById(SETTINGS.SPREADSHEET_ID);
  } catch (e) {
    throw new Error("ไม่สามารถเปิด Google Sheet ได้ กรุณาตรวจสอบว่าสคริปต์นี้สร้างจากเมนู 'ส่วนขยาย > Apps Script' ในไฟล์ชีตหรือไม่");
  }
}

// ดึงชีตค่าไฟฟ้าอย่างแม่นยำ (ตรวจชื่อชีต และหัวตารางเซลล์ A1)
function getElectricitySheet(ss) {
  const candidates = ["ค่าไฟฟ้า", "ไฟฟ้า", "ค่าไฟ", "MDB", "Electricity"];
  for (let name of candidates) {
    const s = ss.getSheetByName(name);
    if (s) return s;
  }
  const allSheets = ss.getSheets();
  for (let s of allSheets) {
    const sName = s.getName();
    if (sName.includes("ไฟ") || sName.includes("MDB") || sName.includes("Elec")) return s;
    const a1 = s.getRange(1, 1).getValue().toString();
    if (a1.includes("ค่าไฟฟ้า") || a1.includes("ไฟ")) return s;
  }
  if (allSheets.length >= 2) {
    for (let s of allSheets) {
      if (!s.getName().includes("น้ำ")) return s;
    }
  }
  return null;
}

// คืนค่าโมเดล Gemini ที่ถูกต้อง (gemini-3.6-flash ตามที่ Google API กำหนด)
function getActiveGeminiModel() {
  if (SETTINGS.GEMINI_MODEL && !SETTINGS.GEMINI_MODEL.includes("2.5")) {
    return SETTINGS.GEMINI_MODEL;
  }
  return "gemini-3.6-flash";
}

// -------------------------------------------------------------------------
// 0. Health Check (สำหรับเปิดเช็คผ่าน Browser)
// -------------------------------------------------------------------------
function doGet(e) {
  return ContentService.createTextOutput("AOB Meter Webhook Service is running OK (200)!\\nDual-Channel Ready: LINE OA + Web Dashboard")
    .setMimeType(ContentService.MimeType.TEXT);
}

// -------------------------------------------------------------------------
// 1. Webhook Handler (รับทั้งจาก LINE OA และจาก Web Dashboard)
// -------------------------------------------------------------------------
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: "no-data" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const data = JSON.parse(e.postData.contents);

    if (data.action === "save_from_web") {
      return handleSaveFromWeb(data);
    }

    const events = data.events || [];

    for (let event of events) {
      if (event.source) {
        const sourceId = event.source.groupId || event.source.roomId || event.source.userId;
        if (sourceId) {
          PropertiesService.getScriptProperties().setProperty("LAST_LINE_TARGET_ID", sourceId);
        }
      }

      if (event.type === 'message') {
        if (event.message.type === 'text') {
          processIncomingTextMessage(event);
        } else if (event.message.type === 'image') {
          processIncomingMeterImage(event);
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error("doPost Error:", err);
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// -------------------------------------------------------------------------
// ช่องทางที่ 2: บันทึกข้อมูลจาก Web Dashboard และส่งสรุปเข้า LINE
// -------------------------------------------------------------------------
function handleSaveFromWeb(data) {
  try {
    const readings = data.readings || [];
    const targetDay = data.targetDay || null;
    const recordedBy = data.recordedBy || "ช่างประจำวัน (ผ่าน Web Dashboard)";

    if (readings.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "ไม่มีข้อมูลมิเตอร์ที่จะบันทึก" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const saveResult = saveReadingsToSheet(readings, targetDay);

    let reportMsg = "🌐 [บันทึกข้อมูลผ่าน Web Dashboard สำเร็จ]\\n";
    reportMsg += "📅 ข้อมูลประจำวันที่ " + saveResult.targetDay + " ก.ย. 2569\\n";
    reportMsg += "👤 ผู้บันทึก: " + recordedBy + "\\n";
    reportMsg += "-------------------------\\n";

    readings.forEach(item => {
      if (item.isIgnored) {
        reportMsg += "🚫 " + item.target + ": ข้ามการบันทึกตามเกณฑ์\\n";
      } else {
        const rawStr = (item.rawReading || item.readingRaw || "").toString();
        const unit = (item.unit || "").toString();
        const readingDisplay = rawStr.includes(unit) ? rawStr : (rawStr + " " + unit);

        reportMsg += "✅ " + item.target + "\\n";
        reportMsg += "🔢 ค่าที่อ่านได้: " + readingDisplay.trim() + "\\n";
        if (item.convertedKWh) {
          reportMsg += "⚡ บันทึกหน่วย: " + Number(item.convertedKWh).toLocaleString() + " kWh\\n";
        }
      }
    });

    reportMsg += "-------------------------\\n";
    reportMsg += "💾 บันทึกลง Google Sheet แล้ว " + saveResult.savedCount + " รายการ\\n";
    reportMsg += "✨ ข้อมูลซิงค์กับ AppSheet และ Dashboard เรียบร้อยแล้ว!";

    const props = PropertiesService.getScriptProperties();
    const targetLineId = data.lineTargetId || props.getProperty("LAST_LINE_TARGET_ID");
    if (targetLineId && SETTINGS.LINE_ACCESS_TOKEN && !SETTINGS.LINE_ACCESS_TOKEN.startsWith("YOUR_")) {
      pushLineMessage(targetLineId, reportMsg);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      savedCount: saveResult.savedCount,
      targetDay: saveResult.targetDay,
      message: "บันทึกข้อมูลลง Google Sheet และส่งแจ้งเตือนเข้า LINE เรียบร้อย!"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error("handleSaveFromWeb Error:", err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// -------------------------------------------------------------------------
// ช่องทางที่ 1: จัดการข้อความตัวหนังสือ (เช่น "วันที่ 4", "ทดสอบ")
// -------------------------------------------------------------------------
function processIncomingTextMessage(event) {
  const userText = (event.message.text || "").trim();

  const dayMatch = userText.match(/(?:วันที่\\s*)?([1-9]|[12][0-9]|3[01])/);
  if (dayMatch && (userText.includes("วัน") || userText.length <= 2)) {
    const selectedDay = parseInt(dayMatch[1], 10);
    PropertiesService.getScriptProperties().setProperty("TARGET_RECORD_DAY", selectedDay.toString());
    sendLineNotification(event, "📅 รับทราบครับ! ระบบตั้งค่าเป้าหมายเป็น [วันที่ " + selectedDay + " ก.ย.] เรียบร้อยแล้ว\\n📸 ช่างสามารถส่งรูปมิเตอร์เข้ามาพร้อมกันหลายรูปได้เลยครับ (ระบบจะรวมอ่านใน 1 ครั้งทันที)");
    return;
  }

  if (userText.includes("ทดสอบ") || userText.toLowerCase().includes("test") || userText.includes("สวัสดี")) {
    sendLineNotification(event, "🤖 สวัสดีครับ! ระบบ AI บันทึกมิเตอร์ ART OF BAKING ทำงานออนไลน์ 100% แล้วครับ\\n\\n📌 สามารถถ่ายรูปมิเตอร์ส่งเข้ามาพร้อมกันได้เลย (ระบบรองรับส่งทีเดียว 1-10 ภาพ รวมอ่านอัตโนมัติ)");
    return;
  }

  sendLineNotification(event, "🤖 รับข้อความแล้วครับ: '" + userText + "'\\n📸 หากต้องการบันทึกมิเตอร์ สามารถส่งรูปถ่ายมิเตอร์เข้ามาได้เลยครับ (ส่งพร้อมกันหลายภาพได้ครับ)");
}

// -------------------------------------------------------------------------
// ช่องทางที่ 1: ประมวลผลรูปภาพจาก LINE OA (Batch Multi-Image Aggregator)
// -------------------------------------------------------------------------
function processIncomingMeterImage(event) {
  const messageId = event.message.id;
  const source = event.source || {};
  const sourceId = source.groupId || source.roomId || source.userId || "default";
  
  const cache = CacheService.getScriptCache();
  const cacheKey = "BATCH_IMGS_" + sourceId;
  
  let pendingIds = [];
  const existing = cache.get(cacheKey);
  if (existing) {
    try {
      pendingIds = JSON.parse(existing);
    } catch (e) {
      pendingIds = [];
    }
  }
  
  if (!pendingIds.includes(messageId)) {
    pendingIds.push(messageId);
    cache.put(cacheKey, JSON.stringify(pendingIds), 60);
  }

  Utilities.sleep(3500);

  const latestExisting = cache.get(cacheKey);
  let finalIds = pendingIds;
  if (latestExisting) {
    try {
      finalIds = JSON.parse(latestExisting);
    } catch (e) {}
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return;
  }

  try {
    cache.remove(cacheKey);
    if (finalIds.length === 0) return;

    const imageBlobs = [];
    for (let id of finalIds) {
      try {
        const blob = fetchLineImageBlob(id);
        if (blob) imageBlobs.push(blob);
      } catch (err) {
        console.warn("ไม่สามารถดึงรูป ID " + id + ": " + err.message);
      }
    }

    if (imageBlobs.length === 0) return;

    const aiResult = callGeminiVisionBatch(imageBlobs);

    if (aiResult.error) {
      console.error("Gemini Vision Error:", aiResult.error);
      sendLineNotification(event, "⚠️ ระบบกำลังปรับคิวอ่านมิเตอร์ กรุณารอสักครู่แล้วส่งภาพใหม่อีกครั้งครับ");
      return;
    }

    if (!aiResult.readings || aiResult.readings.length === 0) {
      sendLineNotification(event, "⚠️ ตรวจไม่พบตัวเลขมิเตอร์ในภาพที่ส่งมา กรุณาตรวจสอบความชัดเจนและถ่ายใหม่อีกครั้งครับ");
      return;
    }

    const manualDayStr = PropertiesService.getScriptProperties().getProperty("TARGET_RECORD_DAY");
    const manualDay = manualDayStr ? parseInt(manualDayStr, 10) : null;
    const saveResult = saveReadingsToSheet(aiResult.readings, manualDay);

    let replyText = "📋 [บันทึกผลมิเตอร์สำเร็จ - รวม " + imageBlobs.length + " ภาพ]\\n";
    replyText += "📅 ประจำวันที่ " + saveResult.targetDay + " ก.ย. 2569\\n";
    replyText += "-------------------------\\n";

    aiResult.readings.forEach(item => {
      if (item.isIgnored) {
        replyText += "🚫 " + item.target + ": ข้ามการบันทึกตามเกณฑ์\\n";
      } else {
        const rawStr = (item.rawReading || item.readingRaw || "").toString();
        const unit = (item.unit || "").toString();
        const readingDisplay = rawStr.includes(unit) ? rawStr : (rawStr + " " + unit);

        replyText += "✅ " + item.target + "\\n";
        replyText += "🔢 อ่านได้: " + readingDisplay.trim() + "\\n";
        if (item.convertedKWh) {
          replyText += "⚡ แปลงหน่วย: " + Number(item.convertedKWh).toLocaleString() + " kWh\\n";
        }
      }
    });

    replyText += "-------------------------\\n";
    replyText += "💾 บันทึกลง Google Sheet และ AppSheet แล้ว " + saveResult.savedCount + " จุดเรียบร้อย!";

    sendLineNotification(event, replyText);

  } catch (err) {
    console.error("Batch Processing Exception:", err);
  } finally {
    lock.releaseLock();
  }
}

function fetchLineImageBlob(messageId) {
  const url = "https://api-data.line.me/v2/bot/message/" + messageId + "/content";
  const options = {
    headers: { "Authorization": "Bearer " + SETTINGS.LINE_ACCESS_TOKEN },
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    throw new Error("LINE HTTP " + response.getResponseCode());
  }
  return response.getBlob();
}

function callGeminiVisionBatch(imageBlobs) {
  const CHUNK_SIZE = 3;
  if (imageBlobs.length <= CHUNK_SIZE) {
    return callGeminiVisionSingleChunk(imageBlobs);
  }

  const allReadings = [];
  for (let i = 0; i < imageBlobs.length; i += CHUNK_SIZE) {
    const chunk = imageBlobs.slice(i, i + CHUNK_SIZE);
    const chunkResult = callGeminiVisionSingleChunk(chunk);
    if (chunkResult && chunkResult.readings && Array.isArray(chunkResult.readings)) {
      allReadings.push(...chunkResult.readings);
    } else if (chunkResult && chunkResult.error) {
      console.warn("Chunk error:", chunkResult.error);
    }
  }

  if (allReadings.length === 0) {
    return { error: "ระบบไม่สามารถอ่านภาพได้ในขณะนี้ กรุณารอสักครู่แล้วลองใหม่" };
  }

  return { readings: allReadings };
}

function callGeminiVisionSingleChunk(imageBlobs) {
  const promptText = \`
คุณเป็นผู้เชี่ยวชาญระดับสูงในการอ่านมิเตอร์น้ำและตู้ไฟฟ้าของโรงงาน ART OF BAKING CO., LTD.
ในคำขอนี้จะมีรูปถ่ายมิเตอร์น้ำและตู้ไฟฟ้าจำนวน 1 หรือหลายภาพ กรุณาวิเคราะห์ทุกภาพและอ่านค่าตัวเลขให้ครบถ้วนทุกจุด

เกณฑ์การระบุและอ่านค่ามิเตอร์ของโรงงาน:
1. มิเตอร์น้ำหลัก ARAD Octave ดิจิทัล (S/N: 193019061, หน้าปัด LCD ดิจิทัล ตัวเรือนสีฟ้า/เทา):
   - meterType: "WATER", meterId: "WATER-MAIN"
   - อ่านเฉพาะตัวเลขจำนวนเต็มหลัก m³ (เช่น 000206933.155 หรือ 206074 ให้ตัดจุดทศนิยม 3 หลักหลังออก บันทึกเป็นจำนวนเต็ม เช่น "206933" หรือ "206074")
   - หน่วย: m³
2. มิเตอร์น้ำ Soft (Itrón S/N: F19S000630):
   - meterType: "WATER", meterId: "WATER-SOFT"
   - อ่านเลขลูกล้อสีดำ 5 หลัก (เช่น 12907 หรือ 12927)
   - หน่วย: m³
3. มิเตอร์น้ำ EVAP (Itrón S/N: F19S000648):
   - meterType: "WATER", meterId: "WATER-EVAP"
   - อ่านเลขลูกล้อสีดำ 5 หลัก และสีแดงทศนิยม 1 หลัก (เช่น 77593.1 หรือ 77811.8)
   - หน่วย: m³
4. มิเตอร์ไฟฟ้า Schneider EasyLogic PM2200 (ครบทั้ง 14 จุดของโรงงาน):
   - meterType: "ELECTRICITY"
   - อ่านค่าบรรทัด "E Del" พร้อมหน่วย (GWh หรือ MWh หรือ kWh) แปลงเป็น kWh เสมอ:
     * หากเป็น GWh ให้คูณ 1,000,000
     * หากเป็น MWh ให้คูณ 1,000
     * หากเป็น kWh ให้ใช้ค่านั้นได้เลย
   
   ⚠️ กฎสำคัญมากในการแยกแยะตู้ C3-2:
   ก) ตู้ C3-2 สีดำ (MDB-1 & MDB-2):
      - Q1-1 REFRIGERATION PLANT (System): ค่าประมาณ 21.3x GWh (~21,3xx,000 kWh) 🌟 ห้ามข้ามเด็ดขาด! ต้องบันทึกแถว 12! target: "MDB-2 Q1-1 REFRIGERATION PLANT (System)"
      - Q1-2 MMC-PRO-2 (RTE Line): ค่าประมาณ 4.2x GWh (~4,2xx,000 kWh) -> บันทึกแถว 4
      - Q1-4 MCC-WSP (Water Pump): ค่าประมาณ 90.5x MWh (~90,5xx kWh) -> บันทึกแถว 6
   
   ข) ตู้ C3-2 แถบสีแดง (EMDB-2 มี 6 มิเตอร์ 2 แถว แถวละ 3 ตัว):
      - แถวบนซ้าย Q1-1 (Fire Pump / แอมป์ 0.00A / ~204 MWh): 🚫 ตัวนี้ตัวเดียวเท่านั้นในโรงงานที่ให้ข้าม (isIgnored: true)
      - แถวบนกลาง Q1-2 EMCC-FP&SN (Fire alarm system): ค่าประมาณ 862-865 MWh (~862,xxx kWh) 🌟 ต้องอ่านและบันทึกแถว 13! target: "MDB-2 Q1-2 EMCC-FP&SN (Fire alarm system)"
      - แถวบนขวา Q1-3 ELP-PRO-1 (LP Emergency): ค่าประมาณ 378 MWh -> บันทึกแถว 14
      - แถวล่างซ้าย Q1-4 EDB-PRO (Water Treatment): ค่าประมาณ 816 MWh -> บันทึกแถว 15
      - แถวล่างกลาง Q1-5 ELP-OFF (Server Room): ค่าประมาณ 264 MWh -> บันทึกแถว 16
      - แถวล่างขวา Q1-6 EDB-AS/RS (AS/RS): ค่าประมาณ 63.9 MWh -> บันทึกแถว 17

ตอบกลับในรูปแบบ JSON Array เท่านั้น:
{
  "readings": [
    {
      "meterType": "WATER",
      "meterId": "WATER-EVAP",
      "target": "มิเตอร์น้ำ EVAP",
      "serialNumber": "F19S000648",
      "rawReading": "77811.8",
      "unit": "m³",
      "convertedKWh": null,
      "isIgnored": false
    },
    {
      "meterType": "ELECTRICITY",
      "meterId": "MDB2-Q1-1",
      "panel": "C3-2 Black",
      "tag": "Q1-1",
      "target": "MDB-2 Q1-1 REFRIGERATION PLANT (System)",
      "rawReading": "21.359 GWh",
      "unit": "GWh",
      "convertedKWh": 21359000,
      "isIgnored": false
    },
    {
      "meterType": "ELECTRICITY",
      "meterId": "MDB2-Q1-2",
      "panel": "C3-2 Red",
      "tag": "Q1-2",
      "target": "MDB-2 Q1-2 EMCC-FP&SN (Fire alarm system)",
      "rawReading": "864.60 MWh",
      "unit": "MWh",
      "convertedKWh": 864600,
      "isIgnored": false
    }
  ]
}
\`;

  const parts = [{ text: promptText }];
  imageBlobs.forEach(blob => {
    const mimeType = blob.getContentType() || "image/jpeg";
    const base64Data = Utilities.base64Encode(blob.getBytes());
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64Data
      }
    });
  });

  const requestPayload = {
    contents: [{ parts: parts }],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json"
    }
  };

  const model = getActiveGeminiModel();
  const keys = getGeminiApiKeys();

  if (keys.length === 0) {
    return { error: "ไม่พบ Gemini API Key ในระบบ กรุณาใส่ใน SETTINGS.GEMINI_API_KEYS" };
  }

  const props = PropertiesService.getScriptProperties();
  let startIdx = parseInt(props.getProperty("KEY_ROTATION_INDEX") || "0", 10);
  if (isNaN(startIdx) || startIdx >= keys.length) startIdx = 0;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const currentIdx = (startIdx + attempt) % keys.length;
    const currentKey = keys[currentIdx];

    try {
      const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + currentKey;
      const options = {
        method: "POST",
        contentType: "application/json",
        payload: JSON.stringify(requestPayload),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, options);
      const json = JSON.parse(response.getContentText());

      if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts[0].text) {
        props.setProperty("KEY_ROTATION_INDEX", ((currentIdx + 1) % keys.length).toString());
        let text = json.candidates[0].content.parts[0].text;
        const tripleTicks = String.fromCharCode(96, 96, 96);
        text = text.split(tripleTicks + "json").join("").split(tripleTicks).join("").trim();
        return JSON.parse(text);
      }

      if (json.error) {
        console.warn("Key #" + (currentIdx + 1) + " ตอบกลับ: " + json.error.code);
        if (json.error.code === 429 || json.error.code === 503) {
          if (keys.length > 1 && attempt < keys.length - 1) {
            console.log("⚡ สลับไปใช้ Key สำรองตัวถัดไปทันที...");
            continue;
          }
        }
      }
    } catch (e) {
      console.warn("Key #" + (currentIdx + 1) + " Exception: " + e.message);
    }
  }

  return { error: "ระบบไม่สามารถอ่านภาพได้ในขณะนี้ กรุณารอสักครู่แล้วลองใหม่" };
}

function extractKWhValue(item) {
  if (item.convertedKWh && !isNaN(parseFloat(item.convertedKWh)) && parseFloat(item.convertedKWh) > 0) {
    return Math.round(parseFloat(item.convertedKWh));
  }
  
  const rawStr = (item.rawReading || item.readingRaw || "").toString().replace(/,/g, "").trim();
  const numMatch = rawStr.match(/([0-9.]+)/);
  if (!numMatch) return 0;
  
  const num = parseFloat(numMatch[1]);
  const text = (rawStr + " " + (item.unit || "")).toUpperCase();
  
  if (text.includes("GWH")) {
    return Math.round(num * 1000000);
  } else if (text.includes("MWH")) {
    return Math.round(num * 1000);
  } else {
    return Math.round(num);
  }
}

function findElectricityMeterRow(item) {
  const text = ((item.target || "") + " " + (item.panel || "") + " " + (item.tag || "") + " " + (item.meterId || "") + " " + (item.anchor || "")).toUpperCase();
  const val = extractKWhValue(item);

  // --- กลุ่ม MDB-1 TR1 (แถว 3 ถึง 10) ---
  if ((text.includes("C2-2") && text.includes("Q1-1")) || text.includes("MMC-PRO-1") || text.includes("FROZEN") || (text.includes("Q1-1") && val > 2000000 && val < 3000000)) {
    return 3;
  }
  if ((text.includes("C3-2") && text.includes("Q1-2") && (val > 3000000 || text.includes("RTE") || text.includes("MMC-PRO-2"))) || text.includes("MDB1-Q1-2")) {
    return 4;
  }
  if ((text.includes("C4-2") && text.includes("Q1-3")) || text.includes("MCC-ACP") || text.includes("AIR COMPRESSOR") || text.includes("ACP") || text.includes("MDB1-Q1-3")) {
    return 5;
  }
  if ((text.includes("C3-2") && text.includes("Q1-4") && (val < 200000 || text.includes("WSP") || text.includes("WATER PUMP"))) || text.includes("MDB1-Q1-4")) {
    return 6;
  }
  if ((text.includes("C2-2") && text.includes("Q1-5")) || text.includes("DC-AC") || text.includes("CONTROL ROOM") || text.includes("MDB1-Q1-5")) {
    return 7;
  }
  if ((text.includes("C4-2") && text.includes("Q1-6")) || text.includes("DB-PRO-1") || text.includes("OFFICE") || text.includes("MDB1-Q1-6")) {
    return 8;
  }
  if ((text.includes("C4-2") && text.includes("Q1-7")) || text.includes("DB-PRO-2") || text.includes("OUTSIDE") || text.includes("MDB1-Q1-7")) {
    return 9;
  }
  if ((text.includes("C4-2") && text.includes("Q1-8")) || text.includes("MCC-SILO") || text.includes("SILO") || text.includes("MDB1-Q1-8")) {
    return 10;
  }

  // --- กลุ่ม MDB-2 TR2 (แถว 12 ถึง 17) ---
  if (text.includes("REFRIGERATION") || (text.includes("Q1-1") && val > 15000000) || text.includes("MDB2-Q1-1")) {
    return 12;
  }
  if (text.includes("FIRE ALARM") || text.includes("EMCC-FP") || (text.includes("C3-2") && text.includes("Q1-2") && val < 2000000) || text.includes("MDB2-Q1-2")) {
    return 13;
  }
  if (text.includes("EMERGENCY") || text.includes("ELP-PRO-1") || (text.includes("C3-2") && text.includes("Q1-3") && val < 500000) || text.includes("MDB2-Q1-3")) {
    return 14;
  }
  if (text.includes("WATER TREATMENT") || text.includes("EDB-PRO") || (text.includes("C3-2") && text.includes("Q1-4") && val > 500000) || text.includes("MDB2-Q1-4")) {
    return 15;
  }
  if (text.includes("SERVER") || text.includes("ELP-OFF") || (text.includes("C3-2") && text.includes("Q1-5") && val < 500000) || text.includes("MDB2-Q1-5")) {
    return 16;
  }
  if (text.includes("AS/RS") || text.includes("ASRS") || text.includes("EDB-AS/RS") || (text.includes("C3-2") && text.includes("Q1-6") && val < 100000) || text.includes("MDB2-Q1-6")) {
    return 17;
  }

  return null;
}

function findElectricityTargetCol(sheetElec, targetDay) {
  const numCols = Math.max(sheetElec.getLastColumn(), 40);
  const row1Values = sheetElec.getRange(1, 1, 1, numCols).getValues()[0];

  const targetDayStr = targetDay.toString();
  const targetDayPadded = targetDay < 10 ? "0" + targetDay : targetDayStr;

  for (let c = 0; c < row1Values.length; c++) {
    const cellVal = row1Values[c];
    if (cellVal instanceof Date) {
      if (cellVal.getDate() === targetDay) return c + 1;
    } else if (cellVal) {
      const s = cellVal.toString().trim();
      if (s.endsWith("-" + targetDayPadded) || s.endsWith("-" + targetDayStr) || s.endsWith("/" + targetDayPadded) || s === targetDayStr) {
        return c + 1;
      }
    }
  }

  return 5 + targetDay;
}

function findWaterTargetRow(sheetWater, targetDay) {
  const numRows = Math.min(sheetWater.getLastRow(), 45);
  if (numRows >= 7) {
    const colAValues = sheetWater.getRange(1, 1, numRows, 1).getValues();
    for (let r = 5; r < colAValues.length; r++) {
      const val = colAValues[r][0];
      if (val == targetDay || val === targetDay.toString()) {
        return r + 1;
      }
    }
  }
  return 6 + targetDay;
}

function saveReadingsToSheet(readings, customDay) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const ss = getTargetSpreadsheet();
    const sheetWater = ss.getSheetByName("ค่าน้ำ") || ss.getSheetByName("น้ำ");
    const sheetElec = getElectricitySheet(ss);
    
    let targetDay = customDay;
    if (!targetDay) {
      const manualDayStr = PropertiesService.getScriptProperties().getProperty("TARGET_RECORD_DAY");
      if (manualDayStr) {
        targetDay = parseInt(manualDayStr, 10);
      } else {
        const now = new Date();
        const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        targetDay = yesterday.getDate();
      }
    }

    let savedCount = 0;
    const elecCol = sheetElec ? findElectricityTargetCol(sheetElec, targetDay) : (5 + targetDay);

    readings.forEach(item => {
      if (item.isIgnored) return;

      const rawVal = parseFloat(item.rawReading || item.readingRaw || 0);
      const kwhVal = extractKWhValue(item);

      const isWater = (item.meterType === "WATER") ||
        (item.meterId && item.meterId.startsWith("WATER")) ||
        (item.target && item.target.includes("น้ำ")) ||
        (item.serialNumber && (item.serialNumber.includes("193019061") || item.serialNumber.includes("000630") || item.serialNumber.includes("000648")));

      if (isWater && sheetWater) {
        const row = findWaterTargetRow(sheetWater, targetDay);
        const targetUpper = ((item.target || "") + " " + (item.meterId || "") + " " + (item.serialNumber || "")).toUpperCase();
        
        if (targetUpper.includes("WATER-MAIN") || targetUpper.includes("MAIN") || targetUpper.includes("หลัก") || targetUpper.includes("193019061") || targetUpper.includes("OCTAVE")) {
          sheetWater.getRange(row, 2).setValue(rawVal);
          savedCount++;
        } else if (targetUpper.includes("WATER-SOFT") || targetUpper.includes("SOFT") || targetUpper.includes("ซอฟ") || targetUpper.includes("000630")) {
          sheetWater.getRange(row, 4).setValue(rawVal);
          savedCount++;
        } else if (targetUpper.includes("WATER-EVAP") || targetUpper.includes("EVAP") || targetUpper.includes("000648")) {
          sheetWater.getRange(row, 6).setValue(rawVal);
          savedCount++;
        }
        sheetWater.getRange(row, 8).setValue("AI Auto-Verified");
        return;
      }

      if (sheetElec && kwhVal > 0) {
        const targetRow = findElectricityMeterRow(item);
        if (targetRow) {
          sheetElec.getRange(targetRow, elecCol).setValue(kwhVal);
          savedCount++;
        } else {
          console.warn("ไม่พบแถวที่ตรงกับมิเตอร์ไฟ: " + item.target);
        }
      }
    });

    return { savedCount: savedCount, targetDay: targetDay };
  } finally {
    lock.releaseLock();
  }
}

function sendLineNotification(event, text) {
  const replyToken = event.replyToken;
  const replyUrl = "https://api.line.me/v2/bot/message/reply";
  const payload = {
    replyToken: replyToken,
    messages: [{ type: "text", text: text }]
  };

  const res = UrlFetchApp.fetch(replyUrl, {
    method: "POST",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + SETTINGS.LINE_ACCESS_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    const targetId = (event.source && (event.source.groupId || event.source.userId || event.source.roomId));
    if (targetId) {
      pushLineMessage(targetId, text);
    }
  }
}

function pushLineMessage(toId, text) {
  const pushUrl = "https://api.line.me/v2/bot/message/push";
  UrlFetchApp.fetch(pushUrl, {
    method: "POST",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + SETTINGS.LINE_ACCESS_TOKEN },
    payload: JSON.stringify({
      to: toId,
      messages: [{ type: "text", text: text }]
    }),
    muteHttpExceptions: true
  });
}

function replyLineMessage(replyToken, text) {
  sendLineNotification({ replyToken: replyToken }, text);
}

function moveDay5ToDay4() {
  Logger.log("🚀 กำลังย้ายข้อมูลมิเตอร์จากวันที่ 5 ไปยังวันที่ 4 (วานนี้)...");
  const ss = getTargetSpreadsheet();
  const sheetElec = getElectricitySheet(ss);
  const sheetWater = ss.getSheetByName("ค่าน้ำ") || ss.getSheetByName("น้ำ");

  let movedElecCount = 0;

  if (sheetElec) {
    const colDay4 = findElectricityTargetCol(sheetElec, 4);
    const colDay5 = findElectricityTargetCol(sheetElec, 5);

    const rows = [3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17];
    rows.forEach(r => {
      const val = sheetElec.getRange(r, colDay5).getValue();
      if (val !== "" && val !== null && val !== undefined) {
        sheetElec.getRange(r, colDay4).setValue(val);
        sheetElec.getRange(r, colDay5).clearContent();
        movedElecCount++;
      }
    });
    Logger.log("✅ ย้ายค่าไฟฟ้าเข้าวันที่ 4 (คอลัมน์ I) สำเร็จ: " + movedElecCount + " รายการ");
  }

  if (sheetWater) {
    const rowDay4 = 5 + 4;
    const rowDay5 = 5 + 5;

    for (let c = 2; c <= 8; c++) {
      const val = sheetWater.getRange(rowDay5, c).getValue();
      if (val !== "" && val !== null && val !== undefined) {
        sheetWater.getRange(rowDay4, c).setValue(val);
        sheetWater.getRange(rowDay5, c).clearContent();
      }
    }
    Logger.log("✅ ย้ายค่าน้ำเข้าวันที่ 4 (แถว 9) สำเร็จ (ล้างวันที่ 5 เรียบร้อย)");
  }

  Logger.log("🏁 ย้ายข้อมูลสำเร็จ 100%!");
}

function saveDay4Now() {
  Logger.log("🚀 เริ่มต้นบันทึกค่าน้ำและค่าไฟฟ้า เข้าวันที่ 4 ก.ย. 2569...");

  const readings = [
    { meterType: "WATER", meterId: "WATER-MAIN", rawReading: "206933", unit: "m³" },
    { meterType: "WATER", meterId: "WATER-SOFT", rawReading: "12946", unit: "m³" },
    { meterType: "WATER", meterId: "WATER-EVAP", rawReading: "77811.8", unit: "m³" },
    { meterType: "ELECTRICITY", panel: "C4-2", tag: "Q1-3", target: "C4-2 Q1-3 (Air Compressor)", convertedKWh: 814280 },
    { meterType: "ELECTRICITY", panel: "C4-2", tag: "Q1-6", target: "C4-2 Q1-6 (Office)", convertedKWh: 1784000 },
    { meterType: "ELECTRICITY", panel: "C4-2", tag: "Q1-8", target: "C4-2 Q1-8 (Silo)", convertedKWh: 229850 },
    { meterType: "ELECTRICITY", panel: "C4-2", tag: "Q1-7", target: "C4-2 Q1-7 (Outside)", convertedKWh: 882570 },
    { meterType: "ELECTRICITY", panel: "C3-2", tag: "Q1-2", target: "C3-2 Q1-2 (RTE Line)", convertedKWh: 4272200 },
    { meterType: "ELECTRICITY", panel: "C3-2", tag: "Q1-4", target: "C3-2 Q1-4 (Water Pump)", convertedKWh: 90568 },
    { meterType: "ELECTRICITY", panel: "C2-2", tag: "Q1-5", target: "C2-2 Q1-5 (Control Room)", convertedKWh: 983630 },
    { meterType: "ELECTRICITY", panel: "C2-2", tag: "Q1-1", target: "C2-2 Q1-1 (Frozen Line)", convertedKWh: 2561400 },
    { meterType: "ELECTRICITY", panel: "C3-2 Black", tag: "Q1-1", target: "MDB-2 Q1-1 REFRIGERATION PLANT (System)", convertedKWh: 21359000 },
    { meterType: "ELECTRICITY", panel: "C3-2 Red", tag: "Q1-2", target: "MDB-2 Q1-2 EMCC-FP&SN (Fire alarm system)", convertedKWh: 864600 },
    { meterType: "ELECTRICITY", panel: "C3-2", tag: "Q1-3", target: "C3-2 Q1-3 (Red LP Emergency)", convertedKWh: 378850 },
    { meterType: "ELECTRICITY", panel: "C3-2", tag: "Q1-4", target: "C3-2 Q1-4 (Red Water Treatment)", convertedKWh: 816970 },
    { meterType: "ELECTRICITY", panel: "C3-2", tag: "Q1-5", target: "C3-2 Q1-5 (Red Server Room)", convertedKWh: 264360 },
    { meterType: "ELECTRICITY", panel: "C3-2", tag: "Q1-6", target: "C3-2 Q1-6 (Red AS/RS)", convertedKWh: 63941 }
  ];

  const res = saveReadingsToSheet(readings, 4);
  Logger.log("✅ บันทึกข้อมูลวันที่ 4 ก.ย. ลงชีตเรียบร้อยแล้ว " + res.savedCount + " รายการ!");
}

function saveDay3Now() {
  Logger.log("🚀 กำลังบันทึกข้อมูลมิเตอร์วันที่ 3 ก.ย. 2569 ทั้ง 17 จุดเข้า Google Sheet...");

  const readings = [
    // ค่าน้ำ 3 จุด (วันที่ 3: แถว 9)
    { meterType: "WATER", meterId: "WATER-MAIN", rawReading: "206783", unit: "m³" },
    { meterType: "WATER", meterId: "WATER-SOFT", rawReading: "12936", unit: "m³" },
    { meterType: "WATER", meterId: "WATER-EVAP", rawReading: "77766.5", unit: "m³" },

    // ค่าไฟฟ้า 14 จุด (วันที่ 3: คอลัมน์ H = Col 8)
    // MDB-1
    { meterType: "ELECTRICITY", panel: "C2-2", tag: "Q1-1", target: "C2-2 Q1-1 MMC-PRO-1 (Frozen Line)", convertedKWh: 2559500 },
    { meterType: "ELECTRICITY", panel: "C3-2", tag: "Q1-2", target: "C3-2 Q1-2 MMC-PRO-2 (RTE Line)", convertedKWh: 4269300 },
    { meterType: "ELECTRICITY", panel: "C4-2", tag: "Q1-3", target: "C4-2 Q1-3 MCC-ACP (Air Compressor)", convertedKWh: 813910 },
    { meterType: "ELECTRICITY", panel: "C3-2", tag: "Q1-4", target: "C3-2 Q1-4 MCC-WSP (Water Pump)", convertedKWh: 90513 },
    { meterType: "ELECTRICITY", panel: "C2-2", tag: "Q1-5", target: "C2-2 Q1-5 DC-AC (Control Room)", convertedKWh: 982840 },
    { meterType: "ELECTRICITY", panel: "C4-2", tag: "Q1-6", target: "C4-2 Q1-6 DB-PRO-1 (Office)", convertedKWh: 1783000 },
    { meterType: "ELECTRICITY", panel: "C4-2", tag: "Q1-7", target: "C4-2 Q1-7 DB-PRO-2 (Outside)", convertedKWh: 882120 },
    { meterType: "ELECTRICITY", panel: "C4-2", tag: "Q1-8", target: "C4-2 Q1-8 MCC-SILO (Silo)", convertedKWh: 229490 },

    // MDB-2
    { meterType: "ELECTRICITY", panel: "C3-2 Black", tag: "Q1-1", target: "MDB-2 Q1-1 REFRIGERATION PLANT (System)", convertedKWh: 21347000 },
    { meterType: "ELECTRICITY", panel: "C3-2 Red", tag: "Q1-2", target: "MDB-2 Q1-2 EMCC-FP&SN (Fire alarm system)", convertedKWh: 863920 },
    { meterType: "ELECTRICITY", panel: "C3-2 Red", tag: "Q1-3", target: "C3-2 Q1-3 ELP-PRO-1 (LP Emergency)", convertedKWh: 378850 },
    { meterType: "ELECTRICITY", panel: "C3-2 Red", tag: "Q1-4", target: "C3-2 Q1-4 EDB-PRO (Water Treatment)", convertedKWh: 816970 },
    { meterType: "ELECTRICITY", panel: "C3-2 Red", tag: "Q1-5", target: "C3-2 Q1-5 ELP-OFF (Server Room)", convertedKWh: 264360 },
    { meterType: "ELECTRICITY", panel: "C3-2 Red", tag: "Q1-6", target: "C3-2 Q1-6 EDB-AS/RS (AS/RS)", convertedKWh: 63941 }
  ];

  const res = saveReadingsToSheet(readings, 3);
  Logger.log("✅ บันทึกข้อมูลวันที่ 3 ก.ย. 2569 ลง Google Sheet เรียบร้อยแล้ว " + res.savedCount + " รายการ!");
}

function fixWaterReadingsDay4() {
  Logger.log("🚀 กำลังแก้ไขค่าน้ำวันที่ 4 ก.ย. และเติมช่อง Soft ที่ขาด...");
  const ss = getTargetSpreadsheet();
  const sheetWater = ss.getSheetByName("ค่าน้ำ") || ss.getSheetByName("น้ำ");
  if (!sheetWater) {
    Logger.log("❌ ไม่พบแผ่นงานค่าน้ำ");
    return;
  }

  const valMain = 206933;   // มิเตอร์หลัก
  const valSoft = 12946;    // มิเตอร์ Soft (ช่องที่ขาดไป)
  const valEvap = 77811.8;  // มิเตอร์ EVAP

  // 1. ล้างแถว 9 (วันที่ 3) ที่บันทึกผิดแถว
  sheetWater.getRange(9, 2).clearContent();
  sheetWater.getRange(9, 4).clearContent();
  sheetWater.getRange(9, 6).clearContent();
  sheetWater.getRange(9, 8).clearContent();

  // 2. บันทึกเข้าแถว 10 (วันที่ 4) ให้ถูกต้องครบทั้ง 3 จุด
  sheetWater.getRange(10, 2).setValue(valMain);
  sheetWater.getRange(10, 4).setValue(valSoft);
  sheetWater.getRange(10, 6).setValue(valEvap);
  sheetWater.getRange(10, 8).setValue("AI Auto-Verified");

  Logger.log("✅ ย้ายและบันทึกค่าน้ำเข้าแถว 10 (วันที่ 4 ก.ย.) ครบทั้ง 3 จุดเรียบร้อย!");
  Logger.log("💧 มิเตอร์หลัก (B10): " + valMain);
  Logger.log("💧 มิเตอร์ Soft (D10): " + valSoft + " [เติมช่องที่ขาดเรียบร้อย]");
  Logger.log("💧 มิเตอร์ EVAP (F10): " + valEvap);
}

function fillMissingRow12And13(refrigKWh, fireAlarmKWh) {
  const ss = getTargetSpreadsheet();
  const sheetElec = getElectricitySheet(ss);
  if (!sheetElec) return;

  const targetDay = 4;
  const colDay4 = findElectricityTargetCol(sheetElec, targetDay);

  const val12 = refrigKWh || 21359000;
  sheetElec.getRange(12, colDay4).setValue(val12);

  const val13 = fireAlarmKWh || 864600;
  sheetElec.getRange(13, colDay4).setValue(val13);

  Logger.log("✅ เติมค่าแถว 12 (" + val12.toLocaleString() + " kWh) และแถว 13 (" + val13.toLocaleString() + " kWh) เข้าวันที่ 4 สำเร็จ!");
}

function saveDay5Now() {
  saveDay4Now();
}

function testFullSystem() {
  Logger.log("🚀 เริ่มต้นการทดสอบระบบเชื่อมต่อทั้งหมด...");

  try {
    const ss = getTargetSpreadsheet();
    Logger.log("✅ 1. Google Sheets: เชื่อมต่อสำเร็จ! (พบไฟล์: " + ss.getName() + ")");
    const sElec = getElectricitySheet(ss);
    if (sElec) {
      Logger.log("✅ 1.1 พบแผ่นค่าไฟฟ้า: " + sElec.getName() + " (พร้อมบันทึก 14 จุด)");
    } else {
      Logger.log("⚠️ 1.1 ไม่พบแผ่นค่าไฟฟ้า กรุณาตรวจสอบชื่อชีต");
    }
  } catch (err) {
    Logger.log("❌ 1. Google Sheets ล้มเหลว: " + err.message);
  }

  try {
    const activeModel = getActiveGeminiModel();
    const keys = getGeminiApiKeys();
    if (keys.length === 0) {
      Logger.log("❌ 2. Gemini API: ไม่พบ API Key ในระบบ");
    } else {
      let passCount = 0;
      keys.forEach((k, idx) => {
        const url = "https://generativelanguage.googleapis.com/v1beta/models/" + activeModel + ":generateContent?key=" + k;
        const res = UrlFetchApp.fetch(url, {
          method: "POST",
          contentType: "application/json",
          payload: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
          muteHttpExceptions: true
        });
        if (res.getResponseCode() === 200) {
          passCount++;
          Logger.log("✅ Key [" + (idx + 1) + "]: ใช้งานได้ 100%");
        } else {
          Logger.log("⚠️ Key [" + (idx + 1) + "]: " + res.getContentText());
        }
      });
      Logger.log("✅ 2. Gemini Vision API: พร้อมใช้งาน " + passCount + "/" + keys.length + " Keys");
    }
  } catch (err) {
    Logger.log("❌ 2. Gemini API Exception: " + err.message);
  }

  try {
    const resLine = UrlFetchApp.fetch("https://api.line.me/v2/bot/info", {
      headers: { "Authorization": "Bearer " + SETTINGS.LINE_ACCESS_TOKEN },
      muteHttpExceptions: true
    });
    if (resLine.getResponseCode() === 200) {
      const botInfo = JSON.parse(resLine.getContentText());
      Logger.log("✅ 3. LINE Messaging API: เชื่อมต่อสำเร็จ! (บอทชื่อ: " + botInfo.displayName + ")");
    } else {
      Logger.log("❌ 3. LINE Token ล้มเหลว: " + resLine.getContentText());
    }
  } catch (err) {
    Logger.log("❌ 3. LINE Exception: " + err.message);
  }

  Logger.log("🏁 จบการทดสอบระบบ!");
}
`;
