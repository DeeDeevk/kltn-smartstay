import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ServiceCategory } from 'src/common/enums/service-category.enum';

@Entity('Service')
export class Service {
  @PrimaryGeneratedColumn('uuid', { name: 'serviceId' })
  serviceId!: string;

  @Column({ name: 'name', length: 100 })
  name!: string;

  // Nhóm hiển thị ở màn Check-out: Minibar (đồ trong phòng) vs Dịch vụ khác.
  @Column({
    name: 'category',
    type: 'enum',
    enum: ServiceCategory,
    default: ServiceCategory.SERVICE,
  })
  category!: ServiceCategory;

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
