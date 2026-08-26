import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Category } from './category.entity';
import { Role } from './role.entity';

@Entity('workflow_steps')
export class WorkflowStep {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column()
  step_order: number;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'approver_role_id' })
  approver_role: Role;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  min_cost_threshold: number;

  @Column({ default: true })
  is_mandatory: boolean;
}
