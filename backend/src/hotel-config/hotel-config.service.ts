import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { HotelConfig } from './entities/hotel-config.entity';
import { UpdateHotelLocationDto } from './dto/update-hotel-location.dto';

// ID cố định cho bản ghi singleton — thay vì "find 1 dòng bất kỳ rồi tạo mới nếu rỗng"
// (2 request đồng thời lúc bảng còn rỗng có thể cùng thấy rỗng và cùng tạo, ra 2 dòng),
// khoá cứng vào đúng 1 PK để lần tạo thứ 2 luôn đụng UNIQUE constraint của PK thay vì
// lọt qua thành bản ghi thứ hai.
const SINGLETON_CONFIG_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class HotelConfigService {
  constructor(
    @InjectRepository(HotelConfig)
    private readonly hotelConfigRepo: Repository<HotelConfig>,
  ) {}

  // Bảng chỉ có đúng 1 bản ghi — tự tạo bản ghi mặc định (chưa có toạ độ thật) nếu
  // bảng còn rỗng, thay vì bắt buộc chạy 1 script seed riêng trước khi tính năng chạy
  // được. Toạ độ mặc định 0,0 chỉ là placeholder, admin phải cập nhật ở trang Cài đặt
  // trước khi PlacesService tra cứu được địa điểm gần đây thật sự.
  async getOrCreate(): Promise<HotelConfig> {
    const existing = await this.hotelConfigRepo.findOne({
      where: { configId: SINGLETON_CONFIG_ID },
    });
    if (existing) return existing;

    try {
      return await this.hotelConfigRepo.save(
        this.hotelConfigRepo.create({
          configId: SINGLETON_CONFIG_ID,
          address: '',
          latitude: 0,
          longitude: 0,
          googlePlaceId: null,
        }),
      );
    } catch (err) {
      // 2 request cùng thấy bảng rỗng và cùng tạo -> request thua đụng UNIQUE(configId),
      // dòng thắng đã có sẵn, chỉ cần đọc lại thay vì để lỗi 500 lọt ra ngoài.
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code?: string }).code === '23505'
      ) {
        return this.hotelConfigRepo.findOneOrFail({
          where: { configId: SINGLETON_CONFIG_ID },
        });
      }
      throw err;
    }
  }

  async updateLocation(dto: UpdateHotelLocationDto): Promise<HotelConfig> {
    const config = await this.getOrCreate();
    config.address = dto.address;
    config.latitude = dto.latitude;
    config.longitude = dto.longitude;
    config.googlePlaceId = dto.googlePlaceId ?? null;
    return this.hotelConfigRepo.save(config);
  }
}
