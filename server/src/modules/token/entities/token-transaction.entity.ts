// Token 交易记录实体 — token_transactions 表
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('token_transactions')
export class TokenTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_token_tx_user_date')
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', nullable: true, name: 'book_id' })
  bookId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'chapter_id' })
  chapterId: string | null;

  @Column({ type: 'varchar', length: 30, name: 'transaction_type' })
  transactionType: string;

  @Column({ type: 'integer', name: 'tokens_consumed' })
  tokensConsumed: number;

  @Column({ type: 'varchar', length: 20 })
  source: string; // 'quota' | 'purchased'

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;
}
