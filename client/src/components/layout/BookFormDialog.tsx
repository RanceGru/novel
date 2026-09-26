// 新建/编辑作品弹窗
import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '../../services/api.service';
import { useAuthStore } from '../../stores/auth.store';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (book: any) => void;
  bookCount: number;
  existingTitles: string[];
  /** 编辑模式：传入已有作品 */
  editBook?: any;
}

export default function BookFormDialog({ open, onClose, onCreated, bookCount, existingTitles, editBook }: Props) {
  const user = useAuthStore((s) => s.user);
  const isEdit = !!editBook;
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState(user?.displayName || '');
  const [tags, setTags] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 打开弹窗时初始化表单
  useEffect(() => {
    if (open) {
      if (editBook) {
        setTitle(editBook.title || '');
        setAuthor(editBook.author || '');
        setTags(editBook.subtitle || '');
        setCoverUrl(editBook.coverUrl || null);
      } else {
        setTitle('');
        setAuthor(user?.displayName || '');
        setTags('');
        setCoverUrl(null);
      }
      setError('');
    }
  }, [open, editBook]);

  if (!open) return null;

  const handleCoverClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 使用 Canvas 缩放至 3:4 比例 (最大 450x600)
    const img = new Image();
    img.onload = () => {
      const maxW = 450, maxH = 600;
      let w = img.width, h = img.height;
      // 缩放至 3:4 框内
      if (w / h > maxW / maxH) { w = maxW; h = Math.round(w * (img.height / img.width)); }
      else { h = maxH; w = Math.round(h * (img.width / img.height)); }
      // 居中裁剪为 3:4
      const canvas = document.createElement('canvas');
      canvas.width = maxW; canvas.height = maxH;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, maxW, maxH);
      const sx = Math.max(0, (img.width - (maxW / maxH) * img.height) / 2);
      const sy = Math.max(0, (img.height - (maxH / maxW) * img.width) / 2);
      const sw = img.width - 2 * sx, sh = img.height - 2 * sy;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, maxW, maxH);
      setCoverUrl(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = URL.createObjectURL(file);
  };

  const handleSubmit = async () => {
    const bookTitle = title.trim() || (isEdit ? editBook.title : `作品${bookCount + 1}`);
    setError('');

    if (existingTitles.some(t => t === bookTitle)) {
      setError(`作品名「${bookTitle}」已存在，请使用其他名称`);
      return;
    }

    const bookAuthor = author.trim() || user?.displayName || '佚名';
    const bookTags = tags.trim() || (isEdit ? (editBook.subtitle || '未知') : '未知');

    try {
      if (isEdit) {
        const res = await apiClient.patch(`/books/${editBook.id}`, {
          title: bookTitle,
          author: bookAuthor,
          subtitle: bookTags,
          coverUrl: coverUrl || editBook.coverUrl || null,
        });
        onCreated(res.data.data);
      } else {
        const res = await apiClient.post('/books', {
          title: bookTitle,
          author: bookAuthor,
          subtitle: bookTags,
          coverUrl: coverUrl || null,
        });
        onCreated(res.data.data);
      }
      onClose();
    } catch (err) {
      console.error(isEdit ? '修改失败:' : '创建失败:', err);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={handleClose}>
      <div className="bg-bg-primary rounded-lg shadow-xl w-[560px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <h2 className="font-semibold text-sm">{isEdit ? '修改信息' : '新建作品'}</h2>
          <button onClick={handleClose} className="text-text-tertiary hover:text-text-primary"><X size={18} /></button>
        </div>

        <div className="flex p-4 gap-4">
          <div className="w-1/3">
            <div onClick={handleCoverClick}
              className="aspect-[3/4] bg-bg-secondary border-2 border-dashed border-border-primary rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-brand-primary hover:bg-bg-hover transition-colors overflow-hidden relative group">
              <img src={coverUrl || '/default_cover.png'} alt="封面" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                <span className="text-white text-xs opacity-0 group-hover:opacity-100">点击更换封面</span>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          <div className="flex-1 flex flex-col gap-3">
            {error && (
              <div className="text-xs text-error bg-error/10 border border-error/20 rounded px-2 py-1.5">{error}</div>
            )}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">书名</label>
              <input
                className={`w-full p-2 text-sm border rounded bg-bg-primary focus:outline-none focus:border-brand-primary ${error ? 'border-error' : 'border-border-primary'}`}
                placeholder={isEdit ? editBook.title : `作品${bookCount + 1}`}
                value={title}
                onChange={e => { setTitle(e.target.value); setError(''); }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">作者</label>
              <input
                className="w-full p-2 text-sm border border-border-primary rounded bg-bg-primary focus:outline-none focus:border-brand-primary"
                placeholder={user?.displayName || '佚名'}
                value={author}
                onChange={e => setAuthor(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">标签</label>
              <input
                className="w-full p-2 text-sm border border-border-primary rounded bg-bg-primary focus:outline-none focus:border-brand-primary"
                placeholder="未知"
                value={tags}
                onChange={e => setTags(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-primary">
          <button onClick={handleClose}
            className="px-4 py-1.5 text-sm text-text-secondary border border-border-primary rounded hover:bg-bg-hover transition-colors">
            取消
          </button>
          <button onClick={handleSubmit}
            className="px-4 py-1.5 text-sm bg-brand-primary text-brand-text rounded hover:bg-brand-hover transition-colors">
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
