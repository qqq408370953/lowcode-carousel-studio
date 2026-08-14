import {createServer} from 'node:http';
import {existsSync, createReadStream, createWriteStream, readFileSync} from 'node:fs';
import {mkdtemp, rm, stat} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import crypto from 'node:crypto';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(__dirname, 'dist');

function loadLocalEnv() {
  const envPath = join(__dirname, '.env');
  if (!existsSync(envPath)) return;
  const rows = readFileSync(envPath, 'utf8').split(/\r?\n/);
  rows.forEach((row) => {
    const line = row.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) return;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    const rawValue = line.slice(index + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

loadLocalEnv();
const requestedPort = Number(process.env.PORT || 4177);
const host = process.env.HOST || '0.0.0.0';
const startPort = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65535
  ? requestedPort
  : 4177;
const maxPort = Math.min(startPort + 100, 65535);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4'
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function cleanPublicPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const resolved = normalize(join(publicDir, decoded === '/' ? '/index.html' : decoded));
  if (!resolved.startsWith(publicDir)) return null;
  return resolved;
}

async function handleDoubaoTts(req, res) {
  let payload;
  try {
    payload = await readJson(req);
  } catch {
    sendJson(res, 400, {error: '请求体不是有效 JSON'});
    return;
  }

  const text = String(payload.text || '').trim();
  if (!text) {
    sendJson(res, 400, {error: '请先填写口播文案'});
    return;
  }

  const mode = process.env.DOUBAO_TTS_MODE || (process.env.DOUBAO_API_KEY ? 'api-key' : 'openspeech');
  try {
    if (mode === 'api-key') {
      await synthesizeWithApiKeyV3(payload, res);
      return;
    }

    if (mode === 'ark') {
      await synthesizeWithArk(payload, res);
      return;
    }

    await synthesizeWithOpenSpeech(payload, res);
  } catch (error) {
    sendJson(res, 502, {
      error: error.message || '豆包 TTS 调用失败',
      hint: '检查 .env 中的 DOUBAO_API_KEY、DOUBAO_RESOURCE_ID、DOUBAO_VOICE_TYPE 是否正确且互相匹配。'
    });
  }
}

function speedRatioToSpeechRate(speedRatio) {
  const ratio = Math.max(0.5, Math.min(2, Number(speedRatio || 1)));
  return Math.round((ratio - 1) * 100);
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
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
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

async function synthesizeWithApiKeyV3(payload, res) {
  const apiKey = process.env.DOUBAO_API_KEY;
  const resourceId = payload.resourceId || process.env.DOUBAO_RESOURCE_ID || 'seed-tts-2.0';
  const speaker = payload.voiceType || process.env.DOUBAO_VOICE_TYPE || 'zh_female_xiaohe_uranus_bigtts';
  const endpoint = process.env.DOUBAO_TTS_ENDPOINT || 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';

  if (!apiKey) {
    throw new Error('缺少 DOUBAO_API_KEY');
  }

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
      user: {uid: payload.uid || 'lowcode-carousel-studio'},
      req_params: {
        text: String(payload.text || ''),
        speaker,
        audio_params: {
          format: 'mp3',
          sample_rate: 24000,
          speech_rate: speedRatioToSpeechRate(payload.speedRatio),
          loudness_rate: 0
        }
      }
    })
  });

  const responseText = await response.text();
  if (!response.ok) {
    const logid = response.headers.get('X-Tt-Logid');
    throw new Error(`TTS HTTP ${response.status}${logid ? ` logid=${logid}` : ''}: ${responseText.slice(0, 240)}`);
  }

  const frames = parseJsonStream(responseText);
  const audioChunks = frames
    .map((frame) => frame.data)
    .filter((data) => typeof data === 'string' && data.length > 0)
    .map((data) => Buffer.from(data, 'base64'));

  if (!audioChunks.length) {
    const failed = frames.find((frame) => frame.code && frame.code !== 0 && frame.code !== 20000000);
    throw new Error(failed?.message || 'TTS 返回中没有音频 data 字段');
  }

  const audio = Buffer.concat(audioChunks);
  res.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Content-Length': audio.length,
    'X-TTS-Provider': 'doubao-api-key-v3'
  });
  res.end(audio);
}

async function synthesizeWithOpenSpeech(payload, res) {
  const appid = process.env.DOUBAO_APP_ID;
  const token = process.env.DOUBAO_ACCESS_TOKEN;
  const cluster = payload.cluster || process.env.DOUBAO_CLUSTER || 'volcano_tts';
  const voiceType = payload.voiceType || process.env.DOUBAO_VOICE_TYPE || 'zh_female_wanwanxiaohe_moon_bigtts';
  const endpoint = process.env.DOUBAO_TTS_ENDPOINT || 'https://openspeech.bytedance.com/api/v1/tts';

  if (!appid || !token) {
    throw new Error('缺少 DOUBAO_APP_ID 或 DOUBAO_ACCESS_TOKEN');
  }

  const body = {
    app: {appid, token, cluster},
    user: {uid: payload.uid || 'lowcode-carousel-studio'},
    audio: {
      voice_type: voiceType,
      encoding: 'mp3',
      speed_ratio: Number(payload.speedRatio || 1),
      volume_ratio: Number(payload.volumeRatio || 1),
      pitch_ratio: Number(payload.pitchRatio || 1)
    },
    request: {
      reqid: crypto.randomUUID(),
      text: String(payload.text || ''),
      operation: 'query'
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer; ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`TTS HTTP ${response.status}: ${responseText.slice(0, 240)}`);
  }

  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(`TTS 返回不是 JSON: ${responseText.slice(0, 240)}`);
  }

  if (!result.data) {
    throw new Error(result.message || result.error || 'TTS 返回中没有音频 data 字段');
  }

  const audio = Buffer.from(result.data, 'base64');
  res.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Content-Length': audio.length,
    'X-TTS-Provider': 'doubao-openspeech'
  });
  res.end(audio);
}

async function synthesizeWithArk(payload, res) {
  const apiKey = process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY;
  const endpoint = process.env.ARK_TTS_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/audio/speech';
  const model = payload.model || process.env.ARK_TTS_MODEL;
  const voice = payload.voiceType || process.env.DOUBAO_VOICE_TYPE;

  if (!apiKey || !model || !voice) {
    throw new Error('方舟模式缺少 ARK_API_KEY、ARK_TTS_MODEL 或 DOUBAO_VOICE_TYPE');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: String(payload.text || ''),
      voice,
      response_format: 'mp3',
      speed: Number(payload.speedRatio || 1)
    })
  });

  const arrayBuffer = await response.arrayBuffer();
  if (!response.ok) {
    throw new Error(`TTS HTTP ${response.status}: ${Buffer.from(arrayBuffer).toString('utf8').slice(0, 240)}`);
  }

  const audio = Buffer.from(arrayBuffer);
  res.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Content-Length': audio.length,
    'X-TTS-Provider': 'doubao-ark'
  });
  res.end(audio);
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.FFMPEG_PATH || 'ffmpeg', args, {stdio: ['ignore', 'ignore', 'pipe']});
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-6000);
    });
    child.on('error', (error) => reject(new Error(`无法启动 FFmpeg：${error.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg 转码失败 (${code})：${stderr.slice(-1200)}`));
    });
  });
}

function probeVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.FFPROBE_PATH || 'ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ], {stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-1000);
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-2000);
    });
    child.on('error', (error) => reject(new Error(`无法启动 FFprobe：${error.message}`)));
    child.on('close', (code) => {
      const duration = Number(stdout.trim());
      if (code === 0 && Number.isFinite(duration)) resolve(duration);
      else reject(new Error(`FFprobe 时长检测失败：${stderr.slice(-800)}`));
    });
  });
}

async function handleVideoTranscode(req, res) {
  const contentLength = Number(req.headers['content-length'] || 0);
  const requestedDuration = Number(req.headers['x-expected-duration'] || 0);
  const expectedDuration = Number.isFinite(requestedDuration) && requestedDuration > 0
    ? Math.min(requestedDuration, 60 * 60 * 6)
    : 0;
  if (contentLength > 1024 * 1024 * 800) {
    sendJson(res, 413, {error: '待转换视频超过 800MB'});
    return;
  }

  const workDir = await mkdtemp(join(tmpdir(), 'carousel-transcode-'));
  const inputPath = join(workDir, 'input-video');
  const outputPath = join(workDir, 'output.mp4');
  try {
    await pipeline(req, createWriteStream(inputPath));
    const inputStat = await stat(inputPath);
    if (inputStat.size < 1024) throw new Error('录制视频数据为空');
    await runFfmpeg([
      '-y',
      '-fflags', '+genpts',
      '-i', inputPath,
      '-map', '0:v:0',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-avoid_negative_ts', 'make_zero',
      '-movflags', '+faststart',
      outputPath
    ]);
    const outputStat = await stat(outputPath);
    const outputDuration = await probeVideoDuration(outputPath);
    if (outputStat.size < 1024 || outputDuration <= 0.1) {
      throw new Error('转码后的 MP4 时长无效');
    }
    if (expectedDuration >= 1 && outputDuration < expectedDuration * 0.8) {
      throw new Error(`转码后视频不完整：预期 ${expectedDuration.toFixed(1)}s，实际 ${outputDuration.toFixed(1)}s`);
    }
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': outputStat.size,
      'Cache-Control': 'no-store',
      'X-Video-Codec': 'h264',
      'X-Video-Duration': outputDuration.toFixed(3)
    });
    await pipeline(createReadStream(outputPath), res);
  } catch (error) {
    if (!res.headersSent) sendJson(res, 500, {error: error.message || '视频兼容转换失败'});
    else res.destroy(error);
  } finally {
    await rm(workDir, {recursive: true, force: true});
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/health') {
    sendJson(res, 200, {ok: true});
    return;
  }

  if (req.method === 'POST' && req.url === '/api/doubao-tts') {
    await handleDoubaoTts(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/transcode-video') {
    await handleVideoTranscode(req, res);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, {error: 'Method Not Allowed'});
    return;
  }

  const filePath = cleanPublicPath(req.url || '/');
  if (!filePath || !existsSync(filePath)) {
    sendJson(res, 404, {error: 'Not Found'});
    return;
  }

  const ext = extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
});

function listen(port) {
  const handleListening = () => {
    server.off('error', handleError);
    console.log(`Lowcode Carousel Studio running at http://localhost:${port}`);
    if (host === '0.0.0.0') {
      console.log(`LAN access: http://<this-computer-LAN-IP>:${port}`);
    }
  };

  const handleError = (error) => {
    server.off('listening', handleListening);
    if (error.code === 'EADDRINUSE' && port < maxPort) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use, trying ${nextPort}...`);
      listen(nextPort);
      return;
    }

    if (error.code === 'EADDRINUSE') {
      console.error(`No available port found in range ${startPort}-${maxPort}.`);
    } else {
      console.error('Failed to start Lowcode Carousel Studio:', error);
    }
    process.exitCode = 1;
  };

  server.once('error', handleError);
  server.once('listening', handleListening);
  server.listen(port, host);
}

listen(startPort);
