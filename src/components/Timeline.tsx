import {Play, Video} from 'lucide-react';
import type {Slide} from '../types';
import {WebsiteCover} from './WebsiteCover';

interface TimelineProps {
  slides: Slide[];
  currentSlideId: string;
  totalDuration: number;
  onSelect: (slideId: string) => void;
}

export function Timeline({slides, currentSlideId, totalDuration, onSelect}: TimelineProps) {
  return (
    <div className="timeline">
      <div className="timeline-head">
        <h2>轮播时间线</h2>
        <div>{totalDuration.toFixed(1)}s</div>
      </div>
      <div className="slide-list">
        {slides.map((slide, index) => {
          const topImage = slide.images.at(-1);
          const topVideo = slide.videos.at(-1);
          return (
            <button
              className={`slide-card ${slide.id === currentSlideId ? 'active' : ''}`}
              key={slide.id}
              type="button"
              onClick={() => onSelect(slide.id)}
            >
              {slide.kind === 'website-cover'
                ? <div className="website-cover-slide-thumb">{slide.websiteCover && <WebsiteCover config={slide.websiteCover} />}</div>
                : slide.kind === 'player-outro' && slide.player
                ? <div className="outro-slide-thumb">
                    {slide.player.posterSrc ? <img src={slide.player.posterSrc} alt="" /> : <Play size={18} fill="currentColor" />}
                    <strong>{slide.player.showTitle}</strong>
                  </div>
                : topImage
                  ? <img src={topImage.src} alt="" />
                  : topVideo
                    ? <div className="video-slide-thumb"><Video size={22} /><span>视频</span></div>
                  : <div className="slide-empty">屏幕 {index + 1}</div>}
              <span className="slide-badge">
                {index + 1} · {slide.duration.toFixed(1)}s{slide.kind === 'website-cover' ? ' · 封面' : slide.kind === 'player-outro' ? ' · 片尾' : slide.videos.length ? ` · ${slide.videos.length}视频` : slide.images.length ? ` · ${slide.images.length}图` : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
