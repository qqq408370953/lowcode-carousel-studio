import {Bold, Italic, Layers, Plus, Strikethrough, Trash2} from 'lucide-react';
import type {TextAnimation, TextLayer} from '../types';
import {RangeField} from './FormControls';

interface TextInspectorProps {
  text?: TextLayer;
  onAdd: () => void;
  onUpdate: (textId: string, patch: Partial<TextLayer>) => void;
  onDelete: (textId: string) => void;
}

export function TextInspector({text, onAdd, onUpdate, onDelete}: TextInspectorProps) {
  const update = (patch: Partial<TextLayer>) => text && onUpdate(text.id, patch);
  return (
    <section className="tab-panel active">
      <button className="button full command-button" type="button" onClick={onAdd}><Plus size={16} />添加文字层</button>
      {!text && <div className="inspector-empty">选择或添加一个文字层</div>}
      {text && (
        <div className="text-controls">
          <div className="form-row">
            <label>文案<textarea rows={3} value={text.content} onChange={(event) => update({content: event.target.value})} /></label>
          </div>
          <div className="form-grid">
            <label>字号<input type="number" min="12" max="160" value={text.fontSize} onChange={(event) => update({fontSize: Number(event.target.value)})} /></label>
            <label>颜色<input type="color" value={text.color} onChange={(event) => update({color: event.target.value})} /></label>
          </div>
          <div className="form-grid">
            <label>字体
              <select value={text.fontFamily} onChange={(event) => update({fontFamily: event.target.value})}>
                <option value="system-ui">系统默认</option>
                <option value="'PingFang SC', sans-serif">苹方</option>
                <option value="'Microsoft YaHei', sans-serif">微软雅黑</option>
                <option value="serif">衬线</option>
                <option value="monospace">等宽</option>
              </select>
            </label>
            <label>动画
              <select value={text.animation} onChange={(event) => update({animation: event.target.value as TextAnimation})}>
                <option value="none">无</option>
                <option value="fade">淡入</option>
                <option value="rise">上浮</option>
                <option value="pop">弹入</option>
                <option value="wipe">打字</option>
              </select>
            </label>
          </div>
          <div className="style-row">
            <button className={`toggle-button ${text.bold ? 'active' : ''}`} type="button" title="粗体" onClick={() => update({bold: !text.bold})}><Bold size={16} /></button>
            <button className={`toggle-button ${text.italic ? 'active' : ''}`} type="button" title="斜体" onClick={() => update({italic: !text.italic})}><Italic size={16} /></button>
            <button className={`toggle-button ${text.lineThrough ? 'active' : ''}`} type="button" title="删除线" onClick={() => update({lineThrough: !text.lineThrough})}><Strikethrough size={16} /></button>
            <button className={`toggle-button ${text.shadow ? 'active' : ''}`} type="button" title="文字阴影" onClick={() => update({shadow: !text.shadow})}><Layers size={16} /></button>
            <button className="toggle-button danger" type="button" title="删除文字" onClick={() => onDelete(text.id)}><Trash2 size={16} /></button>
          </div>
          <div className="form-grid">
            <RangeField label="X" value={text.x} min={0} max={100} onChange={(x) => update({x})} />
            <RangeField label="Y" value={text.y} min={0} max={100} onChange={(y) => update({y})} />
          </div>
        </div>
      )}
    </section>
  );
}
