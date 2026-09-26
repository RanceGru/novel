// 记忆事件实体 — memory_events 表
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

  // 向量列。当前以 simple-json 存储（Postgres 下映射为 text），因此不依赖 pgvector 扩展。
  // 待启用原生向量检索时，改为 vector(1536) 或执行：
  //   ALTER TABLE memory_events ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector;
  // 详见 VectorSearchService 的接口说明。
  @Column({ type: 'simple-json', nullable: true })
  embedding: number[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
