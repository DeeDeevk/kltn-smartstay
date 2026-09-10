import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShiftType } from './entities/shift-type.entity';
import { ShiftAssignment } from './entities/shift-assignment.entity';
import { CreateShiftTypeDto } from './dto/create-shift-type.dto';
import { UpdateShiftTypeDto } from './dto/update-shift-type.dto';

@Injectable()
export class ShiftTypeService {
  constructor(
    @InjectRepository(ShiftType)
    private readonly shiftTypeRepo: Repository<ShiftType>,
    @InjectRepository(ShiftAssignment)
    private readonly shiftAssignmentRepo: Repository<ShiftAssignment>,
  ) {}

  findAll(): Promise<ShiftType[]> {
    return this.shiftTypeRepo.find({ order: { startTime: 'ASC' } });
  }

  async findByIdOrThrow(shiftTypeId: string): Promise<ShiftType> {
    const shiftType = await this.shiftTypeRepo.findOne({
      where: { shiftTypeId },
    });
    if (!shiftType) {
      throw new NotFoundException('Không tìm thấy loại ca');
    }
    return shiftType;
  }

  create(dto: CreateShiftTypeDto): Promise<ShiftType> {
    const shiftType = this.shiftTypeRepo.create(dto);
    return this.shiftTypeRepo.save(shiftType);
  }

  async update(
    shiftTypeId: string,
    dto: UpdateShiftTypeDto,
  ): Promise<ShiftType> {
    await this.findByIdOrThrow(shiftTypeId);
    await this.shiftTypeRepo.update({ shiftTypeId }, dto);
    return this.findByIdOrThrow(shiftTypeId);
  }

  async remove(shiftTypeId: string): Promise<{ message: string }> {
    await this.findByIdOrThrow(shiftTypeId);

    // FK ShiftAssignment.shiftTypeId dùng onDelete: RESTRICT — kiểm tra trước để
    // trả lỗi rõ ràng thay vì để DB ném lỗi khoá ngoại chung chung.
    const usageCount = await this.shiftAssignmentRepo.count({
      where: { shiftType: { shiftTypeId } },
    });
    if (usageCount > 0) {
      throw new ConflictException(
        'Loại ca đang được dùng trong lịch phân ca, không thể xoá',
      );
    }

    await this.shiftTypeRepo.delete({ shiftTypeId });
    return { message: 'Đã xoá loại ca' };
  }
}
