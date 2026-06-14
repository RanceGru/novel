// 版本管理类型

/** 版本来源 */
export type VersionSource =
  | 'ai_generate'
  | 'manual_save'
  | 'auto_save'
  | 'review_dehumanize'
  | 'revert'
  | 'import';

/** 章节版本 */
export interface ChapterVersion {
  id: string;
  chapterId: string;
  bookId: string;
  userId: string;
  versionNumber: number;
  content: string;
  contentPreview: string; // 前200字
  wordCount: number;
  wordDiff: number;
  label: string | null;
  source: VersionSource;
  createdAt: string;
}

/** 版本差异 */
export interface VersionDiff {
  leftVersionId: string;
  leftVersionNumber: number;
  rightVersionId: string;
  rightVersionNumber: number;
  diffs: Array<{
    type: 'equal' | 'insert' | 'delete';
    text: string;
    leftPosition?: { start: number; end: number };
    rightPosition?: { start: number; end: number };
  }>;
}
