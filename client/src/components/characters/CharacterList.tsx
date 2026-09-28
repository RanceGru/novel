// 角色列表组件
//
// 结构：角色行可展开，展开后显示其「子项」（类似分卷下的章节）。
// 交互与章节一致：行内 hover 出「+」新建子项（先命名再确认），
// 子项行 hover 只出删除按键，重命名/删除走右键菜单。
import { useEffect, useState } from 'react';
import { useCharacterStore } from '../../stores/character.store';
import { useProjectStore } from '../../stores/project.store';
import { useEditorStore } from '../../stores/editor.store';
import { ChevronRight, ChevronDown, Plus, Edit3, X } from 'lucide-react';
import ItemContextMenu from '../layout/ItemContextMenu';

/**
 * 「新建角色」的触发事件名。
 * 按钮放在 RelatedTab 的角色标题行里（与「细纲」header 的按钮位置一致），
 * 而对话框在本组件内，故用窗口事件解耦两者，避免把弹窗状态提升到父组件。
 * 定义在此处导出，RelatedTab 直接引用，避免字符串两处各写一份。
 */
export const OPEN_NEW_CHARACTER_EVENT = 'novel:open-new-character';

export default function CharacterList() {
  const {
    characters, sections, loadCharacters, error, clearError,
    create, update, remove, createSection, updateSection, deleteSection,
  } = useCharacterStore();
  const { currentBook } = useProjectStore();
  /** 点击子项 → 在中间编辑器里编辑内容 */
  const selectDoc = useEditorStore((s) => s.selectDoc);
  const [editing, setEditing] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  /** 正在新建子项的角色 id 与草稿标题 */
  const [newSection, setNewSection] = useState<{ characterId: string; title: string } | null>(null);
  /** 正在重命名的子项 id 与草稿标题 */
  const [renameSection, setRenameSection] = useState<{ id: string; title: string } | null>(null);
  /** 子项右键菜单位置与目标子项 */
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; s: any } | null>(null);

  useEffect(() => {
    if (currentBook) loadCharacters(currentBook.id);
  }, [currentBook]);

  // 角色标题行里的「新建角色」按钮通过窗口事件触发本组件的对话框
  useEffect(() => {
    const open = () => setShowNew(true);
    window.addEventListener(OPEN_NEW_CHARACTER_EVENT, open);
    return () => window.removeEventListener(OPEN_NEW_CHARACTER_EVENT, open);
  }, []);

  if (!currentBook) return null;
  const bookId = currentBook.id;

  /** 默认名「子项N」：N 取该角色下同类标题的最大序号 +1（与新增章节的做法一致） */
  const nextSectionTitle = (characterId: string) => {
    let maxNo = 0;
    for (const s of sections.filter((x) => x.characterId === characterId)) {
      const m = /^子项(\d+)$/.exec((s.title || '').trim());
      if (m) maxNo = Math.max(maxNo, Number(m[1]));
    }
    return `子项${maxNo + 1}`;
  };

  const deleteOne = (s: any) => {
    if (confirm(`确认删除子项「${s.title}」？`)) run(() => deleteSection(bookId, s.id));
  };

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const run = async (fn: () => Promise<any>) => { try { await fn(); } catch { /* 错误已入 store.error */ } };

  return (
    <div className="text-xs">
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

      {/* 角色列表：不再按「主角/反派/配角/群像」分组，所有角色平铺；
          分类字段仍保留在数据与编辑表单里，只是不再作为界面分层 */}
      {characters.map(c => {
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
              {/* 箭头颜色与纲树各行保持一致（text-text-tertiary），否则会继承正文色显得过深 */}
              {open ? <ChevronDown size={12} className="text-text-tertiary" /> : <ChevronRight size={12} className="text-text-tertiary" />}
              <span className="truncate flex-1">{c.name}</span>
              {c.alias && <span className="text-text-tertiary shrink-0">({c.alias})</span>}
              <button data-role="add-section"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(p => ({ ...p, [c.id]: true }));
                  // 与新增章节一致：先给出默认名（子项N），可在草稿行里改
                  setNewSection({ characterId: c.id, title: nextSectionTitle(c.id) });
                }}
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

            {/* 子项列表：右侧只有删除按键，重命名/删除走右键菜单（与章节一致） */}
            {open && (
              <div>
                {kids.map(s => (
                  <div key={s.id} data-char-row="section" data-section-id={s.id} data-section-title={s.title}
                    className="group flex items-center gap-1 pl-10 pr-3 py-0.5 hover:bg-bg-hover text-text-secondary cursor-pointer"
                    onClick={() => selectDoc({
                      kind: 'character_section', id: s.id, title: s.title,
                      content: s.content || '', editableTitle: false,
                    })}
                    title="点击在中间编辑器里编辑内容"
                    onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, s }); }}>
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
                        <button data-role="delete-section"
                          onClick={(e) => { e.stopPropagation(); deleteOne(s); }}
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

      {characters.length === 0 && (
        <div className="px-3 py-3 text-text-tertiary">暂无角色，点击右上角 + 新建</div>
      )}

      {/* 子项右键菜单：重命名 / 删除 */}
      {ctxMenu && (
        <ItemContextMenu x={ctxMenu.x} y={ctxMenu.y}
          labels={{ rename: '重命名', remove: '删除' }}
          onClose={() => setCtxMenu(null)}
          onRename={() => setRenameSection({ id: ctxMenu.s.id, title: ctxMenu.s.title })}
          onDelete={() => deleteOne(ctxMenu.s)} />
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
