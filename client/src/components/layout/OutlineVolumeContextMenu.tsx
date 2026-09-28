// 卷纲右键菜单 —— 结构与「分卷右键菜单」一致
import { useEffect, useRef } from 'react';
import { FilePlus, Edit3, Trash2, BookOpen } from 'lucide-react';

interface Props {
  x: number; y: number; onClose: () => void;
  onNewChapter: () => void;
  /** 仅在卷纲尚未生成分卷时提供 */
  onGenerate?: () => void;
  onRename: () => void; onDelete: () => void;
}

export default function OutlineVolumeContextMenu({
  x, y, onClose, onNewChapter, onGenerate, onRename, onDelete,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="fixed z-50 bg-bg-primary border border-border-primary rounded shadow-lg py-1 min-w-[140px]"
      style={{ left: x, top: y }}>
      <button onClick={() => { onNewChapter(); onClose(); }}
        className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover">
        <FilePlus size={13} /> 新建章纲
      </button>
      {onGenerate && (
        <button onClick={() => { onGenerate(); onClose(); }}
          className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover">
          <BookOpen size={13} /> 生成分卷
        </button>
      )}
      <button onClick={() => { onRename(); onClose(); }}
        className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover">
        <Edit3 size={13} /> 卷纲重命名
      </button>
      <button onClick={() => { onDelete(); onClose(); }}
        className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover text-error">
        <Trash2 size={13} /> 删除卷纲
      </button>
    </div>
  );
}
