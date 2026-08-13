import type {AspectRatio} from '../types';

export const aspectOptions: Array<{value: AspectRatio; label: string}> = [
  {value: 'cover-portrait', label: '3:4'},
  {value: 'cover-landscape', label: '4:3'},
  {value: 'portrait', label: '9:16'},
  {value: 'landscape', label: '16:9'}
];

export function aspectLabel(aspect: AspectRatio) {
  return aspectOptions.find((option) => option.value === aspect)?.label || '9:16';
}

export function isPortraitAspect(aspect: AspectRatio) {
  return aspect === 'portrait' || aspect === 'cover-portrait';
}

export function aspectDimensions(aspect: AspectRatio) {
  if (aspect === 'cover-portrait') return {width: 1200, height: 1600};
  if (aspect === 'cover-landscape') return {width: 1600, height: 1200};
  if (aspect === 'landscape') return {width: 1280, height: 720};
  return {width: 720, height: 1280};
}
