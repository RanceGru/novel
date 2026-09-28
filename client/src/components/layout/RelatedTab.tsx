// 作品相关标签页 — 纲树/角色/世界观
import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import OutlineTree from '../outline/OutlineTree';
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

function CharacterSection({ bookId, expanded, onToggle }: { bookId: string; expanded: boolean; onToggle: () => void }) {
  const { characters, loadCharacters } = useCharacterStore();
  useEffect(() => { if (expanded) loadCharacters(bookId); }, [expanded, bookId]);
  return (
    <div>
      <button onClick={onToggle} className="w-full pl-10 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors">
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="truncate flex-1">角色</span>
        <span className="text-text-tertiary text-xs">{characters.length}</span>
      </button>
      {expanded && characters.map((c: any) => (
        <div key={c.id} className="pl-14 pr-3 py-1 text-xs text-text-secondary flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0" />
          <span className="truncate">{c.name}{c.alias ? ` (${c.alias})` : ''}</span>
        </div>
      ))}
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
