import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CompleteRefundRequestDto } from './complete-refund-request.dto';

// proofImageUrl giờ BẮT BUỘC (trước đây optional) — test ở đúng tầng validate thật sự chặn
// request (ValidationPipe toàn cục dùng class-validator trên DTO này), KHÔNG test qua
// RefundRequestService.complete() vì service không tự validate, chỉ tin DTO đã hợp lệ.
describe('CompleteRefundRequestDto validation', () => {
  it('thiếu proofImageUrl -> validate() báo lỗi rõ ràng, không cho qua', async () => {
    const dto = plainToInstance(CompleteRefundRequestDto, {
      adminNote: 'Đã chuyển khoản',
    });

    const errors = await validate(dto);

    const proofImageUrlError = errors.find((e) => e.property === 'proofImageUrl');
    expect(proofImageUrlError).toBeDefined();
    expect(Object.values(proofImageUrlError!.constraints ?? {})).toContain(
      'Vui lòng đính kèm ảnh biên lai trước khi xác nhận',
    );
  });

  it('proofImageUrl rỗng ("") -> vẫn bị chặn (IsNotEmpty)', async () => {
    const dto = plainToInstance(CompleteRefundRequestDto, {
      proofImageUrl: '',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'proofImageUrl')).toBe(true);
  });

  it('có proofImageUrl hợp lệ -> không có lỗi nào', async () => {
    const dto = plainToInstance(CompleteRefundRequestDto, {
      adminNote: 'Đã chuyển khoản',
      proofImageUrl: 'https://cdn.example.com/vikahotel/refund-proof/abc.webp',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
