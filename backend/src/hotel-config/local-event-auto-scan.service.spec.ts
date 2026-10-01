import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { LocalEventAutoScanService } from './local-event-auto-scan.service';
import { LocalEvent } from './entities/local-event.entity';
import { EventScanRun } from './entities/event-scan-run.entity';
import { HotelConfigService } from './hotel-config.service';
import { GeminiProvider } from '../ai-agent/llm/gemini.provider';
import { LocalEventExtractionService } from './local-event-extraction.service';
import { EventRecurrence } from 'src/common/enums/event-recurrence.enum';
import { EventScanTriggeredBy } from 'src/common/enums/event-scan-triggered-by.enum';
import { EventScanStatus } from 'src/common/enums/event-scan-status.enum';

const CONFIGURED_HOTEL = {
  address: '123 Trần Phú, Nha Trang',
  latitude: 12.23,
  longitude: 109.19,
};
const UNCONFIGURED_HOTEL = { address: '', latitude: 0, longitude: 0 };

function buildService(overrides?: {
  existingEvents?: Partial<LocalEvent>[];
  hotelConfig?: typeof CONFIGURED_HOTEL | typeof UNCONFIGURED_HOTEL;
  generateWithSearch?: jest.Mock;
  extractDrafts?: jest.Mock;
  lockAcquired?: boolean;
}) {
  // Giữ riêng từng mock dưới dạng jest.Mock thuần (không lấy lại qua object đã ép kiểu
  // sang class thật bên dưới) để dùng trong expect(...) — tham chiếu 1 method lấy thẳng từ
  // object đã cast sang class thật bị @typescript-eslint/unbound-method cảnh báo "mất this
  // khi tách khỏi object", dù ở đây toàn bộ đều là mock nên không áp dụng (cùng cách đã xử
  // lý ở review.service.spec.ts).
  const localEventSave = jest.fn((x: unknown) =>
    Promise.resolve(Array.isArray(x) ? x : [x]),
  );
  const scanRunSave = jest.fn((x: unknown) => Promise.resolve(x));
  const generateWithSearch =
    overrides?.generateWithSearch ??
    jest.fn().mockResolvedValue({ text: 'không có gì', citations: [] });
  const extractDraftsFromContent =
    overrides?.extractDrafts ?? jest.fn().mockResolvedValue([]);

  const localEventRepo = {
    find: jest.fn().mockResolvedValue(overrides?.existingEvents ?? []),
    create: jest.fn((x: unknown) => x),
    save: localEventSave,
  } as unknown as Repository<LocalEvent>;

  const scanRunRepo = {
    create: jest.fn((x: unknown) => x),
    save: scanRunSave,
  } as unknown as Repository<EventScanRun>;

  const redisClient = {
    set: jest
      .fn()
      .mockResolvedValue(overrides?.lockAcquired === false ? null : 'OK'),
    del: jest.fn().mockResolvedValue(1),
  } as unknown as Redis;

  const hotelConfigService = {
    getOrCreate: jest
      .fn()
      .mockResolvedValue(overrides?.hotelConfig ?? CONFIGURED_HOTEL),
  } as unknown as HotelConfigService;

  const geminiProvider = {
    generateWithSearch,
  } as unknown as GeminiProvider;

  const extractionService = {
    extractDraftsFromContent,
  } as unknown as LocalEventExtractionService;

  const service = new LocalEventAutoScanService(
    localEventRepo,
    scanRunRepo,
    redisClient,
    hotelConfigService,
    geminiProvider,
    extractionService,
  );

  return {
    service,
    localEventSave,
    scanRunSave,
    generateWithSearch,
    extractDraftsFromContent,
  };
}

describe('LocalEventAutoScanService — validate khoảng ngày', () => {
  it('từ chối khi toDate không sau fromDate', async () => {
    const { service } = buildService();
    await expect(
      service.scan(
        '2026-10-10',
        '2026-10-10',
        EventScanTriggeredBy.MANUAL,
        'u1',
      ),
    ).rejects.toThrow('Ngày kết thúc phải sau ngày bắt đầu');
  });

  it('từ chối khi toDate trước fromDate', async () => {
    const { service } = buildService();
    await expect(
      service.scan(
        '2026-10-10',
        '2026-10-05',
        EventScanTriggeredBy.MANUAL,
        'u1',
      ),
    ).rejects.toThrow('Ngày kết thúc phải sau ngày bắt đầu');
  });

  it('từ chối khi khoảng ngày vượt quá 60 ngày', async () => {
    const { service } = buildService();
    await expect(
      service.scan(
        '2026-10-01',
        '2026-12-05',
        EventScanTriggeredBy.MANUAL,
        'u1',
      ),
    ).rejects.toThrow('phải từ 1 đến 60 ngày');
  });

  it('chấp nhận khoảng ngày đúng biên 60 ngày', async () => {
    const { service, scanRunSave } = buildService();
    await service.scan(
      '2026-10-01',
      '2026-11-30',
      EventScanTriggeredBy.MANUAL,
      'u1',
    );
    expect(scanRunSave).toHaveBeenCalledTimes(1);
  });
});

describe('LocalEventAutoScanService — khoá chạy đơn', () => {
  it('từ chối ngay nếu đang có lượt quét khác chạy, không gọi Gemini', async () => {
    const { service, generateWithSearch } = buildService({
      lockAcquired: false,
    });
    await expect(
      service.scan(
        '2026-10-01',
        '2026-10-07',
        EventScanTriggeredBy.MANUAL,
        'u1',
      ),
    ).rejects.toThrow('Đang có một lượt quét sự kiện khác chạy');
    expect(generateWithSearch).not.toHaveBeenCalled();
  });
});

describe('LocalEventAutoScanService — HotelConfig chưa cấu hình', () => {
  it('ghi EventScanRun FAILED và KHÔNG gọi Gemini khi chưa cấu hình địa chỉ', async () => {
    const { service, scanRunSave, generateWithSearch } = buildService({
      hotelConfig: UNCONFIGURED_HOTEL,
    });

    const run = await service.scan(
      '2026-10-01',
      '2026-10-07',
      EventScanTriggeredBy.MANUAL,
      'u1',
    );

    expect(generateWithSearch).not.toHaveBeenCalled();
    expect(scanRunSave).toHaveBeenCalledTimes(1);
    expect(run).toMatchObject({
      status: EventScanStatus.FAILED,
      createdEventsCount: 0,
      skippedDuplicateCount: 0,
    });
    expect(run.errorMessage).toContain('Chưa cấu hình địa chỉ');
  });
});

describe('LocalEventAutoScanService — lỗi khi gọi Gemini search-grounding', () => {
  it('ghi EventScanRun FAILED khi generateWithSearch luôn lỗi', async () => {
    const generateWithSearch = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('bad request'), { status: 400 }),
      );
    const { service, scanRunSave } = buildService({ generateWithSearch });

    const run = await service.scan(
      '2026-10-01',
      '2026-10-07',
      EventScanTriggeredBy.CRON,
      null,
    );

    expect(run.status).toBe(EventScanStatus.FAILED);
    expect(run.triggeredByUserId).toBeNull();
    expect(scanRunSave).toHaveBeenCalledTimes(1);
  });
});

describe('LocalEventAutoScanService — chống trùng', () => {
  it('bỏ qua draft trùng title + specificDate với sự kiện ONCE đã có (bất kỳ status)', async () => {
    const extractDrafts = jest.fn().mockResolvedValue([
      {
        title: '  Lễ Hội Ánh Sáng  ',
        description: null,
        recurrence: EventRecurrence.ONCE,
        dayOfWeek: null,
        specificDate: '2026-10-05',
      },
    ]);
    const { service, scanRunSave, localEventSave } = buildService({
      existingEvents: [
        {
          title: 'lễ hội ánh sáng',
          specificDate: '2026-10-05',
          dayOfWeek: null,
        },
      ],
      extractDrafts,
    });

    const run = await service.scan(
      '2026-10-01',
      '2026-10-07',
      EventScanTriggeredBy.MANUAL,
      'u1',
    );

    expect(localEventSave).not.toHaveBeenCalled();
    expect(run.createdEventsCount).toBe(0);
    expect(run.skippedDuplicateCount).toBe(1);
    expect(scanRunSave).toHaveBeenCalledTimes(1);
  });

  it('bỏ qua draft trùng title + dayOfWeek với sự kiện WEEKLY đã có', async () => {
    const extractDrafts = jest.fn().mockResolvedValue([
      {
        title: 'Chợ đêm',
        description: null,
        recurrence: EventRecurrence.WEEKLY,
        dayOfWeek: 6,
        specificDate: null,
      },
    ]);
    const { service, localEventSave } = buildService({
      existingEvents: [{ title: 'CHỢ ĐÊM', specificDate: null, dayOfWeek: 6 }],
      extractDrafts,
    });

    const run = await service.scan(
      '2026-10-01',
      '2026-10-07',
      EventScanTriggeredBy.MANUAL,
      'u1',
    );

    expect(localEventSave).not.toHaveBeenCalled();
    expect(run.skippedDuplicateCount).toBe(1);
  });

  it('title trùng nhưng ngày/thứ khác -> KHÔNG coi là trùng, vẫn tạo mới', async () => {
    const extractDrafts = jest.fn().mockResolvedValue([
      {
        title: 'Lễ hội ánh sáng',
        description: null,
        recurrence: EventRecurrence.ONCE,
        dayOfWeek: null,
        specificDate: '2026-10-20',
      },
    ]);
    const { service, localEventSave } = buildService({
      existingEvents: [
        {
          title: 'lễ hội ánh sáng',
          specificDate: '2026-10-05',
          dayOfWeek: null,
        },
      ],
      extractDrafts,
    });

    const run = await service.scan(
      '2026-10-01',
      '2026-10-25',
      EventScanTriggeredBy.MANUAL,
      'u1',
    );

    expect(localEventSave).toHaveBeenCalledTimes(1);
    expect(run.createdEventsCount).toBe(1);
    expect(run.skippedDuplicateCount).toBe(0);
  });

  it('2 draft trùng nhau NGAY TRONG CÙNG 1 lần quét (Gemini lặp lại) -> chỉ tạo 1, bỏ qua 1', async () => {
    const extractDrafts = jest.fn().mockResolvedValue([
      {
        title: 'Hội chợ ẩm thực',
        description: 'Mô tả A',
        recurrence: EventRecurrence.ONCE,
        dayOfWeek: null,
        specificDate: '2026-10-15',
      },
      {
        title: 'hội chợ ẩm thực',
        description: 'Mô tả B (cùng sự kiện, Gemini liệt kê 2 lần)',
        recurrence: EventRecurrence.ONCE,
        dayOfWeek: null,
        specificDate: '2026-10-15',
      },
    ]);
    const { service, localEventSave } = buildService({ extractDrafts });

    const run = await service.scan(
      '2026-10-01',
      '2026-10-20',
      EventScanTriggeredBy.MANUAL,
      'u1',
    );

    expect(run.createdEventsCount).toBe(1);
    expect(run.skippedDuplicateCount).toBe(1);
    expect(localEventSave).toHaveBeenCalledTimes(1);
  });

  it('quét thành công, lưu đúng citations và status SUCCESS', async () => {
    const citations = [{ url: 'https://example.com/a', title: 'Báo A' }];
    const generateWithSearch = jest
      .fn()
      .mockResolvedValue({ text: 'nội dung tìm được', citations });
    const extractDrafts = jest.fn().mockResolvedValue([
      {
        title: 'Sự kiện mới',
        description: null,
        recurrence: EventRecurrence.ONCE,
        dayOfWeek: null,
        specificDate: '2026-10-12',
      },
    ]);
    const { service, scanRunSave } = buildService({
      generateWithSearch,
      extractDrafts,
    });

    const run = await service.scan(
      '2026-10-01',
      '2026-10-20',
      EventScanTriggeredBy.MANUAL,
      'admin-1',
    );

    expect(run.status).toBe(EventScanStatus.SUCCESS);
    expect(run.citations).toEqual(citations);
    expect(run.createdEventsCount).toBe(1);
    expect(run.triggeredByUserId).toBe('admin-1');
    expect(scanRunSave).toHaveBeenCalledTimes(1);
  });

  it('Gemini không tìm thấy sự kiện nào trong khoảng ngày -> vẫn SUCCESS (0 kết quả), không phải FAILED', async () => {
    const citations = [{ url: 'https://example.com/b', title: 'Báo B' }];
    const generateWithSearch = jest
      .fn()
      .mockResolvedValue({ text: 'không có sự kiện nào', citations });
    const extractDrafts = jest
      .fn()
      .mockRejectedValue(
        new Error('Không tìm thấy sự kiện nào trong nguồn này.'),
      );
    const { service } = buildService({ generateWithSearch, extractDrafts });

    const run = await service.scan(
      '2026-10-01',
      '2026-10-20',
      EventScanTriggeredBy.CRON,
      null,
    );

    expect(run.status).toBe(EventScanStatus.SUCCESS);
    expect(run.createdEventsCount).toBe(0);
    expect(run.citations).toEqual(citations);
  });
});
