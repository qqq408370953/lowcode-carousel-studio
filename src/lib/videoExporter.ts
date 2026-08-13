import {Capacitor} from '@capacitor/core';
import type {AspectRatio, ExportProgress, ImageLayer, PlayerOutroConfig, Slide, StudioState, TextLayer, VideoLayer, WebsiteCoverConfig} from '../types';
import {aspectDimensions, isPortraitAspect} from './aspect';
import {imageEntranceDelay, orderedSlideImages} from './imageSequence';
import {drawWebsiteCoverScreenshot} from './perspectiveImage';
import {
  getWebsiteCoverSubtitleLayout,
  normalizeWebsiteCoverSubtitleScale,
  WEBSITE_COVER_SUBTITLE_CENTER_X,
  WEBSITE_COVER_SUBTITLE_CENTER_Y,
  WEBSITE_COVER_SUBTITLE_FONT_SIZE,
  WEBSITE_COVER_SUBTITLE_LINE_HEIGHT
} from './websiteCoverSubtitle';

interface FrameState {
  opacity: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotate: number;
}

function getMimeType(hasAudio: boolean) {
  const h264Candidates = hasAudio
    ? ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4;codecs="avc1.42E01E"']
    : ['video/mp4;codecs="avc1.42E01E"', 'video/mp4;codecs="avc1"'];
  const candidates = [
    ...h264Candidates,
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

async function inspectCodec(blob: Blob) {
  const header = await blob.slice(0, Math.min(blob.size, 1024 * 1024)).arrayBuffer();
  const signature = new TextDecoder('latin1').decode(header);
  if (signature.includes('avc1') || signature.includes('avc3')) return 'h264';
  if (signature.includes('vp09') || signature.includes('vp9')) return 'vp9';
  if (signature.includes('vp08') || signature.includes('vp8')) return 'vp8';
  return 'unknown';
}

async function makeCompatibleVideo(
  blob: Blob,
  signal: AbortSignal,
  onProgress: (progress: ExportProgress) => void
) {
  const codec = await inspectCodec(blob);
  if (blob.type.includes('mp4') && codec === 'h264') return {blob, extension: 'mp4'};

  if (Capacitor.isNativePlatform()) {
    if (blob.type.includes('webm')) return {blob, extension: 'webm'};
    throw new Error(`当前设备生成了 ${codec.toUpperCase()} 编码，无法封装为兼容 MP4`);
  }

  if (location.protocol === 'http:' || location.protocol === 'https:') {
    onProgress({progress: 99, message: '正在转换为兼容的 H.264 MP4'});
    const response = await fetch('/api/transcode-video', {
      method: 'POST',
      headers: {'Content-Type': blob.type || 'application/octet-stream'},
      body: blob,
      signal
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `视频兼容转换失败 (${response.status})`);
    }
    return {blob: await response.blob(), extension: 'mp4'};
  }

  if (blob.type.includes('webm')) return {blob, extension: 'webm'};
  throw new Error(`当前运行环境生成了 ${codec.toUpperCase()} 编码，无法直接导出兼容 MP4`);
}

async function loadImage(src: string) {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

const websiteCoverBaseSrc = new URL('./presets/website-series-cover-base-v2.png', document.baseURI).href;
const websiteCoverForegroundSrc = new URL('./presets/website-series-cover-person-foreground-v2.png', document.baseURI).href;
const websiteCoverSubtitleBrushSrc = new URL('./presets/website-series-cover-subtitle-brush.png', document.baseURI).href;

function drawWebsiteCover(
  context: CanvasRenderingContext2D,
  config: WebsiteCoverConfig,
  base: HTMLImageElement,
  foreground: HTMLImageElement,
  subtitleBrush: HTMLImageElement,
  screenshot: HTMLImageElement | undefined,
  width: number,
  height: number
) {
  const sx = width / 1086;
  const sy = height / 1448;
  const subtitleLayout = getWebsiteCoverSubtitleLayout(config.subtitle);
  const subtitleScale = normalizeWebsiteCoverSubtitleScale(config.subtitleScale);
  context.drawImage(base, 0, 0, width, height);

  const drawScreenshot = () => {
    if (!screenshot) return;
    drawWebsiteCoverScreenshot(context, screenshot, config, width, height);
  };

  drawScreenshot();
  context.drawImage(foreground, 0, 0, width, height);
  context.save();
  context.translate(WEBSITE_COVER_SUBTITLE_CENTER_X * sx, WEBSITE_COVER_SUBTITLE_CENTER_Y * sy);
  context.scale(subtitleScale * sx, subtitleScale * sy);
  context.drawImage(
    subtitleBrush,
    -subtitleLayout.width / 2,
    -subtitleLayout.height / 2,
    subtitleLayout.width,
    subtitleLayout.height
  );
  context.restore();
  context.save();
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.fillStyle = '#178bff';
  context.font = `900 ${43 * sx}px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
  context.fillText(`第${Math.max(1, Math.round(config.issue))}期`, 540 * sx, 656 * sy);

  context.save();
  context.translate(WEBSITE_COVER_SUBTITLE_CENTER_X * sx, WEBSITE_COVER_SUBTITLE_CENTER_Y * sy);
  context.scale(subtitleScale * sx, subtitleScale * sy);
  context.fillStyle = '#ffffff';
  context.font = `900 ${WEBSITE_COVER_SUBTITLE_FONT_SIZE}px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
  context.textBaseline = 'middle';
  subtitleLayout.lines.forEach((line, index) => {
    context.fillText(line, 0, subtitleLayout.firstLineY + index * WEBSITE_COVER_SUBTITLE_LINE_HEIGHT);
  });
  context.restore();
  context.restore();
}

function mediaFilter(image: ImageLayer | VideoLayer) {
  return [
    `brightness(${image.brightness}%)`,
    `contrast(${image.contrast}%)`,
    `saturate(${image.saturation}%)`,
    `hue-rotate(${image.hue}deg)`
  ].join(' ');
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function easeOutBack(value: number) {
  const p = clamp01(value);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

function imageFrameState(image: Pick<ImageLayer, 'entrance' | 'exit' | 'animationDuration'>, localTime: number, slideDuration: number): FrameState {
  const frame = {opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0};
  const duration = Math.max(0.2, image.animationDuration || 0.8);
  const entranceP = easeOutCubic(localTime / duration);

  if (image.entrance === 'gsap-zoom') frame.scaleX = frame.scaleY = 1.38 - 0.38 * entranceP;
  if (image.entrance === 'gsap-rotate') {
    frame.scaleX = frame.scaleY = 0.62 + 0.38 * easeOutBack(localTime / duration);
    frame.rotate = -18 * (1 - entranceP);
  }
  if (image.entrance === 'anime-elastic') frame.scaleX = frame.scaleY = 0.55 + 0.45 * easeOutBack(localTime / duration);
  if (image.entrance === 'anime-swing') {
    frame.x = -0.28 * (1 - entranceP);
    frame.rotate = -16 * (1 - entranceP);
  }
  if (image.entrance === 'animate-bounce') {
    const bounce = Math.sin(clamp01(localTime / duration) * Math.PI * 3) * (1 - entranceP);
    frame.y = -0.22 * (1 - entranceP) - bounce * 0.04;
  }
  if (image.entrance === 'animate-flip') frame.scaleX = Math.max(0.05, entranceP);
  if (image.entrance === 'motion-spring') {
    const springP = easeOutBack(localTime / duration);
    frame.y = 0.24 * (1 - springP);
    frame.scaleX = frame.scaleY = 0.82 + 0.18 * springP;
  }
  if (image.entrance === 'motion-slide') frame.x = 0.75 * (1 - entranceP);
  if (image.entrance !== 'none' && localTime < duration) frame.opacity = entranceP;

  const exitStart = Math.max(0, slideDuration - duration);
  if (image.exit !== 'none' && slideDuration > duration + 0.2 && localTime >= exitStart) {
    const p = Math.pow(clamp01((localTime - exitStart) / duration), 3);
    Object.assign(frame, {opacity: 1 - p, x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0});
    if (image.exit === 'gsap-zoom-out') frame.scaleX = frame.scaleY = 1 - 0.38 * p;
    if (image.exit === 'gsap-rotate-out') {
      frame.scaleX = frame.scaleY = 1 - 0.3 * p;
      frame.rotate = 22 * p;
    }
    if (image.exit === 'anime-collapse') {
      frame.scaleX = 1 - 0.95 * p;
      frame.scaleY = 1 - 0.3 * p;
    }
    if (image.exit === 'anime-swing-out') {
      frame.x = 0.35 * p;
      frame.rotate = 18 * p;
    }
    if (image.exit === 'animate-bounce-out') frame.y = 0.32 * p;
    if (image.exit === 'animate-flip-out') frame.scaleX = Math.max(0.05, 1 - p);
    if (image.exit === 'motion-drop') {
      frame.y = 0.45 * p;
      frame.scaleX = frame.scaleY = 1 - 0.14 * p;
    }
    if (image.exit === 'motion-slide-out') frame.x = -0.78 * p;
  }
  return frame;
}

function transitionFrameState(slide: Slide, localTime: number) {
  const duration = Math.max(0.2, slide.transitionDuration || 0.7);
  const p = easeOutCubic(localTime / duration);
  const frame = {opacity: 1, x: 0, scaleX: 1, scaleY: 1};
  if (slide.transition === 'none' || localTime >= duration) return frame;
  frame.opacity = p;
  if (slide.transition === 'gsap-fade') frame.scaleX = frame.scaleY = 1.04 - 0.04 * p;
  if (slide.transition === 'anime-slide') frame.x = 0.14 * (1 - p);
  if (slide.transition === 'animate-flip') frame.scaleX = Math.max(0.05, p);
  if (slide.transition === 'motion-zoom') frame.scaleX = frame.scaleY = 1.16 - 0.16 * p;
  return frame;
}

function drawImageLayer(
  context: CanvasRenderingContext2D,
  source: HTMLImageElement | undefined,
  image: ImageLayer,
  width: number,
  height: number,
  localTime: number,
  slideDuration: number
) {
  if (!source) return;
  const baseScale = image.fit === 'contain'
    ? Math.min(width / source.naturalWidth, height / source.naturalHeight)
    : Math.max(width / source.naturalWidth, height / source.naturalHeight);
  const drawWidth = source.naturalWidth * baseScale;
  const drawHeight = source.naturalHeight * baseScale;
  const frame = imageFrameState(image, localTime, slideDuration);

  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.clip();
  context.filter = mediaFilter(image);
  context.globalAlpha *= frame.opacity;
  context.translate(width / 2 + (image.x / 100 + frame.x) * width, height / 2 + (image.y / 100 + frame.y) * height);
  context.rotate(((image.rotate + frame.rotate) * Math.PI) / 180);
  context.scale(image.scale * frame.scaleX, image.scale * frame.scaleY);
  context.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  context.restore();
}

function videoFrameRect(video: VideoLayer, width: number, height: number) {
  if (video.layout === 'left') return {x: 0, y: 0, width: width / 2, height};
  if (video.layout === 'right') return {x: width / 2, y: 0, width: width / 2, height};
  if (video.layout === 'top') return {x: 0, y: 0, width, height: height / 2};
  if (video.layout === 'bottom') return {x: 0, y: height / 2, width, height: height / 2};
  return {x: 0, y: 0, width, height};
}

function drawVideoLayer(
  context: CanvasRenderingContext2D,
  source: HTMLVideoElement | undefined,
  video: VideoLayer,
  width: number,
  height: number,
  localTime: number,
  slideDuration: number
) {
  if (!source || source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !source.videoWidth) return;
  const rect = videoFrameRect(video, width, height);
  const baseScale = video.fit === 'contain'
    ? Math.min(rect.width / source.videoWidth, rect.height / source.videoHeight)
    : Math.max(rect.width / source.videoWidth, rect.height / source.videoHeight);
  const drawWidth = source.videoWidth * baseScale;
  const drawHeight = source.videoHeight * baseScale;
  const frame = imageFrameState(video, localTime, slideDuration);

  context.save();
  context.beginPath();
  context.rect(rect.x, rect.y, rect.width, rect.height);
  context.clip();
  context.filter = mediaFilter(video);
  context.globalAlpha *= frame.opacity;
  context.translate(
    rect.x + rect.width / 2 + (video.x / 100 + frame.x) * rect.width,
    rect.y + rect.height / 2 + (video.y / 100 + frame.y) * rect.height
  );
  context.rotate(((video.rotate + frame.rotate) * Math.PI) / 180);
  context.scale(video.scale * frame.scaleX, video.scale * frame.scaleY);
  context.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  context.restore();
}

function loadVideo(src: string) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.playsInline = true;
    video.oncanplay = () => resolve(video);
    video.onerror = () => reject(new Error('导出前无法加载视频素材'));
    video.src = src;
    video.load();
  });
}

function mediaTimeAt(video: VideoLayer, localTime: number) {
  const clipDuration = Math.max(0.1, video.trimEnd - video.trimStart);
  const elapsed = Math.max(0, localTime * video.playbackRate);
  if (video.loop) return video.trimStart + (elapsed % clipDuration);
  return Math.min(video.trimEnd - 0.02, video.trimStart + elapsed);
}

function textAnimationProgress(text: TextLayer, localTime: number) {
  const progress = clamp01(localTime / 0.75);
  if (text.animation === 'fade') return {opacity: progress, y: 0, scale: 1, chars: Infinity};
  if (text.animation === 'rise') return {opacity: progress, y: (1 - progress) * 28, scale: 1, chars: Infinity};
  if (text.animation === 'pop') return {opacity: progress, y: 0, scale: 0.82 + progress * 0.18, chars: Infinity};
  if (text.animation === 'wipe') return {opacity: 1, y: 0, scale: 1, chars: Math.ceil(text.content.length * progress)};
  return {opacity: 1, y: 0, scale: 1, chars: Infinity};
}

function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  String(text || '').split('\n').forEach((paragraph) => {
    let line = '';
    Array.from(paragraph).forEach((character) => {
      const candidate = line + character;
      if (context.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    });
    lines.push(line);
  });
  return lines;
}

function drawText(
  context: CanvasRenderingContext2D,
  text: TextLayer,
  width: number,
  height: number,
  localTime: number,
  aspect: AspectRatio,
  linkedFrame?: FrameState
) {
  const progress = linkedFrame
    ? {opacity: 1, y: 0, scale: 1, chars: Infinity}
    : textAnimationProgress(text, localTime);
  const content = progress.chars === Infinity ? text.content : Array.from(text.content).slice(0, progress.chars).join('');
  const fontSize = Math.round(text.fontSize * (width / (isPortraitAspect(aspect) ? 420 : 760)));
  context.save();
  context.globalAlpha *= progress.opacity * (linkedFrame?.opacity ?? 1);
  context.translate(
    (text.x / 100) * width + (linkedFrame?.x ?? 0) * width,
    (text.y / 100) * height + progress.y + (linkedFrame?.y ?? 0) * height
  );
  context.rotate(((linkedFrame?.rotate ?? 0) * Math.PI) / 180);
  context.scale(
    progress.scale * (linkedFrame?.scaleX ?? 1),
    progress.scale * (linkedFrame?.scaleY ?? 1)
  );
  context.font = `${text.italic ? 'italic ' : ''}${text.bold ? '800' : '500'} ${fontSize}px ${text.fontFamily}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = text.color;
  if (text.shadow) {
    context.shadowColor = 'rgba(0,0,0,0.75)';
    context.shadowBlur = 18;
    context.shadowOffsetY = 5;
  }
  const lines = wrapLines(context, content, width * 0.86);
  const lineHeight = fontSize * 1.18;
  const startY = -((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight;
    context.fillText(line, 0, lineY);
    if (text.lineThrough) {
      const decorationWidth = context.measureText(line).width;
      const thickness = Math.max(2, fontSize * 0.055);
      context.save();
      context.shadowColor = 'transparent';
      context.globalAlpha *= 0.82;
      context.fillStyle = '#e8ebf1';
      context.fillRect(-decorationWidth / 2, lineY - thickness / 2, decorationWidth, thickness);
      context.restore();
    }
  });
  context.restore();
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  source: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const scale = Math.max(width / source.naturalWidth, height / source.naturalHeight);
  const drawWidth = source.naturalWidth * scale;
  const drawHeight = source.naturalHeight * scale;
  context.save();
  roundedRect(context, x, y, width, height, radius);
  context.clip();
  context.drawImage(source, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  let value = text || '';
  while (value.length > 1 && context.measureText(value).width > maxWidth) value = `${value.slice(0, -2)}…`;
  return value;
}

function drawPlayerOutro(
  context: CanvasRenderingContext2D,
  config: PlayerOutroConfig,
  poster: HTMLImageElement | undefined,
  width: number,
  height: number,
  localTime: number,
  aspect: AspectRatio
) {
  const portrait = isPortraitAspect(aspect);
  context.fillStyle = '#11110f';
  context.fillRect(0, 0, width, height);

  const titleY = portrait ? height * 0.2 : height * 0.1;
  const titleSize = portrait ? 52 : 38;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#55d6a9';
  context.font = `800 ${portrait ? 21 : 17}px system-ui, sans-serif`;
  context.fillText('正在热播', width / 2, titleY - titleSize * 0.9);
  context.fillStyle = '#f7f7f4';
  context.font = `850 ${titleSize}px system-ui, sans-serif`;
  context.fillText(fitText(context, config.showTitle || '未命名剧集', width * 0.78), width / 2, titleY);
  context.fillStyle = '#b9bbc1';
  context.font = `600 ${portrait ? 25 : 19}px system-ui, sans-serif`;
  context.fillText(fitText(context, config.prompt || '精彩继续，点击追剧', width * 0.82), width / 2, titleY + titleSize * 0.9);

  const deviceWidth = width * (portrait ? 0.86 : 0.56);
  const deviceHeight = deviceWidth * (9 / 16);
  const deviceX = (width - deviceWidth) / 2;
  const deviceY = portrait ? height * 0.37 : height * 0.28;
  const shellPadX = portrait ? 18 : 15;
  const shellPadY = portrait ? 13 : 10;
  const framePadX = portrait ? 11 : 9;
  const framePadY = portrait ? 8 : 6;
  const deviceRadius = portrait ? 31 : 25;
  const shellX = deviceX - shellPadX;
  const shellY = deviceY - shellPadY;
  const shellWidth = deviceWidth + shellPadX * 2;
  const shellHeight = deviceHeight + shellPadY * 2;

  context.fillStyle = '#34363a';
  roundedRect(context, shellX + shellWidth * 0.18, shellY - 6, 45, 7, 4);
  context.fill();
  roundedRect(context, shellX + shellWidth * 0.31, shellY - 6, 45, 7, 4);
  context.fill();
  roundedRect(context, shellX + shellWidth * 0.73, shellY - 6, 62, 7, 4);
  context.fill();

  const shellGradient = context.createLinearGradient(shellX, shellY, shellX + shellWidth, shellY + shellHeight);
  shellGradient.addColorStop(0, '#9da0a5');
  shellGradient.addColorStop(0.16, '#303237');
  shellGradient.addColorStop(0.5, '#08090b');
  shellGradient.addColorStop(0.84, '#4e5156');
  shellGradient.addColorStop(1, '#a3a6aa');
  context.fillStyle = shellGradient;
  context.strokeStyle = '#a3a6aa';
  context.lineWidth = 2;
  roundedRect(context, shellX, shellY, shellWidth, shellHeight, deviceRadius);
  context.fill();
  context.stroke();

  context.fillStyle = '#020304';
  roundedRect(
    context,
    deviceX - framePadX,
    deviceY - framePadY,
    deviceWidth + framePadX * 2,
    deviceHeight + framePadY * 2,
    deviceRadius - 5
  );
  context.fill();
  context.strokeStyle = '#24272c';
  context.lineWidth = 2;
  context.stroke();

  if (poster) {
    drawCoverImage(context, poster, deviceX, deviceY, deviceWidth, deviceHeight, deviceRadius - 10);
  } else {
    context.fillStyle = '#151820';
    roundedRect(context, deviceX, deviceY, deviceWidth, deviceHeight, deviceRadius - 10);
    context.fill();
    context.fillStyle = '#8c919c';
    context.font = `700 ${portrait ? 22 : 18}px system-ui, sans-serif`;
    context.fillText('替换剧集画面', width / 2, deviceY + deviceHeight / 2);
  }

  const shade = context.createLinearGradient(0, deviceY, 0, deviceY + deviceHeight);
  shade.addColorStop(0, 'rgba(2,3,5,.48)');
  shade.addColorStop(0.38, 'rgba(2,3,5,0)');
  shade.addColorStop(1, 'rgba(2,3,5,.84)');
  context.fillStyle = shade;
  roundedRect(context, deviceX, deviceY, deviceWidth, deviceHeight, deviceRadius - 10);
  context.fill();

  const glass = context.createLinearGradient(deviceX, deviceY, deviceX + deviceWidth, deviceY + deviceHeight);
  glass.addColorStop(0, 'rgba(255,255,255,.14)');
  glass.addColorStop(0.22, 'rgba(255,255,255,0)');
  glass.addColorStop(0.78, 'rgba(255,255,255,0)');
  glass.addColorStop(1, 'rgba(255,255,255,.04)');
  context.fillStyle = glass;
  roundedRect(context, deviceX, deviceY, deviceWidth, deviceHeight, deviceRadius - 10);
  context.fill();

  const sensorX = deviceX + (portrait ? 7 : 6);
  const sensorHeight = portrait ? 48 : 38;
  const sensorY = deviceY + (deviceHeight - sensorHeight) / 2;
  context.fillStyle = '#010203';
  roundedRect(context, sensorX, sensorY, portrait ? 13 : 10, sensorHeight, 7);
  context.fill();
  context.fillStyle = '#19304e';
  context.beginPath();
  context.arc(sensorX + (portrait ? 6.5 : 5), sensorY + 11, portrait ? 3.5 : 2.5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#17191c';
  roundedRect(context, sensorX + (portrait ? 5 : 4), sensorY + 23, portrait ? 3 : 2, portrait ? 15 : 11, 2);
  context.fill();

  context.textAlign = 'left';
  context.fillStyle = '#ffffff';
  context.font = `750 ${portrait ? 17 : 14}px system-ui, sans-serif`;
  const screenTitle = `${config.showTitle || '未命名剧集'} · ${config.episode || '第 1 集'}`;
  context.fillText(fitText(context, screenTitle, deviceWidth - 42), deviceX + 20, deviceY + 28);

  const progressX = deviceX + 20;
  const progressWidth = deviceWidth - 40;
  const progressY = deviceY + deviceHeight - (portrait ? 52 : 44);
  context.fillStyle = 'rgba(255,255,255,.34)';
  roundedRect(context, progressX, progressY, progressWidth, 5, 3);
  context.fill();
  const animatedProgress = clamp01(config.progress / 100) * (0.28 + 0.72 * easeOutCubic(localTime / 2.4));
  context.fillStyle = '#55d6a9';
  roundedRect(context, progressX, progressY, Math.max(5, progressWidth * animatedProgress), 5, 3);
  context.fill();

  const controlsY = progressY + (portrait ? 28 : 23);
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.moveTo(progressX, controlsY - 8);
  context.lineTo(progressX + 14, controlsY);
  context.lineTo(progressX, controlsY + 8);
  context.closePath();
  context.fill();
  context.textAlign = 'right';
  context.font = `700 ${portrait ? 15 : 12}px system-ui, sans-serif`;
  context.fillText(`${config.quality || '1080P'}   字幕   全屏`, deviceX + deviceWidth - 20, controlsY);

  context.fillStyle = 'rgba(255,255,255,.76)';
  roundedRect(
    context,
    deviceX + deviceWidth - (portrait ? 10 : 8),
    deviceY + deviceHeight / 2 - (portrait ? 24 : 19),
    portrait ? 4 : 3,
    portrait ? 48 : 38,
    3
  );
  context.fill();

}

function slideAtTime(slides: Slide[], time: number) {
  let cursor = 0;
  for (const slide of slides) {
    const end = cursor + slide.duration;
    if (time >= cursor && time < end) return {slide, localTime: time - cursor};
    cursor = end;
  }
  const slide = slides.at(-1)!;
  return {slide, localTime: slide.duration};
}

export async function exportStudioVideo(
  state: StudioState,
  signal: AbortSignal,
  onProgress: (progress: ExportProgress) => void
) {
  if (!state.slides.some((slide) => slide.images.length || slide.videos.length || slide.player?.posterSrc || slide.websiteCover)) throw new Error('请至少放入一张图片、视频或封面模板再导出');
  const hasVideoAudio = state.slides.some((slide) => slide.videos.some((video) => !video.muted && video.volume > 0));
  const mimeType = getMimeType(Boolean(state.narration.audioUrl || hasVideoAudio));
  if (!mimeType) throw new Error('当前浏览器不支持 MediaRecorder 视频导出');

  const {width, height} = aspectDimensions(state.aspect);
  const timelineDuration = state.slides.reduce((sum, slide) => sum + slide.duration, 0);
  const duration = Math.max(timelineDuration, state.narration.duration || 0);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建视频画布');

  onProgress({progress: 0, message: '加载图片与视频素材'});
  const imageCache = new Map<string, HTMLImageElement>();
  for (const slide of state.slides) {
    for (const image of slide.images) {
      if (!imageCache.has(image.src)) imageCache.set(image.src, await loadImage(image.src));
    }
    if (slide.player?.posterSrc && !imageCache.has(slide.player.posterSrc)) {
      imageCache.set(slide.player.posterSrc, await loadImage(slide.player.posterSrc));
    }
    if (slide.websiteCover) {
      if (!imageCache.has(websiteCoverBaseSrc)) imageCache.set(websiteCoverBaseSrc, await loadImage(websiteCoverBaseSrc));
      if (!imageCache.has(websiteCoverForegroundSrc)) imageCache.set(websiteCoverForegroundSrc, await loadImage(websiteCoverForegroundSrc));
      if (!imageCache.has(websiteCoverSubtitleBrushSrc)) imageCache.set(websiteCoverSubtitleBrushSrc, await loadImage(websiteCoverSubtitleBrushSrc));
      if (slide.websiteCover.screenshotSrc && !imageCache.has(slide.websiteCover.screenshotSrc)) {
        imageCache.set(slide.websiteCover.screenshotSrc, await loadImage(slide.websiteCover.screenshotSrc));
      }
    }
  }

  const videoCache = new Map<string, HTMLVideoElement>();
  for (const slide of state.slides) {
    for (const video of slide.videos) {
      if (!videoCache.has(video.id)) videoCache.set(video.id, await loadVideo(video.src));
    }
  }

  const stream = canvas.captureStream(30);
  let audioElement: HTMLAudioElement | null = null;
  const audioContext = state.narration.audioUrl || hasVideoAudio ? new AudioContext() : null;
  const audioDestination = audioContext?.createMediaStreamDestination() || null;
  if (state.narration.audioUrl && audioContext && audioDestination) {
    audioElement = new Audio(state.narration.audioUrl);
    const source = audioContext.createMediaElementSource(audioElement);
    source.connect(audioDestination);
  }
  if (audioContext && audioDestination) {
    for (const slide of state.slides) {
      for (const video of slide.videos) {
        const element = videoCache.get(video.id);
        if (!element) continue;
        const source = audioContext.createMediaElementSource(element);
        const gain = audioContext.createGain();
        gain.gain.value = video.muted ? 0 : video.volume / 100;
        source.connect(gain).connect(audioDestination);
      }
    }
    audioDestination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
  }

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {mimeType, videoBitsPerSecond: 8_000_000});
  const recordedMimeType = recorder.mimeType || mimeType;
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const finished = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  const startedAt = performance.now();
  let frameTimer = 0;
  let activeSlideId = '';

  const syncVideoPlayback = (slide: Slide, localTime: number) => {
    if (slide.id !== activeSlideId) {
      state.slides.forEach((item) => item.videos.forEach((video) => videoCache.get(video.id)?.pause()));
      activeSlideId = slide.id;
      slide.videos.forEach((video) => {
        const element = videoCache.get(video.id);
        if (!element) return;
        element.currentTime = mediaTimeAt(video, localTime);
        element.playbackRate = video.playbackRate;
        element.muted = !audioContext;
        void element.play().catch(() => undefined);
      });
    }
    slide.videos.forEach((video) => {
      const element = videoCache.get(video.id);
      if (!element) return;
      const target = mediaTimeAt(video, localTime);
      if (Math.abs(element.currentTime - target) > 0.22) element.currentTime = target;
      if (!video.loop && localTime * video.playbackRate >= video.trimEnd - video.trimStart) element.pause();
    });
  };

  const drawFrame = () => {
    const elapsed = (performance.now() - startedAt) / 1000;
    if (signal.aborted || elapsed >= duration) {
      recorder.stop();
      return;
    }
    const time = Math.min(elapsed, duration);
    const {slide, localTime} = slideAtTime(state.slides, time);
    syncVideoPlayback(slide, localTime);
    context.fillStyle = '#050608';
    context.fillRect(0, 0, width, height);
    const transition = transitionFrameState(slide, localTime);
    context.save();
    context.globalAlpha = transition.opacity;
    context.translate(width / 2 + transition.x * width, height / 2);
    context.scale(transition.scaleX, transition.scaleY);
    context.translate(-width / 2, -height / 2);
    if (slide.kind === 'website-cover' && slide.websiteCover) {
      drawWebsiteCover(
        context,
        slide.websiteCover,
        imageCache.get(websiteCoverBaseSrc)!,
        imageCache.get(websiteCoverForegroundSrc)!,
        imageCache.get(websiteCoverSubtitleBrushSrc)!,
        imageCache.get(slide.websiteCover.screenshotSrc),
        width,
        height
      );
    } else if (slide.kind === 'player-outro' && slide.player) {
      drawPlayerOutro(context, slide.player, imageCache.get(slide.player.posterSrc), width, height, localTime, state.aspect);
    } else {
      slide.videos.forEach((video) => drawVideoLayer(
        context,
        videoCache.get(video.id),
        video,
        width,
        height,
        localTime,
        slide.duration
      ));
      orderedSlideImages(slide).forEach((image) => {
        const entranceDelay = imageEntranceDelay(slide, image.id);
        if (localTime < entranceDelay) return;
        drawImageLayer(
          context,
          imageCache.get(image.src),
          image,
          width,
          height,
          localTime - entranceDelay,
          slide.duration - entranceDelay
        );
      });
      slide.texts.forEach((text) => {
        const linkedImage = text.linkedImageId
          ? slide.images.find((image) => image.id === text.linkedImageId)
          : undefined;
        if (!linkedImage) {
          drawText(context, text, width, height, localTime, state.aspect);
          return;
        }
        const entranceDelay = imageEntranceDelay(slide, linkedImage.id);
        if (localTime < entranceDelay) return;
        const linkedLocalTime = localTime - entranceDelay;
        drawText(
          context,
          text,
          width,
          height,
          linkedLocalTime,
          state.aspect,
          imageFrameState(linkedImage, linkedLocalTime, slide.duration - entranceDelay)
        );
      });
    }
    context.restore();
    onProgress({progress: Math.round((time / duration) * 100), message: `合成中 ${time.toFixed(1)} / ${duration.toFixed(1)}s`});
    frameTimer = window.setTimeout(drawFrame, 1000 / 30);
  };

  recorder.start(250);
  if (audioContext) await audioContext.resume();
  if (audioElement) await audioElement.play();
  drawFrame();
  await finished;
  window.clearTimeout(frameTimer);
  audioElement?.pause();
  videoCache.forEach((video) => video.pause());
  if (audioContext) await audioContext.close();
  stream.getTracks().forEach((track) => track.stop());
  if (signal.aborted) throw new DOMException('导出已取消', 'AbortError');

  const result = await makeCompatibleVideo(new Blob(chunks, {type: recordedMimeType}), signal, onProgress);
  onProgress({progress: 100, message: '完成 H.264 视频封装'});
  return result;
}

function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('无法生成 PNG 图片')), 'image/png');
  });
}

export async function exportSlideImage(state: StudioState, slide: Slide) {
  if (!slide.images.length && !slide.videos.length && !slide.player?.posterSrc && !slide.texts.length && !slide.websiteCover) {
    throw new Error('当前屏幕还没有可导出的内容');
  }
  const {width, height} = aspectDimensions(state.aspect);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建图片画布');

  const imageCache = new Map<string, HTMLImageElement>();
  for (const image of slide.images) imageCache.set(image.src, await loadImage(image.src));
  if (slide.player?.posterSrc) imageCache.set(slide.player.posterSrc, await loadImage(slide.player.posterSrc));
  if (slide.websiteCover) {
    imageCache.set(websiteCoverBaseSrc, await loadImage(websiteCoverBaseSrc));
    imageCache.set(websiteCoverForegroundSrc, await loadImage(websiteCoverForegroundSrc));
    imageCache.set(websiteCoverSubtitleBrushSrc, await loadImage(websiteCoverSubtitleBrushSrc));
    if (slide.websiteCover.screenshotSrc) imageCache.set(slide.websiteCover.screenshotSrc, await loadImage(slide.websiteCover.screenshotSrc));
  }

  const videoCache = new Map<string, HTMLVideoElement>();
  for (const video of slide.videos) {
    const element = await loadVideo(video.src);
    const targetTime = Math.min(video.trimStart, Math.max(0, element.duration - 0.02));
    if (Math.abs(element.currentTime - targetTime) > 0.01) {
      await new Promise<void>((resolve, reject) => {
        element.onseeked = () => resolve();
        element.onerror = () => reject(new Error('无法读取视频封面帧'));
        element.currentTime = targetTime;
      });
    }
    videoCache.set(video.id, element);
  }

  context.fillStyle = '#050608';
  context.fillRect(0, 0, width, height);
  if (slide.kind === 'website-cover' && slide.websiteCover) {
    drawWebsiteCover(
      context,
      slide.websiteCover,
      imageCache.get(websiteCoverBaseSrc)!,
      imageCache.get(websiteCoverForegroundSrc)!,
      imageCache.get(websiteCoverSubtitleBrushSrc)!,
      imageCache.get(slide.websiteCover.screenshotSrc),
      width,
      height
    );
  } else if (slide.kind === 'player-outro' && slide.player) {
    drawPlayerOutro(context, slide.player, imageCache.get(slide.player.posterSrc), width, height, slide.duration, state.aspect);
  } else {
    slide.videos.forEach((video) => drawVideoLayer(context, videoCache.get(video.id), {...video, entrance: 'none', exit: 'none'}, width, height, slide.duration, slide.duration));
    slide.images.forEach((image) => drawImageLayer(context, imageCache.get(image.src), {...image, entrance: 'none', exit: 'none'}, width, height, slide.duration, slide.duration));
    slide.texts.forEach((text) => drawText(context, {...text, animation: 'none'}, width, height, slide.duration, state.aspect));
  }
  return {blob: await canvasToPng(canvas), width, height};
}
