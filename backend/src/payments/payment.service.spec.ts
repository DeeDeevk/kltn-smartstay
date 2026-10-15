import { BadRequestException } from '@nestjs/common';
import { APIError, type CreatePaymentLinkRequest } from '@payos/node';
import { PaymentService } from './payment.service';
import { BookingService } from '../bookings/booking.service';
import { VietqrBankService } from './vietqr-bank.service';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';

// Test resolveBankBin()/extractPayerBankInfo() (private, gọi gián tiếp qua handleWebhook)
// — logic KAN-123. Test createLinkForBooking() nằm ở describe block riêng bên dưới
// (buildLinkService), vì cần mock payos.paymentRequests thay vì payos.webhooks.
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

  const findBinByName =
    overrides?.findBinByName ?? jest.fn().mockResolvedValue(null);
  const vietqrBankService = {
    findBinByName,
  } as unknown as VietqrBankService;

  const service = new PaymentService(config, bookingService, vietqrBankService);
  // payos.webhooks.verify() thật sẽ kiểm tra chữ ký — không cần test lại ở đây (đã có cơ chế
  // verify riêng của PayOS), chỉ cần giả lập để test logic SAU khi verify thành công.
  (service as unknown as { payos: { webhooks: { verify: jest.Mock } } }).payos =
    {
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

    const [, payerBankInfo] = markPaidByOrderCode.mock.calls[0] as [
      number,
      Record<string, string> | null,
    ];
    expect(payerBankInfo).not.toHaveProperty('bankBin');
    expect(payerBankInfo).toEqual(
      expect.objectContaining({
        'Tên người chuyển': 'Nguyen Van A',
        'Số tài khoản': '0123456789',
      }),
    );
  });
});

// Booking tối giản đủ field mà createLinkForBooking() đọc tới (roomType.name,
// guestInfo, totalAmount, paymentMethod/paymentStatus, payosOrderCode, room).
function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    bookingId: 'b-1',
    paymentMethod: PaymentMethod.PAYOS,
    paymentStatus: PaymentStatus.UNPAID,
    payosOrderCode: '1001',
    totalAmount: 5000000,
    roomType: { name: 'Deluxe Ocean View' },
    room: null,
    guestInfo: {
      fullName: 'Nguyen Van A',
      phone: '0901234567',
      email: 'a@example.com',
    },
    ...overrides,
  };
}

const REQUESTER = { userId: 'u-1', role: 'CUSTOMER' };

function buildLinkService(options?: {
  booking?: ReturnType<typeof makeBooking>;
  freshOrderCode?: string;
}) {
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'CORS_ORIGIN') return fallback ?? 'http://localhost:5173';
      return 'dummy';
    }),
  } as unknown as ConstructorParameters<typeof PaymentService>[0];

  const booking = options?.booking ?? makeBooking();
  const findById = jest.fn().mockResolvedValue(booking);
  const assignFreshPayosOrderCode = jest
    .fn()
    .mockResolvedValue(options?.freshOrderCode ?? '2002');
  const markPaidByOrderCode = jest.fn().mockResolvedValue(undefined);
  const bookingService = {
    findById,
    assignFreshPayosOrderCode,
    markPaidByOrderCode,
  } as unknown as BookingService;

  const findBinByName = jest.fn().mockResolvedValue(null);
  const vietqrBankService = {
    findBinByName,
  } as unknown as VietqrBankService;

  const service = new PaymentService(config, bookingService, vietqrBankService);

  const create = jest.fn();
  const get = jest.fn();
  const cancel = jest.fn();
  (
    service as unknown as {
      payos: {
        paymentRequests: {
          create: jest.Mock;
          get: jest.Mock;
          cancel: jest.Mock;
        };
      };
    }
  ).payos = { paymentRequests: { create, get, cancel } };

  return {
    service,
    booking,
    findById,
    assignFreshPayosOrderCode,
    markPaidByOrderCode,
    create,
    get,
    cancel,
  };
}

describe('PaymentService.createLinkForBooking', () => {
  it('tạo mới thành công: trả đủ field VietQR cho mobile (bin/accountNumber/accountName/amount/description/orderCode)', async () => {
    const { service, create } = buildLinkService();
    create.mockResolvedValueOnce({
      bin: '970436',
      accountNumber: '0011001234567',
      accountName: 'VIKA HOTEL',
      amount: 5000000,
      description: 'DH 1001',
      orderCode: 1001,
      currency: 'VND',
      paymentLinkId: 'pl-1',
      status: 'PENDING',
      checkoutUrl: 'https://pay.payos.vn/web/xyz',
      qrCode: '00020101...',
      expiredAt: 1234567890,
    });

    const result = await service.createLinkForBooking('b-1', REQUESTER);

    expect(result).toEqual({
      checkoutUrl: 'https://pay.payos.vn/web/xyz',
      qrCode: '00020101...',
      expiredAt: 1234567890,
      bin: '970436',
      accountNumber: '0011001234567',
      accountName: 'VIKA HOTEL',
      amount: 5000000,
      description: 'DH 1001',
      orderCode: '1001',
    });
    expect(create).toHaveBeenCalledTimes(1);
    const firstCallArgs = (
      create.mock.calls[0] as [CreatePaymentLinkRequest]
    )[0];
    expect(firstCallArgs).toMatchObject({
      orderCode: 1001,
      amount: 5000000,
      description: 'DH 1001',
    });
  });

  it('orderCode cũ đã tồn tại link PENDING -> huỷ link cũ rồi phát hành orderCode mới và tạo lại link', async () => {
    const { service, create, get, cancel, assignFreshPayosOrderCode } =
      buildLinkService();
    create
      .mockRejectedValueOnce(
        new APIError(
          400,
          { code: '231', desc: 'Mã đơn hàng đã tồn tại' },
          'HTTP 400',
          undefined,
        ),
      )
      .mockResolvedValueOnce({
        bin: '970436',
        accountNumber: '0011001234567',
        accountName: 'VIKA HOTEL',
        amount: 5000000,
        description: 'DH 2002',
        orderCode: 2002,
        currency: 'VND',
        paymentLinkId: 'pl-2',
        status: 'PENDING',
        checkoutUrl: 'https://pay.payos.vn/web/new',
        qrCode: 'qr-new',
        expiredAt: 999,
      });
    get.mockResolvedValueOnce({
      id: 'pl-1',
      orderCode: 1001,
      amount: 5000000,
      amountPaid: 0,
      amountRemaining: 5000000,
      status: 'PENDING',
      createdAt: '2026-01-01T00:00:00Z',
      transactions: [],
      cancellationReason: null,
      canceledAt: null,
    });

    const result = await service.createLinkForBooking('b-1', REQUESTER);

    expect(get).toHaveBeenCalledWith(1001);
    expect(cancel).toHaveBeenCalledWith(1001, expect.any(String));
    expect(assignFreshPayosOrderCode).toHaveBeenCalledWith('b-1');
    expect(create).toHaveBeenCalledTimes(2);
    const secondCallArgs = (
      create.mock.calls[1] as [CreatePaymentLinkRequest]
    )[0];
    expect(secondCallArgs).toMatchObject({
      orderCode: 2002,
      description: 'DH 2002',
    });
    expect(result.orderCode).toBe('2002');
    expect(result.checkoutUrl).toBe('https://pay.payos.vn/web/new');
  });

  it('orderCode cũ đã CANCELLED/EXPIRED -> không gọi cancel(), vẫn phát hành orderCode mới và tạo lại link', async () => {
    const { service, create, get, cancel } = buildLinkService();
    create
      .mockRejectedValueOnce(new APIError(400, {}, 'HTTP 400', undefined))
      .mockResolvedValueOnce({
        bin: '970436',
        accountNumber: '0011001234567',
        accountName: 'VIKA HOTEL',
        amount: 5000000,
        description: 'DH 2002',
        orderCode: 2002,
        currency: 'VND',
        paymentLinkId: 'pl-2',
        status: 'PENDING',
        checkoutUrl: 'https://pay.payos.vn/web/new',
        qrCode: 'qr-new',
        expiredAt: 999,
      });
    get.mockResolvedValueOnce({
      id: 'pl-1',
      orderCode: 1001,
      amount: 5000000,
      amountPaid: 0,
      amountRemaining: 5000000,
      status: 'EXPIRED',
      createdAt: '2026-01-01T00:00:00Z',
      transactions: [],
      cancellationReason: null,
      canceledAt: null,
    });

    await service.createLinkForBooking('b-1', REQUESTER);

    expect(cancel).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('orderCode cũ đã PAID -> đánh dấu booking đã thanh toán rồi báo lỗi, không tạo link mới', async () => {
    const { service, create, get, markPaidByOrderCode } = buildLinkService();
    create.mockRejectedValueOnce(new APIError(400, {}, 'HTTP 400', undefined));
    get.mockResolvedValueOnce({
      id: 'pl-1',
      orderCode: 1001,
      amount: 5000000,
      amountPaid: 5000000,
      amountRemaining: 0,
      status: 'PAID',
      createdAt: '2026-01-01T00:00:00Z',
      transactions: [
        {
          reference: 'r1',
          amount: 5000000,
          accountNumber: '0123456789',
          description: 'chuyen khoan',
          transactionDateTime: '2026-01-01T01:00:00Z',
          virtualAccountName: null,
          virtualAccountNumber: null,
          counterAccountBankId: null,
          counterAccountBankName: null,
          counterAccountName: 'Nguyen Van A',
          counterAccountNumber: '0123456789',
        },
      ],
      cancellationReason: null,
      canceledAt: null,
    });

    await expect(
      service.createLinkForBooking('b-1', REQUESTER),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(markPaidByOrderCode).toHaveBeenCalledWith(
      1001,
      expect.objectContaining({ 'Tên người chuyển': 'Nguyen Van A' }),
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('orderCode cũ đang UNDERPAID/PROCESSING -> báo lỗi rõ ràng, không tự huỷ hay phát hành lại', async () => {
    const { service, create, get, cancel, assignFreshPayosOrderCode } =
      buildLinkService();
    create.mockRejectedValueOnce(new APIError(400, {}, 'HTTP 400', undefined));
    get.mockResolvedValueOnce({
      id: 'pl-1',
      orderCode: 1001,
      amount: 5000000,
      amountPaid: 2000000,
      amountRemaining: 3000000,
      status: 'UNDERPAID',
      createdAt: '2026-01-01T00:00:00Z',
      transactions: [],
      cancellationReason: null,
      canceledAt: null,
    });

    await expect(
      service.createLinkForBooking('b-1', REQUESTER),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(cancel).not.toHaveBeenCalled();
    expect(assignFreshPayosOrderCode).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('create() lỗi vì lý do khác (get(orderCode) sau đó cũng không tìm thấy) -> ném lại lỗi gốc, không nuốt lỗi', async () => {
    const { service, create, get } = buildLinkService();
    const originalError = new APIError(
      500,
      { code: '20', desc: 'Lỗi hệ thống PayOS' },
      'HTTP 500',
      undefined,
    );
    create.mockRejectedValueOnce(originalError);
    get.mockRejectedValueOnce(new Error('Payment link not found'));

    await expect(service.createLinkForBooking('b-1', REQUESTER)).rejects.toBe(
      originalError,
    );
  });

  it('lỗi không phải từ PayOS API (VD lỗi mạng) -> ném lại ngay, không gọi get()', async () => {
    const { service, create, get } = buildLinkService();
    const networkError = new Error('fetch failed');
    create.mockRejectedValueOnce(networkError);

    await expect(service.createLinkForBooking('b-1', REQUESTER)).rejects.toBe(
      networkError,
    );
    expect(get).not.toHaveBeenCalled();
  });
});
