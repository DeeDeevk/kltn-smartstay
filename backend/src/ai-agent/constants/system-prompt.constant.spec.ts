import { buildSystemPrompt } from './system-prompt.constant';

describe('buildSystemPrompt', () => {
  it('lấy "hôm nay" theo giờ Việt Nam, không theo UTC', () => {
    // 20:00 UTC ngày 18/09 = 03:00 sáng 19/09 giờ Việt Nam (Thứ Bảy). Trước đây dùng
    // toISOString() nên prompt ghi nhầm là 2026-09-18.
    const prompt = buildSystemPrompt(new Date('2026-09-18T20:00:00Z'));

    expect(prompt).toContain('Thứ Bảy, ngày 2026-09-19');
  });

  it('giữ đúng ngày khi đã là buổi chiều giờ Việt Nam', () => {
    // 08:00 UTC = 15:00 giờ Việt Nam, cùng ngày 18/09 (Thứ Sáu).
    const prompt = buildSystemPrompt(new Date('2026-09-18T08:00:00Z'));

    expect(prompt).toContain('Thứ Sáu, ngày 2026-09-18');
  });
});
