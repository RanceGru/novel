// 「未保存文本」的保存位置选择 — 布局对齐 Windows「另存为」
//
// 结构：
//   顶部  ：「位置」面包屑，显示当前所在层级（可逐级点回，↑ 回上一层）
//   左侧  ：当前位置下的可选项（文件夹式，点进去下钻；可保存的项为「新建…」）
//   右侧  ：内容预览
//   底部  ：「文件名」输入框 + 保存 / 取消
//
// 层级：作品（列全部作品供选）→ 目录/相关 → 分卷或分区 → …（新章节/卷纲/章纲/子项/条目）
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight, X, Folder, FolderOpen, FileText, ArrowUp,
  BookOpen, Users, Globe, Layers, ListTree,
} from 'lucide-react';
import { apiClient } from '../../services/api.service';
import { useProjectStore } from '../../stores/project.store';

/** 当前浏览位置：一组面包屑，最后一项代表所处节点 */
interface Crumb { key: string; label: string; icon?: any; bookId?: string; }

/** 保存动作的返回值：新建对象的位置与身份 */
interface CreatedInfo {
  path: string[];
  id: string;
  /** 落在了哪本书里（作品在弹窗内选择，调用方需要它来打开章节） */
  bookId: string;
  volumeId?: string; volumeTitle?: string; volumeNumber?: number; chapterNumber?: number;
  docKind?: 'volume_outline' | 'chapter_outline' | 'character_section' | 'world_setting';
}

/** 列表里的一项 */
interface Row {
  key: string;
  label: string;
  /** folder = 可进去下钻；target = 可保存到这里（新建一个对象）；disabled = 仅展示 */
  kind: 'folder' | 'target' | 'disabled';
  detail?: string;
  icon?: any;
  onEnter?: () => void;
  /** 保存到该项时执行的创建动作 */
  create?: (title: string, content: string) => Promise<CreatedInfo>;
  /** 选中该项时的默认文件名 */
  defaultName?: string;
}

interface Props {
  open: boolean;
  /** 草稿内容，保存时用 */
  content: string;
  onClose: () => void;
  onSaved: (info: {
    path: string[]; title: string; id: string; bookId: string;
    volumeId?: string; volumeTitle?: string; volumeNumber?: number; chapterNumber?: number;
    docKind?: 'volume_outline' | 'chapter_outline' | 'character_section' | 'world_setting';
  }) => void;
}

/** 最上层：列出所有作品供选 */
const ROOT: Crumb = { key: 'root', label: '作品', icon: BookOpen };

export default function SaveDraftDialog({ open, content, onClose, onSaved }: Props) {
  const allBooks = useProjectStore((s) => s.books);
  const [stack, setStack] = useState<Crumb[]>([ROOT]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  const [volumes, setVolumes] = useState<any[]>([]);
  const [chaptersByVolume, setChaptersByVolume] = useState<Record<string, any[]>>({});
  const [volumeOutlines, setVolumeOutlines] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [loadingBook, setLoadingBook] = useState(false);

  const [row, setRow] = useState<Row | null>(null);   // 选中的目标项
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = stack[stack.length - 1];
  const atBooks = stack.length === 1;                       // 最上层：列作品
  const bookId = current.bookId || null;
  const bookTitle = stack.find((c) => c.bookId)?.label
    || allBooks.find((b) => b.id === selectedBookId)?.title || '';

  // 打开时回到最上层（列作品），清空上一次的选择
  useEffect(() => {
    if (!open) return;
    setStack([ROOT]);
    setSelectedBookId(null);
    setRow(null); setName(''); setError(null);
  }, [open]);

  /** 选定作品后加载它的目录/角色/细纲结构 */
  const loadBook = useCallback(async (bid: string) => {
    setLoadingBook(true);
    try {
      const [volRes, charRes, outlineRes] = await Promise.all([
        apiClient.get(`/books/${bid}/volumes`),
        apiClient.get(`/books/${bid}/characters`),
        apiClient.get(`/books/${bid}/outlines`),
      ]);
      const vols: any[] = volRes.data.data || [];
      setVolumes(vols);
      setCharacters(charRes.data.data || []);
      setVolumeOutlines(outlineRes.data.data?.volumes || []);
      const map: Record<string, any[]> = {};
      for (const v of vols) {
        const r = await apiClient.get(`/volumes/${v.id}/chapters`);
        map[v.id] = r.data.data || [];
      }
      setChaptersByVolume(map);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || '加载失败');
    } finally {
      setLoadingBook(false);
    }
  }, []);

  const defaultVolume = useMemo(() => volumes.find((v) => v.title === '默认'), [volumes]);
  const normalVolumes = useMemo(() => volumes.filter((v) => v.title !== '默认'), [volumes]);
  const nextChapterNumber = useCallback((vid: string) => {
    const list = chaptersByVolume[vid] || [];
    return list.length ? Math.max(...list.map((c) => c.chapterNumber || 0)) + 1 : 1;
  }, [chaptersByVolume]);

  const enter = (crumb: Crumb) => { setStack((s) => [...s, crumb]); setRow(null); };
  const goTo = (idx: number) => { setStack((s) => s.slice(0, idx + 1)); setRow(null); };
  const goUp = () => { if (stack.length > 1) { setStack((s) => s.slice(0, -1)); setRow(null); } };

  // ===== 当前位置下的列表 =====
  const rows: Row[] = useMemo(() => {
    if (!open) return [];
    const list: Row[] = [];

    // 最上层：列出所有作品
    if (atBooks) {
      for (const b of allBooks) {
        list.push({
          key: `book:${b.id}`, label: b.title, kind: 'folder',
          detail: `${(b.wordCount || 0).toLocaleString()} 字`,
          icon: BookOpen,
          onEnter: () => {
            setSelectedBookId(b.id);
            loadBook(b.id);
            enter({ key: `book:${b.id}`, label: b.title, icon: BookOpen, bookId: b.id });
          },
        });
      }
      if (!allBooks.length) list.push({ key: 'no-book', label: '（还没有作品，请先在左侧新建作品）', kind: 'disabled', icon: FileText });
      return list;
    }

    if (!bookId) return list;

    // 作品下：目录 / 相关
    if (current.key.startsWith('book:')) {
      list.push({
        key: 'toc', label: '目录', kind: 'folder',
        detail: `${normalVolumes.length} 个分卷`,
        icon: ListTree,
        onEnter: () => enter({ key: 'toc', label: '目录', icon: ListTree, bookId }),
      });
      list.push({
        key: 'related', label: '相关', kind: 'folder',
        detail: `细纲 ${volumeOutlines.length} · 角色 ${characters.length} · 世界观`,
        icon: Layers,
        onEnter: () => enter({ key: 'related', label: '相关', icon: Layers, bookId }),
      });
      return list;
    }

    if (current.key === 'toc') {
      // 各分卷 + 分卷外章节
      for (const v of normalVolumes) {
        list.push({
          key: `vol:${v.id}`, label: `第${v.volumeNumber}卷 ${v.title}`, kind: 'folder',
          detail: `${(chaptersByVolume[v.id] || []).length} 章`,
          icon: Folder,
          onEnter: () => enter({ key: `vol:${v.id}`, label: `第${v.volumeNumber}卷 ${v.title}`, icon: FolderOpen, bookId }),
        });
      }
      list.push({
        key: 'default-vol', label: '分卷外章节', kind: 'folder',
        detail: defaultVolume ? `${(chaptersByVolume[defaultVolume.id] || []).length} 章` : '（保存时自动创建「默认」卷）',
        icon: Folder,
        onEnter: () => enter({ key: 'default-vol', label: '分卷外章节', icon: FolderOpen, bookId }),
      });
      return list;
    }

    if (current.key === 'related') {
      list.push({
        key: 'outline', label: '细纲', kind: 'folder',
        detail: `卷纲 ${volumeOutlines.length}`,
        icon: Folder,
        onEnter: () => enter({ key: 'outline', label: '细纲', icon: FolderOpen, bookId }),
      });
      list.push({
        key: 'characters', label: '角色', kind: 'folder',
        detail: `${characters.length} 个角色`,
        icon: Users,
        onEnter: () => enter({ key: 'characters', label: '角色', icon: FolderOpen, bookId }),
      });
      list.push({
        key: 'world', label: '世界观', kind: 'folder',
        detail: '固定条目 + 其他补充',
        icon: Globe,
        onEnter: () => enter({ key: 'world', label: '世界观', icon: FolderOpen, bookId }),
      });
      return list;
    }

    if (current.key === 'outline') {
      list.push({
        key: 'new-volume-outline', label: '新建卷纲', kind: 'target',
        detail: '在细纲下新增一个卷纲', icon: FileText,
        defaultName: `卷纲${volumeOutlines.length + 1}`,
        create: async (title, body) => {
          const res = await apiClient.post(`/books/${bookId}/outlines`, { level: 'volume_outline', title, content: body });
          return { bookId, path: [bookTitle, '细纲', title], docKind: 'volume_outline', id: res.data.data.id };
        },
      });
      for (const v of volumeOutlines) {
        list.push({
          key: `ol:${v.id}`, label: v.title, kind: 'folder',
          detail: '进去可新建章纲', icon: Folder,
          onEnter: () => enter({ key: `ol:${v.id}`, label: v.title, icon: FolderOpen, bookId }),
        });
      }
      return list;
    }

    // 细纲 → 某个卷纲：新建章纲
    if (current.key.startsWith('ol:')) {
      const parentId = current.key.slice(3);
      const n = (chaptersByVolume[parentId] || []).length + 1;
      list.push({
        key: 'new-chapter-outline', label: '新建章纲', kind: 'target',
        detail: `归到「${current.label}」下`, icon: FileText,
        defaultName: `第${n}章 章纲`,
        create: async (title, body) => {
          const res = await apiClient.post(`/books/${bookId}/outlines`, {
            level: 'chapter_outline', title, content: body, parentId,
          });
          return { bookId, path: [bookTitle, '细纲', current.label, title], docKind: 'chapter_outline', id: res.data.data.id };
        },
      });
      return list;
    }

    // 角色 → 某角色：新建子项
    if (current.key.startsWith('char:')) {
      const cid = current.key.slice(5);
      list.push({
        key: 'new-section', label: '新建子项', kind: 'target',
        detail: `归到「${current.label}」下`, icon: FileText,
        defaultName: '子项',
        create: async (title, body) => {
          const res = await apiClient.post(`/books/${bookId}/characters/${cid}/sections`, { title, content: body });
          return { bookId, path: [bookTitle, '角色', `${current.label} · ${title}`], docKind: 'character_section', id: res.data.data.id };
        },
      });
      return list;
    }

    // 世界观 → 新建其他补充条目
    if (current.key === 'world') {
      list.push({
        key: 'new-world', label: '新建其他补充', kind: 'target',
        detail: '在世界观下新增一条', icon: FileText,
        defaultName: '其他补充',
        create: async (title, body) => {
          const res = await apiClient.post(`/books/${bookId}/world-settings`, { category: 'other', title, content: body });
          return { bookId, path: [bookTitle, '世界观', title], docKind: 'world_setting', id: res.data.data.id };
        },
      });
      return list;
    }

    // 目录 → 某个分卷：新建章节（并列列出已有章节，仅展示）
    if (current.key.startsWith('vol:')) {
      const vid = current.key.slice(4);
      const vol = volumes.find((v) => v.id === vid);
      const num = nextChapterNumber(vid);
      list.push({
        key: 'new-chapter', label: '新建章节', kind: 'target',
        detail: `将创建为第${num}章`, icon: FileText,
        defaultName: `第${num}章 新章节`,
        create: async (title, body) => {
          const res = await apiClient.post(`/volumes/${vid}/chapters`, { title, chapterNumber: num, content: body });
          return {
            bookId,
            path: [bookTitle, '目录', `第${vol?.volumeNumber}卷 ${vol?.title}`, `第${num}章 ${res.data.data.title}`],
            volumeId: vid, volumeTitle: vol?.title, volumeNumber: vol?.volumeNumber,
            chapterNumber: num, id: res.data.data.id,
          };
        },
      });
      for (const c of chaptersByVolume[vid] || []) {
        list.push({ key: `ch:${c.id}`, label: `第${c.chapterNumber}章 ${c.title}`, kind: 'disabled', detail: '已有章节', icon: FileText });
      }
      return list;
    }

    // 目录 → 分卷外章节
    if (current.key === 'default-vol') {
      const num = nextChapterNumber(defaultVolume?.id || '');
      list.push({
        key: 'new-default-chapter', label: '新建章节', kind: 'target',
        detail: `将创建为第${num}章（分卷外）`, icon: FileText,
        defaultName: `第${num}章 新章节`,
        create: async (title, body) => {
          let vid = defaultVolume?.id;
          if (!vid) {
            const r = await apiClient.post(`/books/${bookId}/volumes`, { title: '默认', volumeNumber: 0 });
            vid = r.data.data.id;
          }
          const res = await apiClient.post(`/volumes/${vid}/chapters`, { title, chapterNumber: num, content: body });
          return {
            bookId,
            path: [bookTitle, '目录', `第${num}章 ${res.data.data.title}`],
            volumeId: vid, volumeTitle: '默认', volumeNumber: 0,
            chapterNumber: num, id: res.data.data.id,
          };
        },
      });
      for (const c of (defaultVolume ? chaptersByVolume[defaultVolume.id] : []) || []) {
        list.push({ key: `dch:${c.id}`, label: `第${c.chapterNumber}章 ${c.title}`, kind: 'disabled', detail: '已有章节', icon: FileText });
      }
      return list;
    }

    // 角色列表
    if (current.key === 'characters') {
      for (const c of characters) {
        list.push({
          key: `char:${c.id}`, label: c.name, kind: 'folder',
          detail: '进去可新建子项', icon: Folder,
          onEnter: () => enter({ key: `char:${c.id}`, label: c.name, icon: FolderOpen, bookId }),
        });
      }
      if (!characters.length) list.push({ key: 'no-char', label: '（还没有角色）', kind: 'disabled', icon: FileText });
      return list;
    }

    return list;
  }, [open, atBooks, current, allBooks, bookId, bookTitle, volumes, normalVolumes, defaultVolume,
      chaptersByVolume, volumeOutlines, characters, loadBook, nextChapterNumber]);

  // 选中目标项后设置默认文件名
  useEffect(() => {
    if (row?.kind === 'target') setName(row.defaultName || '');
  }, [row]);

  if (!open) return null;

  const canSave = !!row && row.kind === 'target' && !!name.trim() && !busy;

  const doSave = async () => {
    if (!row?.create) return;
    setBusy(true); setError(null);
    try {
      const info = await row.create(name.trim(), content);
      onSaved({
        path: info.path, title: name.trim(), id: info.id, bookId: info.bookId,
        volumeId: info.volumeId, volumeTitle: info.volumeTitle, volumeNumber: info.volumeNumber,
        chapterNumber: info.chapterNumber, docKind: info.docKind,
      });
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const charCount = content.replace(/\s/g, '').length;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div data-role="save-draft-dialog"
        className="bg-bg-primary rounded-lg shadow-xl w-[46rem] max-w-[95vw] h-[34rem] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        {/* 标题 */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary shrink-0">
          <h3 className="font-semibold text-sm">保存到</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        {/* 位置面包屑（可逐级点回；↑ 回上一层） */}
        <div className="flex items-center gap-1 px-4 py-2 text-xs border-b border-border-primary shrink-0">
          <button data-role="crumb-up" onClick={goUp} disabled={atBooks}
            className="p-1 rounded hover:bg-bg-hover disabled:opacity-30 shrink-0" title="上一层">
            <ArrowUp size={13} />
          </button>
          <span className="text-text-tertiary shrink-0">位置：</span>
          <nav data-role="save-crumbs" className="flex items-center gap-0.5 min-w-0 flex-wrap">
            {stack.length > 1 ? (
              stack.map((c, i) => (
                <span key={c.key} className="flex items-center gap-0.5 min-w-0">
                  {i > 0 && <ChevronRight size={11} className="shrink-0 opacity-60" />}
                  <button data-role={`crumb-${i}`} onClick={() => goTo(i)}
                    className={`truncate max-w-[10rem] px-1 rounded hover:bg-bg-hover ${i === stack.length - 1 ? 'text-text-primary' : 'text-text-secondary'}`}>
                    {c.label}
                  </button>
                </span>
              ))
            ) : (
              <span data-role="crumb-root" className="text-text-secondary">（请选择作品）</span>
            )}
          </nav>
        </div>

        {/* 列表 + 预览 */}
        <div className="flex-1 flex min-h-0">
          <div data-role="save-rows" className="flex-1 overflow-y-auto border-r border-border-primary">
            {loadingBook && <div className="px-4 py-2 text-xs text-text-tertiary">加载中…</div>}
            {rows.map((r) => {
              const Icon = r.icon || FileText;
              const selected = row?.key === r.key;
              const clickable = r.kind !== 'disabled';
              // 用 div 而不是 button：列表行内还有「进入 ›」这类文本，
              // 且整块对话框不应出现 button 嵌套 button（会导致点击行为异常）
              return (
                <div key={r.key}
                  data-role={`save-row-${r.key}`}
                  data-row-kind={r.kind}
                  aria-disabled={!clickable}
                  onDoubleClick={() => { if (r.kind === 'folder') r.onEnter?.(); }}
                  onClick={() => {
                    if (!clickable) return;
                    if (r.kind === 'folder') { r.onEnter?.(); return; }   // 文件夹：进入下一级
                    setRow(r);                                            // 可保存项：选中
                  }}
                  className={`w-full text-left px-4 py-1.5 flex items-center gap-2 text-xs transition-colors
                    ${!clickable ? 'opacity-45 cursor-default' : 'cursor-pointer hover:bg-bg-hover'}
                    ${selected ? 'bg-bg-active text-brand-primary' : 'text-text-secondary'}`}>
                  <Icon size={14} className="shrink-0 text-text-tertiary" />
                  <span className="truncate">{r.label}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-text-tertiary">{r.detail || ''}</span>
                  {r.kind === 'folder' && (
                    <span data-role="row-enter" className="shrink-0 text-[10px] text-text-tertiary">进入 ›</span>
                  )}
                </div>
              );
            })}
            {!rows.length && !loadingBook && <div className="px-4 py-3 text-xs text-text-tertiary">这里没有可保存的位置</div>}
          </div>

          {/* 预览 */}
          <div className="w-52 shrink-0 p-3 hidden md:block">
            <div className="text-[10px] text-text-tertiary mb-1">内容预览</div>
            <div className="text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
              {content.trim() ? content.slice(0, 400) : '（暂无内容）'}
            </div>
            <div className="text-[10px] text-text-tertiary mt-2">{charCount} 字</div>
          </div>
        </div>

        {/* 底部：文件名 + 保存/取消 */}
        <div className="px-4 py-2 border-t border-border-primary shrink-0">
          {error && <div className="text-error text-xs mb-1.5">{error}</div>}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary shrink-0">文件名：</span>
            <input data-role="draft-title" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSave) doSave(); }}
              disabled={row?.kind !== 'target'}
              placeholder={row?.kind === 'target' ? '输入名称' : '请先在上方选择要保存到的位置'}
              className="flex-1 min-w-0 px-2 py-1 text-xs border border-border-primary rounded bg-bg-primary disabled:opacity-60" />
            <button data-role="confirm-save-draft" onClick={doSave} disabled={!canSave}
              className="px-4 py-1 text-xs bg-brand-primary text-brand-text rounded disabled:opacity-50">
              {busy ? '保存中…' : '保存'}
            </button>
            <button onClick={onClose} className="px-4 py-1 text-xs border border-border-primary rounded text-text-secondary hover:bg-bg-hover">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
