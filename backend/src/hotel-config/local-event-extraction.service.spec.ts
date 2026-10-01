import { Repository } from 'typeorm';
import { LocalEventExtractionService } from './local-event-extraction.service';
import { LocalEvent } from './entities/local-event.entity';
import { GeminiProvider } from '../ai-agent/llm/gemini.provider';
import { SourceContentService } from './source-content.service';

// Chỉ test hành vi fetch/redirect của fetchUrlText() — phần kiểm tra host (IP riêng, IPv4-
// mapped, DNS...) đã được test độc lập và đầy đủ ở ssrf-guard.spec.ts. Ở đây quan tâm tới
// việc gọi lại assertSafeUrl() cho MỖI lần chuyển hướng và giới hạn số lần chuyển hướng.

type FetchResponseStub = {
  status: number;
  location?: string;
  body?: string;
};

function stubResponse({ status, location, body }: FetchResponseStub) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'location' ? (location ?? null) : null,
    },
    body:
      body === undefined
        ? null
        : new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(body));
              controller.close();
            },
          }),
  };
}

// Trả lần lượt từng response theo thứ tự request, và ghi lại URL của mỗi lần fetch — dùng
// mảng calledUrls (kiểu string[]) thay vì đọc lại fetchMock.mock.calls sau đó để tránh phải
// đụng tới kiểu `any` mà jest.fn() không tham số kiểu tạo ra.
function mockFetchSequence(...responses: ReturnType<typeof stubResponse>[]) {
  const calledUrls: string[] = [];
  let index = 0;
  const fetchMock = jest.fn((url: string) => {
    calledUrls.push(url);
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return Promise.resolve(response);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock, calledUrls };
}

function buildService(generateJson: jest.Mock) {
  const repo = {
    create: jest.fn((x: unknown) => x),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
  } as unknown as Repository<LocalEvent>;
  const gemini = { generateJson } as unknown as GeminiProvider;
  // SourceContentService không có dependency nào tự thân (chỉ gọi global.fetch/assertSafeUrl)
  // nên dùng instance thật trực tiếp, không cần mock — các test bên dưới vẫn mock
  // global.fetch như trước, giờ chỉ đi qua thêm 1 lớp gọi lại giống hệt hành vi cũ.
  const sourceContentService = new SourceContentService();
  return new LocalEventExtractionService(repo, gemini, sourceContentService);
}

describe('LocalEventExtractionService — fetchUrlText redirect handling', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('chặn khi link công khai redirect sang IP nội bộ', async () => {
    const { fetchMock, calledUrls } = mockFetchSequence(
      stubResponse({
        status: 302,
        location: 'http://169.254.169.254/latest/meta-data',
      }),
    );
    const generateJson = jest.fn();
    const service = buildService(generateJson);

    await expect(
      service.extract({ url: 'https://203.0.113.10/redirector' }),
    ).rejects.toThrow('Không được phép trích xuất từ địa chỉ nội bộ.');
    // assertSafeUrl chặn TRƯỚC khi kịp gọi fetch cho địa chỉ đích — chỉ request gốc chạy.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calledUrls).toEqual(['https://203.0.113.10/redirector']);
    expect(generateJson).not.toHaveBeenCalled();
  });

  it('từ chối khi chuỗi redirect vượt quá 3 lần', async () => {
    const { fetchMock } = mockFetchSequence(
      stubResponse({ status: 302, location: 'https://198.51.100.2/' }),
      stubResponse({ status: 302, location: 'https://198.51.100.3/' }),
      stubResponse({ status: 302, location: 'https://198.51.100.4/' }),
      stubResponse({ status: 302, location: 'https://198.51.100.5/' }),
    );
    const service = buildService(jest.fn());

    await expect(
      service.extract({ url: 'https://198.51.100.1/redirector' }),
    ).rejects.toThrow('Link chuyển hướng quá nhiều lần, không thể tải.');
    // Gốc + 3 lần chuyển hướng được đi theo = 4 request, lần thứ 4 vẫn là redirect nên bị chặn.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('URL công khai hợp lệ (không redirect) vẫn đi qua được tới bước gọi Gemini', async () => {
    const { fetchMock } = mockFetchSequence(
      stubResponse({
        status: 200,
        body: '<html><body><p>Lễ hội ánh sáng, 20:00 thứ Bảy hàng tuần.</p></body></html>',
      }),
    );
    const generateJson = jest.fn().mockResolvedValue([
      {
        title: 'Lễ hội ánh sáng',
        description: '20:00 thứ Bảy hàng tuần',
        isRecurring: true,
        dayOfWeek: 6,
        specificDate: null,
      },
    ]);
    const service = buildService(generateJson);

    // IP literal công khai (không phải tên miền) — tránh phải mock DNS trong file này, phần
    // phân giải DNS đã được test riêng và đầy đủ ở ssrf-guard.spec.ts.
    const result = await service.extract({ url: 'https://203.0.113.50/' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(generateJson).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it('theo đúng redirect tương đối (chuyển hướng sang path cùng host)', async () => {
    const { fetchMock, calledUrls } = mockFetchSequence(
      stubResponse({ status: 301, location: '/moved' }),
      stubResponse({ status: 200, body: '<html><body>ok</body></html>' }),
    );
    const generateJson = jest.fn().mockResolvedValue([]);
    const service = buildService(generateJson);

    await expect(
      service.extract({ url: 'https://203.0.113.20/start' }),
    ).rejects.toThrow('Không tìm thấy sự kiện nào trong nguồn này.');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Redirect tương đối phải được resolve dựa trên host của request trước đó.
    expect(calledUrls[1]).toBe('https://203.0.113.20/moved');
  });
});
