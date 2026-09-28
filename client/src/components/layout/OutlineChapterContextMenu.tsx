// 章纲右键菜单 —— 结构与「章节右键菜单」一致
//
// 系统自带条目（如「第N卷卷纲」，isSystem）不提供重命名与删除，
// 与后端对 isSystem 的保护保持一致。
import { useEffect, useRef } from 'react';
import { Edit3, Trash2, FileText } from 'lucide-react';

interface Props {
  x: number; y: number; onClose: () => void;
  /** 系统条目不可删除/重命名，仅保留生成入口 */
  isSystem?: boolean;
  /** 仅在章纲尚未生成章节时提供 */
  onGenerate?: () => void;
  onRename: () => void; onDelete: () => void;
}

export default function OutlineChapterContextMenu({
  x, y, onClose, isSystem = false, onGenerate, onRename, onDelete,
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
    <div ref={ref} className="fixed z-50 bg-bg-primary border border-border-primary rounded shadow-lg py-1 min-w-[120px]"
      style={{ left: x, top: y }}>
      {onGenerate && (
        <button onClick={() => { onGenerate(); onClose(); }}
          className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover">
          <FileText size={13} /> 生成章节
        </button>
      )}
      {!isSystem && (
        <>
          <button onClick={() => { onRename(); onClose(); }}
            className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover">
            <Edit3 size={13} /> 章纲重命名
          </button>
          <button onClick={() => { onDelete(); onClose(); }}
            className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover text-error">
            <Trash2 size={13} /> 删除章纲
          </button>
        </>
      )}
      {isSystem && (
        <div className="px-3 py-1.5 text-[10px] text-text-tertiary">系统条目，不可删除</div>
      )}
    </div>
  );
}
