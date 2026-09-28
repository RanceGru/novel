// 作品相关标签页 — 纲树/角色/世界观
import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';
import OutlineTree from '../outline/OutlineTree';
import CharacterList, { OPEN_NEW_CHARACTER_EVENT } from '../characters/CharacterList';
import ItemContextMenu from './ItemContextMenu';
import { useCharacterStore } from '../../stores/character.store';
import { useWorldbuildingStore } from '../../stores/worldbuilding.store';
import { useEditorStore } from '../../stores/editor.store';

interface Props { bookId: string; }

export default function RelatedTab({ bookId }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div>
      <OutlineSection bookId={bookId} expanded={expanded['outline']} onToggle={() => toggle('outline')} />
      <CharacterSection bookId={bookId} expanded={expanded['character']} onToggle={() => toggle('character')} />
      <WorldSection bookId={bookId} expanded={expanded['world']} onToggle={() => toggle('world')} />
    </div>
  );
}

/** 纲树区：展开后渲染三分组（大纲 / 卷纲 / 章纲） */
function OutlineSection({ bookId, expanded, onToggle }: { bookId: string; expanded: boolean; onToggle: () => void }) {
  return (
    <div>
      <button onClick={onToggle} className="w-full pl-10 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors">
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="truncate flex-1">纲树</span>
      </button>
      {expanded && <div className="border-l border-border-primary ml-10"><OutlineTree showHeader={false} /></div>}
    </div>
  );
}

/** 角色区：标题行右侧直接放「新建角色」，列表内不再重复一行标题 */
function CharacterSection({ bookId, expanded, onToggle }: { bookId: string; expanded: boolean; onToggle: () => void }) {
  const { characters, loadCharacters } = useCharacterStore();
  useEffect(() => { if (expanded) loadCharacters(bookId); }, [expanded, bookId]);

  /**
   * 收起状态下点了「新建角色」：此时 CharacterList 还没挂载，直接派发事件没人接收。
   * 所以先记下意图，等展开并挂载后再派发（见下面的 effect）。
   */
  const [pendingNew, setPendingNew] = useState(false);
  const startNewCharacter = () => {
    if (expanded) window.dispatchEvent(new Event(OPEN_NEW_CHARACTER_EVENT));
    else { setPendingNew(true); onToggle(); }
  };
  useEffect(() => {
    if (expanded && pendingNew) {
      setPendingNew(false);
      window.dispatchEvent(new Event(OPEN_NEW_CHARACTER_EVENT));
    }
  }, [expanded, pendingNew]);

  return (
    <div>
      {/* 与「细纲」header 同款：箭头 + 名称 + 右侧操作按钮 */}
      <div data-role="character-header"
        className="w-full pl-10 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors cursor-pointer"
        onClick={onToggle}>
        {expanded ? <ChevronDown size={12} className="text-text-tertiary" /> : <ChevronRight size={12} className="text-text-tertiary" />}
        <span className="text-text-secondary flex-1">角色</span>
        <button data-role="new-character"
          onClick={(e) => { e.stopPropagation(); startNewCharacter(); }}
          className="inline-flex shrink-0 rounded hover:bg-bg-active text-text-tertiary hover:text-text-primary transition-colors p-0.5"
          title={`新建角色（当前 ${characters.length} 个）`}>
          <Plus size={15} />
        </button>
      </div>
      {/* 展开后使用完整列表：角色可继续展开，其下子项支持增删改 */}
      {expanded && <div className="border-l border-border-primary ml-10"><CharacterList /></div>}
    </div>
  );
}

/** 固定条目的分类键；其余分类视为用户自建条目（可展开、可改名、可删除） */
const FIXED_WORLD_CATEGORIES = ['era', 'society', 'power_system', 'politics', 'economy', 'culture', 'geography'];

function WorldSection({ bookId, expanded, onToggle }: { bookId: string; expanded: boolean; onToggle: () => void }) {
  const { settings, loadSettings, create, update, remove } = useWorldbuildingStore();
  /** 点击条目 → 在中间编辑器里编辑内容 */
  const selectDoc = useEditorStore((s) => s.selectDoc);
  useEffect(() => { if (expanded) loadSettings(bookId); }, [expanded, bookId]);

  /** 新建条目的草稿标题（像新增章节那样，先起名再确认落库） */
  const [newItem, setNewItem] = useState<{ title: string } | null>(null);
  /** 正在重命名的条目 id 与草稿标题 */
  const [renameItem, setRenameItem] = useState<{ id: string; title: string } | null>(null);
  /** 右键菜单位置与目标条目 */
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; s: any } | null>(null);

  /** 默认名「其他补充N」：N 取已有同类标题的最大序号 +1 */
  const nextSupplementTitle = () => {
    let maxNo = 0;
    for (const s of settings as any[]) {
      const m = /^其他补充(\d+)$/.exec((s.title || '').trim());
      if (m) maxNo = Math.max(maxNo, Number(m[1]));
    }
    return `其他补充${maxNo + 1}`;
  };

  /** 点右上「+」：打开命名草稿行（与新增章节一致：先命名，确认才落库） */
  const startNewItem = () => {
    if (!expanded) onToggle();
    setNewItem({ title: nextSupplementTitle() });
  };

  const confirmNewItem = async () => {
    if (!newItem) return;
    const title = newItem.title.trim() || nextSupplementTitle();
    setNewItem(null);
    await create(bookId, { category: 'other', title, content: '' });
  };

  const confirmRename = async (id: string, title: string) => {
    const t = title.trim();
    if (t) await update(bookId, id, { title: t });
    setRenameItem(null);
  };

  const deleteItem = async (s: any) => {
    if (confirm(`确认删除「${s.title}」？`)) await remove(bookId, s.id);
  };

  // 按 sortOrder 排列：固定条目在前，用户新增的在后
  const items = [...settings].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div>
      {/* 与「角色」行同款：箭头 + 名称 + 右侧「新增信息」按钮 */}
      <div data-role="world-header"
        className="w-full pl-10 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors cursor-pointer"
        onClick={onToggle}>
        {expanded ? <ChevronDown size={12} className="text-text-tertiary" /> : <ChevronRight size={12} className="text-text-tertiary" />}
        <span className="text-text-secondary flex-1">世界观</span>
        <button data-role="add-world-setting"
          onClick={(e) => { e.stopPropagation(); startNewItem(); }}
          className="inline-flex shrink-0 rounded hover:bg-bg-active text-text-tertiary hover:text-text-primary transition-colors p-0.5"
          title="新增信息">
          <Plus size={15} />
        </button>
      </div>

      {expanded && (
        <div>
          {/* 条目行与章节行同构：右侧 hover 出删除按键，重命名/删除走右键菜单。
              不再显示「空」与行内重命名按键（按需求去掉）。 */}
          {items.map((s: any) => {
            const isFixed = FIXED_WORLD_CATEGORIES.includes(s.category);
            const renaming = renameItem?.id === s.id;
            return (
              <div key={s.id} data-world-row={isFixed ? 'fixed' : 'item'} data-world-title={s.title}
                className="group pl-14 pr-3 py-1 text-xs text-text-secondary hover:bg-bg-hover flex items-center gap-1.5 transition-colors cursor-pointer"
                onClick={() => selectDoc({
                  kind: 'world_setting', id: s.id, title: s.title,
                  content: s.content || '', editableTitle: false,
                })}
                title="点击在中间编辑器里编辑内容"
                onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, s }); }}>
                {renaming ? (
                  // 断言非空：renaming 为真时 renameItem 必然存在（TS 不会跨表达式窄化）
                  <input autoFocus value={(renameItem as { id: string; title: string }).title} placeholder="条目名称"
                    onChange={(e) => setRenameItem({ id: s.id, title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); confirmRename(s.id, e.currentTarget.value); }
                      if (e.key === 'Escape') setRenameItem(null);
                    }}
                    className="flex-1 min-w-0 px-1 py-0 text-xs border border-brand-primary rounded bg-bg-primary" />
                ) : (
                  <>
                    <span className="truncate flex-1">{s.title}</span>
                    <button data-role="delete-world-item"
                      onClick={(e) => { e.stopPropagation(); deleteItem(s); }}
                      className="hidden group-hover:inline shrink-0 text-text-tertiary hover:text-error" title="删除">✕</button>
                  </>
                )}
              </div>
            );
          })}

          {/* 新建条目草稿：像新增章节一样，左边就是名称输入框（预设「其他补充N」） */}
          {newItem && (
            <div className="pl-14 pr-3 py-1 flex items-center gap-1">
              <input autoFocus value={newItem.title} placeholder="条目名称"
                onChange={(e) => setNewItem({ title: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); confirmNewItem(); }
                  if (e.key === 'Escape') setNewItem(null);
                }}
                className="flex-1 min-w-0 px-1 py-0 text-xs border border-brand-primary rounded bg-bg-primary" />
              <button data-role="confirm-new-world-item" className="text-brand-primary shrink-0" title="确认"
                onClick={confirmNewItem}>✓</button>
              <button className="text-text-tertiary shrink-0" title="取消" onClick={() => setNewItem(null)}>✕</button>
            </div>
          )}

          {items.length === 0 && !newItem && (
            <div className="pl-14 pr-3 py-1 text-text-tertiary text-xs">暂无信息，点击右侧 + 新增</div>
          )}
        </div>
      )}

      {/* 右键菜单：重命名 / 删除 */}
      {ctxMenu && (
        <ItemContextMenu x={ctxMenu.x} y={ctxMenu.y}
          labels={{ rename: '重命名', remove: '删除' }}
          onClose={() => setCtxMenu(null)}
          onRename={() => setRenameItem({ id: ctxMenu.s.id, title: ctxMenu.s.title })}
          onDelete={() => deleteItem(ctxMenu.s)} />
      )}
    </div>
  );
}
