// 离线操作日志实体
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { bigintTransformer } from '../../../common/utils/transformers';

@Entity('operation_logs')
export class OperationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @Column({ type: 'varchar', length: 50, name: 'entity_type' })
  entityType: string;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  @Column({ type: 'varchar', length: 20 })
  operation: string; // INSERT / UPDATE / DELETE

  @Column({ type: 'text', nullable: true })
  payload: string | null; // JSON

  // 毫秒时间戳，Postgres 下 bigint 返回字符串，需转换后才能参与 new Date()
  @Column({ type: 'bigint', name: 'client_timestamp', transformer: bigintTransformer })
  clientTimestamp: number;

  @Column({ type: 'boolean', default: false })
  synced: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
