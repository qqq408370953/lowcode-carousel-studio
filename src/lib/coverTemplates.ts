import type {AspectRatio, CoverTemplateSummary, Slide} from '../types';

const databaseName = 'aivideo-creator';
const storeName = 'cover-templates';

interface StoredCoverTemplate {
  id: string;
  name: string;
  aspect: AspectRatio;
  createdAt: number;
  preview: Blob;
  slide: Slide;
  sources: Array<{src: string; blob: Blob}>;
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName, {keyPath: 'id'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开本地模板库'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('本地模板操作失败'));
    transaction.oncomplete = () => database.close();
  });
}

function slideSources(slide: Slide) {
  return [...new Set([
    ...slide.images.map((image) => image.src),
    ...slide.videos.map((video) => video.src),
    slide.player?.posterSrc || '',
    slide.websiteCover?.screenshotSrc || ''
  ].filter(Boolean))];
}

export async function saveCoverTemplate(name: string, aspect: AspectRatio, slide: Slide, preview: Blob) {
  const sources = await Promise.all(slideSources(slide).map(async (src) => {
    const response = await fetch(src);
    if (!response.ok) throw new Error('无法保存模板中的本地素材');
    return {src, blob: await response.blob()};
  }));
  const template: StoredCoverTemplate = {
    id: createId(),
    name: name.trim() || '未命名封面模板',
    aspect,
    createdAt: Date.now(),
    preview,
    slide: structuredClone(slide),
    sources
  };
  await withStore('readwrite', (store) => store.put(template));
  return template.id;
}

export async function listCoverTemplates(): Promise<CoverTemplateSummary[]> {
  const rows = await withStore<StoredCoverTemplate[]>('readonly', (store) => store.getAll());
  return rows
    .sort((first, second) => second.createdAt - first.createdAt)
    .map((row) => ({
      id: row.id,
      name: row.name,
      aspect: row.aspect,
      createdAt: row.createdAt,
      previewUrl: URL.createObjectURL(row.preview)
    }));
}

export async function instantiateCoverTemplate(id: string) {
  const template = await withStore<StoredCoverTemplate | undefined>('readonly', (store) => store.get(id));
  if (!template) throw new Error('封面模板不存在或已删除');
  const sourceUrls = new Map(template.sources.map(({src, blob}) => [src, URL.createObjectURL(blob)]));
  const slide = structuredClone(template.slide);
  const imageIds = new Map<string, string>();
  slide.id = createId();
  slide.title = template.name;
  slide.images = slide.images.map((image) => {
    const id = createId();
    imageIds.set(image.id, id);
    return {...image, id, src: sourceUrls.get(image.src) || image.src};
  });
  slide.videos = slide.videos.map((video) => ({...video, id: createId(), src: sourceUrls.get(video.src) || video.src}));
  slide.texts = slide.texts.map((text) => ({
    ...text,
    id: createId(),
    linkedImageId: text.linkedImageId ? imageIds.get(text.linkedImageId) : undefined
  }));
  if (slide.player?.posterSrc) slide.player.posterSrc = sourceUrls.get(slide.player.posterSrc) || slide.player.posterSrc;
  if (slide.websiteCover?.screenshotSrc) {
    slide.websiteCover.screenshotSrc = sourceUrls.get(slide.websiteCover.screenshotSrc) || slide.websiteCover.screenshotSrc;
  }
  return {aspect: template.aspect, slide};
}

export async function deleteCoverTemplate(id: string) {
  await withStore('readwrite', (store) => store.delete(id));
}
