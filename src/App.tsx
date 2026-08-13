import 'animate.css';
import {Copy, Plus, SlidersHorizontal, Trash2} from 'lucide-react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {AssetPanel} from './components/AssetPanel';
import {ExportDialog} from './components/ExportDialog';
import {HeaderBar} from './components/HeaderBar';
import {InspectorPanel} from './components/InspectorPanel';
import {MobileNav, type MobilePane} from './components/MobileNav';
import {StageEditor, type StageEditorHandle} from './components/StageEditor';
import {Timeline} from './components/Timeline';
import {useStudio} from './hooks/useStudio';
import {aspectLabel} from './lib/aspect';
import {deleteCoverTemplate, instantiateCoverTemplate, listCoverTemplates, saveCoverTemplate} from './lib/coverTemplates';
import {createAssets, createImageLayer, createPlayerOutroSlide, createShareSavePresetSlide, createSlide, createTextLayer, createVideoLayer, createWebsiteCoverSlide, duplicateSlide} from './lib/model';
import {deliverExportedAudio, deliverExportedImage, deliverExportedVideo} from './lib/exportDelivery';
import {hasBundledTtsConfig, hasStoredTtsKey, isNativeApp, saveTtsApiKey, synthesizeTts} from './lib/ttsClient';
import {exportSlideImage, exportStudioVideo} from './lib/videoExporter';
import {readVideoMetadata} from './lib/videoMetadata';
import type {AnimationDirection, Asset, CoverTemplateSummary, ExportProgress, ImageLayer, InspectorTab, PlayerOutroConfig, VideoLayer, WebsiteCoverConfig} from './types';

export default function App() {
  const {state, dispatch, currentSlide, selectedImage, selectedVideo, selectedText, totalDuration} = useStudio();
  const stageRef = useRef<StageEditorHandle>(null);
  const exportController = useRef<AbortController | null>(null);
  const generatedAudioUrl = useRef('');
  const [status, setStatus] = useState('准备编辑');
  const [previewing, setPreviewing] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>('editor');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('image');
  const [generatingTts, setGeneratingTts] = useState(false);
  const [ttsKeyConfigured, setTtsKeyConfigured] = useState(hasBundledTtsConfig() || !isNativeApp());
  const [exporting, setExporting] = useState(false);
  const [coverTemplates, setCoverTemplates] = useState<CoverTemplateSummary[]>([]);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({progress: 0, message: '准备画面与音频轨道'});

  const stopPreview = useCallback(() => {
    setPreviewing(false);
    stageRef.current?.reset();
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    void hasStoredTtsKey().then(setTtsKeyConfigured).catch(() => setTtsKeyConfigured(false));
  }, []);

  useEffect(() => () => {
    if (generatedAudioUrl.current) URL.revokeObjectURL(generatedAudioUrl.current);
  }, []);

  const refreshCoverTemplates = useCallback(async () => {
    const templates = await listCoverTemplates();
    setCoverTemplates((current) => {
      current.forEach((template) => URL.revokeObjectURL(template.previewUrl));
      return templates;
    });
  }, []);

  useEffect(() => {
    void listCoverTemplates()
      .then((templates) => setCoverTemplates(templates))
      .catch(() => setStatus('本地封面模板读取失败'));
  }, []);

  useEffect(() => {
    if (!previewing) return;
    const stage = stageRef.current;
    const frame = window.requestAnimationFrame(() => stage?.playSlide(currentSlide, true));
    const timer = window.setTimeout(() => {
      const index = state.slides.findIndex((slide) => slide.id === currentSlide.id);
      const nextSlide = state.slides[(index + 1) % state.slides.length];
      dispatch({type: 'select-slide', slideId: nextSlide.id});
    }, currentSlide.duration * 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      stage?.reset();
    };
  }, [currentSlide, dispatch, previewing, state.slides]);

  const addVideos = async (assets: Asset[]) => {
    const videos = await Promise.all(assets.map(async (asset, index) => {
      const metadata = await readVideoMetadata(asset.url);
      return createVideoLayer(asset, metadata.duration, currentSlide.videos.length + index);
    }));
    if (!videos.length) return;
    dispatch({type: 'add-videos', videos});
    setInspectorTab('video');
    const longest = Math.max(...videos.map((video) => video.sourceDuration / video.playbackRate));
    const blankSlide = !currentSlide.videos.length && !currentSlide.images.length && !currentSlide.texts.length;
    if (longest > 0) {
      dispatch({
        type: 'update-slide',
        patch: {duration: Number((blankSlide ? longest : Math.max(currentSlide.duration, longest)).toFixed(1))}
      });
    }
  };

  const addFiles = async (files: FileList, applyToStage = false) => {
    const assets = createAssets(files);
    if (!assets.length) return;
    dispatch({type: 'add-assets', assets});
    if (applyToStage) {
      const images = assets
        .filter((asset) => asset.type.startsWith('image/'))
        .map((asset, index) => createImageLayer(asset, currentSlide.images.length + index));
      if (images.length) dispatch({type: 'add-images', images});
      const videos = assets.filter((asset) => asset.type.startsWith('video/'));
      if (videos.length) await addVideos(videos);
      const audio = [...assets].reverse().find((asset) => asset.type.startsWith('audio/'));
      if (audio) dispatch({type: 'set-narration', narration: {audioUrl: audio.url, duration: 0}});
    }
    setStatus(`已导入 ${assets.length} 个本地素材`);
  };

  const applyAsset = async (asset: Asset) => {
    if (asset.type.startsWith('image/')) {
      if (currentSlide.kind === 'player-outro' && currentSlide.player) {
        dispatch({
          type: 'update-slide',
          patch: {player: {...currentSlide.player, posterSrc: asset.url, posterName: asset.name}}
        });
        setMobilePane('editor');
        setStatus(`已替换片尾剧集画面：${asset.name}`);
        return;
      }
      if (currentSlide.kind === 'website-cover' && currentSlide.websiteCover) {
        dispatch({type: 'update-slide', patch: {websiteCover: {...currentSlide.websiteCover, screenshotSrc: asset.url, screenshotName: asset.name, screenshotScale: 1, screenshotX: 0, screenshotY: 0}}});
        setMobilePane('editor');
        setStatus(`已替换网站封面截图：${asset.name}`);
        return;
      }
      dispatch({type: 'add-images', images: [createImageLayer(asset, currentSlide.images.length)]});
      setInspectorTab('image');
      setMobilePane('editor');
      setStatus(`已把 ${asset.name} 添加到当前屏幕`);
      return;
    }
    if (asset.type.startsWith('video/')) {
      try {
        await addVideos([asset]);
        setMobilePane('editor');
        setStatus(`已把视频 ${asset.name} 添加到当前屏幕，原声已保留`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : '视频读取失败');
      }
      return;
    }
    if (asset.type.startsWith('audio/')) {
      dispatch({type: 'set-narration', narration: {audioUrl: asset.url, duration: 0}});
      setMobilePane('inspector');
      setStatus(`已设置口播音频：${asset.name}`);
    }
  };

  const applyPlayerPreset = () => {
    stopPreview();
    const existing = state.slides.find((slide) => slide.kind === 'player-outro');
    dispatch({type: 'upsert-player-outro', slide: createPlayerOutroSlide()});
    setMobilePane('inspector');
    setStatus(existing ? '已定位到播放器片尾' : '已添加播放器片尾，并固定在时间线最后');
  };

  const applyShareSavePreset = () => {
    stopPreview();
    const slide = createShareSavePresetSlide();
    dispatch({type: 'add-slide', slide});
    setMobilePane('editor');
    setStatus('已添加分享保存提示图，可继续调整图片参数与动画');
  };

  const applyWebsiteCoverPreset = () => {
    stopPreview();
    dispatch({type: 'set-aspect', aspect: 'cover-portrait'});
    dispatch({type: 'add-slide', slide: createWebsiteCoverSlide()});
    setMobilePane('inspector');
    setStatus('已添加网站系列封面，只需修改期数、副标题和页面截图');
  };

  const updatePlayer = (patch: Partial<PlayerOutroConfig>) => {
    if (!currentSlide.player) return;
    dispatch({type: 'update-slide', patch: {player: {...currentSlide.player, ...patch}}});
  };

  const uploadPlayerPoster = (files: FileList) => {
    const assets = createAssets(files).filter((asset) => asset.type.startsWith('image/'));
    const poster = assets[0];
    if (!poster) return;
    dispatch({type: 'add-assets', assets});
    updatePlayer({posterSrc: poster.url, posterName: poster.name});
    setStatus(`已替换片尾剧集画面：${poster.name}`);
  };

  const updateWebsiteCover = (patch: Partial<WebsiteCoverConfig>) => {
    if (!currentSlide.websiteCover) return;
    dispatch({type: 'update-slide', patch: {websiteCover: {...currentSlide.websiteCover, ...patch}}});
  };

  const uploadWebsiteScreenshot = (files: FileList) => {
    const assets = createAssets(files).filter((asset) => asset.type.startsWith('image/'));
    const screenshot = assets[0];
    if (!screenshot || !currentSlide.websiteCover) return;
    dispatch({type: 'add-assets', assets});
    updateWebsiteCover({screenshotSrc: screenshot.url, screenshotName: screenshot.name, screenshotScale: 1, screenshotX: 0, screenshotY: 0});
    setStatus(`已替换网站封面截图：${screenshot.name}`);
  };

  const selectSlide = (slideId: string) => {
    stopPreview();
    const slide = state.slides.find((item) => item.id === slideId);
    if (slide?.videos.length && !slide.images.length) setInspectorTab('video');
    else if (slide?.images.length) setInspectorTab('image');
    dispatch({type: 'select-slide', slideId});
  };

  const generateTts = async (voiceType: string, speedRatio: number) => {
    const text = state.narration.text.trim();
    if (!text) {
      setStatus('请先输入口播文案');
      return;
    }
    setGeneratingTts(true);
    setStatus('正在调用豆包 TTS 生成配音');
    try {
      const audioUrl = URL.createObjectURL(await synthesizeTts({text, voiceType, speedRatio}));
      if (generatedAudioUrl.current) URL.revokeObjectURL(generatedAudioUrl.current);
      generatedAudioUrl.current = audioUrl;
      dispatch({type: 'set-narration', narration: {audioUrl, duration: 0}});
      setStatus('配音已生成');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'TTS 生成失败');
    } finally {
      setGeneratingTts(false);
    }
  };

  const saveNativeTtsKey = async (apiKey: string) => {
    try {
      await saveTtsApiKey(apiKey);
      setTtsKeyConfigured(true);
      setStatus('豆包 API Key 已保存到本机');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'API Key 保存失败');
    }
  };

  const syncAudio = () => {
    if (!state.narration.duration) {
      setStatus('还没有可同步的口播音频');
      return;
    }
    dispatch({type: 'sync-slides-to-audio', duration: state.narration.duration});
    setStatus(`已按 ${state.narration.duration.toFixed(1)}s 配音同步轮播`);
  };

  const exportAudio = async () => {
    if (!state.narration.audioUrl) {
      setStatus('请先生成豆包配音');
      return;
    }
    try {
      const response = await fetch(state.narration.audioUrl);
      if (!response.ok) throw new Error(`音频读取失败：${response.status}`);
      const blob = await response.blob();
      await deliverExportedAudio(new Blob([blob], {type: 'audio/mpeg'}));
      setStatus('豆包口播已导出为 MP3');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'MP3 导出失败');
    }
  };

  const exportVideo = async () => {
    stopPreview();
    const controller = new AbortController();
    exportController.current = controller;
    setExporting(true);
    setExportProgress({progress: 0, message: '准备画面与音频轨道'});
    try {
      const result = await exportStudioVideo(state, controller.signal, setExportProgress);
      await deliverExportedVideo(result.blob, result.extension);
      setStatus(`视频已导出为 ${result.extension.toUpperCase()}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') setStatus('已取消导出');
      else setStatus(error instanceof Error ? error.message : '视频导出失败');
    } finally {
      setExporting(false);
      exportController.current = null;
    }
  };

  const exportImage = async () => {
    stopPreview();
    setStatus('正在生成高清封面 PNG');
    try {
      const {blob, width, height} = await exportSlideImage(state, currentSlide);
      await deliverExportedImage(blob, aspectLabel(state.aspect));
      setStatus(`封面已导出：${width} × ${height} PNG`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '封面图片导出失败');
    }
  };

  const saveCurrentCoverTemplate = async (name: string) => {
    stopPreview();
    setStatus('正在保存可编辑封面模板');
    try {
      const {blob} = await exportSlideImage(state, currentSlide);
      await saveCoverTemplate(name, state.aspect, currentSlide, blob);
      await refreshCoverTemplates();
      setStatus(`封面模板“${name}”已保存到本机`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '封面模板保存失败');
    }
  };

  const applyCoverTemplate = async (id: string) => {
    stopPreview();
    try {
      const template = await instantiateCoverTemplate(id);
      dispatch({type: 'set-aspect', aspect: template.aspect});
      dispatch({type: 'add-slide', slide: template.slide});
      setInspectorTab(template.slide.images.length ? 'image' : template.slide.videos.length ? 'video' : 'text');
      setMobilePane('editor');
      setStatus(`已添加可编辑封面模板：${template.slide.title}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '封面模板套用失败');
    }
  };

  const removeCoverTemplate = async (id: string) => {
    try {
      await deleteCoverTemplate(id);
      await refreshCoverTemplates();
      setStatus('封面模板已删除');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '封面模板删除失败');
    }
  };

  const previewImageAnimation = (image: ImageLayer, direction: AnimationDirection) => {
    stageRef.current?.playImage(image, direction);
  };

  const previewVideoAnimation = (video: VideoLayer, direction: AnimationDirection) => {
    stageRef.current?.playVideo(video, direction);
  };

  return (
    <div id="app">
      <HeaderBar
        aspect={state.aspect}
        previewing={previewing}
        onAspectChange={(aspect) => dispatch({type: 'set-aspect', aspect})}
        onTogglePreview={() => {
          if (previewing) {
            stopPreview();
            setStatus('已停止预览');
          } else {
            setPreviewing(true);
            setStatus('正在自动轮播预览');
          }
        }}
        onExport={exportVideo}
        onExportImage={exportImage}
      />
      <main className="workspace">
        <div className={`workspace-pane pane-assets ${mobilePane === 'assets' ? 'mobile-active' : ''}`}>
          <AssetPanel
            assets={state.assets}
            coverTemplates={coverTemplates}
            onFiles={(files) => addFiles(files)}
            onApplyAsset={applyAsset}
            onApplyShareSavePreset={applyShareSavePreset}
            onApplyPlayerPreset={applyPlayerPreset}
            onApplyWebsiteCoverPreset={applyWebsiteCoverPreset}
            onSaveCoverTemplate={saveCurrentCoverTemplate}
            onApplyCoverTemplate={applyCoverTemplate}
            onDeleteCoverTemplate={removeCoverTemplate}
          />
        </div>
        <div className={`workspace-pane pane-editor ${mobilePane === 'editor' ? 'mobile-active' : ''}`}>
          <section className="stage-column">
          <div className="stage-toolbar">
            <div className="slide-controls">
              <button className="button small command-button" type="button" onClick={() => { stopPreview(); dispatch({type: 'add-slide', slide: createSlide(state.slides.filter((slide) => slide.kind !== 'player-outro').length)}); setStatus('已新增空白屏幕，图片和参数独立配置'); }}><Plus size={15} />新增空白屏幕</button>
              <button className="icon-button" type="button" title="复制当前屏幕" disabled={currentSlide.kind === 'player-outro'} onClick={() => { stopPreview(); dispatch({type: 'duplicate-slide', slide: duplicateSlide(currentSlide)}); setStatus('已复制当前屏幕，参数可独立修改'); }}><Copy size={16} /></button>
              <button className="icon-button danger" type="button" title="删除当前屏幕" disabled={state.slides.length === 1} onClick={() => { stopPreview(); dispatch({type: 'delete-slide'}); }}><Trash2 size={16} /></button>
            </div>
            <div className="status-line">{status}</div>
            {(selectedImage || selectedVideo || currentSlide.kind === 'player-outro' || currentSlide.kind === 'website-cover') && (
              <button className="button small ghost command-button mobile-inspector-trigger" type="button" onClick={() => setMobilePane('inspector')}>
                <SlidersHorizontal size={15} />{currentSlide.kind === 'player-outro' || currentSlide.kind === 'website-cover' ? '设置' : '调整'}
              </button>
            )}
          </div>
          <StageEditor
            ref={stageRef}
            aspect={state.aspect}
            slide={currentSlide}
            selectedImageId={state.selectedImageId}
            selectedVideoId={state.selectedVideoId}
            selectedTextId={state.selectedTextId}
            previewing={previewing}
            onSelectImage={(imageId) => { dispatch({type: 'select-image', imageId}); setInspectorTab('image'); }}
            onUpdateImage={(imageId, patch) => dispatch({type: 'update-image', imageId, patch})}
            onSelectVideo={(videoId) => { dispatch({type: 'select-video', videoId}); setInspectorTab('video'); }}
            onUpdateVideo={(videoId, patch) => dispatch({type: 'update-video', videoId, patch})}
            onSelectText={(textId) => { dispatch({type: 'select-text', textId}); setInspectorTab('text'); }}
            onUpdateText={(textId, patch) => dispatch({type: 'update-text', textId, patch})}
            onClearSelection={() => dispatch({type: 'select-image', imageId: ''})}
            onFilesDropped={(files) => addFiles(files, true)}
            onAssetDropped={(assetId) => {
              const asset = state.assets.find((item) => item.id === assetId);
              if (asset) applyAsset(asset);
            }}
            onPlayerPosterFiles={uploadPlayerPoster}
            onPlayerPosterAsset={(assetId) => {
              const asset = state.assets.find((item) => item.id === assetId && item.type.startsWith('image/'));
              if (asset) {
                updatePlayer({posterSrc: asset.url, posterName: asset.name});
                setStatus(`已替换片尾剧集画面：${asset.name}`);
              }
            }}
            onWebsiteScreenshotFiles={uploadWebsiteScreenshot}
            onWebsiteScreenshotAsset={(assetId) => {
              const asset = state.assets.find((item) => item.id === assetId && item.type.startsWith('image/'));
              if (asset) {
                updateWebsiteCover({screenshotSrc: asset.url, screenshotName: asset.name, screenshotScale: 1, screenshotX: 0, screenshotY: 0});
                setStatus(`已替换网站封面截图：${asset.name}`);
              }
            }}
            onUpdateWebsiteCover={updateWebsiteCover}
          />
          <Timeline slides={state.slides} currentSlideId={state.currentSlideId} totalDuration={totalDuration} onSelect={selectSlide} />
          </section>
        </div>
        <div className={`workspace-pane pane-inspector ${mobilePane === 'inspector' ? 'mobile-active' : ''}`}>
          <InspectorPanel
            tab={inspectorTab}
            slide={currentSlide}
            assets={state.assets}
            image={selectedImage}
            video={selectedVideo}
            text={selectedText}
            selectedImageId={state.selectedImageId}
            selectedVideoId={state.selectedVideoId}
            narration={state.narration}
            generatingTts={generatingTts}
            nativeRuntime={isNativeApp()}
            ttsKeyConfigured={ttsKeyConfigured}
            onUpdateSlide={(patch) => dispatch({type: 'update-slide', patch})}
            onUpdatePlayer={updatePlayer}
            onUploadPlayerPoster={uploadPlayerPoster}
            onUploadWebsiteScreenshot={uploadWebsiteScreenshot}
            onSelectImage={(imageId) => { dispatch({type: 'select-image', imageId}); setInspectorTab('image'); }}
            onUpdateImage={(imageId, patch) => dispatch({type: 'update-image', imageId, patch})}
            onMoveImage={(imageId, target) => dispatch({type: 'move-image', imageId, target})}
            onMoveImageEntrance={(imageId, direction) => dispatch({type: 'move-image-entrance', imageId, direction})}
            onResetImage={(imageId) => dispatch({type: 'reset-image', imageId})}
            onDeleteImage={(imageId) => dispatch({type: 'delete-image', imageId})}
            onPreviewAnimation={previewImageAnimation}
            onSelectVideo={(videoId) => { dispatch({type: 'select-video', videoId}); setInspectorTab('video'); }}
            onUpdateVideo={(videoId, patch) => dispatch({type: 'update-video', videoId, patch})}
            onMoveVideo={(videoId, target) => dispatch({type: 'move-video', videoId, target})}
            onResetVideo={(videoId) => dispatch({type: 'reset-video', videoId})}
            onDeleteVideo={(videoId) => dispatch({type: 'delete-video', videoId})}
            onPreviewVideoAnimation={previewVideoAnimation}
            onAddText={() => { dispatch({type: 'add-text', text: createTextLayer(state.aspect)}); setInspectorTab('text'); }}
            onUpdateText={(textId, patch) => dispatch({type: 'update-text', textId, patch})}
            onDeleteText={(textId) => dispatch({type: 'delete-text', textId})}
            onNarrationText={(text) => dispatch({type: 'set-narration', narration: {text, audioUrl: '', duration: 0}})}
            onNarrationSettings={(patch) => dispatch({type: 'set-narration', narration: {...patch, audioUrl: '', duration: 0}})}
            onGenerateTts={generateTts}
            onSaveTtsKey={saveNativeTtsKey}
            onNarrationMetadata={(duration) => { dispatch({type: 'set-narration', narration: {duration}}); setStatus(`配音时长：${duration.toFixed(1)}s`); }}
            onSyncAudio={syncAudio}
            onExportAudio={exportAudio}
            onTabChange={setInspectorTab}
          />
        </div>
      </main>
      {status !== '准备编辑' && <div className="mobile-status" key={status} role="status">{status}</div>}
      <MobileNav activePane={mobilePane} onChange={setMobilePane} />
      <ExportDialog open={exporting} progress={exportProgress} onCancel={() => exportController.current?.abort()} />
    </div>
  );
}
