import { UserRole } from 'src/common/enums/user-role.enum';
import { UserStatus } from 'src/common/enums/user-status.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('User')
export class User {
  @PrimaryGeneratedColumn('uuid', { name: 'userId' })
  userId!: string;

  @Column({ name: 'fullName', length: 100 })
  fullName!: string;

  @Column({ name: 'email', length: 100, unique: true })
  email!: string;

  @Column({ name: 'phone', length: 15, nullable: true, unique: true })
  phone!: string;

  @Column({ name: 'idNumber', length: 20, nullable: true })
  idNumber!: string; // CMND/CCCD/Passport

  @Column({ name: 'address', length: 255, nullable: true })
  address!: string;

  @Column({
    name: 'role',
    type: 'enum',
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role!: UserRole;

  @Column({
    name: 'status',
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
