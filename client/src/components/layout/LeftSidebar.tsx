// 左侧边栏 — 写作台导航
import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/project.store';
import { useEditorStore } from '../../stores/editor.store';
import { apiClient } from '../../services/api.service';
import { FileText, Plus, ChevronRight, ChevronDown, Settings } from 'lucide-react';
import OutlineTree from '../outline/OutlineTree';
import CharacterList from '../characters/CharacterList';
import WorldSettingList from '../worldbuilding/WorldSettingList';
import SettingsDialog from './SettingsDialog';
import BookCreateDialog from './BookCreateDialog';
import BookContextMenu from './BookContextMenu';
import BookExportDialog from './BookExportDialog';
import BookDetailDialog from './BookDetailDialog';

export default function LeftSidebar() {
  const { books, setBooks, volumes, setVolumes, chapters, setChapters, setCurrentBook, loading, setLoading } =
    useProjectStore();
  const { setCurrentChapter } = useEditorStore();
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const [expandedVolume, setExpandedVolume] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewBook, setShowNewBook] = useState(false);
  const [bookTab, setBookTab] = useState<Record<string, 'toc' | 'related' | null>>({});
  // 右键菜单
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; book: any } | null>(null);
  const [editBook, setEditBook] = useState<any>(null);
  const [exportBook, setExportBook] = useState<any>(null);
  const [detailBook, setDetailBook] = useState<any>(null);
  const [deleteBook, setDeleteBook] = useState<any>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [activeBookForAdd, setActiveBookForAdd] = useState<any>(null);

  // 加载书籍列表
  useEffect(() => {
    setLoading(true);
    apiClient
      .get('/books')
      .then((res) => setBooks(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
    <aside className="w-80 bg-bg-secondary border-r border-border-primary flex flex-col shrink-0 overflow-y-auto">
      {/* 标题 */}
      <div className="p-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
        📚 写作台
      </div>

      {/* 加载中 */}
      {loading && (
        <div className="px-3 py-2 text-xs text-text-tertiary">加载中...</div>
      )}

      {/* 新建作品 */}
      <button onClick={() => setShowNewBook(true)}
        className="mx-3 mb-2 px-3 py-1.5 text-xs bg-brand-primary text-brand-text rounded hover:bg-brand-hover transition-colors flex items-center gap-1">
        <Plus size={14} /> 新建作品
      </button>

      <BookCreateDialog open={showNewBook} onClose={() => setShowNewBook(false)}
        onCreated={(newBook) => setBooks([newBook, ...books])}
        bookCount={books.length}
        existingTitles={books.map(b => b.title)} />

      {/* 书籍列表 */}
      <nav className="flex-1">
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
                <button
                  onClick={() => {
                    setBookTab(prev => ({ ...prev, [book.id]: prev[book.id] === 'related' ? null : 'related' }));
                    setExpandedVolume(null);
                    setCurrentBook(book);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors">
                  {bookTab[book.id] === 'related' ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronRight size={14} className="text-text-tertiary" />}
                  <span className="text-text-secondary">相关</span>
                </button>
                {/* 相关内容 */}
                {bookTab[book.id] === 'related' && (
                  <div className="pl-10 pr-2 py-1 space-y-0.5">
                    <OutlineTree />
                    <CharacterList />
                    <WorldSettingList />
                  </div>
                )}
              </div>
            )}

            {/* 下拉按钮：目录 */}
            {expandedBook === book.id && (
              <div className="flex flex-col">
                <div className="relative">
                <button
                  onClick={() => {
                    if (expandedBook !== book.id) setExpandedBook(book.id);
                    setBookTab(prev => ({ ...prev, [book.id]: prev[book.id] === 'toc' ? null : 'toc' }));
                  }}
                  className="w-full pl-8 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors group">
                  {bookTab[book.id] === 'toc' ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronRight size={14} className="text-text-tertiary" />}
                  <span className="text-text-secondary flex-1">目录</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setActiveBookForAdd(book); setShowAddMenu(!showAddMenu); }}
                    className="hidden group-hover:inline-flex shrink-0 w-5 h-5 items-center justify-center rounded hover:bg-bg-active text-text-tertiary hover:text-text-primary transition-colors"
                    title="新建卷或章节">
                    <Plus size={14} />
                  </button>
                </button>
                {/* + 浮动气泡菜单 */}
                {showAddMenu && activeBookForAdd?.id === book.id && (
                  <div className="absolute left-[55%] -top-1 z-40 bg-bg-primary border border-border-primary rounded-lg shadow-lg flex"
                    onMouseLeave={() => setShowAddMenu(false)}>
                    <button onClick={async () => {
                      const title = prompt('分卷名称：');
                      if (!title) { setShowAddMenu(false); return; }
                      const vn = volumes.filter(v => v.bookId === book.id).length + 1;
                      await apiClient.post(`/books/${book.id}/volumes`, { title, volumeNumber: vn });
                      handleExpandBook(book.id); setShowAddMenu(false);
                    }} className="px-3 py-1.5 text-xs hover:bg-bg-hover rounded-l-lg whitespace-nowrap">
                      新建分卷
                    </button>
                    <div className="w-px bg-border-primary" />
                    <button onClick={async () => {
                      setShowAddMenu(false);
                      const bookVolumes = volumes.filter(v => v.bookId === book.id);
                      if (bookVolumes.length === 0) { alert('请先创建分卷'); return; }
                      const title = prompt('章节名称：');
                      if (!title) return;
                      const cn = chapters.filter(c => c.volumeId === bookVolumes[0].id).length + 1;
                      await apiClient.post(`/volumes/${bookVolumes[0].id}/chapters`, { title, chapterNumber: cn });
                      handleExpandVolume(bookVolumes[0].id);
                    }} className="px-3 py-1.5 text-xs hover:bg-bg-hover rounded-r-lg whitespace-nowrap">
                      新建章节
                    </button>
                  </div>
                )}
                </div>
                {/* 目录内容 */}
                {bookTab[book.id] === 'toc' &&
                  (volumes.filter(v => v.bookId === book.id).length === 0 ? (
                <div className="pl-8 pr-3 py-3 text-xs text-text-tertiary">
                  暂无内容，点击右边 <Plus size={10} className="inline" /> 新建
                </div>
              ) : (
                <>
                  {volumes.filter(v => v.bookId === book.id).map(volume => (
                    <div key={volume.id}>
                      <button className="w-full pl-10 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors group"
                        onClick={() => handleExpandVolume(volume.id)}>
                        {expandedVolume === volume.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span className="truncate flex-1">第{volume.volumeNumber}卷 {volume.title}</span>
                        <button onClick={async (e: any) => { e.stopPropagation();
                          if (confirm('删除此卷及所有章节？')) {
                            await apiClient.delete(`/books/${book.id}/volumes/${volume.id}`);
                            handleExpandBook(book.id);
                          }
                        }} className="hidden group-hover:inline text-text-tertiary hover:text-error text-xs">✕</button>
                      </button>
                      {expandedVolume === volume.id && chapters.filter(c => c.volumeId === volume.id).map(chapter => (
                        <button key={chapter.id}
                          className="w-full pl-14 pr-3 py-1 text-left text-xs hover:bg-bg-hover flex items-center gap-1.5 transition-colors text-text-secondary group"
                          onClick={() => handleSelectChapter(chapter.id, book.id, volume.id)}>
                          <FileText size={12} />
                          <span className="truncate flex-1">第{chapter.chapterNumber}章 {chapter.title}</span>
                          <span className="text-text-tertiary">{chapter.wordCount}字</span>
                          <button onClick={async (e: any) => { e.stopPropagation();
                            if (confirm('删除此章节？')) {
                              await apiClient.delete(`/volumes/${volume.id}/chapters/${chapter.id}`);
                              handleExpandVolume(volume.id);
                            }
                          }} className="hidden group-hover:inline text-text-tertiary hover:text-error">✕</button>
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              ))
              }
              </div>
            )}
          </div>
        ))}

      </nav>

      {/* 纲树 */}
      <div className="border-t border-border-primary">
        <OutlineTree />
      </div>

      {/* 角色 */}
      <div className="border-t border-border-primary">
        <CharacterList />
      </div>

      {/* 世界观 */}
      <div className="border-t border-border-primary">
        <WorldSettingList />
      </div>

      {/* 底部设置 */}
      <div className="p-2 border-t border-border-primary">
        <button onClick={() => setShowSettings(true)}
          className="w-full py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded flex items-center justify-center gap-1.5 transition-colors">
          <Settings size={14} /> 设置
        </button>
      </div>

      {/* 右键菜单 */}
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
                setDeleteBook(null);
              }} className="px-4 py-1.5 text-sm bg-error text-white rounded hover:bg-error/80">确认删除</button>
            </div>
          </div>
        </div>
      )}

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
