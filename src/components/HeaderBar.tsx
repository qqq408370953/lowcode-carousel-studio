import {Download, FileImage, Pause, Play} from 'lucide-react';
import {aspectOptions} from '../lib/aspect';
import type {AspectRatio} from '../types';

interface HeaderBarProps {
  aspect: AspectRatio;
  previewing: boolean;
  onAspectChange: (aspect: AspectRatio) => void;
  onTogglePreview: () => void;
  onExport: () => void;
  onExportImage: () => void;
}

export function HeaderBar({aspect, previewing, onAspectChange, onTogglePreview, onExport, onExportImage}: HeaderBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">LC</div>
        <div>
          <h1>低代码轮播视频工作台</h1>
          <p>图片轮播 · 字幕动画 · 豆包 TTS · 一键导出</p>
        </div>
      </div>
      <div className="top-actions">
        <label className="aspect-control" title="画面比例">
          <span>比例</span>
          <select value={aspect} aria-label="画面比例" onChange={(event) => onAspectChange(event.target.value as AspectRatio)}>
            {aspectOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button className="button ghost command-button" type="button" aria-label={previewing ? '停止预览' : '预览'} onClick={onTogglePreview}>
          {previewing ? <Pause size={16} /> : <Play size={16} />}
          <span className="top-command-label">{previewing ? '停止' : '预览'}</span>
        </button>
        <button className="button ghost command-button" type="button" aria-label="导出当前屏为图片" onClick={onExportImage}>
          <FileImage size={16} />
          <span className="top-command-label">导出图片</span>
        </button>
        <button className="button primary command-button" type="button" aria-label="导出视频" onClick={onExport}>
          <Download size={16} />
          <span className="top-command-label">导出视频</span>
        </button>
      </div>
    </header>
  );
}
