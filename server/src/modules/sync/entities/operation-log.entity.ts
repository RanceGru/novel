// 离线操作日志实体
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

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

  @Column({ type: 'bigint', name: 'client_timestamp' })
  clientTimestamp: number;

  @Column({ type: 'boolean', default: false })
  synced: boolean;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;
}
