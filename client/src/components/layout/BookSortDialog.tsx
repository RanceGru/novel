// 书架排序弹窗
import { useState } from 'react';
import { X, GripVertical } from 'lucide-react';

interface Props { open: boolean; books: any[]; onClose: () => void; onSorted: (sorted: any[]) => void; }

export default function BookSortDialog({ open, books, onClose, onSorted }: Props) {
  const [items, setItems] = useState([...books]);

  if (!open) return null;

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const arr = [...items];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    setItems(arr);
  };

  const moveDown = (idx: number) => {
    if (idx === items.length - 1) return;
    const arr = [...items];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    setItems(arr);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-bg-primary rounded-lg shadow-xl w-[360px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <h2 className="font-semibold text-sm">书架排序</h2>
          <button onClick={onClose}><X size={18} className="text-text-tertiary hover:text-text-primary" /></button>
        </div>
        <div className="p-2 max-h-80 overflow-y-auto">
          {items.map((b, idx) => (
            <div key={b.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-bg-hover rounded text-sm">
              <GripVertical size={14} className="text-text-tertiary" />
              <span className="flex-1 truncate">{b.title}</span>
              <button onClick={() => moveUp(idx)} className="px-1.5 text-xs border rounded hover:bg-bg-active" title="上移">↑</button>
              <button onClick={() => moveDown(idx)} className="px-1.5 text-xs border rounded hover:bg-bg-active" title="下移">↓</button>
            </div>
          ))}
        </div>
        <div className="text-xs text-text-tertiary px-4 py-1.5">拖拽排序将在后续版本支持</div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-primary">
          <button onClick={onClose} className="px-4 py-1.5 text-sm border rounded hover:bg-bg-hover">取消</button>
          <button onClick={() => { onSorted(items); onClose(); }} className="px-4 py-1.5 text-sm bg-brand-primary text-brand-text rounded hover:bg-brand-hover">保存排序</button>
        </div>
      </div>
    </div>
  );
}
