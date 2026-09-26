// 作品详情弹窗
import { X } from 'lucide-react';

interface Props { open: boolean; book: any; volumes: any[]; chapters: any[]; onClose: () => void; }

export default function BookDetailDialog({ open, book, volumes, chapters, onClose }: Props) {
  if (!open || !book) return null;

  const statusText: Record<string, string> = {
    draft: '草稿', writing: '连载中', completed: '已完成', paused: '暂停',
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-bg-primary rounded-lg shadow-xl w-[420px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <h2 className="font-semibold text-sm">详情信息</h2>
          <button onClick={onClose}><X size={18} className="text-text-tertiary hover:text-text-primary" /></button>
        </div>

        <div className="p-4">
          {/* 封面 + 基本信息 */}
          <div className="flex gap-4 mb-4">
            <div className="w-24 h-32 bg-bg-secondary border border-border-primary rounded-lg overflow-hidden shrink-0">
              <img src={book.coverUrl || '/default_cover.png'} alt="封面" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 space-y-1.5 text-sm">
              <div className="font-semibold text-base">{book.title}</div>
              <div className="text-text-tertiary text-xs">{book.author || '佚名'} · {book.subtitle || '未知'}</div>
              <div className="text-text-tertiary text-xs">{statusText[book.status] || book.status}</div>
            </div>
          </div>

          {/* 统计信息 */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-bg-secondary rounded p-2">
              <div className="text-lg font-semibold">{book.wordCount?.toLocaleString()}</div>
              <div className="text-xs text-text-tertiary">总字数</div>
            </div>
            <div className="bg-bg-secondary rounded p-2">
              <div className="text-lg font-semibold">{volumes.length}</div>
              <div className="text-xs text-text-tertiary">卷数</div>
            </div>
            <div className="bg-bg-secondary rounded p-2">
              <div className="text-lg font-semibold">{chapters.length}</div>
              <div className="text-xs text-text-tertiary">章节数</div>
            </div>
          </div>

          <div className="mt-3 text-xs text-text-tertiary space-y-1">
            <div className="flex justify-between"><span>创建时间</span><span>{new Date(book.createdAt).toLocaleDateString('zh-CN')}</span></div>
            <div className="flex justify-between"><span>更新时间</span><span>{new Date(book.updatedAt).toLocaleDateString('zh-CN')}</span></div>
          </div>
        </div>

        <div className="flex justify-end px-4 py-3 border-t border-border-primary">
          <button onClick={onClose} className="px-4 py-1.5 text-sm border rounded hover:bg-bg-hover">关闭</button>
        </div>
      </div>
    </div>
  );
}
