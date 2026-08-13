import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('无法读取导出视频'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(blob);
  });
}

export async function deliverExportedVideo(blob: Blob, extension: string) {
  const fileName = `carousel-export-${Date.now()}.${extension}`;
  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: await blobToBase64(blob),
      directory: Directory.Cache
    });
    await Share.share({
      title: '导出轮播视频',
      dialogTitle: '保存或分享视频',
      url: result.uri
    });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function deliverExportedImage(blob: Blob, aspectLabel: string) {
  const fileName = `cover-${aspectLabel.replace(':', 'x')}-${Date.now()}.png`;
  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: await blobToBase64(blob),
      directory: Directory.Cache
    });
    await Share.share({title: '导出封面图片', dialogTitle: '保存或分享封面', url: result.uri});
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function deliverExportedAudio(blob: Blob) {
  const fileName = `doubao-narration-${Date.now()}.mp3`;
  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: await blobToBase64(blob),
      directory: Directory.Cache
    });
    await Share.share({title: '导出豆包口播', dialogTitle: '保存或分享 MP3', url: result.uri});
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
