// 章节右键菜单
import { useEffect, useRef } from 'react';
import { Edit3, Trash2 } from 'lucide-react';

interface Props {
  x: number; y: number; onClose: () => void;
  onRename: () => void; onDelete: () => void;
}

export default function ChapterContextMenu({ x, y, onClose, onRename, onDelete }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="fixed z-50 bg-bg-primary border border-border-primary rounded shadow-lg py-1 min-w-[120px]"
      style={{ left: x, top: y }}>
      <button onClick={() => { onRename(); onClose(); }}
        className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover">
        <Edit3 size={13} /> 章节重命名
      </button>
      <button onClick={() => { onDelete(); onClose(); }}
        className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover text-error">
        <Trash2 size={13} /> 删除章节
      </button>
    </div>
  );
}
