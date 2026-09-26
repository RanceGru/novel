// 风格锚点实体 — style_anchors 表
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('style_anchors')
export class StyleAnchor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @Column({ type: 'uuid', nullable: true, name: 'chapter_id' })
  chapterId: string | null;

  @Column({ type: 'simple-json', nullable: true, name: 'style_features' })
  styleFeatures: Record<string, any> | null;

  @Column({ type: 'text', nullable: true, name: 'sample_text' })
  sampleText: string | null;

  // 向量列：simple-json 存储（Postgres 下为 text），不依赖 pgvector 扩展。
  // 启用原生检索时迁移为 vector(1536)，详见 VectorSearchService 的接口说明。
  @Column({ type: 'simple-json', nullable: true })
  embedding: number[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
