import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from 'src/redis/redis.module';
import { PlaceCategory } from 'src/common/enums/place-category.enum';
import { HotelConfigService } from './hotel-config.service';

const DEFAULT_RADIUS_METERS = 2000;
const CACHE_TTL_SECONDS = 5 * 24 * 60 * 60; // 5 ngày — danh sách quán/địa điểm gần
// khách sạn gần như không đổi trong vài ngày, cache dài để đỡ tốn quota Google Places.
const MAX_RESULTS = 10;

export interface NearbyPlace {
  name: string | null;
  address: string | null;
  rating: number | null;
  mapsUri: string | null;
  location: { latitude: number; longitude: number } | null;
}

interface GooglePlacesSearchNearbyResponse {
  places?: Array<{
    displayName?: { text?: string };
    formattedAddress?: string;
    rating?: number;
    googleMapsUri?: string;
    location?: { latitude: number; longitude: number };
  }>;
}

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    private readonly hotelConfigService: HotelConfigService,
  ) {}

  async getNearbyPlaces(
    category: PlaceCategory,
    radius: number = DEFAULT_RADIUS_METERS,
  ): Promise<NearbyPlace[]> {
    const cacheKey = `nearby:${category}:${radius}`;
    const cached = await this.redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as NearbyPlace[];
    }

    const places = await this.fetchFromGooglePlaces(category, radius);
    await this.redisClient.set(
      cacheKey,
      JSON.stringify(places),
      'EX',
      CACHE_TTL_SECONDS,
    );
    return places;
  }

  // Toạ độ khách sạn đổi (HotelConfigController gọi sau khi updateLocation() thành
  // công) -> mọi kết quả "địa điểm gần đây" đã cache đều tính từ tâm CŨ, không còn
  // đúng nữa. Cache key không mang theo toạ độ (chỉ category:radius) nên phải xoá
  // theo pattern thay vì tính lại đúng key — quét bằng KEYS chấp nhận được vì số
  // lượng entry tối đa chỉ bằng số PlaceCategory, không phải dữ liệu lớn.
  async invalidateNearbyCache(): Promise<void> {
    const keys = await this.redisClient.keys('nearby:*');
    if (keys.length > 0) {
      await this.redisClient.del(...keys);
    }
  }

  private async fetchFromGooglePlaces(
    category: PlaceCategory,
    radius: number,
  ): Promise<NearbyPlace[]> {
    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'Thiếu biến môi trường GOOGLE_PLACES_API_KEY',
      );
    }

    const hotelConfig = await this.hotelConfigService.getOrCreate();
    if (hotelConfig.latitude === 0 && hotelConfig.longitude === 0) {
      throw new BadRequestException(
        'Chưa cấu hình vị trí khách sạn — vui lòng cập nhật ở trang Cài đặt trước khi tra cứu địa điểm gần đây.',
      );
    }

    let response: Response;
    try {
      response = await fetch(
        'https://places.googleapis.com/v1/places:searchNearby',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
              'places.displayName,places.formattedAddress,places.rating,places.googleMapsUri,places.location',
          },
          body: JSON.stringify({
            includedTypes: [category],
            maxResultCount: MAX_RESULTS,
            locationRestriction: {
              circle: {
                center: {
                  latitude: hotelConfig.latitude,
                  longitude: hotelConfig.longitude,
                },
                radius,
              },
            },
          }),
        },
      );
    } catch (err) {
      this.logger.warn(
        `Google Places API unreachable: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new InternalServerErrorException(
        'Không thể kết nối tới Google Places lúc này',
      );
    }

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.warn(
        `Google Places API error ${response.status}: ${errorBody}`,
      );
      throw new InternalServerErrorException(
        'Không thể lấy dữ liệu địa điểm gần đây lúc này',
      );
    }

    const data = (await response.json()) as GooglePlacesSearchNearbyResponse;
    return (data.places ?? []).map((place) => ({
      name: place.displayName?.text ?? null,
      address: place.formattedAddress ?? null,
      rating: place.rating ?? null,
      mapsUri: place.googleMapsUri ?? null,
      location: place.location ?? null,
    }));
  }
}
