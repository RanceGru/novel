// 章节实体 — chapters 表
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { bigintTransformer } from '../../../common/utils/transformers';

@Entity('chapters')
export class Chapter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_chapters_volume')
  @Column({ type: 'uuid', name: 'volume_id' })
  volumeId: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'integer', name: 'chapter_number' })
  chapterNumber: number;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'text', nullable: true, name: 'chapter_outline' })
  chapterOutline: string | null;

  @Column({ type: 'text', nullable: true })
  instruction: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'integer', default: 0, name: 'word_count' })
  wordCount: number;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: string;

  @Column({ type: 'bigint', default: 1, name: 'sync_version', transformer: bigintTransformer })
  syncVersion: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
