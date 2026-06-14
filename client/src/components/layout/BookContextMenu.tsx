// 书籍右键菜单
import { useEffect, useRef, useState } from 'react';
import { Edit3, Download, Info, Trash2 } from 'lucide-react';

interface Props {
  x: number; y: number; onClose: () => void;
  onEdit: () => void; onExport: () => void; onDetail: () => void; onDelete: () => void;
}

export default function BookContextMenu({ x, y, onClose, onEdit, onExport, onDetail, onDelete }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { icon: <Edit3 size={13} />, label: '修改信息', onClick: onEdit },
    { icon: <Download size={13} />, label: '导出作品', onClick: onExport },
    { icon: <Info size={13} />, label: '详情信息', onClick: onDetail },
    { icon: <Trash2 size={13} />, label: '删除作品', onClick: onDelete, danger: true },
  ];

  return (
    <div ref={ref} className="fixed z-50 bg-bg-primary border border-border-primary rounded shadow-lg py-1 min-w-[140px]"
      style={{ left: x, top: y }}>
      {items.map(item => (
        <button key={item.label} onClick={() => { item.onClick(); onClose(); }}
          className={`w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover transition-colors ${item.danger ? 'text-error hover:bg-error/5' : 'text-text-primary'}`}>
          {item.icon} {item.label}
        </button>
      ))}
    </div>
  );
}
