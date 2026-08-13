import {ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Play, RotateCcw, Trash2, Video as VideoIcon, Volume2, VolumeX} from 'lucide-react';
import {entranceAnimationGroups, exitAnimationGroups, transitionOptions} from '../lib/animationOptions';
import type {AnimationDirection, ImageAnimation, Slide, SlideTransition, VideoLayer, VideoLayout} from '../types';
import {RangeField} from './FormControls';

interface VideoInspectorProps {
  slide: Slide;
  video?: VideoLayer;
  selectedVideoId: string;
  onUpdateSlide: (patch: Partial<Slide>) => void;
  onSelectVideo: (videoId: string) => void;
  onUpdateVideo: (videoId: string, patch: Partial<VideoLayer>) => void;
  onMoveVideo: (videoId: string, target: 'top' | 'up' | 'down' | 'bottom') => void;
  onResetVideo: (videoId: string) => void;
  onDeleteVideo: (videoId: string) => void;
  onPreviewVideoAnimation: (video: VideoLayer, direction: AnimationDirection) => void;
}

const layouts: Array<{value: VideoLayout; label: string}> = [
  {value: 'full', label: '整屏'},
  {value: 'left', label: '左半'},
  {value: 'right', label: '右半'},
  {value: 'top', label: '上半'},
  {value: 'bottom', label: '下半'}
];

export function VideoInspector({
  slide,
  video,
  selectedVideoId,
  onUpdateSlide,
  onSelectVideo,
  onUpdateVideo,
  onMoveVideo,
  onResetVideo,
  onDeleteVideo,
  onPreviewVideoAnimation
}: VideoInspectorProps) {
  const videoIndex = video ? slide.videos.findIndex((item) => item.id === video.id) : -1;
  const update = (patch: Partial<VideoLayer>) => video && onUpdateVideo(video.id, patch);
  const maxDuration = Math.max(0, video?.sourceDuration || 0);

  return (
    <section className="tab-panel active">
      <div className="form-row">
        <label htmlFor="video-slide-duration">屏幕时长</label>
        <input id="video-slide-duration" type="number" min="0.5" step="0.1" value={slide.duration} onChange={(event) => onUpdateSlide({duration: Math.max(0.5, Number(event.target.value))})} />
      </div>
      <div className="form-grid">
        <label>屏幕转场
          <select value={slide.transition} onChange={(event) => onUpdateSlide({transition: event.target.value as SlideTransition})}>
            {transitionOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>转场时长
          <input type="number" min="0.2" max="3" step="0.1" value={slide.transitionDuration} onChange={(event) => onUpdateSlide({transitionDuration: Math.max(0.2, Number(event.target.value))})} />
        </label>
      </div>

      <div className="layer-section">
        <div className="layer-heading"><strong>视频图层</strong><span>{slide.videos.length} 个图层</span></div>
        <div className="image-layer-list">
          {[...slide.videos].reverse().map((layer, reverseIndex) => (
            <button className={`image-layer-row ${layer.id === selectedVideoId ? 'active' : ''}`} type="button" key={layer.id} onClick={() => onSelectVideo(layer.id)}>
              <span className="video-layer-icon"><VideoIcon size={17} /></span>
              <span className="image-layer-name">{layer.name}</span>
              <span className="image-layer-order">{reverseIndex === 0 ? '顶层' : slide.videos.length - reverseIndex}</span>
            </button>
          ))}
        </div>
      </div>

      {!video && <div className="inspector-empty">上传视频后选择一个视频图层</div>}
      {video && (
        <div className="image-controls">
          <div className="layer-actions" aria-label="调整视频层级">
            <button className="icon-button" type="button" title="置顶" disabled={videoIndex === slide.videos.length - 1} onClick={() => onMoveVideo(video.id, 'top')}><ChevronsUp size={17} /></button>
            <button className="icon-button" type="button" title="上移一层" disabled={videoIndex === slide.videos.length - 1} onClick={() => onMoveVideo(video.id, 'up')}><ChevronUp size={17} /></button>
            <button className="icon-button" type="button" title="下移一层" disabled={videoIndex === 0} onClick={() => onMoveVideo(video.id, 'down')}><ChevronDown size={17} /></button>
            <button className="icon-button" type="button" title="置底" disabled={videoIndex === 0} onClick={() => onMoveVideo(video.id, 'bottom')}><ChevronsDown size={17} /></button>
          </div>

          <div className="form-row">
            <label>画面布局</label>
            <div className="video-layout-picker">
              {layouts.map((layout) => (
                <button className={video.layout === layout.value ? 'active' : ''} type="button" key={layout.value} onClick={() => update({layout: layout.value, x: 0, y: 0, scale: 1})}>{layout.label}</button>
              ))}
            </div>
          </div>

          <div className="form-grid">
            <label>剪辑起点
              <input type="number" min="0" max={Math.max(0, video.trimEnd - 0.1)} step="0.1" value={video.trimStart.toFixed(1)} onChange={(event) => update({trimStart: Math.min(Number(event.target.value), video.trimEnd - 0.1)})} />
            </label>
            <label>剪辑终点
              <input type="number" min={video.trimStart + 0.1} max={maxDuration} step="0.1" value={video.trimEnd.toFixed(1)} onChange={(event) => update({trimEnd: Math.max(video.trimStart + 0.1, Math.min(maxDuration, Number(event.target.value)))})} />
            </label>
          </div>
          <div className="video-source-meta">
            <span>源视频 {maxDuration.toFixed(1)}s</span>
            <button className="button small ghost" type="button" onClick={() => onUpdateSlide({duration: Number(((video.trimEnd - video.trimStart) / video.playbackRate).toFixed(1))})}>匹配剪辑时长</button>
          </div>
          <div className="form-grid">
            <label>播放速度
              <select value={video.playbackRate} onChange={(event) => update({playbackRate: Number(event.target.value)})}>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => <option value={rate} key={rate}>{rate}x</option>)}
              </select>
            </label>
            <label>结束后
              <select value={video.loop ? 'loop' : 'freeze'} onChange={(event) => update({loop: event.target.value === 'loop'})}>
                <option value="freeze">停在末帧</option>
                <option value="loop">循环播放</option>
              </select>
            </label>
          </div>
          <RangeField label="原声音量" value={video.volume} min={0} max={100} onChange={(volume) => update({volume})} />
          <button className={`button ghost command-button video-audio-toggle ${video.muted ? '' : 'active'}`} type="button" onClick={() => update({muted: !video.muted})}>
            {video.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}{video.muted ? '原声已静音' : '保留视频原声'}
          </button>

          <div className="form-grid">
            <label>入场动画
              <select value={video.entrance} onChange={(event) => update({entrance: event.target.value as ImageAnimation})}>
                <option value="none">无</option>
                {entranceAnimationGroups.map((group) => <optgroup label={group.label} key={group.label}>{group.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</optgroup>)}
              </select>
            </label>
            <label>出场动画
              <select value={video.exit} onChange={(event) => update({exit: event.target.value as ImageAnimation})}>
                <option value="none">无</option>
                {exitAnimationGroups.map((group) => <optgroup label={group.label} key={group.label}>{group.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</optgroup>)}
              </select>
            </label>
          </div>
          <div className="form-grid animation-row">
            <label>动画时长
              <input type="number" min="0.2" max="3" step="0.1" value={video.animationDuration} onChange={(event) => update({animationDuration: Math.max(0.2, Number(event.target.value))})} />
            </label>
            <div className="animation-preview-actions">
              <button className="button small ghost command-button" type="button" onClick={() => onPreviewVideoAnimation(video, 'entrance')}><Play size={14} />入场</button>
              <button className="button small ghost command-button" type="button" onClick={() => onPreviewVideoAnimation(video, 'exit')}><Play size={14} />出场</button>
            </div>
          </div>
          <div className="form-row">
            <label>视频适配
              <select value={video.fit} onChange={(event) => update({fit: event.target.value as VideoLayer['fit']})}>
                <option value="contain">完整显示</option>
                <option value="cover">铺满裁剪</option>
              </select>
            </label>
          </div>
          <RangeField label="放大缩小" value={video.scale} min={0.2} max={3} step={0.01} onChange={(scale) => update({scale})} />
          <div className="form-grid">
            <RangeField label="水平位置" value={video.x} min={-100} max={100} onChange={(x) => update({x})} />
            <RangeField label="垂直位置" value={video.y} min={-100} max={100} onChange={(y) => update({y})} />
          </div>
          <RangeField label="旋转" value={video.rotate} min={-180} max={180} onChange={(rotate) => update({rotate})} />
          <div className="form-grid">
            <RangeField label="亮度" value={video.brightness} min={40} max={180} onChange={(brightness) => update({brightness})} />
            <RangeField label="对比度" value={video.contrast} min={40} max={180} onChange={(contrast) => update({contrast})} />
            <RangeField label="饱和度" value={video.saturation} min={0} max={220} onChange={(saturation) => update({saturation})} />
            <RangeField label="色调" value={video.hue} min={-180} max={180} onChange={(hue) => update({hue})} />
          </div>
          <div className="image-edit-actions">
            <button className="button ghost command-button" type="button" onClick={() => onResetVideo(video.id)}><RotateCcw size={15} />重置参数</button>
            <button className="button ghost danger command-button" type="button" onClick={() => onDeleteVideo(video.id)}><Trash2 size={15} />删除视频</button>
          </div>
        </div>
      )}
    </section>
  );
}
