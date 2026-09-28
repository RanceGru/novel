// 作品相关标签页 — 纲树/角色/世界观
import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';
import OutlineTree from '../outline/OutlineTree';
import CharacterList, { OPEN_NEW_CHARACTER_EVENT } from '../characters/CharacterList';
import { useCharacterStore } from '../../stores/character.store';
import { useWorldbuildingStore } from '../../stores/worldbuilding.store';

const WORLD_CATEGORIES = [
  { key: 'era', label: '时代信息' }, { key: 'society', label: '社会背景' },
  { key: 'power_system', label: '力量体系' }, { key: 'politics', label: '政治体系' },
  { key: 'economy', label: '经济体系' }, { key: 'culture', label: '文化体系' },
  { key: 'geography', label: '地理位置' }, { key: 'other', label: '其他补充' },
];

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
  const { settings, loadSettings } = useWorldbuildingStore();
  useEffect(() => { if (expanded) loadSettings(bookId); }, [expanded, bookId]);
  return (
    <div>
      <button onClick={onToggle} className="w-full pl-10 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors">
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="truncate flex-1">世界观</span>
        <span className="text-text-tertiary text-xs">{settings.length}</span>
      </button>
      {expanded && WORLD_CATEGORIES.map(cat => {
        const items = settings.filter((s: any) => s.category === cat.key);
        return (
          <div key={cat.key}>
            <div className="pl-14 pr-3 py-1 text-xs text-text-secondary flex items-center gap-1">
              <span className="truncate flex-1">{cat.label}</span>
              <span className="text-text-tertiary text-[10px]">{items.length}</span>
            </div>
            {items.map((s: any) => (
              <div key={s.id} className="pl-20 pr-3 py-0.5 text-text-tertiary text-xs truncate">{s.title}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
