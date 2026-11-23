// Direct browser Web Bluetooth (BLE) driver for Clabel CT221B thermal label printers.
// Chromium-only (Chrome, Edge, Brave, Arc on macOS, Windows, Android, ChromeOS).
// Safari & Firefox do not support `navigator.bluetooth` and should use the macOS Worker App.

import {
  buildCt221bTsplPayload,
  CT221B_BLE_NOTIFY_CHAR_UUID,
  CT221B_BLE_SERVICE_UUID,
  CT221B_BLE_WRITE_CHAR_UUID,
  CT221B_DOTS_PER_MM,
  parseCt221bStatusFrame,
  rgbaToMonoBitmap,
} from "./tspl-ct221b";

interface BluetoothRemoteGATTCharacteristicLike {
  uuid: string;
  properties?: {
    write?: boolean;
    writeWithoutResponse?: boolean;
    notify?: boolean;
  };
  value?: DataView;
  writeValueWithoutResponse?: (value: BufferSource | Uint8Array) => Promise<void>;
  writeValueWithResponse?: (value: BufferSource | Uint8Array) => Promise<void>;
  writeValue?: (value: BufferSource | Uint8Array) => Promise<void>;
  startNotifications?: () => Promise<BluetoothRemoteGATTCharacteristicLike>;
  addEventListener: (type: string, listener: (ev: Event) => void) => void;
}

interface BluetoothRemoteGATTServiceLike {
  getCharacteristic: (uuid: string) => Promise<BluetoothRemoteGATTCharacteristicLike>;
  getCharacteristics: () => Promise<BluetoothRemoteGATTCharacteristicLike[]>;
}

interface BluetoothRemoteGATTServerLike {
  connected: boolean;
  connect: () => Promise<BluetoothRemoteGATTServerLike>;
  disconnect: () => void;
  getPrimaryService: (uuid: string) => Promise<BluetoothRemoteGATTServiceLike>;
}

interface BluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServerLike;
  addEventListener: (type: string, listener: () => void) => void;
}

interface NavigatorBluetoothLike {
  requestDevice: (options: {
    filters?: Array<{ namePrefix?: string; services?: string[] }>;
    acceptAllDevices?: boolean;
    optionalServices?: string[];
  }) => Promise<BluetoothDeviceLike>;
}

export interface WebBluetoothPrinterHandle {
  id: string;
  name: string;
  connected: boolean;
  batteryPercent: number | null;
  lastError: string | null;
  device: BluetoothDeviceLike;
  writeCharacteristic: BluetoothRemoteGATTCharacteristicLike;
  disconnect: () => void;
}

export function isWebBluetoothSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    "bluetooth" in navigator && Boolean((navigator as unknown as { bluetooth?: NavigatorBluetoothLike }).bluetooth)
  );
}

/**
 * Prompts the user to pair a Clabel CT221B printer over Web Bluetooth and subscribes to status/battery notifications.
 */
export async function connectWebBluetoothCT221B(callbacks?: {
  onStatusChange?: (update: { connected: boolean; batteryPercent: number | null; lastError: string | null }) => void;
}): Promise<WebBluetoothPrinterHandle> {
  if (!isWebBluetoothSupported()) {
    throw new Error(
      "Web Bluetooth is not supported in this browser. Use Chrome, Edge, Brave, or the macOS Print Station App.",
    );
  }

  const bt = (navigator as unknown as { bluetooth: NavigatorBluetoothLike }).bluetooth;
  const device = await bt.requestDevice({
    filters: [
      { namePrefix: "CT221B" },
      { namePrefix: "Clabel" },
      { namePrefix: "CT" },
      { services: [CT221B_BLE_SERVICE_UUID] },
    ],
    optionalServices: [CT221B_BLE_SERVICE_UUID],
  });

  if (!device.gatt) {
    throw new Error("Selected Bluetooth device does not expose a GATT server.");
  }

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(CT221B_BLE_SERVICE_UUID);

  let writeChar: BluetoothRemoteGATTCharacteristicLike | null = null;
  try {
    writeChar = await service.getCharacteristic(CT221B_BLE_WRITE_CHAR_UUID);
  } catch {
    const allChars = await service.getCharacteristics();
    writeChar = allChars.find((c) => c.properties?.writeWithoutResponse || c.properties?.write) ?? null;
  }

  if (!writeChar) {
    server.disconnect();
    throw new Error("Could not find writable BLE characteristic on CT221B printer.");
  }

  const handle: WebBluetoothPrinterHandle = {
    id: device.id,
    name: device.name?.trim() || "CT221B (Bluetooth)",
    connected: true,
    batteryPercent: null,
    lastError: null,
    device,
    writeCharacteristic: writeChar,
    disconnect: () => {
      try {
        device.gatt?.disconnect();
      } catch {
        // ignore disconnect errors
      }
      handle.connected = false;
      callbacks?.onStatusChange?.({
        connected: false,
        batteryPercent: handle.batteryPercent,
        lastError: handle.lastError,
      });
    },
  };

  device.addEventListener("gattserverdisconnected", () => {
    handle.connected = false;
    handle.lastError = "Bluetooth printer disconnected";
    callbacks?.onStatusChange?.({
      connected: false,
      batteryPercent: handle.batteryPercent,
      lastError: handle.lastError,
    });
  });

  // Subscribe to battery & status notifications (best-effort; printing still works if notify is unavailable)
  try {
    const notifyChar = await service.getCharacteristic(CT221B_BLE_NOTIFY_CHAR_UUID);
    if (notifyChar.startNotifications) {
      await notifyChar.startNotifications();
      notifyChar.addEventListener("characteristicvaluechanged", (ev: Event) => {
        const target = ev.target as unknown as BluetoothRemoteGATTCharacteristicLike | null;
        const view = target?.value;
        if (!view) return;
        const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        const parsed = parseCt221bStatusFrame(bytes);
        if (parsed?.batteryPercent !== undefined) {
          handle.batteryPercent = parsed.batteryPercent;
          callbacks?.onStatusChange?.({
            connected: handle.connected,
            batteryPercent: handle.batteryPercent,
            lastError: handle.lastError,
          });
        }
      });
    }
  } catch {
    // Non-fatal: some firmware revisions skip notify subscription
  }

  return handle;
}

/**
 * Renders an inline-styled badge HTML document into a 203 DPI (8 dots/mm) 1-bit monochrome bitmap
 * using SVG `<foreignObject>` + HTML5 `<canvas>` (100% local, zero external network dependencies).
 * For portrait layouts (`heightMm > widthMm`), rotates 90° clockwise onto the physical landscape roll.
 */
export async function renderHtmlToMonoBitmap(
  html: string,
  widthMm: number,
  heightMm: number,
): Promise<{ monoBitmap: Uint8Array; physicalWidthMm: number; physicalHeightMm: number }> {
  const widthInt = Math.round(widthMm);
  const heightInt = Math.round(heightMm);
  const isPortrait = heightInt > widthInt;
  const widthPx = widthInt * CT221B_DOTS_PER_MM;
  const heightPx = heightInt * CT221B_DOTS_PER_MM;

  // Parse the HTML document to extract styles + body content for clean XHTML foreignObject serialization
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const styles = Array.from(doc.querySelectorAll("style"))
    .map((el) => el.textContent ?? "")
    .join("\n");
  const bodyHtml = new XMLSerializer().serializeToString(doc.body);

  // Scale CSS mm layout cleanly into the exact 203 DPI pixel viewport (1mm = 3.7795275591 CSS px)
  const cssWidthPx = widthMm * 3.7795275591;
  const cssHeightPx = heightMm * 3.7795275591;
  const scaleX = widthPx / cssWidthPx;
  const scaleY = heightPx / cssHeightPx;

  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">
      <rect width="100%" height="100%" fill="#ffffff" />
      <foreignObject x="0" y="0" width="${cssWidthPx}" height="${cssHeightPx}" transform="scale(${scaleX} ${scaleY})">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${cssWidthPx}px;height:${cssHeightPx}px;margin:0;padding:0;background:#ffffff;color:#000000;overflow:hidden;">
          <style>${styles}</style>
          ${bodyHtml}
        </div>
      </foreignObject>
    </svg>
  `.trim();

  const img = new Image();
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to rasterize badge HTML to Bluetooth bitmap."));
    img.src = svgUrl;
  });

  const physicalWidthMm = isPortrait ? heightInt : widthInt;
  const physicalHeightMm = isPortrait ? widthInt : heightInt;
  const physPxW = physicalWidthMm * CT221B_DOTS_PER_MM;
  const physPxH = physicalHeightMm * CT221B_DOTS_PER_MM;

  const canvas = document.createElement("canvas");
  canvas.width = physPxW;
  canvas.height = physPxH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Could not initialize 2D canvas context for Bluetooth printing.");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, physPxW, physPxH);
  if (isPortrait) {
    // Rotate portrait (widthPx x heightPx) 90° clockwise onto landscape roll (physPxW x physPxH)
    ctx.translate(physPxW, 0);
    ctx.rotate(Math.PI / 2);
  }
  ctx.drawImage(img, 0, 0, widthPx, heightPx);

  const imageData = ctx.getImageData(0, 0, physPxW, physPxH);
  return {
    monoBitmap: rgbaToMonoBitmap(imageData.data, physPxW, physPxH),
    physicalWidthMm,
    physicalHeightMm,
  };
}

async function writeChunkedBle(
  characteristic: BluetoothRemoteGATTCharacteristicLike,
  payload: Uint8Array,
): Promise<void> {
  // shortcut: start with 180-byte chunks (common BLE 4.2+ MTU) and fall back to 20-byte BLE 4.0 chunks on write error; tune per firmware if needed.
  let chunkSize = 180;
  let offset = 0;

  const writeOne = async (chunk: Uint8Array) => {
    const canNoResp = Boolean(
      characteristic.properties?.writeWithoutResponse && characteristic.writeValueWithoutResponse,
    );
    // Cast to BufferSource to support DOM BluetoothRemoteGATTCharacteristic typing across lib.dom versions
    const bufferSource = chunk as unknown as BufferSource;
    if (canNoResp && characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(bufferSource);
    } else if (characteristic.writeValueWithResponse) {
      await characteristic.writeValueWithResponse(bufferSource);
    } else if (characteristic.writeValue) {
      await characteristic.writeValue(bufferSource);
    } else {
      throw new Error("BLE characteristic does not support write operations.");
    }
  };

  while (offset < payload.length) {
    const end = Math.min(offset + chunkSize, payload.length);
    const chunk = new Uint8Array(payload.subarray(offset, end));
    try {
      await writeOne(chunk);
      offset = end;
      // Gentle pacing so CT221B UART RX ring buffer never overflows during 12 KB bitmap bursts
      await new Promise((r) => globalThis.setTimeout(r, chunkSize > 60 ? 12 : 8));
    } catch (err) {
      if (chunkSize > 20) {
        chunkSize = 20;
        continue;
      }
      throw err;
    }
  }
}

export async function printViaWebBluetooth(
  handle: WebBluetoothPrinterHandle,
  options: {
    html: string;
    widthMm: number;
    heightMm: number;
    density?: number;
    gapMm?: number;
    copies?: number;
  },
): Promise<void> {
  if (!handle.connected || !handle.device.gatt?.connected) {
    handle.connected = false;
    throw new Error(`Bluetooth printer "${handle.name}" is disconnected.`);
  }
  const { monoBitmap, physicalWidthMm, physicalHeightMm } = await renderHtmlToMonoBitmap(
    options.html,
    options.widthMm,
    options.heightMm,
  );
  const tsplPayload = buildCt221bTsplPayload({
    monoBitmap,
    widthMm: physicalWidthMm,
    heightMm: physicalHeightMm,
    density: options.density,
    gapMm: options.gapMm,
    copies: options.copies ?? 1,
  });
  await writeChunkedBle(handle.writeCharacteristic, tsplPayload);
}
