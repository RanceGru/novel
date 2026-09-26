// 世界观设定列表
import { useEffect, useState } from 'react';
import { useWorldbuildingStore } from '../../stores/worldbuilding.store';
import { useProjectStore } from '../../stores/project.store';
import { apiClient } from '../../services/api.service';
import { Plus, X, ChevronRight, ChevronDown } from 'lucide-react';

const CATEGORIES = [
  { key: 'era', label: '⏳ 时代', color: 'text-amber-400' },
  { key: 'society', label: '🏛 社会', color: 'text-purple-400' },
  { key: 'power_system', label: '⚡ 力量', color: 'text-cyan-400' },
  { key: 'resources', label: '💎 资源', color: 'text-emerald-400' },
  { key: 'culture', label: '🎭 文化', color: 'text-pink-400' },
  { key: 'geography', label: '🌍 地理', color: 'text-lime-400' },
];

export default function WorldSettingList() {
  const { settings, loadSettings } = useWorldbuildingStore();
  const { currentBook } = useProjectStore();
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => {
    if (currentBook) loadSettings(currentBook.id);
  }, [currentBook]);

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-primary">
        <span className="font-semibold text-text-tertiary">🌐 世界观</span>
        <button onClick={() => setEditing({ category: 'era' })} className="text-brand-primary hover:underline">
          <Plus size={14} />
        </button>
      </div>
      {CATEGORIES.map(cat => {
        const items = settings.filter(s => s.category === cat.key);
        return (
          <div key={cat.key}>
            <button className="w-full px-3 py-1 text-left hover:bg-bg-hover flex items-center gap-1"
              onClick={() => setExpandedCat(expandedCat === cat.key ? null : cat.key)}>
              {expandedCat === cat.key ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              <span className={cat.color}>{cat.label}</span>
              <span className="text-text-tertiary">({items.length})</span>
            </button>
            {expandedCat === cat.key && items.map(s => (
              <button key={s.id} className="w-full pl-8 pr-3 py-1 text-left hover:bg-bg-hover truncate"
                onClick={() => setEditing(s)}>
                {s.title}
              </button>
            ))}
          </div>
        );
      })}
      {/* 编辑弹窗 */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setEditing(null)}>
          <div className="bg-bg-primary rounded-lg shadow-xl p-4 w-96" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">{editing.id ? '编辑设定' : '新建设定'}</h3>
            <select className="w-full p-1.5 border rounded text-xs mb-2" value={editing.category}
              onChange={e => setEditing({...editing, category: e.target.value})}>
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input className="w-full p-1.5 border rounded text-xs mb-2" placeholder="标题"
              value={editing.title || ''} onChange={e => setEditing({...editing, title: e.target.value})} />
            <textarea className="w-full p-1.5 border rounded text-xs h-32" placeholder="内容"
              value={editing.content || ''} onChange={e => setEditing({...editing, content: e.target.value})} />
            <div className="flex gap-2 mt-2">
              <button className="flex-1 py-1.5 bg-brand-primary text-brand-text rounded text-xs"
                onClick={async () => {
                  if (editing.id) {
                    await apiClient.patch(`/world-settings/${editing.id}`, editing);
                  } else {
                    await apiClient.post(`/books/${currentBook?.id}/world-settings`, editing);
                  }
                  loadSettings(currentBook!.id); setEditing(null);
                }}>保存</button>
              {editing.id && (
                <button className="py-1.5 text-error text-xs" onClick={async () => {
                  if (confirm('确认删除？')) { await apiClient.delete(`/world-settings/${editing.id}`); loadSettings(currentBook!.id); setEditing(null); }
                }}>删除</button>
              )}
              <button className="py-1.5 text-text-tertiary text-xs" onClick={() => setEditing(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
