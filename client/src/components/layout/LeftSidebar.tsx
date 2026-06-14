// 左侧边栏 — 写作台导航
import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/project.store';
import { useEditorStore } from '../../stores/editor.store';
import { apiClient } from '../../services/api.service';
import { Book, FileText, Plus, ChevronRight, ChevronDown } from 'lucide-react';

export default function LeftSidebar() {
  const { books, setBooks, volumes, setVolumes, chapters, setChapters, setCurrentBook, loading, setLoading } =
    useProjectStore();
  const { setCurrentChapter } = useEditorStore();
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const [expandedVolume, setExpandedVolume] = useState<string | null>(null);

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
    if (expandedBook === bookId) {
      setExpandedBook(null);
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
      const res = await apiClient.get(`/chapters/${chapterId}`);
      const chapter = res.data.data;
      useEditorStore.getState().setContent(chapter.content || '');
      useEditorStore.getState().setChapterOutline(chapter.chapterOutline || '');
      useEditorStore.getState().setInstruction(chapter.instruction || '');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <aside className="w-60 bg-bg-secondary border-r border-border-primary flex flex-col shrink-0 overflow-y-auto">
      {/* 标题 */}
      <div className="p-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
        📚 写作台
      </div>

      {/* 加载中 */}
      {loading && (
        <div className="px-3 py-2 text-xs text-text-tertiary">加载中...</div>
      )}

      {/* 新建书籍按钮 */}
      <button
        className="mx-3 mb-2 px-3 py-1.5 text-xs bg-brand-primary text-brand-text rounded hover:bg-brand-hover transition-colors flex items-center gap-1"
        onClick={async () => {
          const title = prompt('请输入书籍名称：');
          if (!title) return;
          try {
            const res = await apiClient.post('/books', { title });
            const newBook = res.data.data;
            setBooks([newBook, ...books]);
          } catch (err) {
            console.error(err);
          }
        }}
      >
        <Plus size={14} /> 新建书籍
      </button>

      {/* 书籍列表 */}
      <nav className="flex-1">
        {books.map((book) => (
          <div key={book.id}>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors"
              onClick={() => handleExpandBook(book.id)}
            >
              {expandedBook === book.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Book size={14} className="text-brand-primary" />
              <span className="truncate flex-1">{book.title}</span>
              <span className="text-xs text-text-tertiary">{book.wordCount.toLocaleString()}字</span>
            </button>

            {/* 卷列表 */}
            {expandedBook === book.id &&
              volumes
                .filter((v) => v.bookId === book.id)
                .map((volume) => (
                  <div key={volume.id}>
                    <button
                      className="w-full pl-8 pr-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-1.5 transition-colors"
                      onClick={() => handleExpandVolume(volume.id)}
                    >
                      {expandedVolume === volume.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span className="truncate">第{volume.volumeNumber}卷 {volume.title}</span>
                    </button>

                    {/* 章节列表 */}
                    {expandedVolume === volume.id &&
                      chapters
                        .filter((c) => c.volumeId === volume.id)
                        .map((chapter) => (
                          <button
                            key={chapter.id}
                            className="w-full pl-12 pr-3 py-1 text-left text-xs hover:bg-bg-hover flex items-center gap-1.5 transition-colors text-text-secondary"
                            onClick={() => handleSelectChapter(chapter.id, book.id, volume.id)}
                          >
                            <FileText size={12} />
                            <span className="truncate">第{chapter.chapterNumber}章 {chapter.title}</span>
                            <span className="text-text-tertiary ml-auto">{chapter.wordCount}字</span>
                          </button>
                        ))}
                  </div>
                ))}
          </div>
        ))}
      </nav>

      {/* 底部：用户设置入口 */}
      <div className="p-3 border-t border-border-primary text-xs text-text-tertiary">
        ⚙ 设置 · 💡 灵感
      </div>
    </aside>
  );
}
