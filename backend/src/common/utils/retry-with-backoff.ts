// Vòng lặp retry-with-backoff dùng chung cho mọi lệnh gọi Gemini có thể lỗi tạm thời (quá
// tải/giới hạn tần suất) — trước đây 3 nơi (LocalEventExtractionService,
// LocalPlaceExtractionService, LocalEventAutoScanService) tự viết lặp lại y hệt vòng lặp
// này, chỉ khác retryableStatus/delaysMs/cách xử lý lỗi cuối cùng. Hàm này CHỈ lo phần cơ
// chế retry — việc wrap lỗi cuối cùng thành thông báo tiếng Việt cho từng domain vẫn do nơi
// gọi tự quyết định (xem các generateJsonWithRetry/generateWithSearchRetry).
export interface RetryWithBackoffOptions {
  // Status code coi là lỗi tạm thời, đáng thử lại — status undefined (lỗi không có mã, VD
  // lỗi mạng) cũng luôn được coi là đáng thử lại.
  retryableStatus: Set<number>;
  // Độ trễ (ms) trước mỗi lần thử lại — length của mảng này = số lần thử lại tối đa.
  delaysMs: number[];
  // Gọi trước mỗi lần chờ để thử lại — dùng để log cảnh báo theo đúng format của từng nơi
  // gọi, không cố định cứng 1 câu log chung cho mọi domain.
  onRetry?: (attempt: number, err: unknown) => void;
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryWithBackoffOptions,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const retryable =
        status === undefined || options.retryableStatus.has(status);
      if (!retryable || attempt >= options.delaysMs.length) {
        throw err;
      }
      options.onRetry?.(attempt, err);
      await new Promise((resolve) =>
        setTimeout(resolve, options.delaysMs[attempt]),
      );
    }
  }
}
