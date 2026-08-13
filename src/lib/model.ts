import type {Asset, ImageLayer, PlayerOutroConfig, Slide, StudioState, TextLayer, VideoLayer, WebsiteCoverConfig} from '../types';
import {isPortraitAspect} from './aspect';

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createImageLayer(asset: Asset, layerIndex = 0): ImageLayer {
  return {
    id: createId(),
    src: asset.url,
    name: asset.name,
    fit: 'contain',
    scale: layerIndex ? 0.62 : 1,
    x: layerIndex ? (layerIndex % 2 ? 18 : -18) : 0,
    y: 0,
    rotate: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    entranceOrder: layerIndex,
    entrance: 'gsap-zoom',
    exit: 'motion-drop',
    animationDuration: 0.8
  };
}

export function resetImageLayer(image: ImageLayer): ImageLayer {
  return {
    id: image.id,
    src: image.src,
    name: image.name,
    fit: 'contain',
    scale: 1,
    x: 0,
    y: 0,
    rotate: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    entranceOrder: image.entranceOrder,
    entrance: 'gsap-zoom',
    exit: 'motion-drop',
    animationDuration: 0.8
  };
}

export function createVideoLayer(asset: Asset, sourceDuration = 0, layerIndex = 0): VideoLayer {
  return {
    id: createId(),
    src: asset.url,
    name: asset.name,
    fit: 'contain',
    layout: 'full',
    scale: 1,
    x: 0,
    y: 0,
    rotate: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    sourceDuration,
    trimStart: 0,
    trimEnd: sourceDuration,
    playbackRate: 1,
    volume: 100,
    muted: layerIndex > 0,
    loop: false,
    entrance: 'gsap-zoom',
    exit: 'motion-drop',
    animationDuration: 0.8
  };
}

export function resetVideoLayer(video: VideoLayer): VideoLayer {
  return {
    ...createVideoLayer({url: video.src, name: video.name} as Asset, video.sourceDuration),
    id: video.id,
    muted: video.muted
  };
}

export function createTextLayer(aspect: StudioState['aspect']): TextLayer {
  return {
    id: createId(),
    content: '双击编辑文字',
    x: 50,
    y: 76,
    fontSize: isPortraitAspect(aspect) ? 42 : 36,
    color: '#ffffff',
    fontFamily: 'system-ui',
    animation: 'rise',
    bold: true,
    italic: false,
    shadow: true,
    lineThrough: false
  };
}

export function createSlide(index: number): Slide {
  return {
    id: createId(),
    kind: 'standard',
    title: `屏幕 ${index + 1}`,
    duration: 3,
    transition: 'gsap-fade',
    transitionDuration: 0.7,
    videos: [],
    images: [],
    texts: []
  };
}

export function createPlayerOutroConfig(): PlayerOutroConfig {
  return {
    showTitle: '未命名剧集',
    episode: '第 1 集',
    prompt: '精彩继续，点击追剧',
    posterSrc: '',
    posterName: '',
    progress: 68,
    quality: '1080P'
  };
}

export function createPlayerOutroSlide(): Slide {
  return {
    id: createId(),
    kind: 'player-outro',
    title: '播放器片尾',
    duration: 3,
    transition: 'motion-zoom',
    transitionDuration: 0.7,
    videos: [],
    images: [],
    texts: [],
    player: createPlayerOutroConfig()
  };
}

export function createWebsiteCoverConfig(): WebsiteCoverConfig {
  return {
    issue: 1,
    subtitle: '免费资源导航',
    subtitleScale: 1,
    screenshotSrc: '',
    screenshotName: '底图内置 FMHY 页面',
    screenshotScale: 1,
    screenshotX: 0,
    screenshotY: 0
  };
}

export function createWebsiteCoverSlide(): Slide {
  return {
    id: createId(),
    kind: 'website-cover',
    title: '每天一个神奇的网站',
    duration: 3,
    transition: 'none',
    transitionDuration: 0.7,
    videos: [],
    images: [],
    texts: [],
    websiteCover: createWebsiteCoverConfig()
  };
}

function createTimelineImage(
  fileName: string,
  name: string,
  entranceOrder: number,
  layout: Pick<ImageLayer, 'x' | 'y' | 'scale' | 'rotate'>,
  entrance: ImageLayer['entrance']
): ImageLayer {
  return {
    id: createId(),
    src: new URL(`./presets/${fileName}`, document.baseURI).href,
    name,
    fit: 'contain',
    ...layout,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    entranceOrder,
    entrance,
    exit: 'none',
    animationDuration: 0.8
  };
}

export function createShareSavePresetSlide(): Slide {
  const image = createTimelineImage(
    'share-save-composite.png',
    '分享保存提示图',
    0,
    {x: 0, y: 0, scale: 1, rotate: 0},
    'gsap-zoom'
  );
  return {
    id: createId(),
    kind: 'standard',
    title: '分享保存提示图',
    duration: 4,
    transition: 'gsap-fade',
    transitionDuration: 0.7,
    videos: [],
    images: [{...image, exit: 'gsap-zoom-out'}],
    texts: []
  };
}

export function duplicateSlide(source: Slide): Slide {
  return {
    ...structuredClone(source),
    id: createId(),
    title: `${source.title} 副本`,
    videos: source.videos.map((video) => ({...video, id: createId()})),
    images: source.images.map((image) => ({...image, id: createId()})),
    texts: source.texts.map((text) => ({...text, id: createId()}))
  };
}

export function createInitialState(): StudioState {
  const firstSlide = createSlide(0);
  return {
    aspect: 'portrait',
    assets: [],
    slides: [firstSlide],
    currentSlideId: firstSlide.id,
    selectedImageId: '',
    selectedVideoId: '',
    selectedTextId: '',
    narration: {
      text: '',
      audioUrl: '',
      duration: 0,
      voiceType: 'zh_female_xiaohe_uranus_bigtts',
      speedRatio: 1
    }
  };
}

export function createAssets(files: FileList | File[]): Asset[] {
  return Array.from(files)
    .map((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      const type = file.type || (
        ['mp4', 'mov', 'm4v', 'webm'].includes(extension) ? `video/${extension === 'mov' ? 'quicktime' : extension}`
          : ['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(extension) ? `audio/${extension}`
            : ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension) ? `image/${extension === 'jpg' ? 'jpeg' : extension}`
              : ''
      );
      return {file, type};
    })
    .filter(({type}) => type.startsWith('image/') || type.startsWith('audio/') || type.startsWith('video/'))
    .map(({file, type}) => ({id: createId(), name: file.name, type, url: URL.createObjectURL(file), file}));
}
