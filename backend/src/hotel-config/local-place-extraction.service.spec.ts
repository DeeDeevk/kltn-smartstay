import { Repository } from 'typeorm';
import { LocalPlaceExtractionService } from './local-place-extraction.service';
import { LocalPlace } from './entities/local-place.entity';
import { GeminiProvider } from '../ai-agent/llm/gemini.provider';
import { SourceContentService } from './source-content.service';
import { LocalPlaceSource } from 'src/common/enums/local-place-source.enum';
import { LocalPlaceStatus } from 'src/common/enums/local-place-status.enum';

// Hành vi fetch/redirect/SSRF dùng chung với LocalEventExtractionService đã được test đầy
// đủ ở local-event-extraction.service.spec.ts (qua SourceContentService) — ở đây chỉ tập
// trung vào phần RIÊNG của domain LocalPlace: sanitize kết quả Gemini trả về và việc luôn
// lưu address/latitude/longitude = null, addressHint tách riêng khỏi description.
function buildService(generateJson: jest.Mock, readUrlText?: jest.Mock) {
  const create = jest.fn((x: unknown) => x);
  const save = jest.fn((x: unknown) => Promise.resolve(x));
  const repo = { create, save } as unknown as Repository<LocalPlace>;
  const gemini = { generateJson } as unknown as GeminiProvider;
  const sourceContentService = {
    readUrlText: readUrlText ?? jest.fn(),
    readFileText: jest.fn(),
  } as unknown as SourceContentService;
  const service = new LocalPlaceExtractionService(
    repo,
    gemini,
    sourceContentService,
  );
  return { service, create, save, sourceContentService };
}

describe('LocalPlaceExtractionService', () => {
  it('từ chối khi thiếu cả url lẫn text', async () => {
    const { service } = buildService(jest.fn());
    await expect(service.extract({})).rejects.toThrow(
      'Vui lòng cung cấp đúng một trong hai: link hoặc nội dung văn bản.',
    );
  });

  it('từ chối khi có cả url lẫn text', async () => {
    const { service } = buildService(jest.fn());
    await expect(
      service.extract({ url: 'https://example.com', text: 'abc' }),
    ).rejects.toThrow(
      'Vui lòng cung cấp đúng một trong hai: link hoặc nội dung văn bản.',
    );
  });

  it('bỏ qua item thiếu name, giữ lại addressHint tách riêng khỏi description', async () => {
    const generateJson = jest.fn().mockResolvedValue([
      { name: '', description: 'Không có tên nên phải bị loại' },
      {
        name: 'Chợ đêm Bến Thành',
        description: 'Khu chợ đêm sầm uất',
        addressHint: 'Đường Lê Lợi, Quận 1',
      },
      { name: 'Không có addressHint', description: 'Mô tả' },
    ]);
    const { service, create, save } = buildService(generateJson);

    const result = await service.extract({
      text: 'Bài viết giới thiệu địa điểm...',
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: 'Chợ đêm Bến Thành',
        description: 'Khu chợ đêm sầm uất',
        addressHint: 'Đường Lê Lợi, Quận 1',
        address: null,
        latitude: null,
        longitude: null,
        source: LocalPlaceSource.AI_SUGGESTED,
        status: LocalPlaceStatus.PENDING,
      }),
    );
    expect(create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: 'Không có addressHint',
        addressHint: null,
      }),
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
  });

  it('báo lỗi khi Gemini không tìm thấy địa điểm nào (mảng rỗng)', async () => {
    const generateJson = jest.fn().mockResolvedValue([]);
    const { service } = buildService(generateJson);

    await expect(
      service.extract({ text: 'Không nhắc tới địa điểm nào' }),
    ).rejects.toThrow('Không tìm thấy địa điểm nào trong nguồn này.');
  });

  it('dùng SourceContentService.readUrlText khi trích xuất từ url', async () => {
    const readUrlText = jest.fn().mockResolvedValue('Nội dung trang web...');
    const generateJson = jest
      .fn()
      .mockResolvedValue([
        { name: 'Bãi biển Mỹ Khê', description: null, addressHint: null },
      ]);
    const { service } = buildService(generateJson, readUrlText);

    await service.extract({ url: 'https://example.com/bai-viet' });

    expect(readUrlText).toHaveBeenCalledWith('https://example.com/bai-viet');
  });
});
