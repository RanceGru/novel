// 纲树组件
import { useEffect, useState } from 'react';
import { useOutlineStore } from '../../stores/outline.store';
import { useProjectStore } from '../../stores/project.store';
import { ChevronRight, ChevronDown, Plus, Edit3 } from 'lucide-react';

export default function OutlineTree() {
  const { tree, loadTree, createNode, updateNode, deleteNode, selectedId, selectNode } = useOutlineStore();
  const { currentBook } = useProjectStore();
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (currentBook) loadTree(currentBook.id);
  }, [currentBook]);

  const levelLabels: Record<string, string> = {
    book_outline: '📘 大纲', volume_outline: '📖 卷纲', chapter_outline: '📄 章纲',
  };

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-primary">
        <span className="font-semibold text-text-tertiary">🌳 纲树</span>
        <button onClick={() => setShowNew(true)} className="text-brand-primary hover:underline">
          <Plus size={14} />
        </button>
      </div>

      {showNew && (
        <div className="p-2 border-b border-border-primary space-y-1">
          <input className="w-full p-1 border rounded text-xs" placeholder="标题"
            onKeyDown={async (e: any) => {
              if (e.key === 'Enter' && e.target.value) {
                await createNode(currentBook!.id, { level: 'book_outline', title: e.target.value });
                setShowNew(false);
              }
            }} autoFocus />
          <span className="text-text-tertiary">按 Enter 创建</span>
        </div>
      )}

      {tree.map((node: any) => (
        <TreeNode key={node.id} node={node} depth={0} levelLabels={levelLabels}
          selectedId={selectedId} onSelect={selectNode}
          onUpdate={(id: string, data: any) => updateNode(id, data)}
          onDelete={(id: string) => { deleteNode(id); loadTree(currentBook!.id); }}
          onCreateChild={(parentId: string, level: string) => {
            const title = prompt('节点标题：');
            if (title) createNode(currentBook!.id, { level, title, parentId });
          }}
        />
      ))}
      {tree.length === 0 && (
        <div className="px-3 py-2 text-text-tertiary">暂无纲树，点击 + 创建</div>
      )}
    </div>
  );
}

function TreeNode({ node, depth, levelLabels, selectedId, onSelect, onUpdate, onDelete, onCreateChild }: any) {
  const [expanded, setExpanded] = useState(true);
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div className={`flex items-center gap-1 py-0.5 hover:bg-bg-hover cursor-pointer ${isSelected ? 'bg-bg-active' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(isSelected ? null : node.id)}>
        <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
          {node.children?.length > 0 ? (expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />) : <span className="w-2.5" />}
        </button>
        <span className="truncate flex-1">{node.title}</span>
        <span className="text-text-tertiary text-[10px]">{node.level?.replace('_', ' ')}</span>
        <div className="hidden group-hover:flex gap-0.5" onClick={e => e.stopPropagation()}>
          <button onClick={() => onCreateChild(node.id, node.level === 'book_outline' ? 'volume_outline' : 'chapter_outline')}
            className="text-brand-primary" title="添加子节点">+</button>
          <button onClick={() => {
            const title = prompt('新标题：', node.title);
            if (title) onUpdate(node.id, { title });
          }} className="text-text-tertiary" title="重命名"><Edit3 size={9} /></button>
          <button onClick={() => { if (confirm('确认删除？')) onDelete(node.id); }}
            className="text-error" title="删除">✕</button>
        </div>
      </div>
      {expanded && node.children?.map((child: any) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} levelLabels={levelLabels}
          selectedId={selectedId} onSelect={onSelect}
          onUpdate={onUpdate} onDelete={onDelete} onCreateChild={onCreateChild} />
      ))}
    </div>
  );
}
