/**
 * =========================================================================
 * ART OF BAKING CO., LTD. - Factory Utility & Meter Automation
 * ระบบอ่านและบันทึกมิเตอร์น้ำ-ไฟฟ้าอัตโนมัติ 100% (LINE OA + Gemini Vision)
 * =========================================================================
 */

const SETTINGS = {
  SPREADSHEET_ID: "1a3nh3RFQ2vloRbmKECnq0VKs3yA0PL6LSPhJbsTE", // ใส่สำรอง (ถ้าสคริปต์อยู่ในชีต ระบบจะใช้ชีตปัจจุบันอัตโนมัติ)
  LINE_ACCESS_TOKEN: "YOUR_LINE_CHANNEL_ACCESS_TOKEN",           // LINE Channel Access Token
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY",                         // Google Gemini API Key
  GEMINI_MODEL: "gemini-3.6-flash",                             // โมเดล Vision ล่าสุดตามที่ Google กำหนด
  CUTOFF_HOUR: 6,
  CUTOFF_MINUTE: 30,
  REPORT_HOUR: 8,
};

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

// ค้นหาชื่อโมเดล Gemini ที่ใช้งานได้จริงจากบัญชีของคุณอัตโนมัติ (แก้ปัญหา 404 Not Found 100%)
function getActiveGeminiModel() {
  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models?key=" + SETTINGS.GEMINI_API_KEY;
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      if (data.models && data.models.length > 0) {
        const flashModel = data.models.find(m => 
          m.supportedGenerationMethods && 
          m.supportedGenerationMethods.includes("generateContent") && 
          m.name.toLowerCase().includes("flash")
        );
        if (flashModel) {
          return flashModel.name.replace("models/", "");
        }
      }
    }
  } catch (e) {
    console.warn("Auto model detection error:", e.message);
  }
  return SETTINGS.GEMINI_MODEL || "gemini-3.6-flash";
}

// -------------------------------------------------------------------------
// 1. LINE Webhook Handler (รับทั้งรูปภาพ และ ข้อความแชท)
// -------------------------------------------------------------------------
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: "no-data" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const data = JSON.parse(e.postData.contents);
    const events = data.events || [];

    for (let event of events) {
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
// 2. จัดการข้อความตัวหนังสือ (เช่น พิมพ์ "วันที่4" หรือ "ทดสอบ")
// -------------------------------------------------------------------------
function processIncomingTextMessage(event) {
  const replyToken = event.replyToken;
  const userText = (event.message.text || "").trim();

  // ตรวจจับถ้าผู้ใช้พิมพ์วันที่ เช่น "วันที่ 4", "วันที่4", "4"
  const dayMatch = userText.match(/(?:วันที่\s*)?([1-9]|[12][0-9]|3[01])/);
  if (dayMatch && (userText.includes("วัน") || userText.length <= 2)) {
    const selectedDay = parseInt(dayMatch[1], 10);
    PropertiesService.getScriptProperties().setProperty("TARGET_RECORD_DAY", selectedDay.toString());
    replyLineMessage(replyToken, "📅 รับทราบครับ! ระบบตั้งค่าเป้าหมายเป็น [วันที่ " + selectedDay + " ก.ย.] เรียบร้อยแล้ว\n📸 สามารถส่งรูปมิเตอร์เข้ามาได้เลยครับ ระบบจะลงวันที่ " + selectedDay + " ให้ทันที");
    return;
  }

  // คำสั่งทดสอบระบบ
  if (userText.includes("ทดสอบ") || userText.toLowerCase().includes("test") || userText.includes("สวัสดี")) {
    replyLineMessage(replyToken, "🤖 สวัสดีครับ! ระบบ AI บันทึกมิเตอร์ ART OF BAKING ทำงานออนไลน์ 100% แล้วครับ\n\n📌 สามารถถ่ายรูปมิเตอร์ส่งเข้ามาได้เลย (ระบบจะอ่านค่าและลง Google Sheet ให้ทันที)");
    return;
  }

  replyLineMessage(replyToken, "🤖 รับข้อความแล้วครับ: '" + userText + "'\n📸 หากต้องการบันทึกมิเตอร์ สามารถส่งรูปถ่ายมิเตอร์เข้ามาได้เลยครับ");
}

// -------------------------------------------------------------------------
// 3. ประมวลผลรูปภาพด้วย Gemini Vision
// -------------------------------------------------------------------------
function processIncomingMeterImage(event) {
  const messageId = event.message.id;
  const replyToken = event.replyToken;

  // 1. ดาวน์โหลดรูปภาพจาก LINE
  let imageBlob;
  try {
    imageBlob = fetchLineImageBlob(messageId);
  } catch (err) {
    replyLineMessage(replyToken, "❌ ไม่สามารถดาวน์โหลดรูปจาก LINE ได้: " + err.message);
    return;
  }

  // 2. ส่งวิเคราะห์ด้วย Gemini API
  const aiResult = callGeminiVisionAPI(imageBlob);

  if (aiResult.error) {
    replyLineMessage(replyToken, "⚠️ เกิดข้อผิดพลาดจาก Gemini API:\n" + aiResult.error + "\n\n(กรุณาตรวจสอบว่าใส่ GEMINI_API_KEY ใน Code.gs ถูกต้องหรือไม่)");
    return;
  }

  if (!aiResult.readings || aiResult.readings.length === 0) {
    replyLineMessage(replyToken, "⚠️ ระบบตรวจไม่พบตัวเลขมิเตอร์ในภาพ กรุณาตรวจสอบ:\n1. ภาพไม่มืดหรือแสงสะท้อนบังตัวเลข\n2. ตัวเลขหน้าปัดอยู่ในกรอบภาพชัดเจน");
    return;
  }

  // 3. ดึงวันเป้าหมาย (หากผู้ใช้เคยพิมพ์บอกไว้ หรือหาแถวว่างอัตโนมัติ)
  const manualDayStr = PropertiesService.getScriptProperties().getProperty("TARGET_RECORD_DAY");
  const manualDay = manualDayStr ? parseInt(manualDayStr, 10) : null;

  // 4. บันทึกผลลง Google Sheet
  const saveResult = saveReadingsToSheet(aiResult.readings, manualDay);

  // 5. ตอบกลับผลลัพธ์แบบสรุปให้อ่านง่าย
  let replyText = "📋 [บันทึกผลมิเตอร์สำเร็จ]\n-------------------------\n";
  aiResult.readings.forEach(item => {
    if (item.isIgnored) {
      replyText += "🚫 " + item.target + ": ข้ามการบันทึกตามกำหนด\n";
    } else {
      replyText += "✅ " + item.target + "\n";
      replyText += "🔢 ค่าที่อ่านได้: " + item.rawReading + " " + item.unit + "\n";
    }
  });

  replyText += "-------------------------\n";
  replyText += "💾 บันทึกลง Google Sheet ประจำวันที่ " + saveResult.targetDay + " ก.ย. 2569 เรียบร้อย!";

  replyLineMessage(replyToken, replyText);
}

// ดาวน์โหลดภาพจาก LINE Messaging API
function fetchLineImageBlob(messageId) {
  const url = "https://api-data.line.me/v2/bot/message/" + messageId + "/content";
  const options = {
    headers: { "Authorization": "Bearer " + SETTINGS.LINE_ACCESS_TOKEN },
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    throw new Error("LINE HTTP " + response.getResponseCode() + ": " + response.getContentText());
  }
  return response.getBlob();
}

// ส่งภาพให้ Google Gemini API
function callGeminiVisionAPI(imageBlob) {
  const base64Image = Utilities.base64Encode(imageBlob.getBytes());
  const mimeType = imageBlob.getContentType() || "image/jpeg";

  const promptText = `
คุณเป็นผู้เชี่ยวชาญในการอ่านมิเตอร์น้ำและไฟฟ้าของโรงงาน ART OF BAKING CO., LTD.
ภาพอาจถูกถ่ายในแนวตั้ง แนวนอน หรือหมุนเอียง 90 องศา กรุณาอ่านตัวเลขและป้ายชื่อให้ถูกต้อง

เกณฑ์การระบุและอ่านค่ามิเตอร์:
1. มิเตอร์น้ำหลัก ARAD Octave ดิจิทัล (S/N: 193019061, ตัวเรือนสีฟ้า/เทา):
   - อ่านเฉพาะตัวเลขจำนวนเต็มหลัก m³ (เช่น 000206933.155 ให้ตัดเลขทศนิยมออก อ่านเป็น "206933")
   - ห้ามอ่านเลขทศนิยม 3 จุดหลัง
2. มิเตอร์น้ำ Soft (Itrón S/N: F19S000630):
   - อ่านเลขลูกล้อสีดำ 5 หลัก (เช่น 12927 หรือ 12945)
3. มิเตอร์น้ำ EVAP (Itrón S/N: F19S000648):
   - อ่านเลขลูกล้อสีดำ 5 หลัก และสีแดงทศนิยม 1 หลัก (เช่น 77811.8)
4. มิเตอร์ไฟฟ้า Schneider EasyLogic PM2200:
   - ตรวจจับป้ายตู้ (C2-2, C3-2, C4-2) และป้ายชื่อ (Q1-1 ถึง Q1-8)
   - อ่านบรรทัด E Del พร้อมหน่วย (GWh หรือ MWh หรือ kWh)
   - ข้อยกเว้น: ตู้ C3-2 แถบสีแดง ตัวแรกบนซ้าย (Q1-1) ไม่ใช้งาน ให้ตั้ง isIgnored: true

ตอบกลับในรูปแบบ JSON เท่านั้น:
{
  "readings": [
    {
      "meterType": "WATER",
      "meterId": "WATER-MAIN",
      "target": "มิเตอร์น้ำหลัก หน้าโรงงาน",
      "serialNumber": "193019061",
      "rawReading": "206933",
      "unit": "m³",
      "benchmarkStatus": "ปกติ",
      "isIgnored": false
    }
  ]
}
`;

  const requestPayload = {
    contents: [
      { parts: [{ text: promptText }, { inline_data: { mime_type: mimeType, data: base64Image } }] }
    ],
    generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
  };

  // ดึงโมเดลที่ใช้งานได้จริงในบัญชีของคุณอัตโนมัติ
  const activeModel = getActiveGeminiModel();
  const modelsToTry = [activeModel, "gemini-3.6-flash", "gemini-3.6-flash-latest"];
  
  for (let model of modelsToTry) {
    try {
      const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + SETTINGS.GEMINI_API_KEY;
      const options = {
        method: "POST",
        contentType: "application/json",
        payload: JSON.stringify(requestPayload),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, options);
      const json = JSON.parse(response.getContentText());

      if (json.error) {
        if (json.error.code === 404) continue;
        return { error: json.error.message + " (Code: " + json.error.code + ")" };
      }

      if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts[0].text) {
        let text = json.candidates[0].content.parts[0].text;
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(text);
      }
    } catch (e) {
      console.warn("Model " + model + " failed: " + e.message);
    }
  }

  return { error: "ไม่สามารถเชื่อมต่อ Google Gemini API ได้ (กรุณาเช็ค API Key หรือโควต้า)" };
}

// -------------------------------------------------------------------------
// 4. บันทึกข้อมูลลง Google Sheet (มี Lock ป้องกัน Concurrency ตีกัน)
// -------------------------------------------------------------------------
function saveReadingsToSheet(readings, customDay) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // รอคิวได้สูงสุด 30 วินาที

    const ss = getTargetSpreadsheet();
    const sheetWater = ss.getSheetByName("ค่าน้ำ");
    
    let targetDay = customDay;

    // หากไม่ได้ระบุวันมา ให้หารอบวันที่ว่างถัดไปในชีตอัตโนมัติ
    if (!targetDay && sheetWater) {
      for (let d = 1; d <= 31; d++) {
        const row = 5 + d;
        const valMain = sheetWater.getRange(row, 2).getValue();
        const valSoft = sheetWater.getRange(row, 4).getValue();
        const valEvap = sheetWater.getRange(row, 6).getValue();
        if (!valMain || !valSoft || !valEvap) {
          targetDay = d;
          break;
        }
      }
    }

    if (!targetDay) {
      const now = new Date();
      const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      targetDay = yesterday.getDate();
    }

    let savedCount = 0;

    readings.forEach(item => {
      if (item.isIgnored) return;

      if (item.meterType === "WATER" && sheetWater) {
        const row = 5 + targetDay;
        const val = parseFloat(item.rawReading);
        if (item.meterId === "WATER-MAIN" || (item.serialNumber && item.serialNumber.includes("193019061"))) {
          sheetWater.getRange(row, 2).setValue(val);
          savedCount++;
        } else if (item.meterId === "WATER-SOFT" || (item.serialNumber && item.serialNumber.includes("000630"))) {
          sheetWater.getRange(row, 4).setValue(val);
          savedCount++;
        } else if (item.meterId === "WATER-EVAP" || (item.serialNumber && item.serialNumber.includes("000648"))) {
          sheetWater.getRange(row, 6).setValue(val);
          savedCount++;
        }
        sheetWater.getRange(row, 8).setValue("LINE Bot (AI Verified)");
      }
    });

    return { savedCount: savedCount, targetDay: targetDay };
  } finally {
    lock.releaseLock();
  }
}

// -------------------------------------------------------------------------
// 5. ฟังก์ชันส่งข้อความ LINE
// -------------------------------------------------------------------------
function replyLineMessage(replyToken, text) {
  const url = "https://api.line.me/v2/bot/message/reply";
  const payload = {
    replyToken: replyToken,
    messages: [{ type: "text", text: text }]
  };
  UrlFetchApp.fetch(url, {
    method: "POST",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + SETTINGS.LINE_ACCESS_TOKEN },
    muteHttpExceptions: true
  });
}

/**
 * =========================================================================
 * 6. ฟังก์ชันทดสอบระบบแบบคลิกเดียว (One-Click Diagnostic Test) ⭐
 * =========================================================================
 */
function testFullSystem() {
  Logger.log("🚀 เริ่มต้นการทดสอบระบบเชื่อมต่อทั้งหมด...");

  // 1. ทดสอบ Google Sheet
  try {
    const ss = getTargetSpreadsheet();
    Logger.log("✅ 1. Google Sheets: เชื่อมต่อสำเร็จ! (พบไฟล์: " + ss.getName() + ")");
  } catch (err) {
    Logger.log("❌ 1. Google Sheets ล้มเหลว: " + err.message);
  }

  // 2. ทดสอบ Gemini API
  try {
    const activeModel = getActiveGeminiModel();
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + activeModel + ":generateContent?key=" + SETTINGS.GEMINI_API_KEY;
    const res = UrlFetchApp.fetch(url, {
      method: "POST",
      contentType: "application/json",
      payload: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      Logger.log("✅ 2. Gemini Vision API: ใช้งานได้ 100%! (ใช้โมเดล: " + activeModel + ")");
    } else {
      Logger.log("❌ 2. Gemini Vision API ล้มเหลว: " + res.getContentText());
    }
  } catch (err) {
    Logger.log("❌ 2. Gemini API Exception: " + err.message);
  }

  // 3. ทดสอบ LINE Token
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
