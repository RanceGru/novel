// 分卷右键菜单
import { useEffect, useRef } from 'react';
import { FilePlus, Edit3, Trash2, CheckSquare } from 'lucide-react';

interface Props {
  x: number; y: number; onClose: () => void;
  onNewChapter: () => void; onRename: () => void; onDelete: () => void;
  onBatchManage: () => void;
}

export default function VolumeContextMenu({ x, y, onClose, onNewChapter, onRename, onDelete, onBatchManage }: Props) {
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
        <FilePlus size={13} /> 新建章节
      </button>
      <button onClick={() => { onBatchManage(); onClose(); }}
        className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover">
        <CheckSquare size={13} /> 批量管理
      </button>
      <button onClick={() => { onRename(); onClose(); }}
        className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover">
        <Edit3 size={13} /> 重命名
      </button>
      <button onClick={() => { onDelete(); onClose(); }}
        className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover text-error">
        <Trash2 size={13} /> 删除分卷
      </button>
    </div>
  );
}
