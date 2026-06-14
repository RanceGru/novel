// 修改作品信息弹窗
import { useState } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '../../services/api.service';

interface Props { open: boolean; book: any; onClose: () => void; onSaved: () => void; existingTitles: string[]; }

export default function BookEditDialog({ open, book, onClose, onSaved, existingTitles }: Props) {
  const [title, setTitle] = useState(book?.title || '');
  const [author, setAuthor] = useState(book?.author || '');
  const [tags, setTags] = useState(book?.subtitle || '');
  const [error, setError] = useState('');

  if (!open || !book) return null;

  const handleSubmit = async () => {
    const t = title.trim() || book.title;
    if (t !== book.title && existingTitles.some(x => x === t)) {
      setError(`「${t}」已存在`); return;
    }
    await apiClient.patch(`/books/${book.id}`, { title: t, author: author.trim(), subtitle: tags.trim() });
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-bg-primary rounded-lg shadow-xl w-[400px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <h2 className="font-semibold text-sm">修改信息</h2>
          <button onClick={onClose}><X size={18} className="text-text-tertiary hover:text-text-primary" /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && <div className="text-xs text-error bg-error/10 rounded px-2 py-1.5">{error}</div>}
          <div><label className="text-xs text-text-secondary">书名</label>
            <input className="w-full p-2 text-sm border rounded" value={title} onChange={e => { setTitle(e.target.value); setError(''); }} /></div>
          <div><label className="text-xs text-text-secondary">作者</label>
            <input className="w-full p-2 text-sm border rounded" value={author} onChange={e => setAuthor(e.target.value)} /></div>
          <div><label className="text-xs text-text-secondary">标签</label>
            <input className="w-full p-2 text-sm border rounded" value={tags} onChange={e => setTags(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-primary">
          <button onClick={onClose} className="px-4 py-1.5 text-sm border rounded hover:bg-bg-hover">取消</button>
          <button onClick={handleSubmit} className="px-4 py-1.5 text-sm bg-brand-primary text-brand-text rounded hover:bg-brand-hover">保存</button>
        </div>
      </div>
    </div>
  );
}
