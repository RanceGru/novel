// 书籍/卷/章节 类型定义

/** 作品状态 */
export type ProjectStatus = 'draft' | 'writing' | 'completed' | 'paused';

/** 书籍 (Book) */
export interface Book {
  id: string;
  userId: string;
  title: string;
  subtitle: string | null;
  author: string | null;
  description: string | null;
  coverUrl: string | null;
  wordCount: number;
  status: ProjectStatus;
  syncVersion: number;
  volumeCount?: number;
  chapterCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** 创建书籍请求 */
export interface CreateBookRequest {
  title: string;
  subtitle?: string;
  author?: string;
  description?: string;
}

/** 更新书籍请求 */
export interface UpdateBookRequest {
  title?: string;
  subtitle?: string;
  author?: string;
  description?: string;
  status?: ProjectStatus;
}

/** 卷 (Volume) */
export interface Volume {
  id: string;
  bookId: string;
  title: string;
  volumeNumber: number;
  summary: string | null;
  outlinePlan: string | null;
  status: ProjectStatus;
  syncVersion: number;
  chapterCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** 创建卷请求 */
export interface CreateVolumeRequest {
  title: string;
  volumeNumber: number;
  summary?: string;
  outlinePlan?: string;
}

/** 更新卷请求 */
export interface UpdateVolumeRequest {
  title?: string;
  summary?: string;
  outlinePlan?: string;
  status?: ProjectStatus;
}

/** 章节 (Chapter) */
export interface Chapter {
  id: string;
  volumeId: string;
  title: string;
  chapterNumber: number;
  content: string | null;
  chapterOutline: string | null;
  instruction: string | null;
  summary: string | null;
  wordCount: number;
  status: ProjectStatus;
  syncVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** 创建章节请求 */
export interface CreateChapterRequest {
  title: string;
  chapterNumber: number;
  chapterOutline?: string;
  instruction?: string;
  content?: string;
}

/** 更新章节请求 */
export interface UpdateChapterRequest {
  title?: string;
  chapterOutline?: string;
  instruction?: string;
  content?: string;
  summary?: string;
  status?: ProjectStatus;
}

/** 章节列表项 (精简信息) */
export interface ChapterListItem {
  id: string;
  volumeId: string;
  title: string;
  chapterNumber: number;
  wordCount: number;
  status: ProjectStatus;
  updatedAt: string;
}
