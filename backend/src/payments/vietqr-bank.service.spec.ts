import { VietqrBankService } from './vietqr-bank.service';

const SAMPLE_BANKS = [
  {
    id: 43,
    name: 'Ngân hàng TMCP Ngoại Thương Việt Nam',
    code: 'VCB',
    bin: '970436',
    shortName: 'Vietcombank',
  },
  {
    id: 39,
    name: 'Ngân hàng TMCP Tiên Phong',
    code: 'TPB',
    bin: '970423',
    shortName: 'TPBank',
  },
];

function mockFetchOnce(response: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve(response),
  }) as unknown as typeof fetch;
}

describe('VietqrBankService.findBinByName', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('khớp CHÍNH XÁC sau khi bỏ dấu/"TMCP"/"Ngân hàng" -> trả đúng BIN', async () => {
    mockFetchOnce({ data: SAMPLE_BANKS });
    const service = new VietqrBankService();

    // PayOS trả tên không dấu, kiểu rút gọn hay gặp trong thực tế.
    const result = await service.findBinByName('TMCP Tien Phong');

    expect(result).toBe('970423');
  });

  it('khớp theo shortName (VD "Vietcombank") -> trả đúng BIN', async () => {
    mockFetchOnce({ data: SAMPLE_BANKS });
    const service = new VietqrBankService();

    const result = await service.findBinByName('Vietcombank');

    expect(result).toBe('970436');
  });

  it('không khớp ngân hàng nào -> trả null, KHÔNG đoán đại', async () => {
    mockFetchOnce({ data: SAMPLE_BANKS });
    const service = new VietqrBankService();

    const result = await service.findBinByName('Ngân hàng không tồn tại XYZ');

    expect(result).toBeNull();
  });

  it('bankName rỗng/null -> trả null ngay, không gọi API', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const service = new VietqrBankService();

    const result = await service.findBinByName(null);

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('chỉ gọi fetch() 1 lần cho nhiều lượt tra cứu (cache trong bộ nhớ)', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ data: SAMPLE_BANKS }),
    });
    global.fetch = fetchSpy as unknown as typeof fetch;
    const service = new VietqrBankService();

    await service.findBinByName('Vietcombank');
    await service.findBinByName('TPBank');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('API lỗi/mạng lỗi -> trả null thay vì ném lỗi (không phá luồng webhook thanh toán)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    const service = new VietqrBankService();

    const result = await service.findBinByName('Vietcombank');

    expect(result).toBeNull();
  });
});
