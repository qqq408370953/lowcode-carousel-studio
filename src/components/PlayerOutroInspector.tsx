import {ImagePlus, Upload} from 'lucide-react';
import {useRef} from 'react';
import type {Asset, PlayerOutroConfig, Slide} from '../types';
import {RangeField} from './FormControls';

interface PlayerOutroInspectorProps {
  slide: Slide;
  assets: Asset[];
  onUpdateSlide: (patch: Partial<Slide>) => void;
  onUpdatePlayer: (patch: Partial<PlayerOutroConfig>) => void;
  onUploadPoster: (files: FileList) => void;
}

export function PlayerOutroInspector({slide, assets, onUpdateSlide, onUpdatePlayer, onUploadPoster}: PlayerOutroInspectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const config = slide.player!;
  const images = assets.filter((asset) => asset.type.startsWith('image/'));

  return (
    <div className="tab-panel active player-outro-inspector">
      <div className="section-title">播放器片尾</div>
      <label>剧名<input value={config.showTitle} maxLength={32} onChange={(event) => onUpdatePlayer({showTitle: event.target.value})} /></label>
      <div className="form-grid">
        <label>集数 / 副标题<input value={config.episode} maxLength={24} onChange={(event) => onUpdatePlayer({episode: event.target.value})} /></label>
        <label>清晰度<input value={config.quality} maxLength={12} onChange={(event) => onUpdatePlayer({quality: event.target.value})} /></label>
      </div>
      <label>引导文案<textarea rows={3} value={config.prompt} maxLength={50} onChange={(event) => onUpdatePlayer({prompt: event.target.value})} /></label>
      <div className="form-grid">
        <RangeField label="播放进度" value={config.progress} min={0} max={100} onChange={(progress) => onUpdatePlayer({progress})} />
        <RangeField label="片尾时长" value={slide.duration} min={1} max={10} step={0.5} onChange={(duration) => onUpdateSlide({duration})} />
      </div>

      <div className="section-title">剧集画面</div>
      <button className="button full command-button" type="button" onClick={() => inputRef.current?.click()}>
        <Upload size={16} />上传并替换画面
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          if (event.target.files?.length) onUploadPoster(event.target.files);
          event.currentTarget.value = '';
        }}
      />
      {images.length ? (
        <div className="poster-picker" aria-label="选择剧集画面">
          {images.map((asset) => (
            <button
              className={asset.url === config.posterSrc ? 'active' : ''}
              type="button"
              key={asset.id}
              title={`使用 ${asset.name}`}
              onClick={() => onUpdatePlayer({posterSrc: asset.url, posterName: asset.name})}
            >
              <img src={asset.url} alt="" />
              <span>{asset.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-properties"><ImagePlus size={22} /><p>上传图片后可替换播放器中的剧集画面。</p></div>
      )}
      <div className="outro-order-note">该模板固定为时间线最后一屏。</div>
    </div>
  );
}
