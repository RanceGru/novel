// 左侧边栏 — 写作台导航
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { useProjectStore } from '../../stores/project.store';
import { useEditorStore } from '../../stores/editor.store';
import { apiClient } from '../../services/api.service';
import { FileText, Plus, ChevronRight, ChevronDown, Settings, FolderPlus, FilePlus, Search, Library } from 'lucide-react';
import OutlineTree from '../outline/OutlineTree';
import CharacterList from '../characters/CharacterList';
import WorldSettingList from '../worldbuilding/WorldSettingList';
import RelatedTab from './RelatedTab';
import SettingsDialog from './SettingsDialog';
import SearchDialog from './SearchDialog';
import BookCreateDialog from './BookCreateDialog';
import BookContextMenu from './BookContextMenu';
import VolumeContextMenu from './VolumeContextMenu';
import ChapterContextMenu from './ChapterContextMenu';
import BookExportDialog from './BookExportDialog';
import BookDetailDialog from './BookDetailDialog';

export default function LeftSidebar() {
  const { books, setBooks, volumes, setVolumes, chapters, setChapters, currentBook, setCurrentBook, loading, setLoading } =
    useProjectStore();
  const { setCurrentChapter } = useEditorStore();
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const [expandedVolume, setExpandedVolume] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNewBook, setShowNewBook] = useState(false);
  const [bookTab, setBookTab] = useState<Record<string, 'toc' | 'related' | null>>({});
  // 右键菜单
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; book: any } | null>(null);
  const [editBook, setEditBook] = useState<any>(null);
  const [exportBook, setExportBook] = useState<any>(null);
  const [detailBook, setDetailBook] = useState<any>(null);
  const [deleteBook, setDeleteBook] = useState<any>(null);
  const [volCtxMenu, setVolCtxMenu] = useState<{ x: number; y: number; volume: any } | null>(null);
  const [chCtxMenu, setChCtxMenu] = useState<{ x: number; y: number; chapter: any; volumeId: string } | null>(null);
  const [batchVolumeId, setBatchVolumeId] = useState<string | null>(null);
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [activeBookForAdd, setActiveBookForAdd] = useState<any>(null);
  const [defaultChapters, setDefaultChapters] = useState<any[]>([]);
  const [renamingChapter, setRenamingChapterState] = useState<string | null>(null);
  const [renameChapterValue, setRenameChapterValue] = useState('');
  const setRenamingChapter = (id: string | null, title?: string) => { setRenamingChapterState(id); if (title) setRenameChapterValue(title); };
  const [renamingVolume, setRenamingVolume] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renamingRef = useRef<string | null>(null);
  const blurTimeRef = useRef(0);
  const setRenaming = (id: string | null) => { renamingRef.current = id; setRenamingVolume(id); };

  // 加载书籍列表
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useEffect(() => {
    if (!isAuthenticated) return;
    const loadBooks = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get('/books');
        if (res.data?.data) setBooks(res.data.data);
      } catch (err) {
        console.error('加载书籍失败, 1秒后重试:', err);
        setTimeout(() => loadBooks(), 1000);
      }
      setLoading(false);
    };
    loadBooks();
  }, [isAuthenticated]);

  // 展开书籍 → 加载卷
  const handleExpandBook = async (bookId: string) => {
    // 点击书名切换展开/收起
    if (expandedBook === bookId) {
      setExpandedBook(null);
      setBookTab(prev => { const n = { ...prev }; delete n[bookId]; return n; });
      return;
    }
    setExpandedBook(bookId);
    const book = books.find((b) => b.id === bookId);
    if (book) setCurrentBook(book);

    try {
      const res = await apiClient.get(`/books/${bookId}/volumes`);
      setVolumes(res.data.data);
      // 加载默认分卷的章节
      const defaultVol = res.data.data.find((v: any) => v.title === '默认');
      if (defaultVol) {
        const chRes = await apiClient.get(`/volumes/${defaultVol.id}/chapters`);
        setDefaultChapters(chRes.data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 展开卷 → 加载章节
  const handleExpandVolume = async (volumeId: string) => {
    if (expandedVolume === volumeId) {
      setExpandedVolume(null);
      return;
    }
    setExpandedVolume(volumeId);

    try {
      const res = await apiClient.get(`/volumes/${volumeId}/chapters`);
      setChapters(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  // 选择章节
  const handleSelectChapter = async (chapterId: string, bookId: string, volumeId: string) => {
    setCurrentChapter(bookId, volumeId, chapterId);
    try {
      const res = await apiClient.get(`/volumes/${volumeId}/chapters/${chapterId}`);
      const chapter = res.data.data;
      useEditorStore.getState().setContent(chapter.content || '');
      useEditorStore.getState().setChapterOutline(chapter.chapterOutline || '');
      useEditorStore.getState().setInstruction(chapter.instruction || '');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <aside className="w-80 bg-bg-secondary border-r border-border-primary flex flex-col shrink-0 h-full">
      {/* 功能区 — 4 */}
      <div className="flex-[4] flex flex-col overflow-hidden border-b border-border-primary">
        <div className="p-3 text-sm font-semibold text-text-primary">功能区</div>
        <div className="px-3 pb-3 space-y-2">
          <button onClick={() => setShowSearch(true)}
            className="w-full px-3 py-1.5 text-xs border border-border-primary rounded bg-bg-primary text-text-secondary hover:bg-bg-hover transition-colors flex items-center gap-2">
            <Search size={14} className="text-text-tertiary" /> 搜索...
          </button>
          <button onClick={() => setShowNewBook(true)}
            className="w-full px-3 py-2 text-xs bg-bg-primary text-text-primary border border-border-primary rounded hover:bg-bg-hover transition-colors flex items-center gap-2">
            <Library size={16} /> 新建作品
          </button>
        </div>

        <BookCreateDialog open={showNewBook} onClose={() => setShowNewBook(false)}
          onCreated={(newBook) => setBooks([newBook, ...books])}
          bookCount={books.length}
          existingTitles={books.map(b => b.title)} />
      </div>

      {/* 写作台 — 6 */}
      <div className="flex-[6] flex flex-col overflow-hidden">
        <div className="p-3 text-sm font-semibold text-text-primary">写作区</div>
        {loading && <div className="px-3 py-2 text-xs text-text-tertiary">加载中...</div>}
        <nav className="flex-1 overflow-y-auto">
        {books.map((book) => (
          <div key={book.id}>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors"
              onClick={() => handleExpandBook(book.id)}
              onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, book }); }}
            >
              {expandedBook === book.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <div className="w-7 h-9 rounded overflow-hidden shrink-0 bg-bg-tertiary border border-border-primary">
                <img src={book.coverUrl || '/default_cover.png'} alt="" className="w-full h-full object-cover" />
              </div>
              <span className="truncate flex-1">{book.title}</span>
              <span className="text-xs text-text-tertiary">{book.wordCount.toLocaleString()}字</span>
            </button>

            {/* 下拉按钮：相关 */}
            {expandedBook === book.id && (
              <div className="flex flex-col">
                <div
                  onClick={() => {
                    setBookTab(prev => ({ ...prev, [book.id]: prev[book.id] === 'related' ? null : 'related' }));
                    setExpandedVolume(null);
                    setCurrentBook(book);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors">
                  {bookTab[book.id] === 'related' ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronRight size={14} className="text-text-tertiary" />}
                  <span className="text-text-secondary">相关</span>
                </div>
                {/* 相关内容 */}
                {bookTab[book.id] === 'related' && (
                  <div className="py-1">
                    <RelatedTab bookId={book.id} />
                  </div>
                )}
              </div>
            )}

            {/* 下拉按钮：目录 */}
            {expandedBook === book.id && (
              <div className="flex flex-col">
                <div
                  onClick={() => {
                    if (expandedBook !== book.id) setExpandedBook(book.id);
                    setBookTab(prev => ({ ...prev, [book.id]: prev[book.id] === 'toc' ? null : 'toc' }));
                  }}
                  className="w-full pl-8 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors group cursor-pointer">
                  {bookTab[book.id] === 'toc' ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronRight size={14} className="text-text-tertiary" />}
                  <span className="text-text-secondary flex-1">目录</span>
                  <button
                    onClick={async (e) => { e.stopPropagation();
                      console.log('📁+ clicked');
                      const vn = volumes.filter(v => v.bookId === book.id && v.title !== '默认').length + 1;
                      const title = `分卷${vn}`;
                      const res = await apiClient.post(`/books/${book.id}/volumes`, { title, volumeNumber: vn });
                      console.log('volume created:', res.data.data.id);
                      apiClient.get(`/books/${book.id}/volumes`).then(r => {
                        setVolumes(r.data.data || []);
                        setBookTab(prev => ({ ...prev, [book.id]: 'toc' }));
                        setExpandedBook(book.id);
                        setExpandedVolume(res.data.data.id);
                        setTimeout(() => { setRenaming(res.data.data.id); setRenameValue(title); }, 100);
                      });
                    }}
                    className="inline-flex shrink-0 rounded hover:bg-bg-active text-text-tertiary hover:text-text-primary transition-colors p-0.5"
                    title="新建分卷">
                    <FolderPlus size={15} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setActiveBookForAdd(book); setShowAddMenu(true); }}
                    className="inline-flex shrink-0 rounded hover:bg-bg-active text-text-tertiary hover:text-text-primary transition-colors p-0.5"
                    title="新建章节">
                    <FilePlus size={15} />
                  </button>
                </div>
                {/* 目录内容 */}
                <div className="max-h-72 overflow-y-auto pr-3 mr-1">
                {bookTab[book.id] === 'toc' &&
                  (volumes.filter(v => v.bookId === book.id && v.title !== '默认').length === 0 && defaultChapters.length === 0 ? (
                <div className="pl-8 pr-3 py-3 text-xs text-text-tertiary">
                  暂无内容，点击右边 <Plus size={10} className="inline" /> 新建
                </div>
              ) : (
                <>
                  {volumes.filter(v => v.bookId === book.id && v.title !== '默认').map(volume => (
                    <div key={volume.id} id={`vol-${volume.id}`}>
                      {renamingRef.current === volume.id ? (
                        <div className="w-full pl-10 pr-3 py-1.5 flex items-center gap-1.5"
                          onContextMenu={(e) => { e.preventDefault(); setVolCtxMenu({ x: e.clientX, y: e.clientY, volume }); }}>
                          {expandedVolume === volume.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <input autoFocus
                            ref={el => { if (el) setTimeout(() => el.focus(), 0); }}
                            className="flex-1 px-1 py-0 text-xs border border-brand-primary rounded bg-bg-primary"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={async e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const newTitle = renameValue.trim() || volume.title;
                                await apiClient.patch(`/books/${book.id}/volumes/${volume.id}`, { title: newTitle });
                                const vRes = await apiClient.get(`/books/${book.id}/volumes`);
                                setVolumes(vRes.data.data);
                                blurTimeRef.current = 0; setRenaming(null);
                              }
                              if (e.key === 'Escape') { blurTimeRef.current = 0; setRenaming(null); }
                            }}
                            onBlur={() => setRenaming(null)}
                          />
                        </div>
                      ) : (
                        <button className="w-full pl-10 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors group"
                          onClick={() => { if (batchVolumeId === volume.id) { setBatchVolumeId(null); setSelectedChapters(new Set()); } handleExpandVolume(volume.id); }}
                          onContextMenu={(e) => { e.preventDefault(); setVolCtxMenu({ x: e.clientX, y: e.clientY, volume }); }}>
                          {expandedVolume === volume.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span className="truncate flex-1">
                            第{volume.volumeNumber}卷 {volume.title}
                          </span>
                          <button onClick={async (e: any) => { e.stopPropagation();
                            // 先从服务端获取最新章节列表以计算正确的序号
                            const listRes = await apiClient.get(`/volumes/${volume.id}/chapters`);
                            const currentChapters = listRes.data.data || [];
                            const cn = currentChapters.length + 1;
                            const newCh = await apiClient.post(`/volumes/${volume.id}/chapters`, { title: `章节${cn}`, chapterNumber: cn });
                            // 重新加载章节列表
                            const refresh = await apiClient.get(`/volumes/${volume.id}/chapters`);
                            setChapters(refresh.data.data);
                            if (expandedVolume !== volume.id) handleExpandVolume(volume.id);
                            setTimeout(() => setRenamingChapter(newCh.data.data.id, `章节${cn}`), 150);
                          }} className="hidden group-hover:inline text-text-tertiary hover:text-text-primary text-xs" title="新建章节">
                            <FilePlus size={13} />
                          </button>
                      </button>
                      )}
                      {expandedVolume === volume.id && chapters.filter(c => c.volumeId === volume.id).map(chapter => (
                        renamingChapter === chapter.id ? (
                          <div key={chapter.id} className="pl-16 pr-3 py-1 flex items-center gap-1">
                            <input autoFocus ref={el => { if (el) setTimeout(() => el.focus(), 0); }} className="flex-1 px-1 py-0 text-xs border border-brand-primary rounded bg-bg-primary"
                              value={renameChapterValue} onChange={e => setRenameChapterValue(e.target.value)}
                              onKeyDown={async e => {
                                if (e.key === 'Enter') { e.preventDefault();
                                  await apiClient.patch(`/volumes/${volume.id}/chapters/${chapter.id}`, { title: renameChapterValue.trim() || chapter.title });
                                  const refresh = await apiClient.get(`/volumes/${volume.id}/chapters`); setChapters(refresh.data.data);
                                  setRenamingChapter(null as any); }
                                if (e.key === 'Escape') setRenamingChapter(null as any);
                              }} onBlur={() => setRenamingChapter(null as any)} />
                          </div>
                        ) : (
                        <div key={chapter.id} className={`flex items-center gap-1 ${batchVolumeId === volume.id ? 'pl-8' : 'pl-16'} pr-3 py-1 text-sm hover:bg-bg-hover text-text-secondary group`}>
                          {batchVolumeId === volume.id && (
                            <input type="checkbox" checked={selectedChapters.has(chapter.id)} onChange={() => setSelectedChapters(prev => { const n = new Set(prev); n.has(chapter.id) ? n.delete(chapter.id) : n.add(chapter.id); return n; })} className="shrink-0 w-3.5 h-3.5" />
                          )}
                          <button className="flex-1 flex items-center gap-1.5 text-left"
                            onClick={() => batchVolumeId === volume.id ? null : handleSelectChapter(chapter.id, book.id, volume.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setChCtxMenu({ x: e.clientX, y: e.clientY, chapter, volumeId: volume.id }); }}>
                            <span className="truncate">第{chapter.chapterNumber}章 {chapter.title}</span>
                            <span className="text-text-tertiary text-xs">{chapter.wordCount}字</span>
                          </button>
                          {batchVolumeId !== volume.id && (
                            <button onClick={async (e: any) => { e.stopPropagation();
                              if (confirm('删除此章节？')) { await apiClient.delete(`/volumes/${volume.id}/chapters/${chapter.id}`); const refresh = await apiClient.get(`/volumes/${volume.id}/chapters`); setChapters(refresh.data.data); }
                            }} className="hidden group-hover:inline text-text-tertiary hover:text-error">✕</button>
                          )}
                        </div>
                      )))}
                      {/* 批量操作栏 */}
                      {batchVolumeId === volume.id && (
                        <div className="pl-10 pr-3 py-1 flex items-center gap-2 text-xs border-t border-border-primary bg-brand-primary/5">
                          <button onClick={() => {
                            const allIds = chapters.filter(c => c.volumeId === volume.id).map(c => c.id);
                            setSelectedChapters(prev => prev.size === allIds.length ? new Set() : new Set(allIds));
                          }} className="text-xs text-text-secondary hover:text-text-primary">
                            {(() => {
                              const allIds = chapters.filter(c => c.volumeId === volume.id).map(c => c.id);
                              return allIds.length > 0 && selectedChapters.size === allIds.length ? '取消全选' : '全选';
                            })()}
                          </button>
                          <span className="text-text-tertiary">{selectedChapters.size ? `已选 ${selectedChapters.size}` : ''}</span>
                          <div className="flex-1" />
                          {volumes.filter(v => v.bookId === book.id).length > 0 && (
                            <><span className="text-text-tertiary text-xs">移至</span>
                            <select className="px-1 py-0.5 border border-border-primary rounded text-xs bg-bg-primary"
                              defaultValue={volume.id} onChange={async (e) => {
                                if (!e.target.value || !selectedChapters.size) return;
                                if (!confirm(`移动 ${selectedChapters.size} 章？`)) return;
                                let targetVolId = e.target.value;
                                // "分卷外" → 移到默认分卷
                                if (targetVolId === '__default__') {
                                  let defVol: any = volumes.find(v => v.bookId === book.id && v.title === '默认');
                                  if (!defVol) {
                                    const res = await apiClient.post(`/books/${book.id}/volumes`, { title: '默认', volumeNumber: 0 });
                                    defVol = res.data.data;
                                  }
                                  targetVolId = defVol.id;
                                }
                                for (const chId of selectedChapters) await apiClient.patch(`/volumes/${volume.id}/chapters/${chId}`, { volumeId: targetVolId });
                                setBatchVolumeId(null); setSelectedChapters(new Set());
                                const refresh = await apiClient.get(`/volumes/${volume.id}/chapters`);
                                setChapters(refresh.data.data);
                                // 如果移到默认分卷，刷新分卷外章节
                                if (targetVolId === (volumes.find(v => v.bookId === book.id && v.title === '默认')?.id || '')) {
                                  apiClient.get(`/volumes/${targetVolId}/chapters`).then(r => setDefaultChapters(r.data.data || []));
                                }
                              }}>
                              <option value="__default__">分卷外</option>
                              {volumes.filter(v => v.bookId === book.id && v.title !== '默认').map(v => (
                                <option key={v.id} value={v.id}>{v.title}</option>
                              ))}
                            </select></>
                          )}
                          <button onClick={async () => {
                            if (!selectedChapters.size) return;
                            if (!confirm(`删除 ${selectedChapters.size} 章？`)) return;
                            for (const chId of selectedChapters) await apiClient.delete(`/volumes/${volume.id}/chapters/${chId}`);
                            setBatchVolumeId(null); setSelectedChapters(new Set());
                            const refresh = await apiClient.get(`/volumes/${volume.id}/chapters`);
                            setChapters(refresh.data.data);
                          }} className="text-error/70 hover:text-error">删除</button>
                          <span className="text-text-tertiary/30">|</span>
                          <button onClick={() => { setBatchVolumeId(null); setSelectedChapters(new Set()); }}
                            className="text-text-secondary hover:text-text-primary">完成</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {defaultChapters.map(chapter => (
                    renamingChapter === chapter.id ? (
                      <div key={chapter.id} className="pl-10 pr-3 py-1 flex items-center gap-1">
                        <span className="w-3 shrink-0" />
                        <input autoFocus ref={el => { if (el) setTimeout(() => el.focus(), 0); }} className="flex-1 px-1 py-0 text-sm border border-brand-primary rounded bg-bg-primary"
                          value={renameChapterValue}
                          onChange={e => setRenameChapterValue(e.target.value)}
                          onKeyDown={async e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const defVol = volumes.find(v => v.bookId === book.id && v.title === '默认');
                              if (defVol) {
                                await apiClient.patch(`/volumes/${defVol.id}/chapters/${chapter.id}`, { title: renameChapterValue.trim() || chapter.title });
                                apiClient.get(`/volumes/${defVol.id}/chapters`).then(r => setDefaultChapters(r.data.data || []));
                              }
                              setRenamingChapter(null as any);
                            }
                            if (e.key === 'Escape') setRenamingChapter(null as any);
                          }}
                          onBlur={() => setRenamingChapter(null as any)} />
                      </div>
                    ) : (
                    <div key={chapter.id} className="w-full pl-10 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors text-text-secondary group">
                      <span className="w-3 shrink-0" />
                      <button className="flex-1 flex items-center gap-1.5 text-left"
                        onClick={() => {
                          const defaultVol = volumes.find(v => v.bookId === book.id && v.title === '默认');
                          if (defaultVol) handleSelectChapter(chapter.id, book.id, defaultVol.id);
                        }}
                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation();
                          const defVol = volumes.find(v => v.bookId === book.id && v.title === '默认');
                          setChCtxMenu({ x: e.clientX, y: e.clientY, chapter, volumeId: defVol?.id || '' });
                        }}>
                        <span className="truncate">第{chapter.chapterNumber}章 {chapter.title}</span>
                        <span className="text-text-tertiary text-xs">{chapter.wordCount}字</span>
                      </button>
                      <button onClick={async (e: any) => { e.stopPropagation();
                        if (confirm('删除此章节？')) {
                          const defVol = volumes.find(v => v.bookId === book.id && v.title === '默认');
                          if (defVol) {
                            await apiClient.delete(`/volumes/${defVol.id}/chapters/${chapter.id}`);
                            apiClient.get(`/volumes/${defVol.id}/chapters`).then(r => setDefaultChapters(r.data.data || []));
                          }
                        }
                      }} className="hidden group-hover:inline text-text-tertiary hover:text-error">✕</button>
                    </div>
                    )))}
                </>
              ))
              }
              </div>
              </div>
            )}
          </div>
        ))}

      {/* 新建章节弹窗 */}
      {showAddMenu && activeBookForAdd && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowAddMenu(false)}>
          <div className="bg-bg-primary rounded-lg shadow-xl w-[300px]" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border-primary font-semibold text-sm">新建章节</div>
            <div className="p-2">
              <button onClick={async () => {
                const bookVols = volumes.filter(v => v.bookId === activeBookForAdd.id);
                let defVol: any = bookVols.find(v => v.title === '默认') || null;
                if (!defVol) {
                  const res = await apiClient.post(`/books/${activeBookForAdd.id}/volumes`, { title: '默认', volumeNumber: 0 });
                  defVol = res.data.data;
                }
                const volId = defVol!.id;
                const cn = (defaultChapters.length || 0) + 1;
                const newCh = await apiClient.post(`/volumes/${volId}/chapters`, { title: `章节${cn}`, chapterNumber: cn });
                apiClient.get(`/volumes/${volId}/chapters`).then(r => {
                  setDefaultChapters(r.data.data || []);
                  setTimeout(() => setRenamingChapter(newCh.data.data.id, `章节${cn}`), 100);
                });
                apiClient.get(`/books/${activeBookForAdd.id}/volumes`).then(r => setVolumes(r.data.data || []));
                setBookTab(prev => ({ ...prev, [activeBookForAdd.id]: 'toc' }));
                setExpandedBook(activeBookForAdd.id);
                setShowAddMenu(false);
              }} className="w-full px-3 py-2 text-left text-sm hover:bg-bg-hover rounded flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-current inline-block shrink-0 ml-1" />
                分卷外创建
              </button>
              <details className="group">
                <summary className="px-3 py-2 text-sm hover:bg-bg-hover rounded cursor-pointer list-none flex items-center gap-2">
                  <ChevronRight size={14} className="group-open:rotate-90 transition-transform shrink-0 ml-1" />
                  分卷内创建
                </summary>
                <div className="pl-4">
                  {volumes.filter(v => v.bookId === activeBookForAdd.id && v.title !== '默认').map(v => (
                    <button key={v.id} onClick={async () => {
                      const listRes = await apiClient.get(`/volumes/${v.id}/chapters`);
                      const cn = (listRes.data.data || []).length + 1;
                      const newCh = await apiClient.post(`/volumes/${v.id}/chapters`, { title: `章节${cn}`, chapterNumber: cn });
                      apiClient.get(`/volumes/${v.id}/chapters`).then(r => {
                        setChapters(r.data.data || []);
                        setTimeout(() => setRenamingChapter(newCh.data.data.id, `章节${cn}`), 150);
                      });
                      setExpandedVolume(v.id);
                      setShowAddMenu(false);
                    }} className="w-full px-3 py-2 text-left text-xs hover:bg-bg-hover rounded flex items-center gap-2">
                      第{v.volumeNumber}卷 {v.title}
                    </button>
                  ))}
                  {volumes.filter(v => v.bookId === activeBookForAdd.id && v.title !== '默认').length === 0 && (
                    <div className="px-3 py-2 text-xs text-text-tertiary">暂无分卷</div>
                  )}
                </div>
              </details>
            </div>
          </div>
        </div>
      )}
      </nav>
      </div>

      {/* 底部设置 — 1/3 */}
      <div className="flex-[0.33] flex items-center border-t border-border-primary">
        <button onClick={() => setShowSettings(true)}
          className="w-full py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover flex items-center justify-center gap-1.5 transition-colors">
          <Settings size={14} /> 设置
        </button>
      </div>

      {/* 右键菜单 */}
      {volCtxMenu && (
        <VolumeContextMenu x={volCtxMenu.x} y={volCtxMenu.y} onClose={() => setVolCtxMenu(null)}
          onNewChapter={async () => {
            const listRes = await apiClient.get(`/volumes/${volCtxMenu.volume.id}/chapters`);
            const cn = (listRes.data.data || []).length + 1;
            const newCh = await apiClient.post(`/volumes/${volCtxMenu.volume.id}/chapters`, { title: `章节${cn}`, chapterNumber: cn });
            const refresh = await apiClient.get(`/volumes/${volCtxMenu.volume.id}/chapters`);
            setChapters(refresh.data.data);
            if (expandedVolume !== volCtxMenu.volume.id) handleExpandVolume(volCtxMenu.volume.id);
            setTimeout(() => setRenamingChapter(newCh.data.data.id, `章节${cn}`), 150);
          }}
          onBatchManage={() => {
            setBatchVolumeId(volCtxMenu.volume.id);
            setSelectedChapters(new Set());
            if (expandedVolume !== volCtxMenu.volume.id) handleExpandVolume(volCtxMenu.volume.id);
          }}
          onRename={() => {
            setRenaming(volCtxMenu.volume.id);
            setRenameValue(volCtxMenu.volume.title);
          }}
          onDelete={() => {
            const v = volCtxMenu.volume;
            if (confirm('删除此分卷及所有章节？')) {
              apiClient.delete(`/books/${v.bookId}/volumes/${v.id}`).then(() => {
                apiClient.get(`/books/${v.bookId}/volumes`).then(r => setVolumes(r.data.data));
              });
            }
          }} />
      )}
      {chCtxMenu && (
        <ChapterContextMenu x={chCtxMenu.x} y={chCtxMenu.y} onClose={() => setChCtxMenu(null)}
          onRename={() => { setRenamingChapter(chCtxMenu.chapter.id, chCtxMenu.chapter.title); }}
          onDelete={() => {
            if (confirm('删除此章节？')) {
              apiClient.delete(`/volumes/${chCtxMenu.volumeId}/chapters/${chCtxMenu.chapter.id}`).then(() => {
                const defVol = volumes.find(v => v.title === '默认');
                if (chCtxMenu.volumeId === defVol?.id) {
                  apiClient.get(`/volumes/${defVol.id}/chapters`).then(r => setDefaultChapters(r.data.data || []));
                } else {
                  apiClient.get(`/volumes/${chCtxMenu.volumeId}/chapters`).then(r => setChapters(r.data.data || []));
                }
              });
            }
          }} />
      )}
      {ctxMenu && (
        <BookContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)}
          onEdit={() => setEditBook(ctxMenu.book)}
          onExport={() => setExportBook(ctxMenu.book)}
          onDetail={() => setDetailBook(ctxMenu.book)}
          onDelete={() => setDeleteBook(ctxMenu.book)} />
      )}

      {/* 各弹窗 */}
      <BookCreateDialog open={!!editBook} editBook={editBook}
        onClose={() => setEditBook(null)}
        onCreated={(updated) => { setBooks(books.map(b => b.id === updated.id ? updated : b)); }}
        bookCount={books.length}
        existingTitles={books.filter(b => b.id !== editBook?.id).map(b => b.title)} />
      <BookExportDialog open={!!exportBook} book={exportBook} onClose={() => setExportBook(null)} />
      <BookDetailDialog open={!!detailBook} book={detailBook} volumes={volumes} chapters={chapters} onClose={() => setDetailBook(null)} />
      {/* 删除确认 */}
      {deleteBook && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setDeleteBook(null)}>
          <div className="bg-bg-primary rounded-lg shadow-xl w-[360px] p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-2">删除作品</h3>
            <p className="text-sm text-text-secondary mb-3">确认删除「{deleteBook.title}」？此操作不可逆，将删除该作品的所有卷、章节及相关数据。</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteBook(null)} className="px-4 py-1.5 text-sm border rounded hover:bg-bg-hover">取消</button>
              <button onClick={async () => {
                await apiClient.delete(`/books/${deleteBook.id}`);
                setBooks(books.filter(b => b.id !== deleteBook.id));
                // 清理关联数据
                setVolumes(volumes.filter(v => v.bookId !== deleteBook.id));
                setChapters([]);
                setDefaultChapters([]);
                if (currentBook?.id === deleteBook.id) setCurrentBook(null);
                setDeleteBook(null);
              }} className="px-4 py-1.5 text-sm bg-error text-white rounded hover:bg-error/80">确认删除</button>
            </div>
          </div>
        </div>
      )}

      <SearchDialog open={showSearch} onClose={() => setShowSearch(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
    </aside>
  );
}

/** 内联新建输入框 */
function NewItemPopover({ label, onSubmit, triggerLabel }: { label: string; onSubmit: (title: string) => Promise<void>; triggerLabel: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const handleSubmit = async () => {
    if (!value.trim()) return;
    await onSubmit(value.trim());
    setValue(''); setOpen(false);
  };

  return open ? (
    <div className="flex gap-1 px-1">
      <input autoFocus className="flex-1 px-1.5 py-0.5 text-xs border border-border-primary rounded bg-bg-primary"
        placeholder={label} value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') { setValue(''); setOpen(false); } }} />
      <button onClick={() => { setValue(''); setOpen(false); }} className="text-xs text-text-tertiary">✕</button>
    </div>
  ) : (
    <button onClick={() => setOpen(true)} className="text-xs text-brand-primary hover:underline">{triggerLabel}</button>
  );
}
