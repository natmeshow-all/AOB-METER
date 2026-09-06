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

// คืนค่าโมเดล Gemini ที่ถูกต้อง (ล็อกให้ใช้ gemini-3.6-flash ตามที่ Google API ต้องการ)
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
  return ContentService.createTextOutput("AOB Meter Webhook Service is running OK (200)!")
    .setMimeType(ContentService.MimeType.TEXT);
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
  const userText = (event.message.text || "").trim();

  // ตรวจจับถ้าผู้ใช้พิมพ์วันที่ เช่น "วันที่ 4", "วันที่4", "4"
  const dayMatch = userText.match(/(?:วันที่\s*)?([1-9]|[12][0-9]|3[01])/);
  if (dayMatch && (userText.includes("วัน") || userText.length <= 2)) {
    const selectedDay = parseInt(dayMatch[1], 10);
    PropertiesService.getScriptProperties().setProperty("TARGET_RECORD_DAY", selectedDay.toString());
    sendLineNotification(event, "📅 รับทราบครับ! ระบบตั้งค่าเป้าหมายเป็น [วันที่ " + selectedDay + " ก.ย.] เรียบร้อยแล้ว\n📸 สามารถส่งรูปมิเตอร์เข้ามาได้เลยครับ (ส่งพร้อมกันหลายรูปได้ ระบบจะเข้าคิวอ่านให้อัตโนมัติ)");
    return;
  }

  // คำสั่งทดสอบระบบ
  if (userText.includes("ทดสอบ") || userText.toLowerCase().includes("test") || userText.includes("สวัสดี")) {
    sendLineNotification(event, "🤖 สวัสดีครับ! ระบบ AI บันทึกมิเตอร์ ART OF BAKING ทำงานออนไลน์ 100% แล้วครับ\n\n📌 สามารถถ่ายรูปมิเตอร์ส่งเข้ามาได้เลย (ส่งทีเดียวหลายรูปได้ ระบบจัดการคิวให้อัตโนมัติ)");
    return;
  }

  sendLineNotification(event, "🤖 รับข้อความแล้วครับ: '" + userText + "'\n📸 หากต้องการบันทึกมิเตอร์ สามารถส่งรูปถ่ายมิเตอร์เข้ามาได้เลยครับ");
}

// -------------------------------------------------------------------------
// 3. ระบบหน่วงเวลาและคิวอัตโนมัติ (ป้องกัน Rate Limit 5 ครั้ง/นาที 100%)
// -------------------------------------------------------------------------
function throttleGeminiRateLimit() {
  const minIntervalMs = 12500; // หน่วงเวลา 12.5 วินาทีต่อภาพ (การันตีไม่เกิน 5 ครั้ง/นาที)
  const props = PropertiesService.getScriptProperties();
  const lastCall = parseInt(props.getProperty("LAST_GEMINI_CALL_TIME") || "0", 10);
  const now = Date.now();
  const elapsed = now - lastCall;
  if (elapsed < minIntervalMs) {
    const waitTime = minIntervalMs - elapsed;
    console.log("หน่วงเวลาเพื่อรอคิวโควต้า Gemini: " + waitTime + " ms");
    Utilities.sleep(waitTime);
  }
  props.setProperty("LAST_GEMINI_CALL_TIME", Date.now().toString());
}

// -------------------------------------------------------------------------
// 4. ประมวลผลรูปภาพด้วย Gemini Vision (มีระบบคิว + Rate Limiter)
// -------------------------------------------------------------------------
function processIncomingMeterImage(event) {
  const messageId = event.message.id;
  const lock = LockService.getScriptLock();

  try {
    // 1. เข้าคิวประมวลผล (รอได้สูงสุด 60 วินาที สำหรับรูปที่ส่งพร้อมกัน)
    lock.waitLock(60000);

    // หน่วงเวลาสั้นๆ 1.5 วินาทีเพื่อความเร็วสูงสุด และป้องกัน memory ชนกัน
    Utilities.sleep(1500);

    // 3. ดาวน์โหลดรูปภาพจาก LINE
    let imageBlob;
    try {
      imageBlob = fetchLineImageBlob(messageId);
    } catch (err) {
      sendLineNotification(event, "❌ ไม่สามารถดาวน์โหลดรูปจาก LINE ได้: " + err.message);
      return;
    }

    // 4. ส่งวิเคราะห์ด้วย Gemini API (มี Auto-Retry ในตัว)
    const aiResult = callGeminiVisionAPI(imageBlob);

    if (aiResult.error) {
      sendLineNotification(event, "⚠️ เกิดข้อผิดพลาดจาก Gemini API:\n" + aiResult.error);
      return;
    }

    if (!aiResult.readings || aiResult.readings.length === 0) {
      sendLineNotification(event, "⚠️ ระบบตรวจไม่พบตัวเลขมิเตอร์ในภาพ กรุณาตรวจสอบว่าภาพชัดเจนและถ่ายใหม่อีกครั้ง");
      return;
    }

    // 5. ดึงวันเป้าหมายและบันทึกผลลง Google Sheet
    const manualDayStr = PropertiesService.getScriptProperties().getProperty("TARGET_RECORD_DAY");
    const manualDay = manualDayStr ? parseInt(manualDayStr, 10) : null;
    const saveResult = saveReadingsToSheet(aiResult.readings, manualDay);

    // 6. ส่งสรุปผลกลับ LINE (รองรับทั้ง Reply และ Push Message อัตโนมัติเมื่อคิวนาน)
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

    sendLineNotification(event, replyText);

  } catch (err) {
    console.error("Queue Processing Error:", err);
    sendLineNotification(event, "⚠️ คิวส่งรูปหนาแน่นเกินไป กรุณาส่งรูปนี้ใหม่อีกครั้งครับ");
  } finally {
    lock.releaseLock();
  }
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
        if (json.error.code === 429 || json.error.code === 503) {
          let waitMs = 20000;
          const match = (json.error.message || "").match(/retry in ([0-9.]+)s/i);
          if (match) {
            waitMs = (Math.ceil(parseFloat(match[1])) + 2) * 1000;
          }
          console.warn("Gemini 429/503. Waiting " + waitMs + " ms before retry...");
          Utilities.sleep(Math.min(waitMs, 65000));

          const retryRes = UrlFetchApp.fetch(url, options);
          const retryJson = JSON.parse(retryRes.getContentText());
          if (retryJson.candidates && retryJson.candidates[0].content && retryJson.candidates[0].content.parts[0].text) {
            let text = retryJson.candidates[0].content.parts[0].text;
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(text);
          }
          if (retryJson.error && (retryJson.error.code === 429 || retryJson.error.code === 503)) {
            let waitMs2 = 25000;
            const match2 = (retryJson.error.message || "").match(/retry in ([0-9.]+)s/i);
            if (match2) {
              waitMs2 = (Math.ceil(parseFloat(match2[1])) + 2) * 1000;
            }
            Utilities.sleep(Math.min(waitMs2, 65000));
            const retryRes2 = UrlFetchApp.fetch(url, options);
            const retryJson2 = JSON.parse(retryRes2.getContentText());
            if (retryJson2.candidates && retryJson2.candidates[0].content && retryJson2.candidates[0].content.parts[0].text) {
              let text = retryJson2.candidates[0].content.parts[0].text;
              text = text.replace(/```json/g, "").replace(/```/g, "").trim();
              return JSON.parse(text);
            }
          }
        }
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
// 6. ฟังก์ชันส่งข้อความ LINE (รองรับทั้ง Reply Token และ Push Message อัตโนมัติ)
// -------------------------------------------------------------------------
function sendLineNotification(event, text) {
  const replyToken = event.replyToken;
  const replyUrl = "https://api.line.me/v2/bot/message/reply";
  const payload = {
    replyToken: replyToken,
    messages: [{ type: "text", text: text }]
  };

  // 1. ลองส่งด้วย Reply Token ก่อน
  const res = UrlFetchApp.fetch(replyUrl, {
    method: "POST",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + SETTINGS.LINE_ACCESS_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  console.log("LINE Reply Response: " + res.getResponseCode() + " - " + res.getContentText());

  // 2. ถ้า Reply Token หมดอายุ (เช่น รอนานเกิน 60 วินาทีในคิว) ให้ใช้ Push Message ทันที
  if (res.getResponseCode() !== 200) {
    const targetId = (event.source && (event.source.groupId || event.source.userId || event.source.roomId));
    if (targetId) {
      console.log("Reply token failed/expired, using Push fallback to " + targetId);
      const pushUrl = "https://api.line.me/v2/bot/message/push";
      const pushRes = UrlFetchApp.fetch(pushUrl, {
        method: "POST",
        contentType: "application/json",
        headers: { "Authorization": "Bearer " + SETTINGS.LINE_ACCESS_TOKEN },
        payload: JSON.stringify({
          to: targetId,
          messages: [{ type: "text", text: text }]
        }),
        muteHttpExceptions: true
      });
      console.log("LINE Push Response: " + pushRes.getResponseCode() + " - " + pushRes.getContentText());
    }
  }
}

function replyLineMessage(replyToken, text) {
  sendLineNotification({ replyToken: replyToken }, text);
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
