import {X} from 'lucide-react';
import type {ExportProgress} from '../types';

interface ExportDialogProps {
  open: boolean;
  progress: ExportProgress;
  onCancel: () => void;
}

export function ExportDialog({open, progress, onCancel}: ExportDialogProps) {
  if (!open) return null;
  return (
    <div className="export-overlay" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <div className="export-card">
        <div className="dialog-heading">
          <h2 id="export-title">正在导出视频</h2>
          <button className="icon-button" type="button" title="取消导出" onClick={onCancel}><X size={17} /></button>
        </div>
        <progress max="100" value={progress.progress} />
        <p>{progress.message}</p>
      </div>
    </div>
  );
}
