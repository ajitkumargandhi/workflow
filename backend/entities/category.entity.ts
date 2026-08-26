import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => Category, (category) => category)
  @JoinColumn({ name: 'parent_id' })
  parent: Category;

  @Column({ default: true })
  is_active: boolean;
}
