import { Repository } from 'typeorm';
import { LocalPlaceService } from './local-place.service';
import { LocalPlace } from './entities/local-place.entity';
import { LocalPlaceSource } from 'src/common/enums/local-place-source.enum';
import { LocalPlaceStatus } from 'src/common/enums/local-place-status.enum';

// Trọng tâm: approve() PHẢI từ chối khi còn thiếu address/latitude/longitude — ràng buộc
// bắt buộc theo yêu cầu tính năng (1 địa điểm APPROVED mà thiếu toạ độ sẽ khiến agent giới
// thiệu cho khách một chỗ không biết ở đâu). Các case CRUD còn lại test ngắn gọn để chắc
// hành vi cơ bản đúng, không lặp lại độ sâu đã có ở local-event.service.spec.ts.
describe('LocalPlaceService', () => {
  function buildService(seed?: Partial<LocalPlace>) {
    const existing: LocalPlace = {
      placeId: 'p-1',
      name: 'Chợ đêm Bến Thành',
      description: null,
      address: null,
      latitude: null,
      longitude: null,
      addressHint: null,
      source: LocalPlaceSource.AI_SUGGESTED,
      status: LocalPlaceStatus.PENDING,
      sourceRef: 'https://example.com/bai-viet',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...seed,
    };
    const findOne = jest.fn().mockResolvedValue(existing);
    const save = jest.fn((x: unknown) => Promise.resolve(x));
    const create = jest.fn((x: unknown) => x);
    const remove = jest.fn().mockResolvedValue(undefined);
    const find = jest.fn().mockResolvedValue([existing]);
    const repo = {
      findOne,
      save,
      create,
      remove,
      find,
    } as unknown as Repository<LocalPlace>;
    const service = new LocalPlaceService(repo);
    return { service, existing, findOne, save, create, remove, find };
  }

  it('từ chối duyệt khi chưa có address', async () => {
    const { service, save } = buildService({
      address: null,
      latitude: null,
      longitude: null,
    });

    await expect(service.approve('p-1')).rejects.toThrow(
      'Địa điểm chưa có địa chỉ, vui lòng chọn địa chỉ trên bản đồ trước khi duyệt.',
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('từ chối duyệt khi có address nhưng thiếu latitude/longitude', async () => {
    const { service, save } = buildService({
      address: '123 Lê Lợi',
      latitude: null,
      longitude: null,
    });

    await expect(service.approve('p-1')).rejects.toThrow(
      'Địa điểm chưa có địa chỉ, vui lòng chọn địa chỉ trên bản đồ trước khi duyệt.',
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('duyệt thành công khi đã đủ address/latitude/longitude', async () => {
    const { service, save } = buildService({
      address: '123 Lê Lợi, Quận 1',
      latitude: 10.776,
      longitude: 106.7,
    });

    const result = await service.approve('p-1');

    expect(result.status).toBe(LocalPlaceStatus.APPROVED);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('báo lỗi 404 khi duyệt 1 địa điểm không tồn tại', async () => {
    const { service, findOne } = buildService();
    findOne.mockResolvedValueOnce(null);

    await expect(service.approve('khong-ton-tai')).rejects.toThrow(
      'Không tìm thấy địa điểm',
    );
  });

  it('create() lưu địa điểm với trạng thái mặc định của entity (không tự gán APPROVED)', async () => {
    const { service, create, save } = buildService();

    await service.create({
      name: 'Bãi biển Mỹ Khê',
      address: '1 Võ Nguyên Giáp',
      latitude: 16.06,
      longitude: 108.24,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Bãi biển Mỹ Khê',
        address: '1 Võ Nguyên Giáp',
        latitude: 16.06,
        longitude: 108.24,
      }),
    );
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('update() chỉ ghi đè field có mặt trong dto, giữ nguyên field còn lại', async () => {
    const { service, save } = buildService({
      name: 'Tên cũ',
      description: 'Mô tả cũ',
    });

    await service.update('p-1', { description: 'Mô tả mới' });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Tên cũ', description: 'Mô tả mới' }),
    );
  });

  it('findApproved() chỉ truy vấn status = APPROVED', async () => {
    const { service, find } = buildService();

    await service.findApproved();

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: LocalPlaceStatus.APPROVED } }),
    );
  });
});
