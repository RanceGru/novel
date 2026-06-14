// 角色列表组件
import { useEffect, useState } from 'react';
import { useCharacterStore } from '../../stores/character.store';
import { useProjectStore } from '../../stores/project.store';
import { apiClient } from '../../services/api.service';
import { Plus, X, Edit3 } from 'lucide-react';

export default function CharacterList() {
  const { characters, loadCharacters, loadGraph } = useCharacterStore();
  const { currentBook } = useProjectStore();
  const [editing, setEditing] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (currentBook) loadCharacters(currentBook.id);
  }, [currentBook]);

  const categories = [
    { key: 'protagonist', label: '主角', color: 'text-yellow-400' },
    { key: 'antagonist', label: '反派', color: 'text-red-400' },
    { key: 'supporting', label: '配角', color: 'text-blue-400' },
    { key: 'ensemble', label: '群像', color: 'text-green-400' },
  ];

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-primary">
        <span className="font-semibold text-text-tertiary">👤 角色 ({characters.length})</span>
        <button onClick={() => setShowNew(true)} className="text-brand-primary hover:underline">
          <Plus size={14} />
        </button>
      </div>

      {/* 新建/编辑对话框 */}
      {(showNew || editing) && (
        <CharacterEditor
          initial={editing}
          bookId={currentBook?.id || ''}
          onSave={async (data: any) => {
            if (editing) {
              await apiClient.patch(`/characters/${editing.id}`, data);
            } else {
              await apiClient.post(`/books/${currentBook?.id}/characters`, data);
            }
            loadCharacters(currentBook!.id);
            setShowNew(false); setEditing(null);
          }}
          onClose={() => { setShowNew(false); setEditing(null); }}
        />
      )}

      {/* 分类角色列表 */}
      {categories.map(cat => {
        const chars = characters.filter(c => c.category === cat.key);
        if (!chars.length) return null;
        return (
          <div key={cat.key}>
            <div className="px-3 py-1 text-text-tertiary font-medium">{cat.label}</div>
            {chars.map(c => (
              <button key={c.id}
                className="w-full pl-5 pr-3 py-1 text-left hover:bg-bg-hover flex items-center gap-1"
                onClick={() => setEditing(c)}
              >
                <span className={cat.color}>●</span>
                <span className="truncate flex-1">{c.name}</span>
                {c.alias && <span className="text-text-tertiary">({c.alias})</span>}
                <Edit3 size={10} className="text-text-tertiary opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** 角色编辑表单 */
function CharacterEditor({ initial, bookId, onSave, onClose }: any) {
  const [form, setForm] = useState(initial || { name: '', category: 'supporting', background: '', personality: '', abilities: '', appearance: '', goals: '' });

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-bg-primary rounded-lg shadow-xl p-4 w-96 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">{initial ? '编辑角色' : '新建角色'}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="space-y-2">
          <input className="w-full p-1.5 border border-border-primary rounded text-xs" placeholder="姓名" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <input className="w-full p-1.5 border border-border-primary rounded text-xs" placeholder="别名" value={form.alias || ''} onChange={e => setForm({...form, alias: e.target.value})} />
          <select className="w-full p-1.5 border border-border-primary rounded text-xs" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
            <option value="protagonist">主角</option><option value="antagonist">反派</option>
            <option value="supporting">配角</option><option value="ensemble">群像</option>
          </select>
          {['background', 'personality', 'abilities', 'appearance', 'goals'].map(f => (
            <textarea key={f} className="w-full p-1.5 border border-border-primary rounded text-xs h-16" placeholder={f} value={form[f] || ''} onChange={e => setForm({...form, [f]: e.target.value})} />
          ))}
          <button className="w-full py-1.5 bg-brand-primary text-brand-text rounded text-xs" onClick={() => onSave(form)}>
            {initial ? '保存修改' : '创建角色'}
          </button>
          {initial && (
            <button className="w-full py-1.5 text-error text-xs hover:underline" onClick={async () => {
              if (confirm('确认删除？')) { await apiClient.delete(`/characters/${initial.id}`); onClose(); }
            }}>删除角色</button>
          )}
        </div>
      </div>
    </div>
  );
}
