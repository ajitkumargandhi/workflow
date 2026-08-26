import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Request } from './request.entity';
import { User } from './user.entity';

@Entity('request_updates')
export class RequestUpdate {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Request, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request: Request;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'agent_id' })
  agent: User;

  @Column({ type: 'varchar', length: 20, nullable: true })
  status: string;

  @Column({ type: 'text' })
  note: string;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;
}
