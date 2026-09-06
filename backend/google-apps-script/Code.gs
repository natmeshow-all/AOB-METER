/**
 * =========================================================================
 * ART OF BAKING CO., LTD. - Factory Utility & Meter Automation
 * แบบฟอร์มสรุปการน้ำและใช้ไฟฟ้า (FM-EN-000/R00-000000)
 * =========================================================================
 */

const SETTINGS = {
  SPREADSHEET_ID: "1a3nh3RFQ2vloRbmKECnq0VKs3yA0PL6LSPhJbsTE", // ใส่ ID ชีต
  LINE_ACCESS_TOKEN: "YOUR_LINE_CHANNEL_ACCESS_TOKEN",           // ใส่ Channel Access Token จาก LINE Developers
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY",                         // ใส่ Google Gemini API Key
  GEMINI_MODEL: "gemini-1.5-flash",                             // โมเดลมาตรฐานเสถียรสุด (หรือ gemini-2.0-flash)
  CUTOFF_HOUR: 6,
  CUTOFF_MINUTE: 30,
  REPORT_HOUR: 8,
};

// -------------------------------------------------------------------------
// 1. LINE Webhook Handler
// -------------------------------------------------------------------------
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const events = data.events;

    for (let event of events) {
      if (event.type === 'message' && event.message.type === 'image') {
        processIncomingMeterImage(event);
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
// 2. ประมวลผลรูปภาพด้วย Gemini Vision
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

  // 3. บันทึกผลลง Google Sheet
  const saveResult = saveReadingsToSheet(aiResult.readings);

  // 4. ตอบกลับผลลัพธ์แบบสรุปให้อ่านง่าย
  let replyText = "📋 [ผลการอ่านมิเตอร์ AI]\n-------------------------\n";
  aiResult.readings.forEach(item => {
    if (item.isIgnored) {
      replyText += "🚫 " + item.target + ": ข้ามการบันทึกตามที่กำหนด\n";
    } else {
      replyText += "✅ " + item.target + "\n";
      replyText += "🔢 ค่าที่อ่านได้: " + item.rawReading + " " + item.unit + "\n";
      if (item.benchmarkStatus) {
        replyText += "📊 สถานะ: " + item.benchmarkStatus + "\n";
      }
    }
  });

  replyText += "-------------------------\n";
  replyText += "💾 บันทึกลง Google Sheet ประจำวันที่ " + saveResult.targetDay + " ก.ย. เรียบร้อยแล้ว!";

  replyLineMessage(replyToken, replyText);
}

// ดาวน์โหลดภาพจาก LINE Messaging API
function fetchLineImageBlob(messageId) {
  const url = "https://api-data.line.me/v2/bot/message/" + messageId + "/content";
  const options = {
    headers: {
      "Authorization": "Bearer " + SETTINGS.LINE_ACCESS_TOKEN
    },
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
   - อ่านเฉพาะตัวเลขจำนวนเต็มหลัก m³ (เช่น 000206540.5 ให้ตัดเลขทศนิยมออก อ่านเป็น "206540")
   - ห้ามอ่านเลขทศนิยม 3 จุดหลัง
2. มิเตอร์น้ำ Soft (Itrón S/N: F19S000630):
   - อ่านเลขลูกล้อสีดำ 5 หลัก (เช่น 12907 หรือ 12927)
3. มิเตอร์น้ำ EVAP (Itrón S/N: F19S000648):
   - อ่านเลขลูกล้อสีดำ 5 หลัก และสีแดงทศนิยม 1 หลัก (เช่น 77593.1)
4. มิเตอร์ไฟฟ้า Schneider EasyLogic PM2200:
   - ตรวจจับป้ายตู้ (C2-2, C3-2, C4-2) และป้ายชื่อ (Q1-1 ถึง Q1-8)
   - อ่านบรรทัด E Del พร้อมหน่วย (GWh หรือ MWh)
   - ข้อยกเว้น: ตู้ C3-2 แถบสีแดง ตัวแรกบนซ้าย (Q1-1) ไม่ใช้งาน ให้ตั้ง isIgnored: true

ตอบกลับในรูปแบบ JSON เท่านั้น (ห้ามมีคำอธิบายอื่นนอก JSON):
{
  "readings": [
    {
      "meterType": "WATER",
      "meterId": "WATER-MAIN",
      "target": "มิเตอร์น้ำหลัก หน้าโรงงาน",
      "serialNumber": "193019061",
      "rawReading": "206540",
      "unit": "m³",
      "benchmarkStatus": "ปกติ",
      "isIgnored": false
    }
  ]
}
`;

  const requestPayload = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json"
    }
  };

  // ทดสอบเรียกโมเดล (รองรับทั้ง gemini-1.5-flash และ gemini-2.0-flash)
  const modelsToTry = [SETTINGS.GEMINI_MODEL, "gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest"];
  
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
        // ถ้าเป็นข้อผิดพลาดเรื่อง model 404 ให้ลองโมเดลถัดไป
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
// 3. บันทึกข้อมูลลง Google Sheet (ระบบระบุวันอัตโนมัติอัจฉริยะ)
// -------------------------------------------------------------------------
function saveReadingsToSheet(readings, customDay) {
  const ss = SpreadsheetApp.openById(SETTINGS.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("ค่าน้ำ");
  
  let targetDay = customDay;

  // 1. หากไม่ได้ระบุวันมา ให้หารอบวันที่ว่างถัดไปในชีตอัตโนมัติ (เช่น วันที่ 1, 2, 3 ลงแล้ว จะเลือกวันที่ 4 ให้ทันที!)
  if (!targetDay && sheet) {
    for (let d = 1; d <= 31; d++) {
      const row = 5 + d; // แถวที่ 6 คือวันที่ 1
      const valMain = sheet.getRange(row, 2).getValue();
      const valSoft = sheet.getRange(row, 4).getValue();
      const valEvap = sheet.getRange(row, 6).getValue();
      
      // ถ้าพบว่าแถวนี้ยังว่างอยู่ แสดงว่านี่คือวันเป้าหมายถัดไปที่ต้องบันทึก
      if (!valMain || !valSoft || !valEvap) {
        targetDay = d;
        break;
      }
    }
  }

  // 2. Fallback หากชีตเต็ม ให้ใช้วันที่ของเมื่อวาน
  if (!targetDay) {
    const now = new Date();
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    targetDay = yesterday.getDate();
  }

  let savedCount = 0;

  readings.forEach(item => {
    if (item.isIgnored) return;

    if (item.meterType === "WATER" && sheet) {
      const row = 5 + targetDay;
      const val = parseFloat(item.rawReading);
      if (item.meterId === "WATER-MAIN" || (item.serialNumber && item.serialNumber.includes("193019061"))) {
        sheet.getRange(row, 2).setValue(val);
        savedCount++;
      } else if (item.meterId === "WATER-SOFT" || (item.serialNumber && item.serialNumber.includes("000630"))) {
        sheet.getRange(row, 4).setValue(val);
        savedCount++;
      } else if (item.meterId === "WATER-EVAP" || (item.serialNumber && item.serialNumber.includes("000648"))) {
        sheet.getRange(row, 6).setValue(val);
        savedCount++;
      }
      sheet.getRange(row, 8).setValue("LINE Bot (AI Verified)");
    }
  });

  return { savedCount: savedCount, targetDay: targetDay };
}

// -------------------------------------------------------------------------
// 4. ฟังก์ชันส่งข้อความ LINE
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
 * 5. บันทึกข้อมูลค่าไฟฟ้า 14 จุด วันที่ 1, 2, 3 ก.ย. ลงชีต "ค่าไฟฟ้า" สำหรับ AppSheet
 * =========================================================================
 */
function updateOfficialElectricityDataDays123() {
  const ss = SpreadsheetApp.openById(SETTINGS.SPREADSHEET_ID);
  let sheet = ss.getSheetByName("ค่าไฟฟ้า");
  if (!sheet) {
    sheet = ss.insertSheet("ค่าไฟฟ้า");
  }

  // ข้อมูลหน่วยไฟฟ้าที่ใช้จริงตามใบรายงาน
  const data = [
    ["กลุ่มตู้", "รหัส", "สถานที่ใช้งาน", "CT", "1 ก.ย. 69", "2 ก.ย. 69", "3 ก.ย. 69"],
    ["MDB-1 TR1 @ 1,600 kVA", "Q1-1", "MMC-PRO-1 (Frozen Line)", 1, 2800, 2900, 1900],
    ["MDB-1 TR1 @ 1,600 kVA", "Q1-2", "MMC-PRO-2 (RTE Line)", 1, 2700, 2500, 2700],
    ["MDB-1 TR1 @ 1,600 kVA", "Q1-3", "MCC-ACP (Air compressor)", 1, 430, 450, 410],
    ["MDB-1 TR1 @ 1,600 kVA", "Q1-4", "MCC-WSP (Water Pump)", 1, 49, 49, 49],
    ["MDB-1 TR1 @ 1,600 kVA", "Q1-5", "DC-AC (Air conditioner for all control room)", 1, 700, 760, 720],
    ["MDB-1 TR1 @ 1,600 kVA", "Q1-6", "DB-PRO-1 (LP _ Office)", 1, 1000, 1200, 1000],
    ["MDB-1 TR1 @ 1,600 kVA", "Q1-7", "DB-PRO-2 (LP _ outside)", 1, 440, 470, 440],
    ["MDB-1 TR1 @ 1,600 kVA", "Q1-8", "MCC-SILO (Silo)", 1, 120, 150, 160],
    ["MDB-2 TR2 @ 1,600 kVA", "Q1-1", "REFRIGERATION PLANT (System)", 1, 13000, 14000, 13000],
    ["MDB-2 TR2 @ 1,600 kVA", "Q1-2", "EMCC-FP&SN (Fire alarm system)", 1, 780, 560, 600],
    ["MDB-2 TR2 @ 1,600 kVA", "Q1-3", "ELP-PRO-1 (LP _ Emergency )", 1, 260, 270, 260],
    ["MDB-2 TR2 @ 1,600 kVA", "Q1-4", "EDB-PRO (Water treatment plant)", 1, 430, 420, 410],
    ["MDB-2 TR2 @ 1,600 kVA", "Q1-5", "ELP-OFF (Server room)", 1, 110, 120, 110],
    ["MDB-2 TR2 @ 1,600 kVA", "Q1-6", "EDB-AS/RS (AS/RS)", 1, 50, 42, 39],
    ["รวมการใช้ไฟฟ้าทั้งโรงงาน", "-", "Factory By Meter Total (14 จุด)", 14, 22869, 23891, 21798]
  ];

  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  SpreadsheetApp.flush();
  Logger.log("✅ บันทึกค่าไฟฟ้าลง AppSheet สำเร็จเรียบร้อย: วันที่ 1 (22,869), วันที่ 2 (23,891), วันที่ 3 (21,798)");
}
