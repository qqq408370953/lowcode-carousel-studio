import {Captions, Maximize2, Play, Volume2} from 'lucide-react';
import type {PlayerOutroConfig} from '../types';

interface PlayerOutroProps {
  config: PlayerOutroConfig;
  previewing?: boolean;
}

export function PlayerOutro({config, previewing = false}: PlayerOutroProps) {
  return (
    <div className={`player-outro ${previewing ? 'is-playing' : ''}`}>
      <div className="player-outro-copy">
        <span>正在热播</span>
        <strong>{config.showTitle || '未命名剧集'}</strong>
        <p>{config.prompt || '精彩继续，点击追剧'}</p>
      </div>
      <div className="player-device">
        <i className="phone-key phone-key-volume-up" />
        <i className="phone-key phone-key-volume-down" />
        <i className="phone-key phone-key-power" />
        <div className="phone-frame">
          <div className="player-screen">
            {config.posterSrc
              ? <img src={config.posterSrc} alt={config.posterName || config.showTitle} />
              : <div className="player-poster-empty"><Play size={28} fill="currentColor" /><span>替换剧集画面</span></div>}
            <div className="phone-sensor"><i /><b /></div>
            <div className="phone-glass-reflection" />
            <div className="player-screen-shade" />
            <div className="player-screen-title">{config.showTitle || '未命名剧集'} · {config.episode || '第 1 集'}</div>
            <div className="player-controls">
              <div className="player-progress"><i style={{width: `${config.progress}%`}} /></div>
              <div className="player-controls-row">
                <span className="player-control-icons"><Play size={13} fill="currentColor" /><Volume2 size={14} /></span>
                <span className="player-control-meta">{config.quality || '1080P'} <Captions size={13} /> <Maximize2 size={13} /></span>
              </div>
            </div>
          </div>
          <div className="phone-gesture-bar" />
        </div>
      </div>
    </div>
  );
}
