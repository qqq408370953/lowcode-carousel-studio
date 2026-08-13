import {useEffect, useRef} from 'react';
import {
  getWebsiteCoverSubtitleLayout,
  normalizeWebsiteCoverSubtitleScale,
  WEBSITE_COVER_SUBTITLE_CENTER_X,
  WEBSITE_COVER_SUBTITLE_CENTER_Y,
  WEBSITE_COVER_SUBTITLE_FONT_SIZE,
  WEBSITE_COVER_SUBTITLE_LINE_HEIGHT
} from '../lib/websiteCoverSubtitle';
import type {WebsiteCoverConfig} from '../types';
import {drawWebsiteCoverScreenshot, WEBSITE_COVER_HEIGHT, WEBSITE_COVER_WIDTH} from '../lib/perspectiveImage';

interface WebsiteCoverProps {
  config: WebsiteCoverConfig;
  editable?: boolean;
  onUpdate?: (patch: Partial<WebsiteCoverConfig>) => void;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
  stageWidth: number;
  stageHeight: number;
}

const websiteCoverBaseSrc = new URL('./presets/website-series-cover-base-v2.png', document.baseURI).href;
const websiteCoverForegroundSrc = new URL('./presets/website-series-cover-person-foreground-v2.png', document.baseURI).href;
const websiteCoverSubtitleBrushSrc = new URL('./presets/website-series-cover-subtitle-brush.png', document.baseURI).href;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function WebsiteCover({config, editable = false, onUpdate}: WebsiteCoverProps) {
  const dragRef = useRef<DragState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const subtitleLayout = getWebsiteCoverSubtitleLayout(config.subtitle);
  const subtitleScale = normalizeWebsiteCoverSubtitleScale(config.subtitleScale);
  const subtitleTransform = `translate(${WEBSITE_COVER_SUBTITLE_CENTER_X} ${WEBSITE_COVER_SUBTITLE_CENTER_Y}) scale(${subtitleScale})`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!config.screenshotSrc) return;
    const image = new Image();
    image.src = config.screenshotSrc;
    void image.decode().then(() => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      drawWebsiteCoverScreenshot(context, image, config);
    }).catch(() => undefined);
  }, [config]);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || !onUpdate) return;
    event.preventDefault();
    event.stopPropagation();
    const stage = event.currentTarget.closest('.stage')?.getBoundingClientRect();
    if (!stage) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: config.screenshotX,
      baseY: config.screenshotY,
      stageWidth: stage.width,
      stageHeight: stage.height
    };
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!editable || !onUpdate || drag?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    onUpdate({
      screenshotX: clamp(drag.baseX + ((event.clientX - drag.startX) / drag.stageWidth) * 100, -50, 50),
      screenshotY: clamp(drag.baseY + ((event.clientY - drag.startY) / drag.stageHeight) * 100, -50, 50)
    });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = null;
  };

  return (
    <div className="website-cover">
      <img className="website-cover-base" src={websiteCoverBaseSrc} alt="" draggable={false} />
      <svg className="website-cover-subtitle-background" viewBox="0 0 1086 1448" aria-hidden="true">
        <g transform={subtitleTransform}>
          <image
            href={websiteCoverSubtitleBrushSrc}
            x={-subtitleLayout.width / 2}
            y={-subtitleLayout.height / 2}
            width={subtitleLayout.width}
            height={subtitleLayout.height}
            preserveAspectRatio="none"
          />
        </g>
      </svg>
      <canvas
        ref={canvasRef}
        className="website-cover-screen"
        width={WEBSITE_COVER_WIDTH}
        height={WEBSITE_COVER_HEIGHT}
        aria-label={config.screenshotName}
      />
      <div
        className={`website-cover-screen-hit ${editable ? 'editable' : ''}`}
        title={editable ? '拖动调整网页截图位置' : undefined}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
      <img className="website-cover-foreground" src={websiteCoverForegroundSrc} alt="" draggable={false} />
      <svg className="website-cover-labels" viewBox="0 0 1086 1448" aria-hidden="true">
        <text className="website-cover-issue" x="540" y="656" textAnchor="middle">第{Math.max(1, Math.round(config.issue))}期</text>
        <g transform={subtitleTransform}>
          <text
            className="website-cover-subtitle"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{fontSize: WEBSITE_COVER_SUBTITLE_FONT_SIZE}}
          >
            {subtitleLayout.lines.map((line, index) => (
              <tspan key={`${index}-${line}`} x="0" y={subtitleLayout.firstLineY + index * WEBSITE_COVER_SUBTITLE_LINE_HEIGHT}>{line || ' '}</tspan>
            ))}
          </text>
        </g>
      </svg>
    </div>
  );
}
