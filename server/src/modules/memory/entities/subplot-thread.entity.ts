// 支线线程实体 — subplot_threads 表
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('subplot_threads')
export class SubplotThread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'uuid', nullable: true, name: 'started_chapter_id' })
  startedChapterId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'ended_chapter_id' })
  endedChapterId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
