import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { QueryServiceDto } from './dto/query-service.dto';

@Injectable()
export class ServiceService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
  ) {}

  async findAllActive(query: QueryServiceDto): Promise<Service[]> {
    const qb = this.serviceRepo
      .createQueryBuilder('service')
      .where('service.isActive = :isActive', { isActive: true });

    if (query.search) {
      qb.andWhere('service.name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    return qb.orderBy('service.name', 'ASC').getMany();
  }

  async findByIdForAdmin(serviceId: string): Promise<Service> {
    const service = await this.serviceRepo.findOne({ where: { serviceId } });
    if (!service) {
      throw new NotFoundException('Không tìm thấy dịch vụ');
    }
    return service;
  }

  async findActiveById(serviceId: string): Promise<Service> {
    const service = await this.serviceRepo.findOne({
      where: { serviceId, isActive: true },
    });
    if (!service) {
      throw new NotFoundException(
        'Không tìm thấy dịch vụ hoặc dịch vụ đã ngưng cung cấp',
      );
    }
    return service;
  }

  async findActiveByIds(serviceIds: string[]): Promise<Service[]> {
    if (serviceIds.length === 0) return [];
    return this.serviceRepo.find({
      where: { serviceId: In(serviceIds), isActive: true },
    });
  }

  async create(dto: CreateServiceDto): Promise<Service> {
    const service = this.serviceRepo.create(dto);
    return this.serviceRepo.save(service);
  }

  async update(serviceId: string, dto: UpdateServiceDto): Promise<Service> {
    const service = await this.findByIdForAdmin(serviceId);
    Object.assign(service, dto);
    return this.serviceRepo.save(service);
  }

  async softDelete(serviceId: string): Promise<{ message: string }> {
    const service = await this.findByIdForAdmin(serviceId);
    service.isActive = false;
    await this.serviceRepo.save(service);
    return { message: 'Đã ngưng cung cấp dịch vụ' };
  }
}
