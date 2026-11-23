// Pure TypeScript TSPL encoder & status parser for Clabel CT221B thermal label printers.
// Reference: 203 DPI (8 dots/mm = 1 byte/mm horizontally), ISSC Transparent UART BLE service.

export const CT221B_DOTS_PER_MM = 8;
export const CT221B_BLE_SERVICE_UUID = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
export const CT221B_BLE_WRITE_CHAR_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";
export const CT221B_BLE_NOTIFY_CHAR_UUID = "49535343-1e4d-4bd9-ba61-23c647249616";
export const CT221B_BLE_CONTROL_CHAR_UUID = "49535343-aca3-481c-91ec-d85e28a60318";

export interface Ct221bTsplOptions {
  monoBitmap: Uint8Array;
  widthMm: number;
  heightMm: number;
  density?: number;
  gapMm?: number;
  speed?: number;
  copies?: number;
}

export interface Ct221bStatusFrame {
  statusCode?: number;
  batteryPercent?: number;
  kind: "passive_status" | "active_status" | "battery_notify";
}

export function expectedCt221bBitmapBytes(widthMm: number, heightMm: number): number {
  const w = Math.round(widthMm);
  const hDots = Math.round(heightMm) * CT221B_DOTS_PER_MM;
  return w * hDots;
}

/**
 * Converts an RGBA pixel buffer (at 203 DPI: `widthMm * 8` × `heightMm * 8` pixels) into
 * packed 1-bit monochrome bytes for TSPL `BITMAP` (`0` = burn black dot, `1` = white paper).
 */
export function rgbaToMonoBitmap(
  rgba: Uint8ClampedArray | Uint8Array,
  widthPx: number,
  heightPx: number,
  threshold = 170,
): Uint8Array {
  const widthBytes = Math.ceil(widthPx / 8);
  // TSPL BITMAP polarity: 1 = white (unburned), 0 = black thermal dot
  const out = new Uint8Array(widthBytes * heightPx).fill(0xff);

  for (let y = 0; y < heightPx; y++) {
    const rowByteOffset = y * widthBytes;
    for (let x = 0; x < widthPx; x++) {
      const idx = (y * widthPx + x) * 4;
      const r = rgba[idx] ?? 255;
      const g = rgba[idx + 1] ?? 255;
      const b = rgba[idx + 2] ?? 255;
      const a = rgba[idx + 3] ?? 255;
      // Blend transparent pixels onto white paper background before thresholding
      const alpha = a / 255;
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) * alpha + 255 * (1 - alpha);
      if (luma < threshold) {
        // Clear bit (0) to burn a black thermal dot (MSB first per byte)
        out[rowByteOffset + (x >> 3)] &= ~(0x80 >> (x & 7));
      }
    }
  }
  return out;
}

/**
 * Builds the complete unencrypted raw TSPL byte payload for a Clabel CT221B label:
 * setup header + `BITMAP 0,0,<widthBytes>,<heightDots>,1,<monoBitmap>` + `PRINT 1,<copies>`.
 */
export function buildCt221bTsplPayload(options: Ct221bTsplOptions): Uint8Array {
  const widthMm = Math.max(10, Math.min(60, Math.round(options.widthMm)));
  const heightMm = Math.max(10, Math.min(120, Math.round(options.heightMm)));
  const heightDots = heightMm * CT221B_DOTS_PER_MM;
  const expectedLen = widthMm * heightDots;

  if (options.monoBitmap.length !== expectedLen) {
    throw new Error(
      `Expected ${expectedLen} monochrome bitmap bytes for ${widthMm}x${heightMm}mm, got ${options.monoBitmap.length}.`,
    );
  }

  const gapMm = Math.max(0, Math.min(10, Math.round(options.gapMm ?? 2)));
  const density = Math.max(1, Math.min(15, Math.round(options.density ?? 8)));
  const speed = Math.max(1, Math.min(5, Math.round(options.speed ?? 3)));
  const copies = Math.max(1, Math.min(10, Math.round(options.copies ?? 1)));

  const setup = [
    `SIZE ${widthMm} mm,${heightMm} mm`,
    `GAP ${gapMm} mm,0 mm`,
    "DIRECTION 0,0",
    "REFERENCE 0,0",
    `DENSITY ${density}`,
    "OFFSET 0 mm",
    `SPEED ${speed}`,
    "CLS",
    `BITMAP 0,0,${widthMm},${heightDots},1,`,
  ].join("\r\n");

  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(setup);
  const footerBytes = encoder.encode(`\r\nPRINT 1,${copies}\r\n`);

  const payload = new Uint8Array(headerBytes.length + options.monoBitmap.length + footerBytes.length);
  payload.set(headerBytes, 0);
  payload.set(options.monoBitmap, headerBytes.length);
  payload.set(footerBytes, headerBytes.length + options.monoBitmap.length);
  return payload;
}

/**
 * Parses 9-byte `0xDD`-delimited CT221B BLE/SPP status & battery notification frames:
 * - `dd 00 01 81 00 01 [STATUS] [CHECK] dd` (passive status)
 * - `dd 00 05 83 00 01 [STATUS] [BATTERY] dd` (active status response)
 * - `dd 00 05 86 00 01 [BATTERY] [CHECK] dd` (BLE battery notification)
 */
export function parseCt221bStatusFrame(frame: Uint8Array): Ct221bStatusFrame | null {
  if (frame.length < 9) return null;
  // Find 0xdd header inside buffer in case of leading transport bytes
  for (let i = 0; i <= frame.length - 9; i++) {
    if (
      frame[i] !== 0xdd ||
      frame[i + 1] !== 0x00 ||
      frame[i + 4] !== 0x00 ||
      frame[i + 5] !== 0x01 ||
      frame[i + 8] !== 0xdd
    ) {
      continue;
    }
    const typeA = frame[i + 2];
    const typeB = frame[i + 3];
    if (typeA === 0x01 && typeB === 0x81) {
      return { kind: "passive_status", statusCode: frame[i + 6] };
    }
    if (typeA === 0x05 && typeB === 0x83) {
      const battery = frame[i + 7];
      return {
        kind: "active_status",
        statusCode: frame[i + 6],
        batteryPercent: battery <= 100 ? battery : undefined,
      };
    }
    if (typeA === 0x05 && typeB === 0x86) {
      const battery = frame[i + 6];
      return {
        kind: "battery_notify",
        batteryPercent: battery <= 100 ? battery : undefined,
      };
    }
  }
  return null;
}
