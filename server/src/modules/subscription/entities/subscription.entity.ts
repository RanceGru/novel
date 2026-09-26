// 订阅实体 — subscriptions 表
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { dateColumnType } from '../../../common/utils/column-types';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 20, default: 'free' })
  tier: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: dateColumnType(), name: 'started_at' })
  startedAt: Date;

  @Column({ type: dateColumnType(), nullable: true, name: 'expires_at' })
  expiresAt: Date | null;

  @Column({ type: 'boolean', default: true, name: 'auto_renew' })
  autoRenew: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'payment_provider' })
  paymentProvider: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'provider_subscription_id' })
  providerSubscriptionId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
