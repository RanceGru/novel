// Token 套餐实体 — token_packages 表
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { bigintTransformer } from '../../../common/utils/transformers';

@Entity('token_packages')
export class TokenPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'bigint', name: 'token_amount', transformer: bigintTransformer })
  tokenAmount: number;

  @Column({ type: 'integer' })
  price: number; // 分 (CNY)

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'discount_label' })
  discountLabel: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'integer', default: 0, name: 'sort_order' })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
