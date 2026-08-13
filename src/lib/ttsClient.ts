import {Capacitor, CapacitorHttp} from '@capacitor/core';
import {Preferences} from '@capacitor/preferences';

const API_KEY_STORAGE = 'doubao-api-key';
const TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
const BUNDLED_TTS_CONFIG = __BUNDLED_TTS_CONFIG__;

interface TtsPayload {
  text: string;
  voiceType: string;
  speedRatio: number;
}

function isDesktopApp() {
  return Boolean(window.desktopStudio);
}

export function isNativeApp() {
  return isDesktopApp() || Capacitor.isNativePlatform();
}

export function hasBundledTtsConfig() {
  return Boolean(BUNDLED_TTS_CONFIG.apiKey);
}

export function getDefaultTtsVoiceType() {
  return BUNDLED_TTS_CONFIG.voiceType || 'zh_female_xiaohe_uranus_bigtts';
}

export async function hasStoredTtsKey() {
  if (hasBundledTtsConfig()) return true;
  if (window.desktopStudio) return window.desktopStudio.getTtsKeyStatus();
  if (Capacitor.isNativePlatform()) {
    const {value} = await Preferences.get({key: API_KEY_STORAGE});
    return Boolean(value);
  }
  return true;
}

export async function saveTtsApiKey(apiKey: string) {
  const value = apiKey.trim();
  if (!value) throw new Error('API Key 不能为空');
  if (window.desktopStudio) return window.desktopStudio.saveTtsApiKey(value);
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({key: API_KEY_STORAGE, value});
    return true;
  }
  throw new Error('浏览器模式请在本地服务的 .env 中配置 API Key');
}

function parseJsonStream(raw: string) {
  const frames: Array<{data?: string; code?: number; message?: string}> = [];
  let index = 0;
  while (index < raw.length) {
    while (index < raw.length && /\s/.test(raw[index])) index += 1;
    if (index >= raw.length) break;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = index;
    for (; end < raw.length; end += 1) {
      const char = raw[end];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    const chunk = raw.slice(index, end).trim();
    if (chunk) frames.push(JSON.parse(chunk));
    index = end;
  }
  return frames;
}

function base64ChunksToBlob(chunks: string[]) {
  const binaryChunks = chunks.map((chunk) => {
    const binary = atob(chunk);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  });
  return new Blob(binaryChunks, {type: 'audio/mpeg'});
}

async function synthesizeOnAndroid(payload: TtsPayload) {
  const {value: storedApiKey} = await Preferences.get({key: API_KEY_STORAGE});
  const apiKey = storedApiKey || BUNDLED_TTS_CONFIG.apiKey;
  if (!apiKey) throw new Error('请先保存豆包 API Key');
  const resourceId = BUNDLED_TTS_CONFIG.resourceId || (payload.voiceType.includes('uranus') || payload.voiceType.startsWith('saturn_')
    ? 'seed-tts-2.0'
    : 'seed-tts-1.0');
  const speedRatio = Math.max(0.5, Math.min(2, Number(payload.speedRatio || 1)));
  const response = await CapacitorHttp.post({
    url: BUNDLED_TTS_CONFIG.endpoint || TTS_ENDPOINT,
    headers: {
      'X-Api-Key': apiKey,
      'X-Api-Resource-Id': resourceId,
      'X-Api-Request-Id': `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      'Content-Type': 'application/json',
      'X-Control-Require-Usage-Tokens-Return': 'text_words'
    },
    data: {
      user: {uid: 'lowcode-carousel-studio-android'},
      req_params: {
        text: payload.text,
        speaker: payload.voiceType,
        audio_params: {
          format: 'mp3',
          sample_rate: 24000,
          speech_rate: Math.round((speedRatio - 1) * 100),
          loudness_rate: 0
        }
      }
    },
    responseType: 'text'
  });

  const raw = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`TTS HTTP ${response.status}: ${raw.slice(0, 240)}`);
  }
  const frames = parseJsonStream(raw);
  const chunks = frames.map((frame) => frame.data).filter((data): data is string => Boolean(data));
  if (!chunks.length) {
    const failed = frames.find((frame) => frame.code && frame.code !== 0 && frame.code !== 20000000);
    throw new Error(failed?.message || 'TTS 返回中没有音频数据');
  }
  return base64ChunksToBlob(chunks);
}

export async function synthesizeTts(payload: TtsPayload) {
  if (window.desktopStudio) {
    const result = await window.desktopStudio.synthesizeTts({
      ...payload,
      bundledApiKey: BUNDLED_TTS_CONFIG.apiKey,
      bundledResourceId: BUNDLED_TTS_CONFIG.resourceId,
      bundledEndpoint: BUNDLED_TTS_CONFIG.endpoint
    });
    return base64ChunksToBlob([result.audioBase64]);
  }
  if (Capacitor.isNativePlatform()) return synthesizeOnAndroid(payload);

  const response = await fetch('/api/doubao-tts', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as {error?: string};
    throw new Error(error.error || `TTS 请求失败：${response.status}`);
  }
  return response.blob();
}
