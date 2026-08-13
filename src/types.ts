export type AspectRatio = 'portrait' | 'landscape' | 'cover-portrait' | 'cover-landscape';
export type FitMode = 'contain' | 'cover';
export type InspectorTab = 'image' | 'video' | 'text' | 'audio';
export type AnimationDirection = 'entrance' | 'exit';

export type ImageAnimation =
  | 'none'
  | 'gsap-zoom'
  | 'gsap-rotate'
  | 'anime-elastic'
  | 'anime-swing'
  | 'animate-bounce'
  | 'animate-flip'
  | 'motion-spring'
  | 'motion-slide'
  | 'gsap-zoom-out'
  | 'gsap-rotate-out'
  | 'anime-collapse'
  | 'anime-swing-out'
  | 'animate-bounce-out'
  | 'animate-flip-out'
  | 'motion-drop'
  | 'motion-slide-out';

export type SlideTransition =
  | 'none'
  | 'gsap-fade'
  | 'anime-slide'
  | 'animate-flip'
  | 'motion-zoom';

export type TextAnimation = 'none' | 'fade' | 'rise' | 'pop' | 'wipe';
export type SlideKind = 'standard' | 'player-outro' | 'website-cover';
export type VideoLayout = 'full' | 'left' | 'right' | 'top' | 'bottom';

export interface ImageLayer {
  id: string;
  src: string;
  name: string;
  fit: FitMode;
  scale: number;
  x: number;
  y: number;
  rotate: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  entranceOrder: number;
  entrance: ImageAnimation;
  exit: ImageAnimation;
  animationDuration: number;
}

export interface VideoLayer {
  id: string;
  src: string;
  name: string;
  fit: FitMode;
  layout: VideoLayout;
  scale: number;
  x: number;
  y: number;
  rotate: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  sourceDuration: number;
  trimStart: number;
  trimEnd: number;
  playbackRate: number;
  volume: number;
  muted: boolean;
  loop: boolean;
  entrance: ImageAnimation;
  exit: ImageAnimation;
  animationDuration: number;
}

export interface TextLayer {
  id: string;
  content: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  animation: TextAnimation;
  bold: boolean;
  italic: boolean;
  shadow: boolean;
  lineThrough?: boolean;
  linkedImageId?: string;
}

export interface PlayerOutroConfig {
  showTitle: string;
  episode: string;
  prompt: string;
  posterSrc: string;
  posterName: string;
  progress: number;
  quality: string;
}

export interface WebsiteCoverConfig {
  issue: number;
  subtitle: string;
  subtitleScale: number;
  screenshotSrc: string;
  screenshotName: string;
  screenshotScale: number;
  screenshotX: number;
  screenshotY: number;
}

export interface Slide {
  id: string;
  kind: SlideKind;
  title: string;
  duration: number;
  transition: SlideTransition;
  transitionDuration: number;
  videos: VideoLayer[];
  images: ImageLayer[];
  texts: TextLayer[];
  player?: PlayerOutroConfig;
  websiteCover?: WebsiteCoverConfig;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  url: string;
  file: File;
}

export interface Narration {
  text: string;
  audioUrl: string;
  duration: number;
  voiceType: string;
  speedRatio: number;
}

export interface StudioState {
  aspect: AspectRatio;
  assets: Asset[];
  slides: Slide[];
  currentSlideId: string;
  selectedImageId: string;
  selectedVideoId: string;
  selectedTextId: string;
  narration: Narration;
}

export interface ExportProgress {
  progress: number;
  message: string;
}

export interface CoverTemplateSummary {
  id: string;
  name: string;
  aspect: AspectRatio;
  createdAt: number;
  previewUrl: string;
}
