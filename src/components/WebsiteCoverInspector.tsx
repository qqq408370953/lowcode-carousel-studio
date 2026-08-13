import {ImagePlus, Layers3, RotateCcw, Upload} from 'lucide-react';
import {useRef} from 'react';
import {createWebsiteCoverConfig} from '../lib/model';
import type {Asset, Slide, WebsiteCoverConfig} from '../types';
import {RangeField} from './FormControls';

interface WebsiteCoverInspectorProps {
  slide: Slide;
  assets: Asset[];
  onUpdateSlide: (patch: Partial<Slide>) => void;
  onUploadScreenshot: (files: FileList) => void;
}

export function WebsiteCoverInspector({slide, assets, onUpdateSlide, onUploadScreenshot}: WebsiteCoverInspectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const config = slide.websiteCover!;
  const images = assets.filter((asset) => asset.type.startsWith('image/'));
  const update = (patch: Partial<WebsiteCoverConfig>) => onUpdateSlide({websiteCover: {...config, ...patch}});

  return (
    <div className="tab-panel active website-cover-inspector">
      <div className="section-title">网站系列封面</div>
      <div className="form-grid">
        <label>期数
          <input type="number" min="1" max="999" value={config.issue} onChange={(event) => update({issue: Math.max(1, Number(event.target.value))})} />
        </label>
        <RangeField
          label="副标题整体缩放"
          value={config.subtitleScale ?? 1}
          min={0.6}
          max={1.6}
          step={0.05}
          onChange={(subtitleScale) => update({subtitleScale})}
        />
      </div>
      <label className="form-row website-cover-subtitle-field">副标题（超出自动换行）
        <textarea rows={2} value={config.subtitle} onChange={(event) => update({subtitle: event.target.value})} />
      </label>

      <div className="section-title">内容截图</div>
      <button className="button full command-button" type="button" onClick={() => inputRef.current?.click()}>
        <Upload size={16} />上传并替换截图
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          if (event.target.files?.length) onUploadScreenshot(event.target.files);
          event.currentTarget.value = '';
        }}
      />
      {images.length ? (
        <div className="poster-picker website-screenshot-picker" aria-label="选择网页截图">
          {images.map((asset) => (
            <button
              className={asset.url === config.screenshotSrc ? 'active' : ''}
              type="button"
              key={asset.id}
              title={`使用 ${asset.name}`}
              onClick={() => update({screenshotSrc: asset.url, screenshotName: asset.name, screenshotScale: 1, screenshotX: 0, screenshotY: 0})}
            >
              <img src={asset.url} alt="" />
              <span>{asset.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-properties"><ImagePlus size={22} /><p>上传网页或内容截图后可直接替换设备画面。</p></div>
      )}
      <RangeField label="截图缩放" value={Math.max(1, config.screenshotScale)} min={1} max={3} step={0.01} onChange={(screenshotScale) => update({screenshotScale})} />
      <div className="form-grid">
        <RangeField label="水平位置" value={config.screenshotX} min={-50} max={50} onChange={(screenshotX) => update({screenshotX})} />
        <RangeField label="垂直位置" value={config.screenshotY} min={-50} max={50} onChange={(screenshotY) => update({screenshotY})} />
      </div>
      <button className="button full ghost command-button" type="button" onClick={() => onUpdateSlide({websiteCover: createWebsiteCoverConfig()})}>
        <RotateCcw size={15} />恢复 FMHY 默认内容
      </button>

      <div className="website-layer-stack" aria-label="固定图层顺序">
        <Layers3 size={17} />
        <span><strong>人物、胳膊与手指</strong><small>顶层 · 固定遮挡</small></span>
        <span><strong>网页截图</strong><small>中层 · 人物后方</small></span>
        <span><strong>设备与版式底图</strong><small>底层 · 固定锁定</small></span>
      </div>
    </div>
  );
}
