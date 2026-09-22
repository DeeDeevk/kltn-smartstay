import { Inject, Injectable, Logger } from '@nestjs/common';
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

// Structured result instead of a bare array: the AI agent needs to tell "hotel location
// not configured yet" and "Google Places temporarily unavailable" apart from a genuine
// empty result, and must never present a hardcoded/fabricated place list as if it were
// real live data (that could send a paying guest looking for a restaurant that doesn't
// exist). `source` lets the agent phrase its answer honestly:
//  - 'live'/'cache': real data, safe to quote by name.
//  - 'unavailable': no real data available right now — `places` is always empty; the
//    agent must say so plainly instead of inventing place names.
export interface NearbyPlacesResult {
  configured: boolean;
  source: 'live' | 'cache' | 'unavailable';
  places: NearbyPlace[];
  message?: string;
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
  ): Promise<NearbyPlacesResult> {
    // Check configuration BEFORE touching cache/Google — a hotel that has never set its
    // location has nothing meaningful to search around, regardless of what's cached.
    const hotelConfig = await this.hotelConfigService.getOrCreate();
    if (hotelConfig.latitude === 0 && hotelConfig.longitude === 0) {
      return {
        configured: false,
        source: 'unavailable',
        places: [],
        message:
          'Hotel location has not been configured yet (Admin > Cài đặt vị trí khách sạn).',
      };
    }

    const cacheKey = `nearby:${category}:${radius}`;
    const cached = await this.redisClient.get(cacheKey);
    if (cached) {
      return {
        configured: true,
        source: 'cache',
        places: JSON.parse(cached) as NearbyPlace[],
      };
    }

    try {
      const places = await this.fetchFromGooglePlaces(
        hotelConfig.latitude,
        hotelConfig.longitude,
        category,
        radius,
      );
      await this.redisClient.set(
        cacheKey,
        JSON.stringify(places),
        'EX',
        CACHE_TTL_SECONDS,
      );
      return { configured: true, source: 'live', places };
    } catch (err) {
      // Google Places down/misconfigured -> fall back to an honest "unavailable" result
      // instead of throwing. We deliberately do NOT hardcode a fake place list here: a
      // hotel assistant naming a specific restaurant/cafe that doesn't actually exist
      // near the hotel is worse than saying "can't check right now". Do not cache this
      // failure, so the next request retries against Google instead of getting stuck.
      this.logger.warn(
        `getNearbyPlaces fallback for category=${category}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        configured: true,
        source: 'unavailable',
        places: [],
        message: 'Could not fetch live nearby-places data right now.',
      };
    }
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

  // Throws a plain Error on any failure (missing key, network, non-2xx) — the caller
  // (getNearbyPlaces) turns that into a graceful 'unavailable' result, never a fabricated
  // place list. Latitude/longitude are passed in explicitly so this stays a pure "call
  // Google with these coordinates" function, not responsible for re-reading HotelConfig.
  private async fetchFromGooglePlaces(
    latitude: number,
    longitude: number,
    category: PlaceCategory,
    radius: number,
  ): Promise<NearbyPlace[]> {
    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new Error('Missing GOOGLE_PLACES_API_KEY environment variable');
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
                center: { latitude, longitude },
                radius,
              },
            },
          }),
        },
      );
    } catch (err) {
      throw new Error(
        `Google Places API unreachable: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Google Places API error ${response.status}: ${errorBody}`,
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
