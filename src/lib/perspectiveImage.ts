import type {WebsiteCoverConfig} from '../types';

export interface Point {
  x: number;
  y: number;
}

export interface Quad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export const WEBSITE_COVER_WIDTH = 1086;
export const WEBSITE_COVER_HEIGHT = 1448;

// The clip follows the tablet's inner glass. The draw quad overscans it so
// perspective sampling cannot expose the light page baked into the base art.
export const WEBSITE_COVER_SCREEN_CLIP: Quad = {
  topLeft: {x: 476, y: 848},
  topRight: {x: 1024, y: 789},
  bottomRight: {x: 1000, y: 1388},
  bottomLeft: {x: 467, y: 1405}
};

const WEBSITE_COVER_SCREEN_DRAW: Quad = {
  topLeft: {x: 468, y: 840},
  topRight: {x: 1032, y: 781},
  bottomRight: {x: 1008, y: 1396},
  bottomLeft: {x: 459, y: 1413}
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function interpolate(quad: Quad, u: number, v: number): Point {
  const top = {
    x: quad.topLeft.x + (quad.topRight.x - quad.topLeft.x) * u,
    y: quad.topLeft.y + (quad.topRight.y - quad.topLeft.y) * u
  };
  const bottom = {
    x: quad.bottomLeft.x + (quad.bottomRight.x - quad.bottomLeft.x) * u,
    y: quad.bottomLeft.y + (quad.bottomRight.y - quad.bottomLeft.y) * u
  };
  return {x: top.x + (bottom.x - top.x) * v, y: top.y + (bottom.y - top.y) * v};
}

function drawTriangle(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  source: [Point, Point, Point],
  destination: [Point, Point, Point]
) {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const denominator = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denominator) < 0.0001) return;
  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denominator;
  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denominator;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denominator;
  const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denominator;
  const e = (
    d0.x * (s1.x * s2.y - s2.x * s1.y)
    + d1.x * (s2.x * s0.y - s0.x * s2.y)
    + d2.x * (s0.x * s1.y - s1.x * s0.y)
  ) / denominator;
  const f = (
    d0.y * (s1.x * s2.y - s2.x * s1.y)
    + d1.y * (s2.x * s0.y - s0.x * s2.y)
    + d2.y * (s0.x * s1.y - s1.x * s0.y)
  ) / denominator;

  context.save();
  context.beginPath();
  context.moveTo(d0.x, d0.y);
  context.lineTo(d1.x, d1.y);
  context.lineTo(d2.x, d2.y);
  context.closePath();
  context.clip();
  context.transform(a, b, c, d, e, f);
  context.drawImage(image, 0, 0);
  context.restore();
}

export function drawPerspectiveImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  config: Pick<WebsiteCoverConfig, 'screenshotScale' | 'screenshotX' | 'screenshotY'>,
  quad: Quad,
  columns = 24,
  rows = 16
) {
  const topWidth = Math.hypot(quad.topRight.x - quad.topLeft.x, quad.topRight.y - quad.topLeft.y);
  const bottomWidth = Math.hypot(quad.bottomRight.x - quad.bottomLeft.x, quad.bottomRight.y - quad.bottomLeft.y);
  const leftHeight = Math.hypot(quad.bottomLeft.x - quad.topLeft.x, quad.bottomLeft.y - quad.topLeft.y);
  const rightHeight = Math.hypot(quad.bottomRight.x - quad.topRight.x, quad.bottomRight.y - quad.topRight.y);
  const targetWidth = (topWidth + bottomWidth) / 2;
  const targetHeight = (leftHeight + rightHeight) / 2;
  const zoom = Math.max(1, config.screenshotScale || 1);
  const coverScale = Math.max(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight) * zoom;
  const cropWidth = Math.min(image.naturalWidth, targetWidth / coverScale);
  const cropHeight = Math.min(image.naturalHeight, targetHeight / coverScale);
  const availableX = Math.max(0, image.naturalWidth - cropWidth);
  const availableY = Math.max(0, image.naturalHeight - cropHeight);
  const cropX = clamp(availableX * (0.5 - (config.screenshotX || 0) / 100), 0, availableX);
  const cropY = clamp(availableY * (0.5 - (config.screenshotY || 0) / 100), 0, availableY);

  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  for (let row = 0; row < rows; row += 1) {
    const v0 = row / rows;
    const v1 = (row + 1) / rows;
    for (let column = 0; column < columns; column += 1) {
      const u0 = column / columns;
      const u1 = (column + 1) / columns;
      const s00 = {x: cropX + cropWidth * u0, y: cropY + cropHeight * v0};
      const s10 = {x: cropX + cropWidth * u1, y: cropY + cropHeight * v0};
      const s11 = {x: cropX + cropWidth * u1, y: cropY + cropHeight * v1};
      const s01 = {x: cropX + cropWidth * u0, y: cropY + cropHeight * v1};
      const d00 = interpolate(quad, u0, v0);
      const d10 = interpolate(quad, u1, v0);
      const d11 = interpolate(quad, u1, v1);
      const d01 = interpolate(quad, u0, v1);
      drawTriangle(context, image, [s00, s10, s11], [d00, d10, d11]);
      drawTriangle(context, image, [s00, s11, s01], [d00, d11, d01]);
    }
  }
  context.restore();
}

function scaledQuad(quad: Quad, scaleX: number, scaleY: number): Quad {
  return {
    topLeft: {x: quad.topLeft.x * scaleX, y: quad.topLeft.y * scaleY},
    topRight: {x: quad.topRight.x * scaleX, y: quad.topRight.y * scaleY},
    bottomRight: {x: quad.bottomRight.x * scaleX, y: quad.bottomRight.y * scaleY},
    bottomLeft: {x: quad.bottomLeft.x * scaleX, y: quad.bottomLeft.y * scaleY}
  };
}

function clipToQuad(context: CanvasRenderingContext2D, quad: Quad) {
  context.beginPath();
  context.moveTo(quad.topLeft.x, quad.topLeft.y);
  context.lineTo(quad.topRight.x, quad.topRight.y);
  context.lineTo(quad.bottomRight.x, quad.bottomRight.y);
  context.lineTo(quad.bottomLeft.x, quad.bottomLeft.y);
  context.closePath();
  context.clip();
}

export function drawWebsiteCoverScreenshot(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  config: Pick<WebsiteCoverConfig, 'screenshotScale' | 'screenshotX' | 'screenshotY'>,
  width = WEBSITE_COVER_WIDTH,
  height = WEBSITE_COVER_HEIGHT
) {
  const scaleX = width / WEBSITE_COVER_WIDTH;
  const scaleY = height / WEBSITE_COVER_HEIGHT;
  const clipQuad = scaledQuad(WEBSITE_COVER_SCREEN_CLIP, scaleX, scaleY);
  const drawQuad = scaledQuad(WEBSITE_COVER_SCREEN_DRAW, scaleX, scaleY);

  context.save();
  clipToQuad(context, clipQuad);
  drawPerspectiveImage(context, image, config, drawQuad, 32, 20);
  context.restore();
}
