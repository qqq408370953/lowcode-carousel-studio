import {ArrowDown, ArrowUp, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Play, RotateCcw, Trash2} from 'lucide-react';
import {entranceAnimationGroups, exitAnimationGroups, transitionOptions} from '../lib/animationOptions';
import {imageEntranceDelay, imageSequenceSlot, orderedSlideImages} from '../lib/imageSequence';
import type {AnimationDirection, Asset, ImageAnimation, ImageLayer, Slide, SlideTransition} from '../types';
import {RangeField} from './FormControls';

interface ImageInspectorProps {
  slide: Slide;
  assets: Asset[];
  image?: ImageLayer;
  selectedImageId: string;
  onUpdateSlide: (patch: Partial<Slide>) => void;
  onSelectImage: (imageId: string) => void;
  onUpdateImage: (imageId: string, patch: Partial<ImageLayer>) => void;
  onMoveImage: (imageId: string, target: 'top' | 'up' | 'down' | 'bottom') => void;
  onMoveImageEntrance: (imageId: string, direction: 'earlier' | 'later') => void;
  onResetImage: (imageId: string) => void;
  onDeleteImage: (imageId: string) => void;
  onPreviewAnimation: (image: ImageLayer, direction: AnimationDirection) => void;
}

export function ImageInspector({
  slide,
  assets,
  image,
  selectedImageId,
  onUpdateSlide,
  onSelectImage,
  onUpdateImage,
  onMoveImage,
  onMoveImageEntrance,
  onResetImage,
  onDeleteImage,
  onPreviewAnimation
}: ImageInspectorProps) {
  const imageIndex = image ? slide.images.findIndex((item) => item.id === image.id) : -1;
  const update = (patch: Partial<ImageLayer>) => image && onUpdateImage(image.id, patch);

  return (
    <section className="tab-panel active">
      <div className="form-row">
        <label htmlFor="slide-duration">屏幕时长</label>
        <input id="slide-duration" type="number" min="0.5" step="0.1" value={slide.duration} onChange={(event) => onUpdateSlide({duration: Math.max(0.5, Number(event.target.value))})} />
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
        <div className="layer-heading"><strong>图片图层</strong><span>{slide.images.length} 个图层</span></div>
        <div className="image-layer-list">
          {[...slide.images].reverse().map((layer, reverseIndex) => (
            <button
              className={`image-layer-row ${layer.id === selectedImageId ? 'active' : ''}`}
              type="button"
              key={layer.id}
              onClick={() => onSelectImage(layer.id)}
            >
              <img src={layer.src} alt="" />
              <span className="image-layer-name">{layer.name}</span>
              <span className="image-layer-order">{reverseIndex === 0 ? '顶层' : slide.images.length - reverseIndex}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="layer-section entrance-sequence-section">
        <div className="layer-heading">
          <strong>入场顺序</strong>
          <span>间隔 {imageSequenceSlot(slide).toFixed(1)}s</span>
        </div>
        <div className="entrance-order-list">
          {orderedSlideImages(slide).map((layer, orderIndex, ordered) => (
            <div className={`entrance-order-row ${layer.id === selectedImageId ? 'active' : ''}`} key={layer.id}>
              <span className="entrance-order-number">{orderIndex + 1}</span>
              <button className="entrance-order-select" type="button" onClick={() => onSelectImage(layer.id)}>
                <img src={layer.src} alt="" />
                <span><strong>{layer.name}</strong><small>{imageEntranceDelay(slide, layer.id).toFixed(1)}s 入场</small></span>
              </button>
              <button className="icon-button" type="button" title="提前入场" disabled={orderIndex === 0} onClick={() => onMoveImageEntrance(layer.id, 'earlier')}><ArrowUp size={15} /></button>
              <button className="icon-button" type="button" title="延后入场" disabled={orderIndex === ordered.length - 1} onClick={() => onMoveImageEntrance(layer.id, 'later')}><ArrowDown size={15} /></button>
            </div>
          ))}
        </div>
      </div>

      {!image && <div className="inspector-empty">拖入图片后选择一个图层</div>}
      {image && (
        <div className="image-controls">
          <div className="form-row">
            <label>替换当前图层素材
              <select value="" onChange={(event) => {
                const asset = assets.find((item) => item.id === event.target.value);
                if (asset) update({src: asset.url, name: asset.name});
              }}>
                <option value="">选择已上传图片</option>
                {assets.filter((asset) => asset.type.startsWith('image/')).map((asset) => <option value={asset.id} key={asset.id}>{asset.name}</option>)}
              </select>
            </label>
          </div>
          <div className="layer-actions" aria-label="调整图片层级">
            <button className="icon-button" type="button" title="置顶" disabled={imageIndex === slide.images.length - 1} onClick={() => onMoveImage(image.id, 'top')}><ChevronsUp size={17} /></button>
            <button className="icon-button" type="button" title="上移一层" disabled={imageIndex === slide.images.length - 1} onClick={() => onMoveImage(image.id, 'up')}><ChevronUp size={17} /></button>
            <button className="icon-button" type="button" title="下移一层" disabled={imageIndex === 0} onClick={() => onMoveImage(image.id, 'down')}><ChevronDown size={17} /></button>
            <button className="icon-button" type="button" title="置底" disabled={imageIndex === 0} onClick={() => onMoveImage(image.id, 'bottom')}><ChevronsDown size={17} /></button>
          </div>
          <div className="form-grid">
            <label>入场动画
              <select value={image.entrance} onChange={(event) => update({entrance: event.target.value as ImageAnimation})}>
                <option value="none">无</option>
                {entranceAnimationGroups.map((group) => (
                  <optgroup label={group.label} key={group.label}>
                    {group.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label>出场动画
              <select value={image.exit} onChange={(event) => update({exit: event.target.value as ImageAnimation})}>
                <option value="none">无</option>
                {exitAnimationGroups.map((group) => (
                  <optgroup label={group.label} key={group.label}>
                    {group.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
          <div className="form-grid animation-row">
            <label>动画时长
              <input type="number" min="0.2" max="3" step="0.1" value={image.animationDuration} onChange={(event) => update({animationDuration: Math.max(0.2, Number(event.target.value))})} />
            </label>
            <div className="animation-preview-actions">
              <button className="button small ghost command-button" type="button" onClick={() => onPreviewAnimation(image, 'entrance')}><Play size={14} />入场</button>
              <button className="button small ghost command-button" type="button" onClick={() => onPreviewAnimation(image, 'exit')}><Play size={14} />出场</button>
            </div>
          </div>
          <div className="form-row">
            <label>图片适配
              <select value={image.fit} onChange={(event) => update({fit: event.target.value as ImageLayer['fit']})}>
                <option value="contain">完整显示</option>
                <option value="cover">铺满裁剪</option>
              </select>
            </label>
          </div>
          <RangeField label="放大缩小" value={image.scale} min={0.2} max={3} step={0.01} onChange={(scale) => update({scale})} />
          <div className="form-grid">
            <RangeField label="水平位置" value={image.x} min={-100} max={100} onChange={(x) => update({x})} />
            <RangeField label="垂直位置" value={image.y} min={-100} max={100} onChange={(y) => update({y})} />
          </div>
          <RangeField label="旋转" value={image.rotate} min={-180} max={180} onChange={(rotate) => update({rotate})} />
          <div className="form-grid">
            <RangeField label="亮度" value={image.brightness} min={40} max={180} onChange={(brightness) => update({brightness})} />
            <RangeField label="对比度" value={image.contrast} min={40} max={180} onChange={(contrast) => update({contrast})} />
            <RangeField label="饱和度" value={image.saturation} min={0} max={220} onChange={(saturation) => update({saturation})} />
            <RangeField label="色调" value={image.hue} min={-180} max={180} onChange={(hue) => update({hue})} />
          </div>
          <div className="image-edit-actions">
            <button className="button ghost command-button" type="button" onClick={() => onResetImage(image.id)}><RotateCcw size={15} />重置参数</button>
            <button className="button ghost danger command-button" type="button" onClick={() => onDeleteImage(image.id)}><Trash2 size={15} />删除图片</button>
          </div>
        </div>
      )}
    </section>
  );
}
