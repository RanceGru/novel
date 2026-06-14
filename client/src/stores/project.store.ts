// 项目管理状态 (Zustand)
import { create } from 'zustand';

interface Book {
  id: string;
  title: string;
  wordCount: number;
  status: string;
  volumeCount?: number;
  updatedAt: string;
}

interface Volume {
  id: string;
  bookId: string;
  title: string;
  volumeNumber: number;
  status: string;
}

interface ChapterItem {
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

  setBooks: (books: Book[]) => void;
  setVolumes: (volumes: Volume[]) => void;
  setChapters: (chapters: ChapterItem[]) => void;
  setCurrentBook: (book: Book | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useProjectStore = create<ProjectState>()((set) => ({
  books: [],
  volumes: [],
  chapters: [],
  currentBook: null,
  loading: false,

  setBooks: (books) => set({ books }),
  setVolumes: (volumes) => set({ volumes }),
  setChapters: (chapters) => set({ chapters }),
  setCurrentBook: (book) => set({ currentBook: book }),
  setLoading: (loading) => set({ loading }),
}));
