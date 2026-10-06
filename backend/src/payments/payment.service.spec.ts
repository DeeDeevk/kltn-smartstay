import { PaymentService } from './payment.service';
import { BookingService } from '../bookings/booking.service';
import { VietqrBankService } from './vietqr-bank.service';

// Chỉ test resolveBankBin()/extractPayerBankInfo() (private, gọi gián tiếp qua
// handleWebhook) — logic MỚI của KAN-123. Các method khác của PaymentService (tạo link
// thanh toán...) không đổi hành vi, không cần test lại ở đây.
function buildService(overrides?: { findBinByName?: jest.Mock }) {
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'CORS_ORIGIN') return fallback ?? 'http://localhost:5173';
      return 'dummy';
    }),
  } as unknown as ConstructorParameters<typeof PaymentService>[0];

  const markPaidByOrderCode = jest.fn().mockResolvedValue(undefined);
  const bookingService = {
    markPaidByOrderCode,
  } as unknown as BookingService;

  const findBinByName = overrides?.findBinByName ?? jest.fn().mockResolvedValue(null);
  const vietqrBankService = {
    findBinByName,
  } as unknown as VietqrBankService;

  const service = new PaymentService(config, bookingService, vietqrBankService);
  // payos.webhooks.verify() thật sẽ kiểm tra chữ ký — không cần test lại ở đây (đã có cơ chế
  // verify riêng của PayOS), chỉ cần giả lập để test logic SAU khi verify thành công.
  (service as unknown as { payos: { webhooks: { verify: jest.Mock } } }).payos = {
    webhooks: { verify: jest.fn() },
  };
  return { service, markPaidByOrderCode, findBinByName };
}

describe('PaymentService.handleWebhook — trích payerBankInfo/bankBin (KAN-123)', () => {
  it('counterAccountBankId khớp định dạng BIN (6 số) -> dùng thẳng, KHÔNG gọi tra theo tên', async () => {
    const { service, markPaidByOrderCode, findBinByName } = buildService();
    (
      service as unknown as { payos: { webhooks: { verify: jest.Mock } } }
    ).payos.webhooks.verify.mockResolvedValue({
      orderCode: 123,
      code: '00',
      counterAccountBankId: '970423',
      counterAccountBankName: 'TMCP Tien Phong',
      counterAccountName: 'Nguyen Van A',
      counterAccountNumber: '0123456789',
    });

    await service.handleWebhook({});

    expect(findBinByName).not.toHaveBeenCalled();
    expect(markPaidByOrderCode).toHaveBeenCalledWith(
      123,
      expect.objectContaining({ bankBin: '970423' }),
    );
  });

  it('counterAccountBankId khớp mã viết tắt NAPAS (chữ hoa) -> dùng thẳng', async () => {
    const { service, markPaidByOrderCode, findBinByName } = buildService();
    (
      service as unknown as { payos: { webhooks: { verify: jest.Mock } } }
    ).payos.webhooks.verify.mockResolvedValue({
      orderCode: 123,
      code: '00',
      counterAccountBankId: 'TPB',
      counterAccountBankName: 'TMCP Tien Phong',
    });

    await service.handleWebhook({});

    expect(findBinByName).not.toHaveBeenCalled();
    expect(markPaidByOrderCode).toHaveBeenCalledWith(
      123,
      expect.objectContaining({ bankBin: 'TPB' }),
    );
  });

  it('counterAccountBankId SAI định dạng (không phải 6 số hay mã viết tắt hợp lệ) -> KHÔNG tin, chuyển sang tra theo tên', async () => {
    const findBinByName = jest.fn().mockResolvedValue('970423');
    const { service, markPaidByOrderCode } = buildService({ findBinByName });
    (
      service as unknown as { payos: { webhooks: { verify: jest.Mock } } }
    ).payos.webhooks.verify.mockResolvedValue({
      orderCode: 123,
      code: '00',
      counterAccountBankId: 'not-a-valid-id-123',
      counterAccountBankName: 'TMCP Tien Phong',
    });

    await service.handleWebhook({});

    expect(findBinByName).toHaveBeenCalledWith('TMCP Tien Phong');
    expect(markPaidByOrderCode).toHaveBeenCalledWith(
      123,
      expect.objectContaining({ bankBin: '970423' }),
    );
  });

  it('không có counterAccountBankId -> tra theo tên qua VietqrBankService', async () => {
    const findBinByName = jest.fn().mockResolvedValue('970436');
    const { service, markPaidByOrderCode } = buildService({ findBinByName });
    (
      service as unknown as { payos: { webhooks: { verify: jest.Mock } } }
    ).payos.webhooks.verify.mockResolvedValue({
      orderCode: 123,
      code: '00',
      counterAccountBankName: 'Vietcombank',
    });

    await service.handleWebhook({});

    expect(findBinByName).toHaveBeenCalledWith('Vietcombank');
    expect(markPaidByOrderCode).toHaveBeenCalledWith(
      123,
      expect.objectContaining({ bankBin: '970436' }),
    );
  });

  it('không tra được BIN (không có bankId hợp lệ, không khớp tên) -> payerBankInfo KHÔNG có field bankBin', async () => {
    const { service, markPaidByOrderCode } = buildService({
      findBinByName: jest.fn().mockResolvedValue(null),
    });
    (
      service as unknown as { payos: { webhooks: { verify: jest.Mock } } }
    ).payos.webhooks.verify.mockResolvedValue({
      orderCode: 123,
      code: '00',
      counterAccountName: 'Nguyen Van A',
      counterAccountNumber: '0123456789',
      counterAccountBankName: 'Ngân hàng lạ không có trong danh sách',
    });

    await service.handleWebhook({});

    const [, payerBankInfo] = markPaidByOrderCode.mock.calls[0];
    expect(payerBankInfo).not.toHaveProperty('bankBin');
    expect(payerBankInfo).toEqual(
      expect.objectContaining({
        'Tên người chuyển': 'Nguyen Van A',
        'Số tài khoản': '0123456789',
      }),
    );
  });
});
