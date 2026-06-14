// Token 余额实体 — token_balances 表
import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('token_balances')
export class TokenBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true, name: 'user_id' })
  userId: string;

  @Column({ type: 'bigint', default: 0, name: 'purchased_tokens_remaining' })
  purchasedTokensRemaining: number;

  @Column({ type: 'bigint', default: 0, name: 'lifetime_purchased_tokens' })
  lifetimePurchasedTokens: number;

  @Column({ type: 'bigint', default: 0, name: 'lifetime_consumed_tokens' })
  lifetimeConsumedTokens: number;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;
}
