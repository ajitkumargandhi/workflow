import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Request } from './request.entity';

@Entity('request_fields')
export class RequestField {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Request, (request) => request, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request: Request;

  @Column()
  field_key: string;

  @Column({ type: 'text', nullable: true })
  field_value: string;
}
