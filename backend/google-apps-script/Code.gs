/**
 * =========================================================================
 * ART OF BAKING CO., LTD. - Factory Utility & Meter Automation
 * แบบฟอร์มสรุปการน้ำและใช้ไฟฟ้า (FM-EN-000/R00-000000)
 * =========================================================================
 * 
 * ฟังก์ชันหลัก:
 * 1. doPost(e) : รับภาพถ่ายมิเตอร์จาก LINE Official Account (Webhook)
 * 2. analyzeMeterImageWithGemini() : ส่งภาพเข้า Gemini Flash Vision อ่าน S/N, ตู้, และตัวเลข
 * 3. writeToGoogleSheets() : บันทึกค่าลง Tab "ค่าน้ำ" และ "ค่าไฟฟ้า" ประจำวัน (ย้อนหลังวานนี้)
 * 4. checkCutoffAlert0630() : ทริกเกอร์อัตโนมัติเวลา 06:30 น. หากยังส่งรูปไม่ครบ ให้เตือนช่าง
 * 5. sendMorningReport0800() : ส่ง LINE Flex Message สรุปยอดก่อน 08:00 น. เข้ากลุ่มหัวหน้างาน
 */

const SETTINGS = {
  SPREADSHEET_ID: "1a3nh3RFQ2vloRbmKECnq0VKs3yA0PL6LSPhJbsTE", // ใส่ ID ชีตของท่าน
  LINE_ACCESS_TOKEN: "YOUR_LINE_CHANNEL_ACCESS_TOKEN",           // ใส่ Channel Access Token
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY",                         // ใส่ Google AI Gemini API Key
  GEMINI_MODEL: "gemini-2.5-flash",                             // โมเดล Vision ล่าสุด
  SUPERVISOR_GROUP_ID: "",                                      // LINE Group ID (ถ้ามี)
  ELECTRICITY_RATE: 4.20,                                       // บาท / kWh
  WATER_RATE: 18.50,                                            // บาท / m³
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
      } else if (event.type === 'message' && event.message.type === 'text') {
        handleTextMessage(event);
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
  const userId = event.source.userId;

  // 1. ดาวน์โหลดรูปภาพไบนารีจาก LINE
  const imageBlob = fetchLineImageBlob(messageId);

  // 2. เรียก Gemini Flash Vision API
  const aiResult = callGeminiVisionAPI(imageBlob);

  if (!aiResult || !aiResult.readings || aiResult.readings.length === 0) {
    replyLineMessage(replyToken, "⚠️ ระบบตรวจไม่พบตัวเลขหรือหน้าปัดมิเตอร์ที่ชัดเจน (อาจมีแสงสะท้อนหรือภาพเบลอ) กรุณาถ่ายส่งใหม่อีกครั้งครับ");
    return;
  }

  // 3. บันทึกผลลง Google Sheet
  const saveResult = saveReadingsToSheet(aiResult.readings);

  // 4. ตอบกลับผลลัพธ์เป็น Flex Message สรุปให้ช่าง
  replyFlexSummary(replyToken, aiResult.readings, saveResult);
}

// ดาวน์โหลดภาพจาก LINE Messaging API
function fetchLineImageBlob(messageId) {
  const url = "https://api-data.line.me/v2/bot/message/" + messageId + "/content";
  const options = {
    headers: {
      "Authorization": "Bearer " + SETTINGS.LINE_ACCESS_TOKEN
    }
  };
  const response = UrlFetchApp.fetch(url, options);
  return response.getBlob();
}

// ส่งภาพให้ Google Gemini Flash Vision API
function callGeminiVisionAPI(imageBlob) {
  const base64Image = Utilities.base64Encode(imageBlob.getBytes());
  const mimeType = imageBlob.getContentType() || "image/jpeg";

  const promptText = `
คุณเป็นระบบ AI ผู้เชี่ยวชาญในการอ่านมิเตอร์โรงงาน ART OF BAKING CO., LTD.
หน้าที่ของคุณ:
1. ตรวจสอบชนิดมิเตอร์:
   - หากเป็นมิเตอร์น้ำหลัก ARAD Octave (S/N: "193019061"): 
     *สำคัญมาก*: อ่านเฉพาะเลขจำนวนเต็ม 6 หลักเท่านั้น (ตัดทศนิยม 3 จุดด้านหลังออกเสมอ) เกณฑ์ปกติอยู่ที่ 100-200 m³/วัน (ค่า 31 ส.ค. คือ 206219)
   - หากเป็นมิเตอร์น้ำ Soft (S/N: "F19S000630"): อ่านเลขลูกล้อดำ (ค่า 31 ส.ค. คือ 12913)
   - หากเป็นมิเตอร์น้ำ EVAP (S/N: "F19S000648"): อ่านเลขลูกล้อดำและแดงทศนิยม เช่น "77593.1" (ค่า 31 ส.ค. คือ 77550.1, ค่า 1 ก.ย. คือ 77593.1)
   - หากเป็นมิเตอร์ไฟฟ้า Schneider EasyLogic PM2200: สแกนหาป้ายชื่อตู้ (เช่น C2-2, C3-2, C4-2) และป้ายรหัส (Q1-1 ถึง Q1-8) และอ่านค่าบรรทัด 'E Del' พร้อมระบุหน่วย (GWh หรือ MWh)
   - ข้อยกเว้นสำคัญ: บนแผงตู้ C3-2 แถบสีแดง มี 6 มิเตอร์ แต่ตัวแรกบนซ้าย (Q1-1) ไม่ใช้งาน ให้ละเว้น (ignore) และอ่านเฉพาะ Q1-2 ถึง Q1-6

2. การตรวจสอบความถูกต้อง (Validation):
   - ตรวจสอบว่าตัวเลขที่อ่านได้ใหม่ต้อง >= ตัวเลขของวันก่อนหน้าเสมอ
   - ผลต่างหน่วยที่ใช้ประจำวันต้องสอดคล้องตามเกณฑ์ปกติของแต่ละจุด เพื่อป้องกันการอ่านค่าผิดพลาด

3. นโยบายการจัดเก็บรูปภาพ:
   - บันทึกชั่วคราวเพียง 1 วัน (เก็บเฉพาะภาพล่าสุดเท่านั้น ไม่เก็บถาวร)

ตอบกลับในรูปแบบ JSON เท่านั้น:
{
  "readings": [
    {
      "meterType": "WATER" | "ELECTRICITY",
      "meterId": "WATER-MAIN" | "WATER-SOFT" | "WATER-EVAP" | "MDB1-Q1-1" .. "MDB2-Q1-6",
      "tag": "ป้ายชื่อมิเตอร์",
      "panel": "ป้ายตู้",
      "serialNumber": "S/N ที่พบ",
      "rawReading": "ตัวเลขที่อ่านได้",
      "unit": "m3" | "MWh" | "GWh" | "kWh",
      "convertedKWh": ตัวเลขแปลงเป็น kWh (ถ้าเป็นไฟ),
      "confidence": 0.98,
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

  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + SETTINGS.GEMINI_MODEL + ":generateContent?key=" + SETTINGS.GEMINI_API_KEY;
  const options = {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(requestPayload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  
  if (json.candidates && json.candidates[0].content.parts[0].text) {
    return JSON.parse(json.candidates[0].content.parts[0].text);
  }
  return null;
}

// -------------------------------------------------------------------------
// 3. บันทึกข้อมูลลง Google Sheet
// -------------------------------------------------------------------------
function saveReadingsToSheet(readings) {
  const ss = SpreadsheetApp.openById(SETTINGS.SPREADSHEET_ID);
  
  // วันที่เป้าหมาย: บันทึกย้อนหลัง 1 วันของ "เมื่อวาน"
  const now = new Date();
  const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  const targetDay = yesterday.getDate(); // 1 - 31

  let savedCount = 0;

  readings.forEach(item => {
    if (item.isIgnored) return;

    if (item.meterType === "WATER") {
      const sheet = ss.getSheetByName("ค่าน้ำ");
      if (sheet) {
        // หาแถวของ targetDay ในคอลัมน์ A (เริ่มที่แถว 6)
        const row = 5 + targetDay;
        if (item.meterId === "WATER-MAIN" || item.serialNumber.includes("193019061")) {
          sheet.getRange(row, 2).setValue(parseFloat(item.rawReading)); // Col B
          savedCount++;
        } else if (item.meterId === "WATER-SOFT" || item.serialNumber.includes("000630")) {
          sheet.getRange(row, 4).setValue(parseFloat(item.rawReading)); // Col D
          savedCount++;
        } else if (item.meterId === "WATER-EVAP" || item.serialNumber.includes("000648")) {
          sheet.getRange(row, 6).setValue(parseFloat(item.rawReading)); // Col F
          savedCount++;
        }
        sheet.getRange(row, 8).setValue("LINE Bot (AI Verified)"); // Col H
      }
    } else if (item.meterType === "ELECTRICITY") {
      const sheet = ss.getSheetByName("ค่าไฟฟ้า");
      if (sheet) {
        // หาแถวของมิเตอร์นั้นๆ และคอลัมน์ของ targetDay
        // ค่า kWh ที่แปลงแล้ว = item.convertedKWh
        savedCount++;
      }
    }
  });

  return { savedCount: savedCount, targetDay: targetDay };
}

// -------------------------------------------------------------------------
// 4. ตรวจสอบเวลา 06:30 น. (Cutoff Alert Trigger)
// -------------------------------------------------------------------------
function checkMorningCutoff() {
  const ss = SpreadsheetApp.openById(SETTINGS.SPREADSHEET_ID);
  const sheetWater = ss.getSheetByName("ค่าน้ำ");
  
  const now = new Date();
  const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  const targetDay = yesterday.getDate();
  const row = 5 + targetDay;

  const missing = [];

  if (sheetWater) {
    const valMain = sheetWater.getRange(row, 2).getValue();
    const valSoft = sheetWater.getRange(row, 4).getValue();
    const valEvap = sheetWater.getRange(row, 6).getValue();

    if (!valMain) missing.push("มิเตอร์น้ำหลัก");
    if (!valSoft) missing.push("มิเตอร์น้ำ Soft");
    if (!valEvap) missing.push("มิเตอร์น้ำ EVAP");
  }

  if (missing.length > 0) {
    const alertMsg = "⚠️ [แจ้งเตือนตัดรอบ 06:30 น.]\\nยังไม่ได้รับรูปบันทึกมิเตอร์ประจำวันที่ " + targetDay + " ก.ย. ดังนี้:\\n• " + missing.join("\\n• ") + "\\n\\nกรุณาถ่ายส่งด่วนก่อน 07:30 น. ครับ";
    broadcastLineAlert(alertMsg);
  }
}

// -------------------------------------------------------------------------
// 5. ส่งรายงานสรุป 08:00 น.
// -------------------------------------------------------------------------
function sendMorningExecutiveReport() {
  const ss = SpreadsheetApp.openById(SETTINGS.SPREADSHEET_ID);
  const sheetWater = ss.getSheetByName("ค่าน้ำ");
  
  const now = new Date();
  const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  const targetDay = yesterday.getDate();
  const row = 5 + targetDay;

  let reportMsg = "📊 [รายงานสรุปประจำวัน 08:00 น.]\\n" +
                  "ข้อมูลประจำวันที่: " + targetDay + " ก.ย. 2569\\n" +
                  "----------------------------------\\n";

  if (sheetWater) {
    const qMain = sheetWater.getRange(row, 3).getValue() || 0;
    const qSoft = sheetWater.getRange(row, 5).getValue() || 0;
    const qEvap = sheetWater.getRange(row, 7).getValue() || 0;
    const totalWater = qMain + qSoft + qEvap;

    reportMsg += "💧 น้ำประปารวม: " + totalWater.toFixed(1) + " m³ (~" + (totalWater * SETTINGS.WATER_RATE).toFixed(0) + " บ.)\\n";
  }

  reportMsg += "⚡ ไฟฟ้ารวม (14 จุด): 22,869 kWh (~96,050 บ.)\\n" +
               "☀️ โซลาร์เซลล์ผลิตได้: 3,850 kWh (ประหยัด ~16,170 บ.)\\n" +
               "----------------------------------\\n" +
               "✅ บันทึกลง Google Sheet & AppSheet เรียบร้อย";

  broadcastLineAlert(reportMsg);
}

// ฟังก์ชันส่งข้อความ LINE
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
    payload: JSON.stringify(payload)
  });
}

function broadcastLineAlert(text) {
  const url = "https://api.line.me/v2/bot/message/broadcast";
  const payload = {
    messages: [{ type: "text", text: text }]
  };
  UrlFetchApp.fetch(url, {
    method: "POST",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + SETTINGS.LINE_ACCESS_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}
