import {useMemo, useReducer} from 'react';
import {createInitialState, resetImageLayer, resetVideoLayer} from '../lib/model';
import {normalizeEntranceOrder} from '../lib/imageSequence';
import type {AspectRatio, Asset, ImageLayer, Narration, Slide, StudioState, TextLayer, VideoLayer} from '../types';

export type StudioAction =
  | {type: 'set-aspect'; aspect: AspectRatio}
  | {type: 'add-assets'; assets: Asset[]}
  | {type: 'select-slide'; slideId: string}
  | {type: 'add-slide'; slide: Slide}
  | {type: 'upsert-player-outro'; slide: Slide}
  | {type: 'duplicate-slide'; slide: Slide}
  | {type: 'delete-slide'}
  | {type: 'update-slide'; patch: Partial<Slide>}
  | {type: 'add-images'; images: ImageLayer[]}
  | {type: 'select-image'; imageId: string}
  | {type: 'update-image'; imageId: string; patch: Partial<ImageLayer>}
  | {type: 'reset-image'; imageId: string}
  | {type: 'move-image'; imageId: string; target: 'top' | 'up' | 'down' | 'bottom'}
  | {type: 'move-image-entrance'; imageId: string; direction: 'earlier' | 'later'}
  | {type: 'delete-image'; imageId: string}
  | {type: 'add-videos'; videos: VideoLayer[]}
  | {type: 'select-video'; videoId: string}
  | {type: 'update-video'; videoId: string; patch: Partial<VideoLayer>}
  | {type: 'reset-video'; videoId: string}
  | {type: 'move-video'; videoId: string; target: 'top' | 'up' | 'down' | 'bottom'}
  | {type: 'delete-video'; videoId: string}
  | {type: 'add-text'; text: TextLayer}
  | {type: 'select-text'; textId: string}
  | {type: 'update-text'; textId: string; patch: Partial<TextLayer>}
  | {type: 'delete-text'; textId: string}
  | {type: 'set-narration'; narration: Partial<Narration>}
  | {type: 'sync-slides-to-audio'; duration: number};

function updateCurrentSlide(state: StudioState, updater: (slide: Slide) => Slide): StudioState {
  return {
    ...state,
    slides: state.slides.map((slide) => slide.id === state.currentSlideId ? updater(slide) : slide)
  };
}

function moveImage(images: ImageLayer[], imageId: string, target: 'top' | 'up' | 'down' | 'bottom') {
  const index = images.findIndex((image) => image.id === imageId);
  if (index < 0) return images;
  let nextIndex = index;
  if (target === 'top') nextIndex = images.length - 1;
  if (target === 'up') nextIndex = Math.min(images.length - 1, index + 1);
  if (target === 'down') nextIndex = Math.max(0, index - 1);
  if (target === 'bottom') nextIndex = 0;
  if (nextIndex === index) return images;
  const next = [...images];
  const [image] = next.splice(index, 1);
  next.splice(nextIndex, 0, image);
  return next;
}

function moveLayer<T extends {id: string}>(layers: T[], id: string, target: 'top' | 'up' | 'down' | 'bottom') {
  const index = layers.findIndex((layer) => layer.id === id);
  if (index < 0) return layers;
  let nextIndex = index;
  if (target === 'top') nextIndex = layers.length - 1;
  if (target === 'up') nextIndex = Math.min(layers.length - 1, index + 1);
  if (target === 'down') nextIndex = Math.max(0, index - 1);
  if (target === 'bottom') nextIndex = 0;
  if (nextIndex === index) return layers;
  const next = [...layers];
  const [layer] = next.splice(index, 1);
  next.splice(nextIndex, 0, layer);
  return next;
}

function moveImageEntrance(images: ImageLayer[], imageId: string, direction: 'earlier' | 'later') {
  const normalized = normalizeEntranceOrder(images);
  const ordered = [...normalized].sort((first, second) => first.entranceOrder - second.entranceOrder);
  const index = ordered.findIndex((image) => image.id === imageId);
  if (index < 0) return images;
  const nextIndex = direction === 'earlier' ? Math.max(0, index - 1) : Math.min(ordered.length - 1, index + 1);
  if (nextIndex === index) return images;
  [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
  const orderById = new Map(ordered.map((image, entranceOrder) => [image.id, entranceOrder]));
  return normalized.map((image) => ({...image, entranceOrder: orderById.get(image.id) ?? image.entranceOrder}));
}

const initialStudioState = createInitialState();

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case 'set-aspect':
      return {...state, aspect: action.aspect};
    case 'add-assets':
      return {...state, assets: [...state.assets, ...action.assets]};
    case 'select-slide': {
      const slide = state.slides.find((item) => item.id === action.slideId);
      if (!slide) return state;
      return {
        ...state,
        currentSlideId: slide.id,
        selectedImageId: slide.images.at(-1)?.id || '',
        selectedVideoId: slide.images.length ? '' : slide.videos.at(-1)?.id || '',
        selectedTextId: ''
      };
    }
    case 'add-slide': {
      const outroIndex = state.slides.findIndex((slide) => slide.kind === 'player-outro');
      const slides = [...state.slides];
      slides.splice(outroIndex < 0 ? slides.length : outroIndex, 0, action.slide);
      return {
        ...state,
        slides,
        currentSlideId: action.slide.id,
        selectedImageId: '',
        selectedVideoId: '',
        selectedTextId: ''
      };
    }
    case 'upsert-player-outro': {
      const existing = state.slides.find((slide) => slide.kind === 'player-outro');
      if (existing) {
        return {
          ...state,
          currentSlideId: existing.id,
          selectedImageId: '',
          selectedVideoId: '',
          selectedTextId: ''
        };
      }
      return {
        ...state,
        slides: [...state.slides, action.slide],
        currentSlideId: action.slide.id,
        selectedImageId: '',
        selectedVideoId: '',
        selectedTextId: ''
      };
    }
    case 'duplicate-slide': {
      const currentIndex = state.slides.findIndex((slide) => slide.id === state.currentSlideId);
      if (currentIndex < 0) return state;
      const slides = [...state.slides];
      const outroIndex = slides.findIndex((slide) => slide.kind === 'player-outro');
      const insertAt = outroIndex < 0 ? currentIndex + 1 : Math.min(currentIndex + 1, outroIndex);
      slides.splice(insertAt, 0, action.slide);
      return {
        ...state,
        slides,
        currentSlideId: action.slide.id,
        selectedImageId: action.slide.images.at(-1)?.id || '',
        selectedVideoId: action.slide.images.length ? '' : action.slide.videos.at(-1)?.id || '',
        selectedTextId: ''
      };
    }
    case 'delete-slide': {
      if (state.slides.length === 1) return state;
      const index = state.slides.findIndex((slide) => slide.id === state.currentSlideId);
      const slides = state.slides.filter((slide) => slide.id !== state.currentSlideId);
      const nextSlide = slides[Math.max(0, index - 1)];
      return {
        ...state,
        slides,
        currentSlideId: nextSlide.id,
        selectedImageId: nextSlide.images.at(-1)?.id || '',
        selectedVideoId: nextSlide.images.length ? '' : nextSlide.videos.at(-1)?.id || '',
        selectedTextId: ''
      };
    }
    case 'update-slide':
      return updateCurrentSlide(state, (slide) => ({...slide, ...action.patch}));
    case 'add-images': {
      if (!action.images.length) return state;
      const nextState = updateCurrentSlide(state, (slide) => ({
        ...slide,
        images: normalizeEntranceOrder([...slide.images, ...action.images])
      }));
      return {...nextState, selectedImageId: action.images.at(-1)!.id, selectedVideoId: '', selectedTextId: ''};
    }
    case 'select-image':
      return {...state, selectedImageId: action.imageId, selectedVideoId: '', selectedTextId: ''};
    case 'update-image':
      return updateCurrentSlide(state, (slide) => ({
        ...slide,
        images: slide.images.map((image) => image.id === action.imageId ? {...image, ...action.patch} : image)
      }));
    case 'reset-image':
      return updateCurrentSlide(state, (slide) => ({
        ...slide,
        images: slide.images.map((image) => image.id === action.imageId ? resetImageLayer(image) : image)
      }));
    case 'move-image':
      return updateCurrentSlide(state, (slide) => ({
        ...slide,
        images: moveImage(slide.images, action.imageId, action.target)
      }));
    case 'move-image-entrance':
      return updateCurrentSlide(state, (slide) => ({
        ...slide,
        images: moveImageEntrance(slide.images, action.imageId, action.direction)
      }));
    case 'delete-image': {
      let nextSelectedId = '';
      const nextState = updateCurrentSlide(state, (slide) => {
        const index = slide.images.findIndex((image) => image.id === action.imageId);
        const images = normalizeEntranceOrder(slide.images.filter((image) => image.id !== action.imageId));
        nextSelectedId = images[Math.min(index, images.length - 1)]?.id || '';
        return {...slide, images};
      });
      return {...nextState, selectedImageId: nextSelectedId};
    }
    case 'add-videos': {
      if (!action.videos.length) return state;
      const nextState = updateCurrentSlide(state, (slide) => ({...slide, videos: [...slide.videos, ...action.videos]}));
      return {...nextState, selectedImageId: '', selectedVideoId: action.videos.at(-1)!.id, selectedTextId: ''};
    }
    case 'select-video':
      return {...state, selectedImageId: '', selectedVideoId: action.videoId, selectedTextId: ''};
    case 'update-video':
      return updateCurrentSlide(state, (slide) => ({
        ...slide,
        videos: slide.videos.map((video) => video.id === action.videoId ? {...video, ...action.patch} : video)
      }));
    case 'reset-video':
      return updateCurrentSlide(state, (slide) => ({
        ...slide,
        videos: slide.videos.map((video) => video.id === action.videoId ? resetVideoLayer(video) : video)
      }));
    case 'move-video':
      return updateCurrentSlide(state, (slide) => ({...slide, videos: moveLayer(slide.videos, action.videoId, action.target)}));
    case 'delete-video': {
      let nextSelectedId = '';
      const nextState = updateCurrentSlide(state, (slide) => {
        const index = slide.videos.findIndex((video) => video.id === action.videoId);
        const videos = slide.videos.filter((video) => video.id !== action.videoId);
        nextSelectedId = videos[Math.min(index, videos.length - 1)]?.id || '';
        return {...slide, videos};
      });
      return {...nextState, selectedVideoId: nextSelectedId};
    }
    case 'add-text': {
      const nextState = updateCurrentSlide(state, (slide) => ({...slide, texts: [...slide.texts, action.text]}));
      return {...nextState, selectedImageId: '', selectedVideoId: '', selectedTextId: action.text.id};
    }
    case 'select-text':
      return {...state, selectedImageId: '', selectedVideoId: '', selectedTextId: action.textId};
    case 'update-text':
      return updateCurrentSlide(state, (slide) => ({
        ...slide,
        texts: slide.texts.map((text) => text.id === action.textId ? {...text, ...action.patch} : text)
      }));
    case 'delete-text':
      return {
        ...updateCurrentSlide(state, (slide) => ({
          ...slide,
          texts: slide.texts.filter((text) => text.id !== action.textId)
        })),
        selectedTextId: ''
      };
    case 'set-narration':
      return {...state, narration: {...state.narration, ...action.narration}};
    case 'sync-slides-to-audio': {
      const standardSlides = state.slides.filter((slide) => slide.kind !== 'player-outro');
      const perSlide = Math.max(0.5, action.duration / Math.max(1, standardSlides.length));
      return {
        ...state,
        slides: state.slides.map((slide) => slide.kind === 'player-outro'
          ? slide
          : {...slide, duration: Number(perSlide.toFixed(1))})
      };
    }
  }
}

export function useStudio() {
  const [state, dispatch] = useReducer(studioReducer, initialStudioState);
  const currentSlide = useMemo(
    () => state.slides.find((slide) => slide.id === state.currentSlideId) || state.slides[0],
    [state.currentSlideId, state.slides]
  );
  const selectedImage = currentSlide.images.find((image) => image.id === state.selectedImageId);
  const selectedVideo = currentSlide.videos.find((video) => video.id === state.selectedVideoId);
  const selectedText = currentSlide.texts.find((text) => text.id === state.selectedTextId);
  const totalDuration = state.slides.reduce((sum, slide) => sum + slide.duration, 0);
  return {state, dispatch, currentSlide, selectedImage, selectedVideo, selectedText, totalDuration};
}
