import {forwardRef, useImperativeHandle, useRef, useState} from 'react';
import {Scaling} from 'lucide-react';
import {playImageAnimation, playLinkedTextAnimation, playSlideTransition, playVideoAnimation, resetStageAnimations} from '../lib/animationRuntime';
import {isPortraitAspect} from '../lib/aspect';
import {imageEntranceDelay, orderedSlideImages} from '../lib/imageSequence';
import type {AnimationDirection, AspectRatio, ImageLayer, Slide, TextLayer, VideoLayer} from '../types';
import {PlayerOutro} from './PlayerOutro';
import {WebsiteCover} from './WebsiteCover';
import type {WebsiteCoverConfig} from '../types';

export interface StageEditorHandle {
  playImage: (image: ImageLayer, direction: AnimationDirection) => void;
  playVideo: (video: VideoLayer, direction: AnimationDirection) => void;
  playSlide: (slide: Slide, includeTransition?: boolean) => void;
  reset: () => void;
}

interface StageEditorProps {
  aspect: AspectRatio;
  slide: Slide;
  selectedImageId: string;
  selectedVideoId: string;
  selectedTextId: string;
  previewing: boolean;
  onSelectImage: (imageId: string) => void;
  onUpdateImage: (imageId: string, patch: Partial<ImageLayer>) => void;
  onSelectVideo: (videoId: string) => void;
  onUpdateVideo: (videoId: string, patch: Partial<VideoLayer>) => void;
  onSelectText: (textId: string) => void;
  onUpdateText: (textId: string, patch: Partial<TextLayer>) => void;
  onClearSelection: () => void;
  onFilesDropped: (files: FileList) => void;
  onAssetDropped: (assetId: string) => void;
  onPlayerPosterFiles: (files: FileList) => void;
  onPlayerPosterAsset: (assetId: string) => void;
  onWebsiteScreenshotFiles: (files: FileList) => void;
  onWebsiteScreenshotAsset: (assetId: string) => void;
  onUpdateWebsiteCover: (patch: Partial<WebsiteCoverConfig>) => void;
}

interface PointerPoint {
  x: number;
  y: number;
}

interface ImageTransform {
  x: number;
  y: number;
  scale: number;
  rotate: number;
}

interface MediaGesture {
  mediaId: string;
  kind: 'image' | 'video';
  stage: DOMRect;
  pointers: Map<number, PointerPoint>;
  base: ImageTransform;
  latest: ImageTransform;
  dragStart: PointerPoint;
  pinch?: {
    center: PointerPoint;
    distance: number;
    angle: number;
    base: ImageTransform;
  };
}

interface TextGesture {
  textId: string;
  pointerId: number;
  stage: DOMRect;
}

interface ResizeGesture {
  mediaId: string;
  kind: 'image' | 'video';
  pointerId: number;
  center: PointerPoint;
  startDistance: number;
  baseScale: number;
}

function mediaFilter(media: ImageLayer | VideoLayer) {
  return `brightness(${media.brightness}%) contrast(${media.contrast}%) saturate(${media.saturation}%) hue-rotate(${media.hue}deg)`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRotation(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function gestureMetrics(points: PointerPoint[]) {
  const [first, second] = points;
  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;
  return {
    center: {x: (first.x + second.x) / 2, y: (first.y + second.y) / 2},
    distance: Math.max(1, Math.hypot(deltaX, deltaY)),
    angle: Math.atan2(deltaY, deltaX) * (180 / Math.PI)
  };
}

function resizeHandlePosition(image: ImageLayer) {
  const radians = image.rotate * (Math.PI / 180);
  const x = 50 + image.x + 50 * image.scale * (Math.cos(radians) - Math.sin(radians));
  const y = 50 + image.y + 50 * image.scale * (Math.sin(radians) + Math.cos(radians));
  return {
    left: `${clamp(x, 5, 95)}%`,
    top: `${clamp(y, 5, 95)}%`
  };
}

function videoResizeHandlePosition(video: VideoLayer) {
  const frame = videoFramePercent(video);
  return {
    left: `${clamp(frame.cx + video.x * frame.width / 100 + frame.width * video.scale / 2, 5, 95)}%`,
    top: `${clamp(frame.cy + video.y * frame.height / 100 + frame.height * video.scale / 2, 5, 95)}%`
  };
}

function videoFramePercent(video: VideoLayer) {
  return {
    full: {cx: 50, cy: 50, width: 100, height: 100},
    left: {cx: 25, cy: 50, width: 50, height: 100},
    right: {cx: 75, cy: 50, width: 50, height: 100},
    top: {cx: 50, cy: 25, width: 100, height: 50},
    bottom: {cx: 50, cy: 75, width: 100, height: 50}
  }[video.layout];
}

export const StageEditor = forwardRef<StageEditorHandle, StageEditorProps>(function StageEditor({
  aspect,
  slide,
  selectedImageId,
  selectedVideoId,
  selectedTextId,
  previewing,
  onSelectImage,
  onUpdateImage,
  onSelectVideo,
  onUpdateVideo,
  onSelectText,
  onUpdateText,
  onClearSelection,
  onFilesDropped,
  onAssetDropped,
  onPlayerPosterFiles,
  onPlayerPosterAsset,
  onWebsiteScreenshotFiles,
  onWebsiteScreenshotAsset,
  onUpdateWebsiteCover
}, ref) {
  const imagesRef = useRef<HTMLDivElement>(null);
  const animationTimers = useRef<number[]>([]);
  const imageGestureRef = useRef<MediaGesture | null>(null);
  const textGestureRef = useRef<TextGesture | null>(null);
  const resizeGestureRef = useRef<ResizeGesture | null>(null);
  const [dragging, setDragging] = useState(false);
  const selectedImage = slide.images.find((image) => image.id === selectedImageId);
  const selectedVideo = slide.videos.find((video) => video.id === selectedVideoId);

  const updateMedia = (kind: MediaGesture['kind'], id: string, patch: Partial<ImageTransform>) => {
    if (kind === 'image') onUpdateImage(id, patch);
    else onUpdateVideo(id, patch);
  };

  const clearAnimationTimers = () => {
    animationTimers.current.forEach(window.clearTimeout);
    animationTimers.current = [];
  };

  useImperativeHandle(ref, () => ({
    playImage(image, direction) {
      if (imagesRef.current) playImageAnimation(imagesRef.current, image, direction);
    },
    playVideo(video, direction) {
      if (imagesRef.current) playVideoAnimation(imagesRef.current, video, direction);
    },
    playSlide(activeSlide, includeTransition = true) {
      if (!imagesRef.current) return;
      clearAnimationTimers();
      if (includeTransition) playSlideTransition(imagesRef.current, activeSlide);
      activeSlide.videos.forEach((video) => {
        const node = imagesRef.current?.querySelector<HTMLVideoElement>(`.stage-video[data-id="${video.id}"]`);
        if (!node) return;
        if (node.readyState >= HTMLMediaElement.HAVE_METADATA) {
          node.currentTime = Math.min(video.trimStart, Math.max(0, node.duration || video.trimStart));
        }
        node.playbackRate = video.playbackRate;
        node.volume = video.volume / 100;
        node.muted = video.muted;
        void node.play().catch(() => undefined);
        playVideoAnimation(imagesRef.current!, video, 'entrance');
        if (video.exit !== 'none' && activeSlide.duration > video.animationDuration + 0.2) {
          animationTimers.current.push(window.setTimeout(
            () => imagesRef.current && playVideoAnimation(imagesRef.current, video, 'exit'),
            Math.max(0, activeSlide.duration - video.animationDuration) * 1000
          ));
        }
      });
      const orderedImages = orderedSlideImages(activeSlide);
      orderedImages.forEach((image) => {
        const node = imagesRef.current?.querySelector<HTMLElement>(`.stage-image[data-id="${image.id}"]`);
        if (node) node.style.opacity = '0';
        activeSlide.texts
          .filter((text) => text.linkedImageId === image.id)
          .forEach((text) => {
            const textNode = imagesRef.current?.querySelector<HTMLElement>(`.text-item[data-id="${text.id}"]`);
            if (textNode) textNode.style.opacity = '0';
          });
      });
      orderedImages.forEach((image) => {
        const entranceDelay = imageEntranceDelay(activeSlide, image.id);
        const linkedTexts = activeSlide.texts.filter((text) => text.linkedImageId === image.id);
        const playEntrance = () => {
          if (!imagesRef.current) return;
          playImageAnimation(imagesRef.current, image, 'entrance');
          linkedTexts.forEach((text) => playLinkedTextAnimation(imagesRef.current!, text, image, 'entrance'));
        };
        if (entranceDelay <= 0) playEntrance();
        else animationTimers.current.push(window.setTimeout(playEntrance, entranceDelay * 1000));

        const remainingDuration = activeSlide.duration - entranceDelay;
        if (image.exit === 'none' || remainingDuration <= image.animationDuration + 0.2) return;
        const delay = Math.max(entranceDelay, activeSlide.duration - image.animationDuration);
        animationTimers.current.push(window.setTimeout(
          () => {
            if (!imagesRef.current) return;
            playImageAnimation(imagesRef.current, image, 'exit');
            linkedTexts.forEach((text) => playLinkedTextAnimation(imagesRef.current!, text, image, 'exit'));
          },
          delay * 1000
        ));
      });
    },
    reset() {
      clearAnimationTimers();
      imagesRef.current?.querySelectorAll<HTMLVideoElement>('.stage-video').forEach((video) => video.pause());
      if (imagesRef.current) resetStageAnimations(imagesRef.current);
    }
  }));

  const startImageGesture = (event: React.PointerEvent<HTMLDivElement>, image: ImageLayer | VideoLayer, kind: MediaGesture['kind'] = 'image') => {
    event.preventDefault();
    event.stopPropagation();
    if (kind === 'image') onSelectImage(image.id);
    else onSelectVideo(image.id);
    const stage = kind === 'video'
      ? event.currentTarget.getBoundingClientRect()
      : event.currentTarget.closest('.stage')?.getBoundingClientRect();
    if (!stage) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = {x: event.clientX, y: event.clientY};
    let gesture = imageGestureRef.current;
    if (!gesture || gesture.mediaId !== image.id || gesture.kind !== kind) {
      const transform = {x: image.x, y: image.y, scale: image.scale, rotate: image.rotate};
      gesture = {
        mediaId: image.id,
        kind,
        stage,
        pointers: new Map(),
        base: transform,
        latest: transform,
        dragStart: point
      };
      imageGestureRef.current = gesture;
    }
    gesture.pointers.set(event.pointerId, point);
    if (gesture.pointers.size >= 2) {
      gesture.pinch = {...gestureMetrics([...gesture.pointers.values()].slice(0, 2)), base: {...gesture.latest}};
    } else {
      gesture.base = {...gesture.latest};
      gesture.dragStart = point;
    }
  };

  const moveImageGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = imageGestureRef.current;
    if (!gesture?.pointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    gesture.pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});

    let next: ImageTransform;
    if (gesture.pointers.size >= 2 && gesture.pinch) {
      const metrics = gestureMetrics([...gesture.pointers.values()].slice(0, 2));
      next = {
        x: clamp(gesture.pinch.base.x + ((metrics.center.x - gesture.pinch.center.x) / gesture.stage.width) * 100, -100, 100),
        y: clamp(gesture.pinch.base.y + ((metrics.center.y - gesture.pinch.center.y) / gesture.stage.height) * 100, -100, 100),
        scale: clamp(gesture.pinch.base.scale * (metrics.distance / gesture.pinch.distance), 0.2, 3),
        rotate: normalizeRotation(gesture.pinch.base.rotate + metrics.angle - gesture.pinch.angle)
      };
    } else {
      const point = gesture.pointers.values().next().value as PointerPoint;
      next = {
        ...gesture.latest,
        x: clamp(gesture.base.x + ((point.x - gesture.dragStart.x) / gesture.stage.width) * 100, -100, 100),
        y: clamp(gesture.base.y + ((point.y - gesture.dragStart.y) / gesture.stage.height) * 100, -100, 100)
      };
    }
    gesture.latest = next;
    updateMedia(gesture.kind, gesture.mediaId, next);
  };

  const endImageGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = imageGestureRef.current;
    if (!gesture?.pointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    gesture.pointers.delete(event.pointerId);
    if (!gesture.pointers.size) {
      imageGestureRef.current = null;
      return;
    }
    const remaining = gesture.pointers.values().next().value as PointerPoint;
    gesture.base = {...gesture.latest};
    gesture.dragStart = remaining;
    gesture.pinch = undefined;
  };

  const startImageResize = (event: React.PointerEvent<HTMLButtonElement>, image: ImageLayer | VideoLayer, kind: MediaGesture['kind'] = 'image') => {
    event.preventDefault();
    event.stopPropagation();
    if (kind === 'image') onSelectImage(image.id);
    else onSelectVideo(image.id);
    const stage = event.currentTarget.closest('.stage')?.getBoundingClientRect();
    if (!stage) return;
    const frame = kind === 'video' ? videoFramePercent(image as VideoLayer) : {cx: 50, cy: 50, width: 100, height: 100};
    const center = {
      x: stage.left + stage.width * ((frame.cx + image.x * frame.width / 100) / 100),
      y: stage.top + stage.height * ((frame.cy + image.y * frame.height / 100) / 100)
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeGestureRef.current = {
      mediaId: image.id,
      kind,
      pointerId: event.pointerId,
      center,
      startDistance: Math.max(20, Math.hypot(event.clientX - center.x, event.clientY - center.y)),
      baseScale: image.scale
    };
  };

  const moveImageResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const gesture = resizeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const distance = Math.max(1, Math.hypot(event.clientX - gesture.center.x, event.clientY - gesture.center.y));
    updateMedia(gesture.kind, gesture.mediaId, {
      scale: clamp(gesture.baseScale * (distance / gesture.startDistance), 0.2, 3)
    });
  };

  const endImageResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (resizeGestureRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    resizeGestureRef.current = null;
  };

  const resizeImageWithKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>, image: ImageLayer | VideoLayer, kind: MediaGesture['kind'] = 'image') => {
    const direction = event.key === 'ArrowUp' || event.key === 'ArrowRight'
      ? 1
      : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
        ? -1
        : 0;
    if (!direction && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    event.stopPropagation();
    const scale = event.key === 'Home'
      ? 0.2
      : event.key === 'End'
        ? 3
        : clamp(image.scale + direction * 0.05, 0.2, 3);
    updateMedia(kind, image.id, {scale});
  };

  const startTextDrag = (event: React.PointerEvent<HTMLDivElement>, text: TextLayer) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectText(text.id);
    const stage = event.currentTarget.closest('.stage')?.getBoundingClientRect();
    if (!stage) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    textGestureRef.current = {textId: text.id, pointerId: event.pointerId, stage};
  };

  const moveTextDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = textGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    onUpdateText(gesture.textId, {
      x: Math.max(4, Math.min(96, ((event.clientX - gesture.stage.left) / gesture.stage.width) * 100)),
      y: Math.max(4, Math.min(96, ((event.clientY - gesture.stage.top) / gesture.stage.height) * 100))
    });
  };

  const endTextDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (textGestureRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    textGestureRef.current = null;
  };

  return (
    <div className="stage-wrap">
      <div
        className={`stage ${aspect} ${isPortraitAspect(aspect) ? 'aspect-portrait' : 'aspect-landscape'} ${previewing ? 'previewing' : ''} ${dragging ? 'dragging' : ''}`}
        data-slide-id={slide.id}
        tabIndex={0}
        aria-label="低代码轮播画布"
        onClick={onClearSelection}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const assetId = event.dataTransfer.getData('application/x-studio-asset');
          if (slide.kind === 'player-outro') {
            if (event.dataTransfer.files.length) onPlayerPosterFiles(event.dataTransfer.files);
            else onPlayerPosterAsset(assetId);
          } else if (slide.kind === 'website-cover') {
            if (event.dataTransfer.files.length) onWebsiteScreenshotFiles(event.dataTransfer.files);
            else onWebsiteScreenshotAsset(assetId);
          } else if (event.dataTransfer.files.length) onFilesDropped(event.dataTransfer.files);
          else onAssetDropped(assetId);
        }}
      >
        <div ref={imagesRef} className="stage-content">
          {slide.kind === 'website-cover' && slide.websiteCover ? (
            <WebsiteCover config={slide.websiteCover} editable={!previewing} onUpdate={onUpdateWebsiteCover} />
          ) : slide.kind === 'player-outro' && slide.player ? (
            <PlayerOutro config={slide.player} previewing={previewing} />
          ) : (
            <>
              {!slide.images.length && !slide.videos.length && (
                <div className="empty-stage">
                  <strong>把图片或视频拖到这里</strong>
                  <span>每个屏幕的媒体与参数相互独立</span>
                </div>
              )}
              <div className="stage-videos">
                {slide.videos.map((video) => (
                  <div
                    className={`stage-video-frame layout-${video.layout} ${video.id === selectedVideoId ? 'selected' : ''}`}
                    key={video.id}
                    onPointerDown={(event) => startImageGesture(event, video, 'video')}
                    onPointerMove={moveImageGesture}
                    onPointerUp={endImageGesture}
                    onPointerCancel={endImageGesture}
                    onClick={(event) => { event.stopPropagation(); onSelectVideo(video.id); }}
                  >
                    <div
                      className="stage-video-layer"
                      style={{transform: `translate(${video.x}%, ${video.y}%) scale(${video.scale}) rotate(${video.rotate}deg)`}}
                    >
                      <video
                        className="stage-video"
                        data-id={video.id}
                        src={video.src}
                        playsInline
                        preload="auto"
                        muted={!previewing || video.muted}
                        style={{objectFit: video.fit, filter: mediaFilter(video)}}
                        onTimeUpdate={(event) => {
                          if (event.currentTarget.currentTime < video.trimEnd) return;
                          if (video.loop) {
                            event.currentTarget.currentTime = video.trimStart;
                            void event.currentTarget.play().catch(() => undefined);
                          } else event.currentTarget.pause();
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="stage-images">
                {slide.images.map((image) => (
                  <div
                    className={`stage-image-layer ${image.id === selectedImageId ? 'selected' : ''}`}
                    data-id={image.id}
                    key={image.id}
                    style={{
                      transform: `translate(${image.x}%, ${image.y}%) scale(${image.scale}) rotate(${image.rotate}deg)`,
                      zIndex: previewing ? orderedSlideImages(slide).findIndex((item) => item.id === image.id) + 1 : undefined
                    }}
                    onPointerDown={(event) => startImageGesture(event, image)}
                    onPointerMove={moveImageGesture}
                    onPointerUp={endImageGesture}
                    onPointerCancel={endImageGesture}
                    onClick={(event) => { event.stopPropagation(); onSelectImage(image.id); }}
                  >
                    <img
                      className="stage-image"
                      data-id={image.id}
                      src={image.src}
                      alt={image.name}
                      draggable={false}
                      style={{objectFit: image.fit, filter: mediaFilter(image)}}
                    />
                  </div>
                ))}
              </div>
              <div className="text-layer">
                {slide.texts.map((text) => (
                  <div
                    className={`text-item anim-${text.animation} ${text.linkedImageId ? 'linked-text' : ''} ${text.id === selectedTextId ? 'selected' : ''}`}
                    data-id={text.id}
                    key={text.id}
                    style={{
                      left: `${text.x}%`,
                      top: `${text.y}%`,
                      fontSize: `${text.fontSize}px`,
                      color: text.color,
                      fontFamily: text.fontFamily,
                      fontWeight: text.bold ? 800 : 500,
                      fontStyle: text.italic ? 'italic' : 'normal',
                      textAlign: 'center',
                      textShadow: text.shadow ? '0 3px 12px rgba(0,0,0,.72)' : 'none',
                      textDecoration: text.lineThrough ? 'line-through' : 'none',
                      textDecorationColor: text.lineThrough ? 'rgba(232,235,241,.78)' : undefined,
                      textDecorationThickness: text.lineThrough ? '2px' : undefined,
                      opacity: previewing && text.linkedImageId ? 0 : undefined
                    }}
                    onPointerDown={(event) => startTextDrag(event, text)}
                    onPointerMove={moveTextDrag}
                    onPointerUp={endTextDrag}
                    onPointerCancel={endTextDrag}
                    onClick={(event) => { event.stopPropagation(); onSelectText(text.id); }}
                  >
                    {text.content}
                  </div>
                ))}
              </div>
              {selectedImage && !previewing && (
                <div className="image-transform-controls" aria-label="图片缩放控制">
                  <button
                    className="image-resize-handle"
                    type="button"
                    title="拖动放大缩小图片"
                    aria-label={`拖动缩放 ${selectedImage.name}，当前 ${Math.round(selectedImage.scale * 100)}%`}
                    style={resizeHandlePosition(selectedImage)}
                    onPointerDown={(event) => startImageResize(event, selectedImage)}
                    onPointerMove={moveImageResize}
                    onPointerUp={endImageResize}
                    onPointerCancel={endImageResize}
                    onKeyDown={(event) => resizeImageWithKeyboard(event, selectedImage)}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Scaling size={17} strokeWidth={2.4} />
                  </button>
                </div>
              )}
              {selectedVideo && !previewing && (
                <div className="image-transform-controls" aria-label="视频缩放控制">
                  <button
                    className="image-resize-handle"
                    type="button"
                    title="拖动放大缩小视频"
                    aria-label={`拖动缩放 ${selectedVideo.name}，当前 ${Math.round(selectedVideo.scale * 100)}%`}
                    style={videoResizeHandlePosition(selectedVideo)}
                    onPointerDown={(event) => startImageResize(event, selectedVideo, 'video')}
                    onPointerMove={moveImageResize}
                    onPointerUp={endImageResize}
                    onPointerCancel={endImageResize}
                    onKeyDown={(event) => resizeImageWithKeyboard(event, selectedVideo, 'video')}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Scaling size={17} strokeWidth={2.4} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});
