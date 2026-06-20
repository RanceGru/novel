// 全局搜索弹窗
import { useState, useEffect } from 'react';
import { Search, X, FileText, BookOpen, Clock } from 'lucide-react';
import { apiClient } from '../../services/api.service';
import { useProjectStore } from '../../stores/project.store';
import { useEditorStore } from '../../stores/editor.store';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SearchDialog({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const { books, volumes, chapters } = useProjectStore();
  const { setCurrentChapter } = useEditorStore();

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); return; }
    // 打开时加载卷和章节
    books.forEach(b => {
      apiClient.get(`/books/${b.id}/volumes`).then(r => r.data.data?.forEach((v: any) => {
        apiClient.get(`/volumes/${v.id}/chapters`).catch(() => {});
      })).catch(() => {});
    });
  }, [open]);

  // 实时搜索
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    const q = query.toLowerCase();
    const found: any[] = [];

    // 在当前已知数据中搜索
    books.forEach(b => {
      if (b.title.toLowerCase().includes(q)) found.push({ type: 'book', book: b, title: b.title });
      if (b.author?.toLowerCase().includes(q)) found.push({ type: 'book', book: b, title: `${b.title} - ${b.author}` });
    });

    volumes.forEach(v => {
      if (v.title.toLowerCase().includes(q)) {
        const b = books.find(x => x.id === v.bookId);
        found.push({ type: 'volume', book: b, volume: v, title: `第${v.volumeNumber}卷 ${v.title}` });
      }
    });

    chapters.forEach(c => {
      if (c.title.toLowerCase().includes(q)) {
        const v = volumes.find(x => x.id === c.volumeId);
        const b = books.find(x => x.id === v?.bookId);
        found.push({ type: 'chapter', book: b, volume: v, chapter: c, title: `第${c.chapterNumber}章 ${c.title}` });
      }
    });

    setResults(found.slice(0, 30));
    setSearching(false);
  }, [query, books, volumes, chapters]);

  return open ? (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="bg-bg-primary rounded-lg shadow-xl w-[480px] max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* 搜索框 */}
        <div className="p-3 border-b border-border-primary">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input autoFocus className="w-full pl-10 pr-8 py-2 text-sm border border-border-primary rounded-lg bg-bg-primary focus:outline-none focus:border-brand-primary"
              placeholder="搜索作品、分卷、章节..." value={query}
              onChange={e => setQuery(e.target.value)} />
            {query && <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"><X size={16} /></button>}
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-2">
          {query.trim() ? (
            results.length > 0 ? (
              results.map((r, i) => (
                <button key={i}
                  onClick={() => {
                    if (r.type === 'chapter' && r.book && r.volume) {
                      setCurrentChapter(r.book.id, r.volume.id, r.chapter.id);
                      useEditorStore.getState().setContent(r.chapter.content || '');
                    }
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-bg-hover rounded flex items-center gap-2">
                  <FileText size={14} className="text-text-tertiary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{r.title}</div>
                    {r.book && <div className="text-xs text-text-tertiary truncate">{r.book.title}</div>}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-sm text-text-tertiary text-center">搜索结果为空</div>
            )
          ) : (
            <>
              {books.length > 0 && (
                <div className="mb-3">
                  <div className="px-3 py-1 text-xs text-text-tertiary flex items-center gap-1"><Clock size={12} /> 最近创作</div>
                  {books.slice(0, 5).map(b => (
                    <button key={b.id} onClick={onClose}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-bg-hover rounded flex items-center gap-2">
                      <BookOpen size={14} className="text-text-tertiary shrink-0" />
                      <span className="truncate">{b.title}</span>
                      <span className="text-xs text-text-tertiary">{b.wordCount?.toLocaleString()}字</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="px-3 py-1 text-xs text-text-tertiary">搜索历史</div>
              <div className="px-3 py-3 text-xs text-text-tertiary text-center">暂无搜索记录</div>
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;
}
