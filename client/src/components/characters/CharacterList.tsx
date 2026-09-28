// 角色列表组件
//
// 结构：角色行可展开，展开后显示其「子项」（类似分卷下的章节）。
// 与分卷/章节的差异：子项不带序号，命名就是普通标题。
// 交互沿用纲树/目录的习惯：行内 hover 出「+」新建子项，子项行 hover 出删除。
import { useEffect, useState } from 'react';
import { useCharacterStore } from '../../stores/character.store';
import { useProjectStore } from '../../stores/project.store';
import { ChevronRight, ChevronDown, Plus, Edit3, Trash2, X } from 'lucide-react';

export default function CharacterList() {
  const {
    characters, sections, loadCharacters, error, clearError,
    create, update, remove, createSection, updateSection, deleteSection,
  } = useCharacterStore();
  const { currentBook } = useProjectStore();
  const [editing, setEditing] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  /** 正在新建子项的角色 id 与草稿标题 */
  const [newSection, setNewSection] = useState<{ characterId: string; title: string } | null>(null);
  /** 正在重命名的子项 id 与草稿标题 */
  const [renameSection, setRenameSection] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (currentBook) loadCharacters(currentBook.id);
  }, [currentBook]);

  if (!currentBook) return null;
  const bookId = currentBook.id;

  const categories = [
    { key: 'protagonist', label: '主角', color: 'text-yellow-400' },
    { key: 'antagonist', label: '反派', color: 'text-red-400' },
    { key: 'supporting', label: '配角', color: 'text-blue-400' },
    { key: 'ensemble', label: '群像', color: 'text-green-400' },
  ];
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const run = async (fn: () => Promise<any>) => { try { await fn(); } catch { /* 错误已入 store.error */ } };

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-primary">
        <span className="font-semibold text-text-tertiary">👤 角色 ({characters.length})</span>
        <button onClick={() => setShowNew(true)} className="text-brand-primary hover:underline" title="新建角色">
          <Plus size={14} />
        </button>
      </div>

      {error && (
        <div className="mx-2 my-1 px-2 py-1 rounded bg-error/10 border border-error/20 text-error flex items-start gap-1">
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="shrink-0 hover:opacity-70" title="关闭">✕</button>
        </div>
      )}

      {/* 新建/编辑角色对话框 */}
      {(showNew || editing) && (
        <CharacterEditor
          initial={editing}
          onSave={async (data: any) => {
            if (editing) await run(() => update(bookId, editing.id, data));
            else await run(() => create(bookId, data));
            setShowNew(false); setEditing(null);
          }}
          onDelete={editing ? async () => {
            if (confirm(`确认删除角色「${editing.name}」及其全部子项？`)) {
              await run(() => remove(bookId, editing.id));
              setEditing(null);
            }
          } : undefined}
          onClose={() => { setShowNew(false); setEditing(null); }}
        />
      )}

      {/* 分类角色列表；每个角色可展开显示其子项 */}
      {categories.map(cat => {
        const chars = characters.filter(c => c.category === cat.key);
        if (!chars.length) return null;
        return (
          <div key={cat.key}>
            <div className="px-3 py-1 text-text-tertiary font-medium">{cat.label}</div>
            {chars.map(c => {
              const kids = sections
                .filter(s => s.characterId === c.id)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              const open = !!expanded[c.id];
              return (
                <div key={c.id}>
                  {/* 角色行：与目录的分卷行同构（可展开 + hover 出「+」新建子项） */}
                  <div data-char-row="character"
                    className="w-full pl-5 pr-3 py-1 hover:bg-bg-hover flex items-center gap-1.5 transition-colors group cursor-pointer"
                    onClick={() => toggle(c.id)}>
                    {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <span className={`${cat.color} shrink-0`}>●</span>
                    <span className="truncate flex-1">{c.name}</span>
                    {c.alias && <span className="text-text-tertiary shrink-0">({c.alias})</span>}
                    <button data-role="add-section"
                      onClick={(e) => { e.stopPropagation(); setExpanded(p => ({ ...p, [c.id]: true })); setNewSection({ characterId: c.id, title: '' }); }}
                      className="hidden group-hover:inline shrink-0 text-text-tertiary hover:text-text-primary"
                      title="新建子项">
                      <Plus size={13} />
                    </button>
                    <button data-role="edit-character"
                      onClick={(e) => { e.stopPropagation(); setEditing(c); }}
                      className="hidden group-hover:inline shrink-0 text-text-tertiary hover:text-text-primary"
                      title="编辑角色">
                      <Edit3 size={12} />
                    </button>
                  </div>

                  {/* 子项列表（无序号） */}
                  {open && (
                    <div>
                      {kids.map(s => (
                        <div key={s.id} data-char-row="section" data-section-id={s.id} data-section-title={s.title}
                          className="group flex items-center gap-1 pl-10 pr-3 py-0.5 hover:bg-bg-hover text-text-secondary">
                          {renameSection?.id === s.id ? (
                            <input autoFocus value={renameSection.title} placeholder="子项标题"
                              onChange={e => setRenameSection({ id: s.id, title: e.target.value })}
                              onKeyDown={async e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const t = renameSection.title.trim();
                                  if (t) await run(() => updateSection(bookId, s.id, { title: t }));
                                  setRenameSection(null);
                                }
                                if (e.key === 'Escape') setRenameSection(null);
                              }}
                              className="flex-1 min-w-0 px-1 py-0 text-xs border border-brand-primary rounded bg-bg-primary" />
                          ) : (
                            <>
                              <span className="truncate flex-1">{s.title}</span>
                              <span className="text-text-tertiary text-[10px] shrink-0">
                                {s.content?.trim() ? `${s.content.trim().length}字` : '空'}
                              </span>
                              <button data-role="rename-section"
                                onClick={(e) => { e.stopPropagation(); setRenameSection({ id: s.id, title: s.title }); }}
                                className="hidden group-hover:inline shrink-0 text-text-tertiary hover:text-text-primary" title="重命名">
                                <Edit3 size={11} />
                              </button>
                              <button data-role="delete-section"
                                onClick={(e) => { e.stopPropagation(); if (confirm(`确认删除子项「${s.title}」？`)) run(() => deleteSection(bookId, s.id)); }}
                                className="hidden group-hover:inline shrink-0 text-text-tertiary hover:text-error" title="删除">✕</button>
                            </>
                          )}
                        </div>
                      ))}

                      {/* 新建子项草稿（无序号，只有标题） */}
                      {newSection?.characterId === c.id && (
                        <div className="pl-10 pr-3 py-1 flex items-center gap-1">
                          <input autoFocus value={newSection.title} placeholder="子项标题"
                            onChange={e => setNewSection({ characterId: c.id, title: e.target.value })}
                            onKeyDown={async e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const t = newSection.title.trim();
                                if (t) await run(() => createSection(bookId, c.id, { title: t }));
                                setNewSection(null);
                              }
                              if (e.key === 'Escape') setNewSection(null);
                            }}
                            className="flex-1 min-w-0 px-1 py-0 text-xs border border-brand-primary rounded bg-bg-primary" />
                          <button className="text-brand-primary shrink-0" title="确认"
                            onClick={async () => {
                              const t = newSection.title.trim();
                              if (t) await run(() => createSection(bookId, c.id, { title: t }));
                              setNewSection(null);
                            }}>✓</button>
                          <button className="text-text-tertiary shrink-0" title="取消" onClick={() => setNewSection(null)}>✕</button>
                        </div>
                      )}

                      {kids.length === 0 && newSection?.characterId !== c.id && (
                        <div className="pl-10 pr-3 py-1 text-text-tertiary">暂无子项，点击右侧 + 新建</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {characters.length === 0 && (
        <div className="px-3 py-3 text-text-tertiary">暂无角色，点击右上角 + 新建</div>
      )}
    </div>
  );
}

/** 角色编辑表单（仅保留角色本身的属性；长文本内容已迁至子项） */
function CharacterEditor({ initial, onSave, onDelete, onClose }: any) {
  const [form, setForm] = useState(initial || { name: '', alias: '', category: 'supporting', arcSummary: '' });

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-bg-primary rounded-lg shadow-xl p-4 w-96 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">{initial ? '编辑角色' : '新建角色'}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="space-y-2">
          <input className="w-full p-1.5 border border-border-primary rounded text-xs" placeholder="姓名"
            value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="w-full p-1.5 border border-border-primary rounded text-xs" placeholder="别名"
            value={form.alias || ''} onChange={e => setForm({ ...form, alias: e.target.value })} />
          <select className="w-full p-1.5 border border-border-primary rounded text-xs" value={form.category || 'supporting'}
            onChange={e => setForm({ ...form, category: e.target.value })}>
            <option value="protagonist">主角</option><option value="antagonist">反派</option>
            <option value="supporting">配角</option><option value="ensemble">群像</option>
          </select>
          <textarea className="w-full p-1.5 border border-border-primary rounded text-xs h-20" placeholder="角色弧光概要"
            value={form.arcSummary || ''} onChange={e => setForm({ ...form, arcSummary: e.target.value })} />
          <p className="text-[10px] text-text-tertiary leading-tight">
            背景 / 性格 / 能力 / 外貌 / 目标 等内容在角色展开后的子项中维护。
          </p>
          <button className="w-full py-1.5 bg-brand-primary text-brand-text rounded text-xs"
            onClick={() => onSave(form)} disabled={!form.name?.trim()}>
            {initial ? '保存修改' : '创建角色'}
          </button>
          {onDelete && (
            <button className="w-full py-1.5 text-error text-xs hover:underline" onClick={onDelete}>删除角色</button>
          )}
        </div>
      </div>
    </div>
  );
}
