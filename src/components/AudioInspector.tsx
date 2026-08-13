import {AudioLines, Download, KeyRound, Save, TimerReset} from 'lucide-react';
import {useState} from 'react';
import type {Narration} from '../types';
import {hasBundledTtsConfig} from '../lib/ttsClient';

interface AudioInspectorProps {
  narration: Narration;
  generating: boolean;
  nativeRuntime: boolean;
  ttsKeyConfigured: boolean;
  onTextChange: (text: string) => void;
  onSettingsChange: (patch: Pick<Narration, 'voiceType'> | Pick<Narration, 'speedRatio'>) => void;
  onGenerate: (voiceType: string, speed: number) => void;
  onSaveTtsKey: (apiKey: string) => void;
  onMetadata: (duration: number) => void;
  onSync: () => void;
  onExport: () => void;
}

const speedOptions = [
  {label: '慢速', value: 0.85},
  {label: '正常', value: 1},
  {label: '快速', value: 1.15}
];

export function AudioInspector({narration, generating, nativeRuntime, ttsKeyConfigured, onTextChange, onSettingsChange, onGenerate, onSaveTtsKey, onMetadata, onSync, onExport}: AudioInspectorProps) {
  const [apiKey, setApiKey] = useState('');
  const speed = narration.speedRatio;
  return (
    <section className="tab-panel active">
      <div className="form-row">
        <label>口播文案
          <textarea rows={7} value={narration.text} onChange={(event) => onTextChange(event.target.value)} placeholder="输入口播内容，生成配音后可同步轮播时长。" />
        </label>
      </div>
      <label className="tts-voice-field">豆包音色<input type="text" value={narration.voiceType} onChange={(event) => onSettingsChange({voiceType: event.target.value})} /></label>
      <div className="tts-speed-control">
        <div className="field-label"><span>口播语速</span><output>{speed.toFixed(2)}×</output></div>
        <div className="segmented tts-speed-presets" aria-label="语速预设">
          {speedOptions.map((option) => (
            <button className={Math.abs(speed - option.value) < 0.001 ? 'active' : ''} type="button" key={option.label} onClick={() => onSettingsChange({speedRatio: option.value})}>
              {option.label}
            </button>
          ))}
        </div>
        <input aria-label="精细调整口播语速" type="range" min="0.7" max="1.3" step="0.05" value={speed} onChange={(event) => onSettingsChange({speedRatio: Number(event.target.value)})} />
        <div className="speed-scale" aria-hidden="true"><span>0.70×</span><strong>正常人语速 1.00×</strong><span>1.30×</span></div>
      </div>
      {nativeRuntime && !ttsKeyConfigured && (
        <div className="native-key-row">
          <label><span><KeyRound size={13} />API Key {ttsKeyConfigured ? '已保存' : '未配置'}</span><input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="输入豆包 API Key" /></label>
          <button className="icon-button" type="button" title="保存 API Key" disabled={!apiKey.trim()} onClick={() => { onSaveTtsKey(apiKey); setApiKey(''); }}><Save size={16} /></button>
        </div>
      )}
      <div className="audio-actions">
        <button className="button full command-button" type="button" disabled={generating || !narration.text.trim()} onClick={() => onGenerate(narration.voiceType, speed)}>
          <AudioLines size={16} />{generating ? '生成中...' : '生成豆包配音'}
        </button>
        <button className="button full ghost command-button" type="button" onClick={onSync}>
          <TimerReset size={16} />同步轮播
        </button>
      </div>
      {narration.audioUrl ? (
        <div className="tts-preview">
          <div className="tts-preview-heading"><strong>语音试听</strong><span>{narration.duration ? `${narration.duration.toFixed(1)} 秒` : '正在读取时长'}</span></div>
          <audio src={narration.audioUrl} controls preload="metadata" onLoadedMetadata={(event) => onMetadata(event.currentTarget.duration || 0)} />
          <button className="button full ghost command-button" type="button" onClick={onExport}>
            <Download size={16} />导出 MP3
          </button>
        </div>
      ) : (
        <div className="tts-preview-empty"><AudioLines size={20} /><span>生成后可在这里试听并导出 MP3</span></div>
      )}
      <div className="hint">{nativeRuntime
        ? hasBundledTtsConfig() ? '当前私有安装包已内置 TTS 配置，也可把本地音频设置为口播。' : '安装包在当前设备保存密钥，也可把本地音频设置为口播。'
        : '豆包 API Key 仅保存在本地服务端，也可把本地音频拖入素材区后设置为口播。'}</div>
    </section>
  );
}
