import type {ImageLayer, Slide} from '../types';

export function orderedSlideImages(slide: Slide) {
  return slide.images
    .map((image, layerIndex) => ({image, layerIndex, order: Number.isFinite(image.entranceOrder) ? image.entranceOrder : layerIndex}))
    .sort((first, second) => first.order - second.order || first.layerIndex - second.layerIndex)
    .map(({image}) => image);
}

export function imageSequenceSlot(slide: Slide) {
  return slide.images.length ? slide.duration / slide.images.length : slide.duration;
}

export function imageEntranceDelay(slide: Slide, imageId: string) {
  const index = orderedSlideImages(slide).findIndex((image) => image.id === imageId);
  return index < 0 ? 0 : index * imageSequenceSlot(slide);
}

export function normalizeEntranceOrder(images: ImageLayer[]) {
  const ordered = images
    .map((image, layerIndex) => ({image, layerIndex, order: Number.isFinite(image.entranceOrder) ? image.entranceOrder : layerIndex}))
    .sort((first, second) => first.order - second.order || first.layerIndex - second.layerIndex)
    .map(({image}) => image);
  const orderById = new Map(ordered.map((image, entranceOrder) => [image.id, entranceOrder]));
  return images.map((image) => ({...image, entranceOrder: orderById.get(image.id) ?? 0}));
}
