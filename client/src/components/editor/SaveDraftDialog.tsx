// 「未保存文本」的保存位置选择弹窗
//
// 新建文本还不属于书里任何位置，保存时要让用户选落到哪里：
//   · 目录 → 某个分卷 → 新章节（章号自动取该卷最大号 +1）
//   · 目录 → 分卷外章节（落到「默认」卷，没有则自动创建）
//   · 相关 → 细纲 → 新卷纲 / 新章纲（章纲需选所属卷纲）
//   · 相关 → 角色 → 某个角色的子项
//   · 相关 → 世界观 → 其他补充条目
import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '../../services/api.service';

export type SaveTargetKind =
  | 'chapter_in_volume'   // 某分卷下的新章节
  | 'chapter_default'     // 分卷外章节
  | 'outline_volume'      // 细纲 → 新卷纲
  | 'outline_chapter'     // 细纲 → 新章纲（需选所属卷纲）
  | 'character_section'   // 角色子项（需选角色）
  | 'world_setting';      // 世界观条目

interface Props {
  open: boolean;
  bookId: string;
  /** 草稿内容，保存时用 */
  content: string;
  onClose: () => void;
  /** 保存成功：回传新建目标，调用方据此把中间区域切过去 */
  onSaved: (info: {
    kind: SaveTargetKind; id: string; title: string; path: string[];
    /** 保存成章节时回传所属分卷与章号，便于直接打开该章节 */
    volumeId?: string;
    volumeTitle?: string;
    volumeNumber?: number;
    chapterNumber?: number;
    /** 保存成条目时回传条目类型，便于直接进条目编辑器 */
    docKind?: 'volume_outline' | 'chapter_outline' | 'character_section' | 'world_setting';
  }) => void;
}

const KIND_LABEL: Record<SaveTargetKind, string> = {
  chapter_in_volume: '某分卷下的新章节',
  chapter_default: '分卷外章节',
  outline_volume: '细纲 · 新卷纲',
  outline_chapter: '细纲 · 新章纲',
  character_section: '角色 · 子项',
  world_setting: '世界观 · 其他补充',
};

export default function SaveDraftDialog({ open, bookId, content, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [volumes, setVolumes] = useState<any[]>([]);
  const [chaptersByVolume, setChaptersByVolume] = useState<Record<string, any[]>>({});
  const [volumeOutlines, setVolumeOutlines] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [bookTitle, setBookTitle] = useState('');

  const [kind, setKind] = useState<SaveTargetKind>('chapter_in_volume');
  const [volumeId, setVolumeId] = useState<string>('');
  const [parentOutlineId, setParentOutlineId] = useState<string>('');
  const [characterId, setCharacterId] = useState<string>('');
  const [title, setTitle] = useState('');

  // 打开时拉取可选的落点
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const [volRes, charRes, outlineRes, bookRes] = await Promise.all([
          apiClient.get(`/books/${bookId}/volumes`),
          apiClient.get(`/books/${bookId}/characters`),
          apiClient.get(`/books/${bookId}/outlines`),
          apiClient.get(`/books/${bookId}`),
        ]);
        if (cancelled) return;
        const vols: any[] = volRes.data.data || [];
        setVolumes(vols);
        setCharacters(charRes.data.data || []);
        setVolumeOutlines((outlineRes.data.data?.volumes || []));
        setBookTitle(bookRes.data.data?.title || '');

        // 章节数按卷拉取（用于算新章号）
        const map: Record<string, any[]> = {};
        for (const v of vols) {
          const r = await apiClient.get(`/volumes/${v.id}/chapters`);
          map[v.id] = r.data.data || [];
        }
        if (cancelled) return;
        setChaptersByVolume(map);

        // 默认选中：第一个非「默认」分卷
        const firstVol = vols.find((v) => v.title !== '默认') || vols[0];
        setVolumeId(firstVol?.id || '');
        setParentOutlineId('');
        setCharacterId((charRes.data.data || [])[0]?.id || '');
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error?.message || e?.message || '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, bookId]);

  /** 默认卷（分卷外章节的归属卷） */
  const defaultVolume = useMemo(() => volumes.find((v) => v.title === '默认'), [volumes]);

  const nextChapterNumber = (vid: string) => {
    const list = chaptersByVolume[vid] || [];
    return list.length ? Math.max(...list.map((c) => c.chapterNumber || 0)) + 1 : 1;
  };

  // 落点变化时给出默认命名（用户可改）
  useEffect(() => {
    if (!open) return;
    if (kind === 'chapter_in_volume' && volumeId) setTitle(`第${nextChapterNumber(volumeId)}章 新章节`);
    else if (kind === 'chapter_default') setTitle(`第${nextChapterNumber(defaultVolume?.id || '')}章 新章节`);
    else if (kind === 'outline_volume') setTitle(`卷纲${volumeOutlines.length + 1}`);
    else if (kind === 'outline_chapter') setTitle(`第${(chaptersByVolume[volumeId] || []).length + 1}章 章纲`);
    else if (kind === 'character_section') setTitle('子项');
    else if (kind === 'world_setting') setTitle('其他补充');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, volumeId, parentOutlineId, characterId, open, volumes.length, volumeOutlines.length]);

  if (!open) return null;

  const canSave = !!title.trim() && !saving && (
    kind === 'chapter_default' ? true
      : kind === 'chapter_in_volume' ? !!volumeId
      : kind === 'outline_volume' ? true
      : kind === 'outline_chapter' ? !!parentOutlineId
      : kind === 'character_section' ? !!characterId
      : true
  );

  /** 分卷外章节需要一个归属卷；没有「默认」卷时自动建一个 */
  const ensureDefaultVolume = async (): Promise<string> => {
    if (defaultVolume) return defaultVolume.id;
    const res = await apiClient.post(`/books/${bookId}/volumes`, { title: '默认', volumeNumber: 0 });
    return res.data.data.id;
  };

  const doSave = async () => {
    setSaving(true); setError(null);
    try {
      const t = title.trim();
      if (kind === 'chapter_in_volume' || kind === 'chapter_default') {
        const vid = kind === 'chapter_default' ? await ensureDefaultVolume() : volumeId;
        const num = nextChapterNumber(vid);
        const res = await apiClient.post(`/volumes/${vid}/chapters`, {
          title: t, chapterNumber: num, content,
        });
        const vol = volumes.find((v) => v.id === vid);
        const path = [
          ...(bookTitle ? [bookTitle] : []), '目录',
          ...(vol && vol.title !== '默认' ? [`第${vol.volumeNumber}卷 ${vol.title}`] : []),
          `第${num}章 ${res.data.data.title}`,
        ];
        onSaved({
          kind, id: res.data.data.id, title: res.data.data.title, path,
          volumeId: vid, chapterNumber: num,
          volumeTitle: vol?.title, volumeNumber: vol?.volumeNumber,
        });
      } else if (kind === 'outline_volume') {
        const res = await apiClient.post(`/books/${bookId}/outlines`, { level: 'volume_outline', title: t, content });
        onSaved({
          kind, id: res.data.data.id, title: t, docKind: 'volume_outline',
          path: [...(bookTitle ? [bookTitle] : []), '细纲', t],
        });
      } else if (kind === 'outline_chapter') {
        const res = await apiClient.post(`/books/${bookId}/outlines`, {
          level: 'chapter_outline', title: t, content, parentId: parentOutlineId,
        });
        onSaved({
          kind, id: res.data.data.id, title: t, docKind: 'chapter_outline',
          path: [...(bookTitle ? [bookTitle] : []), '细纲', t],
        });
      } else if (kind === 'character_section') {
        const res = await apiClient.post(`/books/${bookId}/characters/${characterId}/sections`, { title: t, content });
        const ch = characters.find((c) => c.id === characterId);
        onSaved({
          kind, id: res.data.data.id, title: t, docKind: 'character_section',
          path: [...(bookTitle ? [bookTitle] : []), '角色', ch ? `${ch.name} · ${t}` : t],
        });
      } else {
        const res = await apiClient.post(`/books/${bookId}/world-settings`, { category: 'other', title: t, content });
        onSaved({
          kind, id: res.data.data.id, title: t, docKind: 'world_setting',
          path: [...(bookTitle ? [bookTitle] : []), '世界观', t],
        });
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  /** 分卷外章节需要一个归属卷；没有「默认」卷时自动建一个 */

  const KINDS: SaveTargetKind[] = [
    'chapter_in_volume', 'chapter_default', 'outline_volume',
    'outline_chapter', 'character_section', 'world_setting',
  ];

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div data-role="save-draft-dialog"
        className="bg-bg-primary rounded-lg shadow-xl w-[30rem] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <h3 className="font-semibold text-sm">保存到</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          {loading && <div className="text-text-tertiary">加载可保存的位置…</div>}
          {error && <div className="text-error">{error}</div>}

          {/* 落点类型 */}
          <div>
            <div className="text-text-tertiary mb-1.5">保存到哪一类位置</div>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button key={k} data-role={`target-${k}`}
                  onClick={() => setKind(k)}
                  className={`px-2 py-1 rounded border transition-colors ${kind === k
                    ? 'border-brand-primary text-brand-primary bg-bg-active'
                    : 'border-border-primary text-text-secondary hover:bg-bg-hover'}`}>
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          {/* 具体位置 */}
          {kind === 'chapter_in_volume' && (
            <label className="block">
              <span className="text-text-tertiary">选择分卷</span>
              <select data-role="pick-volume" value={volumeId} onChange={(e) => setVolumeId(e.target.value)}
                className="mt-1 w-full p-1.5 border border-border-primary rounded bg-bg-primary">
                {volumes.filter((v) => v.title !== '默认').map((v) => (
                  <option key={v.id} value={v.id}>第{v.volumeNumber}卷 {v.title}</option>
                ))}
                {!volumes.filter((v) => v.title !== '默认').length && <option value="">（暂无分卷）</option>}
              </select>
            </label>
          )}

          {kind === 'chapter_default' && (
            <div className="text-text-tertiary">
              将作为「分卷外章节」保存{defaultVolume ? '' : '（会自动创建「默认」卷）'}。
            </div>
          )}

          {kind === 'outline_chapter' && (
            <label className="block">
              <span className="text-text-tertiary">选择所属卷纲</span>
              <select data-role="pick-parent-outline" value={parentOutlineId} onChange={(e) => setParentOutlineId(e.target.value)}
                className="mt-1 w-full p-1.5 border border-border-primary rounded bg-bg-primary">
                <option value="">请选择…</option>
                {volumeOutlines.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
              </select>
            </label>
          )}

          {kind === 'character_section' && (
            <label className="block">
              <span className="text-text-tertiary">选择角色</span>
              <select data-role="pick-character" value={characterId} onChange={(e) => setCharacterId(e.target.value)}
                className="mt-1 w-full p-1.5 border border-border-primary rounded bg-bg-primary">
                {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                {!characters.length && <option value="">（暂无角色）</option>}
              </select>
            </label>
          )}

          {/* 名称 */}
          <label className="block">
            <span className="text-text-tertiary">名称</span>
            <input data-role="draft-title" value={title} onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full p-1.5 border border-border-primary rounded bg-bg-primary" />
          </label>

          <div className="text-text-tertiary">
            内容 {content.replace(/\s/g, '').length} 字，将随本次保存一并写入。
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-primary">
          <button onClick={onClose} className="px-3 py-1 text-xs text-text-tertiary hover:text-text-primary">取消</button>
          <button data-role="confirm-save-draft" onClick={doSave} disabled={!canSave}
            className="px-3 py-1 text-xs bg-brand-primary text-brand-text rounded disabled:opacity-50">
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
