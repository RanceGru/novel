// 作品相关标签页 — 纲树/角色/世界观
import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Plus, Edit3 } from 'lucide-react';
import OutlineTree from '../outline/OutlineTree';
import CharacterList, { OPEN_NEW_CHARACTER_EVENT } from '../characters/CharacterList';
import { useCharacterStore } from '../../stores/character.store';
import { useWorldbuildingStore } from '../../stores/worldbuilding.store';

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

function WorldSection({ bookId, expanded, onToggle }: { bookId: string; expanded: boolean; onToggle: () => void }) {
  const { settings, loadSettings, create, update } = useWorldbuildingStore();
  useEffect(() => { if (expanded) loadSettings(bookId); }, [expanded, bookId]);

  /** 展开查看/编辑内容的条目 id，以及该条目的草稿内容 */
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  /**
   * 新增一条信息：默认命名「其他补充」（同名即可，与默认自带的那个一样），
   * 排在所有现有条目之后（sortOrder 由后端分配）。
   * 收起状态下先展开再创建，避免用户点了没反应。
   */
  const addSetting = async () => {
    await create(bookId, { category: 'other', title: '其他补充', content: '' });
    if (!expanded) onToggle();
  };

  const openItem = (s: any) => {
    if (openId === s.id) { setOpenId(null); return; }
    setOpenId(s.id);
    setDraft(s.content || '');
  };
  const saveItem = async (id: string) => {
    await update(bookId, id, { content: draft });
    setOpenId(null);
  };

  // 按 sortOrder 排列：默认自带的 8 个条目在前，新增的在后
  const items = [...settings].sort((a, b) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div>
      {/* 与「角色」行同款：箭头 + 名称 + 右侧「新增信息」按钮 */}
      <div data-role="world-header"
        className="w-full pl-10 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors cursor-pointer"
        onClick={onToggle}>
        {expanded ? <ChevronDown size={12} className="text-text-tertiary" /> : <ChevronRight size={12} className="text-text-tertiary" />}
        <span className="text-text-secondary flex-1">世界观</span>
        <button data-role="add-world-setting"
          onClick={(e) => { e.stopPropagation(); addSetting(); }}
          className="inline-flex shrink-0 rounded hover:bg-bg-active text-text-tertiary hover:text-text-primary transition-colors p-0.5"
          title="新增信息">
          <Plus size={15} />
        </button>
      </div>
      {expanded && (
        <div>
          {/* 条目即「可填写的一项」，下面没有更深的子项；点行展开即可填写内容 */}
          {items.map((s: any) => {
            const isOpen = openId === s.id;
            return (
              <div key={s.id}>
                <div data-world-row="item" data-world-title={s.title}
                  className="group w-full pl-14 pr-3 py-1 text-xs text-text-secondary hover:bg-bg-hover flex items-center gap-1.5 transition-colors cursor-pointer"
                  onClick={() => openItem(s)}>
                  {isOpen ? <ChevronDown size={12} className="text-text-tertiary" /> : <ChevronRight size={12} className="text-text-tertiary" />}
                  <span className="truncate flex-1">{s.title}</span>
                  <span className="text-text-tertiary text-[10px] shrink-0">
                    {s.content?.trim() ? `${s.content.trim().length}字` : '空'}
                  </span>
                  <Edit3 size={11} className="hidden group-hover:inline shrink-0 text-text-tertiary" />
                </div>
                {isOpen && (
                  <div className="pl-16 pr-3 pb-2">
                    <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={5}
                      placeholder={`填写「${s.title}」的内容…`}
                      className="w-full p-1.5 text-xs border border-brand-primary rounded bg-bg-primary resize-y" />
                    <div className="flex gap-2 mt-1">
                      <button className="text-brand-primary hover:underline"
                        onClick={() => saveItem(s.id)}>保存</button>
                      <button className="text-text-tertiary hover:text-text-primary"
                        onClick={() => setOpenId(null)}>取消</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="pl-14 pr-3 py-1 text-text-tertiary text-xs">暂无信息，点击右侧 + 新增</div>
          )}
        </div>
      )}
    </div>
  );
}
