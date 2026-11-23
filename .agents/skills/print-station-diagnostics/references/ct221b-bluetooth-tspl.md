# Clabel CT221B Hardware Specs & Direct Bluetooth (BLE / TSPL) Reference

Reference extracted from the official **Clabel CT221B User Manual** (`CT221B User Manual.pdf`, Shenzhen Dudian Technology Co., Ltd.) and verified open-source CT221B protocol implementations (`DFC1990/flutter_label_printer_kit`).

> **PDF Note**: The official `CT221B User Manual.pdf` is an image-only (rasterized) PDF; text-only extractors like `markitdown` return empty output without OCR.

## 1. Hardware Specifications (from Official Manual)

| Property | Value |
|---|---|
| Model | Clabel CT221B (Shenzhen Dudian Technology Co., Ltd.) |
| Resolution | **203 DPI** (`8 dots/mm`, i.e. `1 byte per mm` horizontally in 1-bit mono) |
| Print Speed | `50 mm/s` |
| Label Width | `25–54 mm` (ships with `40×30 mm`; GDG Jakarta uses `50×30 mm` / `40×30 mm`) |
| Media Detection | **Gap paper** (factory default) and **Black mark paper** |
| Interfaces | USB-C (`5V=2A`) + Dual-mode Bluetooth (Classic SPP + BLE) |
| Battery | `1200 mAh` |
| Built-in Barcodes | CODE128, CODE39, CODE93, EAN8, EAN13, EAN128, UPC-A, UPC-E, ITF14, QR CODE |
| Official Desktop Driver | `https://ga.ctaiot.com` |

### LED Indicator Priority (`Charge > Abnormal > Bluetooth`)
- **Blue flashing**: Bluetooth disconnected | **Blue solid**: Bluetooth connected
- **Red flashing**: Low battery | **Red solid**: Cover open / out of paper / print head overheat
- **Green flashing**: Charging | **Green solid**: Fully charged

### Physical Button Actions
- **Hold 2s**: Power ON/OFF
- **Single click (powered on)**: Feed / calibrate one label gap
- **Double click (powered on)**: Print self-test page (useful to verify printhead & Bluetooth name/MAC)

---

## 2. Bluetooth Transport & BLE GATT UUIDs

The CT221B exposes a standard **ISSC / Microchip Transparent UART** BLE GATT service (alongside Classic Bluetooth SPP):

| Role | UUID |
|---|---|
| Primary Service | `49535343-FE7D-4AE5-8FA9-9FAFD205E455` |
| Write Characteristic (TX to printer) | `49535343-8841-43F4-A8D4-ECBE34729BB3` |
| Notify Characteristic (RX status/battery) | `49535343-1E4D-4BD9-BA61-23C647249616` |
| Control / Auxiliary Characteristic | `49535343-ACA3-481C-91EC-D85E28A60318` |

---

## 3. Wire Protocol (Raw TSPL — Unencrypted)

CT221B accepts raw **TSPL** commands directly over BLE Write or SPP (no proprietary encryption wrapper):

### A. Setup Header
```text
SIZE 50 mm,30 mm\r\n
GAP 2 mm,0 mm\r\n
DIRECTION 0,0\r\n
REFERENCE 0,0\r\n
DENSITY 8\r\n
OFFSET 0 mm\r\n
SPEED 3\r\n
CLS\r\n
```

### B. 1-Bit Raster Bitmap + Print Command
```text
BITMAP 0,0,<widthBytes>,<heightDots>,1,<rawMonoBytes>\r\n
PRINT 1,1\r\n
```
- `dotsPerMm = 8` (203 DPI)
- `widthBytes = widthMm` (since `widthMm * 8 dots / 8 bits = widthMm` bytes)
- `heightDots = heightMm * 8`
- Total bitmap payload = `widthMm * heightMm * 8` bytes (e.g., `50×30 mm` = `12,000 bytes`, `40×30 mm` = `9,600 bytes`).

### C. Status & Battery Notify Frames (9 bytes, `0xDD`-delimited)
- Passive status: `dd 00 01 81 00 01 [STATUS] [CHECK] dd`
- Active status response: `dd 00 05 83 00 01 [RAW_STATUS] [BATTERY_0_100] dd`
- BLE battery notification: `dd 00 05 86 00 01 [BATTERY_0_100] [CHECK] dd`

---

## 4. Direct Dashboard Printing via Web Bluetooth — Feasibility & Guardrails

**Feasible**: Yes, Chromium browsers (`Chrome`, `Edge`, `Brave`, `Arc`) on macOS, Windows, Android, and ChromeOS can connect directly from `https://gdgjakarta.com` (or `localhost`) using `navigator.bluetooth.requestDevice()` without the Local Print Worker or CUPS.

### Required Architecture & Constraints
1. **Browser Support**: **Chromium-only**. Safari (macOS/iOS) and Firefox do NOT support Web Bluetooth. Keep the macOS Local Print Worker (`127.0.0.1:17777`) as the universal/venue-grade path and treat Web Bluetooth as an optional direct transport.
2. **Rendering Pipeline**: Render badge HTML/layout onto an offscreen `<canvas>` at `(widthMm * 8) × (heightMm * 8)` px, threshold/dither to 1-bit monochrome (`Uint8Array`), prepend TSPL setup + `BITMAP`, append `\r\nPRINT 1,1\r\n`.
3. **BLE Chunking**: Split writes into MTU-safe chunks (start with `20–180 bytes` and small inter-chunk delay if needed). Firmware varies between `writeValueWithoutResponse` and `writeValueWithResponse` — **must validate on physical CT221B hardware** before event use.
4. **User Gesture & Reconnect**: `requestDevice()` requires a user click; a page reload drops the GATT handle unless persistent permissions (`getDevices()`) are granted.
5. **Venue RF Reliability**: A `50×30 mm` label (~12 KB) takes ~0.5–2s over BLE and can be affected by 2.4 GHz congestion at large events; USB + Local Print Worker remains preferred for high-volume check-in desks.
6. **Fallback**: If a desktop OS only pairs the CT221B over Classic Bluetooth SPP (serial port), Chromium's **Web Serial API** (`navigator.serial`) can send the exact same raw TSPL bytes.
