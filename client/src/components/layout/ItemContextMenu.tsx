// 通用「重命名 / 删除」右键菜单
//
// 章节、卷纲、世界观条目、角色子项这几处的右键菜单长得一样，
// 只有文案不同（「章节重命名 / 删除章节」等），所以合并成一个组件，
// 避免每加一处就复制一份。
import { useEffect, useRef } from 'react';
import { Edit3, Trash2 } from 'lucide-react';

interface Props {
  x: number; y: number; onClose: () => void;
  onRename: () => void; onDelete: () => void;
  /** 菜单文案，例如 { rename: '章节重命名', remove: '删除章节' } */
  labels: { rename: string; remove: string };
}

export default function ItemContextMenu({ x, y, onClose, onRename, onDelete, labels }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} data-role="item-context-menu"
      className="fixed z-50 bg-bg-primary border border-border-primary rounded shadow-lg py-1 min-w-[120px]"
      style={{ left: x, top: y }}>
      <button data-role="menu-rename" onClick={() => { onRename(); onClose(); }}
        className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover">
        <Edit3 size={13} /> {labels.rename}
      </button>
      <button data-role="menu-delete" onClick={() => { onDelete(); onClose(); }}
        className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover text-error">
        <Trash2 size={13} /> {labels.remove}
      </button>
    </div>
  );
}
