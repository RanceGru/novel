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

  // 章节纲（快照）：生成正文时实际使用的纲内容。
  // 权威源在纲树的 outlines.content；此处是生成那一刻的副本，不会被章纲的后续修改自动覆盖。
  @Column({ type: 'text', nullable: true, name: 'chapter_outline' })
  chapterOutline: string | null;

  // 生成时章纲内容的指纹（sha256 十六进制）。与纲树当前章纲不一致时，说明章纲已改动，
  // 前端据此提示用户，但不自动改动已生成的正文。
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'outline_hash' })
  outlineHash: string | null;

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
