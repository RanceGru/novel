// Token 余额实体 — token_balances 表
import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';
import { bigintTransformer } from '../../../common/utils/transformers';

@Entity('token_balances')
export class TokenBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true, name: 'user_id' })
  userId: string;

  // bigintTransformer：Postgres 下 bigint 返回字符串，必须转换后才能参与算术
  @Column({ type: 'bigint', default: 0, name: 'purchased_tokens_remaining', transformer: bigintTransformer })
  purchasedTokensRemaining: number;

  @Column({ type: 'bigint', default: 0, name: 'lifetime_purchased_tokens', transformer: bigintTransformer })
  lifetimePurchasedTokens: number;

  @Column({ type: 'bigint', default: 0, name: 'lifetime_consumed_tokens', transformer: bigintTransformer })
  lifetimeConsumedTokens: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
