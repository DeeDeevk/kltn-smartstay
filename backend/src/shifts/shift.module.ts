import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftType } from './entities/shift-type.entity';
import { ShiftAssignment } from './entities/shift-assignment.entity';
import { ShiftTypeService } from './shift-type.service';
import { ShiftTypeController } from './shift-type.controller';
import { ShiftAssignmentService } from './shift-assignment.service';
import { ShiftAssignmentController } from './shift-assignment.controller';
import { ShiftAutoCloseJob } from './shift-auto-close.job';
import { UserModule } from '../users/user.module';
import { CashLedgerModule } from '../cash-ledger/cash-ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShiftType, ShiftAssignment]),
    UserModule,
    CashLedgerModule,
  ],
  controllers: [ShiftTypeController, ShiftAssignmentController],
  providers: [ShiftTypeService, ShiftAssignmentService, ShiftAutoCloseJob],
  exports: [ShiftAssignmentService],
})
export class ShiftModule {}
