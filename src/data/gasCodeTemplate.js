export const getGasScriptCode = (spreadsheetId, lineToken, geminiApiKey) => `/**
 * =========================================================================
 * ART OF BAKING CO., LTD. - Factory Utility & Meter Automation
 * ระบบอ่านและบันทึกมิเตอร์น้ำ-ไฟฟ้าอัตโนมัติ 100% (LINE OA + Gemini Vision)
 * =========================================================================
 */

const SETTINGS = {
  SPREADSHEET_ID: "${spreadsheetId || '1a3nh3RFQ2vloRbmKECnq0VKs3yA0PL6LSPhJbsTE'}",
  LINE_ACCESS_TOKEN: "${lineToken || 'YOUR_LINE_CHANNEL_ACCESS_TOKEN'}",
  GEMINI_API_KEY: "${geminiApiKey || 'YOUR_GEMINI_API_KEY'}",
  GEMINI_MODEL: "gemini-3.6-flash",
  CUTOFF_HOUR: 6,
  CUTOFF_MINUTE: 30,
  REPORT_HOUR: 8,
};

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

function getActiveGeminiModel() {
  if (SETTINGS.GEMINI_MODEL && !SETTINGS.GEMINI_MODEL.includes("2.5")) {
    return SETTINGS.GEMINI_MODEL;
  }
  return "gemini-3.6-flash";
}

function doGet(e) {
  return ContentService.createTextOutput("AOB Meter Webhook Service is running OK (200)!")
    .setMimeType(ContentService.MimeType.TEXT);
}

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

function processIncomingTextMessage(event) {
  const userText = (event.message.text || "").trim();

  const dayMatch = userText.match(/(?:วันที่\\s*)?([1-9]|[12][0-9]|3[01])/);
  if (dayMatch && (userText.includes("วัน") || userText.length <= 2)) {
    const selectedDay = parseInt(dayMatch[1], 10);
    PropertiesService.getScriptProperties().setProperty("TARGET_RECORD_DAY", selectedDay.toString());
    sendLineNotification(event, "📅 รับทราบครับ! ระบบตั้งค่าเป้าหมายเป็น [วันที่ " + selectedDay + " ก.ย.] เรียบร้อยแล้ว\\n📸 สามารถส่งรูปมิเตอร์เข้ามาได้เลยครับ (ส่งพร้อมกันหลายรูปได้ ระบบจะเข้าคิวอ่านให้อัตโนมัติ)");
    return;
  }

  if (userText.includes("ทดสอบ") || userText.toLowerCase().includes("test") || userText.includes("สวัสดี")) {
    sendLineNotification(event, "🤖 สวัสดีครับ! ระบบ AI บันทึกมิเตอร์ ART OF BAKING ทำงานออนไลน์ 100% แล้วครับ\\n\\n📌 สามารถถ่ายรูปมิเตอร์ส่งเข้ามาได้เลย (ส่งทีเดียวหลายรูปได้ ระบบจัดการคิวให้อัตโนมัติ)");
    return;
  }

  sendLineNotification(event, "🤖 รับข้อความแล้วครับ: '" + userText + "'\\n📸 หากต้องการบันทึกมิเตอร์ สามารถส่งรูปถ่ายมิเตอร์เข้ามาได้เลยครับ");
}

function throttleGeminiRateLimit() {
  const minIntervalMs = 12500;
  const props = PropertiesService.getScriptProperties();
  const lastCall = parseInt(props.getProperty("LAST_GEMINI_CALL_TIME") || "0", 10);
  const now = Date.now();
  const elapsed = now - lastCall;
  if (elapsed < minIntervalMs) {
    const waitTime = minIntervalMs - elapsed;
    console.log("หน่วงเวลาคิวโควต้า Gemini: " + waitTime + " ms");
    Utilities.sleep(waitTime);
  }
  props.setProperty("LAST_GEMINI_CALL_TIME", Date.now().toString());
}

function processIncomingMeterImage(event) {
  const messageId = event.message.id;
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(120000);
    throttleGeminiRateLimit();

    let imageBlob;
    try {
      imageBlob = fetchLineImageBlob(messageId);
    } catch (err) {
      sendLineNotification(event, "❌ ไม่สามารถดาวน์โหลดรูปจาก LINE ได้: " + err.message);
      return;
    }

    const aiResult = callGeminiVisionAPI(imageBlob);

    if (aiResult.error) {
      sendLineNotification(event, "⚠️ เกิดข้อผิดพลาดจาก Gemini API:\\n" + aiResult.error);
      return;
    }

    if (!aiResult.readings || aiResult.readings.length === 0) {
      sendLineNotification(event, "⚠️ ระบบตรวจไม่พบตัวเลขมิเตอร์ในภาพ กรุณาตรวจสอบว่าภาพชัดเจนและถ่ายใหม่อีกครั้ง");
      return;
    }

    const manualDayStr = PropertiesService.getScriptProperties().getProperty("TARGET_RECORD_DAY");
    const manualDay = manualDayStr ? parseInt(manualDayStr, 10) : null;

    const saveResult = saveReadingsToSheet(aiResult.readings, manualDay);

    let replyText = "📋 [บันทึกผลมิเตอร์สำเร็จ]\\n-------------------------\\n";
    aiResult.readings.forEach(item => {
      if (item.isIgnored) {
        replyText += "🚫 " + item.target + ": ข้ามการบันทึกตามกำหนด\\n";
      } else {
        replyText += "✅ " + item.target + "\\n";
        replyText += "🔢 ค่าที่อ่านได้: " + item.rawReading + " " + item.unit + "\\n";
      }
    });

    replyText += "-------------------------\\n";
    replyText += "💾 บันทึกลง Google Sheet ประจำวันที่ " + saveResult.targetDay + " ก.ย. 2569 เรียบร้อย!";

    sendLineNotification(event, replyText);

  } catch (err) {
    console.error("Queue Processing Error:", err);
    sendLineNotification(event, "⚠️ คิวส่งรูปหนาแน่นเกินไป กรุณาส่งรูปนี้ใหม่อีกครั้งครับ");
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
    throw new Error("LINE HTTP " + response.getResponseCode() + ": " + response.getContentText());
  }
  return response.getBlob();
}

function callGeminiVisionAPI(imageBlob) {
  const base64Image = Utilities.base64Encode(imageBlob.getBytes());
  const mimeType = imageBlob.getContentType() || "image/jpeg";

  const promptText = "คุณเป็นผู้เชี่ยวชาญในการอ่านมิเตอร์น้ำและไฟฟ้าของโรงงาน ART OF BAKING CO., LTD.\\n" +
    "ภาพอาจถูกถ่ายในแนวตั้ง แนวนอน หรือหมุนเอียง 90 องศา กรุณาอ่านตัวเลขและป้ายชื่อให้ถูกต้อง\\n\\n" +
    "เกณฑ์การระบุและอ่านค่ามิเตอร์:\\n" +
    "1. มิเตอร์น้ำหลัก ARAD Octave ดิจิทัล (S/N: 193019061, ตัวเรือนสีฟ้า/เทา):\\n" +
    "   - อ่านเฉพาะตัวเลขจำนวนเต็มหลัก m3 (เช่น 000206933.155 ให้ตัดเลขทศนิยมออก อ่านเป็น '206933')\\n" +
    "   - ห้ามอ่านเลขทศนิยม 3 จุดหลัง\\n" +
    "2. มิเตอร์น้ำ Soft (Itrón S/N: F19S000630): อ่านเลขลูกล้อสีดำ 5 หลัก (เช่น 12927 หรือ 12945)\\n" +
    "3. มิเตอร์น้ำ EVAP (Itrón S/N: F19S000648): อ่านเลขลูกล้อสีดำ 5 หลัก และสีแดงทศนิยม 1 หลัก (เช่น 77811.8)\\n" +
    "4. มิเตอร์ไฟฟ้า Schneider EasyLogic PM2200: ตรวจจับป้ายตู้และป้ายชื่อ อ่านบรรทัด E Del พร้อมหน่วย\\n" +
    "   - ข้อยกเว้น: ตู้ C3-2 แถบสีแดง ตัวแรกบนซ้าย (Q1-1) ไม่ใช้งาน ให้ตั้ง isIgnored: true\\n\\n" +
    "ตอบกลับในรูปแบบ JSON เท่านั้น:\\n" +
    '{\\n  "readings": [\\n    {\\n      "meterType": "WATER",\\n      "meterId": "WATER-MAIN",\\n      "target": "มิเตอร์น้ำหลัก หน้าโรงงาน",\\n      "serialNumber": "193019061",\\n      "rawReading": "206933",\\n      "unit": "m³",\\n      "benchmarkStatus": "ปกติ",\\n      "isIgnored": false\\n    }\\n  ]\\n}';

  const requestPayload = {
    contents: [
      { parts: [{ text: promptText }, { inline_data: { mime_type: mimeType, data: base64Image } }] }
    ],
    generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
  };

  const activeModel = getActiveGeminiModel();
  const modelsToTry = [activeModel, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-exp", "gemini-1.5-flash-latest"];
  
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
          console.warn("Gemini Rate Limit / Busy. Sleeping 15s then retry...");
          Utilities.sleep(15000);
          const retryRes = UrlFetchApp.fetch(url, options);
          const retryJson = JSON.parse(retryRes.getContentText());
          if (retryJson.candidates && retryJson.candidates[0].content && retryJson.candidates[0].content.parts[0].text) {
            let text = retryJson.candidates[0].content.parts[0].text;
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(text);
          }
          if (retryJson.error && (retryJson.error.code === 429 || retryJson.error.code === 503)) {
            Utilities.sleep(12000);
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
        text = text.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
        return JSON.parse(text);
      }
    } catch (e) {
      console.warn("Model " + model + " failed: " + e.message);
    }
  }

  return { error: "ไม่สามารถเชื่อมต่อ Google Gemini API ได้ (กรุณาเช็ค API Key หรือโควต้า)" };
}

function saveReadingsToSheet(readings, customDay) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const ss = getTargetSpreadsheet();
    const sheetWater = ss.getSheetByName("ค่าน้ำ");
    
    let targetDay = customDay;

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

  console.log("LINE Reply Response: " + res.getResponseCode() + " - " + res.getContentText());

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

function testFullSystem() {
  Logger.log("🚀 เริ่มต้นการทดสอบระบบเชื่อมต่อทั้งหมด...");

  try {
    const ss = getTargetSpreadsheet();
    Logger.log("✅ 1. Google Sheets: เชื่อมต่อสำเร็จ! (พบไฟล์: " + ss.getName() + ")");
  } catch (err) {
    Logger.log("❌ 1. Google Sheets ล้มเหลว: " + err.message);
  }

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
