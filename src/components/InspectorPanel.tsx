import type {AnimationDirection, Asset, ImageLayer, InspectorTab, Narration, PlayerOutroConfig, Slide, TextLayer, VideoLayer} from '../types';
import {AudioInspector} from './AudioInspector';
import {ImageInspector} from './ImageInspector';
import {TextInspector} from './TextInspector';
import {PlayerOutroInspector} from './PlayerOutroInspector';
import {VideoInspector} from './VideoInspector';
import {WebsiteCoverInspector} from './WebsiteCoverInspector';

interface InspectorPanelProps {
  tab: InspectorTab;
  slide: Slide;
  assets: Asset[];
  image?: ImageLayer;
  video?: VideoLayer;
  text?: TextLayer;
  selectedImageId: string;
  selectedVideoId: string;
  narration: Narration;
  generatingTts: boolean;
  nativeRuntime: boolean;
  ttsKeyConfigured: boolean;
  onUpdateSlide: (patch: Partial<Slide>) => void;
  onUpdatePlayer: (patch: Partial<PlayerOutroConfig>) => void;
  onUploadPlayerPoster: (files: FileList) => void;
  onUploadWebsiteScreenshot: (files: FileList) => void;
  onSelectImage: (imageId: string) => void;
  onUpdateImage: (imageId: string, patch: Partial<ImageLayer>) => void;
  onMoveImage: (imageId: string, target: 'top' | 'up' | 'down' | 'bottom') => void;
  onMoveImageEntrance: (imageId: string, direction: 'earlier' | 'later') => void;
  onResetImage: (imageId: string) => void;
  onDeleteImage: (imageId: string) => void;
  onPreviewAnimation: (image: ImageLayer, direction: AnimationDirection) => void;
  onSelectVideo: (videoId: string) => void;
  onUpdateVideo: (videoId: string, patch: Partial<VideoLayer>) => void;
  onMoveVideo: (videoId: string, target: 'top' | 'up' | 'down' | 'bottom') => void;
  onResetVideo: (videoId: string) => void;
  onDeleteVideo: (videoId: string) => void;
  onPreviewVideoAnimation: (video: VideoLayer, direction: AnimationDirection) => void;
  onAddText: () => void;
  onUpdateText: (textId: string, patch: Partial<TextLayer>) => void;
  onDeleteText: (textId: string) => void;
  onNarrationText: (text: string) => void;
  onNarrationSettings: (patch: Pick<Narration, 'voiceType'> | Pick<Narration, 'speedRatio'>) => void;
  onGenerateTts: (voiceType: string, speed: number) => void;
  onSaveTtsKey: (apiKey: string) => void;
  onNarrationMetadata: (duration: number) => void;
  onSyncAudio: () => void;
  onExportAudio: () => void;
  onTabChange: (tab: InspectorTab) => void;
}

export function InspectorPanel(props: InspectorPanelProps) {
  if (props.slide.kind === 'website-cover' && props.slide.websiteCover) {
    return (
      <aside className="panel props-panel website-cover-props-panel">
        <div className="panel-heading"><h2>封面变量</h2></div>
        <WebsiteCoverInspector
          slide={props.slide}
          assets={props.assets}
          onUpdateSlide={props.onUpdateSlide}
          onUploadScreenshot={props.onUploadWebsiteScreenshot}
        />
      </aside>
    );
  }
  if (props.slide.kind === 'player-outro') {
    return (
      <aside className="panel props-panel player-props-panel">
        <div className="panel-heading"><h2>片尾设置</h2></div>
        <PlayerOutroInspector
          slide={props.slide}
          assets={props.assets}
          onUpdateSlide={props.onUpdateSlide}
          onUpdatePlayer={props.onUpdatePlayer}
          onUploadPoster={props.onUploadPlayerPoster}
        />
      </aside>
    );
  }
  return (
    <aside className="panel props-panel">
      <div className="tabs" role="tablist">
        {(['image', 'video', 'text', 'audio'] as const).map((value) => (
          <button className={`tab ${props.tab === value ? 'active' : ''}`} type="button" key={value} onClick={() => props.onTabChange(value)}>
            {{image: '图片', video: '视频', text: '文字', audio: '口播'}[value]}
          </button>
        ))}
      </div>
      {props.tab === 'image' && <ImageInspector {...props} />}
      {props.tab === 'video' && <VideoInspector {...props} />}
      {props.tab === 'text' && <TextInspector text={props.text} onAdd={props.onAddText} onUpdate={props.onUpdateText} onDelete={props.onDeleteText} />}
      {props.tab === 'audio' && (
        <AudioInspector
          narration={props.narration}
          generating={props.generatingTts}
          nativeRuntime={props.nativeRuntime}
          ttsKeyConfigured={props.ttsKeyConfigured}
          onTextChange={props.onNarrationText}
          onSettingsChange={props.onNarrationSettings}
          onGenerate={props.onGenerateTts}
          onSaveTtsKey={props.onSaveTtsKey}
          onMetadata={props.onNarrationMetadata}
          onSync={props.onSyncAudio}
          onExport={props.onExportAudio}
        />
      )}
    </aside>
  );
}
