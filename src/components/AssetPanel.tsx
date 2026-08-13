import {CirclePlus, Clapperboard, Music2, Save, Trash2, Upload, Video} from 'lucide-react';
import {useRef, useState} from 'react';
import {aspectLabel} from '../lib/aspect';
import type {Asset, CoverTemplateSummary} from '../types';

interface AssetPanelProps {
  assets: Asset[];
  coverTemplates: CoverTemplateSummary[];
  onFiles: (files: FileList) => void;
  onApplyAsset: (asset: Asset) => void;
  onApplyShareSavePreset: () => void;
  onApplyPlayerPreset: () => void;
  onApplyWebsiteCoverPreset: () => void;
  onSaveCoverTemplate: (name: string) => void;
  onApplyCoverTemplate: (id: string) => void;
  onDeleteCoverTemplate: (id: string) => void;
}

export function AssetPanel({assets, coverTemplates, onFiles, onApplyAsset, onApplyShareSavePreset, onApplyPlayerPreset, onApplyWebsiteCoverPreset, onSaveCoverTemplate, onApplyCoverTemplate, onDeleteCoverTemplate}: AssetPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  return (
    <aside className="panel assets-panel">
      <div className="panel-heading">
        <h2>本地素材</h2>
        <button className="icon-button" type="button" title="上传素材" onClick={() => inputRef.current?.click()}>
          <Upload size={17} />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,audio/*,video/*"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) onFiles(event.target.files);
            event.currentTarget.value = '';
          }}
        />
      </div>
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          onFiles(event.dataTransfer.files);
        }}
      >
        <strong>拖入图片、视频或音频</strong>
        <span>点击素材右侧按钮添加到当前屏幕</span>
      </div>
      <div className="preset-section">
        <div className="preset-heading">
          <span>预置模板</span>
          <button className="preset-save-button" type="button" title="保存当前屏为封面模板" onClick={() => setSavingTemplate(true)}><Save size={14} />保存封面</button>
        </div>
        {savingTemplate && (
          <div className="template-save-form">
            <input autoFocus value={templateName} placeholder="模板名称" onChange={(event) => setTemplateName(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter' && templateName.trim()) {
                onSaveCoverTemplate(templateName);
                setTemplateName('');
                setSavingTemplate(false);
              }
            }} />
            <button className="button small primary" type="button" disabled={!templateName.trim()} onClick={() => { onSaveCoverTemplate(templateName); setTemplateName(''); setSavingTemplate(false); }}>保存</button>
            <button className="button small ghost" type="button" onClick={() => setSavingTemplate(false)}>取消</button>
          </div>
        )}
        {coverTemplates.map((template) => (
          <div className="cover-template-card" key={template.id}>
            <button className="cover-template-apply" type="button" onClick={() => onApplyCoverTemplate(template.id)}>
              <img src={template.previewUrl} alt="" />
              <span><strong>{template.name}</strong><small>{aspectLabel(template.aspect)} · 可编辑封面</small></span>
              <CirclePlus size={18} />
            </button>
            <button className="cover-template-delete" type="button" title="删除模板" onClick={() => onDeleteCoverTemplate(template.id)}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="player-preset-card website-cover-preset-card" type="button" onClick={onApplyWebsiteCoverPreset}>
          <span className="player-preset-preview">
            <img src={`${import.meta.env.BASE_URL}presets/website-series-cover-preview.png`} alt="" />
          </span>
          <span><strong>每天一个神奇的网站</strong><small>期数、副标题、页面截图可替换</small></span>
          <CirclePlus size={18} />
        </button>
        <button className="player-preset-card" type="button" onClick={onApplyShareSavePreset}>
          <span className="player-preset-preview share-composite-preview">
            <img src={`${import.meta.env.BASE_URL}presets/share-save-composite.png`} alt="" />
          </span>
          <span><strong>分享保存提示图</strong><small>半透明背景 · 删除线文案</small></span>
          <CirclePlus size={18} />
        </button>
        <button className="player-preset-card" type="button" onClick={onApplyPlayerPreset}>
          <span className="player-preset-preview">
            <Clapperboard size={19} />
            <i><b /></i>
          </span>
          <span><strong>播放器片尾</strong><small>剧名、画面和进度均可替换</small></span>
          <CirclePlus size={18} />
        </button>
      </div>
      <div className="asset-list" aria-live="polite">
        {!assets.length && <div className="hint">还没有素材。上传后可拖到中间画布。</div>}
        {assets.map((asset) => (
          <div
            className="asset-card"
            draggable
            key={asset.id}
            onDragStart={(event) => event.dataTransfer.setData('application/x-studio-asset', asset.id)}
            onDoubleClick={() => onApplyAsset(asset)}
          >
            {asset.type.startsWith('image/') ? <img className="asset-thumb" src={asset.url} alt="" />
              : asset.type.startsWith('video/') ? <div className="asset-video"><Video size={22} /></div>
                : <div className="asset-audio"><Music2 size={20} /></div>}
            <div className="asset-copy">
              <div className="asset-name">{asset.name}</div>
              <div className="asset-meta">{asset.type.startsWith('image/') ? '图片素材' : asset.type.startsWith('video/') ? '带原声视频' : '口播音频'}</div>
            </div>
            <button
              className="icon-button asset-apply"
              type="button"
              title={asset.type.startsWith('audio/') ? '设为口播音频' : '添加到当前屏幕'}
              onClick={(event) => { event.stopPropagation(); onApplyAsset(asset); }}
            >
              <CirclePlus size={18} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
