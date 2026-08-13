const {app, BrowserWindow, ipcMain, safeStorage} = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';

function keyPath() {
  return path.join(app.getPath('userData'), 'doubao-api-key.bin');
}

function readApiKey() {
  if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(keyPath())) return '';
  return safeStorage.decryptString(fs.readFileSync(keyPath()));
}

function saveApiKey(apiKey) {
  const value = String(apiKey || '').trim();
  if (!value) throw new Error('API Key 不能为空');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统无法安全保存 API Key');
  fs.mkdirSync(path.dirname(keyPath()), {recursive: true});
  fs.writeFileSync(keyPath(), safeStorage.encryptString(value), {mode: 0o600});
  return true;
}

function parseJsonStream(raw) {
  const frames = [];
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

async function synthesizeTts(payload) {
  const apiKey = readApiKey() || String(payload.bundledApiKey || '');
  if (!apiKey) throw new Error('请先保存豆包 API Key');
  const voiceType = String(payload.voiceType || 'zh_female_xiaohe_uranus_bigtts');
  const resourceId = String(payload.bundledResourceId || '') || (voiceType.includes('uranus') || voiceType.startsWith('saturn_')
    ? 'seed-tts-2.0'
    : 'seed-tts-1.0');
  const endpoint = String(payload.bundledEndpoint || '') || TTS_ENDPOINT;
  const speedRatio = Math.max(0.5, Math.min(2, Number(payload.speedRatio || 1)));
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'X-Api-Resource-Id': resourceId,
      'X-Api-Request-Id': crypto.randomUUID(),
      'Content-Type': 'application/json',
      'X-Control-Require-Usage-Tokens-Return': 'text_words'
    },
    body: JSON.stringify({
      user: {uid: 'lowcode-carousel-studio-desktop'},
      req_params: {
        text: String(payload.text || ''),
        speaker: voiceType,
        audio_params: {
          format: 'mp3',
          sample_rate: 24000,
          speech_rate: Math.round((speedRatio - 1) * 100),
          loudness_rate: 0
        }
      }
    })
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`TTS HTTP ${response.status}: ${raw.slice(0, 240)}`);
  const frames = parseJsonStream(raw);
  const chunks = frames
    .map((frame) => frame.data)
    .filter((data) => typeof data === 'string' && data.length)
    .map((data) => Buffer.from(data, 'base64'));
  if (!chunks.length) {
    const failed = frames.find((frame) => frame.code && frame.code !== 0 && frame.code !== 20000000);
    throw new Error(failed?.message || 'TTS 返回中没有音频数据');
  }
  return {audioBase64: Buffer.concat(chunks).toString('base64')};
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#090a0d',
    title: '低代码轮播视频工作台',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
}

ipcMain.handle('tts:get-key-status', () => Boolean(readApiKey()));
ipcMain.handle('tts:save-api-key', (_event, apiKey) => saveApiKey(apiKey));
ipcMain.handle('tts:synthesize', (_event, payload) => synthesizeTts(payload));

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
