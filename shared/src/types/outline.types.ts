// 纲树结构类型

/** 纲树层级 */
export type OutlineLevel = 'book_outline' | 'volume_outline' | 'chapter_outline';

/** 纲树节点 */
export interface Outline {
  id: string;
  bookId: string;
  level: OutlineLevel;
  volumeId: string | null;
  chapterId: string | null;
  title: string;
  content: string | null;
  parentId: string | null;
  sortOrder: number;
  syncVersion: number;
  children?: Outline[];
  createdAt: string;
  updatedAt: string;
}

/** 创建纲树节点请求 */
export interface CreateOutlineRequest {
  level: OutlineLevel;
  volumeId?: string;
  chapterId?: string;
  title: string;
  content?: string;
  parentId?: string;
  sortOrder?: number;
}

/** 更新纲树节点请求 */
export interface UpdateOutlineRequest {
  title?: string;
  content?: string;
  sortOrder?: number;
}
