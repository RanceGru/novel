// 章节版本实体 — chapter_versions 表
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('chapter_versions')
export class ChapterVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_versions_chapter')
  @Column({ type: 'uuid', name: 'chapter_id' })
  chapterId: string;

  @Index('idx_versions_book')
  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'integer', name: 'version_number' })
  versionNumber: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true, name: 'content_preview' })
  contentPreview: string | null;

  @Column({ type: 'integer', default: 0, name: 'word_count' })
  wordCount: number;

  @Column({ type: 'integer', default: 0, name: 'word_diff' })
  wordDiff: number;

  @Column({ type: 'text', nullable: true })
  label: string | null;

  @Column({ type: 'varchar', length: 30, default: 'manual' })
  source: string;

  @Column({ type: 'text', nullable: true, name: 'diff_with_previous' })
  diffWithPrevious: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
