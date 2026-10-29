/**
 * Self-contained, zero-dependency ISO/IEC 18004 QR Code generator (Byte mode, ECC Level L).
 * Produces an instant, crisp SVG data URI (`data:image/svg+xml;utf8,...`) so badge previews
 * and silent thermal prints render in 0ms without external network calls or blank boxes.
 */

// Total codewords and EC codewords for Versions 1..6 at ECC Level L
const VERSION_PARAMS: ReadonlyArray<{ total: number; ec: number; align: number[] }> = [
  { total: 0, ec: 0, align: [] }, // dummy index 0
  { total: 26, ec: 7, align: [] }, // v1 (21x21, up to 17 bytes)
  { total: 44, ec: 10, align: [6, 18] }, // v2 (25x25, up to 32 bytes)
  { total: 70, ec: 15, align: [6, 22] }, // v3 (29x29, up to 53 bytes)
  { total: 100, ec: 20, align: [6, 26] }, // v4 (33x33, up to 78 bytes)
  { total: 134, ec: 26, align: [6, 30] }, // v5 (37x37, up to 106 bytes)
  { total: 172, ec: 18, align: [6, 34] }, // v6 (2 blocks of 68+18, handled up to v5 for single-block simplicity)
];

function gfMul(x: number, y: number, exp: Uint8Array, log: Uint8Array): number {
  if (x === 0 || y === 0) return 0;
  return exp[(log[x] + log[y]) % 255];
}

function computeReedSolomon(data: number[], ecLen: number): number[] {
  const exp = new Uint8Array(256);
  const log = new Uint8Array(256);
  let v = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = v;
    log[v] = i;
    v <<= 1;
    if (v & 0x100) v ^= 0x11d;
  }
  exp[255] = exp[0];

  let poly = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    const root = exp[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root, exp, log);
    }
    poly = next;
  }

  const rem = new Array<number>(ecLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.shift();
    rem.push(0);
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(poly[j + 1], factor, exp, log);
      }
    }
  }
  return rem;
}

export function generateQrSvgDataUrl(payload: string): string {
  const bytes = Array.from(new TextEncoder().encode(payload || "GDG"));

  // Pick smallest version (1..5) that fits byte payload
  let version = 1;
  for (let v = 1; v <= 5; v++) {
    const dataCap = VERSION_PARAMS[v].total - VERSION_PARAMS[v].ec - 2;
    if (bytes.length <= dataCap) {
      version = v;
      break;
    }
  }

  const { total, ec, align } = VERSION_PARAMS[version];
  const dataCapacity = total - ec;

  // Build bit stream: Byte mode (0100) + 8-bit length + bytes + terminator
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) pushBits(b, 8);
  pushBits(0, Math.min(4, dataCapacity * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const dataWords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i + b];
    dataWords.push(byte);
  }

  let padToggle = true;
  while (dataWords.length < dataCapacity) {
    dataWords.push(padToggle ? 0xec : 0x11);
    padToggle = !padToggle;
  }

  const ecWords = computeReedSolomon(dataWords, ec);
  const allWords = [...dataWords, ...ecWords];

  const size = version * 4 + 17;
  const grid = Array.from({ length: size }, () => new Uint8Array(size));
  const reserved = Array.from({ length: size }, () => new Uint8Array(size));

  const setFinder = (r0: number, c0: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onEdge = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        grid[r][c] = inOuter && (onEdge || inCenter) ? 1 : 0;
        reserved[r][c] = 1;
      }
    }
  };

  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    grid[6][i] = i % 2 === 0 ? 1 : 0;
    reserved[6][i] = 1;
    grid[i][6] = i % 2 === 0 ? 1 : 0;
    reserved[i][6] = 1;
  }

  // Alignment patterns
  if (align.length > 0) {
    for (const r0 of align) {
      for (const c0 of align) {
        if (reserved[r0][c0]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const onEdge = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            grid[r0 + dr][c0 + dc] = onEdge ? 1 : 0;
            reserved[r0 + dr][c0 + dc] = 1;
          }
        }
      }
    }
  }

  // Reserve format info areas & dark module
  for (let i = 0; i < 9; i++) {
    if (i < size) {
      reserved[8][i] = 1;
      reserved[i][8] = 1;
    }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = 1;
    reserved[size - 1 - i][8] = 1;
  }
  grid[size - 8][8] = 1;
  reserved[size - 8][8] = 1;

  // Place data bits in upward/downward 2-column zig-zag
  let bitIdx = 0;
  const totalBits = allWords.length * 8;
  let upward = true;
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col--; // skip vertical timing line
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (reserved[r][c]) continue;
        let bit = 0;
        if (bitIdx < totalBits) {
          bit = (allWords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
          bitIdx++;
        }
        // Mask pattern 0: (r + c) % 2 === 0
        if ((r + c) % 2 === 0) bit ^= 1;
        grid[r][c] = bit;
      }
    }
    upward = !upward;
  }

  // Format info for ECC Level L (01) + Mask 0 (000) -> 0x77c4
  const formatBits = 0x77c4;
  const fCoords1: Array<[number, number]> = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const bit = (formatBits >> (14 - i)) & 1;
    const [r, c] = fCoords1[i];
    grid[r][c] = bit;
    if (i < 7) {
      grid[size - 1 - i][8] = bit;
    } else {
      grid[8][size - 15 + i] = bit;
    }
  }

  // Build compact SVG path
  const margin = 1;
  const viewSize = size + margin * 2;
  let path = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) {
        path += `M${c + margin},${r + margin}h1v1h-1z`;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" shape-rendering="crispEdges"><rect width="${viewSize}" height="${viewSize}" fill="#ffffff"/><path d="${path}" fill="#000000"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
