// 全局搜索弹窗
import { useState, useEffect } from 'react';
import { Search, X, FileText, BookOpen, Clock } from 'lucide-react';
import { apiClient } from '../../services/api.service';
import { useProjectStore } from '../../stores/project.store';
import { useEditorStore } from '../../stores/editor.store';

interface Props { open: boolean; onClose: () => void; }

const HISTORY_KEY = 'novel_search_history';

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}
function saveHistory(h: string[]) { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 50))); }

export default function SearchDialog({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [hint, setHint] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [showMore, setShowMore] = useState(false);
  const { books, volumes, chapters } = useProjectStore();
  const { setCurrentChapter } = useEditorStore();

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); setSearched(false); setHint(''); return; }
    setHistory(loadHistory());
    books.forEach(b => {
      apiClient.get(`/books/${b.id}/volumes`).then(r => r.data.data?.forEach((v: any) => {
        apiClient.get(`/volumes/${v.id}/chapters`).catch(() => {});
      })).catch(() => {});
    });
  }, [open]);

  const addToHistory = (q: string) => {
    const h = loadHistory();
    const idx = h.findIndex(x => x === q);
    if (idx >= 0) h.splice(idx, 1); // 移除重复
    h.unshift(q); // 提到最前
    saveHistory(h);
    setHistory(h);
  };

  const removeFromHistory = (q: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const h = loadHistory().filter(x => x !== q);
    saveHistory(h);
    setHistory(h);
  };

  const doSearch = (searchQuery?: string) => {
    const q = (searchQuery || query).trim();
    if (!q) { setHint('搜索框内容为空'); setTimeout(() => setHint(''), 3000); return; }
    if (!searchQuery) { setQuery(q); addToHistory(q); }
    setHint('');
    setSearched(true);
    const ql = q.toLowerCase();
    const found: any[] = [];
    books.forEach(b => {
      if (b.title.toLowerCase().includes(ql)) found.push({ type: 'book', book: b, title: b.title });
      if (b.author?.toLowerCase().includes(ql)) found.push({ type: 'book', book: b, title: `${b.title} - ${b.author}` });
    });
    volumes.forEach(v => {
      if (v.title.toLowerCase().includes(ql)) {
        const b = books.find(x => x.id === v.bookId);
        found.push({ type: 'volume', book: b, volume: v, title: `第${v.volumeNumber}卷 ${v.title}` });
      }
    });
    chapters.forEach(c => {
      if (c.title.toLowerCase().includes(ql)) {
        const v = volumes.find(x => x.id === c.volumeId);
        const b = books.find(x => x.id === v?.bookId);
        found.push({ type: 'chapter', book: b, volume: v, chapter: c, title: `第${c.chapterNumber}章 ${c.title}` });
      }
    });
    setResults(found.slice(0, 30));
  };

  return open ? (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      {hint && (
        <div className="absolute top-[10vh] left-1/2 -translate-x-1/2 bg-bg-elevated border border-border-primary rounded-lg shadow-lg px-4 py-2 text-sm text-text-primary z-[60]">
          {hint}
        </div>
      )}
      <div className="bg-bg-primary rounded-lg shadow-xl w-[480px] max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-3 border-b border-border-primary">
          <div className="relative">
            <input autoFocus className="w-full pl-3 pr-16 py-2 text-sm border border-border-primary rounded-lg bg-bg-primary focus:outline-none focus:border-brand-primary"
              placeholder="搜索作品、分卷、章节..." value={query}
              onChange={e => { setQuery(e.target.value); setSearched(false); setHint(''); }}
              onKeyDown={e => { if (e.key === 'Enter') doSearch(); }} />
            {query && <button onClick={() => { setQuery(''); setResults([]); setSearched(false); }} className="absolute right-8 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"><X size={16} /></button>}
            <button onClick={() => doSearch()} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors">
              <Search size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {searched ? (
            results.length > 0 ? (
              results.map((r, i) => (
                <button key={i} onClick={() => { if (r.type === 'chapter' && r.book && r.volume) { setCurrentChapter(r.book.id, r.volume.id, r.chapter.id); useEditorStore.getState().setContent(r.chapter.content || ''); } onClose(); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-bg-hover rounded flex items-center gap-2">
                  <FileText size={14} className="text-text-tertiary shrink-0" />
                  <div className="flex-1 min-w-0"><div className="truncate">{r.title}</div>{r.book && <div className="text-xs text-text-tertiary truncate">{r.book.title}</div>}</div>
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-sm text-text-tertiary text-center">搜索结果为空</div>
            )
          ) : (
            <>
              {/* 搜索历史 */}
              <div className="mb-3">
                <div className="px-3 py-1 text-sm text-text-tertiary flex items-center justify-between">
                  <span>搜索历史</span>
                  {history.length > 0 && (
                    <div className="flex items-center gap-2">
                      {batchMode ? (
                        <>
                          <button onClick={() => {
                            const allIdxs = new Set(history.map((_, i) => i));
                            setSelectedItems(prev => prev.size === allIdxs.size ? new Set() : allIdxs);
                          }} className="text-xs hover:text-text-primary">全选</button>
                          <button onClick={() => {
                            if (selectedItems.size > 0) {
                              const toRemove = history.filter((_, i) => selectedItems.has(i));
                              const h = loadHistory().filter(x => !toRemove.includes(x));
                              saveHistory(h); setHistory(h);
                            }
                            setBatchMode(false); setSelectedItems(new Set());
                          }} className="text-xs hover:text-text-primary">确认</button>
                          <button onClick={() => { setBatchMode(false); setSelectedItems(new Set()); }}
                            className="text-xs hover:text-text-primary">取消</button>
                        </>
                      ) : (
                        <button onClick={() => setBatchMode(true)} className="text-xs hover:text-text-primary">批量清空</button>
                      )}
                    </div>
                  )}
                </div>
                {history.length > 0 ? (() => {
                  const visible = showMore ? history : history.slice(0, 5);
                  return (
                    <>
                      {visible.map((h, i) => (
                        <div key={i} className={`flex items-center px-3 py-2 text-sm hover:bg-bg-hover rounded group ${batchMode ? '' : 'cursor-pointer'}`}
                          onClick={() => batchMode ? setSelectedItems(prev => { const globalIdx = history.indexOf(h); const n = new Set(prev); n.has(globalIdx) ? n.delete(globalIdx) : n.add(globalIdx); return n; }) : doSearch(h)}>
                          {batchMode && (
                            <input type="checkbox" checked={selectedItems.has(history.indexOf(h))} readOnly
                              className="shrink-0 w-3.5 h-3.5 mr-2"
                              onClick={(e) => e.stopPropagation()} />
                          )}
                          {!batchMode && <Clock size={14} className="text-text-tertiary shrink-0 mr-2" />}
                          <span className="flex-1 truncate">{h.length > 10 ? h.slice(0, 10) + '...' : h}</span>
                          {!batchMode && (
                            <button onClick={(e) => removeFromHistory(h, e)}
                              className="hidden group-hover:inline text-text-tertiary hover:text-error ml-1"><X size={14} /></button>
                          )}
                        </div>
                      ))}
                      {history.length > 5 && (
                        <button onClick={() => setShowMore(!showMore)}
                          className="w-full px-3 py-1 text-xs text-text-tertiary hover:text-text-primary text-center">
                          {showMore ? '收起' : `展开更多 (${history.length - 5})`}
                        </button>
                      )}
                    </>
                  );
                })() : (
                  <div className="px-3 py-3 text-xs text-text-tertiary text-center">暂无记录</div>
                )}
              </div>
              {/* 最近创作 */}
              {books.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-sm text-text-tertiary">最近创作</div>
                  {books.slice(0, 5).map(b => (
                    <button key={b.id} onClick={onClose} className="w-full px-3 py-2 text-left text-sm hover:bg-bg-hover rounded flex items-center gap-2">
                      <BookOpen size={14} className="text-text-tertiary shrink-0" /><span className="truncate">{b.title}</span><span className="text-xs text-text-tertiary">{b.wordCount?.toLocaleString()}字</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;
}
