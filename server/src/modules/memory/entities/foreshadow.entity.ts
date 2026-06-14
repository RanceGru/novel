// 伏笔实体 — foreshadows 表
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('foreshadows')
export class Foreshadow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, default: 'minor' })
  type: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'uuid', nullable: true, name: 'planted_chapter_id' })
  plantedChapterId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'resolved_chapter_id' })
  resolvedChapterId: string | null;

  @Column({ type: 'text', nullable: true, name: 'progress_notes' })
  progressNotes: string | null;

  @Column({ type: 'datetime', nullable: true, name: 'resolved_at' })
  resolvedAt: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;
}
