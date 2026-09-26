// useBookActions — 书籍/分卷/章节 CRUD 操作Hook
// 从 LeftSidebar 中提取 CRUD 逻辑，供组件调用
import { useCallback } from 'react';
import { useProjectStore } from '../stores/project.store';

export function useBookActions() {
  const store = useProjectStore();

  // ====== 书籍操作 ======
  const loadBooks = useCallback(async () => {
    try {
      await store.loadBooks();
    } catch (err) {
      console.error('加载书籍失败:', err);
      // 1秒后自动重试
      setTimeout(() => store.loadBooks(), 1000);
    }
  }, [store]);

  const handleCreateBook = useCallback(async (data: {
    title: string; author?: string; description?: string; coverUrl?: string;
  }) => {
    return store.createBook(data);
  }, [store]);

  const handleUpdateBook = useCallback(async (bookId: string, data: {
    title?: string; author?: string; subtitle?: string; coverUrl?: string;
  }) => {
    return store.updateBook(bookId, data);
  }, [store]);

  const handleDeleteBook = useCallback(async (bookId: string) => {
    return store.deleteBook(bookId);
  }, [store]);

  // ====== 分卷操作 ======
  const loadVolumes = useCallback(async (bookId: string) => {
    return store.loadVolumes(bookId);
  }, [store]);

  const handleCreateVolume = useCallback(async (bookId: string, title: string) => {
    const vols = store.volumes.filter(v => v.bookId === bookId);
    const nextNumber = vols.length > 0 ? Math.max(...vols.map(v => v.volumeNumber)) + 1 : 1;
    return store.createVolume(bookId, { title, volumeNumber: nextNumber });
  }, [store]);

  const handleRenameVolume = useCallback(async (volumeId: string, title: string) => {
    return store.updateVolume(volumeId, { title });
  }, [store]);

  const handleDeleteVolume = useCallback(async (volumeId: string) => {
    return store.deleteVolume(volumeId);
  }, [store]);

  // ====== 章节操作 ======
  const loadChapters = useCallback(async (volumeId: string) => {
    return store.loadChapters(volumeId);
  }, [store]);

  const handleCreateChapter = useCallback(async (
    volumeId: string, title: string, chapterNumber: number,
  ) => {
    return store.createChapter(volumeId, {
      title,
      chapterNumber,
      chapterOutline: '',
      instruction: '',
    });
  }, [store]);

  const handleRenameChapter = useCallback(async (
    volumeId: string, chapterId: string, title: string,
  ) => {
    return store.updateChapter(volumeId, chapterId, { title });
  }, [store]);

  const handleDeleteChapter = useCallback(async (volumeId: string, chapterId: string) => {
    return store.deleteChapter(volumeId, chapterId);
  }, [store]);

  return {
    loadBooks,
    handleCreateBook,
    handleUpdateBook,
    handleDeleteBook,
    loadVolumes,
    handleCreateVolume,
    handleRenameVolume,
    handleDeleteVolume,
    loadChapters,
    handleCreateChapter,
    handleRenameChapter,
    handleDeleteChapter,
  };
}
