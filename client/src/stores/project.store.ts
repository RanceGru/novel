// 项目管理状态 (Zustand) — v2.7 补充 Action 方法
import { create } from 'zustand';
import { apiClient } from '../services/api.service';

export interface Book {
  id: string;
  title: string;
  coverUrl?: string | null;
  author?: string | null;
  subtitle?: string | null;
  description?: string | null;
  wordCount: number;
  status: string;
  volumeCount?: number;
  updatedAt: string;
}

export interface Volume {
  id: string;
  bookId: string;
  title: string;
  volumeNumber: number;
  status: string;
}

export interface ChapterItem {
  id: string;
  volumeId: string;
  title: string;
  chapterNumber: number;
  wordCount: number;
  status: string;
  updatedAt: string;
}

interface ProjectState {
  books: Book[];
  volumes: Volume[];
  chapters: ChapterItem[];
  currentBook: Book | null;
  loading: boolean;
  error: string | null;

  // 基础 setter
  setBooks: (books: Book[]) => void;
  setVolumes: (volumes: Volume[]) => void;
  setChapters: (chapters: ChapterItem[]) => void;
  setCurrentBook: (book: Book | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // ====== 业务 Action 方法 ======

  /** 加载书籍列表 */
  loadBooks: () => Promise<void>;

  /** 创建书籍 */
  createBook: (data: { title: string; author?: string; description?: string; coverUrl?: string }) => Promise<Book | null>;

  /** 更新书籍 */
  updateBook: (bookId: string, data: Partial<Book>) => Promise<Book | null>;

  /** 删除书籍 */
  deleteBook: (bookId: string) => Promise<boolean>;

  /** 加载指定书籍的卷列表 */
  loadVolumes: (bookId: string) => Promise<Volume[]>;

  /** 创建卷 */
  createVolume: (bookId: string, data: { title: string; volumeNumber: number }) => Promise<Volume | null>;

  /** 更新卷 */
  updateVolume: (volumeId: string, data: { title?: string }) => Promise<Volume | null>;

  /** 删除卷 */
  deleteVolume: (volumeId: string) => Promise<boolean>;

  /** 加载指定卷的章节列表 */
  loadChapters: (volumeId: string) => Promise<ChapterItem[]>;

  /** 创建章节 */
  createChapter: (volumeId: string, data: { title: string; chapterNumber: number; chapterOutline?: string; instruction?: string }) => Promise<ChapterItem | null>;

  /** 更新章节 */
  updateChapter: (volumeId: string, chapterId: string, data: { title?: string; content?: string; chapterOutline?: string; instruction?: string }) => Promise<ChapterItem | null>;

  /** 删除章节 */
  deleteChapter: (volumeId: string, chapterId: string) => Promise<boolean>;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  books: [],
  volumes: [],
  chapters: [],
  currentBook: null,
  loading: false,
  error: null,

  // 基础 setter
  setBooks: (books) => set({ books, error: null }),
  setVolumes: (volumes) => set({ volumes, error: null }),
  setChapters: (chapters) => set({ chapters, error: null }),
  setCurrentBook: (book) => set({ currentBook: book }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // ====== 业务 Action ======

  loadBooks: async () => {
    set({ loading: true });
    try {
      const res = await apiClient.get('/books');
      const books = res.data?.data || [];
      set({ books, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  createBook: async (data) => {
    set({ error: null });
    try {
      const res = await apiClient.post('/books', data);
      const book = res.data?.data;
      if (book) {
        set((s) => ({ books: [...s.books, book] }));
      }
      return book;
    } catch (e: any) {
      set({ error: e?.response?.data?.error?.message || e?.message || '创建作品失败' });
      return null;
    }
  },

  updateBook: async (bookId, data) => {
    try {
      const res = await apiClient.patch(`/books/${bookId}`, data);
      const updated = res.data?.data;
      if (updated) {
        set((s) => ({
          books: s.books.map((b) => (b.id === bookId ? { ...b, ...updated } : b)),
        }));
      }
      return updated;
    } catch { return null; }
  },

  deleteBook: async (bookId) => {
    try {
      await apiClient.delete(`/books/${bookId}`);
      set((s) => ({
        books: s.books.filter((b) => b.id !== bookId),
        volumes: s.volumes.filter((v) => v.bookId !== bookId),
      }));
      return true;
    } catch { return false; }
  },

  loadVolumes: async (bookId) => {
    try {
      const res = await apiClient.get(`/books/${bookId}/volumes`);
      const volumes = res.data?.data || [];
      set({ volumes });
      return volumes;
    } catch { return []; }
  },

  createVolume: async (bookId, data) => {
    try {
      const res = await apiClient.post(`/books/${bookId}/volumes`, data);
      const volume = res.data?.data;
      if (volume) {
        set((s) => ({ volumes: [...s.volumes, volume] }));
      }
      return volume;
    } catch { return null; }
  },

  updateVolume: async (volumeId, data) => {
    try {
      // 需要通过 bookId 找到正确的路由，从状态中推断
      const state = get();
      const vol = state.volumes.find(v => v.id === volumeId);
      if (!vol) return null;
      const res = await apiClient.patch(`/books/${vol.bookId}/volumes/${volumeId}`, data);
      const updated = res.data?.data;
      if (updated) {
        set((s) => ({
          volumes: s.volumes.map((v) => (v.id === volumeId ? { ...v, ...updated } : v)),
        }));
      }
      return updated;
    } catch { return null; }
  },

  deleteVolume: async (volumeId) => {
    try {
      const state = get();
      const vol = state.volumes.find(v => v.id === volumeId);
      if (!vol) return false;
      await apiClient.delete(`/books/${vol.bookId}/volumes/${volumeId}`);
      set((s) => ({
        volumes: s.volumes.filter((v) => v.id !== volumeId),
        chapters: s.chapters.filter((c) => c.volumeId !== volumeId),
      }));
      return true;
    } catch { return false; }
  },

  loadChapters: async (volumeId) => {
    try {
      const res = await apiClient.get(`/volumes/${volumeId}/chapters`);
      const chapters = res.data?.data || [];
      set({ chapters });
      return chapters;
    } catch { return []; }
  },

  createChapter: async (volumeId, data) => {
    try {
      const res = await apiClient.post(`/volumes/${volumeId}/chapters`, data);
      const chapter = res.data?.data;
      if (chapter) {
        set((s) => ({ chapters: [...s.chapters, chapter] }));
      }
      return chapter;
    } catch { return null; }
  },

  updateChapter: async (volumeId, chapterId, data) => {
    try {
      const res = await apiClient.patch(`/volumes/${volumeId}/chapters/${chapterId}`, data);
      const updated = res.data?.data;
      if (updated) {
        set((s) => ({
          chapters: s.chapters.map((c) => (c.id === chapterId ? { ...c, ...updated } : c)),
        }));
      }
      return updated;
    } catch { return null; }
  },

  deleteChapter: async (volumeId, chapterId) => {
    try {
      await apiClient.delete(`/volumes/${volumeId}/chapters/${chapterId}`);
      set((s) => ({
        chapters: s.chapters.filter((c) => c.id !== chapterId),
      }));
      return true;
    } catch { return false; }
  },
}));
