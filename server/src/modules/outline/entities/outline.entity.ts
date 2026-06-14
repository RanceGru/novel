// 纲树实体 — outlines 表
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('outlines')
export class Outline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @Column({ type: 'varchar', length: 20 })
  level: string; // 'book_outline' | 'volume_outline' | 'chapter_outline'

  @Column({ type: 'uuid', nullable: true, name: 'volume_id' })
  volumeId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'chapter_id' })
  chapterId: string | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'parent_id' })
  parentId: string | null;

  @Column({ type: 'integer', default: 0, name: 'sort_order' })
  sortOrder: number;

  @Column({ type: 'bigint', default: 1, name: 'sync_version' })
  syncVersion: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;
}
