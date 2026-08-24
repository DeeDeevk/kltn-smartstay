import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AuthProvider } from '../enums/auth-provider.enum';

@Entity('Account')
@Unique(['provider', 'providerAccountId'])
export class Account {
  @PrimaryGeneratedColumn('uuid', { name: 'accountId' })
  accountId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ name: 'provider', type: 'enum', enum: AuthProvider })
  provider!: AuthProvider;

  // LOCAL: lưu email; GOOGLE: lưu Google account id (sub)
  @Column({ name: 'providerAccountId', length: 255 })
  providerAccountId!: string;

  // Chỉ có giá trị với provider LOCAL, null với GOOGLE
  @Column({ name: 'password', type: 'varchar', length: 255, nullable: true })
  password!: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
