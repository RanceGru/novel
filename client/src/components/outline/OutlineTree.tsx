// 纲树组件
//
// 结构：
//   大纲   单例，等同目录里的一个普通章节行（无展开箭头）
//   细纲   与「目录」同构：卷纲 ↔ 分卷、章纲 ↔ 章节，视觉与按钮位置对齐目录
//       卷纲   行样式同目录的分卷行；展开后显示其下章纲
//         章纲   行样式同目录的章节行
//         每个卷纲自带系统条目「第N卷卷纲」（该卷内容摘要），不可删除、标题不可改
//
// 与目录的对应关系（视觉与交互对齐，数据各自独立）：
//   目录 header ：箭头 + 「目录」 + 新建分卷(FolderPlus) + 新建章节(FilePlus)
//   细纲 header ：箭头 + 「细纲」 + 新建卷纲(FolderPlus) + 新建章纲(FilePlus)
//   分卷行      ：pl-10 / py-1.5 / text-sm / 箭头 12 / 文本 flex-1 / hover 出「+」
//   章节行      ：pl-16 / py-1 / text-sm / 文本 flex-1 / hover 出操作
import { useEffect, useState } from 'react';
import { useOutlineStore, OutlineNode, OutlineSyncState } from '../../stores/outline.store';
import { useProjectStore } from '../../stores/project.store';
import { useEditorStore } from '../../stores/editor.store';
import { ChevronRight, ChevronDown, Edit3, FileText, FolderPlus, FilePlus } from 'lucide-react';
import NumberTitleInput from '../layout/NumberTitleInput';
import OutlineVolumeContextMenu from '../layout/OutlineVolumeContextMenu';
import OutlineChapterContextMenu from '../layout/OutlineChapterContextMenu';

/** 同步状态的展示配置（synced 不提示） */
const STATE_UI: Record<OutlineSyncState, { label: string; className: string } | null> = {
  pending: { label: '待生成', className: 'text-text-tertiary' },
  synced: null,
  changed: { label: '章纲有改动', className: 'text-warning' },
  source_missing: { label: '源章节已删除', className: 'text-error' },
};

export default function OutlineTree({ showHeader = true }: { showHeader?: boolean } = {}) {
  const {
    bookOutline, volumes, chapters, loading, error,
    loadGroups, createNode, updateNode, deleteNode,
    generateChapter, generateVolume, clearError,
  } = useOutlineStore();
  const { currentBook } = useProjectStore();
  // 章节纲（快照）或当前章节变化时递增：用于自动刷新「章纲有改动」提示
  const outlineVersion = useEditorStore((s) => s.outlineVersion);
  /** 点击纲条目 → 在中间编辑器里编辑其内容 */
  const selectDoc = useEditorStore((s) => s.selectDoc);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({ detailed: true });
  /** 新建卷纲草稿：左编号 + 右标题（与目录的新建分卷一致） */
  const [newVolume, setNewVolume] = useState<{ number: number | null; title: string } | null>(null);
  /** 新建章纲草稿：parentId 为所属卷纲 */
  const [newChapter, setNewChapter] = useState<{ parentId: string; number: number | null; title: string } | null>(null);
  /** 重命名中的纲条目 id（卷纲/章纲共用）与草稿标题 */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  /** 右键菜单：位置 + 目标节点 + 类型 */
  const [ctxMenu, setCtxMenu] = useState<
    | { kind: 'volume'; x: number; y: number; node: OutlineNode }
    | { kind: 'chapter'; x: number; y: number; node: OutlineNode }
    | null
  >(null);

  useEffect(() => {
    if (currentBook) loadGroups(currentBook.id);
  }, [currentBook, outlineVersion]);

  if (!currentBook) return null;
  const bookId = currentBook.id;

  const toggle = (k: string) => setExpanded(p => ({ ...p, [k]: !p[k] }));
  const volOpen = (id: string) => expanded[`v:${id}`] !== false; // 默认展开
  const run = async (fn: () => Promise<any>) => {
    try { await fn(); } catch { /* 错误已写入 store.error，由提示条展示 */ }
  };
  /**
   * 新建章纲：只有一个卷纲时直接在该卷下开草稿，否则由用户在具体卷上点 +。
   * 序号与命名对齐目录的章节（第1章 章纲1 / 第2章 章纲2…）：
   * 系统自带的「第N卷卷纲」不算作一章，故计数时排除 isSystem 条目。
   */
  const startNewChapter = (preferredVolumeId?: string) => {
    const target = preferredVolumeId ?? (volumes.length === 1 ? volumes[0].id : undefined);
    if (!target) return;
    const n = chapters.filter(c => c.parentId === target && !c.isSystem).length + 1;
    setExpanded(p => ({ ...p, [`v:${target}`]: true }));
    setNewChapter({ parentId: target, number: n, title: `第${n}章 章纲${n}` });
  };
  /** 新建卷纲：编号与标题按顺序预设为 卷纲1、卷纲2…（与目录新建分卷的做法一致） */
  const startNewVolume = () => {
    const n = volumes.length + 1;
    setExpanded(p => ({ ...p, detailed: true }));
    setNewChapter(null);
    setNewVolume({ number: n, title: `卷纲${n}` });
  };
  /** 确认新建卷纲（点 ✓ 才落库） */
  const confirmNewVolume = async () => {
    if (!newVolume) return;
    await createNode(bookId, {
      level: 'volume_outline',
      title: newVolume.title.trim() || `卷纲${newVolume.number ?? 1}`,
    });
    setNewVolume(null);
  };
  /** 确认新建章纲（点 ✓ 才落库） */
  const confirmNewChapter = async () => {
    if (!newChapter) return;
    await createNode(bookId, {
      level: 'chapter_outline',
      title: newChapter.title.trim() || `第${newChapter.number ?? 1}章 章纲${newChapter.number ?? 1}`,
      parentId: newChapter.parentId,
    });
    setNewChapter(null);
  };

  /** 在中间编辑器打开某个纲条目（大纲/卷纲/章纲都只有 title+content） */
  const openDoc = (node: OutlineNode) => {
    // 系统条目「第N卷卷纲」是卷纲正文，标题固定，内容可编辑
    const editableTitle = !node.isSystem && node.level !== 'book_outline';
    selectDoc({
      kind: node.level === 'volume_outline' ? 'volume_outline'
        : node.level === 'chapter_outline' ? 'chapter_outline'
        : 'book_outline',
      id: node.id,
      title: node.level === 'book_outline' ? '大纲' : node.title,
      content: node.content || '',
      editableTitle,
    });
  };

  // ====== 右键菜单动作（与目录的分卷/章节菜单一一对应）======
  /** 开始重命名（卷纲/章纲共用） */
  const startRename = (node: OutlineNode) => {
    if (node.level === 'book_outline') return;              // 大纲标题固定
    if (node.isSystem) return;                              // 系统条目标题不可改
    setRenameDraft(node.title);
    setRenamingId(node.id);
  };
  const submitRename = async (node: OutlineNode) => {
    const title = renameDraft.trim();
    setRenamingId(null);
    if (!title || title === node.title) return;
    await run(() => updateNode(bookId, node.id, { title }));
  };

  return (
    <div className="text-xs">
      {showHeader && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-primary">
          <span className="font-semibold text-text-tertiary">🌳 纲树</span>
          {loading && <span className="text-text-tertiary text-[10px]">加载中…</span>}
        </div>
      )}

      {error && (
        <div className="mx-2 my-1 px-2 py-1 rounded bg-error/10 border border-error/20 text-error flex items-start gap-1">
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="shrink-0 hover:opacity-70" title="关闭">✕</button>
        </div>
      )}

      {/* ===================== 大纲：等同目录里的一个普通章节行 ===================== */}
      {/* 点击不再就地展开编辑，而是送进中间编辑器（见 openDoc） */}
      <div data-outline-row="book" className="w-full pl-8 pr-3 py-1 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 text-text-secondary group cursor-pointer"
        onClick={() => { if (bookOutline) openDoc(bookOutline); }}
        title="点击在中间编辑器里编辑大纲内容">
        <FileText size={12} className="shrink-0 text-text-tertiary" />
        <span className="truncate flex-1">大纲</span>
        {bookOutline?.content?.trim() && <span className="shrink-0 text-text-tertiary text-xs">已填写</span>}
        <Edit3 size={12} className="hidden group-hover:inline shrink-0 text-text-tertiary" />
      </div>

      {/* ===================== 细纲：结构与目录一致 ===================== */}
      <div data-outline-row="detailed"
        className="w-full pl-8 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors group cursor-pointer"
        onClick={() => toggle('detailed')}>
        {expanded.detailed ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronRight size={14} className="text-text-tertiary" />}
        <span className="text-text-secondary flex-1">细纲</span>
        <button data-role="add-volume" onClick={(e) => { e.stopPropagation(); startNewVolume(); }}
          className="inline-flex shrink-0 rounded hover:bg-bg-active text-text-tertiary hover:text-text-primary transition-colors p-0.5"
          title="新建卷纲">
          <FolderPlus size={15} />
        </button>
        <button data-role="add-chapter" onClick={(e) => { e.stopPropagation(); startNewChapter(); }}
          className="inline-flex shrink-0 rounded hover:bg-bg-active text-text-tertiary hover:text-text-primary transition-colors p-0.5"
          title="新建章纲">
          <FilePlus size={15} />
        </button>
      </div>

      {expanded.detailed && (
        <div className="max-h-72 overflow-y-auto pr-3 mr-1">
          {/* 空状态：与目录同款提示 */}
          {volumes.length === 0 && !newVolume && (
            <div className="pl-8 pr-3 py-3 text-xs text-text-tertiary">
              暂无内容，点击右边+新建
            </div>
          )}

          {/* 新建卷纲草稿：左编号 + 右标题（与目录新建分卷一致） */}
          {newVolume && (
            <div className="w-full pl-10 pr-3 py-1.5 flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0 text-text-tertiary"><ChevronRight size={12} /></span>
              <NumberTitleInput
                kind="volume"
                number={newVolume.number}
                title={newVolume.title}
                onNumberChange={(n) => setNewVolume(d => d && { ...d, number: n })}
                onTitleChange={(t) => setNewVolume(d => d && { ...d, title: t })}
                className="flex-1 min-w-0"
                onConfirm={confirmNewVolume}
                onCancel={() => setNewVolume(null)}
              />
            </div>
          )}

          {volumes.map((v, idx) => {
            const kids = chapters.filter(c => c.parentId === v.id).sort((a, b) => a.sortOrder - b.sortOrder);
            const open = volOpen(v.id);
            return (
              <div key={v.id}>
                {/* 卷纲行：样式对齐目录的分卷行；操作走右键菜单 */}
                <VolumeRow node={v} index={idx + 1} expanded={open}
                  onToggle={() => toggle(`v:${v.id}`)}
                  renaming={renamingId === v.id}
                  onRenameSubmit={(title) => submitRename({ ...v, title })}
                  onRenameCancel={() => setRenamingId(null)}
                  onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ kind: 'volume', x: e.clientX, y: e.clientY, node: v }); }}
                  onAddChapter={() => startNewChapter(v.id)}
                  onOpen={() => openDoc(v)}
                />

                {/* 章纲行：样式对齐目录的章节行；行内保留删除，其余走右键菜单 */}
                {open && (
                  <>
                    {kids.map(c => (
                      <ChapterRow key={c.id} node={c}
                        renaming={renamingId === c.id}
                        onRenameSubmit={(title) => submitRename({ ...c, title })}
                        onRenameCancel={() => setRenamingId(null)}
                        onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ kind: 'chapter', x: e.clientX, y: e.clientY, node: c }); }}
                        onDelete={() => {
                          if (confirm(`确认删除「${c.title}」？`)) run(() => deleteNode(bookId, c.id));
                        }}
                        onOpen={() => openDoc(c)}
                      />
                    ))}
                    {newChapter?.parentId === v.id && (
                      <div className="pl-16 pr-3 py-1 flex items-start gap-1">
                        <NumberTitleInput
                          kind="chapter"
                          number={newChapter.number}
                          title={newChapter.title}
                          onNumberChange={(n) => setNewChapter(d => d && { ...d, number: n })}
                          onTitleChange={(t) => setNewChapter(d => d && { ...d, title: t })}
                          className="flex-1 min-w-0"
                          onConfirm={confirmNewChapter}
                          onCancel={() => setNewChapter(null)}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== 右键菜单（与目录的分卷/章节菜单一致） ===================== */}
      {ctxMenu?.kind === 'volume' && (
        <OutlineVolumeContextMenu
          x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)}
          onNewChapter={() => startNewChapter(ctxMenu.node.id)}
          onGenerate={ctxMenu.node.syncState === 'pending'
            ? () => run(() => generateVolume(bookId, ctxMenu.node.id))
            : undefined}
          onRename={() => startRename(ctxMenu.node)}
          onDelete={() => {
            if (confirm(`确认删除「${ctxMenu.node.title}」及其下所有章纲？`)) {
              run(() => deleteNode(bookId, ctxMenu.node.id));
            }
          }}
        />
      )}
      {ctxMenu?.kind === 'chapter' && (
        <OutlineChapterContextMenu
          x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)}
          isSystem={ctxMenu.node.isSystem}
          onGenerate={ctxMenu.node.syncState === 'pending' && !ctxMenu.node.generatedChapterId
            ? () => run(() => generateChapter(bookId, ctxMenu.node.id))
            : undefined}
          onRename={() => startRename(ctxMenu.node)}
          onDelete={() => {
            if (confirm(`确认删除「${ctxMenu.node.title}」？`)) {
              run(() => deleteNode(bookId, ctxMenu.node.id));
            }
          }}
        />
      )}
    </div>
  );
}

/** 卷纲行 —— 类名与目录的分卷行保持一致；行内保留「新建章纲」，其余操作走右键菜单 */
function VolumeRow({ node, index, expanded, onToggle, renaming, onRenameSubmit, onRenameCancel, onContextMenu, onAddChapter, onOpen }: {
  node: OutlineNode; index: number; expanded: boolean;
  onToggle: () => void;
  renaming: boolean;
  onRenameSubmit: (title: string) => void;
  onRenameCancel: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onAddChapter: () => void;
  /** 在中间编辑器打开该卷纲 */
  onOpen: () => void;
}) {
  const [draft, setDraft] = useState(node.title);

  if (renaming) {
    return (
      <div className="w-full pl-10 pr-3 py-1.5 flex items-start gap-1.5" onContextMenu={onContextMenu}>
        <span className="mt-0.5 shrink-0">{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
        <InlineInput className="flex-1 min-w-0" placeholder="卷纲标题" value={draft} onChange={setDraft}
          onSubmit={() => onRenameSubmit(draft)} onCancel={onRenameCancel} />
      </div>
    );
  }

  return (
    <div data-outline-row="volume"
      className="w-full pl-10 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors group cursor-pointer"
      onClick={onToggle}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      title="点击展开/收起；双击在中间编辑器编辑内容">
      {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      <span className="truncate flex-1">第{index}卷 {node.title}</span>
      {/* 与目录的分卷行同位：hover 出「新建章纲」 */}
      <button data-role="add-chapter" onClick={(e: any) => { e.stopPropagation(); onAddChapter(); }}
        className="hidden group-hover:inline text-text-tertiary hover:text-text-primary text-xs" title="新建章纲">
        <FilePlus size={13} />
      </button>
      {/* 与「明细」入口并行：显式按钮打开中间编辑器，避免只能靠双击发现 */}
      <button data-role="open-doc" onClick={(e: any) => { e.stopPropagation(); onOpen(); }}
        className="hidden group-hover:inline text-text-tertiary hover:text-text-primary text-xs" title="编辑卷纲内容">
        <Edit3 size={13} />
      </button>
    </div>
  );
}

/** 章纲行 —— 类名与目录的章节行保持一致；行内保留「删除」，其余操作走右键菜单 */
function ChapterRow({ node, renaming, onRenameSubmit, onRenameCancel, onContextMenu, onDelete, onOpen }: {
  node: OutlineNode;
  renaming: boolean;
  onRenameSubmit: (title: string) => void;
  onRenameCancel: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDelete: () => void;
  /** 在中间编辑器打开该章纲 */
  onOpen: () => void;
}) {
  const [draft, setDraft] = useState(node.title);
  const stateUi = node.syncState ? STATE_UI[node.syncState] : null;

  if (renaming) {
    return (
      <div className="pl-16 pr-3 py-1 flex items-start gap-1" onContextMenu={onContextMenu}>
        <InlineInput className="flex-1 min-w-0" placeholder="章纲标题" value={draft} onChange={setDraft}
          onSubmit={() => onRenameSubmit(draft)} onCancel={onRenameCancel} />
      </div>
    );
  }

  return (
    <div data-outline-row="chapter"
      className="flex items-center gap-1 pl-16 pr-3 py-1 text-sm hover:bg-bg-hover text-text-secondary group cursor-pointer"
      onClick={onOpen}
      onContextMenu={onContextMenu}
      title="点击在中间编辑器里编辑章纲内容">
      <span className="truncate flex-1">
        {node.title}
        {node.isSystem && <span className="ml-1 text-xs text-text-tertiary">（卷纲）</span>}
      </span>
      {stateUi && <span className={`shrink-0 text-xs ${stateUi.className}`}
        title={node.syncState === 'changed' ? '章纲在生成正文后被修改过，正文不会自动更新' : undefined}>
        {stateUi.label}
      </span>}
      {/* 与目录的章节行同款删除按钮；系统条目（卷纲摘要）不提供 */}
      {!node.isSystem && (
        <button data-role="delete" onClick={(e: any) => { e.stopPropagation(); onDelete(); }}
          className="hidden group-hover:inline text-text-tertiary hover:text-error" title="删除章纲">✕</button>
      )}
    </div>
  );
}

/** 内联输入（新建/重命名共用） */
function InlineInput({ className, placeholder, value, onChange, onSubmit, onCancel }: {
  className?: string; placeholder: string; value: string;
  onChange: (v: string) => void; onSubmit: () => void; onCancel: () => void;
}) {
  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      <input autoFocus value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); if (value.trim()) onSubmit(); }
          if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        }}
        className="flex-1 min-w-0 px-1 py-0 text-sm border border-brand-primary rounded bg-bg-primary" />
      <button onClick={() => { if (value.trim()) onSubmit(); }} className="text-brand-primary shrink-0" title="确认">✓</button>
      <button onClick={onCancel} className="text-text-tertiary shrink-0" title="取消">✕</button>
    </div>
  );
}
