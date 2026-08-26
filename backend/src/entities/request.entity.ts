import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Category } from './category.entity';

@Entity('requests')
export class Request {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  tracking_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requestor_id' })
  requestor: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'designated_manager_id' })
  designated_manager: User;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'Pending',
  })
  status: 'Pending' | 'Approved' | 'In Progress' | 'Rejected' | 'SentBack' | 'Fulfilled' | 'Closed';

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_cost: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 30, default: 'New Purchase' })
  fulfillment_type: string;

  @Column({ type: 'text', nullable: true })
  justification: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';

  @Column({ type: 'text', nullable: true })
  fulfillment_notes: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_agent_id' })
  assigned_agent: User;

  @Column({ type: 'timestamp with time zone', nullable: true })
  closed_at: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'closed_by_id' })
  closed_by: User;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
