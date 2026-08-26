import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Request } from './request.entity';

@Entity('request_attachments')
export class RequestAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Request, (request) => request, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request: Request;

  @Column()
  file_name: string;

  @Column()
  file_path: string;

  @Column({ nullable: true })
  file_type: string;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  uploaded_at: Date;
}
