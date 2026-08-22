import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('Service')
export class Service {
  @PrimaryGeneratedColumn('uuid', { name: 'serviceId' })
  serviceId!: string;

  @Column({ name: 'name', length: 100 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'price', type: 'int' })
  price!: number;

  @Column({ name: 'unit', length: 30 })
  unit!: string; // VD: lần, đêm, người

  @Column({ name: 'isActive', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
