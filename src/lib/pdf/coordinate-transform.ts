export interface CropBoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfMappedRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotateDegrees: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Converts normalized top-left browser viewport ratios into pdf-lib bottom-left coordinates,
 * accounting for CropBox offsets and page Rotation (0, 90, 180, 270 degrees clockwise).
 */
export function mapViewportRectToPdf(params: {
  cropBox: CropBoxRect;
  rotationDegrees: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
}): PdfMappedRect {
  const { cropBox, rotationDegrees } = params;
  const xPct = clamp01(params.xPct);
  const yPct = clamp01(params.yPct);
  const widthPct = Math.min(1 - xPct, clamp01(params.widthPct));
  const heightPct = Math.min(1 - yPct, clamp01(params.heightPct));

  const rot = ((Math.round(rotationDegrees) % 360) + 360) % 360;

  if (rot === 90) {
    const viewW = cropBox.height;
    const viewH = cropBox.width;
    const width = widthPct * viewW;
    const height = heightPct * viewH;
    // Display is rotated 90° CW: pdf-lib rotates CCW around (x, y), so rotate=90 aligns +X along PDF +Y and +Y along PDF -X.
    const x = cropBox.x + (yPct + heightPct) * cropBox.width;
    const y = cropBox.y + xPct * cropBox.height;
    return { x, y, width, height, rotateDegrees: 90 };
  }

  if (rot === 180) {
    const viewW = cropBox.width;
    const viewH = cropBox.height;
    const width = widthPct * viewW;
    const height = heightPct * viewH;
    const x = cropBox.x + (1 - xPct) * viewW;
    const y = cropBox.y + (yPct + heightPct) * viewH;
    return { x, y, width, height, rotateDegrees: 180 };
  }

  if (rot === 270) {
    const viewW = cropBox.height;
    const viewH = cropBox.width;
    const width = widthPct * viewW;
    const height = heightPct * viewH;
    // Display is rotated 270° CW (90° CCW): pdf-lib rotate=270 aligns +X along PDF -Y and +Y along PDF +X.
    const x = cropBox.x + (1 - yPct - heightPct) * cropBox.width;
    const y = cropBox.y + (1 - xPct) * cropBox.height;
    return { x, y, width, height, rotateDegrees: 270 };
  }

  // Default 0° (unrotated)
  const viewW = cropBox.width;
  const viewH = cropBox.height;
  const width = widthPct * viewW;
  const height = heightPct * viewH;
  const x = cropBox.x + xPct * viewW;
  const y = cropBox.y + (1 - yPct - heightPct) * viewH;
  return { x, y, width, height, rotateDegrees: 0 };
}
