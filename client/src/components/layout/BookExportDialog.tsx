// 导出作品弹窗
import { useState } from 'react';
import { X, Download } from 'lucide-react';
import { apiClient } from '../../services/api.service';

interface Props { open: boolean; book: any; onClose: () => void; }

export default function BookExportDialog({ open, book, onClose }: Props) {
  const [format, setFormat] = useState<'txt' | 'word'>('txt');
  const [exporting, setExporting] = useState(false);

  if (!open || !book) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await apiClient.post(`/export/${format}/${book.id}`, {}, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${book.title}.${format === 'word' ? 'doc' : 'txt'}`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) { console.error('导出失败:', err); }
    setExporting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-bg-primary rounded-lg shadow-xl w-[360px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <h2 className="font-semibold text-sm">导出作品 — {book.title}</h2>
          <button onClick={onClose}><X size={18} className="text-text-tertiary hover:text-text-primary" /></button>
        </div>
        <div className="p-4 space-y-3">
          <select className="w-full p-2 text-sm border rounded" value={format} onChange={e => setFormat(e.target.value as any)}>
            <option value="txt">TXT 纯文本</option>
            <option value="word">Word 文档</option>
          </select>
          <div className="bg-bg-secondary rounded p-2 text-xs text-text-tertiary">
            总字数：{book.wordCount?.toLocaleString()} 字
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-primary">
          <button onClick={onClose} className="px-4 py-1.5 text-sm border rounded hover:bg-bg-hover">取消</button>
          <button onClick={handleExport} disabled={exporting}
            className="px-4 py-1.5 text-sm bg-brand-primary text-brand-text rounded hover:bg-brand-hover flex items-center gap-1.5 disabled:opacity-50">
            <Download size={14} /> {exporting ? '导出中...' : '导出'}
          </button>
        </div>
      </div>
    </div>
  );
}
