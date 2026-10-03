import { retryWithBackoff } from './retry-with-backoff';

describe('retryWithBackoff', () => {
  it('trả về kết quả ngay nếu lần gọi đầu tiên thành công, không chờ/không retry', async () => {
    const operation = jest.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(operation, {
      retryableStatus: new Set([429]),
      delaysMs: [1000, 3000],
    });
    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('thử lại đúng số lần rồi thành công, dùng setTimeout thật (delay 0ms) để không làm chậm test', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('quá tải'), { status: 429 }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error('quá tải'), { status: 429 }),
      )
      .mockResolvedValue('ok sau 2 lần thử lại');
    const onRetry = jest.fn();

    const result = await retryWithBackoff(operation, {
      retryableStatus: new Set([429]),
      delaysMs: [0, 0, 0],
      onRetry,
    });

    expect(result).toBe('ok sau 2 lần thử lại');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 0, expect.any(Error));
    expect(onRetry).toHaveBeenNthCalledWith(2, 1, expect.any(Error));
  });

  it('ném lại lỗi gốc ngay khi status KHÔNG nằm trong retryableStatus, không retry', async () => {
    const err = Object.assign(new Error('bad request'), { status: 400 });
    const operation = jest.fn().mockRejectedValue(err);

    await expect(
      retryWithBackoff(operation, {
        retryableStatus: new Set([429]),
        delaysMs: [0, 0],
      }),
    ).rejects.toBe(err);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('lỗi KHÔNG có status (VD lỗi mạng) luôn được coi là đáng thử lại', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue('ok');

    const result = await retryWithBackoff(operation, {
      retryableStatus: new Set([429]),
      delaysMs: [0],
    });
    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('ném lại lỗi gốc sau khi hết số lần thử lại cho phép', async () => {
    const err = Object.assign(new Error('vẫn quá tải'), { status: 503 });
    const operation = jest.fn().mockRejectedValue(err);

    await expect(
      retryWithBackoff(operation, {
        retryableStatus: new Set([503]),
        delaysMs: [0, 0],
      }),
    ).rejects.toBe(err);
    // 1 lần gọi gốc + 2 lần thử lại (length của delaysMs) = 3 lần gọi tổng cộng.
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
