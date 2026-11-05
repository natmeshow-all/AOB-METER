---
name: iot-modbus-protocol-debugger
description: "Hardware telemetry integration, Modbus RTU/TCP register mapping, RS485 gateway packet parsing, SAJ Cloud V2 API error handling, and robust auto-reconnection recovery."
---

# IoT & Modbus Protocol Debugger

## Purpose
Guarantees resilient, error-free telemetry ingestion from SAJ Hybrid Inverters, Modbus RTU/TCP power meters, and RS485 IoT Gateways. Resolves packet loss, register offset bugs, CRC16 mismatches, and cloud session token expiration without user disruption.

---

## When to Trigger
- Adding, debugging, or decoding Modbus registers (Holding Registers `0x03`, Input Registers `0x04`)
- Handling SAJ Cloud API v2 authentication, token expiration, or rate-limiting (`sessionTicket`)
- Decoding RS485 raw hex telemetry payloads or IoT gateway status packets
- Calculating 3-Phase power values (Line-to-Line vs Line-to-Neutral Voltage, Phase Current, Total Active Power, Power Factor)
- Handling communication timeouts, offline telemetry buffering, and exponential backoff retry logic

---

## Architecture Standards & Invariants

### 1. Modbus Data Parsing & Word Order
- Always verify Byte/Word Endianness (Big-Endian `AB CD` vs Little-Endian `CD AB` vs Mid-Little `CD AB` / `BA DC`):
  ```javascript
  // 32-bit Unsigned Integer from two 16-bit registers (Big-Endian)
  function parseModbusUint32(highReg, lowReg) {
    return ((highReg & 0xFFFF) << 16) | (lowReg & 0xFFFF);
  }

  // 32-bit Float IEEE 754 from two 16-bit registers
  function parseModbusFloat32(reg1, reg2) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint16(0, reg1, false);
    view.setUint16(2, reg2, false);
    return view.getFloat32(0, false);
  }
  ```

### 2. Standard 3-Phase & Inverter Scale Factors
- Modbus registers often store scaled integers. Always apply correct multipliers:
  - Voltage: `raw * 0.1` (V)
  - Current: `raw * 0.01` (A)
  - Active Power: `raw * 1` or `raw * 0.001` (kW)
  - Frequency: `raw * 0.01` (Hz)
  - Battery SOC: `raw * 1` (%)
  - Temperature: `(raw - 100) * 0.1` or `raw * 0.1` (°C)

### 3. SAJ Cloud V2 API Session Resilience
- Invariant: `sessionTicket` must persist in `localStorage` and database to eliminate repeated login prompts.
- When an API response returns HTTP 401, token expired, or `{ code: 40101 }`:
  1. Trigger silent refresh using encrypted stored credentials or refresh token.
  2. Cache new `sessionTicket`.
  3. Replay failed telemetry request with exponential backoff (`delay = min(2^attempt * 500ms, 10000ms)`).
  4. Never prompt the user with modal error dialogs for transient network hiccups.

### 4. Zero Data Corruption Policy
- If raw values fall outside physical reality (e.g., Solar Voltage > 1,500V, Battery SOC > 100%, Grid Frequency < 45Hz or > 65Hz):
  - Mark payload as `untrusted_telemetry`.
  - Log warning with raw packet hex.
  - Retain previous valid reading in UI with a "stale / syncing" badge instead of rendering absurd spikes.

---

## Verification Checklist
- [ ] Register map matches manufacturer datasheet (Holding vs Input registers).
- [ ] Scale factors match unit dimensions (W vs kW, V vs mV, A vs mA).
- [ ] CRC16 / Checksum calculation passes test vectors.
- [ ] API session expiration triggers automatic background token refresh without crashing UI.
- [ ] Out-of-bounds readings are sanitized before entering database and telemetry charts.
