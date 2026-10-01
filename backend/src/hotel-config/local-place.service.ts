import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalPlace } from './entities/local-place.entity';
import { CreateLocalPlaceDto } from './dto/create-local-place.dto';
import { UpdateLocalPlaceDto } from './dto/update-local-place.dto';
import { LocalPlaceStatus } from 'src/common/enums/local-place-status.enum';

@Injectable()
export class LocalPlaceService {
  constructor(
    @InjectRepository(LocalPlace)
    private readonly localPlaceRepo: Repository<LocalPlace>,
  ) {}

  findAll(): Promise<LocalPlace[]> {
    return this.localPlaceRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findByIdForAdmin(placeId: string): Promise<LocalPlace> {
    const place = await this.localPlaceRepo.findOne({ where: { placeId } });
    if (!place) {
      throw new NotFoundException('Không tìm thấy địa điểm');
    }
    return place;
  }

  // Tạo thủ công qua form CRUD admin luôn APPROVED ngay (default của entity) — CreateLocalPlaceDto
  // bắt buộc đủ address/latitude/longitude nên không cần qua approve() như dòng AI đề xuất.
  async create(dto: CreateLocalPlaceDto): Promise<LocalPlace> {
    const place = this.localPlaceRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });
    return this.localPlaceRepo.save(place);
  }

  // Cũng là nơi admin bổ sung address/latitude/longitude cho 1 dòng AI đề xuất đang PENDING
  // (qua ô Vietmap Autocomplete trong card "Chờ duyệt") — chỉ ghi đè field thực sự có mặt
  // trong dto, không đụng tới field khác.
  async update(placeId: string, dto: UpdateLocalPlaceDto): Promise<LocalPlace> {
    const place = await this.findByIdForAdmin(placeId);
    place.name = dto.name ?? place.name;
    place.description = dto.description ?? place.description;
    place.address = dto.address ?? place.address;
    place.latitude = dto.latitude ?? place.latitude;
    place.longitude = dto.longitude ?? place.longitude;
    return this.localPlaceRepo.save(place);
  }

  async remove(placeId: string): Promise<{ message: string }> {
    const place = await this.findByIdForAdmin(placeId);
    await this.localPlaceRepo.remove(place);
    return { message: 'Đã xoá địa điểm' };
  }

  // Chuyển 1 dòng do AI đề xuất (source = AI_SUGGESTED, status = PENDING) sang APPROVED —
  // chỉ sau bước này get_local_highlights (findApproved bên dưới) mới thấy được. Bắt buộc
  // đủ address/latitude/longitude: 1 địa điểm APPROVED mà thiếu toạ độ sẽ khiến agent giới
  // thiệu cho khách một chỗ không biết ở đâu — kiểm tra lại ở server dù UI đã disable nút
  // "Duyệt" khi chưa chọn địa chỉ, vì UI chỉ là tiện lợi, không phải nguồn sự thật.
  async approve(placeId: string): Promise<LocalPlace> {
    const place = await this.findByIdForAdmin(placeId);
    const hasAddress =
      Boolean(place.address) &&
      place.latitude !== null &&
      place.longitude !== null;
    if (!hasAddress) {
      throw new BadRequestException(
        'Địa điểm chưa có địa chỉ, vui lòng chọn địa chỉ trên bản đồ trước khi duyệt.',
      );
    }
    place.status = LocalPlaceStatus.APPROVED;
    return this.localPlaceRepo.save(place);
  }

  // Dùng trực tiếp bởi ai-agent (tool get_local_highlights), không qua HTTP. status =
  // APPROVED bắt buộc: địa điểm AI đề xuất còn PENDING (chưa admin duyệt) TUYỆT ĐỐI không
  // được lộ ra cho khách qua trợ lý AI.
  findApproved(): Promise<LocalPlace[]> {
    return this.localPlaceRepo.find({
      where: { status: LocalPlaceStatus.APPROVED },
      order: { createdAt: 'DESC' },
    });
  }
}
