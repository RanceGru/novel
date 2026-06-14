// 记忆事件实体 — events 表
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('memory_events')
export class MemoryEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_events_book')
  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @Column({ type: 'uuid', nullable: true, name: 'chapter_id' })
  chapterId: string | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'event_type' })
  eventType: string | null;

  @Column({ type: 'integer', default: 5 })
  importance: number;

  @Column({ type: 'simple-json', nullable: true })
  embedding: number[] | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;
}
