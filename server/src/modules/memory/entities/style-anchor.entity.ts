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

  @Column({ type: 'simple-json', nullable: true })
  embedding: number[] | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;
}
